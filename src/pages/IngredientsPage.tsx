import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import { Boxes, Download, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/permissions";
import {
  createIngredient, deleteIngredient, getIngredients, getNextIngredientCode, migrateIngredientCategoryProducts,
  updateIngredient, type Ingredient,
} from "@/services/ingredients";
import { getSuppliers, type Supplier } from "@/services/suppliers";
import { exportIngredientsToExcel, parseIngredientWorkbook } from "@/services/catalogExcel";

type Form = {
  code: string; name: string; unit: string; purchaseUnit: string; conversionFactor: string; stock: string; cost: string;
  conversionSourceIngredientId: string; conversionInputQuantity: string; conversionOutputQuantity: string;
  conversionComponents: Array<{ ingredientId: string; inputQuantity: string }>;
  supplierId: string; supplierItemCode: string; description: string;
};
const blank = (): Form => ({
  code: "", name: "", unit: "", purchaseUnit: "", conversionFactor: "1", stock: "0", cost: "0",
  conversionSourceIngredientId: "", conversionInputQuantity: "", conversionOutputQuantity: "",
  conversionComponents: [],
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
  const importInputRef = useRef<HTMLInputElement | null>(null);

  async function reload() {
    await migrateIngredientCategoryProducts(storeId);
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
    const legacyFactor = item.purchaseToBaseFactor || 1;
    setForm({
      code: item.ingredientCode, name: item.ingredientName, unit: item.baseUnit || item.unit,
      purchaseUnit: item.purchaseUnit || item.unit,
      conversionFactor: String(legacyFactor),
      stock: String(item.stockQuantity / legacyFactor),
      cost: String(item.directCost ?? item.cost ?? 0),
      conversionSourceIngredientId: item.conversionSourceIngredientId || "",
      conversionInputQuantity: item.conversionInputQuantity ? String(item.conversionInputQuantity) : "",
      conversionOutputQuantity: item.conversionOutputQuantity ? String(item.conversionOutputQuantity) : "",
      conversionComponents: item.conversionComponents?.length
        ? item.conversionComponents.map((component) => ({ ingredientId: component.ingredientId, inputQuantity: String(component.inputQuantity) }))
        : item.conversionSourceIngredientId ? [{ ingredientId: item.conversionSourceIngredientId, inputQuantity: String(item.conversionInputQuantity || "") }] : [],
      supplierId: item.supplierId || "", supplierItemCode: item.supplierItemCode,
      description: item.description,
    });
    setOpen(true);
  }
  async function save() {
    if (!form.code.trim() || !form.name.trim() || !form.unit.trim() || !form.purchaseUnit.trim() || decimal(form.conversionFactor) <= 0) {
      setError(`Vui lòng nhập mã, tên, đơn vị thu ngân, đơn vị pha chế và hệ số quy đổi của ${itemLabel}.`);
      return;
    }
    if (form.conversionComponents.length && (decimal(form.conversionOutputQuantity) <= 0 || form.conversionComponents.some((component) => !component.ingredientId || decimal(component.inputQuantity) <= 0))) {
      setError("Vui lòng chọn đủ nguyên liệu đầu vào, nhập định lượng và lượng bán thành phẩm thu được lớn hơn 0.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      storeId, ingredientName: form.name.trim(), unit: form.unit.trim(),
      purchaseUnit: form.purchaseUnit.trim(), baseUnit: form.unit.trim(),
      purchaseToBaseFactor: decimal(form.conversionFactor),
      cost: Math.max(0, decimal(form.cost)),
      conversionSourceIngredientId: form.conversionComponents[0]?.ingredientId || null,
      conversionInputQuantity: form.conversionComponents[0] ? decimal(form.conversionComponents[0].inputQuantity) : null,
      conversionOutputQuantity: form.conversionComponents.length ? decimal(form.conversionOutputQuantity) : null,
      conversionComponents: form.conversionComponents.map((component) => ({ ingredientId: component.ingredientId, inputQuantity: decimal(component.inputQuantity) })),
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

  async function importExcel(file: File) {
    setSaving(true);
    setError("");
    try {
      const rows = await parseIngredientWorkbook(file);
      const existingCodes = new Set(items.map((item) => item.ingredientCode.toLocaleLowerCase("vi")));
      let created = 0;
      let updated = 0;
      for (const row of rows) {
        const payload = {
          storeId,
          ingredientName: row.ingredientName,
          unit: row.baseUnit,
          baseUnit: row.baseUnit,
          purchaseUnit: row.purchaseUnit,
          purchaseToBaseFactor: row.purchaseToBaseFactor,
          cost: row.cost,
          supplierItemCode: row.supplierItemCode,
          description: row.description,
          isActive: row.isActive,
        };
        if (existingCodes.has(row.ingredientCode.toLocaleLowerCase("vi"))) {
          await updateIngredient(row.ingredientCode, payload);
          updated += 1;
        } else {
          await createIngredient({ ...payload, ingredientCode: row.ingredientCode, stockQuantity: 0 });
          existingCodes.add(row.ingredientCode.toLocaleLowerCase("vi"));
          created += 1;
        }
      }
      await reload();
      window.alert(`Đã import ${rows.length} dòng: thêm mới ${created}, cập nhật ${updated}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Không thể import danh sách ${itemLabel}.`);
    } finally {
      setSaving(false);
    }
  }

  return <div className="min-h-screen bg-slate-50 p-4 font-sans md:p-8"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold">{itemTitle}</h1><p className="mt-1 text-slate-500">{isConstructionWarehouse ? "Danh mục độc lập của kho thợ, phục vụ nhập, xuất và kiểm kê vật tư xây dựng." : "Dữ liệu riêng cho định mức, nhập hàng và kiểm kho."}</p></div>
      <div className="flex flex-wrap gap-2">
        {(hasPermission(user, "inventory_receipts.view") || hasPermission(user, "inventory_issues.access") || hasPermission(user, "inventory_checks.access")) && <Link href="/inventory" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 font-bold text-emerald-800 hover:bg-emerald-50"><Boxes className="h-4 w-4" /> Sổ kho</Link>}
        <button disabled={saving || items.length === 0} onClick={() => exportIngredientsToExcel(items, storeId)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 font-bold text-emerald-800 disabled:opacity-50"><Download className="h-4 w-4" /> Xuất Excel</button>
        <button disabled={saving} onClick={() => importInputRef.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700 bg-white px-4 font-bold text-emerald-800 disabled:opacity-50"><Upload className="h-4 w-4" /> Import Excel</button>
        <input ref={importInputRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importExcel(file); event.target.value = ""; }} />
        <button disabled={preparing} onClick={() => void startCreate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-60">
          {preparing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}{preparing ? "Đang chuẩn bị…" : `Thêm ${itemLabel}`}</button>
      </div>
    </header>
    {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>}
    <div className="mt-6 rounded-3xl border bg-white shadow-sm">
      <label className="relative block border-b p-5"><Search className="absolute left-9 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Tìm mã, tên ${itemLabel} hoặc nhà phân phối`} className="h-12 w-full rounded-xl border bg-slate-50 pl-12 pr-4" /></label>
      <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left">
        <thead className="bg-slate-50 text-sm text-slate-600"><tr><th className="p-4">Mã</th><th className="p-4">Tên {itemLabel}</th><th className="p-4">Nhà phân phối</th><th className="p-4 text-right">Tồn kho</th><th className="p-4">Đơn vị</th><th className="p-4 text-right">Giá vốn</th><th className="p-4 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y">{loading ? <tr><td colSpan={7} className="p-14 text-center"><LoaderCircle className="mx-auto animate-spin" /></td></tr>
          : filtered.length === 0 ? <tr><td colSpan={7} className="p-14 text-center text-slate-500"><Boxes className="mx-auto mb-2 text-slate-300" />Chưa có {itemLabel}.</td></tr>
          : filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50">
            <td className="p-4 font-bold text-emerald-700">{item.ingredientCode}</td><td className="p-4"><b>{item.ingredientName}</b><small className="block text-slate-500">{item.supplierItemCode}</small></td>
            <td className="p-4">{item.supplierName || "Chưa gán"}</td><td className="p-4 text-right font-semibold">{(item.stockQuantity / (item.purchaseToBaseFactor || 1)).toLocaleString("vi-VN", { maximumFractionDigits: 3 })}</td><td className="p-4"><b>{item.purchaseUnit || item.unit || "—"}</b></td><td className="p-4 text-right">{(Number(item.cost || 0) * (item.purchaseToBaseFactor || 1)).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ₫/{item.purchaseUnit || item.unit}</td>
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
      <Field label="Đơn vị thu ngân/nhập kho *"><input value={form.purchaseUnit} placeholder="túi, bịch, chai, thùng…" onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} /></Field>
      <Field label="Đơn vị pha chế/công thức *"><input value={form.unit} placeholder="g, ml, cái…" onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
      <Field label={`Số ${form.unit || "đơn vị pha chế"} trong 1 ${form.purchaseUnit || "đơn vị thu ngân"} *`}><input inputMode="decimal" value={form.conversionFactor} placeholder="Ví dụ: 1000" onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })} /></Field>
      <Field label={`Tồn kho hiện tại (${form.purchaseUnit || "đơn vị thu ngân"})`}><input disabled value={form.stock} title="Tồn kho chỉ thay đổi qua phiếu nhập, phiếu xuất hoặc kiểm kho." /></Field>
      <Field label={`Giá vốn / ${form.unit || "đơn vị pha chế"}`}><input inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
      <Field label="Nhà phân phối"><select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Chưa chọn</option>{suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.supplierName}</option>)}</select></Field>
      <Field label="Mã tại nhà phân phối"><input value={form.supplierItemCode} placeholder="Mã hàng của nhà phân phối" onChange={(e) => setForm({ ...form, supplierItemCode: e.target.value })} /></Field>
      <Field label="Ghi chú"><input value={form.description} placeholder="Quy cách hoặc ghi chú bảo quản" onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
    </div>
    {!isConstructionWarehouse && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <label className="flex items-center gap-3 font-semibold text-amber-950">
        <input
          type="checkbox"
          checked={form.conversionComponents.length > 0}
          onChange={(event) => setForm({
            ...form,
            conversionComponents: event.target.checked
              ? [{ ingredientId: items.find((item) => item.id !== editing?.id && !item.conversionComponents?.length && !item.conversionSourceIngredientId)?.id || "", inputQuantity: "" }]
              : [],
            conversionOutputQuantity: event.target.checked ? form.conversionOutputQuantity : "",
          })}
          className="h-4 w-4"
        />
        Đây là bán thành phẩm
      </label>
      {form.conversionComponents.length > 0 && <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_44px]">{form.conversionComponents.map((component,index) => <div key={index} className="contents">
          <Field label={index === 0 ? "Nguyên liệu đầu vào *" : "Nguyên liệu đầu vào"}><select value={component.ingredientId} onChange={(e) => setForm({ ...form, conversionComponents: form.conversionComponents.map((item,itemIndex) => itemIndex === index ? { ...item, ingredientId: e.target.value } : item) })}><option value="">Chọn nguyên liệu</option>{items.filter((item) => item.id !== editing?.id && !item.conversionComponents?.length && !item.conversionSourceIngredientId && !form.conversionComponents.some((selected,selectedIndex) => selectedIndex !== index && selected.ingredientId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.ingredientName} ({item.baseUnit || item.unit})</option>)}</select></Field>
          <Field label={index === 0 ? "Lượng đầu vào *" : "Định lượng"}><input inputMode="decimal" value={component.inputQuantity} placeholder="Ví dụ: 20" onChange={(e) => setForm({ ...form, conversionComponents: form.conversionComponents.map((item,itemIndex) => itemIndex === index ? { ...item, inputQuantity: e.target.value } : item) })} /></Field>
          <button type="button" onClick={() => setForm({ ...form, conversionComponents: form.conversionComponents.filter((_,itemIndex) => itemIndex !== index) })} className="mt-7 h-11 rounded-lg border text-rose-600"><Trash2 className="mx-auto h-4 w-4" /></button>
        </div>)}</div>
        <button type="button" onClick={() => setForm({ ...form, conversionComponents: [...form.conversionComponents, { ingredientId: "", inputQuantity: "" }] })} className="inline-flex h-10 items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 text-sm font-bold text-amber-900"><Plus className="h-4 w-4" /> Thêm nguyên liệu</button>
        <Field label={'Tổng lượng bán thành phẩm thu được (' + (form.unit || 'đơn vị') + ') *'}><input inputMode="decimal" value={form.conversionOutputQuantity} placeholder="Ví dụ: 1000" onChange={(e) => setForm({ ...form, conversionOutputQuantity: e.target.value })} /></Field>
        <p className="text-xs text-amber-800">Ví dụ: 100 g cà phê + 1.000 ml nước tạo ra 800 ml cốt. Giá cost và tồn nguyên liệu gốc được phân bổ theo toàn bộ công thức.</p>
        <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-800">
          Giá cost quy đổi: {(form.conversionComponents.reduce((sum,component) => sum + (items.find((item) => item.id === component.ingredientId)?.cost || 0) * decimal(component.inputQuantity), 0) / Math.max(decimal(form.conversionOutputQuantity), 1)).toLocaleString("vi-VN", { maximumFractionDigits: 6 })} ₫ / {form.unit || "đơn vị bán thành phẩm"}
        </p>
      </div>}
    </div>}
    <div className="mt-6 flex justify-end gap-3"><button disabled={saving} onClick={() => setOpen(false)} className="px-5">Hủy</button><button disabled={saving} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-60">{saving && <LoaderCircle className="h-5 w-5 animate-spin" />}{saving ? "Đang lưu…" : `Lưu ${itemLabel}`}</button></div>
  </div></div>}</div>;
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  return <label className="text-sm font-semibold text-slate-700">{label}<span className="block [&>input]:mt-2 [&>input]:h-12 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:px-4 [&>select]:mt-2 [&>select]:h-12 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:px-3">{children}</span></label>;
}
