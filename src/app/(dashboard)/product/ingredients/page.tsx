import { useEffect, useMemo, useState } from "react";
import { Boxes, LoaderCircle, Pencil, Plus, Search, Trash2, Warehouse, X } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  addProduct, deleteProduct, getAllProducts, getNextProductCode, updateProductCost, type Product,
} from "@/services/products.firebase";

type IngredientForm = {
  code: string;
  name: string;
  unit: string;
  stockQuantity: string;
  cost: string;
  description: string;
};

const emptyForm = (): IngredientForm => ({
  code: "", name: "", unit: "", stockQuantity: "0", cost: "0", description: "",
});
const parseDecimal = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatNumber = (value: number | null | undefined, maximumFractionDigits = 3) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits });

export default function IngredientsPage() {
  const { storeId } = useStore();
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<IngredientForm>(emptyForm());
  const [error, setError] = useState("");

  async function loadIngredients() {
    setItems(await getAllProducts(storeId, "ingredient"));
  }

  useEffect(() => {
    setLoading(true);
    loadIngredients()
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Không thể tải nguyên liệu."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return items;
    return items.filter((item) =>
      item.product_code.toLocaleLowerCase("vi").includes(keyword)
      || item.product_name.toLocaleLowerCase("vi").includes(keyword)
      || (item.unit || "").toLocaleLowerCase("vi").includes(keyword)
    );
  }, [items, search]);

  const inventoryValue = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.stockQuantity || 0) * Number(item.cost || 0), 0),
    [items]
  );

  async function openCreate() {
    try {
      setPreparing(true);
      setError("");
      const code = await getNextProductCode(storeId, "ingredient");
      setEditing(null);
      setForm({ ...emptyForm(), code });
      setModalOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lấy mã nguyên liệu mới.");
    } finally {
      setPreparing(false);
    }
  }

  function openEdit(item: Product) {
    setError("");
    setEditing(item);
    setForm({
      code: item.product_code,
      name: item.product_name,
      unit: item.unit || "",
      stockQuantity: String(item.stockQuantity ?? 0),
      cost: String(item.cost ?? 0),
      description: item.description || "",
    });
    setModalOpen(true);
  }

  async function saveIngredient() {
    const code = form.code.trim();
    const name = form.name.trim();
    const unit = form.unit.trim();
    if (!code || !name || !unit) {
      setError("Vui lòng nhập mã, tên và đơn vị tính của nguyên liệu.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payload = {
        productName: name,
        unit,
        stockQuantity: Math.max(0, parseDecimal(form.stockQuantity)),
        cost: Math.max(0, parseDecimal(form.cost)),
        description: form.description.trim(),
        itemType: "ingredient" as const,
      };
      if (editing) {
        await updateProductCost(editing.product_code, payload, storeId);
      } else {
        await addProduct({
          product_code: code, product_name: name, unit,
          stockQuantity: payload.stockQuantity, cost: payload.cost, price: null,
          description: payload.description, itemType: "ingredient",
          isSelling: false, storeId,
        });
      }
      await loadIngredients();
      setModalOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu nguyên liệu.");
    } finally {
      setSaving(false);
    }
  }

  async function removeIngredient(item: Product) {
    if (!window.confirm(`Xóa nguyên liệu “${item.product_name}”?`)) return;
    try {
      setDeletingCode(item.product_code);
      setError("");
      await deleteProduct(item.product_code, storeId);
      await loadIngredients();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xóa nguyên liệu.");
    } finally {
      setDeletingCode(null);
    }
  }

  return <div className="min-h-screen bg-slate-50 p-4 md:p-8">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Boxes className="h-6 w-6" /></span>
          <div><h1 className="text-3xl font-bold text-slate-950">Nguyên liệu</h1><p className="mt-1 text-slate-500">Quản lý nguyên liệu dùng cho nhập hàng và kiểm kho.</p></div>
        </div>
        <button type="button" onClick={() => void openCreate()} disabled={preparing}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 font-bold text-white shadow-sm disabled:opacity-60">
          {preparing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          {preparing ? "Đang lấy mã…" : "Thêm nguyên liệu"}
        </button>
      </div>

      {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">Tổng nguyên liệu</div><div className="mt-2 text-3xl font-bold">{items.length}</div></div>
        <div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">Có tồn kho</div><div className="mt-2 text-3xl font-bold text-emerald-700">{items.filter((item) => Number(item.stockQuantity || 0) > 0).length}</div></div>
        <div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">Tổng giá trị tồn</div><div className="mt-2 text-3xl font-bold">{formatNumber(inventoryValue, 0)} ₫</div></div>
      </div>

      <section className="mt-5 overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <label className="relative block"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã, tên hoặc đơn vị nguyên liệu"
              className="h-12 w-full rounded-xl border bg-slate-50 pl-12 pr-4 outline-none focus:border-emerald-500" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 text-sm text-slate-600"><tr>
              <th className="px-5 py-4">Mã nguyên liệu</th><th className="px-5 py-4">Tên nguyên liệu</th><th className="px-5 py-4">Đơn vị</th>
              <th className="px-5 py-4 text-right">Tồn kho</th><th className="px-5 py-4 text-right">Giá vốn</th><th className="px-5 py-4 text-right">Giá trị tồn</th><th className="px-5 py-4 text-right">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-500"><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />Đang tải nguyên liệu…</td></tr>
                : filteredItems.length === 0 ? <tr><td colSpan={7} className="px-5 py-16 text-center text-slate-500"><Warehouse className="mx-auto mb-3 h-9 w-9 text-slate-300" />Chưa có nguyên liệu phù hợp.</td></tr>
                : filteredItems.map((item) => <tr key={item.product_code} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-bold text-emerald-700">{item.product_code}</td>
                  <td className="px-5 py-4"><div className="font-semibold">{item.product_name}</div>{item.description && <div className="mt-1 max-w-xs truncate text-sm text-slate-500">{item.description}</div>}</td>
                  <td className="px-5 py-4 text-slate-600">{item.unit || "—"}</td><td className="px-5 py-4 text-right font-semibold">{formatNumber(item.stockQuantity)}</td>
                  <td className="px-5 py-4 text-right">{formatNumber(item.cost, 0)} ₫</td><td className="px-5 py-4 text-right font-bold">{formatNumber(Number(item.stockQuantity || 0) * Number(item.cost || 0), 0)} ₫</td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2">
                    <button type="button" onClick={() => openEdit(item)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50" aria-label={`Sửa ${item.product_name}`}><Pencil className="h-4 w-4" /></button>
                    <button type="button" disabled={deletingCode !== null} onClick={() => void removeIngredient(item)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`Xóa ${item.product_name}`}>
                      {deletingCode === item.product_code ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    {modalOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-2xl font-bold">{editing ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}</h2><p className="mt-1 text-sm text-slate-500">Tồn kho được dùng chung cho nhập hàng và kiểm kho.</p></div>
          <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Mã nguyên liệu *
            <input value={form.code} disabled={Boolean(editing)} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border px-4 font-normal outline-none focus:border-emerald-500 disabled:bg-slate-100" />
            <span className="mt-1 block text-xs font-normal text-slate-500">{editing ? "Mã không đổi sau khi tạo." : "Mã được gợi ý tự động và có thể sửa."}</span>
          </label>
          <label className="text-sm font-semibold text-slate-700">Tên nguyên liệu *
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: Cà phê hạt" className="mt-2 h-12 w-full rounded-xl border px-4 font-normal outline-none focus:border-emerald-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Đơn vị tính *
            <input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="kg, chai, thùng…" className="mt-2 h-12 w-full rounded-xl border px-4 font-normal outline-none focus:border-emerald-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Số lượng tồn
            <input value={form.stockQuantity} onChange={(event) => setForm((current) => ({ ...current, stockQuantity: event.target.value }))} inputMode="decimal" className="mt-2 h-12 w-full rounded-xl border px-4 font-normal outline-none focus:border-emerald-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Giá vốn mỗi đơn vị
            <input value={form.cost} onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))} inputMode="decimal" className="mt-2 h-12 w-full rounded-xl border px-4 font-normal outline-none focus:border-emerald-500" />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Ghi chú
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Quy cách, nhà cung cấp hoặc ghi chú bảo quản…" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-emerald-500" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="min-h-11 rounded-xl px-5 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Hủy</button>
          <button type="button" disabled={saving} onClick={() => void saveIngredient()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 font-bold text-white disabled:opacity-60">
            {saving && <LoaderCircle className="h-5 w-5 animate-spin" />}{saving ? "Đang lưu…" : "Lưu nguyên liệu"}
          </button>
        </div>
      </div>
    </div>}
  </div>;
}
