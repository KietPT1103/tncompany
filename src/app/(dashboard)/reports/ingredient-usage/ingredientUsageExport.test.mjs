import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { createIngredientUsageWorkbook } from './ingredientUsageExport.ts';
const report = { sales: [{code:'001',name:'Cà phê',unit:'',quantity:2.5,pendingQuantity:1}], ingredients:[{code:'NL1',name:'Đường',unit:'kg',quantity:0.125}],totalSoldQuantity:2.5,pendingQuantity:1 };
for (const tab of ['sales','ingredients']) {
 const book=createIngredientUsageWorkbook(report,tab,{from:'2026-11-01',to:'2026-11-04',storeName:'Cafe'});
 const restored=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 assert.equal(restored.SheetNames.length,1);
 const rows=XLSX.utils.sheet_to_json(restored.Sheets[restored.SheetNames[0]],{header:1});
 assert.ok(rows.flat().includes('Chi nhánh: Cafe'));
 assert.ok(rows.flat().includes('Từ ngày 01/11/2026 đến ngày 04/11/2026'));
 if(tab==='sales') {
  assert.deepEqual(rows[5],['Tổng số món bán','','',2.5,1]);
  assert.deepEqual(rows[6],['001','Cà phê','Chưa có đơn vị',2.5,1]);
  assert.ok(!rows.flat().includes('Đường'));
 } else {
  assert.equal(rows[4].length,4);
  assert.deepEqual(rows[5],['NL1','Đường','kg',0.125]);
  assert.ok(!rows.flat().includes('Cà phê'));
 }
}
assert.equal(createIngredientUsageWorkbook({...report,ingredients:[]},'ingredients',{from:'2026-11-01',to:'2026-11-04',storeName:'Cafe'}).SheetNames.length,1);
console.log('Active-tab XLSX round-trip checks passed');
