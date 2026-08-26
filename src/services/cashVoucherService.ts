import { ApiTimestamp, posRequest } from "@/services/posApi";
export type CashVoucherType = "income" | "expense";
export type NewCashVoucher = { storeId: string; type: CashVoucherType; amount: number; category: string; note?: string; personName?: string; includeInCashFlow?: boolean; happenedAt?: Date; shiftId?: string; cashierId?: string; cashierName?: string };
export type CashVoucher = NewCashVoucher & { id: string; code: string; createdAt?: ApiTimestamp; happenedAt?: ApiTimestamp; isCancelled?: boolean; cancelledAt?: ApiTimestamp; cancelledBy?: string; cancellationReason?: string };
export type CashVoucherCategory = { id: string; storeId: string; type: CashVoucherType; name: string };
export async function createCashVoucher(data: NewCashVoucher) { return (await posRequest<{ id: string }>("vouchers", { method: "POST", body: JSON.stringify(data) })).id; }
export async function getCashVouchers(options: { storeId: string; startDate?: Date; endDate?: Date; limitCount?: number; shiftId?: string; shiftIds?: string[] }) { return (await posRequest<{ items: CashVoucher[] }>("vouchers", {}, { storeId: options.storeId, startDate: options.startDate, endDate: options.endDate, limit: options.limitCount || 500, shiftId: options.shiftId, shiftIds: options.shiftIds?.join(",") })).items; }
export async function getCashVoucherCategories(storeId: string, type?: CashVoucherType) { return (await posRequest<{ items: CashVoucherCategory[] }>("voucher-categories", {}, { storeId, type })).items; }
export async function updateCashVoucherBasic(id: string, data: { category: string; amount?: number }) { await posRequest("vouchers", { method: "PATCH", body: JSON.stringify({ id, ...data }) }); }
export async function cancelCashVoucher(id: string, reason: string) { await posRequest("vouchers", { method: "PATCH", body: JSON.stringify({ id, action: "cancel", reason }) }); }
