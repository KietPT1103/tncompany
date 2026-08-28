import { CalendarRange, CakeSlice, CupSoda } from "lucide-react";
import type { OverviewWeeklyQuantityRow } from "@/services/overviewShiftService";

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const shiftColumns = [
  { key: "shift_1", label: "Ca 1" },
  { key: "shift_2", label: "Ca 2" },
  { key: "shift_3", label: "Ca 3" },
] as const;

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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Ngày</th>
                {shiftColumns.map((shift) => <th key={shift.key} className="px-5 py-3 font-semibold">{shift.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.dateKey} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-3">
                    <p className="font-semibold capitalize text-slate-900">{row.date.toLocaleDateString("vi-VN", { weekday: "long" })}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
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
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
