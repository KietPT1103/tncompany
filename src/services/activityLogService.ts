import { apiRequest, getApiToken } from "@/lib/api";

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
  hasScreenshot: boolean;
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

export type ActivityLogDetailResponse = {
  item: ActivityLog;
};

function buildActivityLogQuery(filters: ActivityLogFilters = {}) {
  const params = new URLSearchParams();

  if (filters.machineId) params.set("machineId", filters.machineId);
  if (filters.eventType) params.set("eventType", filters.eventType);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  return params;
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const params = buildActivityLogQuery(filters);
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

export async function getActivityLog(id: number) {
  return apiRequest<ActivityLogDetailResponse>(`/activity-logs.php?id=${id}`, {
    method: "GET",
  });
}

export async function downloadActivityLogScreenshots(
  filters: ActivityLogFilters = {},
  deleteAfterDownload = false
) {
  const params = buildActivityLogQuery(filters);
  params.set("downloadScreenshots", "1");
  if (deleteAfterDownload) {
    params.set("deleteAfterDownload", "1");
  }

  const token = getApiToken();
  const response = await fetch(`/api/activity-logs.php?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    let payloadError = "";

    try {
      const payload = JSON.parse(text) as { error?: string };
      payloadError = payload.error || "";
    } catch {
      payloadError = "";
    }

    throw new Error(payloadError || "Không tải được file ZIP ảnh.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);

  return {
    blob,
    fileName: match?.[1] || "activity-screenshots.zip",
  };
}
