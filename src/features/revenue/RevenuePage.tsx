import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { formatDisplayDate } from '@/components/ui/dateRangePickerUtils';
import { quickRange, validRange } from './filters';
import { getRevenueSource } from './sources';
import type { RevenueReport } from './types';
import RevenueAccessGate, { revenueHeaders } from './RevenueAccessGate';

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

export default function RevenuePage() {
  return <RevenueAccessGate>{(token, lock) => <RevenueDashboard token={token} onLocked={lock} />}</RevenueAccessGate>;
}

function RevenueDashboard({ token, onLocked }: { token: string; onLocked: () => void }) {
  const [params, setParams] = useSearchParams();
  const today = quickRange('today');
  const source = getRevenueSource(params.get('source'));
  const from = params.get('from') || today[0], to = params.get('to') || today[1];
  const store = params.get('store') || 'cafe';
  const [data, setData] = useState<RevenueReport | null>(null);
  const [stores, setStores] = useState([{ id: 'cafe', name: 'Cà phê' }, { id: 'restaurant', name: 'Bếp' }, { id: 'bakery', name: 'Bánh' }, { id: 'farm', name: 'Farm' }, { id: 'warehouse', name: 'Kho' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const requestKey = `${source.id}|${from}|${to}|${store}|${reload}`;
  const [loadedKey, setLoadedKey] = useState('');
  const sequence = useRef(0);
  const valid = validRange(from, to);
  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    next.set('source', source.id);
    next.set('from', from);
    next.set('to', to);
    Object.entries(changes).forEach(([key, value]) => next.set(key, value));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!valid) return;
    const id = ++sequence.current;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setData(null);
    const timer = window.setTimeout(() => {
      if (id !== sequence.current || controller.signal.aborted) return;
      controller.abort();
      setError('Tải dữ liệu quá lâu. Thử lại sau.');
      setLoadedKey(requestKey);
      setBusy(false);
    }, 14000);
    const query = new URLSearchParams({ source: source.id, from, to, store });
    apiRequest<RevenueReport>(`/revenue-hub.php?${query}`, { signal: controller.signal, timeoutMs: 14000, headers: revenueHeaders(token) }, false)
      .then(result => {
        if (id !== sequence.current || controller.signal.aborted) return;
        setData(result);
        if (source.id === 'tnservice' && result.stores) setStores(result.stores);
        setLoadedKey(requestKey);
      })
      .catch(reason => {
        if (!controller.signal.aborted && id === sequence.current) {
          if ((reason as { code?: string })?.code === 'REVENUE_LOCKED') { onLocked(); return; }
          setError(reason instanceof Error ? reason.message : 'Chưa tải được dữ liệu.');
          setLoadedKey(requestKey);
        }
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!controller.signal.aborted && id === sequence.current) setBusy(false);
      });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [token, onLocked, from, to, store, source.id, reload, valid]);

  const visible = loadedKey === requestKey ? data : null;
  const Report = source.Report;
  return <main className="min-h-screen bg-[#f4f6f5] text-slate-900" style={{ fontFamily: "'Nunito Sans Variable', sans-serif" }}>
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-slate-400">TN COMPANY</p><h1 className="mt-1 text-xl font-extrabold tracking-tight">Doanh thu</h1></div>
        <button type="button" aria-label="Tải lại" title="Tải lại" onClick={() => setReload(value => value + 1)} disabled={busy || !valid} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 ${focus}`}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>
      </header>
      <div className="mb-3 space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-200/60 p-1 sm:grid-cols-3" role="group" aria-label="Quầy và hệ thống">
          {[{ id: 'all', name: 'Tất cả quầy' }, ...stores].map(item => <button key={item.id} type="button" aria-pressed={source.id === 'tnservice' && store === item.id} onClick={() => update({ source: 'tnservice', store: item.id })} className={`min-h-11 min-w-0 whitespace-normal break-words rounded-xl px-3 py-2 text-sm font-bold transition ${focus} ${source.id === 'tnservice' && store === item.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>{item.name}</button>)}
          <button type="button" aria-pressed={source.id === 'mohomestay'} onClick={() => update({ source: 'mohomestay' })} className={`min-h-11 min-w-0 whitespace-normal break-words rounded-xl px-3 py-2 text-sm font-bold transition ${focus} ${source.id === 'mohomestay' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>MoHomestay</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([['today', 'Hôm nay'], ['yesterday', 'Hôm qua'], ['week', '7 ngày'], ['month', 'Tháng này']] as const).map(([id, label]) => {
            const range = quickRange(id);
            const active = from === range[0] && to === range[1];
            return <button key={id} type="button" aria-pressed={active} onClick={() => update({ from: range[0], to: range[1] })} className={`min-h-10 whitespace-nowrap rounded-full border px-2 text-[11px] font-semibold ${focus} ${active ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{label}</button>;
          })}
        </div>
      </div>
      <div className="sticky top-0 z-10 -mx-1 mb-4 bg-[#f4f6f5]/95 px-1 py-2 backdrop-blur" data-revenue-date-bar>
        <DateRangePicker
          label="Khoảng ngày"
          hideLabel
          startDate={from}
          endDate={to}
          autoApply
          summary={from === to ? formatDisplayDate(from) : `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`}
          onChange={(start, end) => update({ from: start, to: end })}
          triggerClassName="min-h-11 rounded-2xl border-slate-200 bg-white text-sm"
        />
      </div>
      {!valid ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Chọn khoảng ngày hợp lệ, tối đa 93 ngày.</p>
        : error && loadedKey === requestKey ? <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-5"><p className="text-sm text-rose-800">{error}</p><button type="button" onClick={() => setReload(value => value + 1)} className={`mt-3 min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 ${focus}`}>Thử lại</button></div>
          : !visible ? <div role="status" aria-live="polite" className="animate-pulse space-y-3 motion-reduce:animate-none"><span className="sr-only">Đang tải doanh thu</span><div className="h-44 rounded-3xl bg-slate-200" /><div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-200" />)}</div></div>
            : <><Report data={visible} allStores={store === 'all'} /><p className="mt-5 text-center text-[11px] text-slate-400">Cập nhật {new Date(visible.updatedAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' })}</p></>}
    </div>
  </main>;
}
