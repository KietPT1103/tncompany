const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
const dishKey = (value) => normalize(value).replace(/\b(\d+)\s*(?:nguoi|ng|n)\b/g, "$1 nguoi").replace(/[()]/g, " ").replace(/\b(phan|combo)\b/g, "").replace(/\s+/g, " ").trim();
const number = (value) => typeof value === "number" ? value : typeof value === "string" && /^[-+]?\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.replace(",", ".")) : NaN;
const unitKey = (value) => {
  const u = normalize(value);
  return { gam: "g", gram: "g", gr: "g", kilogram: "kg", lit: "l", liter: "l", vien: "vien", qua: "cai", cay: "cai" }[u] || u;
};
function conversion(from, to) {
  const a = unitKey(from), b = unitKey(to);
  if (!a || !b) return null;
  if (a === b) return 1;
  const units = { g: ["mass", 1e-3], kg: ["mass", 1], ml: ["volume", 1e-3], l: ["volume", 1] };
  return units[a] && units[b] && units[a][0] === units[b][0] ? units[a][1] / units[b][1] : null;
}
function movements(value) {
  if (value === null || value === void 0 || value === "") return { received: 0, issued: 0 };
  if (typeof value === "number" && Number.isFinite(value)) return { received: Math.max(value, 0), issued: Math.max(-value, 0) };
  const expression = String(value).replace(/^=/, "").replace(/\s/g, "");
  if (!/^[+-]?\d+(?:[.,]\d+)?(?:[+-]\d+(?:[.,]\d+)?)*$/.test(expression)) throw Error(`Công thức nhập–xuất chưa hỗ trợ: ${value}. Hãy tách thành các số cộng/trừ.`);
  const terms = expression.match(/[+-]?\d+(?:[.,]\d+)?/g).map(number);
  return { received: terms.filter((n) => n > 0).reduce((a, b) => a + b, 0), issued: -terms.filter((n) => n < 0).reduce((a, b) => a + b, 0) };
}
function dateKey(value) {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (typeof value === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 864e5);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}
function parseStock(rows) {
  const header = rows.findIndex((r) => normalize(r[0]).includes("ten nguyen lieu"));
  if (header < 0) throw Error("Không tìm thấy tiêu đề Tên Nguyên Liệu.");
  const dates = rows[header].map((v, i) => i >= 3 ? dateKey(v) : null);
  if (!dates.some(Boolean)) throw Error("Không tìm thấy cột ngày trong file kho.");
  const grouped = /* @__PURE__ */ new Map();
  rows.slice(header + 1).forEach((r, index) => {
    if (!String(r[0] ?? "").trim() || !r[2]) return;
    const name = String(r[0]).trim();
    const opening = number(r[1] ?? 0);
    if (!Number.isFinite(opening)) throw Error(`Tồn đầu không hợp lệ: ${name}`);
    const moves = dates.flatMap((date, i) => {
      if (!date) return [];
      try {
        return [{ date, ...movements(r[i]) }];
      } catch (e) {
        throw Error(`${name}, ${date}: ${e.message}`);
      }
    });
    const key = normalize(name), unit = String(r[2]).trim(), existing = grouped.get(key);
    if (existing) {
      if (unitKey(existing.unit) !== unitKey(unit)) throw Error(`Trùng tên ${name} nhưng khác ĐVT; cần tách tên trong file kho.`);
      existing.opening += opening;
      existing.moves.push(...moves);
      existing.sourceRows.push(header + index + 2);
    } else grouped.set(key, { name, unit, opening, moves, sourceRows: [header + index + 2] });
  });
  return [...grouped.values()];
}
function parseRecipes(sheets) {
  const result = [], seen = /* @__PURE__ */ new Set();
  const entries = Object.entries(sheets).sort(([a], [b]) => Number(!normalize(a).startsWith("cost")) - Number(!normalize(b).startsWith("cost")));
  for (const [source, rows] of entries) {
    const primary = normalize(source).startsWith("cost");
    if (!primary && !normalize(source).startsWith("ds tat ca")) continue;
    let current = null;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i], name = String(r[0] ?? "").trim(), key = dishKey(name);
      if (primary) {
        if (["total", "tong", "tong cong"].includes(key)) {
          current = null;
          continue;
        }
        if (name && (r[1] === null || r[1] === void 0 || r[1] === "") && (r[2] === null || r[2] === void 0 || r[2] === "") && (!current || rows[i - 1].every((v) => v === null || v === void 0 || v === ""))) {
          current = { id: `${normalize(source)}:${key}`, name, source, lines: [] };
          if (seen.has(key)) {
            current = null;
            continue;
          }
          seen.add(key);
          result.push(current);
          continue;
        }
        if (current && name) current.lines.push({ id: `${current.id}-${i}`, kind: "ingredient", name, quantity: Number.isFinite(number(r[1])) ? number(r[1]) : null, rawQuantity: String(r[1] ?? ""), unit: String(r[2] ?? "").trim() });
      } else {
        if (name) {
          if (seen.has(key)) {
            current = null;
            continue;
          }
          seen.add(key);
          current = { id: `${normalize(source)}:${key}`, name, source, lines: [] };
          result.push(current);
        }
        if (current && r[1]) current.lines.push({ id: `${current.id}-${i}`, kind: "ingredient", name: String(r[1]).trim(), quantity: Number.isFinite(number(r[2])) ? number(r[2]) : null, rawQuantity: String(r[2] ?? ""), unit: String(r[3] ?? "").trim() });
      }
    }
  }
  if (!result.length) throw Error("Không tìm thấy sheet Cost t10-2026 hoặc DS tất cả các món.");
  for (const recipe of result) if (normalize(recipe.source) === "cost t10-2026" && dishKey(recipe.name) === "lau tiem sa chuy 4 nguoi") {
    for (const line of recipe.lines) if (normalize(line.name) === "bap bo" && line.quantity === 100) {
      line.importedQuantity = line.quantity;
      line.quantity = 120;
      line.note = "Người dùng xác nhận 120 g bắp bò chưa sơ chế/phần; ưu tiên chỉnh sửa này.";
    }
  }
  return result;
}
function buildReport(input) {
  const { stock = [], sales = [], recipes = [], rules = {}, saleRules = {}, stockRules = {}, counts = {}, batches = [], adjustments = [], from, to } = input;
  const problems = [], details = [], skipped = [], outside = [], recipeMap = new Map(recipes.map((r) => [r.id, r]));
  if (!from || !to || from > to) problems.push("Khoảng ngày không hợp lệ.");
  const rows = stock.map((s) => {
    const period = s.moves.filter((m) => m.date >= from && m.date <= to), prior = s.moves.filter((m) => m.date < from);
    const dates = s.moves.map((m) => m.date).sort();
    if (dates.length && (from < dates[0] || to > dates[dates.length - 1])) problems.push(`${s.name}: file kho chưa bao phủ đủ kỳ PDF.`);
    const sum = (items, k) => items.reduce((a, m) => a + Number(m[k] || 0), 0);
    const adj = adjustments.filter((a) => a.stockName === s.name && a.date >= from && a.date <= to);
    for (const a of adj) if (!a.reason?.trim() || !Number.isFinite(number(a.quantity)) || !["warehouse", "kitchen"].includes(a.location)) problems.push(`${s.name}: điều chỉnh cần vị trí, số lượng và lý do.`);
    const priorAdj = adjustments.filter((a) => a.stockName === s.name && a.location === "warehouse" && a.date < from);
    const warehouseOpening = s.opening + sum(prior, "received") - sum(prior, "issued") + sum(priorAdj, "quantity");
    const received = sum(period, "received"), issued = sum(period, "issued");
    const warehouseAdjustment = sum(adj.filter((a) => a.location === "warehouse"), "quantity");
    const kitchenAdjustment = sum(adj.filter((a) => a.location === "kitchen"), "quantity");
    const rule = stockRules[s.name] || {}, yieldRatio = number(rule.yield), count = counts[s.name] || {}, baseStage = rule.baseStage || "raw";
    const measured = batches.filter((b) => b.stockName === s.name && b.date >= from && b.date <= to);
    for (const b of measured) if (!(number(b.input) > 0 && number(b.output) > 0 && number(b.output) <= number(b.input))) problems.push(`${s.name}: mẻ sơ chế cần 0 < đầu ra ≤ đầu vào (cùng ĐVT kho).`);
    const batchInput = sum(measured, "input"), batchOutput = sum(measured, "output");
    if (!rule.confirmed) problems.push(`${s.name}: xác nhận cấu hình nguyên liệu kho.`);
    const hasCounts = ["rawOpen", "rawClose", "preparedOpen", "preparedClose"].every((k) => count[k] !== "" && count[k] !== null && count[k] !== void 0 && Number.isFinite(number(count[k])));
    if (Object.values(count).some((v) => v !== "" && v !== null && v !== void 0 && (!Number.isFinite(number(v)) || number(v) < 0))) problems.push(`${s.name}: tồn bếp phải là số không âm.`);
    const needsYield = (baseStage === "raw" ? number(count.preparedOpen) > 0 || number(count.preparedClose) > 0 : number(count.rawOpen) > 0 || number(count.rawClose) > 0) || measured.length > 0;
    if (needsYield && !(yieldRatio > 0 && yieldRatio <= 1)) problems.push(`${s.name}: thiếu tỷ lệ thu hồi chuẩn trong (0, 100%].`);
    const processingVariance = measured.length && yieldRatio > 0 ? baseStage === "raw" ? batchInput - batchOutput / yieldRatio : batchInput * yieldRatio - batchOutput : 0;
    const equivalent = (raw, prepared) => baseStage === "raw" ? raw + prepared / (yieldRatio || 1) : raw * (yieldRatio || 1) + prepared;
    const actual = hasCounts && (!needsYield || yieldRatio > 0) ? equivalent(number(count.rawOpen), number(count.preparedOpen)) + issued + kitchenAdjustment - equivalent(number(count.rawClose), number(count.preparedClose)) : null;
    return { ...s, baseStage, warehouseOpening, received, issued, warehouseAdjustment, kitchenAdjustment, warehouseClosing: warehouseOpening + received - issued + warehouseAdjustment, theoretical: 0, actual, variance: null, processingVariance, batchInput, batchOutput, yieldRatio: Number.isFinite(yieldRatio) ? yieldRatio : null, estimated: needsYield, count, adjustments: adj };
  });
  const byName = new Map(rows.map((r) => [r.name, r]));
  let budget = 50000;
  function expand(recipeId, multiplier, sale, path = []) {
    if (--budget < 0 || path.length > 20) { problems.push("Combo quá lớn; cần giảm số dòng hoặc tầng thành phần."); return; }
    if (path.includes(recipeId)) {
      problems.push(`Vòng lặp combo: ${[...path, recipeId].join(" → ")}`);
      return;
    }
    const recipe = recipeMap.get(recipeId);
    if (!recipe) {
      problems.push(`${sale.name}: chưa chọn công thức.`);
      return;
    }
    if (!recipe.lines?.length) {
      problems.push(`${recipe.name}: công thức rỗng.`);
      return;
    }
    for (const line of recipe.lines) {
      if (line.kind === "recipe") {
        if (!(number(line.quantity) > 0)) {
          problems.push(`${recipe.name}: số phần món con không hợp lệ.`);
          continue;
        }
        expand(line.recipeId, multiplier * number(line.quantity), sale, [...path, recipeId]);
        continue;
      }
      const rule = rules[normalize(line.name)];
      if (rule?.excluded) {
        if (!rule.reason?.trim()) problems.push(`${line.name}: cần lý do loại khỏi phạm vi.`);
        else outside.push({ name: line.name, reason: rule.reason });
        continue;
      }
      const target = byName.get(rule?.stockName);
      if (!target) {
        problems.push(`${line.name}: chưa ghép nguyên liệu kho hoặc xác nhận loại ngoài phạm vi.`);
        continue;
      }
      if (!["raw", "prepared"].includes(rule.stage)) {
        problems.push(`${line.name}: chưa xác nhận trước/sau sơ chế.`);
        continue;
      }
      const quantity = number(line.quantity);
      if (!(quantity > 0)) {
        problems.push(`${recipe.name} / ${line.name}: thiếu định lượng hợp lệ.`);
        continue;
      }
      const factor = conversion(line.unit, target.unit) ?? number(rule.factors?.[unitKey(line.unit)]);
      if (!(factor > 0)) {
        problems.push(`${line.name}: thiếu hệ số quy đổi ${line.unit} → ${target.unit}.`);
        continue;
      }
      const crossesStage = rule.stage !== target.baseStage;
      if (crossesStage && !(target.yieldRatio > 0 && target.yieldRatio <= 1)) {
        problems.push(`${line.name}: thiếu tỷ lệ thu hồi sơ chế.`);
        continue;
      }
      const stageFactor = !crossesStage ? 1 : rule.stage === "prepared" ? 1 / target.yieldRatio : target.yieldRatio;
      const total = multiplier * quantity * factor * stageFactor;
      target.theoretical += total;
      target.estimated ||= crossesStage;
      details.push({ stockName: target.name, code: sale.code, saleName: sale.name, sold: sale.quantity, recipeName: recipe.name, source: recipe.source, ingredient: line.name, quantity, unit: line.unit, portions: multiplier, stage: rule.stage, factor, yieldRatio: crossesStage ? target.yieldRatio : 1, stageFactor, total });
    }
  }
  for (const sale of sales) {
    if (!Number.isFinite(sale.quantity) || sale.quantity < 0) {
      problems.push(`${sale.name}: số lượng bán không hợp lệ.`);
      continue;
    }
    const rule = saleRules[sale.code];
    if (rule?.confirmed === false) problems.push(`${sale.name}: cần xác nhận ghép món gợi ý.`);
    if (rule?.skip) {
      if (!rule.reason?.trim()) problems.push(`${sale.name}: cần lý do bỏ qua.`);
      skipped.push({ ...sale, reason: rule.reason });
      continue;
    }
    expand(rule?.recipeId, sale.quantity, sale);
  }
  for (const row of rows) {
    row.theoretical = Math.round(row.theoretical * 1e9) / 1e9;
    row.variance = row.actual === null ? null : row.actual - row.theoretical;
    row.details = details.filter((d) => d.stockName === row.name);
  }
  return { rows, skipped, outside: [...new Map(outside.map((x) => [x.name, x])).values()], problems: [...new Set(problems)], from, to, warnings: ["Chênh lệch chưa giải thích có thể gồm sử dụng ngoài bán hàng; không kết luận thất thoát.", "Tồn kho không phải tồn tại bếp. Tồn đã sơ chế quy đổi theo tỷ lệ chuẩn; sai lệch mẻ cân được trình bày riêng."] };
}
export {
  buildReport,
  conversion,
  dateKey,
  dishKey,
  movements,
  normalize,
  number,
  parseRecipes,
  parseStock,
  unitKey
};
