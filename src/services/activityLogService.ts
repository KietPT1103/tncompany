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
  hasDetails: boolean;
};

export type ActivityLogFilters = {
  machineId?: string;
  eventType?: string;
  eventTypes?: string[];
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
};

export type ActivityLogPagination = {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
  from: number;
  to: number;
};

export type ActivityLogResponse = {
  items: ActivityLog[];
  machines: ActivityMachine[];
  pagination: ActivityLogPagination;
};

export type ActivityLogDetailResponse = {
  item: ActivityLog;
};

export type ActivityScreenshotExportJob = {
  jobId: string;
  status: "queued" | "processing" | "ready";
  processed: number;
  total: number;
  archiveName: string;
};

function buildActivityLogQuery(filters: ActivityLogFilters = {}, includePagination = true) {
  const params = new URLSearchParams();
  const normalizedEventTypes = Array.from(
    new Set(
      (filters.eventTypes && filters.eventTypes.length > 0
        ? filters.eventTypes
        : filters.eventType
        ? [filters.eventType]
        : []
      )
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

  if (filters.machineId) params.set("machineId", filters.machineId);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  normalizedEventTypes.forEach((eventType) => {
    params.append("eventTypes[]", eventType);
  });

  if (includePagination) {
    params.set("page", String(Math.max(1, filters.page ?? 1)));
    params.set("perPage", String(Math.max(1, filters.perPage ?? 25)));
  }

  return params;
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
  const params = buildActivityLogQuery(filters, true);

  return apiRequest<ActivityLogResponse>(`/activity-logs.php?${params.toString()}`, {
    method: "GET",
  });
}

export async function getActivityLog(id: number) {
  return apiRequest<ActivityLogDetailResponse>(`/activity-logs.php?id=${id}`, {
    method: "GET",
  });
}

export async function createActivityLogScreenshotExport(filters: ActivityLogFilters = {}) {
  return apiRequest<ActivityScreenshotExportJob>("/activity-logs.php", {
    method: "PUT",
    body: JSON.stringify({
      action: "createScreenshotExport",
      machineId: filters.machineId || "",
      eventTypes: filters.eventTypes || (filters.eventType ? [filters.eventType] : []),
      search: filters.search || "",
      startDate: filters.startDate || "",
      endDate: filters.endDate || "",
    }),
  });
}

export async function advanceActivityLogScreenshotExport(jobId: string) {
  return apiRequest<ActivityScreenshotExportJob>("/activity-logs.php", {
    method: "PATCH",
    body: JSON.stringify({
      action: "advanceScreenshotExport",
      jobId,
    }),
  });
}

export async function downloadActivityLogScreenshotExportArchive(job: ActivityScreenshotExportJob) {
  const token = getApiToken();
  const response = await fetch(
    `/api/activity-logs.php?downloadExportJob=${encodeURIComponent(job.jobId)}`,
    {
      method: "GET",
      cache: "no-store",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let payloadError = "";

    try {
      const payload = JSON.parse(text) as { error?: string };
      payloadError = payload.error || "";
    } catch {
      payloadError = "";
    }

    throw new Error(payloadError || "Khong tai duoc file ZIP anh.");
  }

  const blob = await response.blob();
  return {
    blob,
    fileName: job.archiveName || "activity-screenshots.zip",
  };
}

export async function downloadActivityLogScreenshots(filters: ActivityLogFilters = {}) {
  let job = await createActivityLogScreenshotExport(filters);

  while (job.status !== "ready") {
    job = await advanceActivityLogScreenshotExport(job.jobId);
  }

  return downloadActivityLogScreenshotExportArchive(job);
}

export async function deleteActivityLogScreenshots(filters: ActivityLogFilters = {}) {
  return apiRequest<{ deletedCount: number }>("/activity-logs.php", {
    method: "DELETE",
    body: JSON.stringify({
      action: "deleteScreenshots",
      machineId: filters.machineId || "",
      eventTypes: filters.eventTypes || (filters.eventType ? [filters.eventType] : []),
      search: filters.search || "",
      startDate: filters.startDate || "",
      endDate: filters.endDate || "",
    }),
  });
}
