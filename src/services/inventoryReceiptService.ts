import { apiRequest } from "@/lib/api";

export type ReceiptStatus = "pending_explanation" | "draft" | "completed" | "cancelled";
export type InventoryReceiptItem = {
  id: number; productId: string; productCode: string; productName: string; unit: string;
  quantity: number; unitPrice: number; unitCost: number; lineTotal: number; note?: string;
};
export type InventoryReceiptImage = {
  id: string; receiptItemId?: number | null; url: string; thumbnailUrl: string;
  capturedAt: string; locationAddress?: string | null;
};
export type InventoryReceipt = {
  id: string; receiptCode: string; areaId: string; storeId: string;
  area: { id: string; name: string }; status: ReceiptStatus; receiptDate: string;
  capturedAt: string | null; createdAt: string; updatedAt: string; createdBy: string;
  createdByName: string; orderCreatorName: string; totalQuantity: number; totalAmount: number; itemCount: number;
  imageCount: number; thumbnailUrl?: string | null; note: string;
  supplierId?: string | null; supplier?: { id: string; supplierCode: string; supplierName: string } | null;
  items: InventoryReceiptItem[]; images: InventoryReceiptImage[];
};
export type ReceiptCounts = Record<ReceiptStatus | "all", number>;
export type ReceiptFilters = {
  status?: ReceiptStatus; areaId?: string; employeeId?: string; dateFrom?: string; dateTo?: string;
  keyword?: string; productKeyword?: string; page?: number; limit?: number; sort?: "newest" | "oldest" | "amount_desc";
};
export type Area = { id: string; code: string; name: string };
export type ProductResult = {
  id: string; productCode: string; productName: string; unit: string;
  areaId: string; areaName: string; attachedToCurrentArea: boolean; similar: boolean;
};

export const getAreas = async () => (await apiRequest<{ items: Area[] }>("/areas.php")).items;
export async function getInventoryReceipts(filters: ReceiptFilters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)));
  return apiRequest<{ items: InventoryReceipt[]; counts: ReceiptCounts; pagination: { page: number; limit: number; total: number; pages: number } }>(
    `/inventory-receipts.php?${query}`
  );
}
export const getInventoryReceipt = async (id: string) =>
  (await apiRequest<{ item: InventoryReceipt }>(`/inventory-receipts.php?id=${encodeURIComponent(id)}`)).item;
export const updateInventoryReceipt = async (id: string, payload: object) =>
  (await apiRequest<{ item: InventoryReceipt }>(`/inventory-receipts.php?id=${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) })).item;
export const completeInventoryReceipt = async (id: string) =>
  (await apiRequest<{ item: InventoryReceipt }>("/inventory-receipts.php?action=complete", { method: "POST", body: JSON.stringify({ id }) })).item;
export const cancelInventoryReceipt = async (id: string, reason: string) =>
  (await apiRequest<{ item: InventoryReceipt }>("/inventory-receipts.php?action=cancel", { method: "POST", body: JSON.stringify({ id, reason }) })).item;
export const searchReceiptProducts = async (search: string, areaId: string) =>
  (await apiRequest<{ items: Array<{
    id: string; ingredientCode: string; ingredientName: string; unit: string; storeId: string;
  }> }>(`/ingredients.php?search=${encodeURIComponent(search)}&areaId=${encodeURIComponent(areaId)}`)).items
    .map((item) => ({
      id: item.id, productCode: item.ingredientCode, productName: item.ingredientName,
      unit: item.unit, areaId: item.storeId, areaName: "", attachedToCurrentArea: true, similar: false,
    }));
export const attachReceiptProduct = async (productId: string, areaId: string) =>
  (await apiRequest<{ item: { id: string } }>("/area-products.php", { method: "POST", body: JSON.stringify({ productId, areaId }) })).item;
export const createReceiptProduct = async (payload: object): Promise<ProductResult> => {
  const item = (await apiRequest<{ item: {
    id: string; ingredientCode: string; ingredientName: string; unit: string; storeId: string;
  } }>("/ingredients.php", { method: "POST", body: JSON.stringify(payload) })).item;
  return {
    id: item.id, productCode: item.ingredientCode, productName: item.ingredientName,
    unit: item.unit, areaId: item.storeId, areaName: "", attachedToCurrentArea: true, similar: false,
  };
};
export const addInventoryReceiptItem = (payload: object) =>
  apiRequest("/inventory-receipt-items.php", { method: "POST", body: JSON.stringify(payload) });
export const updateInventoryReceiptItem = (id: number, payload: object) =>
  apiRequest(`/inventory-receipt-items.php?id=${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteInventoryReceiptItem = (id: number) =>
  apiRequest(`/inventory-receipt-items.php?id=${id}`, { method: "DELETE" });

// Previous imports stay valid, but creation now starts from the camera flow.
export type InventoryReceiptPayload = {
  id?: string; storeId: string; receiptDate: string; status: "draft" | "completed";
  note?: string; items: Array<{ productCode: string; quantity: number; unitCost: number; note?: string }>;
};
export async function saveInventoryReceipt(payload: InventoryReceiptPayload) {
  if (!payload.id) throw new Error("Hãy tạo phiếu kèm ảnh từ ứng dụng mobile trước.");
  return updateInventoryReceipt(payload.id, { note: payload.note, status: "draft" });
}
export const deleteInventoryReceipt = (id: string) =>
  apiRequest<{ deleted: boolean }>(`/inventory-receipts.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
