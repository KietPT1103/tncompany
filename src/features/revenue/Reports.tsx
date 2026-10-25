import { Banknote, ArrowDownLeft, ArrowUpRight, Coffee, CakeSlice, Receipt, BedDouble, ShoppingBag } from 'lucide-react';
import type { RevenueReport, Metrics } from './types';

export const number = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '—';
export const money = (value: number | undefined) => `${number(value)} ₫`;
const dateLabel = (date: string) => new Date(`${date}T12:00:00+07:00`).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

function Stat({ label, value, icon: Icon, color = 'text-slate-600', count = false }: { label: string; value: number; icon: typeof Coffee; color?: string; count?: boolean }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4">
    <div className={`mb-3 flex items-center gap-2 text-xs font-semibold ${color}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}</div>
    <div className="break-words text-xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-2xl">{count ? number(value) : money(value)}</div>
  </div>;
}

function Payments({ totals }: { totals: Metrics }) {
  return <div className="grid grid-cols-2 gap-3">
    <Stat label="Tiền mặt" value={totals.cash} icon={Banknote} color="text-emerald-700" />
    <Stat label="Chuyển khoản" value={totals.transfer} icon={ArrowDownLeft} color="text-blue-700" />
  </div>;
}

function Trend({ data, field, color }: { data: RevenueReport; field: string; color: string }) {
  const max = Math.max(1, ...data.days.map(day => day.totals[field] || 0));
  return <div className="flex h-14 items-end gap-1.5" aria-label="Doanh thu theo ngày">
    {[...data.days].reverse().map(day => <div key={day.date} className="flex h-full min-w-0 flex-1 items-end" title={`${dateLabel(day.date)}: ${money(day.totals[field])}`}>
      <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(3, (day.totals[field] || 0) / max * 100)}%`, opacity: day.totals[field] ? 1 : .2 }} />
    </div>)}
  </div>;
}

