import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pencil, Plus, Search, Trash2, Truck, X } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  createSupplier, deleteSupplier, getNextSupplierCode, getSuppliers,
  updateSupplier, type Supplier,
} from "@/services/suppliers";

type Form = {
  code: string; name: string; contact: string; phone: string; email: string;
  address: string; taxCode: string; note: string;
};
const blank = (): Form => ({ code: "", name: "", contact: "", phone: "", email: "", address: "", taxCode: "", note: "" });

export default function SuppliersPage() {
  const { storeId } = useStore();
  const [items, setItems] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Form>(blank());
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function reload() { setItems((await getSuppliers(storeId)).items); }
  useEffect(() => {
    setLoading(true);
    reload().catch((e) => setError(e instanceof Error ? e.message : "Không thể tải nhà phân phối.")).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return q ? items.filter((i) => `${i.supplierCode} ${i.supplierName} ${i.phone}`.toLocaleLowerCase("vi").includes(q)) : items;
  }, [items, search]);

  async function startCreate() {
    setBusy("prepare");
    try {
      setEditing(null);
      setForm({ ...blank(), code: await getNextSupplierCode(storeId) });
      setOpen(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể lấy mã mới."); }
    finally { setBusy(""); }
  }
  function startEdit(item: Supplier) {
    setEditing(item);
    setForm({ code: item.supplierCode, name: item.supplierName, contact: item.contactName, phone: item.phone, email: item.email, address: item.address, taxCode: item.taxCode, note: item.note });
    setOpen(true);
  }
  async function save() {
    if (!form.code.trim() || !form.name.trim()) { setError("Vui lòng nhập mã và tên nhà phân phối."); return; }
    setBusy("save");
    const payload = { storeId, supplierName: form.name.trim(), contactName: form.contact.trim(), phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(), taxCode: form.taxCode.trim(), note: form.note.trim() };
    try {
      if (editing) await updateSupplier(editing.supplierCode, payload);
      else await createSupplier({ ...payload, supplierCode: form.code.trim(), isActive: true });
      await reload(); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Không thể lưu nhà phân phối."); }
    finally { setBusy(""); }
  }
  async function remove(item: Supplier) {
    if (!window.confirm(`Xóa nhà phân phối “${item.supplierName}”?`)) return;
    setBusy(item.supplierCode);
    try { await deleteSupplier(storeId, item.supplierCode); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể xóa nhà phân phối."); }
    finally { setBusy(""); }
  }

  return <div className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-bold">Nhà phân phối</h1><p className="mt-1 text-slate-500">Quản lý thông tin liên hệ và nguồn cung nguyên liệu.</p></div>
      <button disabled={Boolean(busy)} onClick={() => void startCreate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-60">{busy === "prepare" ? <LoaderCircle className="animate-spin" /> : <Plus />}{busy === "prepare" ? "Đang chuẩn bị…" : "Thêm nhà phân phối"}</button></header>
    {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</div>}
    <section className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
      <label className="relative block border-b p-5"><Search className="absolute left-9 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã, tên hoặc số điện thoại" className="h-12 w-full rounded-xl border bg-slate-50 pl-12 pr-4" /></label>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-sm text-slate-600"><tr><th className="p-4">Mã</th><th className="p-4">Nhà phân phối</th><th className="p-4">Liên hệ</th><th className="p-4">Địa chỉ</th><th className="p-4 text-right">Nguyên liệu</th><th className="p-4 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y">{loading ? <tr><td colSpan={6} className="p-14 text-center"><LoaderCircle className="mx-auto animate-spin" /></td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-14 text-center text-slate-500"><Truck className="mx-auto mb-2 text-slate-300" />Chưa có nhà phân phối.</td></tr> : filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50">
          <td className="p-4 font-bold text-emerald-700">{item.supplierCode}</td><td className="p-4"><b>{item.supplierName}</b><small className="block text-slate-500">{item.taxCode}</small></td><td className="p-4">{item.contactName}<small className="block text-slate-500">{item.phone || item.email}</small></td><td className="max-w-xs p-4">{item.address || "—"}</td><td className="p-4 text-right font-semibold">{item.ingredientCount}</td>
          <td className="p-4"><div className="flex justify-end gap-2"><button onClick={() => startEdit(item)} className="p-2 text-emerald-700"><Pencil className="h-4 w-4" /></button><button disabled={Boolean(busy)} onClick={() => void remove(item)} className="p-2 text-rose-600 disabled:opacity-50">{busy === item.supplierCode ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div></td>
        </tr>)}</tbody></table></div>
    </section>
  </div>
  {open && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6"><div className="flex justify-between"><h2 className="text-2xl font-bold">{editing ? "Sửa nhà phân phối" : "Thêm nhà phân phối"}</h2><button disabled={busy === "save"} onClick={() => setOpen(false)}><X /></button></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">{[
      ["Mã nhà phân phối *", "code", "NCC1"], ["Tên nhà phân phối *", "name", "Tên công ty hoặc đại lý"],
      ["Người liên hệ", "contact", "Họ tên người phụ trách"], ["Số điện thoại", "phone", "Số điện thoại"],
      ["Email", "email", "Email liên hệ"], ["Mã số thuế", "taxCode", "Mã số thuế"],
      ["Địa chỉ", "address", "Địa chỉ giao hàng"], ["Ghi chú", "note", "Lịch giao hoặc điều khoản"],
    ].map(([label, key, placeholder]) => <label key={key} className="text-sm font-semibold text-slate-700">{label}<input disabled={key === "code" && Boolean(editing)} value={form[key as keyof Form]} placeholder={placeholder} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-2 h-12 w-full rounded-xl border px-4 font-normal" /></label>)}</div>
    <div className="mt-6 flex justify-end gap-3"><button disabled={busy === "save"} onClick={() => setOpen(false)} className="px-5">Hủy</button><button disabled={busy === "save"} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white disabled:opacity-60">{busy === "save" && <LoaderCircle className="h-5 w-5 animate-spin" />}{busy === "save" ? "Đang lưu…" : "Lưu nhà phân phối"}</button></div>
  </div></div>}</div>;
}
