"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CheckCircle2, Clock3, Coffee, X } from "lucide-react";
import type {
  BarPrintJob,
  BarWorkflowStatus,
} from "@/services/barPrintJobService";
import { getBarWaitState } from "./barWaitState";
import { getBarBillDetailAdvance } from "./barBillDetailState";

type BarBillDetailDialogProps = {
  job: BarPrintJob | null;
  minutes: number;
  open: boolean;
  busy: boolean;
  onAdvance: (job: BarPrintJob, status: BarWorkflowStatus) => void;
  onClose: () => void;
};

const formatQuantity = (quantity: number) =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const getShortCode = (job: BarPrintJob) => {
  const value = job.sourceBillId || job.id;
  return (value.length > 10 ? value.slice(-8) : value).toUpperCase();
};

const statusLabel: Record<BarWorkflowStatus, string> = {
  new: "Bill mới",
  preparing: "Đang pha chế",
  ready: "Chờ khách lấy",
  collected: "Khách đã lấy",
};

export default function BarBillDetailDialog({
  job,
  minutes,
  open,
  busy,
  onAdvance,
  onClose,
}: BarBillDetailDialogProps) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  const [displayJob, setDisplayJob] = useState(job);
  const [displayMinutes, setDisplayMinutes] = useState(minutes);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (job) {
      setDisplayJob(job);
      setDisplayMinutes(minutes);
    }
  }, [job, minutes]);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const exitTimer = window.setTimeout(() => setRendered(false), 160);
    return () => window.clearTimeout(exitTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!rendered || !displayJob || typeof document === "undefined") return null;

  const totalQuantity = displayJob.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const waitState = getBarWaitState(displayMinutes);
  const urgent = waitState === "urgent";
  const status = displayJob.workflowStatus;
  const advance = getBarBillDetailAdvance(status);
  const statusClasses = urgent
    ? "bg-red-50 text-red-700 ring-red-200"
    : status === "new"
      ? "bg-[#FFF3D2] text-[#9A6700] ring-[#F6C85F]/60"
      : status === "preparing"
        ? "bg-[#EAF3FF] text-[#0D5DC4] ring-[#B9D5FA]"
        : "bg-[#E8F3EE] text-[#064E3B] ring-[#B8D8CC]";
  const quantityClasses = urgent
    ? "bg-red-600 text-white"
    : status === "preparing"
      ? "bg-[#1265D6] text-white"
      : status === "ready" || status === "collected"
        ? "bg-[#064E3B] text-[#F6C85F]"
        : "bg-slate-900 text-white";

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-3 transition-[opacity,backdrop-filter] duration-150 ease-out motion-reduce:transition-none sm:p-6 ${
        visible ? "opacity-100 backdrop-blur-[2px]" : "opacity-0"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-bar-bill-detail-dialog="true"
        className={`flex max-h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                urgent
                  ? "bg-red-600 text-white"
                  : status === "preparing"
                    ? "bg-[#1265D6] text-white"
                    : status === "ready" || status === "collected"
                      ? "bg-[#064E3B] text-[#F6C85F]"
                      : "bg-[#FFF3D2] text-[#D89200]"
              }`}
            >
              <Coffee className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-black text-slate-950">
                Chi tiết bill · {displayJob.tableNumber || "Mang về"}
              </h2>
              <p id={descriptionId} className="mt-0.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                #{getShortCode(displayJob)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusClasses}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {statusLabel[status]}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${
                  urgent
                    ? "bg-red-50 text-red-700 ring-red-200"
                    : waitState === "warning"
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : "bg-white text-slate-700 ring-slate-200"
                }`}>
                  <Clock3 className="h-3.5 w-3.5" />
                  {displayMinutes} phút
                </span>
              </div>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onCloseRef.current()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064E3B] focus-visible:ring-offset-2"
            aria-label="Đóng chi tiết bill"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6">
          <ul className="divide-y divide-slate-200" aria-label="Danh sách món trong bill">
            {displayJob.items.map((item, index) => (
              <li
                key={`${displayJob.id}-${item.menuId}-${index}`}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-4"
              >
                <span className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-black ${quantityClasses}`}>
                  {formatQuantity(item.quantity)}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="break-words text-sm font-bold leading-5 text-slate-900">
                    {item.name}
                  </p>
                  {item.note ? (
                    <p className="mt-1 break-words text-xs font-semibold leading-5 text-rose-600">
                      Ghi chú: {item.note}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm font-bold text-slate-700">
            {displayJob.items.length} món · {formatQuantity(totalQuantity)} phần
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (advance) onAdvance(displayJob, advance.targetStatus);
              onCloseRef.current();
            }}
            className={`group/action inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
              urgent && advance
                ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
                : status === "new" && advance
                  ? "bg-[#161616] text-[#F6C85F] hover:bg-black focus-visible:ring-[#F6C85F]"
                  : status === "preparing" && advance
                    ? "bg-[#1265D6] text-white hover:bg-[#0D5DC4] focus-visible:ring-[#1265D6]"
                    : "bg-[#064E3B] text-white hover:bg-[#043D30] focus-visible:ring-[#F6C85F]"
            }`}
          >
            {advance?.label || "Đóng"}
            {advance ? (
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover/action:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" />
            ) : null}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
