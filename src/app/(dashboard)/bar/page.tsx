"use client";

import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  Coffee,
  GripVertical,
  History,
  Loader2,
  Maximize2,
  Printer,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import AdminSidebar from "@/AdminSidebar";
import { AdminMobileHeader } from "@/components/admin/AdminMobileHeader";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import {
  BarPrintJob,
  BarWorkflowStatus,
  markBarPrintJobPrinted,
  subscribeBarBoard,
  subscribeBarHistory,
  updateBarWorkflowStatus,
} from "@/services/barPrintJobService";
import BarNavigationSidebar from "./BarNavigationSidebar";
import BarBillDetailDialog from "./BarBillDetailDialog";
import {
  barBillDetailReducer,
  initialBarBillDetailState,
  shouldOpenBarBillDetailFromCard,
} from "./barBillDetailState";
import { getBarSidebarVariant } from "./barSidebarState";
import {
  BAR_URGENT_PULSE_INTERVAL_MS,
  getBarUrgentPulsePhase,
  getBarWaitState,
} from "./barWaitState";

const AUTO_PRINT_KEY = "pos:bar-auto-print";
const TERMINAL_KEY = "pos:bar-terminal-name";
const ADMIN_SIDEBAR_STORAGE_KEY = "admin_sidebar_collapsed";
type ActiveStatus = Exclude<BarWorkflowStatus, "collected">;
type AlertKind = "new" | "urgent";

const columns: Array<{
  id: ActiveStatus;
  title: string;
  hint: string;
  icon: typeof BellRing;
  tone: string;
  badge: string;
}> = [
  {
    id: "new",
    title: "Bill mới",
    hint: "Chưa bắt đầu",
    icon: BellRing,
    tone: "border-amber-200 bg-amber-50/60",
    badge: "bg-amber-100 text-amber-800",
  },
  {
    id: "preparing",
    title: "Đang pha chế",
    hint: "Đã xem & đang làm",
    icon: Coffee,
    tone: "border-sky-200 bg-sky-50/60",
    badge: "bg-sky-100 text-sky-800",
  },
  {
    id: "ready",
    title: "Chờ khách lấy",
    hint: "Đã hoàn thành",
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50/60",
    badge: "bg-emerald-100 text-emerald-800",
  },
];

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] || character,
  );
const getCreatedDate = (job: BarPrintJob) =>
  job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date();
const getCollectedDate = (job: BarPrintJob) =>
  job.collectedAt?.seconds
    ? new Date(job.collectedAt.seconds * 1000)
    : getCreatedDate(job);
const shortCode = (job: BarPrintJob) => {
  const value = job.sourceBillId || job.id;
  return (value.length > 10 ? value.slice(-8) : value).toUpperCase();
};
const formatQuantity = (quantity: number) =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const elapsedMinutes = (job: BarPrintJob, now: number) =>
  Math.max(0, Math.floor((now - getCreatedDate(job).getTime()) / 60000));
const getInitialAdminSidebarCollapsed = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const printTicket = (job: BarPrintJob) => {
  const rows = job.items
    .map(
      (item) =>
        `<tr><td><strong>${escapeHtml(item.name)}</strong>${item.note ? `<div class="note">• ${escapeHtml(item.note)}</div>` : ""}</td><td>${formatQuantity(item.quantity)}</td></tr>`,
    )
    .join("");
  const created = getCreatedDate(job).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const html = `<html lang="vi"><head><meta charset="UTF-8"><title>Phiếu pha chế</title><style>@page{size:80mm auto;margin:4mm}body{font-family:Tahoma,Arial,sans-serif;width:72mm;margin:0;color:#111}h1{text-align:center;font-size:19px;margin:0 0 8px}p{margin:3px 0;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}th,td{padding:6px 0;border-bottom:1px solid #111;text-align:left;vertical-align:top}th:last-child,td:last-child{text-align:right;width:18%;font-weight:700}.note{font-size:12px;margin-top:3px}.tail{height:14mm}</style></head><body><h1>PHIẾU PHA CHẾ</h1><p><strong>${escapeHtml(job.tableNumber || "Mang về")}</strong></p><p>Mã: ${escapeHtml(shortCode(job))}</p><p>${created}</p><table><thead><tr><th>Món</th><th>SL</th></tr></thead><tbody>${rows}</tbody></table><div class="tail"></div></body></html>`;
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.appendChild(iframe);
  const printDocument = iframe.contentWindow?.document;
  if (!printDocument) throw new Error("Không thể tạo phiếu in.");
  printDocument.open();
  printDocument.write(html);
  printDocument.close();
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 700);
  };
};

