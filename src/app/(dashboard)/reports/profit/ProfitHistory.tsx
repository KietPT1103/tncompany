import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Trash2 } from 'lucide-react';
import { deleteProfitHistory, getProfitHistory, getProfitHistoryDetail, type ProfitHistoryDetail, type ProfitReport } from '@/services/dailyProfitService';
import { profitDate, profitMoney } from './ProfitCalculation';


export function ProfitHistory({ storeId, active, revision, onEdit }: { storeId: string; active: boolean; revision: number; onEdit: (report: ProfitHistoryDetail) => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: ProfitReport[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [detailLoading, setDetailLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const detailRequest = useRef(0);
  const [pendingDelete, setPendingDelete] = useState<ProfitReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteGeneration = useRef(0);
  useEffect(() => {
    if (!active) return;
    let live = true;
    setLoading(true); setData(null); setError(''); setDetailLoading(false); detailRequest.current++;
    setPendingDelete(null); setDeleteError(''); setDeleting(false);
    getProfitHistory(storeId, page)
      .then(response => { if (live) setData(response); })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Không tải được lịch sử.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; detailRequest.current++; deleteGeneration.current++; };
  }, [storeId, page, active, revision, reload]);
  async function view(id: string) {
    const request = ++detailRequest.current;
    setDetailLoading(true); setError('');
    try { const response = await getProfitHistoryDetail(storeId, id); if (detailRequest.current === request) onEdit(response); }
    catch (reason) { if (detailRequest.current === request) setError(reason instanceof Error ? reason.message : 'Không tải được chi tiết.'); }
    finally { if (detailRequest.current === request) setDetailLoading(false); }
  }
  async function removeReport() {
    if (!pendingDelete || deleting) return;
    const generation = deleteGeneration.current;
    setDeleting(true); setDeleteError('');
    try {
      await deleteProfitHistory(storeId,pendingDelete.id);
      if (generation !== deleteGeneration.current) return;
      detailRequest.current++; setDetailLoading(false); setPendingDelete(null);
      if (page > 1 && data?.rows.length === 1) setPage(value => value-1);
      else setReload(value => value+1);
    } catch (reason) {
      if (generation === deleteGeneration.current) setDeleteError(reason instanceof Error ? reason.message : 'Không xóa được báo cáo.');
    } finally {
      if (generation === deleteGeneration.current) setDeleting(false);
    }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold">Lịch sử báo cáo lợi nhuận</h2><p className="mt-1 text-sm text-slate-500">Kết quả tại thời điểm lưu. Các thay đổi sau đó không làm đổi báo cáo đã lưu.</p></div><Button variant="outline" disabled={loading || deleting} onClick={() => setReload(value => value + 1)} className="rounded-sm border-slate-200 bg-white text-emerald-900">Làm mới lịch sử</Button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {loading ? <p role="status" className="p-10 text-center text-slate-500">Đang tải lịch sử...</p> : data && <>
        <>{!data.rows.length ? <p className="p-6 text-center text-sm text-slate-500">Chưa có báo cáo đã lưu. Nhập đủ chi phí ở tab Tính lợi nhuận rồi bấm Lưu báo cáo.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Thời gian lưu','Kỳ báo cáo','Doanh thu','Tổng chi phí','Lợi nhuận ròng','Thao tác'].map((label,index) => <th key={index} scope="col" className="px-4 py-3 text-left font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.rows.map(report => <tr key={report.id} className="hover:bg-slate-50"><td className="px-4 py-3">{new Date(report.savedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</td><td className="px-4 py-3 font-semibold">{profitDate(report.startDate)} — {profitDate(report.endDate)}</td><td className="whitespace-nowrap px-4 py-3">{profitMoney(report.totals.revenue)}</td><td className="whitespace-nowrap px-4 py-3">{profitMoney(report.totals.totalCosts)}</td><td className={`whitespace-nowrap px-4 py-3 font-bold ${report.totals.profit < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{profitMoney(report.totals.profit)}</td><td className="whitespace-nowrap px-4 py-3"><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={detailLoading || deleting} onClick={() => void view(report.id)} className="text-emerald-800">Chỉnh sửa</Button><Button variant="ghost" size="sm" disabled={deleting} onClick={() => {setDeleteError(''); setPendingDelete(report);}} className="gap-1 border border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"><Trash2 className="h-4 w-4" aria-hidden="true"/>Xóa</Button></div></td></tr>)}{!data.rows.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Chưa có báo cáo đã lưu. Nhập đủ chi phí ở tab Tính lợi nhuận rồi bấm Lưu báo cáo.</td></tr>}</tbody></table></div>}</>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><span>{data.total} báo cáo · Trang {page}/{Math.max(1,Math.ceil(data.total/20))}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={deleting || page <= 1} onClick={() => setPage(value => value - 1)}>Trước</Button><Button variant="outline" size="sm" disabled={deleting || page*20 >= data.total} onClick={() => setPage(value => value + 1)}>Sau</Button></div></div>
      </>}
    </section>
    {detailLoading && <p role="status" className="text-sm text-slate-500">Đang tải chi tiết báo cáo...</p>}
    <ConfirmDialog open={pendingDelete !== null} title="Xóa báo cáo lợi nhuận?" description={<>
      <span>Xóa báo cáo kỳ {pendingDelete ? `${profitDate(pendingDelete.startDate)} — ${profitDate(pendingDelete.endDate)}` : ''} khỏi lịch sử? Chi phí đã nhập theo ngày vẫn được giữ lại. Thao tác này không thể hoàn tác.</span>
      {deleteError && <span role="alert" className="mt-3 block text-red-700">{deleteError}</span>}
    </>} confirmLabel="Xóa báo cáo" cancelLabel="Hủy" variant="destructive" isLoading={deleting} onConfirm={() => void removeReport()} onCancel={() => {if (!deleting) setPendingDelete(null);}}/>
  </div>;
}
