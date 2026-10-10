import { InventoryDateFilter } from "@/components/ui/InventoryDateFilter";
import { inventoryToday } from "@/lib/inventoryPeriods";
import { Pagination } from "@/components/ui/Pagination";
import { InventoryIssueFormDialog } from "./InventoryIssueFormDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, PackageMinus, Plus, Printer, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { availableIssueStock, canEditIssue } from "./corrections";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { getIngredients, type Ingredient } from "@/services/ingredients";
import {
  cancelInventoryIssue,
  getInventoryIssuePage,
  saveInventoryIssue,
  type InventoryIssue,
  type InventoryIssueItem,
} from "@/services/inventoryIssueService";
import { getOpenShiftByCashier, type CashierShift } from "@/services/shiftService";
import { requestInventoryIssueReprint } from "@/services/inventoryIssuePrintJobService";
import { printInventoryIssue } from "./inventoryIssuePrint";
import { canManualPrintInventoryIssue, getPrintStatusPresentation } from "./printStatus";
import { formatInventoryQuantity, isInventoryIssueQuantityInsufficient } from "./quantityPrecision";

type DraftLine = { key: string; ingredientCode: string; quantity: string; note: string };
type FormState = {
  id?: string;
  issueCode?: string;
  status?: InventoryIssue["status"];
  revision?: number;
  originalItems?: InventoryIssueItem[];
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
const quantity = formatInventoryQuantity;
const destinations = ["Quầy pha chế", "Farm", "Lẩu", "Phục vụ", "Khác"];

export default function InventoryIssuesPage() {
  const { storeId } = useStore();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isConstructionWarehouse = storeId === "warehouse";
  const stockItemLabel = isConstructionWarehouse ? "vật tư" : "nguyên liệu";
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [issues, setIssues] = useState<InventoryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<"complete" | "edit" | InventoryIssue | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [dateFrom, setDateFrom] = useState(inventoryToday);
  const [dateTo, setDateTo] = useState(today);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [issueTotal, setIssueTotal] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const loadSequence = useRef(0);
  const [reprintingJobId, setReprintingJobId] = useState("");
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const emptyForm = (): FormState => ({
    issueDate: today(), destination: isConstructionWarehouse ? "Đội thợ / công trình" : "Quầy pha chế", issuedBy: "",
    note: "", items: [line()],
  });
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (!user?.uid) {
      setActiveShift(null);
      return;
    }
    getOpenShiftByCashier(storeId, user.uid).then(setActiveShift).catch(() => setActiveShift(null));
  }, [storeId, user?.uid]);

  async function reload() {
    const sequence = ++loadSequence.current;
    const result = await getInventoryIssuePage(storeId, { dateFrom, dateTo, keyword: historySearch, page, limit: pageSize });
    if (sequence !== loadSequence.current) return;
    setIssues(result.items); setIssueTotal(result.pagination.total); setPage(result.pagination.page);
  }

  useEffect(() => {
    setForm(emptyForm()); setFormOpen(false); setConfirmation(null); setPage(1);
    getIngredients(storeId).then(result=>setIngredients(result.items)).catch(reason=>setError(reason.message));
  }, [storeId]);
  useEffect(() => {
    setLoading(true); setError("");
    let active = true;
    const timer = setTimeout(() => { reload().catch(reason=>{if(active)setError(reason instanceof Error ? reason.message : "Không thể tải danh sách xuất kho.")}).finally(()=>{if(active)setLoading(false)}); }, 200);
    return () => { active = false; clearTimeout(timer); loadSequence.current++; };
  }, [storeId, dateFrom, dateTo, historySearch, page, pageSize]);

  const ingredientByCode = useMemo(
    () => new Map(ingredients.map((item) => [item.ingredientCode, item])),
    [ingredients],
  );
  const total = form.items.reduce((sum, item) => sum + number(item.quantity), 0);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function edit(issue: InventoryIssue) {
    if (saving || !canEditIssue(role, issue.status)) return;
    setForm({
      id: issue.id, issueCode: issue.issueCode, status: issue.status, revision: issue.revision, originalItems: issue.items, issueDate: issue.issueDate,
      destination: issue.destination, issuedBy: issue.issuedBy, note: issue.note,
      items: issue.items.map((item) => ({ key: key(), ingredientCode: item.ingredientCode, quantity: String(item.quantity), note: item.note })),
    });
    setError(""); setFormOpen(true);
  }

  async function save(status: "draft" | "completed", confirmed = false) {
    if (saving) return;
    const items = form.items
      .filter((item) => item.ingredientCode || item.quantity.trim())
      .map((item) => ({ ingredientCode: item.ingredientCode, quantity: number(item.quantity), note: item.note.trim() }));
    if (!form.issueDate || !form.destination.trim() || !form.issuedBy.trim() || items.length === 0) {
      setError(`Vui lòng nhập ngày, nơi nhận, người xuất và ít nhất một dòng ${stockItemLabel}.`);
      return;
    }
    if (items.some((item) => !item.ingredientCode || item.quantity <= 0)) {
      setError(`Mỗi dòng phải chọn ${stockItemLabel} và có số lượng xuất lớn hơn 0.`);
      return;
    }
    if (status === "completed" && !confirmed) {
      setDialogError("");
      setConfirmation(form.status === "completed" ? "edit" : "complete");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveInventoryIssue({
        id: form.id, revision: form.revision, storeId, issueDate: form.issueDate, destination: form.destination.trim(),
        issuedBy: form.issuedBy.trim(), note: form.note.trim(), status, items,
        shiftId: activeShift?.id || null, shiftType: activeShift?.shiftType || null,
      });
      setConfirmation(null);
      setForm(emptyForm()); setFormOpen(false);
      await Promise.all([reload(), getIngredients(storeId).then(result=>setIngredients(result.items))]);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể lưu phiếu xuất kho.";
      setError(message);
      if (confirmed) setDialogError(message);
    } finally {
      setSaving(false);
    }
  }

  function requestCancellation(issue: InventoryIssue) {
    if (!isAdmin || saving || issue.status === "cancelled") return;
    setCancelReason("");
    setDialogError("");
    setConfirmation(issue);
  }

  async function cancelIssue(issue: InventoryIssue) {
    if (saving) return;
    if (!cancelReason.trim()) {
      setDialogError("Vui lòng nhập lý do hủy phiếu.");
      return;
    }
    setSaving(true);
    setDialogError("");
    setError("");
    try {
      await cancelInventoryIssue(issue, cancelReason.trim());
      setConfirmation(null);
      if (form.id === issue.id) setForm(emptyForm());
      await reload();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể hủy phiếu.";
      setError(message);
      setDialogError(message);
    } finally {
      setSaving(false);
    }
  }

  async function reprint(issue: InventoryIssue) {
    setReprintingJobId(issue.id);
    setError("");
    try {
      await requestInventoryIssueReprint(issue.id, storeId);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo lệnh in lại.");
    } finally {
      setReprintingJobId("");
    }
  }

  return <div className="warehouse-ui min-h-screen min-w-0 bg-slate-50 p-4 font-sans text-slate-950 sm:p-6 2xl:p-8">
    <div className="mx-auto max-w-[1680px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-sm font-bold uppercase tracking-[.2em] text-amber-600">{isConstructionWarehouse ? "Kho vật tư xây dựng → đội thợ / công trình" : "Kho nguyên liệu → pha chế"}</div>
          <h1 className="mt-2 text-3xl font-black text-emerald-900 sm:text-4xl">Phiếu xuất kho</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{isConstructionWarehouse ? "Ghi nhận vật tư cấp cho đội thợ hoặc từng công trình. Phiếu hoàn thành sẽ trừ trực tiếp tồn vật tư của Kho thợ." : "Ghi nhận nguyên liệu cấp cho quầy. Đây là luồng xuất vật lý, tách biệt với tiêu hao lý thuyết tính từ công thức món bán."}</p></div>
        <button disabled={saving} onClick={() => { setForm(emptyForm()); setError(""); setFormOpen(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-800 bg-white px-4 font-bold text-emerald-900 hover:bg-emerald-50"><Plus className="h-4 w-4" /> Phiếu mới</button>
      </header>

      {error && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 font-medium text-rose-700">{error}</div>}

      {formOpen && <InventoryIssueFormDialog title={form.id ? "Sửa phiếu xuất kho" : "Tạo phiếu xuất kho"} busy={saving || confirmation !== null} onClose={()=>setFormOpen(false)}>{error && <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b bg-emerald-950 p-5 text-white md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold">Ngày xuất<input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold">Nơi nhận<select value={destinations.includes(form.destination) ? form.destination : "Khác"} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950">{destinations.map((destination) => <option key={destination} value={destination}>{destination}</option>)}</select></label>
          <label className="text-sm font-semibold">Người xuất *<input required value={form.issuedBy} onChange={(e) => setForm({ ...form, issuedBy: e.target.value })} placeholder="Bắt buộc nhập tên người xuất" className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950" /></label>
          <label className="text-sm font-semibold">Ghi chú chung<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ca, bộ phận nhận..." className="mt-2 h-11 w-full rounded-md border border-white/20 bg-white px-3 text-slate-950" /></label>
        </div>
        {form.issueCode && <div className="border-b bg-amber-50 px-5 py-3 text-sm font-bold text-amber-900">Đang sửa {form.status === "completed" ? "phiếu đã hoàn thành" : "phiếu nháp"} {form.issueCode}{form.status === "completed" && <span className="ml-2 font-normal">Lưu thay đổi sẽ điều chỉnh lại tồn kho.</span>}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-blue-600 text-white"><tr><th className="w-16 px-4 py-3 text-center">STT</th><th className="w-32 px-4 py-3">Mã NL</th><th className="px-4 py-3">Tên nguyên vật liệu</th><th className="w-40 px-4 py-3 text-right">Số lượng xuất</th><th className="w-28 px-4 py-3">Đơn vị</th><th className="w-36 px-4 py-3 text-right">Tồn kho</th><th className="px-4 py-3 text-right">Giá trị quy đổi</th><th className="px-4 py-3">Ghi chú</th><th className="px-4 py-3">Trạng thái</th><th className="w-16"></th></tr></thead>
            <tbody className="divide-y divide-slate-200">{form.items.map((item, index) => {
              const ingredient = ingredientByCode.get(item.ingredientCode);
              const requested = number(item.quantity);
              const original = form.originalItems?.find((old) => old.ingredientCode === item.ingredientCode);
              const availableStock = availableIssueStock(ingredient?.stockQuantity ?? 0, form.status, original);
              const factor = ingredient?.purchaseToBaseFactor || 1;
              const insufficient = Boolean(ingredient && ingredient.itemKind !== "fresh" && isInventoryIssueQuantityInsufficient(requested, factor, availableStock));
              return <tr key={item.key} className={insufficient ? "bg-rose-50" : "hover:bg-blue-50/40"}>
                <td className="px-4 py-2 text-center font-semibold">{index + 1}</td>
                <td className="px-4 py-2 font-bold text-emerald-800">{ingredient?.ingredientCode || "—"}</td>
                <td className="px-4 py-2"><select value={item.ingredientCode} onChange={(e) => updateLine(index, { ingredientCode: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"><option value="">Chọn {stockItemLabel}...</option>{ingredients.filter((option) => option.isActive || form.originalItems?.some((old) => old.ingredientCode === option.ingredientCode)).map((option) => <option key={option.id} value={option.ingredientCode}>{option.ingredientName} ({option.ingredientCode})</option>)}</select></td>
                <td className="px-4 py-2"><input inputMode="decimal" value={item.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className={`h-10 w-full rounded-md border px-3 text-right font-bold ${insufficient ? "border-rose-500 text-rose-700" : "border-slate-300"}`} /></td>
                <td className="px-4 py-2">{ingredient?.purchaseUnit || ingredient?.unit || "—"}</td>
                <td className="px-4 py-2 text-right font-semibold">{ingredient ? ingredient.itemKind === "fresh" ? <span className="text-sky-700">Không tồn kho</span> : <>{quantity(availableStock / factor)} {ingredient.purchaseUnit || ingredient.unit}<small className="block font-normal text-slate-500">{quantity(availableStock)} {ingredient.baseUnit || ingredient.unit}</small></> : "—"}</td>
                <td className="px-4 py-2 text-right font-bold">{ingredient?.cost==null?"—":`${Math.round(requested*factor*ingredient.cost).toLocaleString("vi-VN")} đ`}</td><td className="px-4 py-2"><input value={item.note} onChange={(e) => updateLine(index, { note: e.target.value })} placeholder="Người/bộ phận nhận" className="h-10 w-full rounded-md border border-slate-300 px-3" /></td>
                <td className="px-4 py-2"><span className={`warehouse-badge ${insufficient?"status-deleted":requested<=0||!ingredient?"status-pending_explanation":""}`}>{insufficient?"Không đủ tồn":requested<=0||!ingredient?"Chưa xuất":"Hợp lệ"}</span></td><td className="px-2 py-2"><button aria-label="Xóa dòng" disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))} className="rounded-md p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
              </tr>;
            })}</tbody>
            <tfoot className="bg-slate-50 font-bold"><tr><td colSpan={3} className="px-4 py-3 text-right">Tổng số lượng</td><td className="px-4 py-3 text-right">{quantity(total)}</td><td colSpan={2}></td><td className="px-4 py-3 text-right">{form.items.some(item=>ingredientByCode.get(item.ingredientCode)?.cost==null)?"—":`${Math.round(form.items.reduce((sum,item)=>{const ingredient=ingredientByCode.get(item.ingredientCode);return sum+number(item.quantity)*(ingredient?.purchaseToBaseFactor||1)*(ingredient?.cost||0)},0)).toLocaleString("vi-VN")} đ`}</td><td colSpan={3}></td></tr></tfoot>
          </table>
        </div>
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-white p-4">
          <button disabled={saving} onClick={() => setForm((current) => ({ ...current, items: [...current.items, line()] }))} className="inline-flex min-h-10 items-center gap-2 rounded-md border px-4 font-semibold hover:bg-slate-50"><Plus className="h-4 w-4" /> Thêm dòng</button>
          <div className="flex gap-3">{form.status !== "completed" && <button disabled={saving} onClick={() => void save("draft")} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-emerald-800 px-5 font-bold text-emerald-900 disabled:opacity-50"><Save className="h-4 w-4" /> Lưu nháp</button>}
            <button disabled={saving} onClick={() => void save("completed")} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-800 px-5 font-bold text-white hover:bg-emerald-900 disabled:opacity-50"><PackageMinus className="h-4 w-4" /> {form.status === "completed" ? "Lưu & điều chỉnh tồn" : "Hoàn thành & trừ kho"}</button></div>
        </div>
      </section>

</InventoryIssueFormDialog>}

      <section className="mt-7 rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="text-xl font-black text-emerald-950">Lịch sử xuất kho</h2><p className="text-sm text-slate-500">Mới nhất hiển thị trước</p></div>
          <div className="flex w-full min-w-0 flex-wrap items-end gap-3 lg:w-auto"><InventoryDateFilter from={dateFrom} to={dateTo} onChange={(from,to)=>{setDateFrom(from);setDateTo(to);setPage(1)}}/><label className="relative w-full min-w-0 sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={historySearch} onChange={(e) => {setHistorySearch(e.target.value);setPage(1);}} placeholder="Tìm mã, nơi nhận..." className="h-10 w-full rounded-md border pl-9 pr-3" /></label></div></div>
        {loading ? <div className="p-12 text-center text-slate-500">Đang tải...</div> : issues.length === 0 ? <div className="p-12 text-center text-slate-500"><ClipboardList className="mx-auto mb-2 text-slate-300" />Chưa có phiếu xuất kho.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Thời gian tạo</th><th className="p-4">Mã phiếu</th><th className="p-4">Nơi nhận</th><th className="p-4">Người xuất</th><th className="p-4 text-right">Số dòng</th><th className="p-4 text-right">Tổng lượng</th><th className="p-4">Kho</th><th className="p-4">In tự động</th><th className="p-4"></th></tr></thead><tbody className="divide-y">{issues.map((issue) => {
          const printStatus = issue.printJob ? getPrintStatusPresentation(issue.printJob.status) : null;
          return <tr key={issue.id} className="hover:bg-slate-50"><td className="p-4">{new Date(issue.createdAt).toLocaleString("vi-VN")}<small className="block font-semibold text-emerald-700">{issue.shiftType ? (issue.shiftType === "single" ? "Ca làm việc" : `Ca ${issue.shiftType.slice(-1)}`) : "Không theo ca"}</small></td><td className="p-4 font-bold text-emerald-800">{issue.issueCode}</td><td className="p-4">{issue.destination}</td><td className="p-4">{issue.issuedBy}</td><td className="p-4 text-right">{issue.itemCount}</td><td className="p-4 text-right font-bold">{quantity(issue.totalQuantity)}</td><td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${issue.status === "cancelled" ? "bg-rose-100 text-rose-800" : issue.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{issue.status === "cancelled" ? "Đã hủy" : issue.status === "completed" ? "Đã trừ kho" : "Phiếu nháp"}</span>{issue.status === "cancelled" && <div className="mt-2 max-w-64 text-xs text-rose-700"><p className="whitespace-pre-wrap break-words">Lý do: {issue.cancelReason}</p><p>{issue.cancelledBy} · {issue.cancelledAt ? new Date(issue.cancelledAt).toLocaleString("vi-VN") : ""}</p></div>}</td><td className="p-4">{printStatus ? <><span className={`rounded-full px-3 py-1 text-xs font-bold ${printStatus.className}`}>{printStatus.label}</span>{issue.printJob?.lastError && <small className="mt-1 block max-w-48 text-rose-700" title={issue.printJob.lastError}>{issue.printJob.lastError}</small>}</> : <span className="text-slate-400">—</span>}</td><td className="p-4 text-right"><div className="flex flex-wrap justify-end gap-3">{issue.status === "completed" && printStatus?.canReprint && <button disabled={reprintingJobId === issue.id} onClick={() => void reprint(issue)} className="inline-flex items-center gap-1 font-bold text-blue-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> In lại</button>}{canManualPrintInventoryIssue(issue.status) && <button onClick={() => printInventoryIssue(issue)} className="inline-flex items-center gap-1 font-bold text-emerald-700"><Printer className="h-4 w-4" /> In thủ công</button>}{canEditIssue(role, issue.status) && <button disabled={saving} onClick={() => edit(issue)} className="font-bold text-emerald-700 disabled:opacity-50">Sửa</button>}{isAdmin && issue.status !== "cancelled" && <button disabled={saving} onClick={() => requestCancellation(issue)} className="font-bold text-rose-600 disabled:opacity-50">Hủy phiếu</button>}</div></td></tr>;
        })}</tbody></table></div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-3"><label className="flex items-center gap-2 text-sm text-slate-600">Số dòng / trang<select aria-label="Số phiếu xuất mỗi trang" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}} className="h-10 rounded-md border bg-white px-3">{[10,20,50,100].map(size=><option key={size} value={size}>{size}</option>)}</select></label><Pagination currentPage={page} totalItems={issueTotal} pageSize={pageSize} onPageChange={setPage} disabled={loading} className="min-h-0 max-w-full flex-wrap border-0 p-0 [&_button]:h-9 [&_button]:min-w-9 [&_button]:w-9 [&>div]:gap-1"/></footer>
      </section>
    </div>
    <ConfirmDialog
      open={confirmation !== null}
      title={typeof confirmation === "object" && confirmation ? `Hủy phiếu ${confirmation.issueCode}` : confirmation === "edit" ? `Lưu thay đổi ${form.issueCode}` : "Hoàn thành phiếu xuất kho"}
      description={<div>
        {typeof confirmation === "object" && confirmation ? <>
          <p>{confirmation.status === "completed" ? "Hủy phiếu sẽ hoàn lại lượng tồn đã trừ. Phiếu được giữ trong lịch sử." : "Phiếu nháp được giữ trong lịch sử với trạng thái đã hủy."}</p>
          <label className="mt-3 block font-semibold text-slate-900">Lý do hủy <span className="text-rose-600">*</span>
            <textarea value={cancelReason} disabled={saving} maxLength={1000} required rows={3} onChange={(event) => { setCancelReason(event.target.value); setDialogError(""); }} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Nhập lý do hủy phiếu..." />
          </label>
        </> : <p>{confirmation === "edit" ? "Lưu thông tin mới và điều chỉnh tồn theo chênh lệch giữa phiếu cũ và phiếu mới." : "Hoàn thành phiếu sẽ trừ tồn kho. Admin có thể sửa hoặc hủy phiếu khi cần."}</p>}
        {dialogError && <p role="alert" className="mt-3 text-rose-700">{dialogError}</p>}
      </div>}
      confirmLabel={typeof confirmation === "object" && confirmation ? "Hủy phiếu" : confirmation === "edit" ? "Lưu thay đổi" : "Hoàn thành"}
      cancelLabel="Quay lại"
      variant={typeof confirmation === "object" && confirmation ? "destructive" : "default"}
      isLoading={saving}
      onCancel={() => { setConfirmation(null); setDialogError(""); }}
      onConfirm={() => { if (typeof confirmation === "object" && confirmation) void cancelIssue(confirmation); else void save("completed", true); }}
    />
  </div>;
}
