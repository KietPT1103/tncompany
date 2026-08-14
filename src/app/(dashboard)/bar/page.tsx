"use client";

import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, Check, CheckCircle2, ChefHat, Clock3, Coffee, GripVertical, Loader2, MonitorUp, Printer, RefreshCcw, RotateCcw, Sparkles, Volume2, VolumeX } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { BarPrintJob, BarWorkflowStatus, markBarPrintJobPrinted, subscribeBarBoard, subscribePendingBarPrintJobs, updateBarWorkflowStatus } from "@/services/barPrintJobService";

const AUTO_PRINT_KEY = "pos:bar-auto-print";
const TERMINAL_KEY = "pos:bar-terminal-name";
type ActiveStatus = Exclude<BarWorkflowStatus, "collected">;

const columns: Array<{ id: ActiveStatus; title: string; hint: string; icon: typeof BellRing; tone: string; badge: string }> = [
  { id: "new", title: "Bill mới", hint: "Chưa bắt đầu", icon: BellRing, tone: "border-amber-200 bg-amber-50/60", badge: "bg-amber-100 text-amber-800" },
  { id: "preparing", title: "Đang pha chế", hint: "Đã xem & đang làm", icon: Coffee, tone: "border-sky-200 bg-sky-50/60", badge: "bg-sky-100 text-sky-800" },
  { id: "ready", title: "Chờ khách lấy", hint: "Đã hoàn thành", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50/60", badge: "bg-emerald-100 text-emerald-800" },
];

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
const getCreatedDate = (job: BarPrintJob) => job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date();
const shortCode = (job: BarPrintJob) => { const value = job.sourceBillId || job.id; return (value.length > 10 ? value.slice(-8) : value).toUpperCase(); };
const formatQuantity = (quantity: number) => Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const elapsedMinutes = (job: BarPrintJob, now: number) => Math.max(0, Math.floor((now - getCreatedDate(job).getTime()) / 60000));

const printTicket = (job: BarPrintJob) => {
  const rows = job.items.map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong>${item.note ? `<div class="note">• ${escapeHtml(item.note)}</div>` : ""}</td><td>${formatQuantity(item.quantity)}</td></tr>`).join("");
  const created = getCreatedDate(job).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  const html = `<html lang="vi"><head><meta charset="UTF-8"><title>Phiếu pha chế</title><style>@page{size:80mm auto;margin:4mm}body{font-family:Tahoma,Arial,sans-serif;width:72mm;margin:0;color:#111}h1{text-align:center;font-size:19px;margin:0 0 8px}p{margin:3px 0;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}th,td{padding:6px 0;border-bottom:1px solid #111;text-align:left;vertical-align:top}th:last-child,td:last-child{text-align:right;width:18%;font-weight:700}.note{font-size:12px;margin-top:3px}.tail{height:14mm}</style></head><body><h1>PHIẾU PHA CHẾ</h1><p><strong>${escapeHtml(job.tableNumber || "Mang về")}</strong></p><p>Mã: ${escapeHtml(shortCode(job))}</p><p>${created}</p><table><thead><tr><th>Món</th><th>SL</th></tr></thead><tbody>${rows}</tbody></table><div class="tail"></div></body></html>`;
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const printDocument = iframe.contentWindow?.document;
  if (!printDocument) throw new Error("Không thể tạo phiếu in.");
  printDocument.open(); printDocument.write(html); printDocument.close();
  iframe.onload = () => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); window.setTimeout(() => iframe.remove(), 700); };
};

