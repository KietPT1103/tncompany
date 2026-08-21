import type { ReceiptFilters, ReceiptStatus } from "@/services/inventoryReceiptService";

const statuses = new Set<ReceiptStatus>([
  "pending_explanation",
  "draft",
  "completed",
  "cancelled",
]);

const clean = (value: string | null) => value?.trim() || undefined;

const positiveInteger = (value: string | null, fallback: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
};

export function inventoryReceiptFiltersFromSearchParams(params: URLSearchParams): ReceiptFilters {
  const rawStatus = clean(params.get("status"));
  const status = rawStatus === "all"
    ? undefined
    : statuses.has(rawStatus as ReceiptStatus)
      ? rawStatus as ReceiptStatus
      : "pending_explanation";

  return {
    status,
    ...(clean(params.get("keyword")) && { keyword: clean(params.get("keyword")) }),
    ...(clean(params.get("areaId")) && { areaId: clean(params.get("areaId")) }),
    ...(clean(params.get("dateFrom")) && { dateFrom: clean(params.get("dateFrom")) }),
    ...(clean(params.get("dateTo")) && { dateTo: clean(params.get("dateTo")) }),
    ...(clean(params.get("employeeId")) && { employeeId: clean(params.get("employeeId")) }),
    ...(clean(params.get("productKeyword")) && { productKeyword: clean(params.get("productKeyword")) }),
    page: positiveInteger(params.get("page"), 1, 100_000),
    limit: positiveInteger(params.get("limit"), 20, 100),
  };
}

export function inventoryReceiptFiltersToSearchParams(filters: ReceiptFilters) {
  const params = new URLSearchParams();
  params.set("status", filters.status || "all");
  (["keyword", "areaId", "dateFrom", "dateTo", "employeeId", "productKeyword"] as const)
    .forEach((key) => {
      const value = filters[key]?.trim();
      if (value) params.set(key, value);
    });
  params.set("page", String(filters.page || 1));
  params.set("limit", String(filters.limit || 20));
  return params;
}
