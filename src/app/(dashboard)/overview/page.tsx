"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Store } from "lucide-react";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { getBills } from "@/services/billService";
import { getCashVouchers } from "@/services/cashVoucherService";
import { getAllProducts, type Product } from "@/services/products";
import { getCategories, type Category } from "@/services/categoryService";
import { useStore } from "@/context/StoreContext";
import OverviewKpiBand from "./OverviewKpiBand";
import OverviewSalesChart from "./OverviewSalesChart";
import OverviewTables from "./OverviewTables";
import OverviewShiftRevenue from "./OverviewShiftRevenue";
import OverviewWeeklyQuantity from "@/components/OverviewWeeklyQuantity";
import {
  buildOverviewSnapshot,
  calculateOverviewVoucherTotals,
  calculatePercentageChange,
  getOverviewDateRanges,
  getOverviewComparisonLabel,
  type OverviewRangePreset,
  type OverviewCustomRange,
  type OverviewSnapshot,
  type OverviewVoucherTotals,
} from "./overviewData";
import {
  loadOverviewShiftRevenue,
  loadOverviewWeeklyQuantity,
  type OverviewWeeklyQuantityRow,
} from "@/services/overviewShiftService";
import { subscribeRealtimeResource, type RealtimeState } from "@/services/realtimeService";

const emptySnapshot = (startDate: Date, endDate: Date) =>
  buildOverviewSnapshot([], startDate, endDate);

const rangeOptions: readonly SelectBoxOption<OverviewRangePreset>[] = [
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "last7Days", label: "7 ngày qua" },
  { value: "thisMonth", label: "Tháng này" },
  { value: "lastMonth", label: "Tháng trước" },
  { value: "custom", label: "Tùy chỉnh" },
];

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatDateInputValue = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

const getCurrentWeekRange = () => {
  const now = new Date();
  const startDate = new Date(now);
  const dayFromMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  startDate.setDate(now.getDate() - dayFromMonday);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

const normalizeCategory = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const getBakeryProductCodes = (products: Product[], categories: Category[]) => {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  return new Set(products.filter((product) => {
    const category = categoryNames.get(product.category || "") || product.categoryName || product.category || "";
    return normalizeCategory(category) === "banh";
  }).map((product) => product.product_code));
};

const getConfiguredBakeryProductCodes = (products: Product[], categories: Category[]) => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  return new Set(products.filter((product) => {
    const category = categoriesById.get(product.category || "");
    return category?.isSeparatedInSalesReport === true;
  }).map((product) => product.product_code));
};

const legacyNonDrinkCategoryPrefixes = ["banh", "topping", "do an", "mon an", "thuc an"];

const getCupProductCodes = (products: Product[], categories: Category[]) => {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoriesByName = new Map(
    categories.map((category) => [normalizeCategory(category.name), category]),
  );

  return new Set(products.filter((product) => {
    const categoryValue = product.categoryName || product.category || "";
    const category = categoriesById.get(product.category || "")
      || categoriesByName.get(normalizeCategory(categoryValue));
    if (category?.isCupCountConfigured === true) {
      return category.countsAsCup === true;
    }

    const categoryName = normalizeCategory(category?.name || categoryValue);
    if (!categoryName) return false;
    return !legacyNonDrinkCategoryPrefixes.some(
      (prefix) => categoryName === prefix || categoryName.startsWith(`${prefix} `),
    );
  }).map((product) => product.product_code));
};

