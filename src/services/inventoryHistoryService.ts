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
export function getInventoryHistory(filters: {storeId:string;type?:"all"|"receipt"|"issue";dateFrom?:string;dateTo?:string;limit?:number;page?:number}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key,value]) => {if(value!==undefined&&value!=="")query.set(key,String(value));});
  return apiRequest<{items:InventoryHistoryEntry[];pagination:{page:number;pages:number;total:number;limit:number}}>(`/inventory-history.php?${query}`);
}

export async function getAllInventoryHistory(filters: {storeId:string;type?:"all"|"receipt"|"issue";dateFrom?:string;dateTo?:string}) {
  const items: InventoryHistoryEntry[] = [];
  let page = 1, pages = 1;
  do { const result = await getInventoryHistory({...filters, page, limit: 300}); items.push(...result.items); pages = result.pagination.pages; page++; } while(page <= pages);
  return { items };
}
