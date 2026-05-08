import { apiRequest } from "@/lib/api";

export type InventoryConsumptionSalesItem = {
  productCode: string;
  productName: string;
  quantity: number;
};

export type InventoryConsumptionPreviewItem = {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  costUnit: number;
  lineCost: number;
};

export type InventoryConsumptionPreview = {
  salesItems: InventoryConsumptionSalesItem[];
  items: InventoryConsumptionPreviewItem[];
  errors: string[];
  totalConsumedQuantity: number;
  totalConsumedCost: number;
};

export type InventoryConsumptionRecord = {
  id: string;
  storeId?: string;
  sourceType?: string;
  sourceFileName: string;
  reportStartDate?: string | null;
  reportEndDate?: string | null;
  sourceItemCount: number;
  appliedItemCount: number;
  totalConsumedQuantity: number;
  totalConsumedCost: number;
  note?: string;
  createdBy?: string;
  createdAt: string;
  items?: InventoryConsumptionPreviewItem[];
  errors?: string[];
};

export async function previewInventoryConsumption(payload: {
  storeId: string;
  fileName: string;
  startDate?: string;
  endDate?: string;
  salesItems: InventoryConsumptionSalesItem[];
  note?: string;
}) {
  const { preview } = await apiRequest<{ preview: InventoryConsumptionPreview }>(
    "/inventory-consumptions.php",
    {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        dryRun: true,
      }),
    }
  );

  return preview;
}

export async function applyInventoryConsumption(payload: {
  storeId: string;
  fileName: string;
  startDate?: string;
  endDate?: string;
  salesItems: InventoryConsumptionSalesItem[];
  note?: string;
}) {
  const { item } = await apiRequest<{ item: InventoryConsumptionRecord }>(
    "/inventory-consumptions.php",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return item;
}

export async function getInventoryConsumptions(storeId: string, limit = 10) {
  const { items } = await apiRequest<{ items: InventoryConsumptionRecord[] }>(
    `/inventory-consumptions.php?storeId=${encodeURIComponent(storeId)}&limit=${encodeURIComponent(String(limit))}`,
    {
      method: "GET",
    }
  );

  return items;
}
