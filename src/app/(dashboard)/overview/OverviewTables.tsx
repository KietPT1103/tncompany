import { ArrowRight, CakeSlice, Clock3, ReceiptText, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { OverviewSnapshot } from "./overviewData";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatTime = (seconds?: number) =>
  seconds
    ? new Date(seconds * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

const rankClassName = (index: number) =>
  index === 0 ? "bg-[#FFF4C2] text-[#B8860B]" : index === 1 ? "bg-slate-100 text-slate-600" : index === 2 ? "bg-[#F8E5D0] text-amber-800" : "bg-slate-50 text-slate-400";

export default function OverviewTables({ snapshot }: { snapshot: OverviewSnapshot }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <ProductTableSection
        id="top-products-title"
        title="Món bán chạy"
        subtitle="Xếp theo số lượng đã bán"
        icon={<Trophy className="h-4 w-4 text-amber-600" aria-hidden="true" />}
        products={snapshot.topProducts}
        emptyMessage="Chưa có món bán trong kỳ."
      />
      <ProductTableSection
        id="bakery-products-title"
        title="Bánh ngọt bán chạy"
        subtitle="Các món bánh đã bán trong kỳ"
        icon={<CakeSlice className="h-4 w-4 text-orange-500" aria-hidden="true" />}
        products={snapshot.bakeryProducts}
        emptyMessage="Chưa có bánh ngọt bán trong kỳ."
      />

      <section aria-labelledby="recent-bills-title" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h2 id="recent-bills-title" className="text-base font-semibold text-slate-900">Giao dịch gần đây</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Các bill mới nhất trong kỳ</p>
          </div>
          <Link href="/bills" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
            Xem tất cả <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {snapshot.recentBills.length === 0 ? (
          <EmptyTable message="Chưa có giao dịch trong kỳ." />
        ) : (
          <div className="divide-y divide-slate-100">
            {snapshot.recentBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{bill.id}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatTime(bill.createdAt?.seconds)} · Bàn {bill.tableNumber || "--"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={bill.status === "cancelled" ? "font-semibold tabular-nums text-rose-600 line-through" : "font-semibold tabular-nums text-slate-900"}>{formatMoney(bill.total)}</p>
                  <p className={bill.status === "cancelled" ? "mt-1 text-xs font-medium text-rose-600" : "mt-1 text-xs font-medium text-emerald-700"}>{bill.status === "cancelled" ? "Đã hủy" : bill.paymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProductTableSection({
  id,
  title,
  subtitle,
  icon,
  products,
  emptyMessage,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  products: OverviewSnapshot["topProducts"];
  emptyMessage: string;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 id={id} className="truncate text-base font-semibold text-slate-900">{title}</h2>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-slate-400">Top 10</span>
      </div>
      {products.length === 0 ? (
        <EmptyTable message={emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr><th scope="col" className="px-4 py-3">#</th><th scope="col" className="px-3 py-3">Tên món</th><th scope="col" className="px-3 py-3 text-right">SL bán</th><th scope="col" className="px-4 py-3 text-right">Doanh thu</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product, index) => (
                <tr key={product.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-sm px-1.5 text-xs font-bold tabular-nums ${rankClassName(index)}`}>{index + 1}</span></td>
                  <td className="max-w-40 truncate px-3 py-3 font-medium text-slate-800">{product.name}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600">{product.quantity.toLocaleString("vi-VN")}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-800">{formatMoney(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyTable({ message }: { message: string }) {
  return <div className="px-5 py-12 text-center text-sm text-slate-500" role="status">{message}</div>;
}
