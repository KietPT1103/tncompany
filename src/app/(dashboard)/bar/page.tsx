"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Coffee,
  History,
  Loader2,
  Printer,
  RefreshCcw,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import AdminSidebar from "@/AdminSidebar";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import {
  type BarPrintJob,
  subscribeBarBoard,
  subscribeBarHistory,
  updateBarWorkflowStatus,
} from "@/services/barPrintJobService";
import BarBillDetailDialog from "./BarBillDetailDialog";
import {
  BAR_KDS_COLUMN_GAP,
  BAR_KDS_DEFAULT_COLUMN_HEIGHT,
  BAR_KDS_MOBILE_SEGMENT_HEIGHT,
  BAR_KDS_TICKET_HORIZONTAL_OVERLAP_PX,
  BAR_KDS_TICKET_WIDTH,
  buildBarKdsColumns,
  flattenBarKdsColumns,
  getActiveBarQueue,
  getBarKdsBoardContentHeight,
  repackBarKdsColumnsByRenderedHeight,
} from "./barBoardQueue";
import {
  barBillDetailReducer,
  initialBarBillDetailState,
} from "./barBillDetailState";
import {
  getBarKdsDragUpdate,
  isBarKdsDragTargetAllowed,
} from "./barKdsDragScroll";
import { toggleHistoryBillDisclosure } from "./barHistoryDisclosure";
import BarNavigationSidebar from "./BarNavigationSidebar";
import BarReceiptCard from "./BarReceiptCard";
import {
  BAR_SIDEBAR_STORAGE_KEY,
  getBarSidebarContentPadding,
  getBarSidebarVariant,
  getInitialBarSidebarCollapsed,
} from "./barSidebarState";
import {
  BAR_URGENT_REMINDER_INTERVAL_MS,
  getBarWaitState,
} from "./barWaitState";

const ADMIN_SIDEBAR_STORAGE_KEY = "admin_sidebar_collapsed";
const UNDO_COMPLETION_WINDOW_MS = 5_000;
type AlertKind = "new" | "urgent";

type BarKdsDragState = {
  pointerId: number;
  startClientX: number;
  startScrollLeft: number;
  hasDragged: boolean;
};

const getBarKdsSegmentRenderKey = (
  segment: ReturnType<typeof flattenBarKdsColumns>[number],
) => `${segment.job.id}:${segment.segmentIndex + 1}`;

const getCreatedDate = (job: BarPrintJob) =>
  job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date();

const getCollectedDate = (job: BarPrintJob) =>
  job.collectedAt?.seconds
    ? new Date(job.collectedAt.seconds * 1000)
    : getCreatedDate(job);

const elapsedMinutes = (job: BarPrintJob, now: number) =>
  Math.max(0, Math.floor((now - getCreatedDate(job).getTime()) / 60_000));

const shortCode = (job: BarPrintJob) => {
  const value = job.sourceBillId || job.id;
  return (value.length > 10 ? value.slice(-8) : value).toUpperCase();
};

