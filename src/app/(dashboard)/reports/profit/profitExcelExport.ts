import ExcelJS from 'exceljs';
import { calculateProfitPeriod } from './profitPeriod';
import { profitOtherExpenses, type ProfitInputs } from './dailyProfit';
import type { ProfitDay } from '@/services/dailyProfitService';

const GREEN = 'FF064E3B', GOLD = 'FFF6C85F', INK = 'FF0F172A', PALE = 'FFF0FDF4';
const MONEY = '#,##0.##" đ";[Red](#,##0.##)" đ";"—"';
const fill = (argb: string): ExcelJS.Fill => ({type:'pattern',pattern:'solid',fgColor:{argb}});
const dateLabel = (date: string) => date.split('-').reverse().join('/');
const excelDate = (date: string) => new Date(`${date}T00:00:00Z`);

function sheet(workbook: ExcelJS.Workbook, name: string, title: string, subtitle: string, widths: number[], headers: string[]) {
  const ws = workbook.addWorksheet(name, {properties:{defaultRowHeight:23},pageSetup:{paperSize:widths.length > 8 ? 8 : 9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.25,right:0.25,top:0.4,bottom:0.4,header:0.15,footer:0.15}}});
  ws.columns = widths.map(width => ({width}));
  ws.views = [{state:'frozen',ySplit:5,xSplit:name==='Theo ngày'?1:0,showGridLines:false}];
  ws.mergeCells(1,1,2,widths.length);
  const heading=ws.getCell('A1'); heading.value=title;heading.font={name:'Calibri',size:21,bold:true,color:{argb:GOLD}};heading.fill=fill(GREEN);heading.alignment={vertical:'middle'};
  ws.getRow(1).height=26;ws.getRow(2).height=20;
  ws.mergeCells(3,1,3,widths.length);ws.getCell('A3').value=subtitle;ws.getCell('A3').font={name:'Calibri',size:11,color:{argb:'FF64748B'}};
  ws.getCell('A3').alignment={vertical:'middle',wrapText:true};ws.getRow(3).height=32;
  ws.getRow(5).values=headers;ws.getRow(5).height=34;
  ws.getRow(5).eachCell(cell=>{cell.fill=fill(GREEN);cell.font={name:'Calibri',bold:true,color:{argb:'FFFFFFFF'},size:11};cell.alignment={vertical:'middle',wrapText:true};});
  ws.pageSetup.printTitlesRow='1:5';
  ws.headerFooter.oddFooter='&LTN Services · Báo cáo lợi nhuận&RTrang &P / &N';
  return ws;
}
function bodyRow(ws: ExcelJS.Worksheet, values: ExcelJS.CellValue[]) {
  const row=ws.addRow(values);
  row.eachCell({includeEmpty:true},cell=>{
    cell.font={name:'Calibri',size:11,color:{argb:INK}};
    cell.fill=fill(row.number%2===0?'FFFFFFFF':'FFF8FAFC');
    cell.border={bottom:{style:'hair',color:{argb:'FFE2E8F0'}}};
    cell.alignment={vertical:'middle',wrapText:true};
    if(typeof cell.value==='number'||cell.type===ExcelJS.ValueType.Formula){cell.numFmt=MONEY;cell.alignment.horizontal='right';}
    if(cell.value instanceof Date){cell.numFmt='dd/mm/yyyy';cell.alignment.horizontal='center';}
  });
  // Allow long item names and notes to wrap without being clipped.
  row.height=Math.max(25,...values.filter(v=>typeof v==='string').map(v=>Math.ceil(String(v).length/42)*15+10));
  return row;
}
function finish(ws: ExcelJS.Worksheet, columns: number, moneyColumns: number[]) {
  const last=ws.rowCount;
  if(last>=6)ws.autoFilter={from:{row:5,column:1},to:{row:last,column:columns}};
  const total=bodyRow(ws,Array.from({length:columns},(_,i)=>i===0?'TỔNG CỘNG':null));
  for(const col of moneyColumns){
    const letter=ws.getColumn(col).letter;
    let value=0;for(let r=6;r<=last;r++){const c=ws.getCell(r,col);value+=typeof c.value==='number'?c.value:typeof c.result==='number'?c.result:0;}
    total.getCell(col).value={formula:last>=6?`SUM(${letter}6:${letter}${last})`:'0',result:value};total.getCell(col).numFmt=MONEY;
  }
  total.height=30;total.eachCell({includeEmpty:true},cell=>{cell.fill=fill(PALE);cell.font={name:'Calibri',bold:true,color:{argb:GREEN},size:11};cell.border={top:{style:'thin',color:{argb:GREEN}}};});
  ws.pageSetup.printArea=`A1:${ws.getColumn(columns).letter}${ws.rowCount}`;
  return total.number;
}

