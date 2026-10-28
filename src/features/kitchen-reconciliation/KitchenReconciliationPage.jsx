import { useEffect, useMemo, useState } from "react";
import { Download, Upload, Save, CheckCircle2, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { apiRequest } from "@/lib/api";
import { buildReport, normalize, dishKey, unitKey, conversion } from "./domain.mjs";
import { readWorkbook, importStock, importRecipes, importCounts, readSalesPdf } from "./imports.mjs";
import { downloadReport, downloadCountTemplate } from "./excel.mjs";
const endpoint = "/kitchen-reconciliation.php";
const initial = () => ({ from: "", to: "", stock: [], sales: [], recipes: [], rules: {}, saleRules: {}, stockRules: {}, counts: {}, batches: [], adjustments: [], sources: {}, salesPeriod: null });
const qty = (v) => v === null || v === void 0 ? "Chưa đủ dữ liệu" : Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
const inputClass = "min-h-10 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:bg-slate-100";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
function Num({ value, onChange, label, ...props }) {
  return <input aria-label={label} className={inputClass} type="number" step="any" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} {...props} />;
}
function Select({ value, onChange, label, children }) {
  return <select aria-label={label} className={inputClass} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{children}</select>;
}
function Table({ headers, children }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{headers.map((h) => <th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top">{children}</tbody></table></div>;
}
function Section({ title, description, children }) {
  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="font-bold text-emerald-950">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{children}</section>;
}
function KitchenReconciliationPage() {
  const { storeId } = useStore();
  if (storeId !== "restaurant") return <main className="p-6"><h1 className="text-2xl font-bold text-emerald-950">Đối soát nguyên liệu</h1><p className="mt-3 text-slate-600">Module chỉ có trong mô hình Lẩu/Bếp. Hãy chuyển sang Lẩu/Bếp để sử dụng.</p></main>;
  return <Workspace />;
}
function Workspace() {
  const [data, setData] = useState(initial), [tab, setTab] = useState("files"), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState(""), [history, setHistory] = useState([]), [versions, setVersions] = useState([]), [snapshot, setSnapshot] = useState(null), [parentId, setParentId] = useState(null), [selectedRecipe, setSelectedRecipe] = useState(""), [stockSheets, setStockSheets] = useState([]), [stockSheet, setStockSheet] = useState(""), [stockFile, setStockFile] = useState(null);
  const report = useMemo(() => buildReport(data), [data]);
  const locked = Boolean(snapshot);
  const update = (patch) => {
    if (!locked) setData((d) => ({ ...d, ...typeof patch === "function" ? patch(d) : patch }));
  };
  const patchRule = (name, patch) => update((d) => ({ rules: { ...d.rules, [normalize(name)]: { ...d.rules[normalize(name)], ...patch } } }));
  const patchStock = (name, patch) => update((d) => ({ stockRules: { ...d.stockRules, [name]: { ...d.stockRules[name], ...patch } } }));
  const patchSale = (code, patch) => update((d) => ({ saleRules: { ...d.saleRules, [code]: { ...d.saleRules[code], ...patch } } }));
  const patchCount = (name, key, value) => update((d) => ({ counts: { ...d.counts, [name]: { ...d.counts[name], [key]: value } } }));
  const call = (action, options = {}) => apiRequest(endpoint, { method: "POST", body: JSON.stringify({ storeId: "restaurant", action, ...options }), timeoutMs: 3e4 });
  const refreshVersions = () => apiRequest(`${endpoint}?storeId=restaurant&action=versions`).then((r) => setVersions(r.items));
  const refreshHistory = () => apiRequest(`${endpoint}?storeId=restaurant&action=list`).then((r) => setHistory(r.items));
  useEffect(() => {
    let active = true;
    Promise.all([apiRequest(`${endpoint}?storeId=restaurant&action=config`), apiRequest(`${endpoint}?storeId=restaurant&action=list`), apiRequest(`${endpoint}?storeId=restaurant&action=versions`)]).then(([c, h, v]) => {
      if (!active) return;
      if (c.config) setData((d) => ({ ...d, ...c.config, sources: c.config.recipeSource ? { recipe: c.config.recipeSource } : {} }));
      setHistory(h.items);
      setVersions(v.items);
    }).catch((e) => {
      if (active) setError(e.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);
  async function run(task) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function source(file, buffer) {
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return { name: file.name, sha256: Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("") };
  }
  async function loadFile(kind, file, sheet) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) throw Error("File quá 20 MB.");
    if (!new RegExp(kind === "sales" ? "\\.pdf$" : "\\.xlsx?$|\\.xlsm$", "i").test(file.name)) throw Error("Định dạng file không phù hợp.");
    const buffer = await file.arrayBuffer(), src = await source(file, buffer);
    if (kind === "stock") {
      const sheets = Object.keys(readWorkbook(buffer, true));
      if (sheets.length > 1 && !sheet) {
        setStockSheets(sheets);
        setStockFile(file);
        setStockSheet(sheets[0]);
        setNotice("Chọn sheet kho và bấm Đọc sheet kho.");
        return;
      }
      const imported = importStock(buffer, sheet);
      update((d) => ({ stock: imported.stock, counts: {}, batches: [], adjustments: [], sources: { ...d.sources, counts: void 0, stock: { ...src, sheet: imported.sheet } } }));
      setStockSheets([]);
    } else if (kind === "recipe") {
      const recipes = importRecipes(buffer);
      update((d) => ({ recipes, sources: { ...d.sources, recipe: src } }));
      setSelectedRecipe(recipes[0]?.id || "");
    } else if (kind === "sales") {
      const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
      pdf.GlobalWorkerOptions.workerSrc = worker.default;
      const parsed = await readSalesPdf(buffer, pdf.getDocument);
      if (!parsed.from || !parsed.to) throw Error("Không đọc được kỳ báo cáo trong PDF.");
      update((d) => ({ sales: parsed.sales, from: parsed.from, to: parsed.to, ...d.from && (d.from !== parsed.from || d.to !== parsed.to) ? { counts: {}, batches: [], adjustments: [] } : {}, salesPeriod: { from: parsed.from, to: parsed.to, total: parsed.total }, sources: { ...d.sources, sales: src } }));
    } else update((d) => ({ counts: { ...d.counts, ...importCounts(buffer, d.stock) }, sources: { ...d.sources, counts: src } }));
    setNotice(`Đã đọc ${file.name}. Kiểm tra các dữ liệu trước khi chốt.`);
  }
  useEffect(() => {
    if (locked) return;
    setData((d) => {
      let changed = false;
      const saleRules = { ...d.saleRules }, rules = { ...d.rules };
      for (const s of d.sales) if (!saleRules[s.code]) {
        const r = d.recipes.find((r2) => dishKey(r2.name) === dishKey(s.name));
        if (r) {
          saleRules[s.code] = { recipeId: r.id, confirmed: false };
          changed = true;
        }
      }
      for (const r of d.recipes) for (const l of r.lines) {
        if (l.kind === "recipe" || rules[normalize(l.name)]) continue;
        const match = d.stock.find((s) => normalize(s.name) === normalize(l.name));
        if (match) {
          rules[normalize(l.name)] = { stockName: match.name, stage: "" };
          changed = true;
        }
      }
      return changed ? { ...d, saleRules, rules } : d;
    });
  }, [data.recipes, data.sales, data.stock, locked]);
  const recipe = data.recipes.find((r) => r.id === selectedRecipe) || data.recipes[0];
  const ingredients = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const r of data.recipes) for (const l of r.lines) if (l.kind !== "recipe") {
      const key = normalize(l.name);
      if (!map.has(key)) map.set(key, { name: l.name, units: /* @__PURE__ */ new Set() });
      map.get(key).units.add(l.unit || "");
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [data.recipes]);
  const amendRecipe = (lines) => update((d) => ({ recipes: d.recipes.map((r) => r.id === recipe.id ? { ...r, lines } : r) }));
  const changeLine = (index, patch) => amendRecipe(recipe.lines.map((l, i) => i === index ? { ...l, ...patch } : l));
  const ready = data.stock.length > 0 && data.sales.length > 0 && data.recipes.length > 0 && report.problems.length === 0;
  const currentSnapshot = snapshot || { id: null, input: data, report };
  async function saveConfig() {
    const saved = await call("config", { config: { recipes: data.recipes, rules: data.rules, saleRules: data.saleRules, stockRules: data.stockRules, recipeSource: data.sources.recipe } });
    update({ versionId: saved.versionId });
    await refreshVersions();
    setNotice("Đã lưu phiên bản cấu hình và công thức dùng cho các kỳ sau.");
  }
  async function loadVersion(id) {
    if (!id) return;
    const r = await apiRequest(`${endpoint}?storeId=restaurant&action=version&id=${encodeURIComponent(id)}`);
    update((d) => ({ ...r.config, sources: { ...d.sources, recipe: r.config.recipeSource } }));
    setNotice("Đã nạp phiên bản công thức. Kiểm tra lại ánh xạ trước khi chốt.");
  }
  async function finalize() {
    const r = await call("finalize", { input: data, parentId });
    setSnapshot(r.snapshot);
    setData(r.snapshot.input);
    await refreshHistory();
    setNotice("Đã chốt phiên bản bất biến. Có thể xuất Excel hoặc tạo phiên bản mới.");
  }
  async function openSaved(id) {
    const r = await apiRequest(`${endpoint}?storeId=restaurant&action=get&id=${encodeURIComponent(id)}`);
    setData(r.snapshot.input);
    setSnapshot(r.snapshot);
    setParentId(r.snapshot.id);
    setTab("report");
  }
  if (loading) return <main className="p-6" aria-busy="true">Đang tải cấu hình đối soát Lẩu…</main>;
  return <main className="min-h-full bg-slate-50 p-4 text-slate-900 sm:p-6"><div className="mx-auto max-w-7xl space-y-5"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Lẩu / Bếp</p><h1 className="mt-1 text-3xl font-bold text-emerald-950">Đối soát nguyên liệu</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Từ số lượng món bán đến định mức nguyên liệu, lượng cấp bếp và kiểm kê thực tế. Không làm thay đổi tồn kho trong hệ thống.</p></div><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={busy || !data.recipes.length || locked} onClick={() => run(saveConfig)}><Save size={16} />Lưu cấu hình</button><button className={buttonClass} disabled={busy || !ready} onClick={() => run(() => downloadReport(currentSnapshot))}><Download size={16} />Xuất Excel{locked ? "" : " xem trước"}</button><button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy || locked || !ready} onClick={() => run(finalize)}><CheckCircle2 size={17} />Chốt báo cáo</button></div></header>{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}{notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}{locked && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><span>Đã chốt {snapshot.createdAt} · {snapshot.createdBy}. Các thay đổi cấu hình mới không tác động phiên bản này.</span><button className={buttonClass} onClick={() => {
    setParentId(snapshot.id);
    setSnapshot(null);
    setNotice("Đang tạo phiên bản mới từ báo cáo gốc.");
  }}>Tạo phiên bản mới</button></div>}<nav aria-label="Các bước đối soát" className="flex flex-wrap gap-1 border-b border-slate-200">{[["files", "1. File nguồn"], ["mapping", "2. Công thức & quy đổi"], ["inventory", "3. Kiểm kê & sơ chế"], ["report", "4. Báo cáo & lịch sử"]].map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? "step" : void 0} onClick={() => setTab(id)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === id ? "border-emerald-700 text-emerald-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}</button>)}</nav>{tab === "files" && <><Section title="File đầu vào" description="Công thức lưu dùng lại. Mỗi kỳ tải PDF bán hàng và Excel nhập–xuất. File gốc không bị sửa."><div className="grid gap-4 p-4 md:grid-cols-3">{[["recipe", "Công thức định lượng", "Ưu tiên Cost t10-2026, thiếu món mới tra DS tất cả các món.", ".xlsx,.xlsm"], ["stock", "Nhập–xuất kho", "Đọc tồn đầu, ngày nhập/cấp bếp; giữ riêng hai luồng trong =a-b.", ".xlsx,.xlsm"], ["sales", "Báo cáo bán hàng", "PDF dạng chữ, có mã SP và cột SL bán. Không hỗ trợ bản scan.", ".pdf"]].map(([kind, title, help, accept]) => <label key={kind} className="block rounded-md border border-slate-200 p-4"><span className="flex items-center gap-2 font-semibold"><Upload size={16} />{title}</span><span className="my-2 block min-h-12 text-xs leading-5 text-slate-500">{help}</span><input type="file" aria-label={title} accept={accept} disabled={busy || locked} className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-900" onChange={(e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    run(() => loadFile(kind, f));
  }} /><span className="mt-2 block break-all text-xs text-slate-500">{data.sources[kind]?.name || "Chưa có file"}</span></label>)}</div>{stockSheets.length > 0 && <div className="flex gap-3 px-4 pb-4"><Select value={stockSheet} label="Sheet kho" onChange={setStockSheet}>{stockSheets.map((n) => <option key={n}>{n}</option>)}</Select><button className={buttonClass} disabled={busy} onClick={() => run(() => loadFile("stock", stockFile, stockSheet))}>Đọc sheet kho</button></div>}<div className="flex flex-wrap gap-6 border-t border-slate-100 p-4 text-sm"><span><b>{data.recipes.length}</b> công thức</span><span><b>{data.stock.length}</b> nguyên liệu kho</span><span><b>{data.sales.length}</b> mặt hàng bán</span><span><b>{qty(data.sales.reduce((a, s) => a + s.quantity, 0))}</b> tổng SL bán</span><span>Kỳ PDF: <b>{data.from || "—"} → {data.to || "—"}</b></span></div></Section><Section title="Nguyên liệu kho" description="Tồn kho cuối kỳ tính đến ngày kết thúc PDF, không lấy tồn cuối cả tháng. Số liệu kho không thay thế tồn tại bếp."><Table headers={["Nguyên liệu", "ĐVT", "Tồn đầu kỳ báo cáo", "Nhập kho", "Cấp bếp", "Tồn cuối kỳ báo cáo", "Dòng nguồn"]}>{report.rows.map((r) => <tr key={r.name}><td className="font-semibold">{r.name}</td><td>{r.unit}</td><td>{qty(r.warehouseOpening)}</td><td>{qty(r.received)}</td><td>{qty(r.issued)}</td><td>{qty(r.warehouseClosing)}</td><td>{(r.sourceRows || []).join(", ")}{r.sourceRows?.length > 1 && <span className="block text-xs text-amber-800">Đã gộp dòng trùng cùng tên/ĐVT; cần xác nhận ở bước 3.</span>}</td></tr>)}</Table></Section></>}{tab === "mapping" && <fieldset disabled={locked || busy} className="space-y-5"><div className="rounded-lg border border-slate-200 bg-white p-4"><label className="text-sm font-semibold">Nạp phiên bản cấu hình đã lưu<Select label="Phiên bản công thức" value="" onChange={(id) => run(() => loadVersion(id))}><option value="">Chọn phiên bản…</option>{versions.map((v) => <option key={v.id} value={v.id}>{new Date(v.updatedAt).toLocaleString("vi-VN")} · {v.source}</option>)}</Select></label><p className="mt-2 text-xs text-slate-500">Bản hiện tại: {data.versionId || "Chưa lưu phiên bản mới"}. Báo cáo đã chốt luôn giữ công thức riêng.</p></div><Section title="Ghép món bán với công thức" description="Ghép theo mã SP được lưu cho kỳ sau. Kiểm tra cả món combo; món bỏ qua cần lý do."><Table headers={["Mã / món bán", "SL bán", "Công thức sử dụng", "Xử lý"]}>{data.sales.map((s) => {
    const rule = data.saleRules[s.code] || {};
    return <tr key={s.code}><td><b>{s.code}</b><span className="block">{s.name}</span></td><td>{qty(s.quantity)}</td><td><Select label={`Công thức ${s.code}`} value={rule.skip ? "__skip" : rule.recipeId} onChange={(v) => patchSale(s.code, v === "__skip" ? { skip: true, recipeId: "", confirmed: true } : { skip: false, recipeId: v, confirmed: true })}><option value="">Chọn công thức…</option><option value="__skip">Bỏ qua có xác nhận</option>{data.recipes.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.source}</option>)}</Select></td><td>{rule.skip ? <input aria-label={`Lý do bỏ ${s.code}`} placeholder="Lý do bỏ qua" className={inputClass} value={rule.reason || ""} onChange={(e) => patchSale(s.code, { reason: e.target.value })} /> : rule.confirmed === false ? <button className={buttonClass} onClick={() => patchSale(s.code, { confirmed: true })}>Xác nhận gợi ý</button> : rule.recipeId ? <span className="text-emerald-800">Đã ghép</span> : "Chưa ghép"}</td></tr>;
  })}</Table></Section><Section title="Công thức và combo" description="Mỗi dòng chọn nguyên liệu trực tiếp hoặc món thành phần. Không nhập lại cùng thành phần theo cả hai cách. Chỉnh sửa sẽ lưu khi bấm Lưu cấu hình."><div className="flex flex-wrap gap-3 p-4"><div className="min-w-64 flex-1"><Select label="Công thức đang sửa" value={recipe?.id} onChange={setSelectedRecipe}>{data.recipes.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.source}</option>)}</Select></div><button className={buttonClass} onClick={() => {
    const id = "manual-" + crypto.randomUUID();
    update((d) => ({ recipes: [...d.recipes, { id, name: "Món / combo mới", source: "Nhập tay", lines: [] }] }));
    setSelectedRecipe(id);
  }}><Plus size={16} />Thêm công thức</button></div>{recipe && <><div className="px-4 pb-4"><label className="text-xs text-slate-600">Tên công thức<input className={inputClass} value={recipe.name} onChange={(e) => update((d) => ({ recipes: d.recipes.map((r) => r.id === recipe.id ? { ...r, name: e.target.value } : r) }))} /></label></div><Table headers={["Kiểu dòng", "Nguyên liệu / món thành phần", "Định lượng / số phần", "ĐVT", "Ghi chú chỉnh sửa", "Xóa"]}>{recipe.lines.map((l, i) => <tr key={i}><td><Select label={`Kiểu dòng ${i + 1}`} value={l.kind || "ingredient"} onChange={(v) => changeLine(i, { kind: v })}><option value="ingredient">Nguyên liệu</option><option value="recipe">Món thành phần</option></Select></td><td>{l.kind === "recipe" ? <Select label={`Món con ${i + 1}`} value={l.recipeId} onChange={(v) => changeLine(i, { recipeId: v })}><option value="">Chọn món…</option>{data.recipes.filter((r) => r.id !== recipe.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select> : <input aria-label={`Nguyên liệu dòng ${i + 1}`} className={inputClass} value={l.name || ""} onChange={(e) => changeLine(i, { name: e.target.value })} />}</td><td><Num label={`Định lượng dòng ${i + 1}`} value={l.quantity} min="0" onChange={(v) => changeLine(i, { quantity: v, note: l.note || "Chỉnh định lượng trên module" })} />{l.rawQuantity && l.quantity === null && <span className="text-xs text-amber-800">Nguồn: {l.rawQuantity}</span>}</td><td>{l.kind === "recipe" ? "phần" : <input aria-label={`Đơn vị dòng ${i + 1}`} className={inputClass} value={l.unit || ""} onChange={(e) => changeLine(i, { unit: e.target.value })} />}</td><td><input aria-label={`Ghi chú dòng ${i + 1}`} className={inputClass} value={l.note || ""} onChange={(e) => changeLine(i, { note: e.target.value })} /></td><td><button className={buttonClass} aria-label={`Xóa dòng ${i + 1}`} onClick={() => amendRecipe(recipe.lines.filter((_, index) => i !== index))}><Trash2 size={15} /></button></td></tr>)}</Table><button className={`${buttonClass} m-4`} onClick={() => amendRecipe([...recipe.lines, { id: crypto.randomUUID(), kind: "ingredient", name: "", quantity: null, unit: "" }])}><Plus size={16} />Thêm dòng</button></>}</Section><Section title="Ghép nguyên liệu và hệ số quy đổi" description="Chỉ đối soát nguyên liệu trong file kho. 1 ĐVT Cost = hệ số × ĐVT kho; g → kg tự quy đổi 0,001. Viên/con/bịch cần hệ số riêng. Xác nhận trước/sau sơ chế theo định lượng Cost."><Table headers={["Tên trong công thức", "Nguyên liệu kho / phạm vi", "Trạng thái Cost", "Hệ số quy đổi hoặc lý do loại"]}>{ingredients.map((item) => {
    const rule = data.rules[normalize(item.name)] || {}, target = data.stock.find((s) => s.name === rule.stockName);
    return <tr key={normalize(item.name)}><td className="font-semibold">{item.name}</td><td><Select label={`Ghép ${item.name}`} value={rule.excluded ? "__excluded" : rule.stockName} onChange={(v) => patchRule(item.name, v === "__excluded" ? { excluded: true, stockName: "" } : { excluded: false, stockName: v })}><option value="">Chưa ghép…</option><option value="__excluded">Ngoài phạm vi theo dõi</option>{data.stock.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.unit})</option>)}</Select></td><td>{!rule.excluded && <Select label={`Trạng thái ${item.name}`} value={rule.stage} onChange={(v) => patchRule(item.name, { stage: v })}><option value="">Cần xác nhận…</option><option value="raw">Trước sơ chế</option><option value="prepared">Sau sơ chế</option></Select>}</td><td>{rule.excluded ? <input aria-label={`Lý do loại ${item.name}`} className={inputClass} value={rule.reason || ""} placeholder="Lý do ngoài phạm vi" onChange={(e) => patchRule(item.name, { reason: e.target.value })} /> : target && [...item.units].map((u) => {
      const factor = conversion(u, target.unit);
      return <label key={u} className="mb-2 block text-xs">1 {u || "(thiếu ĐVT)"} = {factor !== null ? <b>{factor} {target.unit}</b> : <><Num label={`Quy đổi ${item.name} ${u}`} min="0" value={rule.factors?.[unitKey(u)]} onChange={(v) => patchRule(item.name, { factors: { ...rule.factors, [unitKey(u)]: v } })} />{target.unit}</>}</label>;
    })}</td></tr>;
  })}</Table></Section></fieldset>}{tab === "inventory" && <fieldset disabled={locked || busy} className="space-y-5"><Section title="Kiểm kê tại bếp và tỷ lệ thu hồi" description="Tất cả lượng kiểm kê, mẻ sơ chế và điều chỉnh bếp nhập theo ĐVT kho. Để trống nếu chưa có kiểm kê; 0 nghĩa là đã kiểm đếm và không còn. Tồn đã sơ chế quy về lượng trước sơ chế tương đương theo tỷ lệ chuẩn."><div className="flex flex-wrap items-center gap-3 p-4"><button className={buttonClass} disabled={!data.stock.length} onClick={() => run(() => downloadCountTemplate(data.stock))}><Download size={16} />Tải mẫu kiểm kê</button><label className="text-sm">Import kiểm kê <input type="file" accept=".xlsx" aria-label="Import kiểm kê bếp" onChange={(e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    run(() => loadFile("counts", f));
  }} /></label></div><Table headers={["Nguyên liệu / ĐVT", "Thu hồi chuẩn (%)", "Đầu: chưa sơ chế", "Cuối: chưa sơ chế", "Đầu: đã sơ chế", "Cuối: đã sơ chế", "Xác nhận kho"]}>{data.stock.map((s) => {
    const rule = data.stockRules[s.name] || {}, c = data.counts[s.name] || {};
    return <tr key={s.name}><td className="font-semibold">{s.name}<span className="block text-xs text-slate-500">{s.unit}</span><Select label={`Trạng thái kho ${s.name}`} value={rule.baseStage || "raw"} onChange={(v) => patchStock(s.name, { baseStage: v, confirmed: false })}><option value="raw">Kho: chưa sơ chế</option><option value="prepared">Kho: đã sơ chế</option></Select></td><td><Num label={`Thu hồi ${s.name}`} min="0" max="100" value={rule.yield == null || rule.yield === "" ? null : Number(rule.yield) * 100} onChange={(v) => patchStock(s.name, { yield: v === null ? null : v / 100 })} /></td>{["rawOpen", "rawClose", "preparedOpen", "preparedClose"].map((k) => <td key={k}><Num min="0" label={`${s.name} ${k}`} value={c[k]} onChange={(v) => patchCount(s.name, k, v)} /></td>)}<td><label className="flex items-start gap-2"><input type="checkbox" checked={rule.confirmed === true} onChange={(e) => patchStock(s.name, { confirmed: e.target.checked })} /><span className="text-xs">Đã kiểm tra tên, ĐVT{s.sourceRows?.length > 1 ? " và dòng gộp" : ""}</span></label></td></tr>;
  })}</Table></Section><MovementEditor title="Mẻ sơ chế có cân thực tế" description="Ghi nhận đầu vào và thành phẩm cùng ĐVT kho. Dùng số cân để tách sai lệch sơ chế so với tỷ lệ chuẩn; phần không cân và quy đổi tồn vẫn ghi rõ ước tính." kind="batch" rows={data.batches} stock={data.stock} from={data.from} onChange={(batches) => update({ batches })} /><MovementEditor title="Điều chỉnh kho / bếp" description="Lượng tăng ghi dương, giảm ghi âm, theo ĐVT kho. Nhập riêng ngày, vị trí, lý do. Không tự đọc các khoản cộng bù ở cột tồn cuối tháng để tránh áp dụng sai kỳ." kind="adjustment" rows={data.adjustments} stock={data.stock} from={data.from} onChange={(adjustments) => update({ adjustments })} /></fieldset>}{tab === "report" && <>{report.problems.length > 0 && <Section title={`${report.problems.length} điểm cần xử lý trước khi chốt`} description="Các dòng chưa ghép, chưa xác nhận hoặc thiếu quy đổi sẽ chặn chốt và xuất Excel."><ul className="max-h-64 list-disc space-y-1 overflow-y-auto py-4 pl-9 pr-4 text-sm text-amber-900">{report.problems.map((p) => <li key={p}>{p}</li>)}</ul></Section>}<Section title={`Đối soát ${data.from || "…"} – ${data.to || "…"}`} description="Chênh lệch = sử dụng thực tế − định mức, cùng ĐVT nguyên liệu kho. Số dương: sử dụng nhiều hơn định mức. Không bao gồm ghi nhận riêng dùng ngoài bán hàng nên không kết luận thất thoát."><Table headers={["Nguyên liệu", "ĐVT", "Cấp bếp", "Định mức", "Sử dụng thực tế", "Chênh lệch chưa giải thích", "Sai lệch sơ chế mẻ cân", "Trạng thái"]}>{(snapshot?.report || report).rows.map((r) => <tr key={r.name}><td className="font-semibold">{r.name}</td><td>{r.unit}</td><td>{qty(r.issued)}</td><td>{qty(r.theoretical)}</td><td>{qty(r.actual)}</td><td>{qty(r.variance)}</td><td>{qty(r.processingVariance)}</td><td className="text-xs">{r.actual === null ? "Chỉ đối chiếu cấp bếp – định mức" : r.estimated ? "Có quy đổi ước tính" : "Đủ kiểm kê"}</td></tr>)}</Table></Section><Section title="Lịch sử báo cáo đã chốt" description="Mở lại để xuất đúng phiên bản cũ hoặc tạo phiên bản mới. Không ghi đè báo cáo đã chốt."><Table headers={["Kỳ báo cáo", "Ngày chốt", "Người chốt", "Phiên bản", "Thao tác"]}>{history.map((h) => <tr key={h.id}><td>{h.from} → {h.to}</td><td>{new Date(h.createdAt).toLocaleString("vi-VN")}</td><td>{h.createdBy}</td><td>{h.parentId ? "Bản chỉnh sửa" : "Bản đầu"}</td><td><button className={buttonClass} disabled={busy} onClick={() => run(() => openSaved(h.id))}>Mở báo cáo</button></td></tr>)}</Table>{!history.length && <p className="p-4 text-sm text-slate-500">Chưa có báo cáo đã chốt.</p>}</Section></>}<footer className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><FileSpreadsheet size={15} />{busy ? "Đang xử lý…" : `${report.problems.length} điểm cần xử lý · ${report.rows.filter((r) => r.actual === null).length} nguyên liệu chưa đủ kiểm kê bếp`}{!locked && <button className="ml-auto font-semibold text-emerald-800 underline" onClick={() => setTab("report")}>Xem các điểm cần xử lý</button>}</footer></div></main>;
}
function MovementEditor({ title, description, kind, rows, stock, from, onChange }) {
  const change = (i, p) => onChange(rows.map((r, n) => n === i ? { ...r, ...p } : r));
  return <Section title={title} description={description}><Table headers={kind === "batch" ? ["Ngày", "Nguyên liệu", "Đầu vào", "Đầu ra", "Xóa"] : ["Ngày", "Nguyên liệu", "Vị trí", "Số lượng (+/−)", "Lý do", "Xóa"]}>{rows.map((r, i) => <tr key={r.id || i}><td><input aria-label={`${title} ngày ${i + 1}`} className={inputClass} type="date" value={r.date} onChange={(e) => change(i, { date: e.target.value })} /></td><td><Select label={`${title} nguyên liệu ${i + 1}`} value={r.stockName} onChange={(v) => change(i, { stockName: v })}><option value="">Chọn nguyên liệu…</option>{stock.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.unit})</option>)}</Select></td>{kind === "batch" ? <><td><Num min="0" label={`Đầu vào mẻ ${i + 1}`} value={r.input} onChange={(v) => change(i, { input: v })} /></td><td><Num min="0" label={`Đầu ra mẻ ${i + 1}`} value={r.output} onChange={(v) => change(i, { output: v })} /></td></> : <><td><Select label={`Vị trí điều chỉnh ${i + 1}`} value={r.location} onChange={(v) => change(i, { location: v })}><option value="warehouse">Kho</option><option value="kitchen">Bếp (quy về NL kho)</option></Select></td><td><Num label={`SL điều chỉnh ${i + 1}`} value={r.quantity} onChange={(v) => change(i, { quantity: v })} /></td><td><input aria-label={`Lý do điều chỉnh ${i + 1}`} className={inputClass} value={r.reason || ""} onChange={(e) => change(i, { reason: e.target.value })} /></td></>}<td><button className={buttonClass} aria-label={`Xóa ${title} ${i + 1}`} onClick={() => onChange(rows.filter((_, n) => i !== n))}><Trash2 size={15} /></button></td></tr>)}</Table><button className={`${buttonClass} m-4`} onClick={() => onChange([...rows, { id: crypto.randomUUID(), date: from, stockName: "", ...kind === "batch" ? { input: null, output: null } : { location: "warehouse", quantity: null, reason: "" } }])}><Plus size={16} />Thêm dòng</button></Section>;
}
export {
  KitchenReconciliationPage as default
};
