import { CalendarRange, CakeSlice, CircleDollarSign, CupSoda } from "lucide-react";
import type { OverviewWeeklyQuantityRow } from "@/services/overviewShiftService";

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const formatRevenue = (value: number) => `${formatQuantity(value)} đ`;

const shiftColumns = [
  { key: "shift_1", label: "Ca 1" },
  { key: "shift_2", label: "Ca 2" },
  { key: "shift_3", label: "Ca 3" },
] as const;

const getDailyTotals = (row: OverviewWeeklyQuantityRow) =>
  shiftColumns.reduce(
    (totals, shift) => {
      const quantity = row.shifts[shift.key];

      return {
        cups: totals.cups + quantity.cups,
        bakery: totals.bakery + quantity.bakery,
        revenue: totals.revenue + quantity.revenue,
      };
    },
    { cups: 0, bakery: 0, revenue: 0 },
  );

export default function OverviewWeeklyQuantity({
  rows,
  loading,
  error,
}: {
  rows: OverviewWeeklyQuantityRow[];
  loading: boolean;
  error: string;
}) {
  return (
    <section aria-labelledby="overview-weekly-quantity-title" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 id="overview-weekly-quantity-title" className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <CalendarRange className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          Số lượng theo tuần
        </h2>
        <p className="mt-1 text-sm text-slate-500">7 ngày của tuần hiện tại, chia theo từng ca</p>
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2 p-4" aria-busy="true" aria-label="Đang tải số lượng theo tuần">
          {Array.from({ length: 7 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-md bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-sm text-rose-700" role="alert">{error}</div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 md:hidden">
            {rows.map((row) => {
              const dailyTotals = getDailyTotals(row);

              return (
                <article key={row.dateKey} className="px-3 py-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm font-semibold capitalize text-slate-900">
                      {row.date.toLocaleDateString("vi-VN", { weekday: "long" })}
                    </p>
                    <p className="text-xs tabular-nums text-slate-500">
                      {row.date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </p>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
                    <div className="rounded-lg bg-white px-2.5 py-2">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <CupSoda className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                        Tổng số ly
                      </p>
                      <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-800">{formatQuantity(dailyTotals.cups)} ly</p>
                    </div>
                    <div className="rounded-lg bg-white px-2.5 py-2">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <CakeSlice className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                        Tổng số bánh
                      </p>
                      <p className="mt-0.5 text-base font-bold tabular-nums text-amber-700">{formatQuantity(dailyTotals.bakery)} bánh</p>
                    </div>
                    <div className="col-span-2 rounded-lg bg-sky-50 px-2.5 py-2 ring-1 ring-inset ring-sky-100">
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                        <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                        Tổng tiền trong ngày
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-sky-700">{formatRevenue(dailyTotals.revenue)}</p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100">
                    {shiftColumns.map((shift) => {
                      const quantity = row.shifts[shift.key];
                      return (
                        <div key={shift.key} className="min-w-0 px-1.5 py-2.5 text-center">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{shift.label}</p>
                          <p className="mt-1.5 flex items-center justify-center gap-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-emerald-800">
                            <CupSoda className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Nước {formatQuantity(quantity.cups)}
                          </p>
                          <p className="mt-1 flex items-center justify-center gap-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-amber-700">
                            <CakeSlice className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Bánh {formatQuantity(quantity.bakery)}
                          </p>
                          <p className="mt-1 whitespace-nowrap text-[10px] font-bold tabular-nums text-sky-700">
                            DT {formatRevenue(quantity.revenue)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Ngày</th>
                {shiftColumns.map((shift) => <th key={shift.key} className="px-5 py-3 font-semibold">{shift.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const dailyTotals = getDailyTotals(row);

                return (
                  <tr key={row.dateKey} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-3">
                      <p className="font-semibold capitalize text-slate-900">{row.date.toLocaleDateString("vi-VN", { weekday: "long" })}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{row.date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tổng trong ngày</p>
                        <div className="mt-1 flex items-center gap-3 text-xs font-bold tabular-nums">
                          <span className="text-emerald-800">{formatQuantity(dailyTotals.cups)} ly</span>
                          <span className="text-amber-700">{formatQuantity(dailyTotals.bakery)} bánh</span>
                        </div>
                        <p className="mt-1 text-sm font-extrabold tabular-nums text-sky-700">{formatRevenue(dailyTotals.revenue)}</p>
                      </div>
                    </td>
                    {shiftColumns.map((shift) => {
                      const quantity = row.shifts[shift.key];
                      return (
                        <td key={shift.key} className="px-5 py-3">
                          <p className="flex items-center gap-1.5 font-semibold tabular-nums text-emerald-800">
                            <CupSoda className="h-4 w-4" aria-hidden="true" />
                            Nước: {formatQuantity(quantity.cups)} ly
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 font-semibold tabular-nums text-amber-700">
                            <CakeSlice className="h-4 w-4" aria-hidden="true" />
                            Bánh: {formatQuantity(quantity.bakery)}
                          </p>
                          <p className="mt-1 font-bold tabular-nums text-sky-700">
                            Doanh thu: {formatRevenue(quantity.revenue)}
                          </p>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}
