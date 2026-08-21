import ExcelJS from "exceljs";
import type { Bill } from "@/services/billService";
import type { CashVoucher } from "@/services/cashVoucherService";

type ReportOptions = {
  startDate: string;
  endDate: string;
  generatedAt?: Date;
};

type ReportColumn = {
  header: string;
  key: string;
  width: number;
  numFmt?: string;
  alignment?: Partial<ExcelJS.Alignment>;
};

const COLORS = {
  emerald: "FF065F46",
  emeraldHeader: "FF047857",
  emeraldLight: "FFECFDF5",
  emeraldText: "FF064E3B",
  goldLight: "FFFFF7D6",
  goldText: "FF854D0E",
  white: "FFFFFFFF",
  slate: "FF334155",
  slateLight: "FFF8FAFC",
  border: "FFE2E8F0",
  roseLight: "FFFFF1F2",
  roseText: "FFBE123C",
} as const;

const toDate = (timestamp?: { seconds: number }) =>
  timestamp?.seconds ? new Date(timestamp.seconds * 1000) : "";

export function buildBillExportRows(bills: Bill[]) {
  return bills.map((bill) => ({
    "Mã hóa đơn": bill.id,
    "Thời gian": toDate(bill.createdAt),
    "Bàn": bill.tableNumber || "",
    "Thanh toán": bill.paymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt",
    "Tổng tiền (VND)": bill.total || 0,
    "Trạng thái": bill.status === "cancelled" ? "Đã hủy" : "Hợp lệ",
    "Ghi chú": bill.note || "",
  }));
}

export function buildVoucherExportRows(vouchers: CashVoucher[]) {
  return vouchers.map((voucher) => ({
    "Mã phiếu": voucher.code || voucher.id,
    "Thời gian": toDate(voucher.happenedAt || voucher.createdAt),
    "Loại": voucher.type === "income" ? "Phiếu thu" : "Phiếu chi",
    "Nội dung": voucher.category || "",
    "Chi tiết": voucher.note || "",
    "Người nộp/nhận": voucher.personName || "",
    "Tính vào dòng tiền": voucher.includeInCashFlow === false ? "Không" : "Có",
    "Giá trị (VND)": (voucher.type === "expense" ? -1 : 1) * (voucher.amount || 0),
  }));
}

function applyReportBase(
  worksheet: ExcelJS.Worksheet,
  title: string,
  options: ReportOptions,
  columnCount: number,
) {
  const lastColumn = worksheet.getColumn(columnCount).letter;
  worksheet.mergeCells(`A1:${lastColumn}1`);
  worksheet.getCell("A1").value = title;
  worksheet.getCell("A1").style = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.emerald } },
    font: { name: "Aptos Display", size: 18, bold: true, color: { argb: COLORS.white } },
    alignment: { vertical: "middle", horizontal: "left" },
  };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells(`A2:${lastColumn}2`);
  const generatedAt = options.generatedAt || new Date();
  worksheet.getCell("A2").value = `Khoảng thời gian: ${options.startDate} – ${options.endDate}  •  Xuất lúc: ${generatedAt.toLocaleString("vi-VN")}`;
  worksheet.getCell("A2").style = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.emeraldLight } },
    font: { name: "Aptos", size: 10, color: { argb: COLORS.emeraldText } },
    alignment: { vertical: "middle", horizontal: "left" },
  };
  worksheet.getRow(2).height = 23;
  worksheet.getRow(3).height = 8;
  worksheet.views = [{ state: "frozen", ySplit: 6, topLeftCell: "A7", showGridLines: false }];
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  worksheet.headerFooter.oddFooter = "&LTN Services&CTrang &P / &N&RXuất ngày &D";
}

function applyColumns(worksheet: ExcelJS.Worksheet, columns: ReportColumn[]) {
  worksheet.columns = columns.map((column) => ({
    key: column.key,
    width: column.width,
    style: {
      font: { name: "Aptos", size: 10, color: { argb: COLORS.slate } },
      alignment: { vertical: "middle", ...column.alignment },
      ...(column.numFmt && { numFmt: column.numFmt }),
    },
  }));

  const header = worksheet.getRow(6);
  header.values = columns.map((column) => column.header);
  header.height = 27;
  header.eachCell((cell) => {
    cell.style = {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.emeraldHeader } },
      font: { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.white } },
      alignment: { vertical: "middle", horizontal: "center", wrapText: true },
      border: { bottom: { style: "medium", color: { argb: COLORS.emerald } } },
    };
  });
}

