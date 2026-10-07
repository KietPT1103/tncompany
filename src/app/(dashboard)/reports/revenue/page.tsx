"use client";
import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { useStore } from '@/context/StoreContext';
import { getAllBills } from '@/services/billService';
import { aggregateDailyRevenue, createDailyRevenueWorkbook, formatRevenueDate, revenueRangeDate, vietnamDateKey, type DailyRevenueRow } from './dailyRevenueReport';

const money = (value: number) => value.toLocaleString('vi-VN');
export default function DailyRevenueReportPage() {
  const { storeId, storeName } = useStore();
  const [startDate, setStartDate] = useState(() => vietnamDateKey(new Date()).slice(0, 8) + '01');
  const [endDate, setEndDate] = useState(() => vietnamDateKey(new Date()));
  const [data, setData] = useState<{ scope: string; rows: DailyRevenueRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const requestId = useRef(0);
  const scope = `${storeId}:${startDate}:${endDate}`;
  const valid = Boolean(startDate && endDate && startDate <= endDate && Number.isFinite(revenueRangeDate(startDate).getTime()) && Number.isFinite(revenueRangeDate(endDate).getTime()));
  const rows = data?.scope === scope ? data.rows : [];
  const ready = valid && !loading && !error && data?.scope === scope;

  useEffect(() => {
    const id = ++requestId.current;
    let active = true;
    setError('');
    setLoading(true);
    setData(null);
    if (!valid) { setError('Vui lòng chọn khoảng ngày hợp lệ.'); setLoading(false); return; }
    getAllBills({ storeId, startDate: revenueRangeDate(startDate), endDate: revenueRangeDate(endDate, true) })
      .then(bills => { if (active && id === requestId.current) setData({ scope, rows: aggregateDailyRevenue(bills, startDate, endDate) }); })
      .catch(() => { if (active && id === requestId.current) setError('Không tải được báo cáo. Vui lòng thử lại.'); })
      .finally(() => { if (active && id === requestId.current) setLoading(false); });
    return () => { active = false; };
  }, [storeId, startDate, endDate, scope, valid, reload]);

  async function exportExcel() {
    if (!ready || exporting) return;
    setExporting(true);
    try {
      const workbook = await createDailyRevenueWorkbook(rows, startDate, endDate, storeName);
      const bytes = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Doanh-thu-theo-ngay-${storeId}-${startDate}-${endDate}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { alert('Không xuất được Excel. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  }

  return <main className="min-h-full bg-[#F4F7F6] p-4 font-nunito text-slate-900 sm:p-6">
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-emerald-950">Doanh thu theo ngày</h1><p className="mt-1 text-sm text-slate-500">Tổng tiền hóa đơn sau giảm giá và phụ thu, không gồm hóa đơn đã hủy.</p></div>
        <button type="button" disabled={!ready || exporting} onClick={() => void exportExcel()} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" />{exporting ? 'Đang xuất...' : 'Xuất Excel'}</button>
      </div>
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <DateRangePicker label="Thời gian" startDate={startDate} endDate={endDate} onChange={(from, to) => { setStartDate(from); setEndDate(to); }} />
        <div className="mr-auto text-sm"><span className="block text-slate-500">Chi nhánh</span><span className="font-semibold">{storeName}</span></div>
        <button type="button" disabled={loading} onClick={() => setReload(value => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Tải lại</button>
      </div>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="space-y-1 p-6 text-center"><h2 className="text-xl font-bold">Báo cáo bán hàng theo thời gian</h2><p className="text-sm">Từ ngày {formatRevenueDate(startDate)} đến ngày {formatRevenueDate(endDate)}</p><p className="text-sm">Chi nhánh: {storeName}</p><p className="text-xs text-slate-500">Đơn vị: VND</p></div>
        {error ? <div role="alert" className="p-6 text-center text-red-700">{error}</div> : loading || !ready ? <div role="status" className="p-8 text-center text-slate-500">Đang tải báo cáo...</div> : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-[#B1E8F7]"><tr><th className="px-6 py-3 text-left">Ngày</th><th className="px-6 py-3 text-right">Doanh thu</th></tr></thead>
          <tbody className="divide-y divide-slate-200"><tr className="bg-[#F2EFD8] font-bold"><td className="px-6 py-3">Tổng cộng</td><td className="px-6 py-3 text-right tabular-nums">{money(rows.reduce((sum, row) => sum + row.revenue, 0))}</td></tr>
          {rows.map(row => <tr key={row.date} className="hover:bg-slate-50"><td className="px-6 py-3 text-blue-700">{formatRevenueDate(row.date)}</td><td className="px-6 py-3 text-right tabular-nums">{money(row.revenue)}</td></tr>)}
          {!rows.length && <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500">Không có doanh thu trong khoảng ngày này.</td></tr>}
          </tbody></table></div>}
      </section>
    </div>
  </main>;
}
