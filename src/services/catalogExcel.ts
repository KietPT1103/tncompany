import * as XLSX from "xlsx";
import type { Ingredient } from "@/services/ingredients";
import type { Product } from "@/services/products";

export type IngredientImportRow = {
  ingredientCode: string; ingredientName: string; purchaseUnit: string; baseUnit: string;
  purchaseToBaseFactor: number; cost: number; supplierItemCode: string; description: string; isActive: boolean;
};

const normalize = (value: unknown) => String(value ?? "").trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
const numberValue = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (!text) return fallback;
  const result = Number(text.includes(",") && !text.includes(".") ? text.replace(",", ".") : text.replace(/,/g, ""));
  return Number.isFinite(result) ? result : fallback;
};
const booleanValue = (value: unknown) => !["0", "false", "khong", "ngung", "tamdung"].includes(normalize(value));

const downloadWorkbook = (rows: Record<string, unknown>[], sheetName: string, fileName: string) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.min(45, Math.max(key.length + 2, ...rows.map((row) => String(row[key] ?? "").length + 2))),
  }));
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
};

export function exportProductsToExcel(products: Product[], storeId: string) {
  downloadWorkbook(products.map((item) => ({
    "Mã sản phẩm": item.product_code, "Tên sản phẩm": item.product_name,
    "Danh mục": item.categoryName || item.category || "", "Đơn vị": item.unit || "",
    "Giá bán": item.price ?? 0, "Giá vốn": item.cost ?? 0, "Tồn kho": item.stockQuantity ?? 0,
    "Đang bán": item.isSelling !== false ? "Có" : "Không", "Mô tả": item.description || "",
  })), "Sản phẩm", `danh-sach-san-pham-${storeId}.xlsx`);
}

export function exportIngredientsToExcel(items: Ingredient[], storeId: string) {
  downloadWorkbook(items.map((item) => ({
    "Mã nguyên liệu": item.ingredientCode, "Tên nguyên liệu": item.ingredientName,
    "Đơn vị thu ngân": item.purchaseUnit || item.unit,
    "Đơn vị pha chế": item.baseUnit || item.unit,
    "Hệ số quy đổi": item.purchaseToBaseFactor || 1,
    "Giá vốn / đơn vị pha chế": item.cost ?? 0,
    "Tồn kho (đơn vị thu ngân)": item.stockQuantity / (item.purchaseToBaseFactor || 1), "Nhà phân phối": item.supplierName || "",
    "Mã tại nhà phân phối": item.supplierItemCode || "", "Mô tả": item.description || "",
    "Đang sử dụng": item.isActive ? "Có" : "Không",
  })), "Nguyên liệu", `danh-sach-nguyen-lieu-${storeId}.xlsx`);
}

export async function parseIngredientWorkbook(file: File): Promise<IngredientImportRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const aliases: Record<keyof IngredientImportRow, string[]> = {
    ingredientCode: ["manguyenlieu", "manl", "mahang", "code"],
    ingredientName: ["tennguyenlieu", "tennl", "tenhang", "name"],
    purchaseUnit: ["donvithungan", "donvinhap", "dvtnhap", "purchaseunit"],
    baseUnit: ["donvipha che", "donviphache", "donvisudung", "donvicongthuc", "dvt", "baseunit"].map(normalize),
    purchaseToBaseFactor: ["hesoquydoi", "quydoi", "conversionfactor"],
    cost: ["giavondonviphache", "giavondonvisudung", "giavon", "cost"],
    supplierItemCode: ["matanhaphanphoi", "supplieritemcode"],
    description: ["mota", "ghichu", "description"],
    isActive: ["dangsudung", "hoatdong", "isactive"],
  };
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalize);
    return aliases.ingredientCode.some((value) => headers.includes(value))
      && aliases.ingredientName.some((value) => headers.includes(value));
  });
  if (headerIndex < 0) throw new Error("Không tìm thấy cột Mã nguyên liệu và Tên nguyên liệu.");
  const headers = rows[headerIndex].map(normalize);
  const indexes = Object.fromEntries((Object.keys(aliases) as Array<keyof IngredientImportRow>).map(
    (key) => [key, headers.findIndex((header) => aliases[key].includes(header))]
  )) as Record<keyof IngredientImportRow, number>;
  const parsed = rows.slice(headerIndex + 1).map((row) => {
    const cell = (key: keyof IngredientImportRow) => indexes[key] >= 0 ? row[indexes[key]] : "";
    const purchaseUnit = String(cell("purchaseUnit") || cell("baseUnit") || "").trim();
    const baseUnit = String(cell("baseUnit") || cell("purchaseUnit") || "").trim();
    const factor = Math.max(0, numberValue(cell("purchaseToBaseFactor"), 1));
    return {
      ingredientCode: String(cell("ingredientCode")).trim(), ingredientName: String(cell("ingredientName")).trim(),
      purchaseUnit, baseUnit, purchaseToBaseFactor: factor,
      cost: Math.max(0, numberValue(cell("cost"))), supplierItemCode: String(cell("supplierItemCode")).trim(),
      description: String(cell("description")).trim(), isActive: indexes.isActive < 0 || booleanValue(cell("isActive")),
    };
  }).filter((item) => item.ingredientCode && item.ingredientName && item.purchaseUnit && item.baseUnit && item.purchaseToBaseFactor > 0);
  if (parsed.length === 0) throw new Error("File không có dòng nguyên liệu hợp lệ.");
  return parsed;
}
