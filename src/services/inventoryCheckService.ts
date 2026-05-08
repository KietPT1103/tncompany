import { apiRequest } from "@/lib/api";

export type InventoryCheckItem = {
  id?: number;
  productId?: string;
  productCode: string;
  productName: string;
  systemQuantity: number;
  isCounted: boolean;
  actualQuantity: number | null;
  varianceQuantity: number | null;
  unitCost: number;
  varianceValue: number | null;
  note?: string;
};

export type InventoryCheck = {
  id: string;
  storeId: string;
  checkCode: string;
  checkDate: string;
  status: "draft" | "completed" | "cancelled";
  note: string;
  countedItemCount: number;
  totalActualQuantity: number;
  totalVarianceQuantity: number;
  increaseQuantityTotal: number;
  decreaseQuantityTotal: number;
  varianceValueTotal: number;
  createdBy: string;
  completedBy: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InventoryCheckItem[];
};

export type InventoryCheckPayload = {
  id?: string;
  storeId: string;
  checkDate: string;
  status: "draft" | "completed";
  note?: string;
  items: Array<{
    productCode: string;
    actualQuantity: number | null;
    note?: string;
  }>;
};

export async function getInventoryChecks(params: {
  storeId: string;
  status?: "draft" | "completed" | "cancelled";
  search?: string;
  limit?: number;
}) {
  const query = new URLSearchParams({
    storeId: params.storeId,
    limit: String(params.limit || 50),
  });

  if (params.status) {
    query.set("status", params.status);
  }

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const { items } = await apiRequest<{ items: InventoryCheck[] }>(
    `/inventory-checks.php?${query.toString()}`,
    {
      method: "GET",
    }
  );

  return items;
}

export async function saveInventoryCheck(payload: InventoryCheckPayload) {
  const { item } = await apiRequest<{ item: InventoryCheck }>("/inventory-checks.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return item;
}

export async function deleteInventoryCheck(id: string) {
  const { deleted } = await apiRequest<{ deleted: boolean }>("/inventory-checks.php", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });

  return deleted;
}
