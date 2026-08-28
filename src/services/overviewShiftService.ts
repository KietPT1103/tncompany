import type { Bill } from "@/services/billService";
import { getBills } from "@/services/billService";
import type { CashVoucher } from "@/services/cashVoucherService";
import { getCashVouchers } from "@/services/cashVoucherService";
import {
  getShiftsForReport,
  summarizeBillsForShift,
  type CashierShift,
  type ShiftSummary,
  type ShiftType,
} from "@/services/shiftService";
import {
  countBakeryForOverview,
  countCupsForOverview,
  orderOverviewShiftRevenueRows,
  type OverviewShiftRevenue,
} from "./overviewShiftData";

export type OverviewWeeklyQuantityRow = {
  dateKey: string;
  date: Date;
  shifts: Record<Exclude<ShiftType, "single">, { cups: number; bakery: number }>;
};

const toLocalDateKey = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");

export const OVERVIEW_SHIFT_TYPES: Array<Exclude<ShiftType, "single">> = [
  "shift_1",
  "shift_2",
  "shift_3",
];

export function buildOverviewShiftRevenueRows(
  shifts: CashierShift[],
  billsByShift: Record<string, Bill[]> = {},
  vouchersByShift: Record<string, CashVoucher[]> = {},
  fallbackCupProductCodes: ReadonlySet<string> = new Set(),
): OverviewShiftRevenue[] {
  return orderOverviewShiftRevenueRows(shifts
    .map((shift) => {
      const bills = billsByShift[shift.id] || [];
      const summary = summarizeBillsForShift(
        bills,
        Number(shift.openingCash || 0),
        vouchersByShift[shift.id] || [],
      );
      const cupCount = countCupsForOverview(bills, fallbackCupProductCodes);
      const variance = shift.closingCash == null
        ? null
        : Number(shift.closingCash) - summary.expectedClosingCash;
      return {
        shift,
        summary: { ...summary, cupCount, peopleCount: cupCount },
        variance,
      };
    }));
}

export async function loadOverviewShiftRevenue(options: {
  storeId: string;
  startDate: Date;
  endDate: Date;
  cupProductCodes?: ReadonlySet<string>;
}) {
  const shiftGroups = await Promise.all(
    OVERVIEW_SHIFT_TYPES.map((shiftType) =>
      getShiftsForReport({ ...options, shiftType }),
    ),
  );
  const shifts = shiftGroups.flat();
  const entries = await Promise.all(
    shifts.map(async (shift) => {
      const [bills, vouchers] = await Promise.all([
        getBills({
          storeId: options.storeId,
          shiftId: shift.id,
          startDate: options.startDate,
          endDate: options.endDate,
          includeCancelled: true,
          limitCount: 2000,
        }),
        getCashVouchers({
          storeId: options.storeId,
          shiftId: shift.id,
          startDate: options.startDate,
          endDate: options.endDate,
          limitCount: 2000,
        }),
      ]);
      return { shiftId: shift.id, bills, vouchers };
    }),
  );

  const billsByShift = Object.fromEntries(entries.map((entry) => [entry.shiftId, entry.bills]));
  const vouchersByShift = Object.fromEntries(entries.map((entry) => [entry.shiftId, entry.vouchers]));
  return buildOverviewShiftRevenueRows(
    shifts,
    billsByShift,
    vouchersByShift,
    options.cupProductCodes,
  );
}

export async function loadOverviewWeeklyQuantity(options: {
  storeId: string;
  startDate: Date;
  endDate: Date;
  cupProductCodes?: ReadonlySet<string>;
  bakeryProductCodes?: ReadonlySet<string>;
}): Promise<OverviewWeeklyQuantityRow[]> {
  const shiftGroups = await Promise.all(
    OVERVIEW_SHIFT_TYPES.map((shiftType) =>
      getShiftsForReport({ ...options, shiftType }),
    ),
  );
  const shifts = shiftGroups.flat();
  const shiftIds = shifts.map((shift) => shift.id);
  const bills = shiftIds.length > 0
    ? await getBills({
        storeId: options.storeId,
        shiftIds,
        startDate: options.startDate,
        endDate: options.endDate,
        includeCancelled: true,
        limitCount: 5000,
      })
    : [];
  const billsByShift = new Map<string, Bill[]>();
  bills.forEach((bill) => {
    if (!bill.shiftId) return;
    const current = billsByShift.get(bill.shiftId) || [];
    current.push(bill);
    billsByShift.set(bill.shiftId, current);
  });

  const rows = new Map<string, OverviewWeeklyQuantityRow>();
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(options.startDate);
    date.setDate(date.getDate() + dayOffset);
    const dateKey = toLocalDateKey(date);
    rows.set(dateKey, {
      dateKey,
      date,
      shifts: {
        shift_1: { cups: 0, bakery: 0 },
        shift_2: { cups: 0, bakery: 0 },
        shift_3: { cups: 0, bakery: 0 },
      },
    });
  }

  shifts.forEach((shift) => {
    if (shift.shiftType === "single" || !shift.openedAt?.seconds) return;
    const row = rows.get(toLocalDateKey(new Date(shift.openedAt.seconds * 1000)));
    if (!row) return;
    const shiftBills = billsByShift.get(shift.id) || [];
    row.shifts[shift.shiftType].cups += countCupsForOverview(
      shiftBills,
      options.cupProductCodes,
    );
    row.shifts[shift.shiftType].bakery += countBakeryForOverview(
      shiftBills,
      options.bakeryProductCodes,
    );
  });

  return Array.from(rows.values());
}
