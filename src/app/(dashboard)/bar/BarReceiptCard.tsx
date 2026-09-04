"use client";

import { Check, Clock3, Loader2 } from "lucide-react";
import type { BarPrintJob } from "@/services/barPrintJobService";
import { getBarReceiptItemColumns } from "./barReceiptLayout";
import { getBarWaitState } from "./barWaitState";

type BarReceiptCardProps = {
  job: BarPrintJob;
  queueNumber: number;
  now: number;
  busy: boolean;
  onComplete: (job: BarPrintJob) => void;
  onShowDetails: (job: BarPrintJob) => void;
};

const getCreatedDate = (job: BarPrintJob) =>
  job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date();

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

export default function BarReceiptCard({
  job,
  queueNumber,
  now,
  busy,
  onComplete,
  onShowDetails,
}: BarReceiptCardProps) {
  const minutes = elapsedMinutes(job, now);
  const urgent = getBarWaitState(minutes) === "urgent";
  const createdAt = getCreatedDate(job);
  const itemColumns = getBarReceiptItemColumns(job.items);
  const compactItems = itemColumns.length > 1;

  return (
    <article
      data-bar-receipt="true"
      data-urgent={urgent ? "true" : undefined}
      className={`group relative isolate mx-auto block min-h-74 w-full px-[6.5%] pt-10 text-slate-950 transition-transform duration-200 ease-out hover:-translate-y-1 focus-within:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none sm:pb-[4.25rem] sm:pt-6 ${
        compactItems ? "pb-[6.25rem]" : "pb-[5.5rem]"
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 opacity-80"
        style={{
          borderStyle: "solid",
          borderWidth: "20px 16px",
          borderImageSource: "url('/assets/bar/bill-bg.png')",
          borderImageSlice: "55 40 fill",
          borderImageRepeat: "stretch",
          filter: "drop-shadow(0 -6px 9px rgba(15, 23, 42, 0.18))",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 brightness-110 drop-shadow-[0_6px_8px_rgba(15,23,42,0.16)] transition-[filter] duration-200 ease-out group-hover:drop-shadow-[0_12px_14px_rgba(15,23,42,0.22)] group-focus-within:drop-shadow-[0_12px_14px_rgba(15,23,42,0.22)] motion-reduce:transition-none"
        style={{
          borderStyle: "solid",
          borderWidth: "20px 16px",
          borderImageSource: "url('/assets/bar/bill-bg.png')",
          borderImageSlice: "55 40 fill",
          borderImageRepeat: "stretch",
        }}
      />

      <button
        type="button"
        onClick={() => onShowDetails(job)}
        className={`absolute inset-x-[6%] top-9 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 sm:bottom-[4.25rem] sm:top-5 ${
          compactItems ? "bottom-[6.25rem]" : "bottom-[5.5rem]"
        }`}
        aria-label={`Xem chi tiết bill ${job.tableNumber || "mang về"}`}
      >
        <span className="sr-only">Xem chi tiết bill</span>
      </button>

      <div className="relative rounded-sm px-3 pb-2.5 pt-1">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-label={`Bill thứ ${queueNumber}`}
            className="absolute left-0 top-0 inline-flex min-w-8 items-center justify-center rounded bg-[#006B52] px-1.5 py-0.5 text-[11px] font-black tabular-nums text-[#F6C85F]"
          >
            #{String(queueNumber).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1 text-center">
            <h3 className="text-[15px] font-black uppercase tracking-[-0.02em] text-slate-950">
              Chế biến
            </h3>
          </div>
          <span
            className={`absolute right-0 top-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-black tabular-nums ${
              urgent
                ? "bg-red-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {minutes}p
          </span>
        </div>

        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 text-[13px] leading-4">
          <dt className="font-black">Bàn:</dt>
          <dd className="truncate font-bold">{job.tableNumber || "Mang về"}</dd>
          <dt className="font-black">Phục vụ:</dt>
          <dd className="truncate font-semibold">
            {job.createdByName || "Chưa xác định"}
          </dd>
        </dl>

        <p className="mt-0.5 text-[11px] font-bold leading-4 text-slate-500">
          {shortCode(job)} ·{" "}
          {createdAt.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </p>

        <div className="mt-2 border-t border-dashed border-slate-300 pt-1.5">
          <div
            className={
              compactItems
                ? "grid grid-cols-1 sm:grid-cols-2 sm:gap-x-3"
                : undefined
            }
          >
            {itemColumns.map((columnItems, columnIndex) => (
              <div
                key={`${job.id}-item-column-${columnIndex}`}
                className={
                  compactItems && columnIndex > 0
                    ? "sm:border-l sm:border-dashed sm:border-slate-200 sm:pl-3"
                    : undefined
                }
              >
                <div
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-dashed border-slate-300 pb-0.5 text-[11px] font-black ${
                    compactItems && columnIndex > 0 ? "hidden sm:grid" : ""
                  }`}
                >
                  <span>Món</span>
                  <span>SL</span>
                </div>
                <ul
                  className="mt-1 space-y-1"
                  aria-label={
                    compactItems
                      ? `Danh sách món pha chế, cột ${columnIndex + 1}`
                      : "Danh sách món pha chế"
                  }
                >
                  {columnItems.map((item, index) => (
                    <li
                      key={`${job.id}-${columnIndex}-${item.menuId}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[13px] leading-4"
                    >
                      <span className="min-w-0 break-words font-semibold">
                        {item.name}
                        {item.note ? (
                          <span className="mt-0.5 block text-[11px] font-bold text-red-700">
                            Ghi chú: {item.note}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-black tabular-nums">
                        {formatQuantity(item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => onComplete(job)}
        className={`absolute inset-x-[6.5%] bottom-12 z-20 flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-black uppercase tracking-wide transition-[background-color,color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:bottom-8 ${
          urgent
            ? "bg-red-600 text-white shadow-[0_4px_10px_rgba(220,38,38,0.28)] hover:bg-red-700 focus-visible:ring-[#F6C85F]"
            : "bg-[#006B52] text-[#F6C85F] shadow-[0_4px_10px_rgba(0,107,82,0.24)] hover:bg-[#005943] focus-visible:ring-[#F6C85F]"
        }`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Hoàn thành
      </button>
    </article>
  );
}
