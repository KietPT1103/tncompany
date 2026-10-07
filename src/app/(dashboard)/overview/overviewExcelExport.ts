import ExcelJS from "exceljs";
import JSZip from "jszip";
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

const xmlText = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const CHART_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const richTitle = (title: string) => `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200"/></a:pPr><a:r><a:rPr lang="vi-VN"/><a:t>${xmlText(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;

/** ExcelJS has no chart writer. Add a native DrawingML combo chart to its XLSX package.
 * See https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/how-to-insert-a-chart-into-a-spreadsheet
 * This writer is scoped to the two-sheet overview report, which contains no other drawings.
 */
export async function writeOverviewRangeWorkbook(workbook: ExcelJS.Workbook): Promise<Uint8Array> {
  const daily = workbook.getWorksheet("Theo ngày");
  if (!daily || workbook.worksheets[0] !== daily) throw new Error("Thiếu sheet tổng hợp theo ngày.");
  const count = Number(daily.getCell("J4").result);
  if (!Number.isInteger(count) || count < 1) throw new Error("Khoảng ngày biểu đồ không hợp lệ.");
  const end = 6 + count;
  const source = "'Theo ngày'!";
  const dates = Array.from({ length: count }, (_, i) => {
    const date = daily.getCell(i + 7, 1).value as Date;
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const points = (values: Array<string | number>) => `<c:ptCount val="${values.length}"/>${values.map((value, i) => `<c:pt idx="${i}"><c:v>${xmlText(value)}</c:v></c:pt>`).join("")}`;
  const categories = `<c:cat><c:strRef><c:f>${xmlText(`${source}$A$7:$A$${end}`)}</c:f><c:strCache>${points(dates)}</c:strCache></c:strRef></c:cat>`;
  const series = (col: string, index: number, name: string, color: string, line = false) => {
    const values = Array.from({ length: count }, (_, i) => Number(daily.getCell(`${col}${i + 7}`).result ?? 0));
    const shape = line ? `<a:ln w="28575"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln>`
      : `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln>`;
    return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${xmlText(name)}</c:v></c:tx><c:spPr>${shape}</c:spPr>${line ? '<c:marker><c:symbol val="circle"/><c:size val="4"/></c:marker>' : ''}${categories}<c:val><c:numRef><c:f>${xmlText(`${source}$${col}$7:$${col}$${end}`)}</c:f><c:numCache><c:formatCode>#,##0</c:formatCode>${points(values)}</c:numCache></c:numRef></c:val>${line ? '<c:smooth val="0"/>' : ''}</c:ser>`;
  };
  const categoryAxis = (id: number, cross: number, hidden: boolean) => `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${hidden ? 1 : 0}"/><c:axPos val="b"/><c:numFmt formatCode="dd/mm" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:tickLblSkip val="${Math.max(1, Math.ceil(count / 8))}"/><c:noMultiLvlLbl val="1"/></c:catAx>`;
  const valueAxis = (id: number, cross: number, right: boolean) => `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="${right ? 'r' : 'l'}"/>${right ? '' : '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>'}${richTitle(right ? 'Số ly' : 'Doanh thu (VND)')}<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="${right ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx>`;
  const chart = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${DRAWING_NS}" xmlns:r="${REL_NS}"><c:date1904 val="0"/><c:lang val="vi-VN"/><c:chart>${richTitle('Doanh thu và số ly theo ngày')}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series('B', 0, 'Doanh thu', '059669')}<c:gapWidth val="55"/><c:axId val="1001"/><c:axId val="1002"/></c:barChart><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series('E', 1, 'Số ly', 'F97316', true)}<c:marker val="1"/><c:smooth val="0"/><c:axId val="1003"/><c:axId val="1004"/></c:lineChart>${categoryAxis(1001, 1002, false)}${valueAxis(1002, 1001, false)}${categoryAxis(1003, 1004, true)}${valueAxis(1004, 1003, true)}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
  const drawing = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${DRAWING_NS}"><xdr:twoCellAnchor><xdr:from><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>27</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>22</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="1" name="Doanh thu và số ly theo ngày"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${CHART_NS}"><c:chart xmlns:c="${CHART_NS}" xmlns:r="${REL_NS}" r:id="rIdChart"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
  const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  zip.file("xl/charts/overviewDailyChart.xml", chart);
  zip.file("xl/drawings/overviewDailyDrawing.xml", drawing);
  zip.file("xl/drawings/_rels/overviewDailyDrawing.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE_REL_NS}"><Relationship Id="rIdChart" Type="${REL_NS}/chart" Target="../charts/overviewDailyChart.xml"/></Relationships>`);
  const sheetPath = "xl/worksheets/sheet1.xml";
  let sheetXml = await zip.file(sheetPath)!.async("string");
  // Drawing precedes tableParts and extLst in the worksheet schema.
  const drawingReference = '<drawing r:id="rIdOverviewDailyChart"/>';
  sheetXml = /<tableParts\b/.test(sheetXml) ? sheetXml.replace(/<tableParts\b/, `${drawingReference}<tableParts`)
    : sheetXml.replace(/<extLst\b|<\/worksheet>/, match => drawingReference + match);
  zip.file(sheetPath, sheetXml);
  const relPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const existingRels = await zip.file(relPath)?.async("string") ?? `<Relationships xmlns="${PACKAGE_REL_NS}"></Relationships>`;
  zip.file(relPath, existingRels.replace('</Relationships>', `<Relationship Id="rIdOverviewDailyChart" Type="${REL_NS}/drawing" Target="../drawings/overviewDailyDrawing.xml"/></Relationships>`));
  const types = await zip.file("[Content_Types].xml")!.async("string");
  zip.file("[Content_Types].xml", types.replace('</Types>', '<Override PartName="/xl/charts/overviewDailyChart.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/overviewDailyDrawing.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>'));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
