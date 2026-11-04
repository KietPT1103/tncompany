import ExcelJS from 'exceljs';
import { calculateProfitPeriod } from './profitPeriod';
import { profitOtherExpenses, type ProfitInputs } from './dailyProfit';
import type { ProfitDay } from '@/services/dailyProfitService';

const GREEN = 'FF064E3B', GOLD = 'FFF6C85F', INK = 'FF0F172A', PALE = 'FFF0FDF4';
const MONEY = '#,##0" đ";[Red](#,##0)" đ";"—"';
const fill = (argb: string): ExcelJS.Fill => ({type:'pattern',pattern:'solid',fgColor:{argb}});
const dateLabel = (date: string) => date.split('-').reverse().join('/');
const excelDate = (date: string) => new Date(`${date}T00:00:00Z`);
const gridBorder: Partial<ExcelJS.Borders> = Object.fromEntries(['top','bottom','left','right'].map(side=>[side,{style:'thin',color:{argb:'FFD1D5DB'}}]));

function sheet(workbook: ExcelJS.Workbook, name: string, title: string, subtitle: string, widths: number[], headers: string[], compact = false) {
  const ws = workbook.addWorksheet(name, {properties:{defaultRowHeight:23},pageSetup:{paperSize:widths.length > 8 ? 8 : 9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.25,right:0.25,top:0.4,bottom:0.4,header:0.15,footer:0.15}}});
  ws.columns = widths.map(width => ({width}));
  ws.views = [{state:'frozen',ySplit:compact?2:5,xSplit:name==='Theo ngày'?1:0,showGridLines:true}];
  ws.mergeCells(1,1,compact?1:2,widths.length);
  const heading=ws.getCell('A1'); heading.value=title;heading.font={name:'Calibri',size:21,bold:true,color:{argb:GOLD}};heading.fill=fill(GREEN);heading.alignment={vertical:'middle'};
  ws.getRow(1).height=compact?34:26;ws.getRow(2).height=20;
  if(compact){heading.font={name:'Calibri',size:15,bold:true,color:{argb:GOLD}};ws.headerFooter.oddHeader=subtitle;}
  else {
  ws.mergeCells(3,1,3,widths.length);ws.getCell('A3').value=subtitle;ws.getCell('A3').font={name:'Calibri',size:11,color:{argb:'FF64748B'}};
  ws.getCell('A3').alignment={vertical:'middle',wrapText:true};ws.getRow(3).height=32;
  }
  const headerRow=compact?2:5;
  ws.getRow(headerRow).values=headers;ws.getRow(headerRow).height=compact?27:34;
  ws.getRow(headerRow).eachCell(cell=>{cell.fill=fill(GREEN);cell.border=gridBorder;cell.font={name:'Calibri',bold:true,color:{argb:'FFFFFFFF'},size:11};cell.alignment={vertical:'middle',wrapText:true};});
  ws.pageSetup.printTitlesRow=`1:${headerRow}`;
  ws.headerFooter.oddFooter='&LTN Services · Báo cáo lợi nhuận&RTrang &P / &N';
  return ws;
}
function bodyRow(ws: ExcelJS.Worksheet, values: ExcelJS.CellValue[]) {
  const row=ws.addRow(values);
  row.eachCell({includeEmpty:true},cell=>{
    cell.font={name:'Calibri',size:11,color:{argb:INK}};
    cell.fill=fill(row.number%2===0?'FFFFFFFF':'FFF8FAFC');
    cell.border=gridBorder;
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
  total.height=30;total.eachCell({includeEmpty:true},cell=>{cell.fill=fill(PALE);cell.font={name:'Calibri',bold:true,color:{argb:GREEN},size:11};cell.border={...gridBorder,top:{style:'thin',color:{argb:GREEN}}};});
  ws.pageSetup.printArea=`A1:${ws.getColumn(columns).letter}${ws.rowCount}`;
  return total.number;
}

function addProfitAnalysis(ws: ExcelJS.Worksheet, values: Record<string,number|null>, source: (column:string)=>string|null) {
  ws.getColumn(3).width=4;ws.getColumn(4).width=60;ws.getColumn(5).width=26;
  const row=(n:number,label:string,value:ExcelJS.CellValue=null)=>{
    const line=ws.getRow(n);line.height??=25;
    line.getCell(4).value=label;line.getCell(5).value=value;
    for(const c of [4,5]){const cell=line.getCell(c);cell.border=gridBorder;cell.fill=fill(n%2?'FFF8FAFC':'FFFFFFFF');cell.font={name:'Calibri',size:11,color:{argb:INK}};cell.alignment={vertical:'middle',wrapText:true,horizontal:c===5?'right':'left'};}
  };
  const band=(n:number,label:string)=>{
    row(n,label);ws.mergeCells(n,4,n,5);
    for(const c of [4,5]){const cell=ws.getCell(n,c);cell.fill=fill(GREEN);cell.font={name:'Calibri',bold:true,size:n===1||n===18?15:11,color:{argb:GOLD}};}
  };
  const header=(n:number)=>{
    row(n,'Chỉ tiêu','Giá trị');
    for(const c of [4,5]){const cell=ws.getCell(n,c);cell.fill=fill(GREEN);cell.font={name:'Calibri',bold:true,size:11,color:{argb:'FFFFFFFF'}};}
  };
  const emphasis=(n:number,dark=false)=>{
    for(const c of [4,5]){const cell=ws.getCell(n,c);cell.fill=fill(dark?GREEN:PALE);cell.font={name:'Calibri',bold:true,size:c===5?15:12,color:{argb:dark?GOLD:GREEN}};}
  };
  const amount=(n:number,label:string,value:number|null,formula:string|null)=>{
    row(n,label,value!==null&&formula?{formula:`CEILING(${formula},1000)`,result:Math.ceil(value/1000)*1000}:'Chưa đủ giá bán/cost');
    ws.getCell(n,5).numFmt=MONEY;
  };
  const money=(n:number,label:string,col:string)=>amount(n,label,values[col],source(col));
  const note=(n:number,formula:string|null,value:string,last=n)=>{
    row(n,'');ws.mergeCells(n,4,last,5);
    const cell=ws.getCell(n,4);cell.value=formula?{formula,result:value}:value;
    cell.font={name:'Calibri',size:10,italic:true,color:{argb:'FF64748B'}};
  };
  const number=(value:number,digits=2)=>value.toLocaleString('vi-VN',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  const percentage=(n:number,label:string,numerator:string,denominator:string)=>{
    const a=values[numerator],b=values[denominator],aRef=source(numerator),bRef=source(denominator);
    const result=a===null||b===null?'Chưa đủ giá bán/cost':b===0?'Không xác định':a/b;
    row(n,label,aRef&&bRef?{formula:`IF(${bRef}=0,"Không xác định",${aRef}/${bRef})`,result}:result);
    ws.getCell(n,5).numFmt='0.0%';emphasis(n);
    return result;
  };
  const ratioNote=(n:number,numerator:string,denominator:string)=>{
    const a=values[numerator],b=values[denominator],aRef=source(numerator),bRef=source(denominator);
    note(n,aRef&&bRef?`TEXT(${aRef},"#,##0.00")&" ÷ "&TEXT(${bRef},"#,##0.00")&" × 100%"`:null,a!==null&&b!==null?`${number(a)} ÷ ${number(b)} × 100%`:'Chưa đủ số liệu để tính tỷ lệ.');
  };
  const explanation=(n:number,ratioRow:number,ratio:number|string,net=false)=>{
    const ending=net?'sau giá vốn, lương, thuế và các chi phí vận hành.':'trước lương, thuế và các chi phí vận hành.';
    const label=net?'Biên ròng':'Biên gộp';
    note(n,`IF(ISNUMBER(E${ratioRow}),"${label} "&TEXT(E${ratioRow},"0.0%")&": cứ 100đ doanh thu, còn khoảng "&TEXT(E${ratioRow}*100,"0.0")&"đ ${ending}","Chưa xác định biên lợi nhuận khi thiếu số liệu hoặc doanh thu bằng 0.")`,typeof ratio==='number'?`${label} ${number(ratio*100,1)}%: cứ 100đ doanh thu, còn khoảng ${number(ratio*100,1)}đ ${ending}`:'Chưa xác định biên lợi nhuận khi thiếu số liệu hoặc doanh thu bằng 0.',n+1);
    ws.getCell(n,4).font={name:'Calibri',size:11,color:{argb:INK}};
  };
  band(1,'LỢI NHUẬN GỘP');header(2);
  money(3,'Giá bán thực thu sau giảm giá (tổng)','B');
  money(4,'Giá nhập/cost hàng đã bán (tổng)','C');
  money(5,'Lợi nhuận gộp ước tính','R');emphasis(5);
  note(6,source('R')?`TEXT(${source('B')},"#,##0.00")&" − "&TEXT(${source('C')},"#,##0.00")&" = "&TEXT(${source('R')},"#,##0.00")&" đ"`:null,values.R!==null?`${number(values.B!)} − ${number(values.C!)} = ${number(values.R)} đ`:'Lợi nhuận gộp = Giá thực thu sau giảm giá − Giá nhập/cost.');
  band(7,'PHÂN TÍCH TỶ LỆ');percentage(8,'Tỷ suất lãi trên vốn','R','C');ratioNote(9,'R','C');
  const grossMargin=percentage(10,'Biên lợi nhuận gộp (GM)','R','B');ratioNote(11,'R','B');
  band(12,'Ý NGHĨA BIÊN LỢI NHUẬN GỘP');explanation(13,10,grossMargin);
  note(15,null,'Tiền hiển thị làm tròn lên 1.000đ; phép tính và tỷ lệ sử dụng số gốc chưa làm tròn.',16);

  band(18,'LỢI NHUẬN RÒNG');header(19);
  money(20,'Lợi nhuận gộp ước tính','R');emphasis(20);
  money(21,'− Lương nhân viên (1 ngày)','D');
  amount(22,'− Tiền điện, tiền nước',values.F!+values.G!,`(${source('F')}+${source('G')})`);
  money(23,'− Chi phí khác trong ngày','H');money(24,'− Chi phí marketing','I');
  money(25,'− Anh Thiện chi','J');money(27,'− Thuế (4,5% doanh thu)','Q');
  const operating=values.M!-values.C!,operatingRef=`(${source('M')}-${source('C')})`;
  amount(28,'Tổng chi phí trừ tiếp sau giá vốn',operating,operatingRef);emphasis(28);
  money(29,'Lợi nhuận ròng ước tính','N');emphasis(29,true);
  note(30,source('R')?`TEXT(${source('R')},"#,##0.00")&" − "&TEXT(${operatingRef},"#,##0.00")&" = "&TEXT(${source('N')},"#,##0.00")&" đ"`:null,values.R!==null?`${number(values.R)} − ${number(operating)} = ${number(values.N!)} đ`:'Lợi nhuận ròng = Doanh thu − Giá vốn − Các chi phí trong ngày.');
  band(31,'PHÂN TÍCH TỶ LỆ');const netMargin=percentage(32,'Biên lợi nhuận ròng','N','B');ratioNote(33,'N','B');
  band(34,'Ý NGHĨA BIÊN LỢI NHUẬN RÒNG');explanation(35,32,netMargin,true);
}

export function buildProfitWorkbook(options: {storeName: string; startDate: string; endDate: string; days: ProfitDay[]; inputsByDate: Record<string,ProfitInputs>; unsaved?: boolean}) {
  const calculation=calculateProfitPeriod(options.days,options.inputsByDate);
  if(!calculation.complete)throw new Error('Cần nhập đủ chi phí và cost của tất cả ngày trong kỳ trước khi xuất Excel.');
  const rows=[...calculation.rows].sort((a,b)=>a.date.localeCompare(b.date));
  const workbook=new ExcelJS.Workbook();workbook.creator='TN Services';workbook.created=new Date();workbook.calcProperties.fullCalcOnLoad=true;
  const subtitle=`${options.storeName} · ${dateLabel(options.startDate)} – ${dateLabel(options.endDate)} · Đơn vị: VND${options.unsaved?' · Dữ liệu đang chỉnh sửa, chưa lưu':''}`;
  const summary=sheet(workbook,'Tổng hợp','TN SERVICES | BÁO CÁO LỢI NHUẬN',subtitle,[80,24],['Chỉ tiêu','Giá trị'],true);
  const daily=sheet(workbook,'Theo ngày','CHI TIẾT LỢI NHUẬN THEO NGÀY',subtitle,[15,21,21,21,21,19,19,21,21,21,23,21,23,23,15,13,22,23,23,23,23,23,24],['Ngày','Doanh thu','Giá vốn món','Lương nhân viên','Chi tại quầy','Tiền điện','Tiền nước','Chi phí khác','Marketing','Anh Thiện chi','Tồn kho nguyên liệu','Công nợ','Tổng chi phí','Lợi nhuận ròng','Biên lợi nhuận','Số hóa đơn','Thuế (4,5%)','Lãi gộp ước tính','Lãi ròng','Tiền bàn giao','Lương ước tính (1 ngày)','Thuế (4,5% doanh thu)','Dòng tiền thực về']);
  const costs=sheet(workbook,'Giá vốn món','CHI TIẾT GIÁ VỐN VÀ LÃI GỘP MÓN ĐÃ BÁN',subtitle,[15,21,44,16,23,24,24,26,26],['Ngày','Mã món','Tên món','Số lượng','Cost / món','Tổng giá vốn','Giá thực thu / món','Doanh thu sau giảm giá','Lãi gộp ước tính']);
  const expenses=sheet(workbook,'Các khoản chi','CHI TIẾT CÁC KHOẢN CHI',subtitle,[15,26,27,44,48,23],['Ngày','Loại chi phí','Mã phiếu','Tên / nội dung','Ghi chú','Số tiền']);
  const otherExpenseRefs: {date:string;name:string;amount:number;row:number}[]=[];
  for(const day of rows){
    const n=daily.rowCount+1;const {inputs,result,source}=day;
    const row=bodyRow(daily,[excelDate(day.date),source.revenue,result.materialCost,inputs.salary, result.voucherCost,inputs.electricity,inputs.water,inputs.other,inputs.marketing,inputs.thienExpense,inputs.ingredientInventory,inputs.debt,
      {formula:`SUM(C${n}:D${n},F${n}:J${n})+Q${n}`,result:result.totalCosts},
      {formula:`B${n}-M${n}`,result:result.profit!},
      {formula:`IF(B${n}>0,N${n}/B${n},0)`,result:result.margin===null?0:result.margin/100},source.billCount,
      {formula:`ROUND(B${n}*4.5%,2)`,result:result.tax},
      result.grossProfit,result.netProfit,result.cashReceived,inputs.salary,result.tax,result.cashFlow]);
    for(const col of [18,19,20,21,22,23])row.getCell(col).numFmt=MONEY;
    row.getCell(15).numFmt='0.0%;[Red](0.0%);"—"';row.getCell(16).numFmt='#,##0';
    row.getCell(14).font={name:'Calibri',bold:true,color:{argb:result.profit!<0?'FFB91C1C':GREEN}};
    for(const item of result.costRows){
      const r=costs.rowCount+1;const line=bodyRow(costs,[excelDate(day.date),item.code,item.name,item.quantity,item.unitCost,{formula:`D${r}*E${r}`,result:item.cost!},item.unitSalePrice,item.netSales,item.grossProfit===null?null:{formula:`H${r}-F${r}`,result:item.grossProfit}]);line.getCell(4).numFmt='#,##0.###';
    }
    for(const voucher of source.vouchers)bodyRow(expenses,[excelDate(day.date),'Chi tại quầy',voucher.code,voucher.category,voucher.note||'',voucher.amount]);
    for(const item of profitOtherExpenses(inputs)){
      const expenseRow=bodyRow(expenses,[excelDate(day.date),'Chi phí khác','',item.name,'',item.amount]);
      otherExpenseRefs.push({date:day.date,name:item.name,amount:item.amount!,row:expenseRow.number});
    }
    for(const [key,label] of [['electricity','Tiền điện'],['water','Tiền nước'],['marketing','Marketing'],['thienExpense','Anh Thiện chi']] as const)if(inputs[key])bodyRow(expenses,[excelDate(day.date),label,'',label,'',inputs[key]]);
    if(result.tax)bodyRow(expenses,[excelDate(day.date),'Thuế','','Thuế 4,5% doanh thu','Tự động tính theo doanh thu ngày',result.tax]);
  }
  const total=finish(daily,23,[2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,19,20,21,22,23]);daily.getCell(total,16).numFmt='#,##0';
  for(const [col,key] of [[20,'cashReceived'],[23,'cashFlow']] as const)if(rows.some(day=>day.result[key]===null))daily.getCell(total,col).value=null;
  if(rows.some(day=>day.result.grossProfit===null))daily.getCell(total,18).value=null;
  daily.getCell(total,15).value={formula:`IF(B${total}>0,N${total}/B${total},0)`,result:calculation.margin===null?0:calculation.margin/100};daily.getCell(total,15).numFmt='0.0%';
  const costTotal=finish(costs,9,[6,8,9]);
  if(rows.some(day=>day.result.costRows.some(item=>item.netSales===null)))costs.getCell(costTotal,8).value=null;
  if(rows.some(day=>day.result.costRows.some(item=>item.grossProfit===null)))costs.getCell(costTotal,9).value=null;
  finish(expenses,6,[6]);
  const lines:[string,string][]=[['Doanh thu thuần','B'],['Giá vốn món đã bán','C'],['LÃI GỘP ƯỚC TÍNH','R'],['Lương nhân viên (phân bổ trong ngày)','D'],['Tiền điện','F'],['Tiền nước','G'],['Chi phí khác trong ngày','H'],['Chi phí marketing','I'],['Anh Thiện chi','J'],['Thuế (4,5% doanh thu)','Q'],['TỔNG CHI PHÍ','M'],['LỢI NHUẬN RÒNG','N'],['Biên lợi nhuận','O'],['Tiền thực thu (tiền bàn giao trong hệ thống)','T'],['Chi tại quầy (đã nằm trong bàn giao, không trừ lại)','E'],['Chi phí khác đã trả ngoài bàn giao','H'],['Lương ước tính (1 ngày)','U'],['Thuế (4,5% doanh thu)','V'],['DÒNG TIỀN THỰC VỀ','W'],['Tồn kho nguyên liệu (theo dõi)','K'],['Công nợ nhà cung cấp (theo dõi)','L']];
  for(const [label,col] of lines){
    if(col==='T'){
      const section=bodyRow(summary,['DÒNG TIỀN THỰC TẾ',null]);
      section.height=28;
      section.eachCell({includeEmpty:true},cell=>{cell.fill=fill(GREEN);cell.font={name:'Calibri',bold:true,size:11,color:{argb:GOLD}};});
    }
    const n=summary.rowCount+1;const cached=daily.getCell(`${col}${total}`).result as number;
    bodyRow(summary,[label,typeof cached==='number'?{formula:`'Theo ngày'!${col}${total}`,result:cached}:col==='R'?'Chưa đủ giá bán/cost':'Chưa có bàn giao đã chốt']);summary.getCell(n,2).numFmt=col==='O'?'0.0%':MONEY;
    if(col==='B'){summary.getRow(n).height=30;summary.getRow(n).eachCell(cell=>{cell.font={name:'Calibri',bold:true,size:13,color:{argb:'FF4472C4'}};});}
    if(['M','N','R','W'].includes(col)){const prominent=col==='N'||col==='W';summary.getRow(n).height=34;summary.getRow(n).eachCell({includeEmpty:true},cell=>{cell.fill=fill(prominent?GREEN:PALE);cell.font={name:'Calibri',bold:true,size:prominent?15:12,color:{argb:prominent?GOLD:GREEN}};});}
    if(col==='H'&&label==='Chi phí khác trong ngày')for(const item of otherExpenseRefs){
      const detailRow=bodyRow(summary,[`${rows.length>1?dateLabel(item.date)+' · ':''}${item.name}`,{formula:`'Các khoản chi'!F${item.row}`,result:item.amount}]);
      detailRow.getCell(1).alignment={indent:1,vertical:'middle',wrapText:true};
      detailRow.eachCell({includeEmpty:true},cell=>{cell.font={name:'Calibri',size:10,color:{argb:'FF64748B'}};cell.fill=fill('FFF8FAFC');});
      detailRow.getCell(2).numFmt=MONEY;
    }
  }
  summary.pageSetup.printArea=`A1:B${summary.rowCount}`;
  summary.headerFooter.oddFooter='&LTN Services · Số tiền làm tròn lên 1.000đ; tổng tính từ số gốc&RTrang &P / &N';
  // Keep full precision in an audit sheet; visible results round independently, like the UI.
  const raw=workbook.addWorksheet('Dữ liệu gốc',{state:'hidden'});
  raw.columns=[{header:'Sheet',width:24},{header:'Ô',width:12},{header:'Giá trị gốc',width:24}];
  const preciseTotals: Record<string,number|null>={};
  for(const column of ['B','C','D','F','G','H','I','J','M','N','Q','R']){
    const value=daily.getCell(`${column}${total}`).result;
    preciseTotals[column]=typeof value==='number'?value:null;
  }
  const rawRefs=new Map<string,string>();
  for(const ws of [summary,daily,costs,expenses])ws.eachRow(row=>row.eachCell(cell=>{
    if(cell.numFmt!==MONEY)return;
    const amount=typeof cell.value==='number'?cell.value:typeof cell.result==='number'?cell.result:null;
    if(amount===null)return;
    const source=raw.addRow([ws.name,cell.address,amount]);source.getCell(3).numFmt='#,##0.########';
    rawRefs.set(`${ws.name}!${cell.address}`,`'Dữ liệu gốc'!C${source.number}`);
    cell.value={formula:`CEILING('Dữ liệu gốc'!C${source.number},1000)`,result:Math.ceil(amount/1000)*1000};
  }));
  addProfitAnalysis(summary,preciseTotals,column=>rawRefs.get(`Theo ngày!${column}${total}`)??null);
  summary.pageSetup.printArea=`A1:E${summary.rowCount}`;
  summary.pageSetup.paperSize=8;
  return workbook;
}

export async function exportProfitExcel(options: Parameters<typeof buildProfitWorkbook>[0]) {
  const workbook=buildProfitWorkbook(options);
  const buffer=await workbook.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');link.href=url;link.download=`Loi-nhuan_${options.startDate}_${options.endDate}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
