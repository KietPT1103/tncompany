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
  cupCount?: number;
  peopleCount?: number;
};

export type OverviewCupBill = {
  status?: "completed" | "cancelled";
  items?: Array<{
    menuId?: string;
    quantity?: number;
    countsAsCup?: boolean | null;
    price?: number;
  }>;
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

export function countCupsForOverview(
  bills: OverviewCupBill[],
  fallbackCupProductCodes: ReadonlySet<string> = new Set(),
): number {
  return bills
    .filter((bill) => bill.status !== "cancelled")
    .flatMap((bill) => bill.items || [])
    .filter((item) =>
      item.countsAsCup === true
      || (item.countsAsCup == null
        && Boolean(item.menuId)
        && fallbackCupProductCodes.has(item.menuId || "")),
    )
    .reduce((total, item) => {
      const quantity = Number(item.quantity || 0);
      return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
}

export function countBakeryForOverview(
  bills: OverviewCupBill[],
  fallbackBakeryProductCodes: ReadonlySet<string> = new Set(),
): number {
  return bills
    .filter((bill) => bill.status !== "cancelled")
    .flatMap((bill) => bill.items || [])
    .filter((item) =>
      item.countsAsCup === false
      || (item.countsAsCup == null
        && Boolean(item.menuId)
        && fallbackBakeryProductCodes.has(item.menuId || "")),
    )
    .reduce((total, item) => {
      const quantity = Number(item.quantity || 0);
      return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
}

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
