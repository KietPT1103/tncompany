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
  countCupsForOverview,
  orderOverviewShiftRevenueRows,
  type OverviewShiftRevenue,
} from "./overviewShiftData";

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
