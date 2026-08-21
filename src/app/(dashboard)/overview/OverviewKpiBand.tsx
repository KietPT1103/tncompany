import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Banknote, CircleDollarSign, ClipboardList, CreditCard, PackageCheck, XCircle } from "lucide-react";
import type { OverviewSnapshot, OverviewVoucherTotals } from "./overviewData";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

function ChangeLabel({ value, comparisonLabel }: { value: number | null; comparisonLabel: string }) {
  if (value === null) {
    return <span className="text-xs text-slate-500">Chưa có kỳ đối chiếu</span>;
  }

  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={positive ? "inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" : "inline-flex items-center gap-1 text-xs font-semibold text-rose-600"}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(value).toFixed(1)}% so với {comparisonLabel}
    </span>
  );
}

export default function OverviewKpiBand({
  snapshot,
  voucherTotals,
  comparisonLabel,
  revenueChange,
  orderChange,
}: {
  snapshot: OverviewSnapshot;
  voucherTotals: OverviewVoucherTotals;
  comparisonLabel: string;
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
        <div className="relative min-w-0 overflow-hidden bg-gradient-to-b from-blue-100 via-blue-50 to-white px-5 py-5">
          <span
            aria-hidden="true"
            className="absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-blue-600"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Doanh thu thuần</p>
            <CircleDollarSign className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          </div>
          <p className="mt-3 truncate text-3xl font-black leading-none tabular-nums text-[#B8860B]">{formatMoney(snapshot.totalRevenue)}</p>
          <div className="mt-2"><ChangeLabel value={revenueChange} comparisonLabel={comparisonLabel} /></div>
        </div>

        <div className="relative min-w-0 overflow-hidden bg-gradient-to-b from-emerald-100 via-emerald-50 to-white px-5 py-5">
          <span
            aria-hidden="true"
            className="absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-emerald-600"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Số đơn hoàn tất</p>
            <ClipboardList className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{formatNumber(snapshot.orderCount)}</p>
          <div className="mt-2"><ChangeLabel value={orderChange} comparisonLabel={comparisonLabel} /></div>
        </div>

        <div className="relative min-w-0 overflow-hidden bg-gradient-to-b from-orange-100 via-orange-50 to-white px-5 py-5">
          <span
            aria-hidden="true"
            className="absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-orange-500"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Giá trị đơn trung bình</p>
            <PackageCheck className="h-5 w-5 shrink-0 text-orange-500" aria-hidden="true" />
          </div>
          <p className="mt-3 truncate text-2xl font-bold tabular-nums text-slate-950">{formatMoney(snapshot.averageOrder)}</p>
          <p className="mt-2 text-xs text-slate-500">{formatNumber(snapshot.itemsSold)} món đã bán</p>
        </div>

        <div className="relative min-w-0 overflow-hidden bg-gradient-to-b from-red-100 via-red-50 to-white px-5 py-5">
          <span
            aria-hidden="true"
            className="absolute inset-y-5 left-0 w-1.5 rounded-r-full bg-red-500"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">Đơn đã hủy</p>
            <XCircle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-950">{formatNumber(snapshot.cancelledCount)}</p>
          <p className="mt-2 text-xs text-slate-500">Không tính vào doanh thu</p>
        </div>
      </div>

      <div className="grid divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div><p className="text-xs font-medium text-slate-500">Tiền mặt</p><p className="mt-1 text-lg font-bold tabular-nums text-emerald-900">{formatMoney(snapshot.paymentTotals.cash)}</p></div>
          <Banknote className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div><p className="text-xs font-medium text-slate-500">Chuyển khoản</p><p className="mt-1 text-lg font-bold tabular-nums text-emerald-900">{formatMoney(snapshot.paymentTotals.transfer)}</p></div>
          <CreditCard className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div><p className="text-xs font-medium text-slate-500">Phiếu thu</p><p className="mt-1 text-lg font-bold tabular-nums text-emerald-900">{formatMoney(voucherTotals.income)}</p></div>
          <ArrowUpRight className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div><p className="text-xs font-medium text-slate-500">Phiếu chi</p><p className="mt-1 text-lg font-bold tabular-nums text-rose-700">{formatMoney(voucherTotals.expense)}</p></div>
          <ArrowDownLeft className="h-5 w-5 text-rose-600" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
