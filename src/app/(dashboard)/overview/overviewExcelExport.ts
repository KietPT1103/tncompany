import ExcelJS from "exceljs";
import type { OverviewShiftRevenue } from "@/services/overviewShiftData";

// Layout, column order and colors follow the supplied daily-revenue workbook.
const DAILY_HEADERS = ["Ngày", "Doanh thu (VND)", "Đơn hoàn tất", "Đơn hủy", "Số ly", "Tiền mặt (VND)", "Chuyển khoản (VND)", "Phiếu thu (VND)", "Phiếu chi (VND)", "Chênh lệch (VND)", "Giá trị đơn TB (VND)"];
const SHIFT_HEADERS = ["Ngày mở ca", "Ca", "Trạng thái", "Thu ngân", "Doanh thu (VND)", "Đơn hoàn tất", "Đơn hủy", "Số ly", "Tiền mặt (VND)", "Chuyển khoản (VND)", "Phiếu thu (VND)", "Phiếu chi (VND)", "Tiền cuối ca dự kiến (VND)", "Tiền chốt ca (VND)", "Chênh lệch (VND)"];
const DAY_MS = 86400000;
const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const font = (color = "FF0F172A", bold = false, size = 11): Partial<ExcelJS.Font> => ({ name: "Carlito", size, bold, color: { argb: color } });
const dateLabel = (key: string) => key.split("-").reverse().join("/");
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