const formatQuantity = (quantity: number) =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const getInitialAdminSidebarCollapsed = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const getInitialBarSidebarCollapsedPreference = () => {
  if (typeof window === "undefined") return true;
  try {
    return getInitialBarSidebarCollapsed(
      window.localStorage.getItem(BAR_SIDEBAR_STORAGE_KEY),
    );
  } catch {
    return true;
  }
};

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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<BarPrintJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lastCompleted, setLastCompleted] = useState<BarPrintJob | null>(null);
  const [detailJobId, dispatchDetailJob] = useReducer(
    barBillDetailReducer,
    initialBarBillDetailState,
  );
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(
    getInitialAdminSidebarCollapsed,
  );
  const [barSidebarCollapsed, setBarSidebarCollapsed] = useState(
    getInitialBarSidebarCollapsedPreference,
  );
  const [now, setNow] = useState(Date.now());
  const knownIds = useRef<Set<string> | null>(null);
  const alertAudio = useRef<Partial<Record<AlertKind, HTMLAudioElement>>>({});
  const urgentIds = useRef<Set<string> | null>(null);
  const kdsBoardRef = useRef<HTMLDivElement | null>(null);
  const kdsDragStateRef = useRef<BarKdsDragState | null>(null);
  const [kdsDragging, setKdsDragging] = useState(false);
  const [kdsColumnHeight, setKdsColumnHeight] = useState(
    BAR_KDS_DEFAULT_COLUMN_HEIGHT,
  );
  const [kdsRenderedSegmentHeights, setKdsRenderedSegmentHeights] = useState<
    Record<string, number>
  >({});
  const sidebarVariant = getBarSidebarVariant(role);

  const activeQueue = useMemo(() => getActiveBarQueue(jobs), [jobs]);
  const queueColumns = useMemo(
    () =>
      buildBarKdsColumns(activeQueue, {
        columnHeight: kdsColumnHeight,
      }),
    [activeQueue, kdsColumnHeight],
  );
  const renderedQueueColumns = useMemo(
    () =>
      repackBarKdsColumnsByRenderedHeight(queueColumns, {
        columnHeight: kdsColumnHeight,
        getRenderedHeight: (segment) =>
          kdsRenderedSegmentHeights[getBarKdsSegmentRenderKey(segment)],
      }),
    [kdsColumnHeight, kdsRenderedSegmentHeights, queueColumns],
  );
  const mobileSegments = useMemo(
    () =>
      flattenBarKdsColumns(
        buildBarKdsColumns(activeQueue, {
          columnHeight: BAR_KDS_MOBILE_SEGMENT_HEIGHT,
        }),
      ),
    [activeQueue],
  );
  const detailJob = useMemo(
    () => activeQueue.find((job) => job.id === detailJobId) || null,
    [activeQueue, detailJobId],
  );
  const hasUrgentJobs = useMemo(
    () =>
      activeQueue.some(
        (job) => getBarWaitState(elapsedMinutes(job, now)) === "urgent",
      ),
    [activeQueue, now],
  );

  const playAlert = useCallback(
    (kindOrForce: AlertKind | boolean = "new", force = false) => {
      const kind: AlertKind =
        typeof kindOrForce === "string" ? kindOrForce : "new";
      const shouldForce =
        typeof kindOrForce === "boolean" ? kindOrForce : force;
      if (!soundEnabled && !shouldForce) return;
      try {
        const fileName = kind === "urgent" ? "bill-bao-do" : "mon-moi";
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
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const board = kdsBoardRef.current;
    if (!board) return;

    const receipts = Array.from(
      board.querySelectorAll<HTMLElement>("[data-bar-receipt='true']"),
    );

    const updateRenderedHeights = () => {
      const nextHeights: Record<string, number> = {};

      for (const receipt of receipts) {
        const jobId = receipt.dataset.barJobId;
        const segmentNumber = receipt.dataset.barSegment;
        const renderedHeight = receipt.getBoundingClientRect().height;
        if (!jobId || !segmentNumber || renderedHeight <= 0) continue;
        nextHeights[`${jobId}:${segmentNumber}`] = renderedHeight;
      }

      setKdsRenderedSegmentHeights((currentHeights) => {
        const currentKeys = Object.keys(currentHeights);
        const nextKeys = Object.keys(nextHeights);
        const unchanged =
          currentKeys.length === nextKeys.length &&
          nextKeys.every(
            (key) => currentHeights[key] === nextHeights[key],
          );
        return unchanged ? currentHeights : nextHeights;
      });
    };

    updateRenderedHeights();

    const observer = new ResizeObserver(updateRenderedHeights);
    receipts.forEach((receipt) => observer.observe(receipt));
    return () => observer.disconnect();
  }, [renderedQueueColumns]);

  useEffect(() => {
    const board = kdsBoardRef.current;
    if (!board) return;

    const updateColumnHeight = () => {
      if (board.clientHeight > 0) {
        const styles = window.getComputedStyle(board);
        setKdsColumnHeight(
          getBarKdsBoardContentHeight(
            board.clientHeight,
            Number.parseFloat(styles.paddingTop) || 0,
            Number.parseFloat(styles.paddingBottom) || 0,
            window.innerHeight,
            board.getBoundingClientRect().top,
          ),
        );
      }
    };
    updateColumnHeight();

    const observer = new ResizeObserver(updateColumnHeight);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const handleKdsPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const board = event.currentTarget;
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        !event.isPrimary ||
        board.scrollWidth <= board.clientWidth ||
        !isBarKdsDragTargetAllowed(event.target)
      ) {
        return;
      }

      event.preventDefault();
      kdsDragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startScrollLeft: board.scrollLeft,
        hasDragged: false,
      };
      try {
        board.setPointerCapture(event.pointerId);
      } catch {
        // Dragging still works while the pointer remains inside the KDS board.
      }
    },
    [],
  );

  const handleKdsPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = kdsDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const dragUpdate = getBarKdsDragUpdate(
        dragState.startClientX,
        event.clientX,
        dragState.startScrollLeft,
      );
      if (!dragUpdate.hasDragged) return;

      event.preventDefault();
      if (!dragState.hasDragged) {
        dragState.hasDragged = true;
        setKdsDragging(true);
      }
      event.currentTarget.scrollLeft = dragUpdate.scrollLeft;
    },
    [],
  );

  const stopKdsPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = kdsDragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // The pointer may already be released by the browser.
      }
      kdsDragStateRef.current = null;
      setKdsDragging(false);
    },
    [],
  );

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
    if (sidebarVariant !== "bar") return;
    try {
      window.localStorage.setItem(
        BAR_SIDEBAR_STORAGE_KEY,
        barSidebarCollapsed ? "1" : "0",
      );
    } catch {
      /* The bar sidebar still works without persisted preferences. */
    }
  }, [barSidebarCollapsed, sidebarVariant]);

  useEffect(() => {
    try {
      localStorage.removeItem(`pos:bar-auto-print:${storeId}`);
      localStorage.removeItem(`pos:bar-terminal-name:${storeId}`);
    } catch {
      /* Ignore unavailable browser storage. */
    }
  }, [storeId]);

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
          nextJobs.some((job) => !knownIds.current?.has(job.id))
        ) {
          playAlert("new");
        }
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
      activeQueue
        .filter(
          (job) => getBarWaitState(elapsedMinutes(job, now)) === "urgent",
        )
        .map((job) => job.id),
    );
    if (
      urgentIds.current &&
      [...nextUrgentIds].some((id) => !urgentIds.current?.has(id))
    ) {
      playAlert("urgent");
    }
    urgentIds.current = nextUrgentIds;
  }, [activeQueue, now, playAlert]);

  useEffect(() => {
    if (!hasUrgentJobs) return;
    const reminder = window.setInterval(
      () => playAlert("urgent"),
      BAR_URGENT_REMINDER_INTERVAL_MS,
    );
    return () => window.clearInterval(reminder);
  }, [hasUrgentJobs, playAlert]);

  useEffect(() => {
    if (!lastCompleted) return;
    const timer = window.setTimeout(
      () => setLastCompleted(null),
      UNDO_COMPLETION_WINDOW_MS,
    );
    return () => window.clearTimeout(timer);
  }, [lastCompleted]);

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

  const setJobBusy = (jobId: string, busy: boolean) => {
    setBusyIds((ids) => {
      const next = new Set(ids);
      if (busy) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  };

  const completeJob = async (job: BarPrintJob) => {
    if (busyIds.has(job.id)) return;
    setJobBusy(job.id, true);
    setJobs((items) => items.filter((item) => item.id !== job.id));
    try {
      await updateBarWorkflowStatus(job.id, "collected", storeId);
      setLastCompleted(job);
      dispatchDetailJob({ type: "close" });
    } catch (error) {
      console.error(error);
      setJobs((items) => getActiveBarQueue([...items, job]));
      setSyncError("Không hoàn thành được bill. Vui lòng thử lại.");
    } finally {
      setJobBusy(job.id, false);
    }
  };

  const undoLastCompletion = async () => {
    const job = lastCompleted;
    if (!job || busyIds.has(job.id)) return;
    setLastCompleted(null);
    setJobBusy(job.id, true);
    setJobs((items) => getActiveBarQueue([...items, job]));
    try {
      await updateBarWorkflowStatus(job.id, job.workflowStatus, storeId);
    } catch (error) {
      console.error(error);
      setJobs((items) => items.filter((item) => item.id !== job.id));
      setSyncError("Không hoàn tác được bill. Vui lòng thử lại.");
    } finally {
      setJobBusy(job.id, false);
    }
  };

  return (
    <RoleGuard
      permission={role === "bartender" ? "bar.access" : "bills.access"}
    >
      <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
        {sidebarVariant === "bar" ? (
          <BarNavigationSidebar
            collapsed={barSidebarCollapsed}
            onCollapsedChange={setBarSidebarCollapsed}
            onOpenHistory={() => setHistoryOpen(true)}
          />
        ) : (
          <AdminSidebar
            collapsed={adminSidebarCollapsed}
            onToggleCollapsed={() =>
              setAdminSidebarCollapsed((value) => !value)
            }
          />
        )}

        <main
          className={`h-screen min-w-0 flex-1 overflow-y-auto bg-[#F4F5F7] text-slate-900 md:overflow-hidden ${
            sidebarVariant === "bar"
              ? getBarSidebarContentPadding(barSidebarCollapsed)
              : "pt-16 lg:pt-0"
          }`}
        >
          <header
            className={`border-b border-[#DDE1E7] bg-white/95 px-3 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.05)] backdrop-blur sm:px-4 md:px-5 ${
              sidebarVariant === "admin"
                ? "relative z-10 lg:sticky lg:top-0 lg:z-20"
                : "sticky top-0 z-20"
            }`}
          >
            <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#064E3B] text-[#F6C85F]">
                  <Coffee className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black tracking-[-0.02em] sm:text-lg">
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
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064E3B] focus-visible:ring-offset-2 sm:text-sm"
                >
                  <History className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Lịch sử đã lấy</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    if (next) window.setTimeout(() => playAlert(true), 0);
                  }}
                  aria-pressed={soundEnabled}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 sm:text-sm ${
                    soundEnabled
                      ? "border-[#E9CAA0] bg-[#FCF7EF] text-[#8A5611]"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <VolumeX className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">Âm báo</span>
                </button>
                <span
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#176A57] px-2.5 text-xs font-bold text-white sm:px-3 sm:text-sm"
                  title="Windows Print Agent gửi phiếu thẳng tới máy in LAN"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  In tự động qua agent
                </span>
              </div>
            </div>
          </header>

          <section className="w-full px-0 pb-3 pt-0 sm:pb-4 md:flex md:h-[calc(100dvh-54px)] md:flex-col md:overflow-hidden md:pb-0">
            {syncError ? (
              <div className="mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                <RefreshCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
                {syncError}
              </div>
            ) : null}

            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 bg-white px-3 py-2.5 shadow-[0_5px_16px_rgba(15,23,42,0.08)] md:mb-1 md:px-3 md:py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E9F4F0] text-[#176A57]">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-black leading-5 text-slate-950">
                    Luồng pha chế
                  </h2>
                  <p className="text-[11px] font-semibold leading-4 text-slate-600 sm:text-xs">
                    Bill cũ nhất ở bên trái · bill dài tiếp tục ở cột kế bên
                  </p>
                </div>
              </div>
              <div className="flex w-full shrink-0 items-center gap-2 border-t border-slate-100 pt-2 sm:w-auto sm:border-0 sm:pt-0">
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex h-8 min-w-0 flex-1 items-center justify-between rounded-lg bg-[#E6F3EE] pl-3 pr-1 text-xs font-bold text-[#315F53] sm:w-40 sm:flex-none"
                >
                  <span className="whitespace-nowrap">Đang xử lý</span>
                  <strong className="inline-flex h-6 min-w-7 items-center justify-center rounded-md bg-[#064E3B] px-2 text-xs font-black tabular-nums text-[#F6C85F]">
                    {activeQueue.length}
                  </strong>
                </span>
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex h-8 min-w-0 flex-1 items-center justify-between rounded-lg bg-[#FFF3D2] pl-3 pr-1 text-xs font-bold text-[#8A5611] sm:w-32 sm:flex-none"
                >
                  <span className="whitespace-nowrap md:hidden">Thẻ KDS</span>
                  <span className="hidden whitespace-nowrap md:inline">Cột KDS</span>
                  <strong className="inline-flex h-6 min-w-7 items-center justify-center rounded-md bg-[#C87500] px-2 text-xs font-black tabular-nums text-white">
                    <span className="md:hidden">{mobileSegments.length}</span>
                    <span className="hidden md:inline">{renderedQueueColumns.length}</span>
                  </strong>
                </span>
              </div>
            </div>

            <section
              aria-label="Luồng bill pha chế trên thiết bị di động"
              aria-busy={loading}
              className="flex flex-col pb-6 md:hidden"
              style={{ gap: `${BAR_KDS_COLUMN_GAP}px` }}
            >
                {loading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="mx-auto h-52 w-full max-w-[440px] animate-pulse bg-[length:100%_100%] bg-no-repeat"
                        style={{
                          backgroundImage: "url('/assets/bar/bill-bg.png')",
                        }}
                      />
                    ))
                  : null}

                {!loading
                  ? mobileSegments.map((segment) => (
                      <BarReceiptCard
                        key={`${segment.job.id}-${segment.segmentIndex}`}
                        segment={segment}
                        now={now}
                        busy={busyIds.has(segment.job.id)}
                        onComplete={(selectedJob) => {
                          void completeJob(selectedJob);
                        }}
                        onShowDetails={(selectedJob) =>
                          dispatchDetailJob({
                            type: "open",
                            jobId: selectedJob.id,
                          })
                        }
                      />
                    ))
                  : null}

                {!loading && !activeQueue.length ? (
                  <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF3D2] text-[#A66B00]">
                      <CheckCircle2
                        className="h-6 w-6"
                        aria-hidden="true"
                      />
                    </div>
                    <h4 className="mt-3 text-base font-black text-slate-900">
                      Chưa có bill cần pha chế
                    </h4>
                    <p className="mt-1 max-w-xs text-sm font-medium text-slate-500">
                      Bill mới sẽ tự động xuất hiện tại đây theo thứ tự tạo.
                    </p>
                  </div>
                ) : null}
            </section>

            <div
              ref={kdsBoardRef}
              data-bar-queue="true"
              data-dragging={kdsDragging ? "true" : "false"}
              aria-label="Luồng bill pha chế KDS"
              aria-busy={loading}
              onPointerDown={handleKdsPointerDown}
              onPointerMove={handleKdsPointerMove}
              onPointerUp={stopKdsPointerDrag}
              onPointerCancel={stopKdsPointerDrag}
              className="admin-list-scrollbar bar-kds-drag-scroll hidden min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg bg-[#ECEEF1] px-1 pb-1.5 pt-5 md:block"
            >
              <div
                className="flex h-full w-max min-w-full items-start pb-2 pr-3"
              >
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-64 shrink-0 animate-pulse bg-[length:100%_100%] bg-no-repeat"
                        style={{
                          width: `${BAR_KDS_TICKET_WIDTH}px`,
                          marginLeft:
                            index === 0
                              ? 0
                              : `-${BAR_KDS_TICKET_HORIZONTAL_OVERLAP_PX}px`,
                          backgroundImage: "url('/assets/bar/bill-bg.png')",
                        }}
                      />
                    ))
                  : null}

                {!loading
                  ? renderedQueueColumns.map((columnSegments, columnIndex) => (
                      <section
                        key={`bar-kds-column-${columnIndex + 1}`}
                        aria-label={`Cột KDS ${columnIndex + 1}`}
                        className="flex h-full shrink-0 flex-col"
                        style={{
                          width: `${BAR_KDS_TICKET_WIDTH}px`,
                          marginLeft:
                            columnIndex === 0
                              ? 0
                              : `-${BAR_KDS_TICKET_HORIZONTAL_OVERLAP_PX}px`,
                          gap: `${BAR_KDS_COLUMN_GAP}px`,
                        }}
                      >
                        {columnSegments.map((segment, segmentIndex) => (
                          <BarReceiptCard
                            key={`${segment.job.id}-${segment.segmentIndex}`}
                            segment={segment}
                            now={now}
                            busy={busyIds.has(segment.job.id)}
                            overlapPrevious={segmentIndex > 0}
                            onComplete={(selectedJob) => {
                              void completeJob(selectedJob);
                            }}
                            onShowDetails={(selectedJob) =>
                              dispatchDetailJob({
                                type: "open",
                                jobId: selectedJob.id,
                              })
                            }
                          />
                        ))}
                      </section>
                    ))
                  : null}

                {!loading && !activeQueue.length ? (
                  <div className="flex h-full min-w-[min(720px,100%)] flex-1 flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF3D2] text-[#A66B00]">
                      <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h4 className="mt-3 text-base font-black text-slate-900">
                      Chưa có bill cần pha chế
                    </h4>
                    <p className="mt-1 max-w-xs text-sm font-medium text-slate-500">
                      Bill mới sẽ tự động xuất hiện tại đây theo thứ tự tạo.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <BarBillDetailDialog
            job={detailJob}
            minutes={detailJob ? elapsedMinutes(detailJob, now) : 0}
            open={Boolean(detailJob)}
            busy={detailJob ? busyIds.has(detailJob.id) : false}
            onAdvance={(selectedJob) => {
              void completeJob(selectedJob);
            }}
            onClose={() => dispatchDetailJob({ type: "close" })}
          />

          {lastCompleted ? (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-4 right-4 z-[130] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-white shadow-[0_18px_42px_rgba(15,23,42,0.28)]"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#F6C85F]" aria-hidden="true" />
              <p className="min-w-0 text-sm font-bold">
                Bill {lastCompleted.tableNumber || "mang về"} đã được xử lý
              </p>
              <button
                type="button"
                onClick={() => void undoLastCompletion()}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#F6C85F] px-3 text-sm font-black text-slate-950 transition hover:bg-[#FFD976] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Hoàn tác
              </button>
            </div>
          ) : null}

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
                      <History className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                      Lịch sử bill khách đã lấy
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      100 bill gần nhất · cập nhật trực tiếp
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064E3B]"
                    aria-label="Đóng lịch sử"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
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
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                      Đang tải lịch sử...
                    </div>
                  ) : historyJobs.length ? (
                    <div className="space-y-3">
                      {historyJobs.map((job) => (
                        <article
                          key={job.id}
                          className={`overflow-hidden rounded-sm border border-slate-200 bg-white transition-shadow duration-200 motion-reduce:transition-none ${
                            expandedHistoryIds.has(job.id)
                              ? "shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
                              : "shadow-[0_6px_18px_rgba(15,23,42,0.10)] hover:shadow-[0_10px_26px_rgba(15,23,42,0.14)]"
                          }`}
                        >
                          <button
                            type="button"
                            aria-expanded={expandedHistoryIds.has(job.id)}
                            aria-controls={`history-items-${job.id}`}
                            onClick={() =>
                              setExpandedHistoryIds((current) =>
                                toggleHistoryBillDisclosure(current, job.id),
                              )
                            }
                            className="block w-full p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006B52]"
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
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                            <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-xs font-bold">
                              <span className="text-slate-500">
                                {job.items.length} món
                              </span>
                              <span className="inline-flex items-center gap-1 text-[#006B52]">
                                {expandedHistoryIds.has(job.id)
                                  ? "Ẩn món"
                                  : "Xem món"}
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform duration-150 motion-reduce:transition-none ${
                                    expandedHistoryIds.has(job.id)
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                  aria-hidden="true"
                                />
                              </span>
                            </div>
                          </button>
                          {expandedHistoryIds.has(job.id) ? (
                            <div
                              id={`history-items-${job.id}`}
                              className="border-t border-slate-200 bg-slate-50/70 px-4 py-3"
                            >
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
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
                      <History className="mb-3 h-9 w-9" aria-hidden="true" />
                      <p className="font-bold text-slate-500">Chưa có lịch sử</p>
                      <p className="mt-1 text-xs">
                        Bill sẽ xuất hiện sau khi được hoàn thành.
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
