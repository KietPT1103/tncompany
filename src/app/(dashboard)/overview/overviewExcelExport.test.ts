import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildOverviewSnapshot } from "./overviewData.ts";
import { buildOverviewRangeWorkbook } from "./overviewExcelExport.ts";

test("range workbook preserves numeric totals, Vietnamese text and empty shifts", async () => {
  const day = new Date(2026, 9, 7);
  const snapshot = buildOverviewSnapshot([], day, day);
  snapshot.totalRevenue = 123456;
  const workbook = buildOverviewRangeWorkbook({ storeName: "Cà phê", startDate: "2026-09-01", endDate: "2026-10-06", snapshot, vouchers: { income: 5000, expense: 2000 }, shifts: [] });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(restored.getWorksheet("Tổng quan")?.getCell("B2").value, "Cà phê");
  assert.equal(restored.getWorksheet("Tổng quan")?.getCell("B5").value, 123456);
  assert.equal(restored.getWorksheet("Tổng quan")?.getCell("B3").value, "01/09/2026 - 06/10/2026");
  assert.equal(restored.getWorksheet("Theo ca")?.rowCount, 1);
});

test("shift workbook distinguishes an open shift from a zero cash variance", () => {
  const snapshot = buildOverviewSnapshot([], new Date(), new Date());
  const workbook = buildOverviewRangeWorkbook({ storeName: "Cafe", startDate: "2026-10-07", endDate: "2026-10-07", snapshot, vouchers: { income: 0, expense: 0 }, shifts: [{
    shift: { id: "s1", shiftType: "shift_1", status: "open", cashierName: "=SUM(A1)", openedAt: { seconds: new Date(2026, 9, 7, 10).getTime() / 1000 } },
    summary: { totalSales: 100, cashSales: 60, transferSales: 40, completedBills: 1, cancelledBills: 0, incomeVouchers: 0, expenseVouchers: 0, expectedClosingCash: 60, cupCount: 2 },
    variance: null,
  }] });
  const row = workbook.getWorksheet("Theo ca")!.getRow(2);
  assert.equal(row.getCell(1).value, "07/10/2026");
  assert.equal(row.getCell(4).value, "=SUM(A1)");
  assert.equal(row.getCell(5).value, 100);
  assert.equal(row.getCell(15).value, null);
});

test("range report includes both boundary days and excludes bills outside the range", () => {
  const timestamp = (date: Date) => ({ seconds: date.getTime() / 1000 });
  const snapshot = buildOverviewSnapshot([
    { id: "first", total: 100, items: [], createdAt: timestamp(new Date(2026, 8, 1, 0, 0, 0)) },
    { id: "last", total: 200, items: [], createdAt: timestamp(new Date(2026, 9, 6, 23, 59, 59)) },
    { id: "outside", total: 999, items: [], createdAt: timestamp(new Date(2026, 9, 7, 0, 0, 0)) },
  ], new Date(2026, 8, 1), new Date(2026, 9, 6, 23, 59, 59, 999));
  const workbook = buildOverviewRangeWorkbook({ storeName: "Cafe", startDate: "2026-09-01", endDate: "2026-10-06", snapshot, vouchers: { income: 0, expense: 0 }, shifts: [] });
  assert.equal(workbook.getWorksheet("Tổng quan")!.getCell("B5").value, 300);
  assert.equal(workbook.getWorksheet("Tổng quan")!.getCell("B6").value, 2);
});
