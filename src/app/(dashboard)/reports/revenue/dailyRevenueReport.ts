export type RevenueBill = { status?: string; total: number; createdAt?: { seconds: number } };
export type DailyRevenueRow = { date: string; revenue: number };
export const vietnamDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export const formatRevenueDate = (value: string) => value.split('-').reverse().join('/');
export const revenueRangeDate = (value: string, end = false) => new Date(value + (end ? 'T23:59:59.999+07:00' : 'T00:00:00+07:00'));

export function aggregateDailyRevenue(bills: RevenueBill[], startDate: string, endDate: string): DailyRevenueRow[] {
  const totals = new Map<string, number>();
  for (const bill of bills) {
    if (bill.status === 'cancelled') continue;
    if (!Number.isFinite(bill.createdAt?.seconds) || !Number.isFinite(Number(bill.total))) throw new Error('Dữ liệu hóa đơn không hợp lệ.');
    const date = vietnamDateKey(new Date(bill.createdAt!.seconds * 1000));
    if (date < startDate || date > endDate) continue;
    totals.set(date, (totals.get(date) || 0) + Number(bill.total));
  }
  return [...totals].sort(([a], [b]) => b.localeCompare(a)).map(([date, revenue]) => ({ date, revenue }));
}

export async function createDailyRevenueWorkbook(rows: DailyRevenueRow[], startDate: string, endDate: string, storeName: string) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Doanh thu theo ngày');
  sheet.columns = [{ width: 28 }, { width: 36 }];
  const titleRows = [
    ['Báo cáo bán hàng theo thời gian'],
    ['Từ ngày ' + formatRevenueDate(startDate) + ' đến ngày ' + formatRevenueDate(endDate)],
    ['Chi nhánh: ' + storeName],
    ['Ngày lập: ' + new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })],
  ];
  titleRows.forEach((values, index) => { sheet.addRow(values); sheet.mergeCells(index + 1, 1, index + 1, 2); sheet.getRow(index + 1).alignment = { horizontal: 'center' }; });
  sheet.getRow(1).font = { name: 'Arial', size: 16, bold: true };
  sheet.getRow(1).height = 30;
  sheet.addRow([]);
  sheet.addRow(['Ngày', 'Doanh thu']);
  sheet.addRow(['Tổng cộng', rows.reduce((sum, row) => sum + row.revenue, 0)]);
  rows.forEach(row => sheet.addRow([new Date(row.date + 'T00:00:00Z'), row.revenue]));
  sheet.eachRow((row, index) => {
    if (index > 1) row.font = { name: 'Arial', size: 11, bold: index === 6 || index === 7 };
    if (index >= 6) {
      row.height = 25;
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(2).numFmt = '#,##0';
      row.eachCell(cell => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } }; });
    }
    if (index === 6 || index === 7) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 6 ? 'FFB1E8F7' : 'FFF2EFD8' } }; });
    if (index >= 8) row.getCell(1).numFmt = 'dd/mm/yyyy';
  });
  sheet.views = [{ state: 'frozen', ySplit: 7 }];
  sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:7' };
  return workbook;
}
