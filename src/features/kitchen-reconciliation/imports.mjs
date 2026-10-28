import * as XLSX from "xlsx";
import { parseStock, parseRecipes, number, normalize, dateKey } from "./domain.mjs";
function readWorkbook(data, formulaCells = false) {
  const book = XLSX.read(data, { type: "array", cellDates: true, cellFormula: true, cellHTML: false, bookVBA: false });
  const sheets = {};
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name], range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    if (range.e.r > 2e4 || range.e.c > 200) throw Error("File quá lớn: tối đa 20.000 dòng và 200 cột/sheet.");
    sheets[name] = Array.from({ length: range.e.r + 1 }, (_, r) => Array.from({ length: range.e.c + 1 }, (_2, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      return cell ? formulaCells && cell.f ? "=" + cell.f : cell.v : null;
    }));
  }
  return sheets;
}
function importStock(data, sheetName) {
  const sheets = readWorkbook(data, true), names = Object.keys(sheets);
  if (!sheetName && names.length !== 1) throw Error("File kho có nhiều sheet. Chọn sheet tháng trước khi đọc.");
  return { stock: parseStock(sheets[sheetName || names[0]]), sheet: sheetName || names[0] };
}
const importRecipes = (data) => parseRecipes(readWorkbook(data));
function importCounts(data, stock) {
  const rows = Object.values(readWorkbook(data))[0], counts = {};
  const head = rows.findIndex((r) => normalize(r[0]) === "nguyen lieu");
  if (head < 0) throw Error("Dùng mẫu kiểm kê: Nguyên liệu, Tồn đầu chưa sơ chế, Tồn cuối chưa sơ chế, Tồn đầu đã sơ chế, Tồn cuối đã sơ chế, ĐVT.");
  for (const r of rows.slice(head + 1)) {
    if (!r[0]) continue;
    const found = stock.find((s) => normalize(s.name) === normalize(r[0]));
    if (!found) throw Error(`Kiểm kê chưa khớp nguyên liệu: ${r[0]}`);
    if (normalize(r[5]) !== normalize(found.unit)) throw Error(`Kiểm kê ${r[0]}: ĐVT phải là ${found.unit}.`);
    if (counts[found.name]) throw Error(`Trùng kiểm kê ${r[0]}.`);
    const keys = ["rawOpen", "rawClose", "preparedOpen", "preparedClose"];
    const item = {};
    keys.forEach((k, i) => {
      const v = r[i + 1];
      if (v === null || v === void 0 || v === "") {
        item[k] = null;
        return;
      }
      if (!Number.isFinite(number(v)) || number(v) < 0) throw Error(`Kiểm kê không hợp lệ: ${r[0]}`);
      item[k] = number(v);
    });
    counts[found.name] = item;
  }
  return counts;
}
function parsePdfPages(pages) {
  const sales = [], codes = /* @__PURE__ */ new Set();
  let from = null, to = null, declaredCount = null, declaredQuantity = null;
  for (let page = 0; page < pages.length; page++) {
    const items = pages[page].filter((i) => i.str?.trim()).map((i) => ({ ...i, x: i.transform[4], y: i.transform[5] }));
    const text = items.map((i) => i.str).join(" "), dates = text.match(/Từ\s+ngày\s+(\d{2}\/\d{2}\/\d{4})\s+đến\s+ngày\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (dates) {
      from = dateKey(dates[1]);
      to = dateKey(dates[2]);
    }
    const count = text.match(/SL\s+mặt\s+hàng:\s*(\d+)/i);
    if (count) declaredCount = Number(count[1]);
    const anchors = items.filter((i) => /^SP\d+$/.test(i.str.trim())).sort((a, b) => b.y - a.y);
    const quantityHeader = items.find((i) => i.str.trim() === "SL" && items.some((j) => j.str.trim() === "bán" && Math.abs(i.y - j.y) < 2 && Math.abs(i.x - j.x) < 25));
    if (!quantityHeader) throw Error(`Trang ${page + 1}: không xác định được cột SL bán.`);
    const xMin = quantityHeader.x - 8, xMax = quantityHeader.x + 43;
    if (page === 0 && anchors.length) {
      const summary = items.filter((i) => i.x >= xMin && i.x <= xMax && i.y > anchors[0].y + 15 && i.y < quantityHeader.y - 3 && /^\d[\d.,]*$/.test(i.str));
      if (summary.length === 1) declaredQuantity = Number(summary[0].str.replace(/\./g, "").replace(",", "."));
    }
    for (let a = 0; a < anchors.length; a++) {
      const anchor = anchors[a], code = anchor.str.trim();
      if (codes.has(code)) throw Error(`PDF trùng mã hàng ${code}; không tự cộng trùng.`);
      codes.add(code);
      const numeric = items.filter((i) => Math.abs(i.y - anchor.y) < 3 && i.x >= xMin && i.x <= xMax && /^\d[\d.,]*$/.test(i.str));
      if (numeric.length !== 1) throw Error(`Không đọc chắc chắn SL bán ${code}, trang ${page + 1}.`);
      const quantity = Number(numeric[0].str.replace(/\./g, "").replace(",", "."));
      const upper = a === 0 ? anchor.y + 16 : (anchors[a - 1].y + anchor.y) / 2;
      const lower = a === anchors.length - 1 ? anchor.y - 18 : (anchor.y + anchors[a + 1].y) / 2;
      const parts = items.filter((i) => i.x > anchor.x + 45 && i.x < xMin - 5 && i.y < upper && i.y > lower).sort((i, j) => Math.abs(i.y - j.y) > 2 ? j.y - i.y : i.x - j.x);
      sales.push({ code, name: parts.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim(), quantity, page: page + 1 });
    }
  }
  if (!sales.length) throw Error("PDF không có dữ liệu dạng chữ/mã SP. Không hỗ trợ bản scan ảnh.");
  if (declaredCount !== null && sales.length !== declaredCount) throw Error(`PDF khai báo ${declaredCount} mặt hàng nhưng đọc được ${sales.length}.`);
  const total = sales.reduce((a, s) => a + s.quantity, 0);
  if (declaredQuantity !== null && Math.abs(total - declaredQuantity) > 1e-3) throw Error(`Tổng SL đọc ${total} không khớp tổng PDF ${declaredQuantity}.`);
  return { sales, from, to, declaredCount, declaredQuantity, total };
}
async function readSalesPdf(data, getDocument) {
  const pdf = await getDocument({ data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: true }).promise;
  try {
    if (pdf.numPages > 100) throw Error("PDF quá 100 trang.");
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) pages.push((await (await pdf.getPage(n)).getTextContent()).items);
    return parsePdfPages(pages);
  } finally {
    await pdf.destroy();
  }
}
export {
  importCounts,
  importRecipes,
  importStock,
  parsePdfPages,
  readSalesPdf,
  readWorkbook
};
