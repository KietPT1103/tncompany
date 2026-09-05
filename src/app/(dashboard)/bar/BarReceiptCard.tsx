"use client";

import { Check, Clock3, CornerDownRight, Loader2 } from "lucide-react";
import type { BarPrintJob } from "@/services/barPrintJobService";
import {
  BAR_KDS_RECEIPT_CONTENT_FOOTER_GAP_PX,
  BAR_KDS_RECEIPT_FOOTER_SAFE_AREA_PX,
  BAR_KDS_RECEIPT_HEADER_SAFE_AREA_PX,
  BAR_KDS_TICKET_VERTICAL_OVERLAP_PX,
  type BarKdsTicketSegment,
} from "./barBoardQueue";
import { getBarWaitState } from "./barWaitState";

type BarReceiptCardProps = {
  segment: BarKdsTicketSegment;
  now: number;
  busy: boolean;
  overlapPrevious?: boolean;
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
  segment,
  now,
  busy,
  overlapPrevious = false,
  onComplete,
  onShowDetails,
}: BarReceiptCardProps) {
  const { job } = segment;
  const minutes = elapsedMinutes(job, now);
  const urgent = getBarWaitState(minutes) === "urgent";
  const createdAt = getCreatedDate(job);
  const queueLabel = String(segment.queueNumber).padStart(2, "0");
  const isFirstInQueue = segment.queueNumber === 1;

  return (
    <article
      data-bar-receipt="true"
      data-bar-job-id={job.id}
      data-bar-segment={segment.segmentIndex + 1}
      data-first-in-queue={isFirstInQueue ? "true" : undefined}
      data-urgent={urgent ? "true" : undefined}
      className="group relative isolate mx-auto w-full shrink-0 px-[7%] text-slate-950 transition-transform duration-200 ease-out hover:z-10 hover:-translate-y-1 focus-within:z-10 focus-within:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
      style={{
        paddingTop: `${BAR_KDS_RECEIPT_HEADER_SAFE_AREA_PX}px`,
        paddingBottom: `${BAR_KDS_RECEIPT_FOOTER_SAFE_AREA_PX}px`,
        marginTop: overlapPrevious
          ? `-${BAR_KDS_TICKET_VERTICAL_OVERLAP_PX}px`
          : undefined,
      }}
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
          filter: isFirstInQueue
            ? "drop-shadow(0 -5px 9px rgba(246, 200, 95, 0.48))"
            : "drop-shadow(0 -5px 8px rgba(15, 23, 42, 0.16))",
        }}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 brightness-110 transition-[filter] duration-200 ease-out motion-reduce:transition-none ${
          isFirstInQueue
            ? "drop-shadow-[0_8px_11px_rgba(246,200,95,0.38)] group-hover:drop-shadow-[0_13px_17px_rgba(246,200,95,0.52)] group-focus-within:drop-shadow-[0_13px_17px_rgba(246,200,95,0.52)]"
            : "drop-shadow-[0_7px_9px_rgba(15,23,42,0.15)] group-hover:drop-shadow-[0_13px_16px_rgba(15,23,42,0.23)] group-focus-within:drop-shadow-[0_13px_16px_rgba(15,23,42,0.23)]"
        }`}
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
        className={`absolute inset-x-[7%] top-5 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 ${
          segment.isFinal ? "bottom-[4.75rem]" : "bottom-5"
        }`}
        aria-label={`Xem toàn bộ bill ${job.tableNumber || "mang về"}, phần ${segment.segmentIndex + 1} trên ${segment.segmentCount}`}
      >
        <span className="sr-only">Xem toàn bộ chi tiết bill</span>
      </button>

      <div className="relative flex min-h-0 flex-col px-2.5">
        {segment.isContinuation ? (
          <div className="flex items-start justify-between gap-2 border-b border-dashed border-slate-300 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <CornerDownRight
                  className="h-4 w-4 shrink-0 text-[#006B52]"
                  aria-hidden="true"
                />
                <h3 className="truncate text-[13px] font-black text-slate-950">
                  Tiếp tục · #{queueLabel}
                </h3>
              </div>
              <p className="mt-0.5 pl-[22px] text-[10px] font-bold text-[#315F53]">
                Còn {segment.remainingItemCount} món · phần {segment.segmentIndex + 1}/{segment.segmentCount}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-black tabular-nums ${
                urgent
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {minutes}p
            </span>
          </div>
        ) : (
          <>
            <div className="relative flex min-h-6 items-start justify-between gap-3">
              <span
                aria-label={`Bill thứ ${segment.queueNumber}`}
                className="inline-flex min-w-8 items-center justify-center rounded bg-[#006B52] px-1.5 py-0.5 text-[11px] font-black tabular-nums text-[#F6C85F]"
              >
                #{queueLabel}
              </span>
              <h3 className="min-w-0 flex-1 text-center text-[15px] font-black uppercase tracking-[-0.02em] text-slate-950">
                Chế biến
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-black tabular-nums ${
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
              <dd className="truncate font-bold">
                {job.tableNumber || "Mang về"}
              </dd>
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
          </>
        )}

        <div className={`${segment.isContinuation ? "mt-2" : "mt-2 border-t border-dashed border-slate-300 pt-1.5"}`}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-dashed border-slate-300 pb-0.5 text-[11px] font-black">
            <span>Món</span>
            <span>SL</span>
          </div>
          <ul className="mt-1 space-y-1" aria-label="Danh sách món pha chế">
            {segment.items.map((item, index) => (
              <li
                key={`${job.id}-${segment.segmentIndex}-${item.menuId}-${segment.itemStartIndex + index}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-[13px] leading-[18px]"
              >
                <span className="min-w-0 break-words font-semibold">
                  {item.name}
                  {item.note ? (
                    <span className="mt-0.5 flex items-start gap-1.5 text-[11px] font-bold leading-[15px] text-red-700">
                      <CornerDownRight
                        className="mt-px h-3.5 w-3.5 shrink-0 text-[#006B52]"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">Ghi chú: {item.note}</span>
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

        {!segment.isFinal ? (
          <div
            className="flex items-center justify-end gap-1 text-[10px] font-black text-[#006B52]"
            style={{
              marginTop: `${BAR_KDS_RECEIPT_CONTENT_FOOTER_GAP_PX}px`,
            }}
          >
            Tiếp tục ở thẻ kế bên
            <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onComplete(job)}
            className={`relative z-20 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-black uppercase tracking-wide transition-[background-color,color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${
              urgent
                ? "bg-red-600 text-white shadow-[0_4px_10px_rgba(220,38,38,0.28)] hover:bg-red-700 focus-visible:ring-[#F6C85F]"
                : "bg-[#006B52] text-[#F6C85F] shadow-[0_4px_10px_rgba(0,107,82,0.24)] hover:bg-[#005943] focus-visible:ring-[#F6C85F]"
            }`}
            style={{
              marginTop: `${BAR_KDS_RECEIPT_CONTENT_FOOTER_GAP_PX}px`,
            }}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Hoàn thành
          </button>
        )}
      </div>
    </article>
  );
}
