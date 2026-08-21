import assert from "node:assert/strict";
import test from "node:test";
import { getShiftLabel, orderOverviewShiftRevenueRows } from "./overviewShiftData.ts";

const shift = (id: string, status: "open" | "closed") => ({
  id,
  storeId: "cafe",
  cashierUid: `cashier-${id}`,
  cashierName: "Thu ngân",
  shiftType: id === "closed" ? "shift_2" as const : "shift_1" as const,
  status,
  openingCash: 500_000,
  openedAt: { seconds: status === "open" ? 1_000 : 900 },
  closingCash: status === "closed" ? 650_000 : null,
});

test("builds open and closed shift revenue rows with reconciliation variance", () => {
  const rows = orderOverviewShiftRevenueRows([
    { shift: shift("closed", "closed"), summary: { totalSales: 100_000, cashSales: 100_000, transferSales: 0, completedBills: 1, cancelledBills: 0, incomeVouchers: 0, expenseVouchers: 0, expectedClosingCash: 600_000 }, variance: 50_000 },
    { shift: shift("open", "open"), summary: { totalSales: 80_000, cashSales: 0, transferSales: 80_000, completedBills: 1, cancelledBills: 0, incomeVouchers: 0, expenseVouchers: 0, expectedClosingCash: 500_000 }, variance: null },
  ]);

  assert.deepEqual(rows.map((row) => row.shift.status), ["open", "closed"]);
  assert.equal(rows[0].summary.totalSales, 80_000);
  assert.equal(rows[0].variance, null);
  assert.equal(rows[1].summary.cashSales, 100_000);
  assert.equal(rows[1].variance, 50_000);
});

test("labels configured shifts for the overview", () => {
  assert.equal(getShiftLabel("shift_1"), "Ca 1");
  assert.equal(getShiftLabel("shift_2"), "Ca 2");
  assert.equal(getShiftLabel("shift_3"), "Ca 3");
});
