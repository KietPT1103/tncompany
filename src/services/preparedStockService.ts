import { apiRequest } from "@/lib/api";

export type PreparedStockItem = {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  components: Array<{ ingredientId: string; ingredientCode: string; ingredientName: string; unit: string; inputQuantity: number; conversionFactor: number }>;
  openingQuantity: number | null;
  usedQuantity: number;
  actualQuantity: number | null;
  currentQuantity: number;
  rawEquivalentQuantity: number;
};

export type PreparedStockOverview = {
  items: PreparedStockItem[];
  dateFrom: string;
  dateTo: string;
  latestCountDate: string | null;
  openingCountDate: string | null;
  canEditPast: boolean;
  isLocked: boolean;
};

export function getPreparedStock(storeId: string, dateFrom: string, dateTo: string) {
  const query = new URLSearchParams({ storeId, dateFrom, dateTo });
  return apiRequest<PreparedStockOverview>(`/prepared-stock.php?${query}`);
}

export function savePreparedStockCount(payload: {
  storeId: string;
  countDate: string;
  note?: string;
  items: Array<{ ingredientId: string; actualQuantity: number }>;
}) {
  return apiRequest<{ id: string }>("/prepared-stock.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