function BillCard({
  job,
  now,
  busy,
  urgentPulseActive,
  onMove,
  onPrint,
  onShowDetails,
}: {
  job: BarPrintJob;
  now: number;
  busy: boolean;
  urgentPulseActive: boolean;
  onMove: (job: BarPrintJob, status: BarWorkflowStatus) => void;
  onPrint: (job: BarPrintJob) => void;
  onShowDetails: (job: BarPrintJob) => void;
}) {
  const dragPreviewRef = useRef<HTMLElement | null>(null);
  const nativeDragImageRef = useRef<HTMLCanvasElement | null>(null);
  const didDragRef = useRef(false);
  const dragPointerOffsetRef = useRef({ x: 0, y: 0 });
  const minutes = elapsedMinutes(job, now);
  const waitState = getBarWaitState(minutes);
  const urgent = waitState === "urgent";
  const warning = waitState === "warning";
  const isNew = job.workflowStatus === "new";
  const isPreparing = job.workflowStatus === "preparing";
  const isReady = job.workflowStatus === "ready";
  const nextStatus: BarWorkflowStatus =
    job.workflowStatus === "new"
      ? "preparing"
      : job.workflowStatus === "preparing"
        ? "ready"
        : "collected";
  const totalQuantity = job.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const actionLabel =
    job.workflowStatus === "new"
      ? "Bắt đầu pha"
      : job.workflowStatus === "preparing"
        ? "Đã pha xong"
        : "Khách đã lấy";

  const removeDragPreview = useCallback(() => {
    dragPreviewRef.current?.remove();
    nativeDragImageRef.current?.remove();
    dragPreviewRef.current = null;
    nativeDragImageRef.current = null;
  }, []);

  const positionDragPreview = useCallback((clientX: number, clientY: number) => {
    const preview = dragPreviewRef.current;
    if (!preview || (clientX === 0 && clientY === 0)) return;
    const { x, y } = dragPointerOffsetRef.current;
    preview.style.transform = `translate3d(${clientX - x}px, ${clientY - y}px, 0) rotate(0.6deg) scale(1.015)`;
  }, []);

  useEffect(() => removeDragPreview, [removeDragPreview]);

  return (
    <article
      draggable={!busy}
      data-urgent={urgent ? "true" : undefined}
      data-urgent-pulse={urgent ? (urgentPulseActive ? "on" : "off") : undefined}
      onClick={() => {
        if (shouldOpenBarBillDetailFromCard(didDragRef.current)) {
          onShowDetails(job);
        }
      }}
      onDragStart={(event) => {
        didDragRef.current = true;
        event.dataTransfer.setData("text/bar-job", job.id);
        event.dataTransfer.effectAllowed = "move";

        removeDragPreview();
        const source = event.currentTarget;
        const bounds = source.getBoundingClientRect();
        dragPointerOffsetRef.current = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };

        const nativeDragImage = document.createElement("canvas");
        nativeDragImage.width = 1;
        nativeDragImage.height = 1;
        Object.assign(nativeDragImage.style, {
          position: "fixed",
          left: "-2px",
          top: "-2px",
          pointerEvents: "none",
        });
        document.body.appendChild(nativeDragImage);
        nativeDragImageRef.current = nativeDragImage;
        event.dataTransfer.setDragImage(nativeDragImage, 0, 0);

        const preview = source.cloneNode(true) as HTMLElement;
        preview.removeAttribute("draggable");
        preview.setAttribute("aria-hidden", "true");
        preview.dataset.barDragPreview = "true";
        Object.assign(preview.style, {
          position: "fixed",
          inset: "0 auto auto 0",
          zIndex: "9999",
          width: `${bounds.width}px`,
          maxHeight: `calc(100vh - 24px)`,
          margin: "0",
          overflow: "hidden",
          pointerEvents: "none",
          opacity: "1",
          animation: "none",
          filter: "none",
          backgroundColor: "white",
          boxShadow: "0 18px 44px rgba(15, 23, 42, 0.22)",
          transformOrigin: "top left",
          transition: "box-shadow 140ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        });
        document.body.appendChild(preview);
        dragPreviewRef.current = preview;
        positionDragPreview(event.clientX, event.clientY);
      }}
      onDrag={(event) => positionDragPreview(event.clientX, event.clientY)}
      onDragEnd={() => {
        removeDragPreview();
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 0);
      }}
      className={`group cursor-pointer transform-gpu border p-3 transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(15,23,42,0.12)] motion-reduce:transform-none motion-reduce:transition-none ${urgent && urgentPulseActive ? "bg-red-50/60" : "bg-white"} ${isNew ? `rounded-xl border-l-[5px] ${urgent ? "border-l-red-500" : "border-l-[#F6C85F] shadow-[0_4px_14px_rgba(15,23,42,0.08)]"}` : isPreparing ? `rounded-xl border-l-4 ${urgent ? "border-l-red-500" : "border-l-[#1265D6] shadow-[0_4px_14px_rgba(18,101,214,0.09)]"}` : isReady ? `rounded-xl border-l-4 ${urgent ? "border-l-red-500" : "border-l-[#064E3B] shadow-[0_4px_14px_rgba(6,78,59,0.1)]"}` : "rounded-sm shadow-sm"} ${urgent ? `border-slate-200 ${urgentPulseActive ? "shadow-[0_10px_26px_rgba(220,38,38,0.24)]" : "shadow-[0_4px_14px_rgba(220,38,38,0.12)]"} motion-reduce:bg-white motion-reduce:shadow-[0_4px_14px_rgba(220,38,38,0.14)]` : warning ? "border-slate-200 ring-2 ring-slate-100" : "border-slate-200"}`}
    >
      <div>
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300 active:cursor-grabbing" />
                <h3 className="truncate text-lg font-black text-slate-900">
                  {job.tableNumber || "Mang về"}
                </h3>
              </div>
              <p className="mt-1 pl-6 text-xs font-bold uppercase tracking-wider text-slate-400">
                #{shortCode(job)}
              </p>
            </div>
            <div
              className={`flex shrink-0 ${isPreparing || isReady ? "flex-col items-end gap-1" : ""}`}
            >
              <div
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${urgent ? "bg-rose-100 text-red-700 ring-1 ring-inset ring-red-200" : warning ? "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-sm"}`}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {minutes} phút
              </div>
              {isPreparing ? (
                <span
                  className={`flex items-center gap-1 text-[10px] font-bold ${urgent ? "text-red-700" : "text-[#315A8A]"}`}
                >
                  Đang pha chế
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${urgent ? "bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.14)]" : "bg-[#1265D6] shadow-[0_0_0_3px_rgba(18,101,214,0.12)]"}`}
                  />
                </span>
              ) : isReady ? (
                <span
                  className={`flex items-center gap-1 text-[10px] font-bold ${urgent ? "text-red-700" : "text-[#16634F]"}`}
                >
                  Chờ khách lấy
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${urgent ? "bg-red-600 shadow-[0_0_0_3px_rgba(220,38,38,0.14)]" : "bg-[#F6C85F] shadow-[0_0_0_3px_rgba(246,200,95,0.2)]"}`}
                  />
                </span>
              ) : null}
            </div>
          </div>
          <div
            className={`mt-2 flex items-center justify-between border-t border-dashed border-slate-200 pl-6 pt-2 text-xs font-bold leading-5 transition hover:text-slate-900 ${isNew ? "text-slate-700" : "text-slate-500"}`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${urgent ? "bg-red-600 text-white" : isNew ? "bg-[#FFF3D2] text-[#D89200]" : isPreparing ? "bg-[#EAF3FF] text-[#1265D6]" : isReady ? "bg-[#FFF3D2] text-[#064E3B]" : "bg-slate-100 text-slate-600"}`}
              >
                <Coffee className="h-4 w-4 stroke-[2.4]" />
              </span>
              <span>
                {job.items.length} món · {formatQuantity(totalQuantity)} phần
              </span>
            </span>
            <button
              type="button"
              draggable={false}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onShowDetails(job);
              }}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${urgent ? "hover:bg-red-50 focus-visible:ring-red-500" : isNew ? "hover:bg-[#FFF9EC] focus-visible:ring-[#F6C85F]" : isPreparing ? "hover:bg-[#EAF3FF] focus-visible:ring-[#1265D6]" : "hover:bg-[#E8F3EE] focus-visible:ring-[#064E3B]"}`}
              aria-label={`Xem chi tiết bill ${job.tableNumber || "Mang về"}`}
            >
              Xem chi tiết{" "}
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          draggable={false}
          onClick={(event) => {
            event.stopPropagation();
            onPrint(job);
          }}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${urgent ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500" : isNew ? "bg-[#FFF3D2] text-slate-900 hover:bg-[#FFE7A3] focus-visible:ring-[#F6C85F]" : isPreparing ? "border border-[#B9D5FA] bg-white text-[#1265D6] hover:bg-[#EEF5FF] focus-visible:ring-[#1265D6]" : isReady ? "border border-[#B8D8CC] bg-white text-[#064E3B] hover:bg-[#FFF8E5] focus-visible:ring-[#F6C85F]" : "border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400"}`}
          title="In lại phiếu"
        >
          <Printer className="h-4 w-4" />
        </button>
        {job.workflowStatus !== "new" ? (
          <button
            type="button"
            draggable={false}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onMove(
                job,
                job.workflowStatus === "ready" ? "preparing" : "new",
              );
            }}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${urgent ? "border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 focus-visible:ring-red-500" : isPreparing ? "border-[#B9D5FA] bg-white text-[#1265D6] hover:bg-[#EEF5FF] focus-visible:ring-[#1265D6]" : isReady ? "border-[#B8D8CC] bg-white text-[#064E3B] hover:bg-[#FFF8E5] focus-visible:ring-[#F6C85F]" : "border-slate-200 text-slate-500 hover:bg-slate-100 focus-visible:ring-slate-400"}`}
            title="Chuyển lại"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          draggable={false}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onMove(job, nextStatus);
          }}
          className={`group/action inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[.98] disabled:opacity-60 ${urgent ? "bg-red-600 text-white shadow-[0_3px_8px_rgba(220,38,38,0.28)] hover:bg-red-700 focus-visible:ring-red-500" : isNew ? "bg-[#161616] text-[#F6C85F] shadow-[0_3px_8px_rgba(15,23,42,0.2)] hover:bg-black focus-visible:ring-[#F6C85F]" : isPreparing ? "bg-[#1265D6] text-white shadow-[0_3px_8px_rgba(18,101,214,0.22)] hover:bg-[#0D5DC4] focus-visible:ring-[#1265D6]" : isReady ? "bg-[#064E3B] text-[#F6C85F] shadow-[0_3px_8px_rgba(6,78,59,0.22)] hover:bg-[#043D30] focus-visible:ring-[#F6C85F]" : "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-600"}`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {actionLabel}
          {!busy ? (
            <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover/action:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" />
          ) : null}
        </button>
      </div>
    </article>
  );
}

export default function BarBoardPage() {
  const { role, user } = useAuth();
  const { storeId: selectedStoreId, storeName } = useStore();
  const assignedStore =
    user?.storeId === "cafe" ||
    user?.storeId === "restaurant" ||
    user?.storeId === "bakery" ||
    user?.storeId === "farm"
      ? user.storeId
      : null;
  const storeId =
    (role === "user" || role === "server" || role === "bartender") &&
    assignedStore
      ? assignedStore
      : selectedStoreId;
  const [jobs, setJobs] = useState<BarPrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<BarWorkflowStatus | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<BarPrintJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [detailJobId, dispatchDetailJob] = useReducer(
    barBillDetailReducer,
    initialBarBillDetailState,
  );
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(
    getInitialAdminSidebarCollapsed,
  );
  const [now, setNow] = useState(Date.now());
  const [urgentPulseActive, setUrgentPulseActive] = useState(() =>
    getBarUrgentPulsePhase(Date.now()),
  );
  const knownIds = useRef<Set<string> | null>(null);
  const alertAudio = useRef<Partial<Record<AlertKind, HTMLAudioElement>>>({});
  const urgentIds = useRef<Set<string> | null>(null);
  const printingIds = useRef(new Set<string>());
  const terminalName = "Máy pha chế";
  const autoPrintKey = `${AUTO_PRINT_KEY}:${storeId}`;
  const terminalKey = `${TERMINAL_KEY}:${storeId}`;
  const sidebarVariant = getBarSidebarVariant(role);

  const playAlert = useCallback(
    (kindOrForce: AlertKind | boolean = "new", force = false) => {
      const kind: AlertKind =
        typeof kindOrForce === "string" ? kindOrForce : "new";
      const shouldForce =
        typeof kindOrForce === "boolean" ? kindOrForce : force;
      if (!soundEnabled && !shouldForce) return;
      try {
        const fileName = kind === "urgent" ? "bill-bao-do" : "bill-moi";
        const audio =
          alertAudio.current[kind] || new Audio(`/audio/${fileName}.mp3`);
        alertAudio.current[kind] = audio;
        audio.currentTime = 0;
        void audio
          .play()
          .catch((error) => console.warn("Trình duyệt đã chặn âm báo", error));
      } catch (error) {
        console.warn("Không phát được âm báo", error);
      }
    },
    [soundEnabled],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let timer = 0;
    const synchronizePulse = () => {
      const timestamp = Date.now();
      setUrgentPulseActive(getBarUrgentPulsePhase(timestamp));
      const nextBoundary =
        BAR_URGENT_PULSE_INTERVAL_MS -
        (timestamp % BAR_URGENT_PULSE_INTERVAL_MS);
      timer = window.setTimeout(synchronizePulse, nextBoundary + 8);
    };
    synchronizePulse();
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (sidebarVariant !== "admin") return;
    try {
      window.localStorage.setItem(
        ADMIN_SIDEBAR_STORAGE_KEY,
        adminSidebarCollapsed ? "1" : "0",
      );
    } catch {
      /* The admin sidebar still works without persisted preferences. */
    }
  }, [adminSidebarCollapsed, sidebarVariant]);
  useEffect(() => {
    try {
      setAutoPrint(localStorage.getItem(autoPrintKey) === "1");
    } catch {
      setAutoPrint(false);
    }
  }, [autoPrintKey]);
  useEffect(() => {
    setLoading(true);
    knownIds.current = null;
    urgentIds.current = null;
    return subscribeBarBoard(
      storeId,
      (nextJobs) => {
        const nextIds = new Set(nextJobs.map((job) => job.id));
        if (
          knownIds.current &&
          nextJobs.some(
            (job) =>
              job.workflowStatus === "new" && !knownIds.current?.has(job.id),
          )
        )
          playAlert();
        knownIds.current = nextIds;
        setJobs(nextJobs);
        setLoading(false);
        setSyncError("");
      },
      () => {
        setLoading(false);
        setSyncError("Mất kết nối dữ liệu. Hệ thống đang thử kết nối lại…");
      },
    );
  }, [playAlert, storeId]);
  useEffect(() => {
    const nextUrgentIds = new Set(
      jobs
        .filter(
          (job) => getBarWaitState(elapsedMinutes(job, now)) === "urgent",
        )
        .map((job) => job.id),
    );
    if (
      urgentIds.current &&
      [...nextUrgentIds].some((id) => !urgentIds.current?.has(id))
    )
      playAlert("urgent");
    urgentIds.current = nextUrgentIds;
  }, [jobs, now, playAlert]);
  useEffect(() => {
    if (!jobs.some((job) => job.workflowStatus === "new")) return;
    const reminder = window.setInterval(() => playAlert("new"), 20000);
    return () => window.clearInterval(reminder);
  }, [jobs, playAlert]);
  useEffect(() => {
    if (!historyOpen) return;
    setHistoryLoading(true);
    return subscribeBarHistory(
      storeId,
      (nextJobs) => {
        setHistoryJobs(nextJobs);
        setHistoryLoading(false);
        setHistoryError("");
      },
      () => {
        setHistoryLoading(false);
        setHistoryError("Không tải được lịch sử. Vui lòng thử lại.");
      },
    );
  }, [historyOpen, storeId]);
  useEffect(() => {
    if (!autoPrint) return;
    jobs
      .filter((job) => job.status === "pending")
      .forEach(async (job) => {
        if (printingIds.current.has(job.id)) return;
        printingIds.current.add(job.id);
        try {
          if (job.items.length) printTicket(job);
          await markBarPrintJobPrinted(
            job.id,
            localStorage.getItem(terminalKey) || terminalName,
          );
        } catch (error) {
          console.error("Không tự in được phiếu pha chế", error);
        } finally {
          printingIds.current.delete(job.id);
        }
      });
  }, [autoPrint, jobs, terminalKey]);

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.id,
          jobs.filter((job) => job.workflowStatus === column.id),
        ]),
      ) as Record<ActiveStatus, BarPrintJob[]>,
    [jobs],
  );
  const detailJob = useMemo(
    () => jobs.find((job) => job.id === detailJobId) || null,
    [detailJobId, jobs],
  );
  const moveJob = async (job: BarPrintJob, status: BarWorkflowStatus) => {
    if (job.workflowStatus === status || busyIds.has(job.id)) return;
    const previous = job.workflowStatus;
    setBusyIds((ids) => new Set(ids).add(job.id));
    setJobs((items) =>
      status === "collected"
        ? items.filter((item) => item.id !== job.id)
        : items.map((item) =>
            item.id === job.id ? { ...item, workflowStatus: status } : item,
          ),
    );
    try {
      await updateBarWorkflowStatus(job.id, status, storeId);
    } catch (error) {
      console.error(error);
      setJobs((items) =>
        [
          ...items.filter((item) => item.id !== job.id),
          { ...job, workflowStatus: previous },
        ].sort(
          (a, b) => getCreatedDate(a).getTime() - getCreatedDate(b).getTime(),
        ),
      );
      setSyncError("Không cập nhật được bill. Vui lòng thử lại.");
    } finally {
      setBusyIds((ids) => {
        const next = new Set(ids);
        next.delete(job.id);
        return next;
      });
    }
  };
  const handleDrop = (event: DragEvent, status: BarWorkflowStatus) => {
    event.preventDefault();
    setDragOver(null);
    const job = jobs.find(
      (item) => item.id === event.dataTransfer.getData("text/bar-job"),
    );
    if (job) void moveJob(job, status);
  };
  const toggleAutoPrint = () => {
    const next = !autoPrint;
    setAutoPrint(next);
    try {
      localStorage.setItem(autoPrintKey, next ? "1" : "0");
      localStorage.setItem(terminalKey, terminalName);
    } catch {
      /* localStorage may be unavailable */
    }
  };

  return (
    <RoleGuard
      permission={role === "bartender" ? "bar.access" : "bills.access"}
    >
      <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
        {sidebarVariant === "bar" ? (
          <BarNavigationSidebar onOpenHistory={() => setHistoryOpen(true)} />
        ) : (
          <AdminSidebar
            collapsed={adminSidebarCollapsed}
            onToggleCollapsed={() =>
              setAdminSidebarCollapsed((value) => !value)
            }
          />
        )}
        {sidebarVariant === "admin" ? <AdminMobileHeader /> : null}
        <main
          className={`h-screen min-w-0 flex-1 overflow-y-auto bg-[#F4F5F7] text-slate-900 ${sidebarVariant === "bar" ? "pl-14 lg:pl-[72px]" : "pt-16 lg:pt-0"}`}
        >
          <header
            className={`sticky z-20 border-b border-[#DDE1E7] bg-white/95 px-4 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur md:px-5 ${sidebarVariant === "admin" ? "top-16 lg:top-0" : "top-0"}`}
          >
            <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#064E3B] text-[#F6C85F]">
                  <ChefHat className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-black tracking-[-0.02em]">
                      Màn hình pha chế
                    </h1>
                    <span className="hidden rounded-md bg-[#DCEFE9] px-2 py-0.5 text-[11px] font-bold text-[#146B59] sm:inline">
                      TRỰC TIẾP
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600">
                    {storeName} · cập nhật mỗi 2 giây
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">Lịch sử đã lấy</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    if (next) window.setTimeout(() => playAlert(true), 0);
                  }}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold transition ${soundEnabled ? "border-[#E9CAA0] bg-[#FCF7EF] text-[#8A5611]" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Âm báo</span>
                </button>
                <button
                  type="button"
                  onClick={toggleAutoPrint}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-white transition ${autoPrint ? "bg-[#176A57] hover:bg-[#125847]" : "bg-[#2F3A4F] hover:bg-[#253047]"}`}
                >
                  <Printer className="h-4 w-4" />
                  {autoPrint ? "Đang tự in" : "Bật tự in bill"}
                </button>
              </div>
            </div>
          </header>
          <section className="mx-auto max-w-[1800px] overflow-x-auto p-4 md:p-6">
            {syncError ? (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                <RefreshCcw className="h-4 w-4 animate-spin" />
                {syncError}
              </div>
            ) : null}
            <div className="mb-4 flex min-w-[980px] flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Kéo bill sang cột kế tiếp hoặc dùng nút trên từng bill.
              </p>
              <p className="text-sm font-bold text-slate-600">
                {jobs.length} bill đang hoạt động
              </p>
            </div>
            <div className="grid min-w-[980px] grid-cols-3 gap-4 xl:gap-6">
              {columns.map((column) => {
                const Icon = column.icon;
                const columnJobs = grouped[column.id];
                const isNewColumn = column.id === "new";
                const isPreparingColumn = column.id === "preparing";
                const isReadyColumn = column.id === "ready";
                const isDesignedColumn =
                  isNewColumn || isPreparingColumn || isReadyColumn;
                return (
                  <section
                    key={column.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOver(column.id);
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node,
                        )
                      )
                        setDragOver(null);
                    }}
                    onDrop={(event) => handleDrop(event, column.id)}
                    className={`flex min-h-[calc(100vh-155px)] flex-col border transition-all ${isDesignedColumn ? `overflow-hidden rounded-xl bg-white p-0 ${isNewColumn ? "border-slate-200 shadow-[0_4px_18px_rgba(15,23,42,0.07)]" : isPreparingColumn ? "border-[#BCD7FA] shadow-[0_4px_18px_rgba(18,101,214,0.08)]" : "border-[#9FD4BE] shadow-[0_4px_18px_rgba(6,78,59,0.09)]"}` : `rounded-sm p-3 xl:p-4 ${column.tone}`} ${dragOver === column.id ? "scale-[1.005] border-emerald-500 ring-4 ring-emerald-200/70" : ""}`}
                  >
                    <div
                      className={`flex items-center justify-between ${isDesignedColumn ? `relative min-h-[88px] overflow-hidden px-4 py-4 ${isNewColumn ? "border-b border-slate-200 bg-white text-slate-900" : isPreparingColumn ? "bg-[#0B3269] text-white" : "bg-[#064E3B] text-white"}` : "mb-4 px-1"}`}
                    >
                      {isDesignedColumn ? (
                        <span
                          aria-hidden="true"
                          className={`absolute -left-8 -top-4 h-8 w-32 -skew-x-[28deg] rounded-br-xl ${isNewColumn || isReadyColumn ? "bg-[#F6C85F]" : "bg-[#2E85F4]"}`}
                        />
                      ) : null}
                      <div className="flex items-center gap-3">
                        <div
                          className={`relative flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${isNewColumn ? "bg-[#F6C85F] text-[#171717] shadow-[0_3px_10px_rgba(246,200,95,0.24)]" : isPreparingColumn ? "bg-[#EAF3FF] text-[#1265D6] shadow-[0_3px_10px_rgba(18,101,214,0.22)]" : isReadyColumn ? "bg-[#F6C85F] text-[#064E3B] shadow-[0_3px_10px_rgba(246,200,95,0.24)]" : "bg-white"}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="relative">
                          <h2
                            className={`font-black ${isDesignedColumn ? `uppercase tracking-[-0.02em] ${isNewColumn ? "text-slate-900" : "text-white"}` : ""}`}
                          >
                            {column.title}
                          </h2>
                          <p
                            className={`text-xs font-medium ${isNewColumn ? "text-slate-500" : isPreparingColumn ? "text-blue-50/75" : isReadyColumn ? "text-[#FDE7A3]" : "text-slate-500"}`}
                          >
                            {column.hint}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`relative px-3 py-1 text-sm font-black ${isNewColumn ? "rounded-lg bg-[#F6C85F] text-[#171717] shadow-[0_3px_10px_rgba(246,200,95,0.2)]" : isPreparingColumn ? "rounded-lg bg-[#EAF3FF] text-[#0D5DC4] shadow-[0_3px_10px_rgba(18,101,214,0.18)]" : isReadyColumn ? "rounded-lg bg-[#F6C85F] text-[#064E3B] shadow-[0_3px_10px_rgba(246,200,95,0.2)]" : `rounded-full ${column.badge}`}`}
                      >
                        {columnJobs.length}
                      </span>
                    </div>
                    <div
                      className={`space-y-3 ${isDesignedColumn ? `min-h-[calc(100vh-243px)] flex-1 p-3 xl:p-4 ${isNewColumn ? "bg-[#FAFAF8]" : isPreparingColumn ? "bg-[#F5F9FF]" : "bg-[#F2F8F5]"}` : ""}`}
                    >
                      {loading ? (
                        Array.from({ length: 2 }).map((_, index) => (
                          <div
                            key={index}
                            className={`h-44 animate-pulse bg-white/80 ${isDesignedColumn ? "rounded-xl" : "rounded-2xl"}`}
                          />
                        ))
                      ) : columnJobs.length ? (
                        columnJobs.map((job) => (
                          <BillCard
                            key={job.id}
                            job={job}
                            now={now}
                            busy={busyIds.has(job.id)}
                            urgentPulseActive={urgentPulseActive}
                            onMove={moveJob}
                            onPrint={printTicket}
                            onShowDetails={(selectedJob) =>
                              dispatchDetailJob({
                                type: "open",
                                jobId: selectedJob.id,
                              })
                            }
                          />
                        ))
                      ) : (
                        <div
                          className={`flex min-h-44 flex-col items-center justify-center border border-dashed p-6 text-center ${isNewColumn ? "rounded-xl border-[#F6C85F]/50 bg-white" : isPreparingColumn ? "rounded-xl border-[#8EBBF4] bg-white" : isReadyColumn ? "rounded-xl border-[#9FD4BE] bg-white" : "rounded-sm border-slate-300 bg-white/50"}`}
                        >
                          <Icon
                            className={`mb-3 h-8 w-8 ${isNewColumn ? "text-[#D89200]" : isPreparingColumn ? "text-[#1265D6]" : isReadyColumn ? "text-[#D8A400]" : "text-slate-300"}`}
                          />
                          <p
                            className={`font-bold ${isReadyColumn ? "text-[#064E3B]" : isDesignedColumn ? "text-slate-700" : "text-slate-500"}`}
                          >
                            Chưa có bill
                          </p>
                          <p
                            className={`mt-1 text-xs ${isReadyColumn ? "text-[#4B786B]" : isDesignedColumn ? "text-slate-500" : "text-slate-400"}`}
                          >
                            Thả bill vào đây
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
          <BarBillDetailDialog
            job={detailJob}
            minutes={detailJob ? elapsedMinutes(detailJob, now) : 0}
            open={Boolean(detailJob)}
            busy={detailJob ? busyIds.has(detailJob.id) : false}
            onAdvance={(selectedJob, targetStatus) => {
              void moveJob(selectedJob, targetStatus);
            }}
            onClose={() => dispatchDetailJob({ type: "close" })}
          />
          {historyOpen ? (
            <div
              className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setHistoryOpen(false);
              }}
            >
              <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-black">
                      <History className="h-5 w-5 text-emerald-700" />
                      Lịch sử bill khách đã lấy
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      100 bill gần nhất · cập nhật trực tiếp
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                    aria-label="Đóng lịch sử"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
                  {historyError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                      {historyError}
                    </div>
                  ) : null}
                  {historyLoading ? (
                    <div className="flex h-40 items-center justify-center text-slate-500">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Đang tải lịch sử...
                    </div>
                  ) : historyJobs.length ? (
                    <div className="space-y-3">
                      {historyJobs.map((job) => (
                        <article
                          key={job.id}
                          className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-black text-slate-900">
                                {job.tableNumber || "Mang về"}
                              </h3>
                              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                                #{shortCode(job)}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Đã lấy
                              </span>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                {getCollectedDate(job).toLocaleString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="my-3 border-t border-dashed border-slate-200" />
                          <ul className="space-y-1.5">
                            {job.items.map((item, index) => (
                              <li
                                key={`${job.id}-${item.menuId}-${index}`}
                                className="flex justify-between gap-3 text-sm"
                              >
                                <span className="font-semibold text-slate-700">
                                  {item.name}
                                  {item.note ? (
                                    <span className="ml-1 text-xs text-rose-600">
                                      ({item.note})
                                    </span>
                                  ) : null}
                                </span>
                                <span className="shrink-0 font-black text-slate-900">
                                  ×{formatQuantity(item.quantity)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
                      <History className="mb-3 h-9 w-9" />
                      <p className="font-bold text-slate-500">
                        Chưa có lịch sử
                      </p>
                      <p className="mt-1 text-xs">
                        Bill sẽ xuất hiện sau khi xác nhận khách đã lấy.
                      </p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          ) : null}
        </main>
      </div>
    </RoleGuard>
  );
}
