"use client";

import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, Check, CheckCircle2, ChefHat, ChevronDown, Clock3, Coffee, GripVertical, History, Loader2, MonitorUp, Printer, RefreshCcw, RotateCcw, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { BarPrintJob, BarWorkflowStatus, subscribeBarBoard, subscribeBarHistory, updateBarWorkflowStatus } from "@/services/barPrintJobService";
type ActiveStatus = Exclude<BarWorkflowStatus, "collected">;
type AlertKind = "new" | "urgent";

const columns: Array<{ id: ActiveStatus; title: string; hint: string; icon: typeof BellRing; tone: string; badge: string }> = [
  { id: "new", title: "Bill mới", hint: "Chưa bắt đầu", icon: BellRing, tone: "border-amber-200 bg-amber-50/60", badge: "bg-amber-100 text-amber-800" },
  { id: "preparing", title: "Đang pha chế", hint: "Đã xem & đang làm", icon: Coffee, tone: "border-sky-200 bg-sky-50/60", badge: "bg-sky-100 text-sky-800" },
  { id: "ready", title: "Chờ khách lấy", hint: "Đã hoàn thành", icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50/60", badge: "bg-emerald-100 text-emerald-800" },
];

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
const getCreatedDate = (job: BarPrintJob) => job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date();
const getCollectedDate = (job: BarPrintJob) => job.collectedAt?.seconds ? new Date(job.collectedAt.seconds * 1000) : getCreatedDate(job);
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
  const totalQuantity = job.items.reduce((total, item) => total + item.quantity, 0);
  const actionLabel = job.workflowStatus === "new" ? "Bắt đầu pha" : job.workflowStatus === "preparing" ? "Đã pha xong" : "Khách đã lấy";
  return (
    <article draggable={!busy} onDragStart={(event) => { event.dataTransfer.setData("text/bar-job", job.id); event.dataTransfer.effectAllowed = "move"; }} className={`group rounded-2xl border bg-white p-3 shadow-sm transition duration-200 hover:shadow-md ${urgent ? "animate-pulse border-rose-400 ring-2 ring-rose-200" : warning ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"}`}>
      <details className="group/details [&_ul]:mt-3">
        <summary className="cursor-pointer list-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-2"><GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" /><h3 className="truncate text-lg font-black text-slate-900">{job.tableNumber || "Mang về"}</h3></div><p className="mt-1 pl-6 text-xs font-bold uppercase tracking-wider text-slate-400">#{shortCode(job)}</p></div>
        <div className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${urgent ? "bg-rose-100 text-rose-700" : warning ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}><Clock3 className="h-3.5 w-3.5" />{minutes} phút</div>
      </div>
        <div className="mt-2 flex items-center justify-between border-t border-dashed border-slate-200 pt-2 pl-6 text-xs font-bold text-slate-500 transition hover:text-slate-800">
          <span>{job.items.length} món · {formatQuantity(totalQuantity)} phần</span>
          <span className="flex items-center gap-1">Xem chi tiết <ChevronDown className="h-4 w-4 transition-transform group-open/details:rotate-180" /></span>
        </div>
        </summary>
      <ul className="space-y-2.5">{job.items.map((item, index) => <li key={`${item.menuId}-${index}`} className="flex gap-3 text-sm"><span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900 px-1.5 font-black text-white">{formatQuantity(item.quantity)}</span><div className="min-w-0 pt-0.5"><p className="font-bold leading-5 text-slate-800">{item.name}</p>{item.note ? <p className="mt-0.5 text-xs font-semibold text-rose-600">Ghi chú: {item.note}</p> : null}</div></li>)}</ul>
      </details>
      <div className="mt-3 flex gap-2">
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<BarPrintJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [now, setNow] = useState(Date.now());
  const knownIds = useRef<Set<string> | null>(null);
  const alertAudio = useRef<Partial<Record<AlertKind, HTMLAudioElement>>>({});
  const urgentIds = useRef<Set<string> | null>(null);

  const playAlert = useCallback((kindOrForce: AlertKind | boolean = "new", force = false) => {
    const kind: AlertKind = typeof kindOrForce === "string" ? kindOrForce : "new";
    const shouldForce = typeof kindOrForce === "boolean" ? kindOrForce : force;
    if (!soundEnabled && !shouldForce) return;
    try {
      const fileName = kind === "urgent" ? "bill-bao-do" : "mon-moi";
      const audio = alertAudio.current[kind] || new Audio(`/audio/${fileName}.mp3`);
      alertAudio.current[kind] = audio;
      audio.currentTime = 0;
      void audio.play().catch((error) => console.warn("Trình duyệt đã chặn âm báo", error));
    } catch (error) { console.warn("Không phát được âm báo", error); }
  }, [soundEnabled]);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    setLoading(true); knownIds.current = null; urgentIds.current = null;
    return subscribeBarBoard(storeId, (nextJobs) => {
      const nextIds = new Set(nextJobs.map((job) => job.id));
      if (knownIds.current && nextJobs.some((job) => job.workflowStatus === "new" && !knownIds.current?.has(job.id))) playAlert();
      knownIds.current = nextIds; setJobs(nextJobs); setLoading(false); setSyncError("");
    }, () => { setLoading(false); setSyncError("Mất kết nối dữ liệu. Hệ thống đang thử kết nối lại…"); });
  }, [playAlert, storeId]);
  useEffect(() => {
    const nextUrgentIds = new Set(jobs.filter((job) => elapsedMinutes(job, now) >= 15).map((job) => job.id));
    if (urgentIds.current && [...nextUrgentIds].some((id) => !urgentIds.current?.has(id))) playAlert("urgent");
    urgentIds.current = nextUrgentIds;
  }, [jobs, now, playAlert]);
  useEffect(() => {
    if (!jobs.some((job) => job.workflowStatus === "new")) return;
    const reminder = window.setInterval(() => playAlert("new"), 2000);
    return () => window.clearInterval(reminder);
  }, [jobs, playAlert]);
  useEffect(() => {
    if (!historyOpen) return;
    setHistoryLoading(true);
    return subscribeBarHistory(storeId, (nextJobs) => {
      setHistoryJobs(nextJobs); setHistoryLoading(false); setHistoryError("");
    }, () => { setHistoryLoading(false); setHistoryError("Không tải được lịch sử. Vui lòng thử lại."); });
  }, [historyOpen, storeId]);
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
  return <RoleGuard permission={role === "bartender" ? "bar.access" : "bills.access"}><main className="min-h-screen bg-[#f4f6f3] text-slate-900">
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:px-6"><div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-900 text-amber-300"><ChefHat className="h-6 w-6" /></div><div><div className="flex items-center gap-2"><h1 className="text-xl font-black tracking-tight">Màn hình pha chế</h1><span className="hidden rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 sm:inline">TRỰC TIẾP</span></div><p className="text-xs font-medium text-slate-500">{storeName} · cập nhật mỗi 2 giây</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setHistoryOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><History className="h-4 w-4" /><span className="hidden sm:inline">Lịch sử đã lấy</span></button><Link href="/pos" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><MonitorUp className="h-4 w-4" />POS</Link><button type="button" onClick={() => { const next = !soundEnabled; setSoundEnabled(next); if (next) window.setTimeout(() => playAlert(true), 0); }} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition ${soundEnabled ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-500"}`}>{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}<span className="hidden sm:inline">Âm báo</span></button><span className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white" title="Phiếu được Windows Print Agent gửi thẳng tới máy in LAN"><Printer className="h-4 w-4" />In tự động qua agent</span></div>
    </div></header>
    <section className="mx-auto max-w-[1800px] overflow-x-auto p-4 md:p-6">
      {syncError ? <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><RefreshCcw className="h-4 w-4 animate-spin" />{syncError}</div> : null}
      <div className="mb-4 flex min-w-[980px] flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Sparkles className="h-4 w-4 text-amber-500" />Kéo bill sang cột kế tiếp hoặc dùng nút trên từng bill.</p><p className="text-sm font-bold text-slate-600">{jobs.length} bill đang hoạt động</p></div>
      <div className="grid min-w-[980px] grid-cols-3 gap-4 xl:gap-6">{columns.map((column) => { const Icon = column.icon; const columnJobs = grouped[column.id]; return <section key={column.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragOver(column.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null); }} onDrop={(event) => handleDrop(event, column.id)} className={`min-h-[calc(100vh-155px)] rounded-3xl border p-3 transition-all xl:p-4 ${column.tone} ${dragOver === column.id ? "scale-[1.005] border-emerald-500 ring-4 ring-emerald-200/70" : ""}`}>
        <div className="mb-4 flex items-center justify-between px-1"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm"><Icon className="h-5 w-5" /></div><div><h2 className="font-black">{column.title}</h2><p className="text-xs font-medium text-slate-500">{column.hint}</p></div></div><span className={`rounded-full px-3 py-1 text-sm font-black ${column.badge}`}>{columnJobs.length}</span></div>
        <div className="space-y-3">{loading ? Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl bg-white/80" />) : columnJobs.length ? columnJobs.map((job) => <BillCard key={job.id} job={job} now={now} busy={busyIds.has(job.id)} onMove={moveJob} onPrint={printTicket} />) : <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 p-6 text-center"><Icon className="mb-3 h-8 w-8 text-slate-300" /><p className="font-bold text-slate-500">Chưa có bill</p><p className="mt-1 text-xs text-slate-400">Thả bill vào đây</p></div>}</div>
      </section>; })}</div>
    </section>
    {historyOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}>
      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="flex items-center gap-2 text-lg font-black"><History className="h-5 w-5 text-emerald-700" />Lịch sử bill khách đã lấy</h2><p className="mt-1 text-xs font-medium text-slate-500">100 bill gần nhất · cập nhật trực tiếp</p></div><button type="button" onClick={() => setHistoryOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Đóng lịch sử"><X className="h-5 w-5" /></button></div>
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {historyError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{historyError}</div> : null}
          {historyLoading ? <div className="flex h-40 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Đang tải lịch sử...</div> : historyJobs.length ? <div className="space-y-3">{historyJobs.map((job) => <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{job.tableNumber || "Mang về"}</h3><p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">#{shortCode(job)}</p></div><div className="text-right"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Đã lấy</span><p className="mt-1 text-xs font-medium text-slate-500">{getCollectedDate(job).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}</p></div></div><div className="my-3 border-t border-dashed border-slate-200" /><ul className="space-y-1.5">{job.items.map((item, index) => <li key={`${job.id}-${item.menuId}-${index}`} className="flex justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{item.name}{item.note ? <span className="ml-1 text-xs text-rose-600">({item.note})</span> : null}</span><span className="shrink-0 font-black text-slate-900">×{formatQuantity(item.quantity)}</span></li>)}</ul></article>)}</div> : <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400"><History className="mb-3 h-9 w-9" /><p className="font-bold text-slate-500">Chưa có lịch sử</p><p className="mt-1 text-xs">Bill sẽ xuất hiện sau khi xác nhận khách đã lấy.</p></div>}
        </div>
      </aside>
    </div> : null}
  </main></RoleGuard>;
}
