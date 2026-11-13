import { apiRequest } from "@/lib/api";

export type StoreRecord = {
  id: string;
  name: string;
  address: string;
  isTakeAway: boolean;
  takeawayPrintingEnabled: boolean;
  takeawayShiftEnabled: boolean;
  takeawayShiftCount: number;
  takeawayFinalShift: number;
  isActive: boolean;
  deletedAt: string | null;
};
export type StoreInput = Pick<StoreRecord, "name" | "address" | "isTakeAway" | "isActive" | "takeawayPrintingEnabled" | "takeawayShiftEnabled" | "takeawayShiftCount" | "takeawayFinalShift">;

export async function getStores(management = false, history = false) {
  const data = await apiRequest<{ items: StoreRecord[] }>(`/stores.php${management ? "?management=1" : history ? "?history=1" : ""}`);
  return data.items;
}
export async function saveStore(id: string | null, values: Partial<StoreInput>) {
  const data = await apiRequest<{ item: StoreRecord }>(`/stores.php${id ? `?id=${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PATCH" : "POST", body: JSON.stringify(values),
  });
  return data.item;
}
export async function deleteStore(id: string) {
  await apiRequest(`/stores.php?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