function styleSummaryPair(worksheet: ExcelJS.Worksheet, labelCell: string, valueCell: string) {
  worksheet.getCell(labelCell).style = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.emeraldLight } },
    font: { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.emeraldText } },
    alignment: { vertical: "middle", horizontal: "left" },
    border: { bottom: { style: "thin", color: { argb: COLORS.border } } },
  };
  worksheet.getCell(valueCell).style = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.goldLight } },
    font: { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.goldText } },
    alignment: { vertical: "middle", horizontal: "right" },
    border: { bottom: { style: "thin", color: { argb: COLORS.border } } },
  };
}

function styleDataRows(
  worksheet: ExcelJS.Worksheet,
  firstRow: number,
  lastRow: number,
  cancelledStatusColumn: number,
) {
  for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 23;
    const cancelled = cancelledStatusColumn > 0 && row.getCell(cancelledStatusColumn).value === "Đã hủy";
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: cancelled ? COLORS.roseLight : rowNumber % 2 === 0 ? COLORS.slateLight : COLORS.white },
      };
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.border } } };
      if (cancelled) cell.font = { ...cell.font, color: { argb: COLORS.roseText } };
    });
  }
}

function getDataRange(firstRow: number, itemCount: number) {
  const lastRow = Math.max(firstRow, firstRow + itemCount - 1);
  return { lastRow, endRow: lastRow };
}

function createReportWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TN Services";
  workbook.company = "TN Services";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

export function buildBillExportWorkbook(bills: Bill[], options: ReportOptions) {
  const workbook = createReportWorkbook();
  const worksheet = workbook.addWorksheet("Danh sách hóa đơn", { properties: { defaultRowHeight: 20 } });
  const columns: ReportColumn[] = [
    { header: "Mã hóa đơn", key: "code", width: 18 },
    { header: "Thời gian", key: "time", width: 21, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Bàn", key: "table", width: 14 },
    { header: "Thanh toán", key: "payment", width: 18 },
    { header: "Tổng tiền", key: "amount", width: 19, numFmt: '#,##0 "VND"', alignment: { horizontal: "right" } },
    { header: "Trạng thái", key: "status", width: 16, alignment: { horizontal: "center" } },
    { header: "Ghi chú", key: "note", width: 38, alignment: { wrapText: true } },
  ];
  applyColumns(worksheet, columns);
  applyReportBase(worksheet, "DANH SÁCH HÓA ĐƠN", options, columns.length);

  const firstDataRow = 7;
  const rows = buildBillExportRows(bills);
  rows.forEach((item) => worksheet.addRow({
    code: item["Mã hóa đơn"],
    time: item["Thời gian"],
    table: item["Bàn"],
    payment: item["Thanh toán"],
    amount: item["Tổng tiền (VND)"],
    status: item["Trạng thái"],
    note: item["Ghi chú"],
  }));
  const { lastRow: lastDataRow, endRow } = getDataRange(firstDataRow, rows.length);

  worksheet.getCell("A4").value = "Tổng số hóa đơn";
  worksheet.getCell("B4").value = { formula: `COUNTA(A${firstDataRow}:A${endRow})` };
  worksheet.getCell("C4").value = "Hóa đơn hợp lệ";
  worksheet.getCell("D4").value = { formula: `COUNTIF(F${firstDataRow}:F${endRow},"Hợp lệ")` };
  worksheet.getCell("E4").value = "Doanh thu hợp lệ";
  worksheet.getCell("F4").value = { formula: `SUMIF(F${firstDataRow}:F${endRow},"Hợp lệ",E${firstDataRow}:E${endRow})` };
  ["A4", "C4", "E4"].forEach((label, index) => styleSummaryPair(worksheet, label, ["B4", "D4", "F4"][index]));
  worksheet.getCell("F4").numFmt = '#,##0 "VND"';
  worksheet.getRow(4).height = 25;
  if (rows.length > 0) styleDataRows(worksheet, firstDataRow, lastDataRow, 6);

  const totalRow = lastDataRow + 1;
  worksheet.getCell(`A${totalRow}`).value = "TỔNG DOANH THU HỢP LỆ";
  worksheet.getCell(`A${totalRow}`).font = { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.emeraldText } };
  worksheet.getCell(`E${totalRow}`).value = { formula: `SUMIF(F${firstDataRow}:F${endRow},"Hợp lệ",E${firstDataRow}:E${endRow})` };
  worksheet.getCell(`E${totalRow}`).numFmt = '#,##0 "VND"';
  worksheet.getCell(`E${totalRow}`).font = { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.emeraldText } };
  worksheet.getRow(totalRow).eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.emeraldLight } };
    cell.border = { top: { style: "medium", color: { argb: COLORS.emeraldHeader } } };
  });
  worksheet.getRow(totalRow).height = 25;
  worksheet.autoFilter = { from: "A6", to: `G${lastDataRow}` };
  return workbook;
}