function parseDay(key: string) {
  const date = new Date(`${key}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) {
    throw new Error("Khoảng ngày xuất báo cáo không hợp lệ.");
  }
  return date;
}

function styleHeader(sheet: ExcelJS.Worksheet, rowNumber: number, color: string, height: number) {
  const row = sheet.getRow(rowNumber);
  row.height = height;
  row.eachCell(cell => {
    cell.font = font("FFFFFFFF", true);
    cell.fill = fill(color);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
}

function styleTableCell(cell: ExcelJS.Cell, stripe: boolean) {
  cell.font = font("FF000000");
  // Explicit colors preserve the template's blue bands across Excel themes.
  cell.fill = fill(stripe ? "FFC1E5F5" : "FFFFFFFF");
  cell.border = { bottom: { style: "thin", color: { argb: "FF47B1E1" } } };
  cell.numFmt = Number(cell.col) === 1 ? "mm-dd-yy" : "#,##0";
}

export function buildOverviewRangeWorkbook(options: {
  startDate: string;
  endDate: string;
  shifts: OverviewShiftRevenue[];
}) {
  const start = parseDay(options.startDate);
  const end = parseDay(options.endDate);
  if (start > end) throw new Error("Khoảng ngày xuất báo cáo không hợp lệ.");
  const dayCount = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const selectedShifts = options.shifts
    .filter(({ shift }) => {
      if (!shift.openedAt || !Number.isFinite(shift.openedAt.seconds)) return false;
      const key = dateKey(new Date(shift.openedAt.seconds * 1000));
      return key >= options.startDate && key <= options.endDate;
    })
    .sort((a, b) => b.shift.openedAt!.seconds - a.shift.openedAt!.seconds);
  const totalsByDay = new Map<string, number[]>();
  const shiftRows = selectedShifts.map(({ shift, summary, variance }) => {
    const key = dateKey(new Date(shift.openedAt!.seconds * 1000));
    const values = [summary.totalSales, summary.completedBills, summary.cancelledBills, summary.cupCount ?? 0,
      summary.cashSales, summary.transferSales, summary.incomeVouchers, summary.expenseVouchers, variance ?? 0];
    const totals = totalsByDay.get(key) ?? Array<number>(9).fill(0);
    values.forEach((value, index) => { totals[index] += value; });
    totalsByDay.set(key, totals);
    return [parseDay(key), shift.shiftType === "single" ? "Ca đơn" : `Ca ${shift.shiftType.slice(-1)}`,
      shift.status === "closed" ? "Đã chốt" : "Đang mở", shift.cashierName || "",
      ...values.slice(0, 8), summary.expectedClosingCash, shift.closingCash ?? null, variance];
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TN Services";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const daily = workbook.addWorksheet("Theo ngày");
  const detail = workbook.addWorksheet("Dữ liệu theo ca");
  daily.columns = [13, 18, 14, 10, 10, 17, 20, 17, 17, 18, 20].map(width => ({ width }));
  detail.columns = [13, 9, 12, 14, 17, 13, 10, 10, 17, 20, 17, 17, 23, 21, 18].map(width => ({ width }));
  daily.properties.defaultRowHeight = detail.properties.defaultRowHeight = 14.25;
  daily.views = [{ showGridLines: true, zoomScale: 83 }];
  detail.views = [{ showGridLines: true, zoomScale: 100 }];
  const tableStyle: ExcelJS.TableStyleProperties = { theme: "TableStyleMedium2", showRowStripes: true, showColumnStripes: false, showFirstColumn: false, showLastColumn: false };
  detail.addTable({ name: "ShiftDataTable", ref: "A1", headerRow: true, totalsRow: false, style: tableStyle,
    columns: SHIFT_HEADERS.map(name => ({ name, filterButton: true })), rows: shiftRows });
  styleHeader(detail, 1, "FF1F4E78", 30);
  for (let row = 2; row <= shiftRows.length + 1; row += 1) {
    detail.getRow(row).eachCell({ includeEmpty: true }, cell => {
      styleTableCell(cell, row % 2 === 0);
      if (Number(cell.col) >= 2 && Number(cell.col) <= 4) cell.numFmt = "General";
    });
  }

  const lastDayRow = 6 + dayCount;
  const totalRow = lastDayRow + 1;
  const lastShiftRow = Math.max(2, shiftRows.length + 1);
  const sourceColumns = ["E", "F", "G", "H", "I", "J", "K", "L", "O"];
  const totals = Array<number>(9).fill(0);
  let maxRevenue = 0;
  const dailyRows = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const values = totalsByDay.get(date.toISOString().slice(0, 10)) ?? Array<number>(9).fill(0);
    values.forEach((value, column) => { totals[column] += value; });
    maxRevenue = Math.max(maxRevenue, values[0]);
    const row = index + 7;
    return [date, ...values.map((value, column) => ({
      formula: `SUMIF('Dữ liệu theo ca'!$A$2:$A$${lastShiftRow},A${row},'Dữ liệu theo ca'!$${sourceColumns[column]}$2:$${sourceColumns[column]}$${lastShiftRow})`, result: value,
    })), { formula: `IF(C${row}=0,0,B${row}/C${row})`, result: values[1] ? values[0] / values[1] : 0 }];
  });
  daily.addTable({ name: "DailyRevenueTable", ref: "A6", headerRow: true, totalsRow: false, style: tableStyle,
    columns: DAILY_HEADERS.map(name => ({ name, filterButton: true })), rows: dailyRows });
  styleHeader(daily, 6, "FF012A4A", 27.95);
  daily.mergeCells("A1:K1");
  daily.getCell("A1").value = "BÁO CÁO DOANH THU THEO NGÀY";
  daily.getCell("A1").font = font("FFFFFFFF", true, 16);
  daily.getCell("A1").fill = fill("FF012A4A");
  daily.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  daily.getRow(1).height = 30;
  daily.mergeCells("A2:K2");
  daily.getCell("A2").value = `Khoảng thời gian: ${dateLabel(options.startDate)} - ${dateLabel(options.endDate)} | Tổng hợp từ dữ liệu theo ca`;
  daily.getCell("A2").font = { ...font("FF475569"), italic: true };
  daily.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  daily.getRow(2).height = 21.95;
  daily.getRow(3).height = 15;
  daily.getRow(4).height = 16.5;
  const kpis = [
    { col: "A", to: "B", label: "TỔNG DOANH THU", formula: `SUM(B7:B${lastDayRow})`, value: totals[0] },
    { col: "D", to: "E", label: "TB / NGÀY", formula: `AVERAGE(B7:B${lastDayRow})`, value: totals[0] / dayCount },
    { col: "G", to: "H", label: "CAO NHẤT / NGÀY", formula: `MAX(B7:B${lastDayRow})`, value: maxRevenue },
    { col: "J", to: "K", label: "SỐ NGÀY", formula: `COUNTA(A7:A${lastDayRow})`, value: dayCount },
  ];
  kpis.forEach(kpi => {
    const label = daily.getCell(`${kpi.col}3`);
    label.value = kpi.label;
    label.font = font("FF012A4A", true);
    label.fill = fill("FFEAF2F8");
    label.alignment = { horizontal: "center", vertical: "middle" };
    daily.mergeCells(`${kpi.col}4:${kpi.to}4`);
    const value = daily.getCell(`${kpi.col}4`);
    value.value = { formula: kpi.formula, result: kpi.value };
    value.font = font("FF0F172A", true, 13);
    value.fill = fill("FFF8FAFC");
    value.numFmt = kpi.col === "J" ? "0" : "#,##0";
    value.alignment = { horizontal: "center", vertical: "middle" };
    const border: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFCBD5E1" } };
    value.border = { left: border, right: border, top: border, bottom: border };
  });
  for (let row = 7; row <= totalRow; row += 1) {
    for (let col = 1; col <= 11; col += 1) {
      const cell = daily.getCell(row, col);
      styleTableCell(cell, row % 2 === 1);
      cell.alignment = { wrapText: true };
      if (row === totalRow) {
        cell.font = font("FF7A4F00", true);
        cell.fill = fill("FFFFF4CC");
        const border: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD6A300" } };
        cell.border = { top: border, bottom: border };
        const letter = cell.address.replace(/\d/g, "");
        cell.value = col === 1 ? "TỔNG" : col === 11
          ? { formula: `IF(C${row}=0,0,B${row}/C${row})`, result: totals[1] ? totals[0] / totals[1] : 0 }
          : { formula: `SUM(${letter}7:${letter}${lastDayRow})`, result: totals[col - 2] };
      }
    }
  }
  daily.getRow(totalRow).height = 15;
  // ExcelJS serializes the data-bar color but omits it from its TypeScript declaration.
  const revenueBars: ExcelJS.DataBarRuleType & { color: Partial<ExcelJS.Color> } = { type: "dataBar", priority: 1,
    cfvo: [{ type: "min" }, { type: "max" }], color: { argb: "FFA02B93" }, gradient: true };
  daily.addConditionalFormatting({ ref: `B7:B${lastDayRow}`, rules: [revenueBars] });
  daily.mergeCells("M24:U27");
  daily.getCell("M24").value = "Ghi chú: Mỗi dòng là tổng doanh thu của tất cả ca trong cùng ngày. Sheet “Dữ liệu theo ca” được giữ lại để đối chiếu chi tiết.";
  daily.getCell("M24").font = { ...font("FF475569"), italic: true };
  daily.getCell("M24").fill = fill("FFF8FAFC");
  daily.getCell("M24").alignment = { vertical: "top", wrapText: true };
  daily.pageSetup.printArea = `A1:K${totalRow}`;
  return workbook;
}
