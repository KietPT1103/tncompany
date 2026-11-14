import { useEffect, useState } from 'react';
import { ChevronDown, History, Printer, RefreshCw } from 'lucide-react';
import { posRequest } from '@/services/posApi';
import { takeawayShiftReportHtml, type TakeawayShiftReport } from './takeawayShiftReport';

type HistoryPage = { items: TakeawayShiftReport[]; hasMore: boolean };
const money = (amount: number) => `${Number(amount || 0).toLocaleString('vi-VN')} đ`;

export default function ClosedShiftHistory({ storeId, onPrint }: { storeId: string; onPrint: (html: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TakeawayShiftReport[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    posRequest<HistoryPage>('shifts', { signal: controller.signal }, { storeId, closedHistory: 1, offset })
      .then(page => {
        if (controller.signal.aborted) return;
        setItems(previous => offset === 0 ? page.items : [...previous, ...page.items]);
        setHasMore(page.hasMore);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được các ca đã kết.'); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [open, storeId, offset, retry]);

  return <div className="min-w-0">
    <div className="flex justify-end">
      <button type="button" aria-expanded={open} aria-controls="closed-shift-history" onClick={() => {
        if (!open) { setOffset(0); setItems([]); }
        setOpen(value => !value);
      }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
        <History className="h-4 w-4" aria-hidden="true" />Ca đã kết<ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </div>
    {open && <section id="closed-shift-history" aria-label="Các ca đã kết" className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
      {!busy && !error && items.length === 0 && <p className="text-sm text-slate-500">Chưa có ca đã kết tại quầy này.</p>}
      {items.map(item => <details key={item.shiftId} className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Ca {item.shiftNumber}{item.isFinalShift ? ' · Ca cuối' : ''}<span className="mt-1 block text-xs font-normal text-slate-500">{item.closedAt} · {item.cashierName}</span></summary>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {[
            ['Ngày kinh doanh', item.businessDate], ['Mở ca', item.openedAt], ['Kết ca', item.closedAt],
            ['Tiền đầu ca', money(item.openingCash)], ['Doanh thu ca', money(item.summary.totalSales)],
            ['Tiền mặt', money(item.summary.cashSales)], ['Chuyển khoản', money(item.summary.transferSales)],
            ['Phiếu thu', money(item.summary.incomeVouchers)], ['Phiếu chi', money(item.summary.expenseVouchers)],
            ['Tiền cuối ca', money(item.closingCash)], ['Chênh lệch', money(item.closingCash - item.summary.expectedClosingCash)],
            ...(item.cycle ? [['Doanh thu cả ngày', money(item.cycle.totalSales)], ['Bàn giao cả ngày', money(item.cycle.actualHandover)]] : []),
          ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className="break-words font-semibold text-slate-800">{value}</dd></div>)}
        </dl>
        {item.note && <p className="mt-2 break-words text-xs text-slate-500">{item.note}</p>}
        <button type="button" onClick={() => onPrint(takeawayShiftReportHtml(item))} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white"><Printer className="h-4 w-4" aria-hidden="true" />In lại phiếu kết ca</button>
      </details>)}
      {busy && <p role="status" className="flex items-center gap-2 text-xs text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" />Đang tải ca đã kết…</p>}
      {error && <div role="alert" className="text-xs text-rose-700">{error}<button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 min-h-10 underline">Thử lại</button></div>}
      {hasMore && !busy && !error && <button type="button" onClick={() => setOffset(items.length)} className="min-h-10 w-full text-xs font-semibold text-emerald-700">Xem thêm ca cũ</button>}
    </section>}
  </div>;
}