export function TnReport({ data }: { data: RevenueReport }) {
  const t = data.totals;
  const labels: Record<string, string> = { shift_1: 'Ca 1', shift_2: 'Ca 2', shift_3: 'Ca 3', single: 'Ca đơn', unassigned: 'Chưa gán ca' };
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-3xl bg-emerald-950 p-5 text-white sm:p-7">
      <div className="flex items-center justify-between text-sm text-emerald-200"><span>Doanh thu</span><span>{number(t.bills)} hóa đơn</span></div>
      <div className="my-3 break-words text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{money(t.revenue)}</div>
      {data.from !== data.to && <>
        <Trend data={data} field="revenue" color="bg-emerald-400" />
        <div className="mt-2 flex justify-between text-[11px] text-emerald-200"><span>{data.from.split('-').reverse().join('/')}</span><span>{data.to.split('-').reverse().join('/')}</span></div>
      </>}
    </section>
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Ly nước" value={t.cups} icon={Coffee} count color="text-amber-700" />
      <Stat label="Bánh" value={t.bakery} icon={CakeSlice} count color="text-rose-700" />
    </div>
    <Payments totals={t} />
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Tổng chi" value={t.expense} icon={ArrowUpRight} color="text-rose-700" />
      <Stat label="Thu khác" value={t.income} icon={Receipt} />
    </div>
    <h2 className="pt-2 text-base font-bold text-slate-900">Theo ngày & ca</h2>
    {data.days.map(day => <details key={day.date} open={data.days.length === 1 || undefined} className="group rounded-2xl border border-slate-200 bg-white">
      <summary className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 hover:bg-slate-50 ${focus}`}>
        <span className="text-sm font-semibold text-slate-800">{dateLabel(day.date)}<span className="mt-1 block text-xs font-normal text-slate-500">{number(day.totals.cups)} ly · {number(day.totals.bakery)} bánh</span></span>
        <span className="text-right text-sm font-bold text-emerald-800 tabular-nums">{money(day.totals.revenue)}<span className="ml-2 inline-block text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span></span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-3">
        {Object.entries(day.shifts || {}).filter(([key, values]) => key.startsWith('shift_') || Object.values(values).some(Boolean)).map(([key, values]) => <section key={key} className="rounded-xl bg-slate-50 p-3">
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">{labels[key] || key}</h3><strong className="text-sm tabular-nums">{money(values.revenue)}</strong></div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {([['Ly nước', values.cups, true], ['Bánh', values.bakery, true], ['Tiền mặt', values.cash], ['Chuyển khoản', values.transfer], ['Tổng chi', values.expense], ['Thu khác', values.income]] as const).map(([label, value, count]) => <div key={label} className="flex flex-wrap justify-between gap-1"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-800 tabular-nums">{count ? number(value) : money(value)}</dd></div>)}
          </dl>
        </section>)}
      </div>
    </details>)}
  </div>;
}

export function MoReport({ data }: { data: RevenueReport }) {
  const t = data.totals;
  const labels: Record<string, string> = { room: 'Tiền phòng', retail: 'Bán hàng', surcharge: 'Trả phòng trễ', expense: 'Chi phí' };
  return <div className="space-y-4">
    <section className="rounded-3xl border border-amber-200 bg-[#f5ecdf] p-5 sm:p-7">
      <div className="flex items-center justify-between text-sm font-medium text-amber-900"><span>Đã thu</span><BedDouble className="h-5 w-5" aria-hidden="true" /></div>
      <div className="mb-5 mt-3 break-words text-4xl font-bold tracking-tight text-[#67452f] tabular-nums sm:text-5xl">{money(t.collected)}</div>
      <div className="space-y-3 border-t border-amber-900/10 pt-4">
        {(['room', 'retail', 'surcharge'] as const).map(key => <div key={key} className="flex items-center justify-between gap-3 text-sm"><span className="text-amber-950/70">{labels[key]}</span><strong className="text-amber-950 tabular-nums">{money(t[key])}</strong></div>)}
      </div>
    </section>
    <Payments totals={t} />
    {t.other > 0 && <Stat label="Thanh toán khác" value={t.other} icon={Receipt} />}
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Đơn phòng đã thu" value={t.bookings} icon={BedDouble} count color="text-amber-800" />
      <Stat label="Tổng chi" value={t.expense} icon={ShoppingBag} color="text-rose-700" />
    </div>
    <div className="flex items-center justify-between pt-2"><h2 className="text-base font-bold text-slate-900">Thu chi theo ngày</h2><span className="text-xs text-slate-500">Ngày thanh toán</span></div>
    {data.days.map(day => <details key={day.date} open={data.days.length === 1 || undefined} className="group rounded-2xl border border-stone-200 bg-white">
      <summary className={`flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 hover:bg-stone-50 ${focus}`}>
        <span className="text-sm font-semibold">{dateLabel(day.date)}<span className="mt-1 block text-xs font-normal text-slate-500">Chi {money(day.totals.expense)}</span></span>
        <strong className="text-sm text-amber-900 tabular-nums">{money(day.totals.collected)}<span className="ml-2 inline-block text-stone-400 group-open:rotate-180" aria-hidden="true">⌄</span></strong>
      </summary>
      <div className="divide-y divide-stone-100 border-t border-stone-100 px-4">
        {!day.transactions?.length && <p className="py-4 text-sm text-stone-500">Chưa có giao dịch.</p>}
        {day.transactions?.map((transaction, i) => <div key={`${transaction.code}-${transaction.type}-${i}`} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="break-words text-sm font-semibold text-stone-800">{transaction.room || labels[transaction.type]}</p><p className="mt-1 text-xs text-stone-500">{labels[transaction.type]} · {transaction.code}</p><p className="mt-1 text-xs text-stone-400">{new Date(transaction.time).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</p></div>
          <strong className={`shrink-0 text-sm tabular-nums ${transaction.type === 'expense' ? 'text-rose-700' : 'text-amber-900'}`}>{transaction.type === 'expense' ? '−' : '+'}{money(transaction.amount)}</strong>
        </div>)}
      </div>
    </details>)}
  </div>;
}