export function buildProfitWorkbook(options: {storeName: string; startDate: string; endDate: string; days: ProfitDay[]; inputsByDate: Record<string,ProfitInputs>; unsaved?: boolean}) {
  const calculation=calculateProfitPeriod(options.days,options.inputsByDate);
  if(!calculation.complete)throw new Error('Cần nhập đủ chi phí và cost của tất cả ngày trong kỳ trước khi xuất Excel.');
  const rows=[...calculation.rows].sort((a,b)=>a.date.localeCompare(b.date));
  const workbook=new ExcelJS.Workbook();workbook.creator='TN Services';workbook.created=new Date();workbook.calcProperties.fullCalcOnLoad=true;
  const subtitle=`${options.storeName} · ${dateLabel(options.startDate)} – ${dateLabel(options.endDate)} · Đơn vị: VND${options.unsaved?' · Dữ liệu đang chỉnh sửa, chưa lưu':''}`;
  const summary=sheet(workbook,'Tổng hợp','TN SERVICES | BÁO CÁO LỢI NHUẬN',subtitle,[24,18,18,18,18,22],['Chỉ tiêu','','','','','Giá trị']);
  const daily=sheet(workbook,'Theo ngày','CHI TIẾT LỢI NHUẬN THEO NGÀY',subtitle,[15,21,21,21,21,19,19,21,21,21,23,21,23,23,15,13],['Ngày','Doanh thu','Giá vốn món','Lương nhân viên','Chi tại quầy','Tiền điện','Tiền nước','Chi phí khác','Marketing','Anh Thiện chi','Tồn kho nguyên liệu','Công nợ','Tổng chi phí','Lợi nhuận ròng','Biên lợi nhuận','Số hóa đơn']);
  const costs=sheet(workbook,'Giá vốn món','CHI TIẾT GIÁ VỐN MÓN ĐÃ BÁN',subtitle,[15,21,44,16,23,24],['Ngày','Mã món','Tên món','Số lượng','Cost / món','Tổng giá vốn']);
  const expenses=sheet(workbook,'Các khoản chi','CHI TIẾT CÁC KHOẢN CHI',subtitle,[15,26,27,44,48,23],['Ngày','Loại chi phí','Mã phiếu','Tên / nội dung','Ghi chú','Số tiền']);
  for(const day of rows){
    const n=daily.rowCount+1;const {inputs,result,source}=day;
    const row=bodyRow(daily,[excelDate(day.date),source.revenue,result.materialCost,inputs.salary, result.voucherCost,inputs.electricity,inputs.water,inputs.other,inputs.marketing,inputs.thienExpense,inputs.ingredientInventory,inputs.debt,
      {formula:`SUM(C${n}:J${n})`,result:result.totalCosts},
      {formula:`B${n}-M${n}+K${n}-L${n}`,result:result.profit!},
      {formula:`IF(B${n}>0,N${n}/B${n},0)`,result:result.margin===null?0:result.margin/100},source.billCount]);
    row.getCell(15).numFmt='0.0%;[Red](0.0%);"—"';row.getCell(16).numFmt='#,##0';
    row.getCell(14).font={name:'Calibri',bold:true,color:{argb:result.profit!<0?'FFB91C1C':GREEN}};
    for(const item of result.costRows){
      const r=costs.rowCount+1;const line=bodyRow(costs,[excelDate(day.date),item.code,item.name,item.quantity,item.unitCost,{formula:`D${r}*E${r}`,result:item.cost!}]);line.getCell(4).numFmt='#,##0.###';
    }
    for(const voucher of source.vouchers)bodyRow(expenses,[excelDate(day.date),'Chi tại quầy',voucher.code,voucher.category,voucher.note||'',voucher.amount]);
    for(const item of profitOtherExpenses(inputs))bodyRow(expenses,[excelDate(day.date),'Chi phí khác','',item.name,'',item.amount]);
    for(const [key,label] of [['electricity','Tiền điện'],['water','Tiền nước'],['marketing','Marketing'],['thienExpense','Anh Thiện chi']] as const)if(inputs[key])bodyRow(expenses,[excelDate(day.date),label,'',label,'',inputs[key]]);
  }
  const total=finish(daily,16,[2,3,4,5,6,7,8,9,10,11,12,13,14,16]);daily.getCell(total,16).numFmt='#,##0';
  daily.getCell(total,15).value={formula:`IF(B${total}>0,N${total}/B${total},0)`,result:calculation.margin===null?0:calculation.margin/100};daily.getCell(total,15).numFmt='0.0%';
  finish(costs,6,[6]);finish(expenses,6,[6]);
  const lines:[string,string][]=[['Doanh thu thuần','B'],['Giá vốn món đã bán','C'],['Lương nhân viên','D'],['Chi phí tại quầy thu ngân','E'],['Tiền điện','F'],['Tiền nước','G'],['Chi phí khác trong ngày','H'],['Chi phí marketing','I'],['Anh Thiện chi','J'],['TỔNG CHI PHÍ','M'],['+ Giá trị tồn kho nguyên liệu','K'],['− Công nợ','L'],['LỢI NHUẬN RÒNG','N'],['Biên lợi nhuận','O']];
  for(const [label,col] of lines){
    const n=summary.rowCount+1;const cached=daily.getCell(`${col}${total}`).result as number;
    bodyRow(summary,[label,null,null,null,null,{formula:`'Theo ngày'!${col}${total}`,result:cached}]);summary.mergeCells(n,1,n,5);summary.getCell(n,6).numFmt=col==='O'?'0.0%':MONEY;
    if(['M','N'].includes(col)){summary.getRow(n).height=34;summary.getRow(n).eachCell({includeEmpty:true},cell=>{cell.fill=fill(col==='N'?GREEN:PALE);cell.font={name:'Calibri',bold:true,size:col==='N'?15:12,color:{argb:col==='N'?GOLD:GREEN}};});}
  }
  summary.mergeCells(5,1,5,5);summary.pageSetup.printArea=`A1:F${summary.rowCount}`;
  return workbook;
}

export async function exportProfitExcel(options: Parameters<typeof buildProfitWorkbook>[0]) {
  const workbook=buildProfitWorkbook(options);
  const buffer=await workbook.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');link.href=url;link.download=`Loi-nhuan_${options.startDate}_${options.endDate}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
