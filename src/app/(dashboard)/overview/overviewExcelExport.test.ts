import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { buildOverviewRangeWorkbook, writeOverviewRangeWorkbook } from "./overviewExcelExport.ts";
import type { OverviewShiftRevenue } from "@/services/overviewShiftData";

const shift = (day: number, totalSales: number, completedBills = 1): OverviewShiftRevenue => ({
  shift: { id: String(day), shiftType: "shift_1", status: "closed", openedAt: { seconds: new Date(2026, 9, day, 8).getTime() / 1000 }, closingCash: 60 },
  summary: { totalSales, cashSales: totalSales * 0.6, transferSales: totalSales * 0.4, completedBills, cancelledBills: 0, incomeVouchers: 5, expenseVouchers: 2, expectedClosingCash: 60, cupCount: 2 },
  variance: 0,
});
const result = (sheet: ExcelJS.Worksheet, address: string) => sheet.getCell(address).result;

test("download contains an editable column/line chart with separate axes and the selected daily ranges", async () => {
  const workbook = buildOverviewRangeWorkbook({ startDate: "2026-10-06", endDate: "2026-10-07", shifts: [shift(6, 100), shift(7, 500)] });
  const zip = await JSZip.loadAsync(await writeOverviewRangeWorkbook(workbook));
  const chart = await zip.file("xl/charts/overviewDailyChart.xml")!.async("string");
  assert.match(chart, /<c:barChart>/);
  assert.match(chart, /<c:lineChart>/);
  assert.match(chart, /Theo ngày.*\$B\$7:\$B\$8/);
  assert.match(chart, /Theo ngày.*\$E\$7:\$E\$8/);
  assert.match(chart, /<c:ptCount val="2"/);
  assert.match(chart, /<c:axPos val="r"/);
  assert.match(chart, /<c:axPos val="l"/);
  assert.match(chart, /<c:v>500<\/c:v>/);
  assert.match(chart, /<c:v>2<\/c:v>/);
  assert.match(chart, /<c:v>06\/10<\/c:v>/);
  assert.doesNotMatch(chart, /\$B\$9|\$E\$9/); // exclude totals
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(sheet, /<drawing r:id="rIdOverviewDailyChart"/);
  const relationships = await zip.file("xl/worksheets/_rels/sheet1.xml.rels")!.async("string");
  assert.match(relationships, /overviewDailyDrawing.xml/);
  assert.match(relationships, /table/); // preserve the existing table relationship
  assert.match(await zip.file("[Content_Types].xml")!.async("string"), /overviewDailyChart.xml/);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await writeOverviewRangeWorkbook(workbook));
  assert.equal(restored.getWorksheet("Theo ngày")!.getCell("A9").value, "TỔNG");
});

test("empty single-day export still contains one chart point with zero values", async () => {
  const workbook = buildOverviewRangeWorkbook({ startDate: "2026-10-07", endDate: "2026-10-07", shifts: [] });
  const zip = await JSZip.loadAsync(await writeOverviewRangeWorkbook(workbook));
  const chart = await zip.file("xl/charts/overviewDailyChart.xml")!.async("string");
  assert.match(chart, /\$B\$7:\$B\$7/);
  assert.match(chart, /<c:ptCount val="1"/);
  assert.match(chart, /<c:v>0<\/c:v>/);
});

test("export follows the supplied workbook form and preserves it after XLSX serialization", async () => {
  const workbook = buildOverviewRangeWorkbook({ startDate: "2026-10-06", endDate: "2026-10-07", shifts: [shift(6, 100), shift(7, 500, 2)] });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.deepEqual(restored.worksheets.map(sheet => sheet.name), ["Theo ngày", "Dữ liệu theo ca"]);
  const daily = restored.getWorksheet("Theo ngày")!;
  assert.equal(daily.getCell("A1").value, "BÁO CÁO DOANH THU THEO NGÀY");
  assert.equal(daily.getCell("A2").value, "Khoảng thời gian: 06/10/2026 - 07/10/2026 | Tổng hợp từ dữ liệu theo ca");
  assert.equal(daily.getCell("A1").font.color?.argb, "FFFFFFFF");
  assert.equal(daily.getCell("A1").fill.type, "pattern");
  assert.equal(daily.getCell("K1").master.address, "A1");
  assert.equal(daily.getCell("B4").master.address, "A4");
  assert.equal(daily.getCell("A6").value, "Ngày");
  assert.equal(daily.getCell("K6").value, "Giá trị đơn TB (VND)");
  assert.equal(result(daily, "A4"), 600);
  assert.equal(result(daily, "D4"), 300);
  assert.equal(result(daily, "G4"), 500);
  assert.equal(result(daily, "J4"), 2);
  assert.equal(daily.getCell("A9").value, "TỔNG");
  assert.equal(result(daily, "K9"), 200); // weighted by orders, not the average of daily averages
  assert.equal(daily.getCell("B9").numFmt, "#,##0");
  assert.equal(daily.conditionalFormattings[0].ref, "B7:B8");
  assert.equal(restored.getWorksheet("Dữ liệu theo ca")!.getCell("A2").value instanceof Date, true);
  assert.equal(daily.getTables().length, 1);
});

