import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  aggregateProductSales,
  buildProductSalesWorksheet,
  calculateProductSalesTotals,
  createProductSalesWorkbook,
} from "./productSalesReport.ts";

test("aggregates completed bills and allocates bill discounts", () => {
  const rows = aggregateProductSales(
    [
      {
        status: "completed",
        total: 180_000,
        items: [
          { menuId: "SP01", name: "Cà phê", quantity: 2, lineTotal: 100_000 },
          { menuId: "SP02", name: "Trà", quantity: 1, lineTotal: 100_000 },
        ],
      },
      {
        status: "cancelled",
        total: 50_000,
        items: [{ menuId: "SP01", name: "Cà phê", quantity: 1, lineTotal: 50_000 }],
      },
    ],
    [
      { product_code: "SP01", product_name: "Cà phê sữa", category: "Đồ uống" },
      { product_code: "SP02", product_name: "Trà đào", category: "Đồ uống" },
    ],
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].netRevenue, 90_000);
  assert.equal(rows.find((row) => row.code === "SP01")?.soldQuantity, 2);
  assert.equal(calculateProductSalesTotals(rows).netRevenue, 180_000);
});

test("worksheet keeps the column names required by the Tính cost importer", () => {
  const rows = aggregateProductSales(
    [{ status: "completed", total: 45_000, items: [{ menuId: "SP01", name: "Cà phê", quantity: 1, lineTotal: 45_000 }] }],
    [],
  );
  const worksheet = buildProductSalesWorksheet({
    rows,
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 18),
    storeName: "Cafe",
    generatedAt: new Date(2026, 7, 18, 10, 30),
  });
  const matrix = XLSX.utils.sheet_to_json<Array<string | number>>(worksheet, { header: 1 });

  assert.deepEqual(matrix[6], ["Mã hàng", "Tên hàng", "SL bán", "Doanh thu", "SL trả", "Giá trị trả", "Doanh thu thuần"]);
  assert.match(String(matrix[2][0]), /Từ ngày 01\/08\/2026 đến ngày 18\/08\/2026/);
  assert.equal(matrix[8][6], 45_000);
});

test("legacy Excel export can be read back as a BIFF8 workbook", () => {
  const workbook = createProductSalesWorkbook({
    rows: [{ code: "SP01", name: "Cà phê", category: "Đồ uống", soldQuantity: 2, grossRevenue: 90_000, returnedQuantity: 0, returnedValue: 0, netRevenue: 85_000 }],
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 18),
    storeName: "Cafe",
  });
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "biff8" });
  const roundTripped = XLSX.read(bytes, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Array<string | number>>(
    roundTripped.Sheets.BigProductBySaleByCat,
    { header: 1 },
  );

  assert.equal(roundTripped.SheetNames[0], "BigProductBySaleByCat");
  assert.equal(rows[6][0], "Mã hàng");
  assert.equal(rows[8][6], 85_000);
});
