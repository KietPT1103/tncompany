"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Store } from "lucide-react";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { getBills } from "@/services/billService";
import { useStore } from "@/context/StoreContext";
import OverviewKpiBand from "./OverviewKpiBand";
import OverviewSalesChart from "./OverviewSalesChart";
import OverviewTables from "./OverviewTables";
import {
  buildOverviewSnapshot,
  calculatePercentageChange,
  getOverviewDateRanges,
  type OverviewRangePreset,
  type OverviewSnapshot,
} from "./overviewData";

const emptySnapshot = (startDate: Date, endDate: Date) =>
  buildOverviewSnapshot([], startDate, endDate);

const rangeOptions: readonly SelectBoxOption<OverviewRangePreset>[] = [
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "last7Days", label: "7 ngày qua" },
  { value: "thisMonth", label: "Tháng này" },
  { value: "lastMonth", label: "Tháng trước" },
];

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function OverviewPage() {
  const { storeId, storeName } = useStore();
  const [rangePreset, setRangePreset] = useState<OverviewRangePreset>("thisMonth");
  const ranges = useMemo(() => getOverviewDateRanges(rangePreset), [rangePreset]);
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>(() =>
    emptySnapshot(ranges.startDate, ranges.endDate),
  );
  const [previousSnapshot, setPreviousSnapshot] = useState<OverviewSnapshot>(() =>
    emptySnapshot(ranges.previousStartDate, ranges.previousEndDate),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const bills = await getBills({
        storeId,
        startDate: ranges.previousStartDate,
        endDate: ranges.endDate,
        includeCancelled: true,
        limitCount: 5000,
      });

      setSnapshot(buildOverviewSnapshot(bills, ranges.startDate, ranges.endDate));
      setPreviousSnapshot(
        buildOverviewSnapshot(bills, ranges.previousStartDate, ranges.previousEndDate),
      );
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      console.error(requestError);
      setError("Không thể tải dữ liệu tổng quan. Hãy kiểm tra kết nối và thử lại.");
    } finally {
      setLoading(false);
    }
  }, [ranges, storeId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const revenueChange = calculatePercentageChange(
    snapshot.totalRevenue,
    previousSnapshot.totalRevenue,
  );
  const orderChange = calculatePercentageChange(
    snapshot.orderCount,
    previousSnapshot.orderCount,
  );

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1440px] space-y-5 2xl:max-w-[1680px]">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Store className="h-4 w-4" aria-hidden="true" />
              <span>{storeName}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">Tổng quan kinh doanh</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Theo dõi doanh thu, đơn hàng và hiệu quả bán món từ dữ liệu POS thực tế.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SelectBox<OverviewRangePreset>
              value={rangePreset}
              options={rangeOptions}
              onValueChange={setRangePreset}
              ariaLabel="Lọc tổng quan theo thời gian"
              className="w-full sm:w-36"
              triggerClassName="h-10 rounded-lg border-slate-200 bg-white text-slate-700"
            />

            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
              Làm mới
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-2 border-y border-slate-200 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {formatShortDate(ranges.startDate)} - {formatShortDate(ranges.endDate)}
          </span>
          <span aria-live="polite">
            {loading
              ? "Đang cập nhật dữ liệu"
              : lastUpdatedAt
              ? `Cập nhật lúc ${lastUpdatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
              : "Đang đồng bộ dữ liệu"}
          </span>
        </div>

        {error ? (
          <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadOverview()} className="self-start font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 sm:self-auto">
              Thử lại
            </button>
          </div>
        ) : null}

        {loading && !lastUpdatedAt ? (
          <OverviewSkeleton />
        ) : (
          <>
            <OverviewKpiBand snapshot={snapshot} revenueChange={revenueChange} orderChange={orderChange} />
            <OverviewSalesChart snapshot={snapshot} />
            <OverviewTables snapshot={snapshot} />
          </>
        )}
      </div>
    </main>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải tổng quan">
      <div className="h-44 animate-pulse rounded-lg bg-white ring-1 ring-slate-200" />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-80 animate-pulse rounded-lg bg-white ring-1 ring-slate-200" />
        <div className="h-80 animate-pulse rounded-lg bg-white ring-1 ring-slate-200" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-white ring-1 ring-slate-200" />
        <div className="h-72 animate-pulse rounded-lg bg-white ring-1 ring-slate-200" />
      </div>
    </div>
  );
}