export function buildVoucherExportWorkbook(vouchers: CashVoucher[], options: ReportOptions) {
  const workbook = createReportWorkbook();
  const worksheet = workbook.addWorksheet("Phiếu thu chi", { properties: { defaultRowHeight: 20 } });
  const columns: ReportColumn[] = [
    { header: "Mã phiếu", key: "code", width: 20 },
    { header: "Thời gian", key: "time", width: 21, numFmt: "dd/mm/yyyy hh:mm" },
    { header: "Loại", key: "type", width: 15, alignment: { horizontal: "center" } },
    { header: "Nội dung", key: "category", width: 28 },
    { header: "Chi tiết", key: "note", width: 40, alignment: { wrapText: true } },
    { header: "Người nộp/nhận", key: "person", width: 24 },
    { header: "Dòng tiền", key: "cashFlow", width: 16, alignment: { horizontal: "center" } },
    { header: "Giá trị", key: "amount", width: 20, numFmt: '#,##0 "VND"', alignment: { horizontal: "right" } },
  ];
  applyColumns(worksheet, columns);
  applyReportBase(worksheet, "PHIẾU THU / CHI", options, columns.length);

  const firstDataRow = 7;
  const rows = buildVoucherExportRows(vouchers);
  rows.forEach((item) => worksheet.addRow({
    code: item["Mã phiếu"], time: item["Thời gian"], type: item["Loại"],
    category: item["Nội dung"], note: item["Chi tiết"], person: item["Người nộp/nhận"],
    cashFlow: item["Tính vào dòng tiền"], amount: item["Giá trị (VND)"],
  }));
  const { lastRow: lastDataRow, endRow } = getDataRange(firstDataRow, rows.length);

  worksheet.getCell("A4").value = "Tổng số phiếu";
  worksheet.getCell("B4").value = { formula: `COUNTA(A${firstDataRow}:A${endRow})` };
  worksheet.getCell("C4").value = "Tổng thu";
  worksheet.getCell("D4").value = { formula: `SUMIF(C${firstDataRow}:C${endRow},"Phiếu thu",H${firstDataRow}:H${endRow})` };
  worksheet.getCell("E4").value = "Tổng chi";
  worksheet.getCell("F4").value = { formula: `ABS(SUMIF(C${firstDataRow}:C${endRow},"Phiếu chi",H${firstDataRow}:H${endRow}))` };
  ["A4", "C4", "E4"].forEach((label, index) => styleSummaryPair(worksheet, label, ["B4", "D4", "F4"][index]));
  worksheet.getCell("D4").numFmt = '#,##0 "VND"';
  worksheet.getCell("F4").numFmt = '#,##0 "VND"';
  worksheet.getRow(4).height = 25;
  if (rows.length > 0) styleDataRows(worksheet, firstDataRow, lastDataRow, -1);

  for (let rowNumber = firstDataRow; rowNumber <= lastDataRow && rows.length > 0; rowNumber += 1) {
    const amountCell = worksheet.getCell(`H${rowNumber}`);
    amountCell.font = { ...amountCell.font, bold: true, color: { argb: Number(amountCell.value) < 0 ? COLORS.roseText : COLORS.emeraldHeader } };
  }
  const totalRow = lastDataRow + 1;
  worksheet.getCell(`A${totalRow}`).value = "DÒNG TIỀN RÒNG";
  worksheet.getCell(`A${totalRow}`).font = { name: "Aptos", size: 10, bold: true, color: { argb: COLORS.emeraldText } };
  worksheet.getCell(`H${totalRow}`).value = { formula: `SUM(H${firstDataRow}:H${endRow})` };
  worksheet.getCell(`H${totalRow}`).numFmt = '#,##0 "VND"';
  worksheet.getCell(`H${totalRow}`).font = { name: "Aptos", size: 11, bold: true, color: { argb: COLORS.emeraldText } };
  worksheet.getRow(totalRow).eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.emeraldLight } };
    cell.border = { top: { style: "medium", color: { argb: COLORS.emeraldHeader } } };
  });
  worksheet.getRow(totalRow).height = 25;
  worksheet.autoFilter = { from: "A6", to: `H${lastDataRow}` };
  return workbook;
}

export async function downloadExcelWorkbook(workbook: ExcelJS.Workbook, fileName: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}
