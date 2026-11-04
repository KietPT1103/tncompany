import * as XLSX from 'xlsx';

type Row = { code: string; name: string; unit: string; quantity: number; pendingQuantity?: number };
type Report = { sales: Row[]; ingredients: Row[]; totalSoldQuantity: number; pendingQuantity: number };
export type UsageTab = 'sales' | 'ingredients';
type Options = { from: string; to: string; storeName: string };
const dateLabel = (date: string) => date.split('-').reverse().join('/');

export function createIngredientUsageWorkbook(report: Report, tab: UsageTab, options: Options) {
  const sales = tab === 'sales';
  const label = sales ? 'Món bán' : 'Nguyên liệu đã dùng';
  const rows: (string | number)[][] = [
    [`Báo cáo ${label.toLocaleLowerCase('vi-VN')}`],
    [`Từ ngày ${dateLabel(options.from)} đến ngày ${dateLabel(options.to)}`],
    [`Chi nhánh: ${options.storeName}`],
    [],
    ['Mã', sales ? 'Món bán' : 'Nguyên liệu', 'Đơn vị', sales ? 'Số lượng bán' : 'Số lượng đã dùng', ...(sales ? ['Chưa lưu công thức'] : [])],
  ];
  if (sales) rows.push(['Tổng số món bán', '', '', report.totalSoldQuantity, report.pendingQuantity]);
  for (const row of sales ? report.sales : report.ingredients) {
    rows.push([row.code, row.name, row.unit || 'Chưa có đơn vị', row.quantity, ...(sales ? [row.pendingQuantity ?? 0] : [])]);
  }
  if (!sales) rows.push([], ['Số lượng tiêu hao theo công thức. Mỗi nguyên liệu được tổng hợp theo đơn vị riêng.']);
  if (report.pendingQuantity > 0) rows.push([], [`Còn ${report.pendingQuantity} món bán chưa lưu công thức. Tổng nguyên liệu chưa bao gồm các món này.`]);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{wch:18},{wch:40},{wch:20},{wch:22},...(sales ? [{wch:24}] : [])];
  sheet['!merges'] = [0,1,2].map(r => ({s:{r,c:0},e:{r,c:sales ? 4 : 3}}));
  for (let r=5;r<rows.length;r++) for (const c of sales ? [3,4] : [3]) {
    const cell=sheet[XLSX.utils.encode_cell({r,c})];
    if (cell?.t === 'n') cell.z='#,##0.###';
  }
  const book=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,sheet,label);
  return book;
}

export function downloadIngredientUsage(report: Report, tab: UsageTab, options: Options & {storeId: string}) {
  const book=createIngredientUsageWorkbook(report,tab,options);
  const store=options.storeId.replace(/[^a-zA-Z0-9_-]/g,'_');
  XLSX.writeFile(book,`${tab === 'sales' ? 'mon-ban' : 'nguyen-lieu-da-dung'}_${store}_${options.from}_${options.to}.xlsx`);
}
