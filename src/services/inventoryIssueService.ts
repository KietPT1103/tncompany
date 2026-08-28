import { apiRequest } from "@/lib/api";

export type InventoryIssueItem = {
  id?: number;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  quantity: number;
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
  updatedAt: string;
  items: InventoryIssueItem[];
};

export type InventoryIssuePayload = {
  id?: string;
  storeId: string;
  issueDate: string;
  destination: string;
  issuedBy: string;
  status: "draft" | "completed";
  note?: string;
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

export async function deleteInventoryIssue(id: string, storeId: string) {
  return apiRequest<{ deleted: boolean }>("/inventory-issues.php", {
    method: "DELETE",
    body: JSON.stringify({ id, storeId }),
  });
}
