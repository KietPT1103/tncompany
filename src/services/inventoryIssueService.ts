import { apiRequest } from "@/lib/api";
import type { InventoryIssuePrintJob } from "@/services/inventoryIssuePrintJobService";

export type InventoryIssueItem = {
  id?: number;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  baseQuantity?: number;
  stockBefore?: number | null;
  stockAfter?: number | null;
  note: string;
};

export type InventoryIssue = {
  id: string;
  storeId: string;
  issueCode: string;
  issueDate: string;
  destination: string;
  issuedBy: string;
  status: "draft" | "completed" | "cancelled";
  note: string;
  totalQuantity: number;
  itemCount: number;
  createdBy: string;
  completedBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
  shiftId?: string | null;
  shiftType?: "shift_1" | "shift_2" | "shift_3" | "single" | null;
  updatedAt: string;
  revision: number;
  cancelReason?: string;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  items: InventoryIssueItem[];
  printJob?: InventoryIssuePrintJob | null;
};

export type InventoryIssuePayload = {
  id?: string;
  revision?: number;
  storeId: string;
  issueDate: string;
  destination: string;
  issuedBy: string;
  status: "draft" | "completed";
  note?: string;
  shiftId?: string | null;
  shiftType?: "shift_1" | "shift_2" | "shift_3" | "single" | null;
  items: Array<{ ingredientCode: string; quantity: number; note?: string }>;
};

export async function getInventoryIssues(storeId: string, limit = 50) {
  const result = await apiRequest<{ items: InventoryIssue[] }>(
    `/inventory-issues.php?storeId=${encodeURIComponent(storeId)}&limit=${limit}`,
  );
  return result.items;
}

export async function saveInventoryIssue(payload: InventoryIssuePayload) {
  const result = await apiRequest<{ item: InventoryIssue }>("/inventory-issues.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.item;
}

export async function cancelInventoryIssue(issue: InventoryIssue, reason: string) {
  const result = await apiRequest<{ item: InventoryIssue }>("/inventory-issues.php", {
    method: "POST",
    body: JSON.stringify({ action: "cancel", id: issue.id, storeId: issue.storeId, revision: issue.revision, reason }),
  });
  return result.item;
}

export async function getInventoryIssuePage(storeId: string, filters: { dateFrom: string; dateTo: string; keyword: string; page: number; limit: number }) {
  const query = new URLSearchParams({ storeId });
  Object.entries(filters).forEach(([key, value]) => query.set(key, String(value)));
  return apiRequest<{ items: InventoryIssue[]; pagination: { page: number; limit: number; total: number; pages: number } }>("/inventory-issues.php?" + query);
}
