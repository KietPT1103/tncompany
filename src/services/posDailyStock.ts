import { apiRequest } from "@/lib/api";

export type DailyPosStock = Record<string, { received: number; quantity: number }>;

export async function getDailyPosStock(storeId: string, date: string): Promise<DailyPosStock> {
  const { items } = await apiRequest<{ items: Array<{ posCode: string; received: number; quantity: number }> }>(
    `/inventory-pos-stock.php?storeId=${encodeURIComponent(storeId)}&date=${encodeURIComponent(date)}`
  );
  return Object.fromEntries(items.map(item => [item.posCode, { received: item.received, quantity: item.quantity }]));
}
