import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CircleDollarSign, Clock3, WalletCards } from "lucide-react";
import type { RealtimeState } from "@/services/realtimeService";
import { getShiftLabel, type OverviewShiftRevenue as ShiftRevenue } from "@/services/overviewShiftData";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

const formatTime = (seconds?: number) =>
  seconds ? new Date(seconds * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--:--";

const formatDate = (seconds?: number) =>
  seconds ? new Date(seconds * 1000).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Không rõ ngày";

const dateKey = (seconds?: number) => {
  if (!seconds) return "unknown";
  const date = new Date(seconds * 1000);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
};

const realtimeLabel: Record<RealtimeState, string> = {
  connecting: "Đang kết nối",
  connected: "Realtime đang bật",
  disconnected: "Đã ngắt kết nối",
  unavailable: "Realtime không khả dụng",
  failed: "Realtime lỗi",
};

function ShiftRow({ row }: { row: ShiftRevenue }) {
  const isOpen = row.shift.status === "open";
  const variancePositive = (row.variance || 0) >= 0;
  return (
    <div className={`grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4 transition-colors sm:grid-cols-[minmax(160px,1.15fr)_minmax(135px,1fr)_minmax(145px,1fr)_minmax(135px,1fr)_minmax(165px,1.1fr)] sm:items-center ${isOpen ? "bg-emerald-50/45" : "hover:bg-slate-50"}`}>
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-slate-950">{getShiftLabel(row.shift.shiftType)}</p>
          {isOpen ? (
            <span className="rounded-sm bg-emerald-800 px-2 py-0.5 text-[11px] font-bold text-white">Đang mở</span>
          ) : (
            <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Đã chốt</span>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {formatTime(row.shift.openedAt?.seconds)} · {row.shift.cashierName || "Chưa xác định"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">Doanh thu</p>
        <p className="mt-1 font-bold tabular-nums text-emerald-900">{formatMoney(row.summary.totalSales)}</p>
        <p className="mt-1 text-xs text-slate-500">{row.summary.completedBills} bill hợp lệ · {row.summary.cancelledBills} bill hủy</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">Thanh toán</p>
        <p title="Tiền mặt" className="mt-1 text-sm font-semibold tabular-nums text-slate-800">TM: {formatMoney(row.summary.cashSales)}</p>
        <p title="Chuyển khoản" className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">CK: {formatMoney(row.summary.transferSales)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">Phiếu thu / chi</p>
        <p title="Phiếu thu" className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-800">PT: {formatMoney(row.summary.incomeVouchers)}</p>
        <p title="Phiếu chi" className="mt-0.5 text-sm font-semibold tabular-nums text-rose-700">PC: {formatMoney(row.summary.expenseVouchers)}</p>
      </div>
      <div className="min-w-0 text-left sm:text-right">
        <p className="text-xs font-medium text-slate-500">{isOpen ? "Dự kiến bàn giao" : "Đối soát cuối ca"}</p>
        <p className="mt-1 font-bold tabular-nums text-[#B8860B]">{formatMoney(row.summary.expectedClosingCash)}</p>
        {isOpen ? (
          <p className="mt-1 text-xs font-semibold text-emerald-700">Đang cập nhật realtime</p>
        ) : (
          <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${variancePositive ? "text-emerald-700" : "text-rose-600"}`}>
            {variancePositive ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
            {formatMoney(Math.abs(row.variance || 0))} chênh lệch
          </p>
        )}
      </div>
    </div>
  );
}

export default function OverviewShiftRevenue({
  rows,
  loading,
  error,
  realtimeState,
}: {
  rows: ShiftRevenue[];
  loading: boolean;
  error: string;
  realtimeState: RealtimeState;
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const dateGroups = useMemo(() => {
    const groups = new Map<string, { label: string; rows: ShiftRevenue[] }>();
    rows.forEach((row) => {
      const key = dateKey(row.shift.openedAt?.seconds);
      const group = groups.get(key) || { label: formatDate(row.shift.openedAt?.seconds), rows: [] };
      group.rows.push(row);
      groups.set(key, group);
    });
    return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [rows]);
  useEffect(() => {
    if (dateGroups.length === 0) {
      setSelectedDate("");
    } else if (!dateGroups.some(([key]) => key === selectedDate)) {
      setSelectedDate(dateGroups[0][0]);
    }
  }, [dateGroups, selectedDate]);
  const visibleRows = dateGroups.find(([key]) => key === selectedDate)?.[1].rows || [];

  return (
    <section aria-labelledby="overview-shift-revenue-title" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="overview-shift-revenue-title" className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <CircleDollarSign className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Doanh thu theo ca
          </h2>
          <p className="mt-1 text-sm text-slate-500">Theo dõi doanh thu và đối soát tiền theo từng ca trong ngày</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${realtimeState === "connected" ? "text-emerald-700" : "text-slate-500"}`} aria-live="polite">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" /> {realtimeLabel[realtimeState]}
        </span>
      </div>
      {loading && rows.length === 0 ? (
        <div className="grid gap-3 p-4" aria-busy="true" aria-label="Đang tải doanh thu theo ca">
          <div className="h-20 animate-pulse rounded-md bg-slate-100" />
          <div className="h-20 animate-pulse rounded-md bg-slate-100" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-rose-700" role="alert"><WalletCards className="h-5 w-5" aria-hidden="true" />{error}</div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">Chưa có dữ liệu ca trong khoảng thời gian này.</div>
      ) : (
        <>
          {dateGroups.length > 0 ? (
            <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2" role="tablist" aria-label="Chọn ngày xem doanh thu theo ca">
              {dateGroups.map(([key, group]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selectedDate === key}
                  onClick={() => setSelectedDate(key)}
                  className={`relative min-h-10 shrink-0 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${selectedDate === key ? "text-emerald-900" : "text-slate-500 hover:text-emerald-800"}`}
                >
                  {group.label}
                  {selectedDate === key ? <span className="absolute inset-x-2 bottom-0 h-0.5 bg-[#F6C85F]" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          ) : null}
          <div className="divide-y divide-slate-100">{visibleRows.map((row) => <ShiftRow key={row.shift.id} row={row} />)}</div>
        </>
      )}
    </section>
  );
}
