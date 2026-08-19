import * as XLSX from "xlsx";

// @ts-expect-error Node's type-stripping test runner requires the explicit extension.
import { applyProductSalesBiff8Styles } from "./productSalesBiff8.ts";

export type ReportBill = {
  status?: "completed" | "cancelled";
  total: number;
  items: Array<{
    menuId?: string;
    name: string;
    quantity: number;
    lineTotal: number;
  }>;
};

export type ReportProduct = {
  product_code: string;
  product_name: string;
  category?: string;
  categoryName?: string;
};

export type ProductSalesRow = {
  code: string;
  name: string;
  category: string;
  soldQuantity: number;
  grossRevenue: number;
  returnedQuantity: number;
  returnedValue: number;
  netRevenue: number;
};

export type ProductSalesTotals = Omit<ProductSalesRow, "code" | "name" | "category">;

export const PRODUCT_SALES_EXPORT_FILENAME = "BigProductBySaleByCat.xls";

export const normalizeReportText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLocaleLowerCase("vi");

export function aggregateProductSales(
  bills: ReportBill[],
  products: ReportProduct[],
): ProductSalesRow[] {
  const productsByCode = new Map(
    products.map((product) => [normalizeReportText(product.product_code), product]),
  );
  const productsByName = new Map(
    products.map((product) => [normalizeReportText(product.product_name), product]),
  );
  const rows = new Map<string, ProductSalesRow>();

  bills
    .filter((bill) => bill.status !== "cancelled")
    .forEach((bill) => {
      const billLineTotal = bill.items.reduce(
        (total, item) => total + Math.max(0, Number(item.lineTotal) || 0),
        0,
      );
      const revenueRatio = billLineTotal > 0 ? Math.max(0, bill.total) / billLineTotal : 0;

      bill.items.forEach((item) => {
        const itemCode = item.menuId?.trim() || "";
        const product =
          productsByCode.get(normalizeReportText(itemCode)) ||
          productsByName.get(normalizeReportText(item.name));
        const code = product?.product_code || itemCode || item.name;
        const key = normalizeReportText(code);
        const current = rows.get(key) || {
          code,
          name: product?.product_name || item.name,
          category: product?.categoryName || product?.category || "Chưa phân loại",
          soldQuantity: 0,
          grossRevenue: 0,
          returnedQuantity: 0,
          returnedValue: 0,
          netRevenue: 0,
        };

        current.soldQuantity += Number(item.quantity) || 0;
        current.grossRevenue += Number(item.lineTotal) || 0;
        current.netRevenue += (Number(item.lineTotal) || 0) * revenueRatio;
        rows.set(key, current);
      });
    });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      grossRevenue: Math.round(row.grossRevenue),
      netRevenue: Math.round(row.netRevenue),
    }))
    .sort((left, right) => right.netRevenue - left.netRevenue || left.name.localeCompare(right.name, "vi"));
}

export function calculateProductSalesTotals(rows: ProductSalesRow[]): ProductSalesTotals {
  return rows.reduce<ProductSalesTotals>(
    (totals, row) => ({
      soldQuantity: totals.soldQuantity + row.soldQuantity,
      grossRevenue: totals.grossRevenue + row.grossRevenue,
      returnedQuantity: totals.returnedQuantity + row.returnedQuantity,
      returnedValue: totals.returnedValue + row.returnedValue,
      netRevenue: totals.netRevenue + row.netRevenue,
    }),
    {
      soldQuantity: 0,
      grossRevenue: 0,
      returnedQuantity: 0,
      returnedValue: 0,
      netRevenue: 0,
    },
  );
}

const padDatePart = (value: number) => String(value).padStart(2, "0");

const formatViDate = (date: Date) =>
  `${padDatePart(date.getDate())}/${padDatePart(date.getMonth() + 1)}/${date.getFullYear()}`;

