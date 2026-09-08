import { apiRequest } from "@/lib/api";

export type InventoryHistoryItem = {
  id: number; ingredientCode: string; ingredientName: string; quantity: number;
  unit: string; unitCost: number; lineTotal: number; note: string;
};
export type InventoryHistoryEntry = {
  id: string; type: "receipt" | "issue"; code: string; date: string;
  status: "pending_explanation" | "draft" | "completed" | "cancelled";
  createdAt: string; actorName: string; counterpart: string; note: string;
  totalAmount: number; totalQuantity: number; items: InventoryHistoryItem[];
};
export function getInventoryHistory(filters: {storeId:string;type?:"all"|"receipt"|"issue";dateFrom?:string;dateTo?:string;limit?:number}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key,value]) => {if(value!==undefined&&value!=="")query.set(key,String(value));});
  return apiRequest<{items:InventoryHistoryEntry[]}>(`/inventory-history.php?${query}`);
}
