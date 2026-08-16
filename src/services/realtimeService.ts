import Pusher, { type Channel } from "pusher-js";
import { apiRequest, getApiToken } from "@/lib/api";

export type RealtimeState = "connecting" | "connected" | "disconnected" | "unavailable" | "failed";
export type RealtimeEvent = { name: string; data: Record<string, unknown> };

type RealtimeConfig = {
  enabled: boolean;
  key: string;
  cluster: string;
  authEndpoint: string;
};

type Listener = {
  events: Set<string>;
  onEvent: (event: RealtimeEvent) => void;
  onState?: (state: RealtimeState) => void;
};

type StoreConnection = {
  storeId: string;
  listeners: Set<Listener>;
  pusher?: Pusher;
  channel?: Channel;
  state: RealtimeState;
  disposed: boolean;
};

const connections = new Map<string, StoreConnection>();

const emitState = (entry: StoreConnection, state: RealtimeState) => {
  entry.state = state;
  entry.listeners.forEach((listener) => listener.onState?.(state));
};

async function initialize(entry: StoreConnection) {
  try {
    const config = await apiRequest<RealtimeConfig>("/realtime.php?action=config");
    if (entry.disposed || !config.enabled || !config.key) {
      emitState(entry, "unavailable");
      return;
    }

    const token = getApiToken();
    const pusher = new Pusher(config.key, {
      cluster: config.cluster,
      forceTLS: true,
      channelAuthorization: {
        endpoint: config.authEndpoint,
        transport: "ajax",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });
    entry.pusher = pusher;
    pusher.connection.bind("state_change", ({ current }: { current: string }) => {
      if (entry.disposed) return;
      const state: RealtimeState =
        current === "connected"
          ? "connected"
          : current === "connecting"
            ? "connecting"
            : current === "failed" || current === "unavailable"
              ? current
              : "disconnected";
      emitState(entry, state);
    });
    pusher.connection.bind("error", () => {
      if (!entry.disposed) emitState(entry, "failed");
    });

    const channel = pusher.subscribe(`private-store-${entry.storeId}`);
    entry.channel = channel;
    channel.bind_global((name: string, data: Record<string, unknown>) => {
      if (name.startsWith("pusher:")) return;
      entry.listeners.forEach((listener) => {
        if (listener.events.has(name)) listener.onEvent({ name, data: data || {} });
      });
    });
  } catch (error) {
    console.error("Không khởi tạo được kết nối realtime", error);
    if (!entry.disposed) emitState(entry, "unavailable");
  }
}

export function subscribeStoreEvents(
  storeId: string,
  events: string[],
  onEvent: (event: RealtimeEvent) => void,
  onState?: (state: RealtimeState) => void
) {
  let entry = connections.get(storeId);
  if (!entry) {
    entry = { storeId, listeners: new Set(), state: "connecting", disposed: false };
    connections.set(storeId, entry);
    void initialize(entry);
  }

  const listener: Listener = { events: new Set(events), onEvent, onState };
  entry.listeners.add(listener);
  onState?.(entry.state);

  return () => {
    entry?.listeners.delete(listener);
    if (!entry || entry.listeners.size > 0) return;
    entry.disposed = true;
    entry.channel?.unbind_all();
    entry.pusher?.unsubscribe(`private-store-${storeId}`);
    entry.pusher?.disconnect();
    connections.delete(storeId);
  };
}

export function subscribeRealtimeResource<T>(options: {
  storeId: string;
  events: string[];
  loader: () => Promise<T>;
  onChange: (value: T) => void;
  onError?: (error: Error) => void;
  onState?: (state: RealtimeState) => void;
  fallbackMs?: number;
}) {
  let stopped = false;
  let loading = false;
  let queued = false;
  let realtimeState: RealtimeState = "connecting";
  let lastFallbackAt = Date.now();

  const load = async () => {
    if (stopped) return;
    if (loading) {
      queued = true;
      return;
    }
    loading = true;
    try {
      const value = await options.loader();
      if (!stopped) options.onChange(value);
    } catch (error) {
      if (!stopped) options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      loading = false;
      if (queued && !stopped) {
        queued = false;
        void load();
      }
    }
  };

  void load();
  const unsubscribe = subscribeStoreEvents(
    options.storeId,
    options.events,
    () => void load(),
    (state) => {
      realtimeState = state;
      options.onState?.(state);
      if (state === "connected") void load();
    }
  );
  const fallbackTimer = globalThis.setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const fallbackMs = options.fallbackMs ?? 120000;
    const now = Date.now();
    if (realtimeState !== "connected" || now - lastFallbackAt >= fallbackMs) {
      lastFallbackAt = now;
      void load();
    }
  }, 10000);

  const refreshWhenActive = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    lastFallbackAt = Date.now();
    void load();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") refreshWhenActive();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  return () => {
    stopped = true;
    unsubscribe();
    globalThis.clearInterval(fallbackTimer);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}
