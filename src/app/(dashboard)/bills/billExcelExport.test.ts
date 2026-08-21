import assert from "node:assert/strict";
import test from "node:test";
import type { Bill } from "@/services/billService";
import type { CashVoucher } from "@/services/cashVoucherService";
import ExcelJS from "exceljs";
import {
  buildBillExportRows,
  buildBillExportWorkbook,
  buildVoucherExportRows,
} from "./billExcelExport.ts";

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

test("creates a polished invoice workbook with report structure and durable formatting", async () => {
  const bills: Bill[] = [
    {
      id: "CF0001",
      tableNumber: "T01",
      note: "Khách quen",
      total: 125000,
      items: [],
      paymentMethod: "transfer",
      status: "completed",
      createdAt: { seconds: 1_725_180_000, nanoseconds: 0 },
    },
    {
      id: "CF0002",
      tableNumber: "T02",
      total: 50000,
      items: [],
      paymentMethod: "cash",
      status: "cancelled",
      createdAt: { seconds: 1_725_183_600, nanoseconds: 0 },
    },
  ];

  const workbook = buildBillExportWorkbook(bills, {
    startDate: "2026-08-01",
    endDate: "2026-08-21",
    generatedAt: new Date("2026-08-21T10:00:00+07:00"),
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const roundTripped = new ExcelJS.Workbook();
  await roundTripped.xlsx.load(buffer);
  const sheet = roundTripped.getWorksheet("Danh sách hóa đơn");

  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "DANH SÁCH HÓA ĐƠN");
  assert.equal(sheet.getCell("A1").isMerged, true);
  assert.equal(sheet.getCell("A1").fill.type, "pattern");
  assert.equal(sheet.getCell("A1").fill.fgColor?.argb, "FF065F46");
  assert.equal(sheet.getCell("A6").font.bold, true);
  assert.equal(sheet.getCell("B7").numFmt, "dd/mm/yyyy hh:mm");
  assert.equal(sheet.getCell("E7").numFmt, '#,##0 "VND"');
  assert.equal(sheet.getCell("E9").formula, 'SUMIF(F7:F8,"Hợp lệ",E7:E8)');
  assert.equal(sheet.autoFilter, "A6:G8");
  assert.equal(sheet.views[0]?.state, "frozen");
  assert.equal(sheet.views[0]?.ySplit, 6);
});

test("keeps empty invoice exports valid and formula ranges forward", () => {
  const sheet = buildBillExportWorkbook([], {
    startDate: "2026-08-21",
    endDate: "2026-08-21",
  }).getWorksheet("Danh sách hóa đơn");

  assert.ok(sheet);
  assert.equal(sheet.getCell("B4").formula, "COUNTA(A7:A7)");
  assert.equal(sheet.getCell("F4").formula, 'SUMIF(F7:F7,"Hợp lệ",E7:E7)');
  assert.equal(sheet.getCell("E8").formula, 'SUMIF(F7:F7,"Hợp lệ",E7:E7)');
  assert.deepEqual(sheet.autoFilter, { from: "A6", to: "G7" });
});
