export type TakeawayShiftReport = {
  storeId: string; storeName: string; businessDate: string; shiftId: string; shiftNumber: number;
  isFinalShift: boolean; openedAt: string; closedAt: string; openingCash: number; closingCash: number;
  cashierName: string; note: string;
  summary: { totalSales: number; cashSales: number; transferSales: number; incomeVouchers: number; expenseVouchers: number; expectedClosingCash: number };
  cycle: null | { shifts: { number: number; worked: boolean; actualHandover: number }[];
    totalSales: number; cashSales: number; transferSales: number; incomeVouchers: number; expenseVouchers: number;
    actualHandover: number; expectedHandover: number; difference: number };
};
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const row = (label: string, amount: number) => `<tr><td>${label}</td><td>${Number(amount).toLocaleString('vi-VN')} đ</td></tr>`;
export function takeawayShiftReportHtml(report: TakeawayShiftReport): string {
  const s = report.summary;
  const c = report.cycle;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu kết ca</title><style>
    @page{size:80mm auto;margin:3mm}body{font:12px Arial,sans-serif;width:72mm;margin:0 auto;color:#000}h1{font-size:17px;text-align:center}h2{font-size:14px;margin:14px 0 6px}p{margin:6px 0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}hr{border:0;border-top:1px dashed #000}footer{margin:14px 0 30mm;font-size:10px}
    </style></head><body><h1>${escape(report.storeName)}</h1><h2>${report.isFinalShift ? 'PHIẾU KẾT CA CUỐI NGÀY' : 'PHIẾU KẾT CA'}</h2>
    <p>Ngày kinh doanh ${escape(report.businessDate)}</p><p>Ca ${report.shiftNumber} · ${escape(report.cashierName)}</p>
    <p>Mở ${escape(report.openedAt)}<br>Đóng ${escape(report.closedAt)}</p><hr>
    <table>${row('Tiền đầu ca', report.openingCash)}${row('Doanh thu ca', s.totalSales)}${row('Tiền mặt', s.cashSales)}${row('Chuyển khoản', s.transferSales)}${row('Phiếu thu', s.incomeVouchers)}${row('Phiếu chi', s.expenseVouchers)}${row('Tiền mặt dự kiến cuối ca', s.expectedClosingCash)}${row('Tiền mặt thực đếm', report.closingCash)}${row('Chênh lệch ca', report.closingCash - s.expectedClosingCash)}</table>
    ${c ? `<hr><h2>TỔNG KẾT NGÀY KINH DOANH</h2><table>${c.shifts.map(shift => row(`Ca ${shift.number}${shift.worked ? '' : ' · Chưa phát sinh'}`, shift.actualHandover)).join('')}</table><hr><table>${row('Doanh thu toàn ngày', c.totalSales)}${row('Tiền mặt', c.cashSales)}${row('Chuyển khoản', c.transferSales)}${row('Tổng phiếu thu', c.incomeVouchers)}${row('Tổng phiếu chi', c.expenseVouchers)}${row('Bàn giao dự kiến', c.expectedHandover)}${row('Bàn giao thực tế', c.actualHandover)}${row('Chênh lệch cả ngày', c.difference)}</table>` : ''}
    ${report.note ? `<hr><p>${escape(report.note)}</p>` : ''}<footer>Số liệu tại thời điểm chốt ca.<br>Mã phiếu ${escape(report.shiftId)}</footer></body></html>`;
}
