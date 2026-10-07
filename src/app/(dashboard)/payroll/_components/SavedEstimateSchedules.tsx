import { useEffect, useState } from 'react';
import { CalendarRange, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { SingleDatePicker } from '@/components/ui/SingleDatePicker';
import { SelectBox } from '@/components/ui/SelectBox';
import { estimatePeriodForDate, type EstimatePeriod } from '@/lib/estimatePeriods';
import { deleteSavedEstimateSchedules, getSavedEstimateSchedules, type SavedEstimateSchedule } from '@/services/payrolls';

const dateLabel = (date?: string) => date ? date.split('-').reverse().join('/') : '—';
const moneyLabel = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
const savedAtLabel = (value: string) => {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}+07:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}) : '—';
};
const outline = 'rounded-md border-slate-200 hover:border-[#064E3B] focus-visible:border-[#064E3B] focus-visible:ring-0 focus-visible:ring-offset-0';

type PeriodPreset = 'all' | 'week' | 'month' | 'custom';
const periodOptions: {value: PeriodPreset; label: string}[] = [
  {value:'custom',label:'Khoảng ngày'}, {value:'week',label:'Theo tuần'},
  {value:'month',label:'Theo tháng'}, {value:'all',label:'Tất cả lịch'},
];

export function SavedEstimateSchedules({ storeId, revision, onOpen, onDeleted, onCreate, onRefresh, initialRange, opening }: {
  storeId: string; revision: number; onOpen: (id: string) => void; onDeleted: (id: string) => void;
  onCreate: () => void; onRefresh: () => void; initialRange: EstimatePeriod; opening: boolean;
}) {
  const [preset, setPreset] = useState<PeriodPreset>('custom');
  const [period, setPeriod] = useState(initialRange);
  const [anchorDate, setAnchorDate] = useState(initialRange.startDate);
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
    getSavedEstimateSchedules(storeId,page,preset === 'all' ? undefined : period)
      .then(response => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(response.total / 10));
        if (page > lastPage) setPage(lastPage);
        else setData(response);
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Không tải được lịch đã lưu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId,page,revision,reload,preset,period.startDate,period.endDate]);

  function changePeriod(next: EstimatePeriod) {
    setPeriod(next); setPage(1); setMessage('');
  }
  function changePreset(value: PeriodPreset) {
    setPreset(value); setPage(1); setMessage('');
    if (value === 'week' || value === 'month') setPeriod(estimatePeriodForDate(anchorDate,value));
  }

  async function handleDelete() {
    if (!pendingDelete || deleting || opening) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteSavedEstimateSchedules(storeId, pendingDelete.map(schedule => schedule.id));
      onRefresh();
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
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className={`gap-2 text-emerald-900 ${outline}`} disabled={opening || deleting} onClick={onCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />Tạo lịch mới
        </Button>
        <Button variant="outline" className={`gap-2 ${outline}`} disabled={loading || opening || deleting} onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Làm mới
        </Button>
      </div>
    </div>
    <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Tổng lương theo khoảng ngày</h3>
        <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">Cộng tất cả lịch có cùng ngày bắt đầu và kết thúc, kể cả lịch trùng vai trò.</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-40">
          <span className="mb-2 block text-sm font-medium text-slate-600">Xem theo</span>
          <SelectBox value={preset} options={periodOptions} onValueChange={changePreset} ariaLabel="Chọn kỳ tổng lương" disabled={opening || deleting} triggerClassName={`h-10 ${outline}`} />
        </div>
        {preset === 'custom' && <DateRangePicker
          label="Khoảng ngày" startDate={period.startDate} endDate={period.endDate}
          onChange={(startDate,endDate) => {
            setAnchorDate(startDate);
            changePeriod(startDate <= endDate ? {startDate,endDate} : {startDate:endDate,endDate:startDate});
          }}
          disabled={opening || deleting} className="w-full sm:w-80" triggerClassName={`h-10 ${outline}`} openTriggerClassName="!border-[#064E3B] !ring-0"
        />}
        {(preset === 'week' || preset === 'month') && <SingleDatePicker
          label={preset === 'week' ? 'Chọn ngày trong tuần' : 'Chọn ngày trong tháng'} value={anchorDate}
          onChange={date => { setAnchorDate(date); changePeriod(estimatePeriodForDate(date,preset)); }}
          disabled={opening || deleting} className="w-full sm:w-56" triggerClassName={`h-10 ${outline}`}
        />}
      </div>
    </div>
    {message && <p role="status" className="px-5 pt-4 text-sm text-emerald-800">{message}</p>}
    {loading ? <p role="status" className="p-10 text-center text-sm text-slate-500">Đang tải lịch đã lưu...</p>
      : error ? <div role="alert" className="m-4 rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      : data && <>
        {data.summary ? <div className="border-b border-slate-200 p-4 sm:p-5">
          <p className="mb-3 text-xs font-medium tabular-nums text-slate-500">{dateLabel(data.summary.startDate)} – {dateLabel(data.summary.endDate)}</p>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="min-w-0 rounded-lg bg-emerald-50 p-4">
              <dt className="text-sm text-emerald-800">Tổng lương ước tính</dt>
              <dd className="mt-2 break-words text-2xl font-bold tabular-nums text-[#064E3B]">{moneyLabel(data.summary.totalSalary)}</dd>
            </div>
            {[
              ['Số lịch đã lưu', `${data.summary.scheduleCount} lịch`],
              ['Nhân viên', `${data.summary.employeeCount} người`],
              ['Tổng giờ', `${data.summary.totalHours.toLocaleString('vi-VN',{maximumFractionDigits:2})} giờ`],
            ].map(([label,value]) => <div key={label} className="rounded-lg bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{value}</dd>
            </div>)}
          </dl>
        </div> : <p className="border-b border-slate-200 px-5 py-4 text-sm text-slate-500">Chọn tuần, tháng hoặc khoảng ngày để xem tổng lương các lịch cùng kỳ.</p>}
        {!data.items.length ? <div className="flex flex-col items-center px-5 py-12 text-center">
          <CalendarRange className="h-8 w-8 text-emerald-800" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-slate-800">{preset === 'all' ? 'Chưa có lịch phân ca đã lưu' : 'Chưa có lịch đúng khoảng ngày này'}</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">Chọn khoảng ngày khác hoặc tạo lịch mới và bấm Lưu ước tính.</p>
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
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500 xl:grid">
            <span>Lịch / khoảng ngày</span><span>Loại lịch</span><span>Cập nhật lần cuối</span><span>Nhân viên / giờ</span><span>Lương ước tính</span><span className="w-36">Thao tác</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.items.map(schedule => <li key={schedule.id} className={`grid min-w-0 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] xl:items-center xl:gap-4 ${selectedIds.includes(schedule.id) ? 'bg-emerald-50/60' : ''}`}>
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
              <div>
                <span className="mb-1 block text-xs text-slate-500 xl:hidden">Loại lịch</span>
                <div className="flex flex-wrap gap-1.5">
                  {schedule.roles.length ? schedule.roles.map(role => <span key={role} className="break-words rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-[#064E3B]">{role}</span>) : <span className="text-xs text-slate-500">Chưa xác định</span>}
                </div>
              </div>
              <div className="text-sm text-slate-600"><span className="mb-1 block text-xs text-slate-500 xl:hidden">Cập nhật lần cuối</span>{savedAtLabel(schedule.updatedAt)}</div>
              <div className="text-sm text-slate-600">{schedule.employeeCount} người<span className="mt-1 block text-xs text-slate-500">{schedule.totalHours.toLocaleString('vi-VN',{maximumFractionDigits:2})} giờ</span></div>
              <div className="break-words text-sm font-bold tabular-nums text-emerald-800"><span className="mb-1 block text-xs font-normal text-slate-500 xl:hidden">Lương ước tính</span>{moneyLabel(schedule.totalSalary)}</div>
              <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-1 xl:w-36">
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
