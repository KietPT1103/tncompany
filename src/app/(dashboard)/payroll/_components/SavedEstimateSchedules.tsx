import { useEffect, useState } from 'react';
import { CalendarRange, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { deleteSavedEstimateSchedules, getSavedEstimateSchedules, type SavedEstimateSchedule } from '@/services/payrolls';

const dateLabel = (date?: string) => date ? date.split('-').reverse().join('/') : '—';
const moneyLabel = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
const savedAtLabel = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}+07:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}) : '—';
};
const outline = 'rounded-md border-slate-200 hover:border-[#064E3B] focus-visible:border-[#064E3B] focus-visible:ring-0 focus-visible:ring-offset-0';

export function SavedEstimateSchedules({ storeId, revision, onOpen, onDeleted, opening }: {
  storeId: string; revision: number; onOpen: (id: string) => void; onDeleted: (id: string) => void; opening: boolean;
}) {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof getSavedEstimateSchedules>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<SavedEstimateSchedule[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    setSelectedIds([]);
    getSavedEstimateSchedules(storeId,page)
      .then(response => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(response.total / 10));
        if (page > lastPage) setPage(lastPage);
        else setData(response);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không tải được lịch đã lưu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId,page,revision,reload]);

  async function handleDelete() {
    if (!pendingDelete || deleting || opening) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteSavedEstimateSchedules(storeId, pendingDelete.map(schedule => schedule.id));
      pendingDelete.forEach(schedule => onDeleted(schedule.id));
      setPendingDelete(null);
      setSelectedIds([]);
      setMessage(`Đã xoá ${pendingDelete.length} lịch phân ca.`);
      if (page > 1 && data?.items.length === pendingDelete.length) setPage(value => value - 1);
      else setReload(value => value + 1);
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'Không xoá được lịch phân ca.');
    } finally {
      setDeleting(false);
    }
  }
  const selectedSchedules = data?.items.filter(schedule => selectedIds.includes(schedule.id)) ?? [];
  const allSelected = Boolean(data?.items.length) && selectedSchedules.length === data?.items.length;
  const selectionDisabled = loading || opening || deleting;
  function confirmDelete(schedules: SavedEstimateSchedule[]) {
    if (!schedules.length || selectionDisabled) return;
    setDeleteError('');
    setPendingDelete(schedules);
  }
  return <section aria-label="Lịch phân ca đã lưu" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
      <div className="min-w-0">
        <h2 className="font-bold text-slate-900">Lịch phân ca đã lưu</h2>
        <p className="mt-1 text-sm text-slate-500">Mở lại lịch để xem hoặc tiếp tục chỉnh sửa. Lưu lại sẽ cập nhật lịch đó.</p>
      </div>
      <Button variant="outline" className={`gap-2 ${outline}`} disabled={loading || opening || deleting} onClick={() => setReload(value=>value+1)}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />Làm mới
      </Button>
    </div>
    {message && <p role="status" className="px-5 pt-4 text-sm text-emerald-800">{message}</p>}
    {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Đang tải lịch đã lưu...</p>
      : error ? <div role="alert" className="m-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      : data && <>
        {!data.items.length ? <div className="flex flex-col items-center px-5 py-12 text-center">
          <CalendarRange className="h-8 w-8 text-emerald-800" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-slate-800">{page === 1 ? 'Chưa có lịch phân ca đã lưu' : 'Không có lịch trong trang này'}</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">Xếp lịch ở tab Lịch phân ca và bấm Lưu ước tính. Lịch đã lưu sẽ xuất hiện tại đây.</p>
        </div> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer accent-[#064E3B] disabled:cursor-not-allowed"
                  checked={allSelected}
                  ref={node => { if (node) node.indeterminate = selectedSchedules.length > 0 && !allSelected; }}
                  disabled={selectionDisabled}
                  onChange={event => setSelectedIds(event.target.checked ? data.items.map(schedule => schedule.id) : [])}
                />
                Chọn tất cả trong trang
              </label>
              <span role="status" className="text-xs text-slate-500">Đã chọn {selectedSchedules.length} mục</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-md border-red-200 text-xs text-red-700 hover:border-red-700 hover:bg-red-50 hover:text-red-800"
              disabled={selectionDisabled || !selectedSchedules.length}
              onClick={() => confirmDelete(selectedSchedules)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Xoá các mục đã chọn{selectedSchedules.length > 0 ? ` (${selectedSchedules.length})` : ''}
            </Button>
          </div>
          <div className="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500 lg:grid">
            <span>Lịch / khoảng ngày</span><span>Cập nhật lần cuối</span><span>Nhân viên / giờ</span><span>Lương ước tính</span><span className="w-36">Thao tác</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.items.map(schedule => <li key={schedule.id} className={`grid min-w-0 gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-4 ${selectedIds.includes(schedule.id) ? 'bg-emerald-50/60' : ''}`}>
              <div className="flex min-w-0 items-start gap-3">
                <label className="-m-2 inline-flex shrink-0 cursor-pointer p-2">
                <input
                  type="checkbox"
                  aria-label={`Chọn lịch ${schedule.name}, cập nhật ${savedAtLabel(schedule.updatedAt)}`}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#064E3B] disabled:cursor-not-allowed"
                  checked={selectedIds.includes(schedule.id)}
                  disabled={selectionDisabled}
                  onChange={event => setSelectedIds(current => event.target.checked ? [...current, schedule.id] : current.filter(id => id !== schedule.id))}
                />
                </label>
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-slate-900">{schedule.name}</p>
                  <p className="mt-1 text-xs tabular-nums text-slate-500">{dateLabel(schedule.startDate)} – {dateLabel(schedule.endDate)}</p>
                </div>
              </div>
              <div className="text-sm text-slate-600"><span className="mb-1 block text-xs text-slate-500 lg:hidden">Cập nhật lần cuối</span>{savedAtLabel(schedule.updatedAt)}</div>
              <div className="text-sm text-slate-600">{schedule.employeeCount} người<span className="mt-1 block text-xs text-slate-500">{schedule.totalHours.toLocaleString('vi-VN',{maximumFractionDigits:2})} giờ</span></div>
              <div className="break-words text-sm font-bold tabular-nums text-emerald-800"><span className="mb-1 block text-xs font-normal text-slate-500 lg:hidden">Lương ước tính</span>{moneyLabel(schedule.totalSalary)}</div>
              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1 lg:w-36">
                <Button variant="outline" size="sm" disabled={opening || deleting} className={`h-8 px-2.5 text-xs text-emerald-900 ${outline}`} onClick={()=>onOpen(schedule.id)}>Mở lịch</Button>
                <Button variant="outline" size="sm" disabled={opening || deleting} className="h-8 gap-1 rounded-md border-red-200 px-2.5 text-xs text-red-700 hover:border-red-700 hover:bg-red-50 hover:text-red-800" onClick={()=>confirmDelete([schedule])}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Xoá
                </Button>
              </div>
            </li>)}
          </ul>
        </>}
        <Pagination currentPage={page} totalItems={data.total} pageSize={10} onPageChange={setPage} disabled={loading || opening || deleting} />
      </>}
    <ConfirmDialog
      open={pendingDelete !== null}
      title={pendingDelete && pendingDelete.length > 1 ? `Xoá ${pendingDelete.length} lịch phân ca?` : 'Xoá lịch phân ca?'}
      description={<>
        <span>Bạn có chắc muốn xoá {pendingDelete?.length ?? 0} lịch phân ca đã chọn? Lịch và chi tiết phân ca đã lưu sẽ bị xoá. Thao tác này không thể hoàn tác.</span>
        <span className="mt-3 block max-h-40 overflow-y-auto rounded-md bg-slate-50 p-3">
          {pendingDelete?.map(schedule => <span key={schedule.id} className="mb-2 block last:mb-0">
            <strong className="block break-words">{schedule.name}</strong>
            <span className="text-xs text-slate-500">{dateLabel(schedule.startDate)} – {dateLabel(schedule.endDate)}</span>
          </span>)}
        </span>
        {deleteError && <span role="alert" className="mt-3 block text-red-700">{deleteError}</span>}
      </>}
      confirmLabel={pendingDelete && pendingDelete.length > 1 ? `Xoá ${pendingDelete.length} lịch` : 'Xoá lịch'}
      cancelLabel="Huỷ"
      variant="destructive"
      isLoading={deleting}
      onConfirm={() => void handleDelete()}
      onCancel={() => { if (!deleting) setPendingDelete(null); }}
    />
  </section>;
}
