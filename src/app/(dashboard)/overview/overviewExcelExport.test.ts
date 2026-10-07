import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildOverviewSnapshot } from "./overviewData.ts";
import { buildOverviewDayWorkbook } from "./overviewExcelExport.ts";

test("daily workbook preserves numeric totals, Vietnamese text and empty shifts", async () => {
  const day = new Date(2026, 9, 7);
  const snapshot = buildOverviewSnapshot([], day, day);
  snapshot.totalRevenue = 123456;
  const workbook = buildOverviewDayWorkbook({ storeName: "Cà phê", date: "2026-10-07", snapshot, vouchers: { income: 5000, expense: 2000 }, shifts: [] });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(restored.getWorksheet("Tổng quan")?.getCell("B2").value, "Cà phê");
  assert.equal(restored.getWorksheet("Tổng quan")?.getCell("B5").value, 123456);
  assert.equal(restored.getWorksheet("Theo ca")?.rowCount, 1);
});

test("shift workbook distinguishes an open shift from a zero cash variance", () => {
  const snapshot = buildOverviewSnapshot([], new Date(), new Date());
  const workbook = buildOverviewDayWorkbook({ storeName: "Cafe", date: "2026-10-07", snapshot, vouchers: { income: 0, expense: 0 }, shifts: [{
    shift: { id: "s1", shiftType: "shift_1", status: "open", cashierName: "=SUM(A1)" },
    summary: { totalSales: 100, cashSales: 60, transferSales: 40, completedBills: 1, cancelledBills: 0, incomeVouchers: 0, expenseVouchers: 0, expectedClosingCash: 60, cupCount: 2 },
    variance: null,
  }] });
  const row = workbook.getWorksheet("Theo ca")!.getRow(2);
  assert.equal(row.getCell(3).value, "=SUM(A1)");
  assert.equal(row.getCell(4).value, 100);
  assert.equal(row.getCell(14).value, null);
});
