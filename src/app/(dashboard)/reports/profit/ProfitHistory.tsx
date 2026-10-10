import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getProfitHistory, getProfitHistoryDetail, type ProfitHistoryDetail, type ProfitReport } from '@/services/dailyProfitService';
import { profitDate, profitMoney } from './ProfitCalculation';

export function ProfitHistory({ storeId, active, revision }: { storeId: string; active: boolean; revision: number }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: ProfitReport[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ProfitHistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const detailRequest = useRef(0);
  useEffect(() => {
    if (!active) return;
    let live = true;
    setLoading(true); setData(null); setError(''); setDetail(null); setDetailLoading(false); detailRequest.current++;
    getProfitHistory(storeId, page)
      .then(response => { if (live) setData(response); })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Không tải được lịch sử.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; detailRequest.current++; };
  }, [storeId, page, active, revision, reload]);
  async function view(id: string) {
    const request = ++detailRequest.current;
    setDetailLoading(true); setDetail(null); setError('');
    try { const response = await getProfitHistoryDetail(storeId, id); if (detailRequest.current === request) setDetail(response); }
    catch (reason) { if (detailRequest.current === request) setError(reason instanceof Error ? reason.message : 'Không tải được chi tiết.'); }
    finally { if (detailRequest.current === request) setDetailLoading(false); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold">Lịch sử báo cáo lợi nhuận</h2><p className="mt-1 text-sm text-slate-500">Kết quả tại thời điểm lưu. Các thay đổi sau đó không làm đổi báo cáo đã lưu.</p></div><Button variant="outline" disabled={loading} onClick={() => setReload(value => value + 1)} className="rounded-sm border-slate-200 bg-white text-emerald-900">Làm mới lịch sử</Button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {loading ? <p role="status" className="p-10 text-center text-slate-500">Đang tải lịch sử...</p> : data && <>
        <>{!data.rows.length ? <p className="p-6 text-center text-sm text-slate-500">Chưa có báo cáo đã lưu. Nhập đủ chi phí ở tab Tính lợi nhuận rồi bấm Lưu báo cáo.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Thời gian lưu','Kỳ báo cáo','Doanh thu','Tổng chi phí','Lợi nhuận ròng',''].map((label,index) => <th key={index} scope="col" className="px-4 py-3 text-left font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.rows.map(report => <tr key={report.id} className="hover:bg-slate-50"><td className="px-4 py-3">{new Date(report.savedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td className="px-4 py-3 font-semibold">{profitDate(report.startDate)} — {profitDate(report.endDate)}</td><td className="whitespace-nowrap px-4 py-3">{profitMoney(report.totals.revenue)}</td><td className="whitespace-nowrap px-4 py-3">{profitMoney(report.totals.totalCosts)}</td><td className={`whitespace-nowrap px-4 py-3 font-bold ${report.totals.profit < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{profitMoney(report.totals.profit)}</td><td className="px-4 py-3"><Button variant="ghost" size="sm" disabled={detailLoading} onClick={() => void view(report.id)} className="text-emerald-800">Xem chi tiết</Button></td></tr>)}{!data.rows.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Chưa có báo cáo đã lưu. Nhập đủ chi phí ở tab Tính lợi nhuận rồi bấm Lưu báo cáo.</td></tr>}</tbody></table></div>}</>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><span>{data.total} báo cáo · Trang {page}/{Math.max(1,Math.ceil(data.total/20))}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</Button><Button variant="outline" size="sm" disabled={page*20 >= data.total} onClick={() => setPage(value => value + 1)}>Sau</Button></div></div>
      </>}
    </section>
    {detailLoading && <p role="status" className="text-sm text-slate-500">Đang tải chi tiết báo cáo...</p>}
    {detail && <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"><div><h2 className="font-bold">Chi tiết kỳ {profitDate(detail.startDate)} — {profitDate(detail.endDate)}</h2><p className="mt-1 text-sm text-slate-500">Lợi nhuận ròng: <span className={detail.snapshot.totals.profit < 0 ? 'font-bold text-red-700' : 'font-bold text-emerald-800'}>{profitMoney(detail.snapshot.totals.profit)}</span></p></div><Button variant="ghost" size="sm" onClick={() => setDetail(null)}>Đóng chi tiết</Button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Ngày','Doanh thu','Cost','Lương','Chi tại quầy','Tiền điện','Tiền nước',...(detail.snapshot.days.some(day => typeof day.result.utilities === 'number') ? ['Điện/nước (cũ)'] : []),'Chi phí khác','Marketing','Anh Thiện chi','Tồn kho nguyên liệu','Công nợ','Lợi nhuận'].map(label => <th key={label} className="px-3 py-3 text-left">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{detail.snapshot.days.map(day => <tr key={day.date}><th scope="row" className="whitespace-nowrap px-3 py-3 text-left">{profitDate(day.date)}</th>{(['revenue','materialCost','salary','voucherCost','electricity','water',...(detail.snapshot.days.some(row => typeof row.result.utilities === 'number') ? ['utilities' as const] : []),'other','marketing','thienExpense','ingredientInventory','debt','profit'] as const).map(key => <td key={key} className={`whitespace-nowrap px-3 py-3 ${key === 'profit' ? day.result.profit < 0 ? 'font-bold text-red-700' : 'font-bold text-emerald-800' : ''}`}>{typeof day.result[key] === 'number' ? profitMoney(day.result[key]!) : '—'}</td>)}</tr>)}</tbody></table></div>
    </section>}
  </div>;
}
