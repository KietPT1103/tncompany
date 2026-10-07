import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildInventoryStockWorkbook } from './inventoryStockExport.ts';
const item={ingredientCode:'NL01',ingredientName:'Cà phê',supplierName:'NCC',unit:'g',purchaseUnit:'kg',purchaseToBaseFactor:1000,cost:200,stockQuantity:3000,periodReceivedQuantity:4,periodIssuedQuantity:2,periodReceivedAmount:720000};
const period={storeId:'cafe',from:'2026-10-01',to:'2026-10-08'};
test('three sheets preserve all ingredients including zero movements and converted stock',()=>{
 const zero={...item,ingredientCode:'NL02',periodReceivedQuantity:0,periodIssuedQuantity:0,periodReceivedAmount:0,stockQuantity:500};
 const book=buildInventoryStockWorkbook([item,zero],period);
 assert.deepEqual(book.worksheets.map(sheet=>sheet.name),['Nhập xuất tồn','Tổng nhập','Tổng xuất']);
 const stock=book.worksheets[0];assert.equal(stock.getCell('G7').value,3);assert.equal(stock.getCell('H7').value,200000);assert.deepEqual(stock.getCell('I7').value,{formula:'ROUND(G7*H7,2)',result:600000});
 for(const sheet of book.worksheets)assert.equal(sheet.getCell('A8').value,'NL02');
 assert.equal(book.worksheets[1].getCell('E8').value,0);assert.equal(book.worksheets[2].getCell('E8').value,0);
 assert.deepEqual(stock.getCell('I9').value,{formula:'SUM(I7:I8)',result:700000});
 assert.deepEqual(book.worksheets[1].getCell('F9').value,{formula:'SUM(F7:F8)',result:720000});
 assert.deepEqual(book.worksheets[2].getCell('G9').value,{formula:'SUM(G7:G8)',result:400000});
});
test('xlsx roundtrip retains numeric amounts, cached formula totals and rows beyond one page',async()=>{
 const items=Array.from({length:35},(_,index)=>({...item,ingredientCode:'NL'+index}));
 const source=buildInventoryStockWorkbook(items,period);const bytes=await source.xlsx.writeBuffer();
 const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
 assert.equal(book.worksheets[0].getCell('A41').value,'NL34');
 assert.equal(book.worksheets[0].getCell('I42').result,21000000);
 assert.equal(book.worksheets[1].getCell('F42').result,25200000);
 assert.equal(book.worksheets[2].getCell('G42').result,14000000);
 assert.equal(book.worksheets[1].getCell('F7').type,ExcelJS.ValueType.Number);
});
test('empty report and missing costs produce valid zero totals without circular sums',()=>{
 const empty=buildInventoryStockWorkbook([],period);
 for(const sheet of empty.worksheets)assert.equal(sheet.getCell(7,sheet.columnCount).value,0);
 const book=buildInventoryStockWorkbook([{...item,cost:null}],period);
 assert.equal(book.worksheets[0].getCell('I7').result,0);
 assert.equal(book.worksheets[1].getCell('F7').value,720000);
});
