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
  offset?: number;
};

export type ActivityLogResponse = {
  items: ActivityLog[];
  machines: ActivityMachine[];
  hasMore: boolean;
  nextOffset: number | null;
};

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const params = new URLSearchParams();

  if (filters.machineId) params.set("machineId", filters.machineId);
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  params.set("limit", String(filters.limit ?? 200));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));

  return apiRequest<ActivityLogResponse>(`/activity-logs.php?${params.toString()}`, {
    method: "GET",
  });
}

export async function getAllActivityLogs(filters: ActivityLogFilters = {}, batchSize = 1000) {
  const items: ActivityLog[] = [];
  let machines: ActivityMachine[] = [];
  let offset = 0;

  while (true) {
    const response = await getActivityLogs({
      ...filters,
      limit: batchSize,
      offset,
    });

    if (machines.length === 0) {
      machines = response.machines;
    }

    items.push(...response.items);

    if (!response.hasMore || response.items.length === 0) {
      break;
    }

    offset = response.nextOffset ?? offset + response.items.length;
  }

  return {
    items,
    machines,
  };
}
