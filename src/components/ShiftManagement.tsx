import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { businessDate } from "@/lib/shiftDay";
import { assignUnassignedBills, getUnassignedBills, type ShiftReviewBill, correctShift, getManagedShifts, getShiftReview, type CashierShift, type ShiftReview } from "@/services/shiftService";

const shiftLabel = (shift: CashierShift) => `${shift.shiftType === "single" ? "Ca chung" : `Ca ${shift.shiftType.slice(-1)}`} · ${shift.cashierName}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : "Không thể tải dữ liệu ca.";
const money = (value: number) => Number(value).toLocaleString("vi-VN") + " đ";
const timestampInput = (seconds?: number) => {
  if (!seconds) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(seconds * 1000));
  const part = (type: string) => parts.find(item => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
};
const mysqlTime = (value: string) => value ? value.replace("T", " ").padEnd(19, ":00") : "";
const displayTime = (value: string) => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} ${value.slice(11, 19)}` : "Đang mở";
const shiftTime = (shift: CashierShift) => displayTime(mysqlTime(timestampInput(shift.openedAt?.seconds)));
const fieldClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100";

export default function ShiftManagement({ storeId, onChanged }: { storeId: string; onChanged: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(businessDate);
  const [items, setItems] = useState<CashierShift[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [review, setReview] = useState<ShiftReview | null>(null);
  const [openedAt, setOpenedAt] = useState("");
  const [closedAt, setClosedAt] = useState("");
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [targetDate, setTargetDate] = useState(businessDate);
  const [targets, setTargets] = useState<CashierShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [targetError, setTargetError] = useState("");
  const [notice, setNotice] = useState("");
  const [unassignedDate, setUnassignedDate] = useState(businessDate);
  const [unassigned, setUnassigned] = useState<ShiftReviewBill[]>([]);
  const [assignmentIds, setAssignmentIds] = useState<string[]>([]);
  const [assignmentReason, setAssignmentReason] = useState("");
  const [assignmentReviewed, setAssignmentReviewed] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(""); setItems([]);
    getManagedShifts(storeId, date).then(rows => { if (active) setItems(rows); })
      .catch(error => { if (active) setError(errorText(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, storeId, date, revision]);

  useEffect(() => {
    setReview(null); setReason(""); setReviewed(false); setTransfers({});
    if (!open || !selectedId) return;
    let active = true;
    setLoadingReview(true); setError("");
    getShiftReview(storeId, selectedId).then(data => {
      if (!active) return;
      setUnassignedDate(date); setReview(data); setOpenedAt(timestampInput(data.shift.openedAt?.seconds));
      setClosedAt(timestampInput(data.shift.closedAt?.seconds));
      setTargetDate(data.bills[0]?.created_at.slice(0, 10) || date);
    }).catch(error => { if (active) setError(errorText(error)); })
      .finally(() => { if (active) setLoadingReview(false); });
    return () => { active = false; };
  }, [open, storeId, selectedId, revision]);

  useEffect(() => {
    if (!open || !review || !targetDate) return;
    let active = true;
    setTargets([]); setTargetError("");
    getManagedShifts(storeId, targetDate).then(rows => { if (active) setTargets(rows); })
      .catch(error => { if (active) setTargetError(errorText(error)); });
    return () => { active = false; };
  }, [open, storeId, review, targetDate]);

  useEffect(() => {
    setAssignmentIds([]); setAssignmentReviewed(false); setAssignmentReason("");
    setUnassigned([]); setAssignmentError("");
    if (!open || !selectedId || !unassignedDate) return;
    let active = true;
    setLoadingUnassigned(true);
    getUnassignedBills(storeId, unassignedDate).then(rows => { if (active) setUnassigned(rows); })
      .catch(error => { if (active) setAssignmentError(errorText(error)); })
      .finally(() => { if (active) setLoadingUnassigned(false); });
    return () => { active = false; };
  }, [open, storeId, selectedId, unassignedDate, revision]);

  const assign = async () => {
    if (!review || !assignmentIds.length || !assignmentReason.trim() || !assignmentReviewed) return;
    if (!window.confirm(`Gán ${assignmentIds.length} bill chưa có ca vào ${shiftLabel(review.shift)}? Doanh thu ca sẽ được tính lại, kể cả bill ngoài giờ ca.`)) return;
    setSaving(true); setAssignmentError(""); setNotice("");
    try {
      const result = await assignUnassignedBills(storeId, { id: review.shift.id, billIds: assignmentIds, reason: assignmentReason.trim(), reviewed: assignmentReviewed });
      setNotice(`Đã gán ${result.movedBills} bill vào ${shiftLabel(review.shift)}.`);
      setRevision(value => value + 1); onChanged();
    } catch (error) { setAssignmentError(errorText(error)); }
    finally { setSaving(false); }
  };

  const outside = (value: string) => value < mysqlTime(openedAt) || (!!closedAt && value > mysqlTime(closedAt));
  const outsideBills = review?.bills.filter(bill => outside(bill.created_at)) || [];
  const outsideVouchers = review?.vouchers.filter(voucher => outside(voucher.happened_at)) || [];
  const movedCount = Object.values(transfers).filter(Boolean).length;
  const save = async () => {
    if (!review) return;
    if (!openedAt || (review.shift.status === "closed" && !closedAt) || !reason.trim() || !reviewed) {
      setError("Nhập giờ ca, lý do và xác nhận đã kiểm tra trước khi lưu."); return;
    }
    if (!window.confirm(`Lưu điều chỉnh giờ ca và chuyển ${movedCount} hóa đơn? Tổng tiền các ca liên quan sẽ được tính lại; tiền bàn giao thực tế giữ nguyên.`)) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await correctShift(storeId, { id: review.shift.id, openedAt: mysqlTime(openedAt), closedAt: closedAt ? mysqlTime(closedAt) : null, reason: reason.trim(), reviewed, reviewToken: review.reviewToken,
        transfers: Object.entries(transfers).filter(([, target]) => target).map(([billId, targetShiftId]) => ({ billId, targetShiftId })) });
      setNotice(`Đã lưu điều chỉnh và chuyển ${result.movedBills} hóa đơn. Tiền bàn giao thực tế được giữ nguyên.`);
      setRevision(value => value + 1); onChanged();
    } catch (error) { setError(errorText(error)); }
    finally { setSaving(false); }
  };

  return <>
    <Button variant="outline" size="sm" onClick={() => { setSelectedId(""); setNotice(""); setOpen(true); dialog.current?.showModal(); }}>Quản lý ca</Button>
    <dialog ref={dialog} onClose={() => setOpen(false)} onCancel={event => { if (saving) event.preventDefault(); }} className="m-auto max-h-[94vh] w-[min(1100px,96vw)] rounded-xl border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50" aria-labelledby="shift-management-title">
      <div className="flex items-center justify-between border-b p-4">
        <div><h2 id="shift-management-title" className="text-lg font-bold">Quản lý ca</h2><p className="text-xs text-slate-500">Giờ Việt Nam · Chỉnh giờ, kiểm tra hóa đơn và lưu lịch sử</p></div>
        <Button variant="outline" size="sm" disabled={saving} onClick={() => dialog.current?.close()}>Đóng</Button>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Ngày cần kiểm tra<input type="date" className={fieldClass} value={date} disabled={saving} onChange={event => { if (!event.target.value) return; setDate(event.target.value); setSelectedId(""); setNotice(""); }} /></label>
          <Button variant="outline" size="sm" disabled={saving || loading || loadingReview} onClick={() => setRevision(value => value + 1)}>Tải lại ca</Button>
          <span className="text-xs text-slate-500">Bao gồm ca kéo dài qua ngày và mọi ca chưa đóng.</span>
        </div>
        {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="max-h-96 space-y-2 overflow-auto lg:max-h-[65vh]" aria-label="Danh sách ca">
            {loading && <p className="text-sm">Đang tải ca...</p>}
            {!loading && items.length === 0 && <p className="text-sm text-slate-500">Không có ca trong ngày này.</p>}
            {items.map(shift => <button key={shift.id} disabled={saving || loadingReview} onClick={() => { setSelectedId(shift.id); setNotice(""); }} className={`w-full rounded-lg border p-3 text-left text-sm ${selectedId === shift.id ? "border-sky-500 bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <strong className="block">{shiftLabel(shift)}</strong>
              <span className="block text-xs">Mở: {shiftTime(shift)}</span>
              <span className="block text-xs">Đóng: {displayTime(mysqlTime(timestampInput(shift.closedAt?.seconds)))}</span>
              {shift.status === "open" && shift.isPreviousDay && <span className="text-xs font-semibold text-amber-700">Còn mở từ ngày trước</span>}
            </button>)}
          </div>
          <div className="min-w-0 space-y-4">
            {loadingReview && <p className="text-sm">Đang kiểm tra hóa đơn và phiếu thu/chi...</p>}
            {!review && !loadingReview && <p className="py-6 text-sm text-slate-500">Chọn ca cần điều chỉnh.</p>}
            {review && <fieldset disabled={saving} className="min-w-0 space-y-4">
              <h3 className="font-semibold">{shiftLabel(review.shift)} · {review.shift.status === "open" ? "Đang mở" : "Đã đóng"}</h3>
              <section className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3" aria-label="Gán bill chưa có ca">
                <h4 className="font-semibold">Bill chưa có ca</h4>
                <p className="text-sm">Ca nhận: <strong>{shiftLabel(review.shift)} · {shiftTime(review.shift)}</strong>. Cho phép gán cả bill ngoài giờ ca và ca đã đóng. Doanh thu ca được tính lại; giờ tạo bill và tiền bàn giao thực tế giữ nguyên.</p>
                <label className="block text-sm">Ngày tạo bill chưa có ca<input type="date" className={fieldClass} value={unassignedDate} onChange={event => { if (event.target.value) setUnassignedDate(event.target.value); }} /></label>
                {loadingUnassigned && <p className="text-sm">Đang tìm bill chưa có ca...</p>}
                {assignmentError && <p role="alert" className="text-sm text-rose-700">{assignmentError}</p>}
                <div className="max-h-64 space-y-2 overflow-auto">
                  {unassigned.map(bill => <label key={bill.id} className="flex items-start gap-2 rounded border bg-white p-2 text-sm">
                    <input type="checkbox" aria-label={`Gán bill ${bill.id}`} checked={assignmentIds.includes(bill.id)} onChange={event => { setAssignmentIds(current => event.target.checked ? [...current, bill.id] : current.filter(id => id !== bill.id)); setAssignmentReviewed(false); }} />
                    <span><strong>{bill.id}</strong> · {money(bill.total)} · Bàn {bill.table_number}<span className="block text-xs">{displayTime(bill.created_at)} · {bill.payment_method === "transfer" ? "Chuyển khoản" : "Tiền mặt"}{bill.status === "cancelled" ? " · Đã hủy" : ""}</span></span>
                  </label>)}
                  {!loadingUnassigned && !assignmentError && unassigned.length === 0 && <p className="text-sm">Không có bill chưa gắn ca trong ngày này.</p>}
                </div>
                <label className="block text-sm">Lý do gán bill *<textarea aria-label="Lý do gán bill" maxLength={1000} rows={2} className={fieldClass} value={assignmentReason} onChange={event => setAssignmentReason(event.target.value)} /></label>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" aria-label="Xác nhận gán bill" checked={assignmentReviewed} onChange={event => setAssignmentReviewed(event.target.checked)} /><span>Tôi đã kiểm tra bill và ca nhận, kể cả các bill ngoài giờ ca.</span></label>
                <Button disabled={loadingUnassigned || !assignmentIds.length || !assignmentReason.trim() || !assignmentReviewed} isLoading={saving} onClick={() => void assign()}>Gán {assignmentIds.length} bill vào ca này</Button>
              </section>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">Giờ mở ca<input type="datetime-local" step="1" value={openedAt} className={fieldClass} onChange={event => { setOpenedAt(event.target.value); setReviewed(false); }} /></label>
                <label className="text-sm">Giờ đóng ca<input type="datetime-local" step="1" value={closedAt} disabled={review.shift.status === "open"} className={fieldClass} onChange={event => { setClosedAt(event.target.value); setReviewed(false); }} />{review.shift.status === "open" && <span className="text-xs text-slate-500">Đóng ca qua quy trình bàn giao tại POS.</span>}</label>
              </div>
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Có {outsideBills.length} hóa đơn và {outsideVouchers.length} phiếu thu/chi ngoài thời gian mới. Các dòng giữ nguyên vẫn thuộc ca này. Chuyển hóa đơn sẽ thay đổi doanh thu và số tiền phải bàn giao của cả hai ca.</p>
              <label className="block text-sm">Tìm ca đích theo ngày<input type="date" value={targetDate} className={fieldClass} onChange={event => setTargetDate(event.target.value)} /></label>
              {targetError && <p role="alert" className="text-sm text-rose-700">{targetError}</p>}
              <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Hóa đơn / giờ tạo</th><th className="p-2">Giá trị</th><th className="p-2">Ca ghi nhận</th></tr></thead><tbody>
                  {review.bills.map(bill => {
                    const candidates = targets.filter(shift => shift.id !== review.shift.id && mysqlTime(timestampInput(shift.openedAt?.seconds)) <= bill.created_at && (!shift.closedAt || mysqlTime(timestampInput(shift.closedAt.seconds)) >= bill.created_at));
                    const selected = transfers[bill.id] || "";
                    return <tr key={bill.id} className={outside(bill.created_at) ? "bg-amber-50" : ""}>
                      <td className="p-2"><strong>{bill.id}</strong><span className="block">{displayTime(bill.created_at)}</span>{bill.status === "cancelled" && <span className="text-rose-600">Đã hủy</span>}{outside(bill.created_at) && <span className="block text-amber-800">Ngoài thời gian mới</span>}</td>
                      <td className="whitespace-nowrap p-2">{money(bill.total)}<span className="block text-slate-500">{bill.payment_method === "transfer" ? "Chuyển khoản" : "Tiền mặt"}</span></td>
                      <td className="min-w-44 p-2"><select aria-label={`Ca đích cho ${bill.id}`} className={fieldClass} value={selected} onChange={event => { setTransfers(current => ({ ...current, [bill.id]: event.target.value })); setReviewed(false); }}>
                        <option value="">Giữ nguyên ca</option>
                        {selected && !candidates.some(shift => shift.id === selected) && <option value={selected}>Ca đã chọn: {selected}</option>}
                        {candidates.map(shift => <option key={shift.id} value={shift.id}>{shiftLabel(shift)} · {shiftTime(shift)}</option>)}
                      </select></td>
                    </tr>;
                  })}
                  {review.bills.length === 0 && <tr><td colSpan={3} className="p-3 text-slate-500">Ca chưa có hóa đơn.</td></tr>}
                </tbody></table>
              </div>
              <p className="text-xs text-slate-500">Chỉ hiển thị ca đích chứa thời điểm tạo hóa đơn. Đổi ngày tìm kiếm để chọn ca ngày khác.</p>
              <details className="rounded-md border p-3 text-sm"><summary>Phiếu thu/chi gắn ca ({review.vouchers.length}) · giữ nguyên khi sửa</summary>
                <ul className="mt-2 space-y-1">{review.vouchers.map(voucher => <li key={voucher.id} className={outside(voucher.happened_at) ? "text-amber-800" : ""}>{displayTime(voucher.happened_at)} · {voucher.voucher_type === "income" ? "Thu" : "Chi"} {money(voucher.amount)}{voucher.cancelled_at ? " · Đã hủy" : ""}{outside(voucher.happened_at) ? " · Ngoài thời gian mới" : ""}</li>)}</ul>
              </details>
              <label className="block text-sm">Lý do điều chỉnh *<textarea maxLength={1000} rows={2} className={fieldClass} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ví dụ: mở nhầm ca 2 từ hôm qua" /></label>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-1" /><span>Tôi đã kiểm tra hóa đơn, phiếu thu/chi và các dòng giữ nguyên ngoài thời gian mới.</span></label>
              <Button onClick={() => void save()} isLoading={saving} disabled={!reviewed || !reason.trim() || !openedAt}>Lưu điều chỉnh · chuyển {movedCount} hóa đơn</Button>
              <details className="rounded-md border p-3 text-sm"><summary>Lịch sử điều chỉnh ({review.history.length} lần gần nhất)</summary>
                <div className="mt-3 space-y-3">{review.history.map(entry => {
                  const before = JSON.parse(entry.before_json)[review.shift.id];
                  const after = JSON.parse(entry.after_json)[review.shift.id];
                  const moves = JSON.parse(entry.transfers_json) as { billId: string; targetShiftId: string }[];
                  return <div key={entry.id} className="border-t pt-2"><p className="font-semibold">{entry.actor_name} · {displayTime(entry.created_at)}</p><p>{entry.reason}</p><p className="text-xs">Mở: {displayTime(before.opened_at)} → {displayTime(after.opened_at)}</p><p className="text-xs">Đóng: {displayTime(before.closed_at || "")} → {displayTime(after.closed_at || "")}</p>{moves.map(move => <p className="break-all text-xs" key={move.billId}>{move.billId} → ca {move.targetShiftId}</p>)}</div>;
                })}{review.history.length === 0 && <p className="text-slate-500">Chưa có điều chỉnh.</p>}</div>
              </details>
            </fieldset>}
          </div>
        </div>
      </div>
    </dialog>
  </>;
}
