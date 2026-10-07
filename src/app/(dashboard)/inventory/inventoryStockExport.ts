import ExcelJS from "exceljs";
import type { Ingredient } from "@/services/ingredients";

type StockIngredient = Pick<Ingredient, "ingredientCode" | "ingredientName" | "supplierName" | "unit" | "purchaseUnit" | "purchaseToBaseFactor" | "cost" | "stockQuantity" | "periodReceivedQuantity" | "periodIssuedQuantity" | "periodReceivedAmount">;
export type StockExportPeriod = { storeId: string; from: string; to: string };
const numeric = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0;
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const moneyFormat = '#,##0.00 "₫";[Red](#,##0.00) "₫"';

export function buildInventoryStockWorkbook(items: readonly StockIngredient[], period: StockExportPeriod) {
  const book = new ExcelJS.Workbook();
  book.creator = "TN Services";
  book.created = new Date();
  book.calcProperties.fullCalcOnLoad = true;
  const source = items.map(item => {
    const factor = item.purchaseToBaseFactor > 0 ? item.purchaseToBaseFactor : 1;
    const cost = numeric(item.cost) * factor;
    const remaining = numeric(item.stockQuantity) / factor;
    return { code: item.ingredientCode, name: item.ingredientName, supplier: item.supplierName || "Chưa gán", unit: item.purchaseUnit || item.unit || "", received: numeric(item.periodReceivedQuantity), issued: numeric(item.periodIssuedQuantity), cost, remaining, receivedAmount: numeric(item.periodReceivedAmount), issuedAmount: roundMoney(numeric(item.periodIssuedQuantity) * cost), remainingAmount: roundMoney(remaining * cost) };
  });
  const definitions = [
    { name: "Nhập xuất tồn", headers: ["Mã NL", "Tên nguyên liệu", "Nhà phân phối", "Đơn vị", "Tổng xuất", "Tổng nhập", "Còn lại hiện tại", "Giá vốn / đơn vị", "Tổng tiền còn lại"], widths: [16,36,30,14,18,18,20,24,26], moneyColumns: [8,9], rows: source.map(item=>[item.code,item.name,item.supplier,item.unit,item.issued,item.received,item.remaining,item.cost,item.remainingAmount]), total: source.reduce((sum,item)=>sum+item.remainingAmount,0) },
    { name: "Tổng nhập", headers: ["Mã NL", "Tên nguyên liệu", "Nhà phân phối", "Đơn vị", "Tổng nhập", "Tổng tiền nhập"], widths: [16,36,30,14,18,26], moneyColumns: [6], rows: source.map(item=>[item.code,item.name,item.supplier,item.unit,item.received,item.receivedAmount]), total: source.reduce((sum,item)=>sum+item.receivedAmount,0) },
    { name: "Tổng xuất", headers: ["Mã NL", "Tên nguyên liệu", "Nhà phân phối", "Đơn vị", "Tổng xuất", "Giá vốn hiện tại / đơn vị", "Tổng tiền xuất"], widths: [16,36,30,14,18,28,26], moneyColumns: [6,7], rows: source.map(item=>[item.code,item.name,item.supplier,item.unit,item.issued,item.cost,item.issuedAmount]), total: source.reduce((sum,item)=>sum+item.issuedAmount,0) },
  ];
  for (const definition of definitions) {
    const sheet = book.addWorksheet(definition.name, { views: [{ state: "frozen", ySplit: 6 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const count = definition.headers.length;
    sheet.columns = definition.widths.map(width=>({width}));
    for (let row=1;row<=4;row++) sheet.mergeCells(row,1,row,count);
    sheet.getCell("A1").value = definition.name.toLocaleUpperCase("vi-VN");
    sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF065F46" } };
    sheet.getCell("A2").value = "Kho: " + period.storeId + " · Kỳ nhập/xuất: " + period.from + " – " + period.to;
    sheet.getCell("A3").value = definition.name === "Tổng nhập" ? "Tiền nhập theo thành tiền các phiếu đã hoàn thành. Bao gồm nguyên liệu không phát sinh." : "Tiền xuất và tiền còn lại tính theo giá vốn hiện tại. Tồn còn lại là tồn hiện tại, không phải tồn cuối kỳ.";
    sheet.getCell("A3").alignment = { wrapText: true }; sheet.getRow(3).height = 32;
    sheet.getCell("A4").value = "Xuất lúc: " + new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "medium" }).format(book.created);
    sheet.getRow(6).values = definition.headers;
    sheet.getRow(6).height = 32;
    sheet.getRow(6).eachCell(cell=>{ cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF065F46"}};cell.alignment={vertical:"middle",wrapText:true}; });
    for (let index=0;index<definition.rows.length;index++) {
      const row = sheet.getRow(index+7); row.values = definition.rows[index];
      for(let column=5;column<=count;column++) row.getCell(column).numFmt = definition.moneyColumns.includes(column) ? moneyFormat : '#,##0.###';
      if(definition.name === "Nhập xuất tồn") row.getCell(9).value = { formula: "ROUND(G" + row.number + "*H" + row.number + ",2)", result: source[index].remainingAmount };
      if(definition.name === "Tổng xuất") row.getCell(7).value = { formula: "ROUND(E" + row.number + "*F" + row.number + ",2)", result: source[index].issuedAmount };
      if(index % 2 === 1) row.eachCell(cell=>{cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF0FDF4"}}});
    }
    const totalRow = sheet.getRow(source.length+7);
    sheet.mergeCells(totalRow.number,1,totalRow.number,count-1); totalRow.getCell(1).value = "TỔNG TIỀN";
    const letter = sheet.getColumn(count).letter;
    totalRow.getCell(count).value = source.length ? { formula: "SUM(" + letter + "7:" + letter + (source.length+6) + ")", result: roundMoney(definition.total) } : 0;
    totalRow.getCell(count).numFmt = moneyFormat;
    totalRow.eachCell(cell=>{cell.font={bold:true,color:{argb:"FF065F46"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFD1FAE5"}}});
    sheet.autoFilter = {from:{row:6,column:1},to:{row:Math.max(6,source.length+6),column:count}};
  }
  return book;
}
export async function exportInventoryStock(items: readonly StockIngredient[], period: StockExportPeriod) {
  const bytes = await buildInventoryStockWorkbook(items, period).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([bytes], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  const anchor = document.createElement("a"); anchor.href=url; anchor.download="nhap-xuat-ton-"+period.storeId+"-"+period.from+"-"+period.to+".xlsx";
  document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
