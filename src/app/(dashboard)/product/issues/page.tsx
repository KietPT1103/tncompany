import { useEffect, useMemo, useState } from "react";
import { ClipboardList, PackageMinus, Plus, Save, Search, Trash2 } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { getIngredients, type Ingredient } from "@/services/ingredients";
import {
  deleteInventoryIssue,
  getInventoryIssues,
  saveInventoryIssue,
  type InventoryIssue,
} from "@/services/inventoryIssueService";

type DraftLine = { key: string; ingredientCode: string; quantity: string; note: string };
type FormState = {
  id?: string;
  issueCode?: string;
  issueDate: string;
  destination: string;
  issuedBy: string;
  note: string;
  items: DraftLine[];
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const key = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const line = (): DraftLine => ({ key: key(), ingredientCode: "", quantity: "", note: "" });
const number = (value: string) => Number(value.replace(",", ".")) || 0;
const quantity = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export default function InventoryIssuesPage() {
  const { storeId } = useStore();
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [issues, setIssues] = useState<InventoryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const actor = user?.displayName || user?.username || user?.email || "";
  const emptyForm = (): FormState => ({
    issueDate: today(), destination: "Quầy pha chế", issuedBy: actor,
    note: "", items: [line()],
  });
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!actor) return;
    setForm((current) => current.issuedBy ? current : { ...current, issuedBy: actor });
  }, [actor]);

  async function reload() {
    const [ingredientResult, issueResult] = await Promise.all([
      getIngredients(storeId), getInventoryIssues(storeId),
    ]);
    setIngredients(ingredientResult.items.filter((item) => item.isActive));
    setIssues(issueResult);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    reload().catch((reason) => setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu xuất kho."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const ingredientByCode = useMemo(
    () => new Map(ingredients.map((item) => [item.ingredientCode, item])),
    [ingredients],
  );
  const filteredIssues = useMemo(() => {
    const term = historySearch.trim().toLocaleLowerCase("vi");
    return term ? issues.filter((item) =>
      `${item.issueCode} ${item.destination} ${item.issuedBy}`.toLocaleLowerCase("vi").includes(term)
    ) : issues;
  }, [historySearch, issues]);
  const total = form.items.reduce((sum, item) => sum + number(item.quantity), 0);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function edit(issue: InventoryIssue) {
    if (issue.status !== "draft") return;
    setForm({
      id: issue.id, issueCode: issue.issueCode, issueDate: issue.issueDate,
      destination: issue.destination, issuedBy: issue.issuedBy, note: issue.note,
      items: issue.items.map((item) => ({ key: key(), ingredientCode: item.ingredientCode, quantity: String(item.quantity), note: item.note })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(status: "draft" | "completed") {
    const items = form.items
      .filter((item) => item.ingredientCode || item.quantity.trim())
      .map((item) => ({ ingredientCode: item.ingredientCode, quantity: number(item.quantity), note: item.note.trim() }));
    if (!form.issueDate || !form.destination.trim() || !form.issuedBy.trim() || items.length === 0) {
      setError("Vui lòng nhập ngày, nơi nhận, người xuất và ít nhất một dòng nguyên liệu.");
      return;
    }
    if (items.some((item) => !item.ingredientCode || item.quantity <= 0)) {
      setError("Mỗi dòng phải chọn nguyên liệu và có số lượng xuất lớn hơn 0.");
      return;
    }
    if (status === "completed" && !window.confirm("Hoàn thành phiếu sẽ trừ tồn kho ngay và không thể sửa. Tiếp tục?")) return;
    setSaving(true);
    setError("");
    try {
      await saveInventoryIssue({
        id: form.id, storeId, issueDate: form.issueDate, destination: form.destination.trim(),
        issuedBy: form.issuedBy.trim(), note: form.note.trim(), status, items,
      });
      await reload();
      setForm(emptyForm());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu phiếu xuất kho.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(issue: InventoryIssue) {
    if (!window.confirm(`Xóa phiếu nháp ${issue.issueCode}?`)) return;
    try {
      await deleteInventoryIssue(issue.id, storeId);
      if (form.id === issue.id) setForm(emptyForm());
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa phiếu.");
    }
  }

  return <div className="min-h-screen bg-slate-50 p-4 text-slate-950 sm:p-6 2xl:p-8">
    <div className="mx-auto max-w-[1680px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-sm font-bold uppercase tracking-[.2em] text-amber-600">Kho nguyên liệu → pha chế</div>
          <h1 className="mt-2 text-3xl font-black text-emerald-900 sm:text-4xl">Phiếu xuất kho</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Ghi nhận nguyên liệu cấp cho quầy. Đây là luồng xuất vật lý, tách biệt với tiêu hao lý thuyết tính từ công thức món bán.</p></div>
        <button onClick={() => setForm(emptyForm())} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-800 bg-white px-4 font-bold text-emerald-900 hover:bg-emerald-50"><Plus className="h-4 w-4" /> Phiếu mới</button>
      </header>

      {error && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 font-medium text-rose-700">{error}</div>}

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b bg-emerald-950 p-5 text-white md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold">Ngày xuất<input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold">Nơi nhận<input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold">Người xuất<input value={form.issuedBy} onChange={(e) => setForm({ ...form, issuedBy: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold">Ghi chú chung<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ca, bộ phận nhận..." className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950" /></label>
        </div>
        {form.issueCode && <div className="border-b bg-amber-50 px-5 py-3 text-sm font-bold text-amber-900">Đang sửa phiếu nháp {form.issueCode}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-blue-600 text-white"><tr><th className="w-16 px-4 py-3 text-center">STT</th><th className="w-32 px-4 py-3">Mã NL</th><th className="px-4 py-3">Tên nguyên vật liệu</th><th className="w-40 px-4 py-3 text-right">Số lượng xuất</th><th className="w-28 px-4 py-3">Đơn vị</th><th className="w-36 px-4 py-3 text-right">Tồn kho</th><th className="px-4 py-3">Ghi chú</th><th className="w-16"></th></tr></thead>
            <tbody className="divide-y divide-slate-200">{form.items.map((item, index) => {
              const ingredient = ingredientByCode.get(item.ingredientCode);
              const requested = number(item.quantity);
              const insufficient = Boolean(ingredient && requested > ingredient.stockQuantity);
              return <tr key={item.key} className={insufficient ? "bg-rose-50" : "hover:bg-blue-50/40"}>
                <td className="px-4 py-2 text-center font-semibold">{index + 1}</td>
                <td className="px-4 py-2 font-bold text-emerald-800">{ingredient?.ingredientCode || "—"}</td>
                <td className="px-4 py-2"><select value={item.ingredientCode} onChange={(e) => updateLine(index, { ingredientCode: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"><option value="">Chọn nguyên liệu...</option>{ingredients.map((option) => <option key={option.id} value={option.ingredientCode}>{option.ingredientName} ({option.ingredientCode})</option>)}</select></td>
                <td className="px-4 py-2"><input inputMode="decimal" value={item.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className={`h-10 w-full rounded-md border px-3 text-right font-bold ${insufficient ? "border-rose-500 text-rose-700" : "border-slate-300"}`} /></td>
                <td className="px-4 py-2">{ingredient?.unit || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold">{ingredient ? quantity(ingredient.stockQuantity) : "—"}</td>
                <td className="px-4 py-2"><input value={item.note} onChange={(e) => updateLine(index, { note: e.target.value })} placeholder="Người/bộ phận nhận" className="h-10 w-full rounded-md border border-slate-300 px-3" /></td>
                <td className="px-2 py-2"><button aria-label="Xóa dòng" disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))} className="rounded-md p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
              </tr>;
            })}</tbody>
            <tfoot className="bg-slate-50 font-bold"><tr><td colSpan={3} className="px-4 py-3 text-right">Tổng số lượng</td><td className="px-4 py-3 text-right">{quantity(total)}</td><td colSpan={4}></td></tr></tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
          <button onClick={() => setForm((current) => ({ ...current, items: [...current.items, line()] }))} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-4 font-semibold hover:bg-slate-50"><Plus className="h-4 w-4" /> Thêm dòng</button>
          <div className="flex gap-3"><button disabled={saving} onClick={() => void save("draft")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-emerald-800 px-5 font-bold text-emerald-900 disabled:opacity-50"><Save className="h-4 w-4" /> Lưu nháp</button>
            <button disabled={saving} onClick={() => void save("completed")} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-800 px-5 font-bold text-white hover:bg-emerald-900 disabled:opacity-50"><PackageMinus className="h-4 w-4" /> Hoàn thành &amp; trừ kho</button></div>
        </div>
      </section>

      <section className="mt-7 rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="text-xl font-black text-emerald-950">Lịch sử xuất kho</h2><p className="text-sm text-slate-500">Mới nhất hiển thị trước</p></div>
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Tìm mã, nơi nhận..." className="h-10 rounded-md border pl-9 pr-3" /></label></div>
        {loading ? <div className="p-12 text-center text-slate-500">Đang tải...</div> : filteredIssues.length === 0 ? <div className="p-12 text-center text-slate-500"><ClipboardList className="mx-auto mb-2 text-slate-300" />Chưa có phiếu xuất kho.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Ngày</th><th className="p-4">Mã phiếu</th><th className="p-4">Nơi nhận</th><th className="p-4">Người xuất</th><th className="p-4 text-right">Số dòng</th><th className="p-4 text-right">Tổng lượng</th><th className="p-4">Trạng thái</th><th className="p-4"></th></tr></thead><tbody className="divide-y">{filteredIssues.map((issue) => <tr key={issue.id} className="hover:bg-slate-50"><td className="p-4">{new Date(`${issue.issueDate}T12:00:00`).toLocaleDateString("vi-VN")}</td><td className="p-4 font-bold text-emerald-800">{issue.issueCode}</td><td className="p-4">{issue.destination}</td><td className="p-4">{issue.issuedBy}</td><td className="p-4 text-right">{issue.itemCount}</td><td className="p-4 text-right font-bold">{quantity(issue.totalQuantity)}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${issue.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{issue.status === "completed" ? "Đã trừ kho" : "Phiếu nháp"}</span></td><td className="p-4 text-right">{issue.status === "draft" && <div className="flex justify-end gap-2"><button onClick={() => edit(issue)} className="font-bold text-emerald-700">Sửa</button><button onClick={() => void remove(issue)} className="font-bold text-rose-600">Xóa</button></div>}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  </div>;
}
