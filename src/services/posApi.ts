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

export function subscribeByPolling<T>(loader: () => Promise<T>, onChange: (value: T) => void, onError?: (error: Error) => void, intervalMs = 2000) {
  let stopped = false;
  let loading = false;
  const poll = async () => {
    if (stopped || loading) return;
    loading = true;
    try { const value = await loader(); if (!stopped) onChange(value); }
    catch (error) { if (!stopped) onError?.(error instanceof Error ? error : new Error(String(error))); }
    finally { loading = false; }
  };
  void poll();
  const timer = globalThis.setInterval(poll, intervalMs);
  return () => { stopped = true; globalThis.clearInterval(timer); };
}
