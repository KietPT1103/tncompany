import { useEffect, useMemo, useState, type ReactElement } from "react";
import Link from "next/link";
import { Boxes, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/permissions";
import {
  createIngredient, deleteIngredient, getIngredients, getNextIngredientCode,
  updateIngredient, type Ingredient,
} from "@/services/ingredients";
import { getSuppliers, type Supplier } from "@/services/suppliers";

type Form = {
  code: string; name: string; unit: string; purchaseUnit: string; conversionFactor: string; stock: string; cost: string;
  supplierId: string; supplierItemCode: string; description: string;
};
const blank = (): Form => ({
  code: "", name: "", unit: "", purchaseUnit: "", conversionFactor: "1", stock: "0", cost: "0",
  supplierId: "", supplierItemCode: "", description: "",
});
const decimal = (value: string) => Number(value.replace(",", ".")) || 0;

export default function IngredientsPage() {
  const { storeId } = useStore();
  const { user } = useAuth();
  const isConstructionWarehouse = storeId === "warehouse";
  const itemLabel = isConstructionWarehouse ? "vật tư" : "nguyên liệu";
  const itemTitle = isConstructionWarehouse ? "Vật tư xây dựng" : "Nguyên liệu";
  const [items, setItems] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Form>(blank());
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const [ingredientResult, supplierResult] = await Promise.all([
      getIngredients(storeId), getSuppliers(storeId),
    ]);
    setItems(ingredientResult.items);
    setSuppliers(supplierResult.items);
  }
  useEffect(() => {
    setLoading(true);
    reload().catch((e) => setError(e instanceof Error ? e.message : "Không thể tải dữ liệu."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return q ? items.filter((item) =>
      `${item.ingredientCode} ${item.ingredientName} ${item.supplierName || ""}`.toLocaleLowerCase("vi").includes(q)
    ) : items;
  }, [items, search]);

  async function startCreate() {
    setPreparing(true);
    setError("");
    try {
      setEditing(null);
      setForm({ ...blank(), code: await getNextIngredientCode(storeId) });
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Không thể lấy mã ${itemLabel}.`);
    } finally {
      setPreparing(false);
    }
  }
  function startEdit(item: Ingredient) {
    setEditing(item);
    setForm({
      code: item.ingredientCode, name: item.ingredientName, unit: item.baseUnit || item.unit,
      purchaseUnit: item.purchaseUnit || item.unit,
      conversionFactor: String(item.purchaseToBaseFactor || 1),
      stock: String(item.stockQuantity), cost: String(item.cost ?? 0),
      supplierId: item.supplierId || "", supplierItemCode: item.supplierItemCode,
      description: item.description,
    });
    setOpen(true);
  }
  async function save() {
    if (!form.code.trim() || !form.name.trim() || !form.unit.trim() || !form.purchaseUnit.trim() || decimal(form.conversionFactor) <= 0) {
      setError(`Vui lòng nhập mã, tên và đơn vị ${itemLabel}.`);
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      storeId, ingredientName: form.name.trim(), unit: form.unit.trim(),
      purchaseUnit: form.purchaseUnit.trim(), baseUnit: form.unit.trim(),
      purchaseToBaseFactor: decimal(form.conversionFactor),
      cost: Math.max(0, decimal(form.cost)),
      supplierId: form.supplierId || null, supplierItemCode: form.supplierItemCode.trim(),
      description: form.description.trim(),
    };
    try {
      if (editing) await updateIngredient(editing.ingredientCode, payload);
      else await createIngredient({ ...payload, ingredientCode: form.code.trim(), stockQuantity: 0 });
      await reload();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Không thể lưu ${itemLabel}.`);
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: Ingredient) {
    if (!window.confirm(`Xóa ${itemLabel} “${item.ingredientName}”?`)) return;
    setDeleting(item.ingredientCode);
    try {
      await deleteIngredient(storeId, item.ingredientCode);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Không thể xóa ${itemLabel}.`);
    } finally {
      setDeleting("");
    }
  }

  return <div className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">{itemTitle}</h1><p className="mt-1 text-slate-500">{isConstructionWarehouse ? "Danh mục độc lập của kho thợ, phục vụ nhập, xuất và kiểm kê vật tư xây dựng." : "Dữ liệu riêng cho định mức, nhập hàng và kiểm kho."}</p></div>
      <div className="flex flex-wrap gap-2">
        {(hasPermission(user, "inventory_receipts.view") || hasPermission(user, "inventory_issues.access") || hasPermission(user, "inventory_checks.access")) && <Link href="/inventory" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 font-bold text-emerald-800 hover:bg-emerald-50"><Boxes className="h-4 w-4" /> Sổ kho</Link>}
        <button disabled={preparing} onClick={() => void startCreate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-60">
          {preparing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}{preparing ? "Đang chuẩn bị…" : `Thêm ${itemLabel}`}</button>
      </div>
    </header>
    {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>}
    <div className="mt-6 rounded-3xl border bg-white shadow-sm">
      <label className="relative block border-b p-5"><Search className="absolute left-9 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Tìm mã, tên ${itemLabel} hoặc nhà phân phối`} className="h-12 w-full rounded-xl border bg-slate-50 pl-12 pr-4" /></label>
      <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left">
        <thead className="bg-slate-50 text-sm text-slate-600"><tr><th className="p-4">Mã</th><th className="p-4">Tên {itemLabel}</th><th className="p-4">Đơn vị</th><th className="p-4">Nhà phân phối</th><th className="p-4 text-right">Tồn kho</th><th className="p-4 text-right">Giá vốn</th><th className="p-4 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y">{loading ? <tr><td colSpan={7} className="p-14 text-center"><LoaderCircle className="mx-auto animate-spin" /></td></tr>
          : filtered.length === 0 ? <tr><td colSpan={7} className="p-14 text-center text-slate-500"><Boxes className="mx-auto mb-2 text-slate-300" />Chưa có {itemLabel}.</td></tr>
          : filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50">
            <td className="p-4 font-bold text-emerald-700">{item.ingredientCode}</td><td className="p-4"><b>{item.ingredientName}</b><small className="block text-slate-500">{item.supplierItemCode}</small></td>
            <td className="p-4"><b>{item.baseUnit || item.unit || "—"}</b><small className="block text-slate-500">1 {item.purchaseUnit || item.unit} = {item.purchaseToBaseFactor || 1} {item.baseUnit || item.unit}</small></td><td className="p-4">{item.supplierName || "Chưa gán"}</td><td className="p-4 text-right font-semibold">{item.stockQuantity.toLocaleString("vi-VN")} {item.baseUnit || item.unit}</td><td className="p-4 text-right">{Number(item.cost || 0).toLocaleString("vi-VN", { maximumFractionDigits: 6 })} ₫</td>
            <td className="p-4"><div className="flex justify-end gap-2"><button onClick={() => startEdit(item)} className="p-2 text-emerald-700"><Pencil className="h-4 w-4" /></button><button disabled={Boolean(deleting)} onClick={() => void remove(item)} className="p-2 text-rose-600 disabled:opacity-50">{deleting === item.ingredientCode ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div></td>
          </tr>)}</tbody>
      </table></div>
    </div>
  </div>
  {open && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6">
    <div className="flex justify-between"><h2 className="text-2xl font-bold">{editing ? `Sửa ${itemLabel}` : `Thêm ${itemLabel}`}</h2><button disabled={saving} onClick={() => setOpen(false)}><X /></button></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <Field label={`Mã ${itemLabel} *`}><input disabled={Boolean(editing)} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
      <Field label={`Tên ${itemLabel} *`}><input value={form.name} placeholder={isConstructionWarehouse ? "Ví dụ: Xi măng, thép, dây điện" : "Ví dụ: Cà phê hạt"} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Đơn vị nhập kho *"><input value={form.purchaseUnit} placeholder="túi, bịch, chai, thùng…" onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} /></Field>
      <Field label="Đơn vị sử dụng/công thức *"><input value={form.unit} placeholder="g, ml, cái…" onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
      <Field label={`Số ${form.unit || "đơn vị sử dụng"} trong 1 ${form.purchaseUnit || "đơn vị nhập"} *`}><input inputMode="decimal" value={form.conversionFactor} placeholder="Ví dụ: 1000" onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} /></Field>
      <Field label="Tồn kho hiện tại"><input disabled value={form.stock} title="Tồn kho chỉ thay đổi qua phiếu nhập, phiếu xuất hoặc kiểm kho." /></Field>
      <Field label={`Giá vốn / ${form.unit || "đơn vị sử dụng"}`}><input inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
      <Field label="Nhà phân phối"><select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Chưa chọn</option>{suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.supplierName}</option>)}</select></Field>
      <Field label="Mã tại nhà phân phối"><input value={form.supplierItemCode} placeholder="Mã hàng của nhà phân phối" onChange={(e) => setForm({ ...form, supplierItemCode: e.target.value })} /></Field>
      <Field label="Ghi chú"><input value={form.description} placeholder="Quy cách hoặc ghi chú bảo quản" onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
    </div>
    <div className="mt-6 flex justify-end gap-3"><button disabled={saving} onClick={() => setOpen(false)} className="px-5">Hủy</button><button disabled={saving} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-60">{saving && <LoaderCircle className="h-5 w-5 animate-spin" />}{saving ? "Đang lưu…" : `Lưu ${itemLabel}`}</button></div>
  </div></div>}</div>;
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<span className="block [&>input]:mt-2 [&>input]:h-12 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:px-4 [&>select]:mt-2 [&>select]:h-12 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:px-3">{children}</span></label>;
}
