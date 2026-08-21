export type OverviewShiftData = {
  id: string;
  cashierName?: string;
  shiftType: "shift_1" | "shift_2" | "shift_3" | "single";
  status: "open" | "closed";
  openedAt?: { seconds: number };
  closingCash?: number | null;
};

export type OverviewShiftSummary = {
  totalSales: number;
  cashSales: number;
  transferSales: number;
  completedBills: number;
  cancelledBills: number;
  incomeVouchers: number;
  expenseVouchers: number;
  expectedClosingCash: number;
};

export type OverviewShiftRevenue = {
  shift: OverviewShiftData;
  summary: OverviewShiftSummary;
  variance: number | null;
};

export const getShiftLabel = (shiftType: OverviewShiftData["shiftType"]) => {
  if (shiftType === "shift_1") return "Ca 1";
  if (shiftType === "shift_2") return "Ca 2";
  if (shiftType === "shift_3") return "Ca 3";
  return "Ca đơn";
};

export function orderOverviewShiftRevenueRows(
  rows: OverviewShiftRevenue[],
): OverviewShiftRevenue[] {
  return [...rows].sort((left, right) => {
    if (left.shift.status !== right.shift.status) {
      return left.shift.status === "open" ? -1 : 1;
    }
    return (right.shift.openedAt?.seconds || 0) - (left.shift.openedAt?.seconds || 0);
  });
}
