"use client";
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { useStore } from '@/context/StoreContext';
import { apiRequest } from '@/lib/api';
import { formatRevenueDate, vietnamDateKey } from '../revenue/dailyRevenueReport';

type Row = { code: string; name: string; unit: string; quantity: number; pendingQuantity?: number };
type Report = { sales: Row[]; ingredients: Row[]; totalSoldQuantity: number; pendingQuantity: number };
type SyncResult = { saved: number; errors: string[]; nextCursor: string | null };
const qty = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 3 });

export default function IngredientUsagePage() {
  const { storeId, storeName } = useStore();
  const [from, setFrom] = useState(() => vietnamDateKey(new Date()));
  const [to, setTo] = useState(() => vietnamDateKey(new Date()));
  const [tab, setTab] = useState<'sales' | 'ingredients'>('sales');
  const [data, setData] = useState<{ scope: string; report: Report } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [reload, setReload] = useState(0);
  const scope = `${storeId}:${from}:${to}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const valid = Boolean(from && to && from <= to && storeId !== 'warehouse');
  const report = data?.scope === scope ? data.report : null;
  const rows = tab === 'sales' ? report?.sales ?? [] : report?.ingredients ?? [];

  useEffect(() => {
    let active = true;
    setData(null); setError(''); setNotice(''); setSyncErrors([]); setLoading(true);
    if (!valid) {
      setError(storeId === 'warehouse' ? 'Kho thợ không có báo cáo tiêu hao theo món bán.' : 'Vui lòng chọn khoảng ngày hợp lệ.');
      setLoading(false); return;
    }
    const query = new URLSearchParams({ storeId, from, to });
    apiRequest<Report>(`/ingredient-usage.php?${query}`)
      .then(value => { if (active) setData({ scope, report: value }); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Không tải được báo cáo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, from, to, scope, valid, reload]);

  async function syncMissing() {
    if (syncing || !valid || !report || loading) return;
    setSyncing(true); setError(''); setNotice(''); setSyncErrors([]);
    const syncScope = scope;
    let cursor: string | null = null;
    let saved = 0;
    const errors = new Set<string>();
    try {
      do {
        const result: SyncResult = await apiRequest<SyncResult>('/ingredient-usage.php', {
          method: 'POST', body: JSON.stringify({ storeId, from, to, cursor }), timeoutMs: 120000,
        });
        saved += result.saved;
        result.errors.forEach(message => errors.add(message));
        cursor = result.nextCursor;
        if (!mounted.current || currentScope.current !== syncScope) return;
        setNotice(`Đang đồng bộ: đã bổ sung ${qty(saved)} công thức món theo hóa đơn…`);
      } while (cursor);
      const query = new URLSearchParams({ storeId, from, to });
      const value = await apiRequest<Report>(`/ingredient-usage.php?${query}`);
      if (mounted.current && currentScope.current === syncScope) {
        setData({ scope: syncScope, report: value });
        setSyncErrors([...errors]);
        setNotice(`Đã bổ sung ${qty(saved)} công thức món theo hóa đơn. Số liệu đã ghi nhận được giữ nguyên.`);
      }
    } catch (e) {
      if (mounted.current && currentScope.current === syncScope) setError(e instanceof Error ? e.message : 'Đồng bộ chưa hoàn tất. Bạn có thể thử lại để bổ sung phần còn thiếu.');
    } finally { if (mounted.current) setSyncing(false); }
  }

  return <main className="min-h-full bg-[#F4F7F6] p-4 font-nunito text-slate-900 sm:p-6">
    <div className="mx-auto max-w-5xl space-y-5">
      <header><h1 className="text-2xl font-bold text-emerald-950">Món bán và nguyên liệu đã dùng</h1><p className="mt-1 text-sm text-slate-500">Tính theo món trên hóa đơn hoàn tất và công thức đã lưu, không gồm hóa đơn đã hủy.</p></header>
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <DateRangePicker label="Thời gian" startDate={from} endDate={to} onChange={(start, end) => { setFrom(start); setTo(end); }} />
        <div className="mr-auto text-sm"><span className="block text-slate-500">Chi nhánh</span><span className="font-semibold">{storeName}</span></div>
        <button type="button" disabled={loading || syncing} onClick={() => setReload(value => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Tải lại</button>
        <button type="button" disabled={!valid || loading || syncing || !report || !report.pendingQuantity} onClick={() => void syncMissing()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Đang đồng bộ…' : 'Đồng bộ theo công thức hiện tại'}</button>
        <p className="w-full text-xs text-slate-500">Đồng bộ bổ sung món bán cũ chưa ghi nhận hoặc từng thiếu công thức trong khoảng ngày đã chọn. Giữ nguyên công thức đã lưu và không trừ thêm tồn kho.</p>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</div>}
      {report && report.pendingQuantity > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Còn <strong>{qty(report.pendingQuantity)}</strong> món bán chưa lưu công thức. Tổng nguyên liệu hiện chưa bao gồm các món này. Hãy bổ sung công thức nếu thiếu và bấm đồng bộ.</div>}
      {syncErrors.length > 0 && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Cần bổ sung công thức</p><ul className="mt-2 list-inside list-disc">{syncErrors.map(message => <li key={message}>{message}</li>)}</ul></div>}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="space-y-1 p-6 text-center"><h2 className="text-xl font-bold">Báo cáo món bán và nguyên liệu sử dụng</h2><p className="text-sm">Từ ngày {formatRevenueDate(from)} đến ngày {formatRevenueDate(to)}</p><p className="text-sm">Chi nhánh: {storeName}</p>{report && <p className="pt-2 text-lg font-bold text-emerald-900">Tổng số món đã bán: {qty(report.totalSoldQuantity)}</p>}</div>
        <div className="flex border-y border-slate-200" aria-label="Nội dung báo cáo">
          {([{ id: 'sales', label: 'Món bán' }, { id: 'ingredients', label: 'Nguyên liệu đã dùng' }] as const).map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`min-h-12 flex-1 border-b-2 px-4 py-3 text-sm font-bold ${tab === item.id ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>{item.label}</button>)}
        </div>
        {loading ? <div role="status" className="p-8 text-center text-slate-500">Đang tải báo cáo…</div> : report ? <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-[#B1E8F7]"><tr><th className="px-5 py-3 text-left">Mã</th><th className="px-5 py-3 text-left">{tab === 'sales' ? 'Món bán' : 'Nguyên liệu'}</th><th className="px-5 py-3 text-left">Đơn vị</th><th className="px-5 py-3 text-right">{tab === 'sales' ? 'Số lượng bán' : 'Số lượng đã dùng'}</th>{tab === 'sales' && <th className="px-5 py-3 text-right">Chưa lưu công thức</th>}</tr></thead>
          <tbody className="divide-y divide-slate-200">
            {tab === 'sales' && <tr className="bg-[#F2EFD8] font-bold"><td colSpan={3} className="px-5 py-3">Tổng số món bán</td><td className="px-5 py-3 text-right tabular-nums">{qty(report.totalSoldQuantity)}</td><td className="px-5 py-3 text-right tabular-nums">{qty(report.pendingQuantity)}</td></tr>}
            {rows.map(row => <tr key={JSON.stringify([row.code, row.unit])} className="hover:bg-slate-50"><td className="px-5 py-3">{row.code}</td><td className="px-5 py-3 font-semibold">{row.name}</td><td className="px-5 py-3">{row.unit || 'Chưa có đơn vị'}</td><td className="px-5 py-3 text-right tabular-nums">{qty(row.quantity)}</td>{tab === 'sales' && <td className="px-5 py-3 text-right tabular-nums">{qty(row.pendingQuantity ?? 0)}</td>}</tr>)}
            {!rows.length && <tr><td colSpan={tab === 'sales' ? 5 : 4} className="px-5 py-8 text-center text-slate-500">{tab === 'sales' ? 'Không có món bán trong khoảng ngày này.' : 'Chưa có nguyên liệu được ghi nhận trong khoảng ngày này.'}</td></tr>}
          </tbody>
        </table>{tab === 'ingredients' && <p className="border-t border-slate-200 p-4 text-xs text-slate-500">Số lượng tiêu hao theo công thức. Mỗi nguyên liệu được tổng hợp theo đơn vị riêng.</p>}</div> : null}
      </section>
    </div>
  </main>;
}