const formatViDateTime = (date: Date) =>
  `${formatViDate(date)} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const QUANTITY_NUMBER_FORMAT = "[$-101042a]#,0.###";
const MONEY_NUMBER_FORMAT = "[$-101042a]#,##0;-#,##0";

export function buildProductSalesWorksheet({
  rows,
  startDate,
  endDate,
  storeName,
  generatedAt = new Date(),
}: {
  rows: ProductSalesRow[];
  startDate: Date;
  endDate: Date;
  storeName: string;
  generatedAt?: Date;
}) {
  const totals = calculateProductSalesTotals(rows);
  const reportRows: Array<Array<string | number | null>> = [
    [null, `Ngày lập: ${formatViDateTime(generatedAt)}`],
    [null, null, null, "Báo cáo bán hàng theo hàng hóa"],
    [],
    [null, `Từ ngày ${formatViDate(startDate)} đến ngày ${formatViDate(endDate)}`],
    [null, `Chi nhánh: ${storeName}`],
    [null, ""],
    [
      null,
      null,
      null,
      null,
      null,
      "(Đã phân bổ giảm giá hóa đơn, giảm giá phiếu trả)",
      null,
      null,
      null,
      null,
      null,
    ],
    [null, "Mã hàng", "Tên hàng", null, null, "SL bán", "Doanh thu", "SL trả", "Giá trị trả", null, "Doanh thu thuần"],
    [
      null,
      `SL mặt hàng: ${rows.length}`,
      null,
      null,
      totals.soldQuantity,
      null,
      totals.grossRevenue,
      totals.returnedQuantity,
      totals.returnedValue,
      null,
      totals.netRevenue,
    ],
    [],
    ...rows.map((row) => [
      null,
      row.code,
      row.name,
      null,
      null,
      row.soldQuantity,
      row.grossRevenue,
      row.returnedQuantity,
      row.returnedValue,
      null,
      row.netRevenue,
    ]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(reportRows, { sheetStubs: true });
  worksheet["!cols"] = [
    { wch: 0.91 },
    { wch: 17.55 },
    { wch: 2.91 },
    { wch: 6.55 },
    { wch: 4.82 },
    { wch: 9.09 },
    { wch: 14.45 },
    { wch: 8.09 },
    { wch: 11.36 },
    { wch: 3.73 },
    { wch: 16.73 },
    { wch: 1 },
  ];
  worksheet["!merges"] = [
    XLSX.utils.decode_range("D2:I2"),
    XLSX.utils.decode_range("B4:K4"),
    XLSX.utils.decode_range("B5:K5"),
    XLSX.utils.decode_range("F7:K7"),
    XLSX.utils.decode_range("B1:D1"),
    XLSX.utils.decode_range("B6:K6"),
    XLSX.utils.decode_range("C8:E8"),
    XLSX.utils.decode_range("I8:J8"),
    XLSX.utils.decode_range("I9:J9"),
    XLSX.utils.decode_range("E9:F9"),
    XLSX.utils.decode_range("B9:D9"),
    ...rows.flatMap((_, index) => {
      const excelRow = index + 11;
      return [
        XLSX.utils.decode_range(`I${excelRow}:J${excelRow}`),
        XLSX.utils.decode_range(`C${excelRow}:E${excelRow}`),
      ];
    }),
  ];
  worksheet["!rows"] = [
    { hpt: 11 },
    { hpt: 21 },
    { hpt: 4 },
    { hpt: 17 },
    { hpt: 17 },
    { hpt: 14 },
    { hpt: 11 },
    { hpt: 27 },
    { hpt: 28 },
    { hpt: 1 },
    ...rows.map(() => ({ hpt: 28 })),
  ];

  ["E9", "H9", ...rows.map((_, index) => `F${index + 11}`), ...rows.map((_, index) => `H${index + 11}`)]
    .forEach((address) => {
      if (worksheet[address]) worksheet[address].z = QUANTITY_NUMBER_FORMAT;
    });
  ["G9", "I9", "K9", ...rows.flatMap((_, index) => {
    const excelRow = index + 11;
    return [`G${excelRow}`, `I${excelRow}`, `K${excelRow}`];
  })].forEach((address) => {
    if (worksheet[address]) worksheet[address].z = MONEY_NUMBER_FORMAT;
  });

  return worksheet;
}

export function createProductSalesWorkbook(options: Parameters<typeof buildProductSalesWorksheet>[0]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildProductSalesWorksheet(options), "BigProductBySaleByCat");
  return workbook;
}

export function createProductSalesExportBytes(
  options: Parameters<typeof buildProductSalesWorksheet>[0],
) {
  const workbook = createProductSalesWorkbook(options);
  const worksheet = workbook.Sheets.BigProductBySaleByCat;
  const bytes = XLSX.write(workbook, {
    type: "array",
    bookType: "biff8",
  }) as ArrayBuffer;
  const rowHeights = (worksheet["!rows"] || []).map((row) => row.hpt || 15);
  return applyProductSalesBiff8Styles(new Uint8Array(bytes), rowHeights);
}
