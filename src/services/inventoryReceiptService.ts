import { apiRequest } from "@/lib/api";

export type InventoryReceiptItem = {
  id?: number;
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  note?: string;
};

export type InventoryReceipt = {
  id: string;
  storeId: string;
  receiptCode: string;
  receiptDate: string;
  status: "draft" | "completed";
  note: string;
  totalAmount: number;
  createdBy: string;
  completedBy: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InventoryReceiptItem[];
};

export type InventoryReceiptPayload = {
  id?: string;
  storeId: string;
  receiptDate: string;
  status: "draft" | "completed";
  note?: string;
  items: Array<{
    productCode: string;
    quantity: number;
    unitCost: number;
    note?: string;
  }>;
};

export async function getInventoryReceipts(params: {
  storeId: string;
  status?: "draft" | "completed";
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

  const { items } = await apiRequest<{ items: InventoryReceipt[] }>(
    `/inventory-receipts.php?${query.toString()}`,
    {
      method: "GET",
    }
  );

  return items;
}

export async function saveInventoryReceipt(payload: InventoryReceiptPayload) {
  const { item } = await apiRequest<{ item: InventoryReceipt }>(
    "/inventory-receipts.php",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return item;
}

export async function deleteInventoryReceipt(id: string) {
  const { deleted } = await apiRequest<{ deleted: boolean }>(
    "/inventory-receipts.php",
    {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }
  );

  return deleted;
}
