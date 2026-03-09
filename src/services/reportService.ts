import { apiRequest } from "@/lib/api";
import { CostRow } from "./cost";

export type Report = {
  id?: string;
  createdAt: string;
  startDate?: string | null;
  endDate?: string | null;
  includeInCashFlow?: boolean;
  fileName: string;
  revenue: number;
  salary: number;
  electric: number;
  other: number;
  totalMaterialCost: number;
  totalCost: number;
  profit: number;
  details: CostRow[];
  storeId?: string;
};

export type NewReport = Omit<Report, "id" | "createdAt" | "startDate" | "endDate"> & {
  createdAt?: Date | string;
  startDate?: Date | string;
  endDate?: Date | string;
};

const toApiDateTime = (value?: Date | string | null) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value} 00:00:00`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const reportDateToDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function saveReport(data: NewReport) {
  const { id } = await apiRequest<{ id: string }>("/reports.php", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      storeId: data.storeId || "cafe",
      createdAt: toApiDateTime(data.createdAt) || undefined,
      startDate: toApiDateTime(data.startDate),
      endDate: toApiDateTime(data.endDate),
      includeInCashFlow: data.includeInCashFlow ?? true,
    }),
  });
  return id;
}

export async function getReports(
  limitCount = 20,
  startDate?: Date,
  endDate?: Date,
  storeId = "cafe"
) {
  const params = new URLSearchParams({
    storeId,
    limit: String(limitCount),
  });

  if (startDate) {
    params.set("startDate", toApiDateTime(startDate) || "");
  }
  if (endDate) {
    params.set("endDate", toApiDateTime(endDate) || "");
  }

  const { items } = await apiRequest<{ items: Report[] }>(
    `/reports.php?${params.toString()}`,
    {
      method: "GET",
    }
  );
  return items;
}

export async function getReportById(id: string) {
  const { item } = await apiRequest<{ item: Report | null }>(
    `/reports.php?id=${encodeURIComponent(id)}`,
    {
      method: "GET",
    }
  );
  return item;
}

export async function updateReport(id: string, data: Partial<Report>) {
  await apiRequest<{ updated: boolean }>("/reports.php", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      ...data,
    }),
  });
}

export async function deleteReport(id: string) {
  await apiRequest<{ deleted: boolean }>(
    `/reports.php?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}
