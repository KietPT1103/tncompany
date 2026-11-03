import { ChevronDown } from 'lucide-react';
import type { RevenueCashflow, CashflowDay } from './types';

const cash = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value)
  ? `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ₫` : '—';
const date = (value: string) => value.split('-').reverse().join('/');
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

function Subtraction({ gross, cost, net, large = false }: {
  gross: number | null; cost: number | null; net: number | null; large?: boolean;
}) {
  return <dl className="space-y-3 tabular-nums">
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-slate-600">Tiền bàn giao</dt>
      <dd className="break-words text-right text-lg font-semibold text-slate-900">{cash(gross)}</dd>
    </div>
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-slate-600">Tổng chi ngoài</dt>
      <dd className="break-words text-right text-lg font-semibold text-rose-700">
        <span className="mr-2" aria-hidden="true">{cost !== null && cost < 0 ? '+' : '−'}</span>
        {cash(cost === null ? null : Math.abs(cost))}
      </dd>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-slate-300 pt-3">
      <dt className="text-sm font-bold text-slate-800">Bàn giao sau chi</dt>
      <dd className={`break-words text-right font-extrabold tracking-tight ${large ? 'text-2xl' : 'text-xl'} ${net !== null && net < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
        {cash(net)}
      </dd>
    </div>
  </dl>;
}

function DayDetail({ day }: { day: CashflowDay }) {
  return <details className="group rounded-xl border border-slate-200 bg-white">
    <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm ${focus}`}>
      <span className="font-semibold text-slate-700">{date(day.date)}</span>
      <span className="flex items-center gap-2 font-bold text-emerald-900">{cash(day.netHandover)}<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 group-open:rotate-180" aria-hidden="true" /></span>
    </summary>
    <div className="space-y-4 border-t border-slate-100 p-3">
      <Subtraction gross={day.grossHandover} cost={day.outsideExpense} net={day.netHandover} />
      {!day.complete && <p className="text-xs text-amber-800">Chưa đủ dữ liệu sheet chi.</p>}
      {day.shifts.map(shift => <div key={shift.id} className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
        <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-700">{shift.label}{shift.status === 'provisional' ? ' · Tạm tính' : ''}</span><strong className="text-sm text-slate-900 tabular-nums">{cash(shift.netHandover)}</strong></div>
        {shift.transferOut > 0 && <p className="mt-1 text-slate-500">Đã chuyển sang ca khác {cash(shift.transferOut)}</p>}
        {shift.transferIn > 0 && <p className="mt-1 text-slate-500">Đã thu từ ca trước {cash(shift.transferIn)}</p>}
        {shift.outsideExpense !== null && shift.outsideExpense !== 0 && <p className="mt-1 text-slate-500">Đã trừ chi ngoài {cash(shift.outsideExpense)}</p>}
      </div>)}
    </div>
  </details>;
}

const storeColors: Record<string, string> = {
  cafe: 'bg-emerald-100 text-emerald-800', restaurant: 'bg-orange-100 text-orange-800',
  bakery: 'bg-pink-100 text-pink-800', farm: 'bg-lime-100 text-lime-800', warehouse: 'bg-blue-100 text-blue-800',
};

export default function CashflowPanel({ data, allStores = false, stores = [] }: {
  data: RevenueCashflow; allStores?: boolean; stores?: Array<{ id: string; name: string }>;
}) {
  const names = Object.fromEntries(stores.map(store => [store.id, store.name]));
  const partial = allStores && !data.complete;
  const days = data.days.map(day => {
    if (!partial || day.complete || day.expenses.length === 0) return day;
    const outsideExpense = day.expenses.reduce((sum, item) => sum + item.amount, 0);
    return { ...day, outsideExpense, netHandover: day.grossHandover === null ? null : day.grossHandover - outsideExpense };
  });
  const known = days.some(day => day.outsideExpense !== null);
  const outsideExpense = partial && known ? days.reduce((sum, day) => sum + (day.outsideExpense ?? 0), 0) : data.outsideExpense;
  const netHandover = partial && outsideExpense !== null && data.grossHandover !== null
    ? data.grossHandover - outsideExpense : data.netHandover;
  const count = data.days.reduce((sum, day) => sum + day.expenses.length, 0);
  const stale = data.days.some(day => day.syncStatus === 'stale');
  return <section aria-label="Dòng tiền thực tế" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-bold text-slate-900">Dòng tiền thực tế</h2>
      {!data.complete ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">{partial && known ? 'Tạm tính' : 'Chưa đủ dữ liệu'}</span>
        : data.provisional ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">Tạm tính</span>
          : stale ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Sheet chưa cập nhật</span> : null}
    </div>
    <Subtraction gross={data.grossHandover} cost={outsideExpense} net={netHandover} large />
    {partial && known && <p className="text-xs text-amber-800">Tạm tính theo các khoản chi đã đồng bộ. Một số quầy/ngày chưa có đủ dữ liệu chi ngoài.</p>}
    <details data-expense-list className="group rounded-xl border border-slate-200 bg-slate-50">
      <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm ${focus}`}>
        <span className="font-semibold text-slate-700">Chi ngoài{count > 0 ? ` · ${count} khoản` : ''}</span>
        <span className="flex items-center gap-2 font-bold text-slate-800 tabular-nums">{cash(outsideExpense)}<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 group-open:rotate-180" aria-hidden="true" /></span>
      </summary>
      <div className="border-t border-slate-200 px-3">
        {!data.complete && <p className="py-3 text-xs text-amber-800">Chưa liên kết hoặc chưa đồng bộ đủ tháng/quầy đã chọn.</p>}
        {data.complete && count === 0 && <p className="py-3 text-sm text-slate-500">Không có khoản chi ngoài.</p>}
        {data.days.filter(day => day.expenses.length > 0).map(day => <div key={day.date}>
          {data.days.length > 1 && <p className="pt-3 text-xs font-semibold text-slate-500">{date(day.date)}</p>}
          <ul className="divide-y divide-slate-200">
            {day.expenses.map((item, index) => <li key={`${day.date}-${item.storeId}-${index}`} className="flex items-start justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 break-words text-slate-700">
                {allStores && <span data-store-tag={item.storeId} className={`mb-1 mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${storeColors[item.storeId] || 'bg-slate-200 text-slate-800'}`}>{names[item.storeId] || item.storeId}</span>}
                {item.name || 'Chi ngoài'}
              </span>
              <strong className="shrink-0 text-slate-900 tabular-nums">{cash(item.amount)}</strong>
            </li>)}
          </ul>
        </div>)}
      </div>
    </details>
    <details className="group border-t border-slate-100 pt-2">
      <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg text-sm font-semibold text-slate-700 ${focus}`}>
        Bàn giao từng ngày, từng ca<ChevronDown className="h-4 w-4 text-slate-400 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-2 pt-2">{days.map(day => <DayDetail key={day.date} day={day} />)}</div>
    </details>
  </section>;
}
