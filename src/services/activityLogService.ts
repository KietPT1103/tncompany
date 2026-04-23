import { apiRequest } from "@/lib/api";

export type ActivityMachine = {
  machineId: string;
  displayName: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
};

export type ActivityLog = {
  id: number;
  eventId: string;
  machineId: string;
  eventTime: string;
  receivedAt: string;
  eventType: string;
  action: string | null;
  appName: string | null;
  processId: number | null;
  target: string | null;
  details: Record<string, unknown> | null;
};

export type ActivityLogFilters = {
  machineId?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const params = new URLSearchParams();

  if (filters.machineId) params.set("machineId", filters.machineId);
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  params.set("limit", String(filters.limit ?? 200));

  return apiRequest<{
    items: ActivityLog[];
    machines: ActivityMachine[];
  }>(`/activity-logs.php?${params.toString()}`, {
    method: "GET",
  });
}
