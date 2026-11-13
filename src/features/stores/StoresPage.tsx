import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MapPin, Pencil, Plus, RefreshCw, Search, Store, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useStore } from "@/context/StoreContext";
import { deleteStore, getStores, saveStore, type StoreInput, type StoreRecord } from "@/services/stores.api";
import { normalizeSearchText } from "@/lib/utils";

const emptyForm: StoreInput = { name: "", address: "", isTakeAway: false, isActive: true, takeawayPrintingEnabled: false, takeawayShiftEnabled: false, takeawayShiftCount: 1, takeawayFinalShift: 1 };
const fieldClass = "mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function StoreEditor({ item, onClose, onSaved }: { item: StoreRecord | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<StoreInput>(() => item ? { name: item.name, address: item.address, isTakeAway: item.isTakeAway, isActive: item.isActive, takeawayPrintingEnabled: item.takeawayPrintingEnabled ?? false, takeawayShiftEnabled: item.takeawayShiftEnabled ?? false, takeawayShiftCount: item.takeawayShiftCount ?? 1, takeawayFinalShift: item.takeawayFinalShift ?? 1 } : { ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      await saveStore(item?.id || null, form);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được quầy.");
    } finally { setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="store-editor-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-emerald-950/40">
    <form onSubmit={submit}>
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <h2 id="store-editor-title" className="text-xl font-bold text-emerald-950">{item ? "Sửa thông tin quầy" : "Thêm quầy"}</h2>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </div>
      <fieldset disabled={saving} className="space-y-5 p-5">
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <label className="block text-sm font-semibold">Tên quầy <span className="text-rose-600">*</span><input autoFocus required maxLength={255} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên quầy" className={fieldClass} /></label>
        <label className="block text-sm font-semibold">Địa chỉ<textarea maxLength={500} rows={3} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Nhập địa chỉ quầy" className={fieldClass} /></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={form.isTakeAway} onChange={e => setForm({ ...form, isTakeAway: e.target.checked, takeawayShiftEnabled: e.target.checked && form.takeawayShiftEnabled })} className="mt-0.5 h-4 w-4 accent-emerald-700" /><span><span className="block text-sm font-semibold">Quầy take away</span><span className="mt-1 block text-xs text-slate-500">Đánh dấu để phân loại quầy bán mang đi.</span></span></label>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-700" />Quầy đang hoạt động</label>
        {form.isTakeAway && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><input type="checkbox" checked={form.takeawayPrintingEnabled} onChange={e => setForm({ ...form, takeawayPrintingEnabled: e.target.checked })} className="mt-1 h-4 w-4" /><span><span className="block text-sm font-semibold">In hóa đơn và tem qua laptop</span><span className="block text-xs text-slate-600">Thanh toán trên điện thoại hoặc laptop đều gửi về chương trình in Windows. Chỉ bật sau khi đã cấu hình máy in bill và máy in tem.</span></span></label>}
        {form.isTakeAway && <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.takeawayShiftEnabled} onChange={e => setForm({ ...form, takeawayShiftEnabled: e.target.checked })} className="h-4 w-4 accent-emerald-700" />Bật chia ca take away</label>
          {form.takeawayShiftEnabled && <>
            <label className="block text-sm font-semibold">Số ca<input type="number" required min={1} max={24} step={1} value={form.takeawayShiftCount} onChange={e => { const count=Number(e.target.value); setForm({ ...form, takeawayShiftCount: count, takeawayFinalShift: Math.min(form.takeawayFinalShift, Math.max(1,count)) }); }} className={fieldClass} /></label>
            <label className="block text-sm font-semibold">Ca kết thúc ngày kinh doanh<select value={form.takeawayFinalShift} onChange={e => setForm({ ...form, takeawayFinalShift: Number(e.target.value) })} className={fieldClass}>{Array.from({ length: Math.min(24,Math.max(1,Math.floor(form.takeawayShiftCount))) }, (_, index) => <option key={index+1} value={index+1}>Ca {index+1}</option>)}</select></label>
            <p className="text-xs text-slate-600">Ngày kinh doanh kết thúc khi đóng ca cuối, kể cả khi qua nửa đêm. Cần đóng vòng và các ca đang mở trước khi đổi cấu hình.</p>
          </>}
        </div>}
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-slate-100 p-5"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Huỷ</Button><Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Đang lưu..." : "Lưu quầy"}</Button></div>
    </form>
  </dialog>;
}

