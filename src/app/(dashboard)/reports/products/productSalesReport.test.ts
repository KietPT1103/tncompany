import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  aggregateProductSales,
  buildProductSalesWorksheet,
  calculateProductSalesTotals,
  createProductSalesExportBytes,
  PRODUCT_SALES_EXPORT_FILENAME,
} from "./productSalesReport.ts";

type BiffRecord = {
  type: number;
  payload: Uint8Array;
};

type XlsxModuleInterop = { CFB?: typeof XLSX.CFB };
const xlsxInterop = XLSX as unknown as XlsxModuleInterop;
const xlsxDefault = Reflect.get(XLSX as object, "default") as XlsxModuleInterop | undefined;
const CFB = xlsxInterop.CFB || xlsxDefault?.CFB;

assert.ok(CFB);

const readUint16 = (bytes: Uint8Array, offset: number) =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readUint32 = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

function readBiffRecords(bytes: Uint8Array, start = 0, end = bytes.length) {
  const records: BiffRecord[] = [];
  let offset = start;

  while (offset + 4 <= end) {
    const type = readUint16(bytes, offset);
    const length = readUint16(bytes, offset + 2);
    const payloadStart = offset + 4;
    const payloadEnd = payloadStart + length;
    assert.ok(payloadEnd <= end, `Invalid BIFF record 0x${type.toString(16)}`);
    records.push({ type, payload: bytes.slice(payloadStart, payloadEnd) });
    offset = payloadEnd;
  }

  assert.equal(offset, end);
  return records;
}

function inspectStyledBiff8(bytes: Uint8Array) {
  const cfb = CFB.read(bytes, { type: "array" });
  const workbookEntryIndex = cfb.FullPaths.findIndex((path: string) => /Workbook$/.test(path));
  assert.notEqual(workbookEntryIndex, -1);
  const workbookStream = Uint8Array.from(cfb.FileIndex[workbookEntryIndex].content);
  const globalRecords = readBiffRecords(workbookStream);
  const boundSheet = globalRecords.find((record) => record.type === 0x0085);
  assert.ok(boundSheet);
  const sheetOffset = readUint32(boundSheet.payload, 0);
  const fonts = globalRecords.filter((record) => record.type === 0x0031);
  const xfs = globalRecords.filter((record) => record.type === 0x00e0);
  const sheetRecords = readBiffRecords(workbookStream, sheetOffset);
  const cells = new Map<string, number>();

  for (const record of sheetRecords) {
    if (![0x0201, 0x0203, 0x0204].includes(record.type) || record.payload.length < 6) {
      continue;
    }
    const row = readUint16(record.payload, 0);
    const column = readUint16(record.payload, 2);
    cells.set(XLSX.utils.encode_cell({ r: row, c: column }), readUint16(record.payload, 4));
  }

  const styleFor = (address: string) => {
    const xfIndex = cells.get(address);
    assert.notEqual(xfIndex, undefined, `Missing cell ${address}`);
    const xf = xfs[xfIndex!].payload;
    const fontIndex = readUint16(xf, 0);
    const fontRecordIndex = fontIndex > 4 ? fontIndex - 1 : fontIndex;
    const font = fonts[fontRecordIndex].payload;
    const alignment = readUint32(xf, 6);
    const border = readUint32(xf, 10);
    const borderColors = readUint32(xf, 14);

    return {
      fontSize: readUint16(font, 0) / 20,
      fontColor: readUint16(font, 4),
      fontWeight: readUint16(font, 6),
      italic: Boolean(readUint16(font, 2) & 0x0002),
      horizontal: alignment & 0x07,
      wrapText: Boolean(alignment & 0x08),
      vertical: (alignment >> 4) & 0x07,
      topBorderStyle: (border >> 8) & 0x0f,
      topBorderColor: borderColors & 0x7f,
      bottomBorderStyle: (border >> 12) & 0x0f,
      bottomBorderColor: (borderColors >> 7) & 0x7f,
    };
  };

  return { styleFor };
}

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
  const matrix = XLSX.utils.sheet_to_json<Array<string | number>>(worksheet, {
    header: 1,
    defval: "",
  });

  assert.deepEqual(matrix[7], ["", "Mã hàng", "Tên hàng", "", "", "SL bán", "Doanh thu", "SL trả", "Giá trị trả", "", "Doanh thu thuần"]);
  assert.match(String(matrix[3][1]), /Từ ngày 01\/08\/2026 đến ngày 18\/08\/2026/);
  assert.equal(matrix[10][1], "SP01");
  assert.equal(matrix[10][5], 1);
  assert.equal(matrix[10][6], 45_000);
  assert.equal(matrix[10][10], 45_000);
});

test("legacy Excel export can be read back as a BIFF8 workbook", () => {
  const bytes = createProductSalesExportBytes({
    rows: [{ code: "SP01", name: "Cà phê", category: "Đồ uống", soldQuantity: 2, grossRevenue: 90_000, returnedQuantity: 0, returnedValue: 0, netRevenue: 85_000 }],
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 18),
    storeName: "Cafe",
  });
  const roundTripped = XLSX.read(bytes, { type: "array", cellStyles: true });
  const rows = XLSX.utils.sheet_to_json<Array<string | number>>(
    roundTripped.Sheets.BigProductBySaleByCat,
    { header: 1 },
  );

  assert.equal(roundTripped.SheetNames[0], "BigProductBySaleByCat");
  assert.equal(PRODUCT_SALES_EXPORT_FILENAME, "BigProductBySaleByCat.xls");
  assert.equal(rows[7][1], "Mã hàng");
  assert.equal(rows[10][1], "SP01");
  assert.equal(rows[10][10], 85_000);
  assert.equal(roundTripped.Sheets.BigProductBySaleByCat["!rows"]?.[1]?.hpt, 21);
  assert.equal(roundTripped.Sheets.BigProductBySaleByCat["!rows"]?.[10]?.hpt, 28);
});

