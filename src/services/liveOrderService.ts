import { ApiTimestamp, posRequest } from "@/services/posApi";
import { subscribeRealtimeResource } from "@/services/realtimeService";
export type LiveOrderStatus = "open" | "closed";
export type LiveOrderItem = { menuId: string; name: string; price: number; quantity: number; note?: string; category?: string };
export type LiveOrder = { id: string; storeId: string; orderKey: string; tableNumber: string; status: LiveOrderStatus; items: LiveOrderItem[]; updatedAt?: ApiTimestamp; createdAt?: ApiTimestamp; updatedById?: string; updatedByName?: string; updatedByRole?: string };
export type UpsertLiveOrderInput = { storeId: string; orderKey: string; tableNumber: string; items: LiveOrderItem[]; updatedById?: string; updatedByName?: string; updatedByRole?: string };
export const getLiveOrders = async (storeId: string) => (await posRequest<{ items: LiveOrder[] }>("live-orders", {}, { storeId })).items;
export const subscribeLiveOrders = (storeId: string, onChange: (orders: LiveOrder[]) => void, onError?: (error: Error) => void) => subscribeRealtimeResource({ storeId, events: ["live-orders-updated"], loader: () => getLiveOrders(storeId), onChange, onError });
export async function upsertLiveOrder(input: UpsertLiveOrderInput) { const items = input.items.filter((item) => item.menuId && item.quantity > 0); if (!items.length) return clearLiveOrder(input.storeId, input.orderKey); await posRequest("live-orders", { method: "PUT", body: JSON.stringify({ ...input, items }) }); }
export async function clearLiveOrder(storeId: string, orderKey: string) { await posRequest("live-orders", { method: "DELETE" }, { storeId, orderKey }); }
