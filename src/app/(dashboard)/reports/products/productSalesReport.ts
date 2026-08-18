import * as XLSX from "xlsx";

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

const formatViDate = (date: Date) =>
  date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

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
  const reportRows: Array<Array<string | number>> = [
    [`Ngày lập: ${generatedAt.toLocaleString("vi-VN")}`],
    ["Báo cáo bán hàng theo hàng hóa"],
    [`Từ ngày ${formatViDate(startDate)} đến ngày ${formatViDate(endDate)}`],
    [`Chi nhánh: ${storeName}`],
    ["(Đã phân bổ giảm giá hóa đơn, giảm giá phiếu trả)"],
    [],
    ["Mã hàng", "Tên hàng", "SL bán", "Doanh thu", "SL trả", "Giá trị trả", "Doanh thu thuần"],
    [
      `SL mặt hàng: ${rows.length}`,
      "",
      totals.soldQuantity,
      totals.grossRevenue,
      totals.returnedQuantity,
      totals.returnedValue,
      totals.netRevenue,
    ],
    ...rows.map((row) => [
      row.code,
      row.name,
      row.soldQuantity,
      row.grossRevenue,
      row.returnedQuantity,
      row.returnedValue,
      row.netRevenue,
    ]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(reportRows);
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 42 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
  ];
  worksheet["!merges"] = [
    XLSX.utils.decode_range("A1:G1"),
    XLSX.utils.decode_range("A2:G2"),
    XLSX.utils.decode_range("A3:G3"),
    XLSX.utils.decode_range("A4:G4"),
    XLSX.utils.decode_range("A5:G5"),
  ];
  return worksheet;
}

export function createProductSalesWorkbook(options: Parameters<typeof buildProductSalesWorksheet>[0]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildProductSalesWorksheet(options), "BigProductBySaleByCat");
  return workbook;
}

