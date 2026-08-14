import { ApiTimestamp, posRequest } from "@/services/posApi";

export type BillStatus = "completed" | "cancelled";
export type PaymentMethod = "cash" | "transfer";
export type BillItemInput = { menuId: string; name: string; price: number; quantity: number; lineTotal: number; note?: string; basePrice?: number; surchargePerUnit?: number; surchargeTotal?: number };
export type BillSurcharge = { id: string; name: string; type: "percent" | "fixed"; value: number; amount: number };
export type NewBill = { tableNumber: string; note?: string; total: number; items: BillItemInput[]; subtotalBeforeSurcharge?: number; surchargeTotal?: number; appliedSurcharges?: BillSurcharge[]; storeId?: string; status?: BillStatus; paymentMethod?: PaymentMethod; cashReceived?: number; changeAmount?: number; shiftId?: string; cashierId?: string; cashierName?: string };
export type Bill = NewBill & { id: string; createdAt?: ApiTimestamp; cancelledAt?: ApiTimestamp; cancelledBy?: string };

export async function saveBill(data: NewBill) { return (await posRequest<{ id: string }>("bills", { method: "POST", body: JSON.stringify(data) })).id; }
export async function getBills(options?: { startDate?: Date; endDate?: Date; limitCount?: number; storeId?: string; includeCancelled?: boolean; shiftId?: string }) {
  return (await posRequest<{ items: Bill[] }>("bills", {}, { storeId: options?.storeId || "cafe", startDate: options?.startDate, endDate: options?.endDate, limit: options?.limitCount || 100, includeCancelled: options?.includeCancelled === true, shiftId: options?.shiftId })).items;
}
export const getRecentBills = (storeId = "cafe", limitCount = 20, includeCancelled = false) => getBills({ storeId, limitCount, includeCancelled });
export async function updateBill(id: string, data: Partial<NewBill> & { createdAt?: Date; cancelledAt?: Date }) { await posRequest("bills", { method: "PATCH", body: JSON.stringify({ id, ...data }) }); }
export async function cancelBill(id: string, cancelledBy?: string, cancelNote?: string) { await posRequest("bills", { method: "PATCH", body: JSON.stringify({ id, action: "cancel", cancelledBy, note: cancelNote }) }); }
export const getBillsByShift = (shiftId: string) => getBills({ shiftId, includeCancelled: true, limitCount: 2000 });
export async function deleteBill(id: string) { await posRequest("bills", { method: "DELETE" }, { id }); }
