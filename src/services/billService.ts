import { ApiTimestamp, posRequest } from "@/services/posApi";
import { BILL_API_PAGE_SIZE, collectAllBillPages } from "@/services/billPagination";

export type BillStatus = "completed" | "cancelled";
export type PaymentMethod = "cash" | "transfer";
export type DiscountType = "percent" | "fixed";
export type BillOrderSource = "pos" | "bar";
export type BillItemInput = { menuId: string; name: string; price: number; quantity: number; lineTotal: number; note?: string; basePrice?: number; surchargePerUnit?: number; surchargeTotal?: number; countsAsCup?: boolean | null };
export type BillSurcharge = { id: string; name: string; type: "percent" | "fixed"; value: number; amount: number };
export type NewBill = { tableNumber: string; note?: string; total: number; items: BillItemInput[]; subtotalBeforeSurcharge?: number; surchargeTotal?: number; appliedSurcharges?: BillSurcharge[]; discountType?: DiscountType; discountValue?: number; discountAmount?: number; storeId?: string; status?: BillStatus; paymentMethod?: PaymentMethod; cashReceived?: number; changeAmount?: number; shiftId?: string; cashierId?: string; cashierName?: string; checkoutRequestId?: string };
export type Bill = NewBill & { id: string; orderSource?: BillOrderSource; createdAt?: ApiTimestamp; cancelledAt?: ApiTimestamp; cancelledBy?: string };
export type GetBillsOptions = { startDate?: Date; endDate?: Date; limitCount?: number; storeId?: string; includeCancelled?: boolean; status?: "active" | "cancelled"; shiftId?: string; shiftIds?: string[] };

const getBillsPage = async (options: GetBillsOptions = {}, limit = 100, offset = 0) =>
  (await posRequest<{ items: Bill[] }>("bills", {}, {
    storeId: options.storeId || "cafe",
    startDate: options.startDate,
    endDate: options.endDate,
    limit,
    offset,
    includeCancelled: options.includeCancelled === true,
    status: options.status,
    shiftId: options.shiftId,
    shiftIds: options.shiftIds?.join(","),
  })).items;

export async function saveBill(data: NewBill) { return (await posRequest<{ id: string }>("bills", { method: "POST", body: JSON.stringify(data) })).id; }
export async function getBills(options: GetBillsOptions = {}) {
  return getBillsPage(options, options.limitCount || 100);
}
export const getAllBills = (options: Omit<GetBillsOptions, "limitCount"> = {}) =>
  collectAllBillPages(
    (offset, limit) => getBillsPage(options, limit, offset),
    BILL_API_PAGE_SIZE,
  );
export const getRecentBills = (storeId = "cafe", limitCount = 20, includeCancelled = false) => getBills({ storeId, limitCount, includeCancelled });
export async function updateBill(id: string, data: Partial<NewBill> & { createdAt?: Date; cancelledAt?: Date }) { await posRequest("bills", { method: "PATCH", body: JSON.stringify({ id, ...data }) }); }
export async function cancelBill(id: string, cancelledBy?: string, cancelNote?: string) { await posRequest("bills", { method: "PATCH", body: JSON.stringify({ id, action: "cancel", cancelledBy, note: cancelNote }) }); }
export const getBillsByShift = (shiftId: string) => getBills({ shiftId, includeCancelled: true, limitCount: 2000 });
export async function deleteBill(id: string) { await posRequest("bills", { method: "DELETE" }, { id }); }