export default function StoresPage() {
  const { refreshStores } = useStore();
  const [items, setItems] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<{ item: StoreRecord | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreRecord | null>(null);
  const [busy, setBusy] = useState("");
  const [deleteError, setDeleteError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { setItems(await getStores(true)); }
    catch (err) { setError(err instanceof Error ? err.message : "Không tải được danh sách quầy."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => {
    const keyword = normalizeSearchText(search);
    return items.filter(item => (status === "all" || item.isActive === (status === "active")) && normalizeSearchText(`${item.name} ${item.address}`).includes(keyword));
  }, [items, search, status]);
  async function afterSave() {
    await Promise.all([load(), refreshStores()]);
    setMessage("Đã lưu thông tin quầy.");
  }
  async function toggle(item: StoreRecord) {
    if (busy) return;
    setBusy(item.id); setError(""); setMessage("");
    try {
      const updated = await saveStore(item.id, { isActive: !item.isActive });
      setItems(current => current.map(row => row.id === item.id ? updated : row));
      await refreshStores();
      setMessage(updated.isActive ? "Đã bật hoạt động quầy." : "Đã ngừng hoạt động quầy.");
    } catch (err) { setError(err instanceof Error ? err.message : "Không đổi được trạng thái quầy."); }
    finally { setBusy(""); }
  }
  async function remove() {
    if (!deleteTarget || busy) return;
    setBusy(deleteTarget.id); setDeleteError(""); setMessage("");
    try {
      await deleteStore(deleteTarget.id);
      setItems(current => current.filter(item => item.id !== deleteTarget.id));
      await refreshStores(); setDeleteTarget(null); setMessage("Đã xoá quầy. Dữ liệu lịch sử được giữ lại.");
    } catch (err) { setDeleteError(err instanceof Error ? err.message : "Không xoá được quầy."); }
    finally { setBusy(""); }
  }
  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="mb-2 text-sm text-emerald-700">Quản trị / Quản lý quầy</p><h1 className="font-smooch text-4xl font-bold text-emerald-900 sm:text-6xl">Quản lý quầy</h1><p className="mt-2 text-sm text-slate-500">Quản lý thông tin, phân loại và trạng thái hoạt động của các quầy.</p></div>
      <Button onClick={() => { setMessage(""); setEditor({ item: null }); }}><Plus className="mr-2 h-4 w-4" />Thêm quầy</Button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
        <label className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><span className="sr-only">Tìm quầy</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên quầy, địa chỉ..." className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></label>
        <select aria-label="Lọc trạng thái" value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select>
        <Button variant="outline" disabled={loading || !!busy} onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-4">Quầy</th><th className="px-5 py-4">Địa chỉ</th><th className="px-5 py-4">Phân loại</th><th className="px-5 py-4">Hoạt động</th><th className="px-5 py-4 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={5} className="p-12 text-center text-slate-500">Đang tải danh sách quầy...</td></tr> : visible.length === 0 ? <tr><td colSpan={5} className="p-12 text-center text-slate-500"><Store className="mx-auto mb-3 h-8 w-8 text-slate-300" />{items.length ? "Không tìm thấy quầy phù hợp." : "Chưa có quầy nào. Thêm quầy để bắt đầu."}</td></tr> : visible.map(item => <tr key={item.id} className="hover:bg-emerald-50/30">
            <td className="px-5 py-4 font-semibold text-emerald-950">{item.name}</td>
            <td className="max-w-xs px-5 py-4 text-slate-500"><span className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{item.address || "Chưa có địa chỉ"}</span></span></td>
            <td className="px-5 py-4">{item.isTakeAway ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Take away</span> : <span className="text-slate-400">—</span>}</td>
            <td className="px-5 py-4"><button type="button" role="switch" aria-checked={item.isActive} aria-label={`Hoạt động: ${item.name}`} disabled={!!busy} onClick={() => void toggle(item)} className="inline-flex items-center gap-2 disabled:opacity-50"><span className={`flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${item.isActive ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${item.isActive ? "translate-x-4" : "translate-x-0"}`} /></span><span className={`text-xs ${item.isActive ? "text-emerald-700" : "text-slate-500"}`}>{item.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}</span></button></td>
            <td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" aria-label={`Sửa ${item.name}`} title="Sửa thông tin" disabled={!!busy} onClick={() => setEditor({ item })} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`Xoá ${item.name}`} title="Xoá quầy" disabled={!!busy} onClick={() => { setDeleteError(""); setDeleteTarget(item); }} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>)}
        </tbody>
      </table></div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{visible.length} / {items.length} quầy · {items.filter(item => item.isActive).length} đang hoạt động</p>
    </div>
    {editor && <StoreEditor item={editor.item} onClose={() => setEditor(null)} onSaved={afterSave} />}
    <ConfirmDialog open={!!deleteTarget} title="Xoá quầy?" confirmLabel="Xoá quầy" variant="destructive" isLoading={!!busy} onCancel={() => { if (!busy) setDeleteTarget(null); }} onConfirm={() => void remove()} description={<><span>Quầy <strong>{deleteTarget?.name}</strong> sẽ được xoá khỏi danh sách và ngừng hoạt động. Hoá đơn và dữ liệu lịch sử vẫn được giữ lại.</span>{deleteError && <span role="alert" className="mt-3 block text-rose-600">{deleteError}</span>}</>} />
  </div>;
}