test("BIFF8 export carries the visual styles from the reference report", () => {
  const bytes = createProductSalesExportBytes({
    rows: [{ code: "SP01", name: "Cà phê sữa", category: "Đồ uống", soldQuantity: 2, grossRevenue: 90_000, returnedQuantity: 0, returnedValue: 0, netRevenue: 85_000 }],
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 18),
    storeName: "Tiệm Cà Phê Ống Quan",
    generatedAt: new Date(2026, 7, 18, 10, 30),
  });
  const { styleFor } = inspectStyledBiff8(bytes);

  assert.deepEqual(styleFor("D2"), {
    fontSize: 15,
    fontColor: 63,
    fontWeight: 700,
    italic: false,
    horizontal: 2,
    wrapText: true,
    vertical: 1,
    topBorderStyle: 0,
    topBorderColor: 64,
    bottomBorderStyle: 0,
    bottomBorderColor: 64,
  });
  assert.equal(styleFor("F7").italic, true);
  assert.equal(styleFor("F7").horizontal, 3);
  assert.equal(styleFor("F7").fontSize, 9);
  assert.equal(styleFor("F7").bottomBorderStyle, 0);
  assert.equal(styleFor("B8").fontWeight, 700);
  assert.equal(styleFor("B8").fontSize, 9);
  assert.equal(styleFor("B8").topBorderStyle, 2);
  assert.equal(styleFor("B8").topBorderColor, 44);
  assert.equal(styleFor("B8").bottomBorderColor, 44);
  assert.equal(styleFor("B9").fontWeight, 700);
  assert.equal(styleFor("B9").bottomBorderStyle, 2);
  assert.equal(styleFor("B9").bottomBorderColor, 22);
  assert.equal(styleFor("B11").fontColor, 30);
  assert.equal(styleFor("B11").fontWeight, 700);
  assert.equal(styleFor("C11").wrapText, true);
  assert.equal(styleFor("C11").bottomBorderColor, 22);
  assert.equal(styleFor("F11").horizontal, 3);
  assert.equal(styleFor("F11").bottomBorderColor, 22);
});

test("BIFF8 export remains valid when all 5,000 report rows are merged and styled", () => {
  const reportRows = Array.from({ length: 5_000 }, (_, index) => ({
    code: `SP${String(index + 1).padStart(5, "0")}`,
    name: `Sản phẩm ${index + 1}`,
    category: "Đồ uống",
    soldQuantity: index + 1,
    grossRevenue: (index + 1) * 1_000,
    returnedQuantity: 0,
    returnedValue: 0,
    netRevenue: (index + 1) * 1_000,
  }));
  const bytes = createProductSalesExportBytes({
    rows: reportRows,
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 18),
    storeName: "Cafe",
  });
  const workbook = XLSX.read(bytes, { type: "array" });
  const worksheet = workbook.Sheets.BigProductBySaleByCat;

  assert.equal(worksheet.B5010.v, "SP05000");
  assert.equal(worksheet.K5010.v, 5_000_000);
  assert.equal(worksheet["!merges"]?.length, 10_011);
});

test("worksheet places merged cells and columns like the legacy cost report", () => {
  const worksheet = buildProductSalesWorksheet({
    rows: [{ code: "SP01", name: "Cà phê", category: "Đồ uống", soldQuantity: 2, grossRevenue: 90_000, returnedQuantity: 0, returnedValue: 0, netRevenue: 85_000 }],
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 18),
    storeName: "Cafe",
    generatedAt: new Date(2026, 7, 18, 10, 30),
  });

  assert.deepEqual(worksheet["!merges"], [
    { s: { c: 3, r: 1 }, e: { c: 8, r: 1 } },
    { s: { c: 1, r: 3 }, e: { c: 10, r: 3 } },
    { s: { c: 1, r: 4 }, e: { c: 10, r: 4 } },
    { s: { c: 5, r: 6 }, e: { c: 10, r: 6 } },
    { s: { c: 1, r: 0 }, e: { c: 3, r: 0 } },
    { s: { c: 1, r: 5 }, e: { c: 10, r: 5 } },
    { s: { c: 2, r: 7 }, e: { c: 4, r: 7 } },
    { s: { c: 8, r: 7 }, e: { c: 9, r: 7 } },
    { s: { c: 8, r: 8 }, e: { c: 9, r: 8 } },
    { s: { c: 4, r: 8 }, e: { c: 5, r: 8 } },
    { s: { c: 1, r: 8 }, e: { c: 3, r: 8 } },
    { s: { c: 8, r: 10 }, e: { c: 9, r: 10 } },
    { s: { c: 2, r: 10 }, e: { c: 4, r: 10 } },
  ]);
  assert.equal(worksheet["G11"].z, "[$-101042a]#,##0;-#,##0");
  assert.equal(worksheet["F11"].z, "[$-101042a]#,0.###");
});
