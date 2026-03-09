import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { Bill } from "./billService";
import { CashVoucher } from "./cashVoucherService";

export type ShiftType = "shift_1" | "shift_2" | "shift_3" | "single";
export type ShiftStatus = "open" | "closed";

export type CashierShift = {
  id: string;
  storeId: string;
  cashierUid: string;
  cashierName: string;
  shiftType: ShiftType;
  status: ShiftStatus;
  openedAt?: Timestamp;
  openingCash: number;
  openNote?: string;
  closedAt?: Timestamp;
  closingCash?: number;
  closeNote?: string;
  expectedClosingCash?: number;
  cashSales?: number;
  transferSales?: number;
  totalSales?: number;
  completedBills?: number;
  cancelledBills?: number;
  cancelledAmount?: number;
};

export type ShiftOpenInput = {
  storeId: string;
  cashierUid: string;
  cashierName: string;
  shiftType: ShiftType;
  openingCash: number;
  openNote?: string;
};

export type ShiftSummary = {
  cashSales: number;
  transferSales: number;
  totalSales: number;
  completedBills: number;
  cancelledBills: number;
  cancelledAmount: number;
  incomeVouchers: number;
  expenseVouchers: number;
  netCashFlow: number;
  expectedClosingCash: number;
};

const SHIFTS_COLLECTION = "cashier_shifts";

const toShift = (id: string, data: Record<string, unknown>) =>
  ({
    id,
    ...data,
  } as CashierShift);

export function summarizeBillsForShift(
  bills: Bill[],
  openingCash: number,
  vouchers: CashVoucher[] = []
): ShiftSummary {
  const completed = bills.filter((bill) => bill.status !== "cancelled");
  const cancelled = bills.filter((bill) => bill.status === "cancelled");

  const cashSales = completed.reduce((sum, bill) => {
    if (bill.paymentMethod === "transfer") return sum;
    return sum + (bill.total || 0);
  }, 0);

  const transferSales = completed.reduce((sum, bill) => {
    if (bill.paymentMethod !== "transfer") return sum;
    return sum + (bill.total || 0);
  }, 0);

  const totalSales = completed.reduce((sum, bill) => sum + (bill.total || 0), 0);
  const cancelledAmount = cancelled.reduce(
    (sum, bill) => sum + (bill.total || 0),
    0
  );

  const includedVouchers = vouchers.filter(
    (voucher) => voucher.includeInCashFlow !== false
  );
  const incomeVouchers = includedVouchers
    .filter((voucher) => voucher.type === "income")
    .reduce((sum, voucher) => sum + (voucher.amount || 0), 0);
  const expenseVouchers = includedVouchers
    .filter((voucher) => voucher.type === "expense")
    .reduce((sum, voucher) => sum + (voucher.amount || 0), 0);
  const netCashFlow = totalSales + incomeVouchers - expenseVouchers;

  return {
    cashSales,
    transferSales,
    totalSales,
    completedBills: completed.length,
    cancelledBills: cancelled.length,
    cancelledAmount,
    incomeVouchers,
    expenseVouchers,
    netCashFlow,
    expectedClosingCash: openingCash + cashSales + incomeVouchers - expenseVouchers,
  };
}

export async function getOpenShiftByCashier(storeId: string, cashierUid: string) {
  const q = query(
    collection(db, SHIFTS_COLLECTION),
    where("cashierUid", "==", cashierUid),
    limit(20)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const found = snapshot.docs.find((item) => {
    const data = item.data() as Record<string, unknown>;
    return data.storeId === storeId && data.status === "open";
  });

  if (!found) return null;
  return toShift(found.id, found.data() as Record<string, unknown>);
}

export async function openShift(input: ShiftOpenInput) {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, SHIFTS_COLLECTION), {
    storeId: input.storeId,
    cashierUid: input.cashierUid,
    cashierName: input.cashierName,
    shiftType: input.shiftType,
    openingCash: input.openingCash,
    openNote: input.openNote?.trim() || "",
    status: "open",
    openedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    storeId: input.storeId,
    cashierUid: input.cashierUid,
    cashierName: input.cashierName,
    shiftType: input.shiftType,
    openingCash: input.openingCash,
    openNote: input.openNote?.trim() || "",
    status: "open",
    openedAt: now,
  } as CashierShift;
}

export async function closeShift(
  shiftId: string,
  payload: {
    closingCash: number;
    closeNote?: string;
    summary: ShiftSummary;
  }
) {
  await updateDoc(doc(db, SHIFTS_COLLECTION, shiftId), {
    status: "closed",
    closedAt: serverTimestamp(),
    closingCash: payload.closingCash,
    closeNote: payload.closeNote?.trim() || "",
    expectedClosingCash: payload.summary.expectedClosingCash,
    cashSales: payload.summary.cashSales,
    transferSales: payload.summary.transferSales,
    totalSales: payload.summary.totalSales,
    completedBills: payload.summary.completedBills,
    cancelledBills: payload.summary.cancelledBills,
    cancelledAmount: payload.summary.cancelledAmount,
    incomeVouchers: payload.summary.incomeVouchers,
    expenseVouchers: payload.summary.expenseVouchers,
    netCashFlow: payload.summary.netCashFlow,
  });
}
