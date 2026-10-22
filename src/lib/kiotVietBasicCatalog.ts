export type BasicCatalogItem = { product_code: string; product_name: string; price: number };

function normalizeHeader(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").trim().toLowerCase();
}

function parsePrice(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const text = value.trim().replace(/\s|₫|đ|vnd/gi, "");
  if (/^\d+$/.test(text)) return Number(text);
  if (/^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(text)) return Number(text.replace(/[.,]/g, ""));
  if (/^\d+[.,]\d{1,2}$/.test(text)) return Number(text.replace(",", "."));
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) return Number(text.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(text)) return Number(text.replace(/,/g, ""));
  return NaN;
}

export function parseKiotVietBasicCatalog(rows: unknown[][]): BasicCatalogItem[] {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("ma mon") && headers.includes("ten mon") && headers.includes("gia ban");
  });
  if (headerIndex < 0) throw new Error("File phải có đủ các cột Mã món, Tên món và Giá bán.");
  const headers = rows[headerIndex].map(normalizeHeader);
  const codeIndex = headers.indexOf("ma mon"), nameIndex = headers.indexOf("ten mon"), priceIndex = headers.indexOf("gia ban");
  const seen = new Set<string>();
  const items: BasicCatalogItem[] = [];
  for (let index = headerIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.every((cell) => cell == null || String(cell).trim() === "")) continue;
    const code = String(row[codeIndex] ?? "").trim(), name = String(row[nameIndex] ?? "").trim();
    const price = parsePrice(row[priceIndex]);
    if (!code || code.length > 100 || /[\x00-\x1f\x7f]/.test(code) || !name || name.length > 255 || !Number.isFinite(price) || price < 0 || price >= 1e13) {
      throw new Error(`Dòng ${index + 1}: mã, tên hoặc giá bán không hợp lệ. Giá 0 được chấp nhận; không để trống giá.`);
    }
    const key = code.toLocaleLowerCase("vi");
    if (seen.has(key)) throw new Error(`Dòng ${index + 1}: mã món trùng ${code}.`);
    seen.add(key);
    items.push({ product_code: code, product_name: name, price: Math.round((price + Number.EPSILON) * 100) / 100 });
  }
  if (!items.length || items.length > 5000) throw new Error("File phải có từ 1 đến 5.000 món.");
  return items;
}
