import { ArrowRight, Clock3, ReceiptText, Trophy } from "lucide-react";
import Link from "next/link";
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

export default function OverviewTables({ snapshot }: { snapshot: OverviewSnapshot }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="top-products-title" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <h2 id="top-products-title" className="text-base font-semibold text-slate-900">Món bán chạy</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">Xếp theo số lượng đã bán</p>
          </div>
          <span className="text-xs font-medium text-slate-400">Top 10</span>
        </div>

        {snapshot.topProducts.length === 0 ? (
          <EmptyTable message="Chưa có món bán trong kỳ." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">#</th>
                  <th scope="col" className="px-3 py-3">Tên món</th>
                  <th scope="col" className="px-3 py-3 text-right">SL bán</th>
                  <th scope="col" className="px-5 py-3 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.topProducts.map((product, index) => (
                  <tr key={product.name} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-400">{index + 1}</td>
                    <td className="max-w-48 truncate px-3 py-3 font-medium text-slate-800">{product.name}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-600">{product.quantity.toLocaleString("vi-VN")}</td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-slate-800">{formatMoney(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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

function EmptyTable({ message }: { message: string }) {
  return <div className="px-5 py-12 text-center text-sm text-slate-500" role="status">{message}</div>;
}
