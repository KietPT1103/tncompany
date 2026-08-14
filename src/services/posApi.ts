import { apiRequest } from "@/lib/api";

export type ApiTimestamp = { seconds: number; nanoseconds?: number };

export const posQuery = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, value instanceof Date ? value.toISOString() : String(value));
  });
  return search.toString();
};

export const posRequest = <T>(resource: string, options: RequestInit = {}, params: Record<string, unknown> = {}) =>
  apiRequest<T>(`/pos.php?${posQuery({ resource, ...params })}`, options);

export function subscribeByPolling<T>(loader: () => Promise<T>, onChange: (value: T) => void, onError?: (error: Error) => void, intervalMs = 5000) {
  let stopped = false;
  let loading = false;
  let failures = 0;
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const isPaused = () =>
    (typeof document !== "undefined" && document.visibilityState === "hidden") ||
    (typeof navigator !== "undefined" && navigator.onLine === false);

  const schedule = (delayMs = intervalMs) => {
    if (stopped || isPaused()) return;
    if (timer !== undefined) globalThis.clearTimeout(timer);
    timer = globalThis.setTimeout(() => void poll(), delayMs);
  };

  const poll = async () => {
    if (stopped || loading || isPaused()) return;
    loading = true;
    try {
      const value = await loader();
      failures = 0;
      if (!stopped) onChange(value);
    } catch (error) {
      failures += 1;
      if (!stopped) onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      loading = false;
      schedule(failures ? Math.min(intervalMs * 2 ** failures, 60000) : intervalMs);
    }
  };

  const resume = () => {
    if (stopped || isPaused()) return;
    if (timer !== undefined) globalThis.clearTimeout(timer);
    timer = undefined;
    void poll();
  };

  if (typeof document !== "undefined") document.addEventListener("visibilitychange", resume);
  if (typeof window !== "undefined") window.addEventListener("online", resume);
  void poll();
  return () => {
    stopped = true;
    if (timer !== undefined) globalThis.clearTimeout(timer);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", resume);
    if (typeof window !== "undefined") window.removeEventListener("online", resume);
  };
}
