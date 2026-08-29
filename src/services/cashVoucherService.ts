import { ApiTimestamp, posRequest } from "@/services/posApi";
export type CashVoucherType = "income" | "expense";
export type VoucherEvidenceImage = { id: string; url: string; thumbnailUrl: string; capturedAt: string; locationAddress?: string | null };
export type VoucherEvidence = { receiptId: string; receiptCode: string; receiptDate: string; totalAmount: number; supplierName: string; images: VoucherEvidenceImage[] };
export type VoucherEvidenceOption = VoucherEvidence & { storeId?: string; storeName?: string; status: string; createdAt: string; imageCount: number };
export type NewCashVoucher = { storeId: string; type: CashVoucherType; amount: number; category: string; note?: string; personName?: string; includeInCashFlow?: boolean; happenedAt?: Date; shiftId?: string; cashierId?: string; cashierName?: string; inventoryReceiptId?: string | null };
export type CashVoucher = NewCashVoucher & { id: string; code: string; createdAt?: ApiTimestamp; happenedAt?: ApiTimestamp; isCancelled?: boolean; cancelledAt?: ApiTimestamp; cancelledBy?: string; cancellationReason?: string; evidence?: VoucherEvidence | null };
export type CashVoucherCategory = { id: string; storeId: string; type: CashVoucherType; name: string };
export async function createCashVoucher(data: NewCashVoucher) { return (await posRequest<{ id: string }>("vouchers", { method: "POST", body: JSON.stringify(data) })).id; }
export async function getCashVouchers(options: { storeId: string; startDate?: Date; endDate?: Date; limitCount?: number; shiftId?: string; shiftIds?: string[]; status?: "active" | "cancelled" }) { return (await posRequest<{ items: CashVoucher[] }>("vouchers", {}, { storeId: options.storeId, startDate: options.startDate, endDate: options.endDate, limit: options.limitCount || 500, shiftId: options.shiftId, shiftIds: options.shiftIds?.join(","), status: options.status })).items; }
export async function getCashVoucherCategories(storeId: string, type?: CashVoucherType) { return (await posRequest<{ items: CashVoucherCategory[] }>("voucher-categories", {}, { storeId, type })).items; }
export async function getVoucherEvidenceOptions(storeId: string, limit = 50) { return (await posRequest<{ items: VoucherEvidenceOption[] }>("voucher-evidences", {}, { storeId, limit })).items; }
export async function updateCashVoucherBasic(id: string, data: { category: string; amount?: number; inventoryReceiptId?: string | null }) { await posRequest("vouchers", { method: "PATCH", body: JSON.stringify({ id, ...data }) }); }
export async function cancelCashVoucher(id: string, reason: string) { await posRequest("vouchers", { method: "PATCH", body: JSON.stringify({ id, action: "cancel", reason }) }); }