test("export includes every selected date across months and excludes shifts outside both boundaries", () => {
  const first = shift(1, 100);
  first.shift.openedAt = { seconds: new Date(2026, 8, 1, 0, 0, 0).getTime() / 1000 };
  const last = shift(6, 200);
  last.shift.openedAt = { seconds: new Date(2026, 9, 6, 23, 59, 59).getTime() / 1000 };
  const before = shift(0, 999);
  before.shift.openedAt = { seconds: new Date(2026, 7, 31, 23, 59, 59).getTime() / 1000 };
  const workbook = buildOverviewRangeWorkbook({ startDate: "2026-09-01", endDate: "2026-10-06", shifts: [shift(7, 999), first, last, before] });
  const daily = workbook.getWorksheet("Theo ngày")!;
  assert.deepEqual(daily.getCell("A7").value, new Date("2026-09-01T00:00:00Z"));
  assert.deepEqual(daily.getCell("A42").value, new Date("2026-10-06T00:00:00Z"));
  assert.equal(daily.getCell("A43").value, "TỔNG");
  assert.equal(result(daily, "B43"), 300);
  assert.equal(result(daily, "B8"), 0);
  assert.equal(result(daily, "J4"), 36);
  assert.equal(workbook.getWorksheet("Dữ liệu theo ca")!.rowCount, 3);
  assert.equal(workbook.getWorksheet("Dữ liệu theo ca")!.getCell("E2").value, 200);
});

test("same-day shifts roll up into one row while open-shift cash remains blank", () => {
  const open = shift(7, 100, 2);
  open.shift.status = "open";
  open.shift.closingCash = null;
  open.shift.cashierName = "=SUM(A1)";
  open.variance = null;
  const workbook = buildOverviewRangeWorkbook({ startDate: "2026-10-07", endDate: "2026-10-07", shifts: [open, shift(7, 500)] });
  const daily = workbook.getWorksheet("Theo ngày")!;
  const detail = workbook.getWorksheet("Dữ liệu theo ca")!;
  assert.equal(result(daily, "B7"), 600);
  assert.equal(result(daily, "C7"), 3);
  assert.equal(result(daily, "K7"), 200);
  assert.equal(daily.getCell("A8").value, "TỔNG");
  assert.equal(detail.getCell("N2").value, null);
  assert.equal(detail.getCell("O2").value, null);
  assert.equal(detail.getCell("O3").value, 0);
  assert.equal(detail.getCell("D2").value, "=SUM(A1)");
  assert.equal(detail.getCell("D2").type, ExcelJS.ValueType.String);
});

test("empty selected day exports valid zero totals and formulas without stale template records", async () => {
  const workbook = buildOverviewRangeWorkbook({ startDate: "2026-10-07", endDate: "2026-10-07", shifts: [] });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const daily = restored.getWorksheet("Theo ngày")!;
  assert.equal(result(daily, "A4"), 0);
  assert.equal(result(daily, "K7"), 0);
  assert.equal(result(daily, "J4"), 1);
  assert.equal(daily.getCell("A8").value, "TỔNG");
  assert.equal(restored.getWorksheet("Dữ liệu theo ca")!.rowCount, 1);
  assert.throws(() => buildOverviewRangeWorkbook({ startDate: "2026-10-08", endDate: "2026-10-07", shifts: [] }), /khoảng ngày/i);
});
