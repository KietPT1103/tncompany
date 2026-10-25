import { ApiTimestamp, posRequest } from "@/services/posApi";
export type CashVoucherType = "income" | "expense";
export type VoucherEvidenceImage = { id: string; url: string; thumbnailUrl: string; capturedAt: string; locationAddress?: string | null };
export type VoucherEvidence = { receiptId: string; receiptCode: string; receiptDate: string; totalAmount: number; supplierName: string; images: VoucherEvidenceImage[] };
export type VoucherEvidenceOption = VoucherEvidence & { storeId?: string; storeName?: string; status: string; createdAt: string; imageCount: number };
export type NewCashVoucher = { storeId: string; type: CashVoucherType; amount: number; category: string; note?: string; personName?: string; includeInCashFlow?: boolean; happenedAt?: Date; shiftId?: string; cashierId?: string; cashierName?: string; inventoryReceiptId?: string | null; previousDayConfirmedFor?: string; sourceShiftId?: string | null; transferRequestId?: string | null; sourceShiftLabel?: string | null; receiverShiftLabel?: string | null };
export type CashVoucher = NewCashVoucher & { id: string; code: string; createdAt?: ApiTimestamp; happenedAt?: ApiTimestamp; isCancelled?: boolean; cancelledAt?: ApiTimestamp; cancelledBy?: string; cancellationReason?: string; evidence?: VoucherEvidence | null };
export type CashVoucherCategory = { id: string; storeId: string; type: CashVoucherType; name: string };
export async function createCashVoucher(data: NewCashVoucher) { return (await posRequest<{ id: string }>("vouchers", { method: "POST", body: JSON.stringify(data) })).id; }
export async function getCashVouchers(options: { storeId: string; startDate?: Date; endDate?: Date; limitCount?: number; offset?: number; shiftId?: string; shiftIds?: string[]; status?: "active" | "cancelled"; includeSourceTransfers?: boolean }) { return (await posRequest<{ items: CashVoucher[] }>("vouchers", {}, { storeId: options.storeId, startDate: options.startDate, endDate: options.endDate, limit: options.limitCount || 500, offset: options.offset, shiftId: options.shiftId, shiftIds: options.shiftIds?.join(","), status: options.status, includeSourceTransfers: options.includeSourceTransfers ? 1 : undefined })).items; }
export async function getCashVoucherCategories(storeId: string, type?: CashVoucherType) { return (await posRequest<{ items: CashVoucherCategory[] }>("voucher-categories", {}, { storeId, type })).items; }
export async function getVoucherEvidenceOptions(storeId: string, limit = 50) { return (await posRequest<{ items: VoucherEvidenceOption[] }>("voucher-evidences", {}, { storeId, limit })).items; }
export async function updateCashVoucherBasic(id: string, data: { category: string; amount?: number; inventoryReceiptId?: string | null }) { await posRequest("vouchers", { method: "PATCH", body: JSON.stringify({ id, ...data }) }); }
export async function cancelCashVoucher(id: string, reason: string) { await posRequest("vouchers", { method: "PATCH", body: JSON.stringify({ id, action: "cancel", reason }) }); }

export async function getAllCashVouchers(options: Parameters<typeof getCashVouchers>[0]) {
const items: CashVoucher[] = [];
const limitCount = 2000;
for (let offset = 0; ; offset += limitCount) {
const batch = await getCashVouchers({ ...options, limitCount, offset });
items.push(...batch);
if (batch.length < limitCount) return items;
}
}

export async function getTransferSourceShifts(storeId: string) {
  return posRequest<{ receiverId: string; items: { id: string; label: string }[] }>("transfer-sources", {}, { storeId });
}
export function transferVoucherNote(voucher: CashVoucher): string {
  return voucher.sourceShiftId ? `Đã thu ${voucher.amount.toLocaleString('vi-VN')}đ từ ${voucher.sourceShiftLabel || voucher.sourceShiftId} vào ${voucher.receiverShiftLabel || voucher.shiftId} (${voucher.code})` : '';
}
export function transferOutForShifts(vouchers: CashVoucher[], ids: string[]): number {
  const sources = new Set(ids);
  return vouchers.filter(v => !v.isCancelled && v.type === 'income' && v.includeInCashFlow !== false && v.sourceShiftId && sources.has(v.sourceShiftId)).reduce((sum,v) => sum + v.amount,0);
}
