import { ApiTimestamp, posRequest } from "@/services/posApi";
import { Bill } from "./billService";
import { CashVoucher } from "./cashVoucherService";
export type ShiftType = "shift_1" | "shift_2" | "shift_3" | "single";
export type ShiftStatus = "open" | "closed";
export type CashierShift = { id: string; storeId: string; cashierUid: string; cashierName: string; shiftType: ShiftType; status: ShiftStatus; isPreviousDay?: boolean; openedAt?: ApiTimestamp; openingCash: number; openNote?: string; openedByDeviceId?: string; openedByDeviceName?: string; closedAt?: ApiTimestamp; closingCash?: number | null; closeNote?: string; expectedClosingCash?: number | null; cashSales?: number; transferSales?: number; totalSales?: number; completedBills?: number; cancelledBills?: number; cancelledAmount?: number };
export type ShiftOpenInput = { storeId: string; cashierUid: string; cashierName: string; shiftType: ShiftType; openingCash: number; openNote?: string; deviceId: string; deviceName: string; confirmReopen?: boolean };
export type ShiftSummary = { cashSales: number; transferSales: number; totalSales: number; completedBills: number; cancelledBills: number; cancelledAmount: number; incomeVouchers: number; expenseVouchers: number; netCashFlow: number; expectedClosingCash: number };
export function summarizeBillsForShift(bills: Bill[], openingCash: number, vouchers: CashVoucher[] = []): ShiftSummary { const completed=bills.filter(b=>b.status!=="cancelled"),cancelled=bills.filter(b=>b.status==="cancelled");const cashSales=completed.filter(b=>b.paymentMethod!=="transfer").reduce((s,b)=>s+(b.total||0),0);const transferSales=completed.filter(b=>b.paymentMethod==="transfer").reduce((s,b)=>s+(b.total||0),0);const totalSales=completed.reduce((s,b)=>s+(b.total||0),0),cancelledAmount=cancelled.reduce((s,b)=>s+(b.total||0),0);const included=vouchers.filter(v=>!v.isCancelled&&v.includeInCashFlow!==false);const incomeVouchers=included.filter(v=>v.type==="income").reduce((s,v)=>s+(v.amount||0),0);const expenseVouchers=included.filter(v=>v.type==="expense").reduce((s,v)=>s+(v.amount||0),0);return{cashSales,transferSales,totalSales,completedBills:completed.length,cancelledBills:cancelled.length,cancelledAmount,incomeVouchers,expenseVouchers,netCashFlow:totalSales+incomeVouchers-expenseVouchers,expectedClosingCash:openingCash+cashSales+incomeVouchers-expenseVouchers}; }
export function getShiftHandoverAmount(summary: ShiftSummary): number {
  return summary.cashSales + summary.incomeVouchers - summary.expenseVouchers;
}
export async function getOpenShiftByCashier(storeId: string, cashierUid: string) { return (await posRequest<{ item: CashierShift | null }>("shifts", {}, { storeId, cashierUid })).item; }
export async function getShiftsForReport(options: { storeId: string; startDate: Date; endDate: Date; shiftType: Exclude<ShiftType, "single"> }) { return (await posRequest<{ items: CashierShift[] }>("shifts", {}, options)).items; }
export async function openShift(input: ShiftOpenInput) { return posRequest<{item:CashierShift;alreadyOpen:boolean}>("shifts",{method:"POST",body:JSON.stringify(input)}); }
export async function closeShift(id: string, payload: { closingCash: number; closeNote?: string; expectedOpenedAt?: Date; summary: ShiftSummary }) { await posRequest("shifts",{method:"PATCH",body:JSON.stringify({id,...payload})}); }

export async function getShiftReopenWarning(storeId: string, cashierUid: string, shiftType: ShiftType) {
  return (await posRequest<{ item: CashierShift | null }>('shifts', {}, { storeId, cashierUid, shiftType, checkReopen: 1 })).item;
}
export type ShiftReviewBill = { id: string; table_number: string; total: number; status: string; payment_method: string; created_at: string };
export type ShiftReviewVoucher = { id: string; amount: number; voucher_type: string; happened_at: string; cancelled_at: string | null; include_in_cash_flow: number };
export type ShiftCorrectionHistory = { id: number; actor_name: string; reason: string; created_at: string; before_json: string; after_json: string; transfers_json: string };
export type ShiftReview = { shift: CashierShift; bills: ShiftReviewBill[]; vouchers: ShiftReviewVoucher[]; reviewToken: string; history: ShiftCorrectionHistory[] };
export async function getManagedShifts(storeId: string, date: string) {
  return (await posRequest<{ items: CashierShift[] }>('shift-management', {}, { storeId, date })).items;
}
export async function getShiftReview(storeId: string, id: string) {
  return posRequest<ShiftReview>('shift-review', {}, { storeId, id });
}
export async function correctShift(storeId: string, input: { id: string; openedAt: string; closedAt: string | null; reason: string; reviewed: boolean; reviewToken: string; transfers: { billId: string; targetShiftId: string }[] }) {
  return posRequest<{ updated: boolean; movedBills: number }>('shift-review', { method: 'PATCH', body: JSON.stringify({ storeId, ...input }) });
}
