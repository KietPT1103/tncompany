import type { Bill } from "@/services/billService";
import type { CashVoucher } from "@/services/cashVoucherService";

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
