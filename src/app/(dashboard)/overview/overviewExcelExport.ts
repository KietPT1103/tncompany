import ExcelJS from "exceljs";
import type { OverviewSnapshot, OverviewVoucherTotals } from "./overviewData";
import type { OverviewShiftRevenue } from "@/services/overviewShiftData";

export function buildOverviewRangeWorkbook(options: {
  storeName: string;
  startDate: string;
  endDate: string;
  snapshot: OverviewSnapshot;
  vouchers: OverviewVoucherTotals;
  shifts: OverviewShiftRevenue[];
}) {
  const { snapshot, vouchers } = options;
  const workbook = new ExcelJS.Workbook();
  const overview = workbook.addWorksheet("Tổng quan");
  overview.addRows([
    ["BÁO CÁO KINH DOANH THEO KHOẢNG NGÀY"],
    ["Cửa hàng", options.storeName],
    ["Khoảng ngày", `${options.startDate.split("-").reverse().join("/")} - ${options.endDate.split("-").reverse().join("/")}`],
    ["Chỉ tiêu", "Giá trị"],
    ["Doanh thu thuần (VND)", snapshot.totalRevenue],
    ["Đơn hoàn tất", snapshot.orderCount],
    ["Đơn đã hủy", snapshot.cancelledCount],
    ["Số ly", snapshot.cupCount],
    ["Số bánh", snapshot.bakeryCount],
    ["Giá trị đơn trung bình (VND)", snapshot.averageOrder],
    ["Tiền mặt (VND)", snapshot.paymentTotals.cash],
    ["Chuyển khoản (VND)", snapshot.paymentTotals.transfer],
    ["Phiếu thu (VND)", vouchers.income],
    ["Phiếu chi (VND)", vouchers.expense],
  ]);
  overview.columns = [{ width: 40 }, { width: 28 }];
  overview.getColumn(2).numFmt = "#,##0.##";
  const shifts = workbook.addWorksheet("Theo ca");
  shifts.addRow(["Ngày mở ca", "Ca", "Trạng thái", "Thu ngân", "Doanh thu (VND)", "Đơn hoàn tất", "Đơn hủy", "Số ly", "Tiền mặt (VND)", "Chuyển khoản (VND)", "Phiếu thu (VND)", "Phiếu chi (VND)", "Tiền cuối ca dự kiến (VND)", "Tiền chốt ca (VND)", "Chênh lệch (VND)"]);
  options.shifts.forEach(({ shift, summary, variance }) => shifts.addRow([
    shift.openedAt?.seconds ? new Date(shift.openedAt.seconds * 1000).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
    shift.shiftType === "single" ? "Ca đơn" : `Ca ${shift.shiftType.slice(-1)}`,
    shift.status === "closed" ? "Đã chốt" : "Đang mở", shift.cashierName || "",
    summary.totalSales, summary.completedBills, summary.cancelledBills, summary.cupCount ?? 0,
    summary.cashSales, summary.transferSales, summary.incomeVouchers, summary.expenseVouchers,
    summary.expectedClosingCash, shift.closingCash ?? null, variance,
  ]));
  shifts.columns.forEach((column, index) => { column.width = index === 3 ? 26 : 22; if (index >= 4) column.numFmt = "#,##0.##"; });
  shifts.autoFilter = "A1:O1";
  for (const [sheet, headerRow] of [[overview, 4], [shifts, 1]] as const) {
    sheet.views = [{ state: "frozen", ySplit: headerRow }];
    sheet.getRow(headerRow).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(headerRow).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
    sheet.getRow(headerRow).alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(headerRow).height = 32;
  }
  return workbook;
}
