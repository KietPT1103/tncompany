import { ArrowDownRight, ArrowUpRight, CircleDollarSign, ClipboardList, PackageCheck, XCircle } from "lucide-react";
import type { OverviewSnapshot } from "./overviewData";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

function ChangeLabel({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-xs text-slate-500">Chưa có kỳ đối chiếu</span>;
  }

  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={positive ? "inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" : "inline-flex items-center gap-1 text-xs font-semibold text-rose-600"}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(value).toFixed(1)}% so với kỳ trước
    </span>
  );
}

export default function OverviewKpiBand({
  snapshot,
  revenueChange,
  orderChange,
}: {
  snapshot: OverviewSnapshot;
  revenueChange: number | null;
  orderChange: number | null;
}) {
  return (
    <section aria-labelledby="business-snapshot-title" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="business-snapshot-title" className="text-base font-semibold text-slate-900">Bức tranh kinh doanh</h2>
          <p className="mt-1 text-sm text-slate-500">Tóm tắt theo khoảng thời gian đang chọn</p>
        </div>
        <span className="hidden text-xs font-medium text-slate-400 sm:inline">Đơn vị: VNĐ</span>
      </div>

      <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <div className="min-w-0 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Doanh thu thuần</p>
            <CircleDollarSign className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-3 truncate text-3xl font-black leading-none tabular-nums text-[#B8860B]">{formatMoney(snapshot.totalRevenue)}</p>
          <div className="mt-2"><ChangeLabel value={revenueChange} /></div>
        </div>

        <div className="min-w-0 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Số đơn hoàn tất</p>
            <ClipboardList className="h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{formatNumber(snapshot.orderCount)}</p>
          <div className="mt-2"><ChangeLabel value={orderChange} /></div>
        </div>

        <div className="min-w-0 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Giá trị đơn trung bình</p>
            <PackageCheck className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          </div>
          <p className="mt-3 truncate text-2xl font-bold tabular-nums text-slate-950">{formatMoney(snapshot.averageOrder)}</p>
          <p className="mt-2 text-xs text-slate-500">{formatNumber(snapshot.itemsSold)} món đã bán</p>
        </div>

        <div className="min-w-0 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Đơn đã hủy</p>
            <XCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{formatNumber(snapshot.cancelledCount)}</p>
          <p className="mt-2 text-xs text-slate-500">Không tính vào doanh thu</p>
        </div>
      </div>
    </section>
  );
}