export default function OverviewPage() {
  const { storeId, storeName } = useStore();
  const [rangePreset, setRangePreset] = useState<OverviewRangePreset>("today");
  const [customRange, setCustomRange] = useState<OverviewCustomRange>({ startDate: new Date(), endDate: new Date() });
  const ranges = useMemo(() => {
    if (rangePreset === "custom") {
      return getOverviewDateRanges("custom", new Date(), customRange);
    }
    return getOverviewDateRanges(rangePreset);
  }, [customRange, rangePreset]);
  const weeklyRange = useMemo(() => getCurrentWeekRange(), []);
  const [snapshot, setSnapshot] = useState<OverviewSnapshot>(() =>
    emptySnapshot(ranges.startDate, ranges.endDate),
  );
  const [previousSnapshot, setPreviousSnapshot] = useState<OverviewSnapshot>(() =>
    emptySnapshot(ranges.previousStartDate, ranges.previousEndDate),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [voucherTotals, setVoucherTotals] = useState<OverviewVoucherTotals>({ income: 0, expense: 0 });
  const [shiftRevenue, setShiftRevenue] = useState<Awaited<ReturnType<typeof loadOverviewShiftRevenue>>>([]);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");
  const [shiftRealtimeState, setShiftRealtimeState] = useState<RealtimeState>("connecting");
  const [cupProductCodes, setCupProductCodes] = useState<ReadonlySet<string> | null>(null);
  const [bakeryProductCodes, setBakeryProductCodes] = useState<ReadonlySet<string> | null>(null);
  const [weeklyQuantity, setWeeklyQuantity] = useState<OverviewWeeklyQuantityRow[]>([]);
  const [weeklyQuantityLoading, setWeeklyQuantityLoading] = useState(true);
  const [weeklyQuantityError, setWeeklyQuantityError] = useState("");

  useEffect(() => {
    setCupProductCodes(null);
    setBakeryProductCodes(null);
  }, [storeId]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [bills, vouchers, products, categories] = await Promise.all([
        getBills({
          storeId,
          startDate: ranges.previousStartDate,
          endDate: ranges.endDate,
          includeCancelled: true,
          limitCount: 5000,
        }),
        getCashVouchers({
          storeId,
          startDate: ranges.startDate,
          endDate: ranges.endDate,
          limitCount: 5000,
        }),
        getAllProducts(storeId).catch(() => [] as Product[]),
        getCategories(storeId).catch(() => [] as Category[]),
      ]);
      const bakeryProductCodes = getBakeryProductCodes(products, categories);
      const nextCupProductCodes = getCupProductCodes(products, categories);
      const nextConfiguredBakeryProductCodes = getConfiguredBakeryProductCodes(products, categories);
      setCupProductCodes(nextCupProductCodes);
      setBakeryProductCodes(nextConfiguredBakeryProductCodes);

      setSnapshot(buildOverviewSnapshot(
        bills,
        ranges.startDate,
        ranges.endDate,
        bakeryProductCodes,
        nextCupProductCodes,
      ));
      setPreviousSnapshot(
        buildOverviewSnapshot(
          bills,
          ranges.previousStartDate,
          ranges.previousEndDate,
          bakeryProductCodes,
          nextCupProductCodes,
        ),
      );
      setVoucherTotals(calculateOverviewVoucherTotals(vouchers, ranges.startDate, ranges.endDate));
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

  const loadShiftRevenue = useCallback(
    () => loadOverviewShiftRevenue({
      storeId,
      startDate: ranges.startDate,
      endDate: ranges.endDate,
      cupProductCodes: cupProductCodes || new Set(),
    }),
    [cupProductCodes, ranges.endDate, ranges.startDate, storeId],
  );

  useEffect(() => {
    if (!storeId || cupProductCodes === null) {
      setShiftRevenue([]);
      setShiftLoading(Boolean(storeId));
      return;
    }

    setShiftLoading(true);
    setShiftError("");
    return subscribeRealtimeResource({
      storeId,
      events: ["bill-created", "bill-updated", "bill-deleted", "shifts-updated"],
      loader: loadShiftRevenue,
      onChange: (rows) => {
        setShiftRevenue(rows);
        setShiftLoading(false);
        setShiftError("");
      },
      onError: (reason) => {
        setShiftLoading(false);
        setShiftError(reason.message || "Không thể tải doanh thu theo ca.");
      },
      onState: setShiftRealtimeState,
      fallbackMs: 30_000,
    });
  }, [cupProductCodes, loadShiftRevenue, storeId]);

  const loadWeeklyQuantity = useCallback(
    () => loadOverviewWeeklyQuantity({
      storeId,
      startDate: weeklyRange.startDate,
      endDate: weeklyRange.endDate,
      cupProductCodes: cupProductCodes || new Set(),
      bakeryProductCodes: bakeryProductCodes || new Set(),
    }),
    [bakeryProductCodes, cupProductCodes, storeId, weeklyRange.endDate, weeklyRange.startDate],
  );

  useEffect(() => {
    if (!storeId || cupProductCodes === null || bakeryProductCodes === null) {
      setWeeklyQuantity([]);
      setWeeklyQuantityLoading(Boolean(storeId));
      return;
    }

    setWeeklyQuantityLoading(true);
    setWeeklyQuantityError("");
    return subscribeRealtimeResource({
      storeId,
      events: ["bill-created", "bill-updated", "bill-deleted", "shifts-updated"],
      loader: loadWeeklyQuantity,
      onChange: (rows) => {
        setWeeklyQuantity(rows);
        setWeeklyQuantityLoading(false);
        setWeeklyQuantityError("");
      },
      onError: (reason) => {
        setWeeklyQuantityLoading(false);
        setWeeklyQuantityError(reason.message || "Không thể tải số lượng theo tuần.");
      },
      fallbackMs: 30_000,
    });
  }, [bakeryProductCodes, cupProductCodes, loadWeeklyQuantity, storeId]);

  const revenueChange = calculatePercentageChange(
    snapshot.totalRevenue,
    previousSnapshot.totalRevenue,
  );
  const orderChange = calculatePercentageChange(
    snapshot.orderCount,
    previousSnapshot.orderCount,
  );
  const comparisonLabel = getOverviewComparisonLabel(rangePreset, ranges.previousStartDate, ranges.previousEndDate);

  return (
    <main className="min-h-full bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1440px] space-y-5 2xl:max-w-[1680px]">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Store className="h-4 w-4" aria-hidden="true" />
              <span>{storeName}</span>
            </div>
            <h1 className="mt-2 font-smooch text-4xl font-bold leading-none text-emerald-800 sm:text-6xl">Tổng quan kinh doanh</h1>
            <p className="mt-1 max-w-2xl text-sm font-medium text-[#d6ba5d]">
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
              triggerClassName="h-10 rounded-sm border border-slate-200 bg-white text-emerald-900 hover:border-slate-300 focus-visible:ring-emerald-800/25"
              openTriggerClassName="!border-emerald-800 !ring-0"
            />

            <DateRangePicker
              label="Khoảng ngày tùy chỉnh"
              startDate={rangePreset === "custom" ? formatDateInputValue(customRange.startDate) : ""}
              endDate={rangePreset === "custom" ? formatDateInputValue(customRange.endDate) : ""}
              onChange={(startDate, endDate) => {
                setCustomRange({
                  startDate: new Date(`${startDate}T12:00:00`),
                  endDate: new Date(`${endDate}T12:00:00`),
                });
                setRangePreset("custom");
              }}
              hideLabel
              summary={rangePreset === "custom" ? undefined : "Chọn khoảng ngày"}
              className="w-full sm:w-80"
              triggerClassName="h-10 rounded-sm border border-slate-200 bg-white text-emerald-900 shadow-sm hover:border-slate-300 focus-visible:ring-emerald-800/25 [&_svg]:text-emerald-800"
              openTriggerClassName="!border-emerald-800 !ring-0"
            />

            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-slate-200 bg-white px-3 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`text-emerald-800 ${loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}`} aria-hidden="true" />
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
            <OverviewKpiBand snapshot={snapshot} voucherTotals={voucherTotals} comparisonLabel={comparisonLabel} revenueChange={revenueChange} orderChange={orderChange} />
            <OverviewShiftRevenue rows={shiftRevenue} loading={shiftLoading} error={shiftError} realtimeState={shiftRealtimeState} />
            <OverviewWeeklyQuantity rows={weeklyQuantity} loading={weeklyQuantityLoading} error={weeklyQuantityError} />
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
