import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as XLSX from 'xlsx';
const source=fs.readFileSync('src/services/excel.ts','utf8').replace('import * as XLSX from "xlsx";','const XLSX=globalThis.invoiceTestXlsx;');
globalThis.invoiceTestXlsx=XLSX;
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {parseInvoiceImportWorkbook}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
globalThis.FileReader=class {readAsArrayBuffer(file){this.onload({target:{result:file.bytes}})}};
async function parse(rows){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Invoices');return parseInvoiceImportWorkbook({bytes:XLSX.write(wb,{type:'array',bookType:'xlsx'})})}
const modern=await parse([['Ngày','Mặt hàng','Số lượng','Đơn vị','Đơn giá','Loại hàng'],['18/10/2026','Gỗ',2,'tấm',100,'Vật liệu'],['18/10/2026','Búa',1,'cái',50,'Dụng cụ']]);
assert.equal(modern.entries[0].items[0].categoryName,'Vật liệu');
assert.equal(modern.entries[1].items[0].categoryName,'Dụng cụ');
const legacy=await parse([['Ngày','Mặt hàng','Số lượng','Đơn vị','Đơn giá'],['18/10/2026','Gỗ',2,'tấm',100]]);
assert.equal(legacy.entries[0].items[0].categoryName,'');
console.log('PASS invoice Excel optional categories and legacy files');

const sampleFile=fs.readdirSync('.').find(name=>name === 'mẫu.xlsx');
if(sampleFile){
 const sample=await parseInvoiceImportWorkbook({bytes:fs.readFileSync(sampleFile)});
 assert.equal(sample.entries.length,11);
 assert.equal(sample.skippedRows,0);
 assert.ok(sample.entries.slice(0,8).every(e=>e.items[0].categoryName==='Sắt - Thép'));
 assert.ok(sample.entries.slice(8).every(e=>e.items[0].categoryName==='Dụng cụ'));
 assert.equal(sample.entries.flatMap(e=>e.items).reduce((s,i)=>s+i.quantity*i.unitPrice,0),10404000);
}
const groups=await parse([['Ngày','Mặt hàng','Số lượng','Đơn vị','Đơn giá'],['','Sắt','','',''],['18/10/2026','Thanh sắt',2,'cây',100],['','Dụng cụ','','',''],['17/10/2026','Búa',1,'cái',50]]);
assert.equal(groups.entries[1].items[0].categoryName,'Dụng cụ');
assert.equal(groups.skippedRows,0);
console.log('PASS sample workbook and category headers after dated rows');