function BillCard({ job, now, busy, onMove, onPrint }: { job: BarPrintJob; now: number; busy: boolean; onMove: (job: BarPrintJob, status: BarWorkflowStatus) => void; onPrint: (job: BarPrintJob) => void }) {
  const minutes = elapsedMinutes(job, now);
  const urgent = minutes >= 15;
  const warning = minutes >= 8;
  const nextStatus: BarWorkflowStatus = job.workflowStatus === "new" ? "preparing" : job.workflowStatus === "preparing" ? "ready" : "collected";
  const actionLabel = job.workflowStatus === "new" ? "Bắt đầu pha" : job.workflowStatus === "preparing" ? "Đã pha xong" : "Khách đã lấy";
  return (
    <article draggable={!busy} onDragStart={(event) => { event.dataTransfer.setData("text/bar-job", job.id); event.dataTransfer.effectAllowed = "move"; }} className={`group rounded-2xl border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${urgent ? "animate-pulse border-rose-400 ring-2 ring-rose-200" : warning ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-2"><GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" /><h3 className="truncate text-lg font-black text-slate-900">{job.tableNumber || "Mang về"}</h3></div><p className="mt-1 pl-6 text-xs font-bold uppercase tracking-wider text-slate-400">#{shortCode(job)}</p></div>
        <div className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${urgent ? "bg-rose-100 text-rose-700" : warning ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}><Clock3 className="h-3.5 w-3.5" />{minutes} phút</div>
      </div>
      <div className="my-3 border-t border-dashed border-slate-200" />
      <ul className="space-y-2.5">{job.items.map((item, index) => <li key={`${item.menuId}-${index}`} className="flex gap-3 text-sm"><span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900 px-1.5 font-black text-white">{formatQuantity(item.quantity)}</span><div className="min-w-0 pt-0.5"><p className="font-bold leading-5 text-slate-800">{item.name}</p>{item.note ? <p className="mt-0.5 text-xs font-semibold text-rose-600">Ghi chú: {item.note}</p> : null}</div></li>)}</ul>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => onPrint(job)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100" title="In lại phiếu"><Printer className="h-4 w-4" /></button>
        {job.workflowStatus !== "new" ? <button type="button" disabled={busy} onClick={() => onMove(job, job.workflowStatus === "ready" ? "preparing" : "new")} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50" title="Chuyển lại"><RotateCcw className="h-4 w-4" /></button> : null}
        <button type="button" disabled={busy} onClick={() => onMove(job, nextStatus)} className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold text-white transition active:scale-[.98] disabled:opacity-60 ${job.workflowStatus === "ready" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{actionLabel}</button>
      </div>
    </article>
  );
}

export default function BarBoardPage() {
  const { role, user } = useAuth();
  const { storeId: selectedStoreId, storeName } = useStore();
  const assignedStore = user?.storeId === "cafe" || user?.storeId === "restaurant" || user?.storeId === "bakery" || user?.storeId === "farm" ? user.storeId : null;
  const storeId = (role === "user" || role === "server" || role === "bartender") && assignedStore ? assignedStore : selectedStoreId;
  const [jobs, setJobs] = useState<BarPrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<BarWorkflowStatus | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [now, setNow] = useState(Date.now());
  const knownIds = useRef<Set<string> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const printingIds = useRef(new Set<string>());
  const terminalName = "Máy pha chế";
  const autoPrintKey = `${AUTO_PRINT_KEY}:${storeId}`;
  const terminalKey = `${TERMINAL_KEY}:${storeId}`;

  const playAlert = useCallback((force = false) => {
    if (!soundEnabled && !force) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioContext.current || new AudioContextClass(); audioContext.current = context; void context.resume();
      [0, 0.16].forEach((delay) => { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 880; gain.gain.setValueAtTime(0.0001, context.currentTime + delay); gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + delay + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.12); oscillator.connect(gain).connect(context.destination); oscillator.start(context.currentTime + delay); oscillator.stop(context.currentTime + delay + 0.13); });
    } catch (error) { console.warn("Không phát được âm báo", error); }
  }, [soundEnabled]);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { try { setAutoPrint(localStorage.getItem(autoPrintKey) === "1"); } catch { setAutoPrint(false); } }, [autoPrintKey]);
  useEffect(() => {
    setLoading(true); knownIds.current = null;
    return subscribeBarBoard(storeId, (nextJobs) => {
      const nextIds = new Set(nextJobs.map((job) => job.id));
      if (knownIds.current && nextJobs.some((job) => job.workflowStatus === "new" && !knownIds.current?.has(job.id))) playAlert();
      knownIds.current = nextIds; setJobs(nextJobs); setLoading(false); setSyncError("");
    }, () => { setLoading(false); setSyncError("Mất kết nối dữ liệu. Hệ thống đang thử kết nối lại…"); });
  }, [playAlert, storeId]);
  useEffect(() => {
    if (!autoPrint) return;
    return subscribePendingBarPrintJobs(storeId, (pendingJobs) => pendingJobs.forEach(async (job) => {
      if (printingIds.current.has(job.id)) return;
      printingIds.current.add(job.id);
      try { if (job.items.length) printTicket(job); await markBarPrintJobPrinted(job.id, localStorage.getItem(terminalKey) || terminalName); }
      catch (error) { console.error("Không tự in được phiếu pha chế", error); }
      finally { printingIds.current.delete(job.id); }
    }));
  }, [autoPrint, storeId, terminalKey]);

  const grouped = useMemo(() => Object.fromEntries(columns.map((column) => [column.id, jobs.filter((job) => job.workflowStatus === column.id)])) as Record<ActiveStatus, BarPrintJob[]>, [jobs]);
  const moveJob = async (job: BarPrintJob, status: BarWorkflowStatus) => {
    if (job.workflowStatus === status || busyIds.has(job.id)) return;
    const previous = job.workflowStatus;
    setBusyIds((ids) => new Set(ids).add(job.id));
    setJobs((items) => status === "collected" ? items.filter((item) => item.id !== job.id) : items.map((item) => item.id === job.id ? { ...item, workflowStatus: status } : item));
    try { await updateBarWorkflowStatus(job.id, status, storeId); }
    catch (error) { console.error(error); setJobs((items) => [...items.filter((item) => item.id !== job.id), { ...job, workflowStatus: previous }].sort((a, b) => getCreatedDate(a).getTime() - getCreatedDate(b).getTime())); setSyncError("Không cập nhật được bill. Vui lòng thử lại."); }
    finally { setBusyIds((ids) => { const next = new Set(ids); next.delete(job.id); return next; }); }
  };
  const handleDrop = (event: DragEvent, status: BarWorkflowStatus) => { event.preventDefault(); setDragOver(null); const job = jobs.find((item) => item.id === event.dataTransfer.getData("text/bar-job")); if (job) void moveJob(job, status); };
  const toggleAutoPrint = () => { const next = !autoPrint; setAutoPrint(next); try { localStorage.setItem(autoPrintKey, next ? "1" : "0"); localStorage.setItem(terminalKey, terminalName); } catch { /* localStorage may be unavailable */ } };

  return <RoleGuard permission={role === "bartender" ? "bar.access" : "bills.access"}><main className="min-h-screen bg-[#f4f6f3] text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:px-6"><div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-900 text-amber-300"><ChefHat className="h-6 w-6" /></div><div><div className="flex items-center gap-2"><h1 className="text-xl font-black tracking-tight">Màn hình pha chế</h1><span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 sm:inline">TRỰC TIẾP</span></div><p className="text-xs font-medium text-slate-500">{storeName} · cập nhật mỗi 2 giây</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><Link href="/pos" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><MonitorUp className="h-4 w-4" />POS</Link><button type="button" onClick={() => { const next = !soundEnabled; setSoundEnabled(next); if (next) window.setTimeout(() => playAlert(true), 0); }} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${soundEnabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500"}`}>{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}<span className="hidden sm:inline">Âm báo</span></button><button type="button" onClick={toggleAutoPrint} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white transition ${autoPrint ? "bg-emerald-700 hover:bg-emerald-800" : "bg-slate-700 hover:bg-slate-800"}`}><Printer className="h-4 w-4" />{autoPrint ? "Đang tự in" : "Bật tự in bill"}</button></div>
    </div></header>
    <section className="mx-auto max-w-[1800px] overflow-x-auto p-4 md:p-6">
      {syncError ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><RefreshCcw className="h-4 w-4 animate-spin" />{syncError}</div> : null}
      <div className="mb-4 flex min-w-[980px] flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Sparkles className="h-4 w-4 text-amber-500" />Kéo bill sang cột kế tiếp hoặc dùng nút trên từng bill.</p><p className="text-sm font-bold text-slate-600">{jobs.length} bill đang hoạt động</p></div>
      <div className="grid min-w-[980px] grid-cols-3 gap-4 xl:gap-6">{columns.map((column) => { const Icon = column.icon; const columnJobs = grouped[column.id]; return <section key={column.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOver(column.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null); }} onDrop={(event) => handleDrop(event, column.id)} className={`min-h-[calc(100vh-155px)] rounded-3xl border p-3 transition-all xl:p-4 ${column.tone} ${dragOver === column.id ? "scale-[1.005] border-emerald-500 ring-4 ring-emerald-200/70" : ""}`}>
        <div className="mb-4 flex items-center justify-between px-1"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm"><Icon className="h-5 w-5" /></div><div><h2 className="font-black">{column.title}</h2><p className="text-xs font-medium text-slate-500">{column.hint}</p></div></div><span className={`rounded-full px-3 py-1 text-sm font-black ${column.badge}`}>{columnJobs.length}</span></div>
        <div className="space-y-3">{loading ? Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-white/80" />) : columnJobs.length ? columnJobs.map((job) => <BillCard key={job.id} job={job} now={now} busy={busyIds.has(job.id)} onMove={moveJob} onPrint={printTicket} />) : <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 p-6 text-center"><Icon className="mb-3 h-8 w-8 text-slate-300" /><p className="font-bold text-slate-500">Chưa có bill</p><p className="mt-1 text-xs text-slate-400">Thả bill vào đây</p></div>}</div>
      </section>; })}</div>
    </section>
  </main></RoleGuard>;
}
