import { useState } from 'react';
import type { CashVoucher } from '@/services/cashVoucherService';
import type { CashierShift } from '@/services/shiftService';
import { cashVoucherReport, type VoucherFilter } from './cashVoucherReport';
const money = (value: number) => value.toLocaleString('vi-VN') + ' đ';
export function CashVoucherReportTab({ vouchers, shifts }: { vouchers: CashVoucher[]; shifts: CashierShift[] }) {
const [filter,setFilter] = useState<VoucherFilter>('all');
const report = cashVoucherReport(vouchers,filter);
return <div className="space-y-4">
<div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2" aria-label="Lọc thu chi">{([['all','Tất cả'],['income','Thu'],['expense','Chi']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={'rounded-full border px-4 py-2 text-sm font-semibold ' + (filter === value ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white text-slate-700')}>{label}</button>)}</div><span className="text-sm text-slate-500">{report.items.length} phiếu theo bộ lọc</span></div>
<div className="grid gap-3 sm:grid-cols-2" aria-live="polite">{filter !== 'expense' && <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Tổng thu</p><p className="mt-1 text-2xl font-bold text-emerald-700">{money(report.income)}</p></div>}{filter !== 'income' && <div className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Tổng chi</p><p className="mt-1 text-2xl font-bold text-rose-700">{money(report.expense)}</p></div>}</div>
<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b bg-slate-100 text-xs text-slate-600"><tr>{['Thời gian','Mã phiếu','Ca','Loại','Khoản mục','Người nhận / nộp','Ghi chú'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">Số tiền</th></tr></thead><tbody className="divide-y">{report.items.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Không có phiếu thu/chi phù hợp.</td></tr> : report.items.map(voucher => {
const shift = shifts.find(item => item.id === voucher.shiftId);
const seconds = voucher.happenedAt?.seconds || voucher.createdAt?.seconds;
const shiftLabel = shift ? (shift.shiftType === 'single' ? 'Ca đơn' : 'Ca ' + shift.shiftType.replace('shift_', '')) : 'Chưa gắn ca';
return <tr key={voucher.id} className="align-top"><td className="whitespace-nowrap px-4 py-3">{seconds ? new Date(seconds * 1000).toLocaleString('vi-VN') : '—'}</td><td className="px-4 py-3 font-mono text-xs">{voucher.code}</td><td className="whitespace-nowrap px-4 py-3">{shiftLabel}</td><td className="px-4 py-3">{voucher.type === 'income' ? 'Thu' : 'Chi'}</td><td className="px-4 py-3">{voucher.category || '—'}</td><td className="px-4 py-3">{voucher.personName || '—'}</td><td className="max-w-xs break-words px-4 py-3">{voucher.note || '—'}</td><td className={'whitespace-nowrap px-4 py-3 text-right font-bold ' + (voucher.type === 'income' ? 'text-emerald-700' : 'text-rose-700')}>{money(voucher.amount)}</td></tr>;
})}</tbody></table></div></div>;
}
