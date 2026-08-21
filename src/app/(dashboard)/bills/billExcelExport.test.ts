import assert from "node:assert/strict";
import test from "node:test";
import type { Bill } from "@/services/billService";
import type { CashVoucher } from "@/services/cashVoucherService";
import { buildBillExportRows, buildVoucherExportRows } from "./billExcelExport.ts";

test("builds invoice export rows with readable Vietnamese values", () => {
  const bills: Bill[] = [{
    id: "CF0001",
    tableNumber: "T01",
    note: "Khách quen",
    total: 125000,
    items: [],
    paymentMethod: "transfer",
    status: "cancelled",
    createdAt: { seconds: 1_725_180_000, nanoseconds: 0 },
  }];

  assert.deepEqual(buildBillExportRows(bills), [{
    "Mã hóa đơn": "CF0001",
    "Thời gian": new Date(1_725_180_000 * 1000),
    "Bàn": "T01",
    "Thanh toán": "Chuyển khoản",
    "Tổng tiền (VND)": 125000,
    "Trạng thái": "Đã hủy",
    "Ghi chú": "Khách quen",
  }]);
});

test("builds cash voucher export rows and keeps expense values negative", () => {
  const vouchers: CashVoucher[] = [{
    id: "voucher-1",
    code: "CTM001",
    storeId: "cafe",
    type: "expense",
    amount: 250000,
    category: "Nguyên liệu pha chế",
    personName: "Duy Phúc",
    note: "Mua cacao",
    includeInCashFlow: false,
    happenedAt: { seconds: 1_725_180_000, nanoseconds: 0 },
  } as unknown as CashVoucher];

  assert.deepEqual(buildVoucherExportRows(vouchers), [{
    "Mã phiếu": "CTM001",
    "Thời gian": new Date(1_725_180_000 * 1000),
    "Loại": "Phiếu chi",
    "Nội dung": "Nguyên liệu pha chế",
    "Chi tiết": "Mua cacao",
    "Người nộp/nhận": "Duy Phúc",
    "Tính vào dòng tiền": "Không",
    "Giá trị (VND)": -250000,
  }]);
});
