import test from 'node:test';
import assert from 'node:assert/strict';
import { movements, buildReport, parseRecipes, parseStock, normalize } from '../src/features/kitchen-reconciliation/domain.mjs';
test('gross movements preserve net zero and reject unsupported formulas',()=>{
 assert.deepEqual(movements('=3-3'),{received:3,issued:3});
 assert.deepEqual(movements('=20-3+2-1'),{received:22,issued:4});
 assert.throws(()=>movements('=SUM(A1:A4)')); assert.throws(()=>movements('=3*4'));
});
const fixture=()=>({from:'2026-10-12',to:'2026-10-18',stock:[{name:'Bò',unit:'kg',opening:10,moves:[{date:'2026-10-12',received:0,issued:2},{date:'2026-10-18',received:0,issued:0}]}],recipes:[{id:'beef',name:'Lẩu',source:'Cost',lines:[{name:'Bắp bò',quantity:120,unit:'g',kind:'ingredient'}]}],sales:[{code:'SP1',name:'Lẩu',quantity:10}],saleRules:{SP1:{recipeId:'beef'}},rules:{[normalize('Bắp bò')]:{stockName:'Bò',stage:'raw'}},stockRules:{'Bò':{confirmed:true,yield:0.8}}});
test('raw recipe does not divide by yield and absent counts are unknown',()=>{
 const r=buildReport(fixture());assert.deepEqual(r.problems,[]);assert.equal(r.rows[0].theoretical,1.2);assert.equal(r.rows[0].actual,null);
});
test('prepared counts convert to raw equivalent',()=>{
 const f=fixture();f.counts={'Bò':{rawOpen:0,rawClose:0,preparedOpen:0,preparedClose:0.4}};
 assert.equal(buildReport(f).rows[0].actual,1.5);
});
test('missing conversion blocks finalization',()=>{
 const f=fixture();f.recipes[0].lines[0].unit='viên';assert.ok(buildReport(f).problems.some(p=>p.includes('quy đổi')));
});
test('combo expands fractional sales and detects cycles',()=>{
 const f=fixture();f.recipes.push({id:'combo',name:'Combo',lines:[{kind:'recipe',recipeId:'beef',quantity:2}]});f.saleRules.SP1={recipeId:'combo'};f.sales[0].quantity=0.5;
 assert.equal(buildReport(f).rows[0].theoretical,0.12);
 f.recipes[0].lines=[{kind:'recipe',recipeId:'combo',quantity:1}];assert.ok(buildReport(f).problems.some(p=>p.includes('Vòng lặp')));
});
test('primary recipe wins as whole; fallback supplies missing dishes',()=>{
 const r=parseRecipes({'Cost t10-2026':[['TÊN NGUYÊN LIỆU','SỐ LƯỢNG','ĐVT'],['Lẩu'],['Bò',120,'g'],['Total']],'DS tất cả các món':[['Món','Tên Nguyên Liệu','Định lượng','Đơn Vị'],['Lẩu','Bò',100,'g'],['','Tôm',50,'g'],['Mì','Bò',40,'g']]});
 assert.equal(r.length,2);assert.equal(r[0].lines.length,1);assert.equal(r[0].lines[0].quantity,120);
});
test('opening at period start includes prior days',()=>{
 const stock=parseStock([['Tên Nguyên Liệu','Tồn đầu kỳ','Đơn Vị',new Date('2026-10-11'),new Date('2026-10-12'),new Date('2026-10-18')],['Bò',10,'kg',-2,'=3-3',0]]);
 const r=buildReport({...fixture(),stock});assert.equal(r.rows[0].warehouseOpening,8);assert.equal(r.rows[0].issued,3);assert.equal(r.rows[0].warehouseClosing,8);
});
test('period outside stock coverage blocks; measured batches separate processing difference',()=>{
 const f=fixture();f.to='2026-11-01';assert.ok(buildReport(f).problems.some(p=>p.includes('bao phủ')));
 f.to='2026-10-18';f.batches=[{stockName:'Bò',date:'2026-10-13',input:1,output:.7}];
 assert.ok(Math.abs(buildReport(f).rows[0].processingVariance-.125)<1e-9);
});
test('equivalent dish size aliases share primary source; explicit user correction is traced',()=>{
 const r=parseRecipes({'Cost t10-2026':[['A','B','C'],['Lẩu Tiêm Sa Chủy 4Ng'],['Bắp bò',100,'Gram'],['Total']],'DS tất cả các món':[['A','B','C','D'],['Lẩu tiêm sa chủy (4 người)','Bắp bò',120,'g']]});
 assert.equal(r.length,1);assert.equal(r[0].lines[0].quantity,120);assert.equal(r[0].lines[0].importedQuantity,100);
});
test('prepared stock does not incur processing yield twice',()=>{
 const f=fixture();f.stockRules['Bò'].baseStage='prepared';f.rules['bap bo'].stage='prepared';
 assert.equal(buildReport(f).rows[0].theoretical,1.2);
 f.rules['bap bo'].stage='raw';assert.equal(buildReport(f).rows[0].theoretical,.96);
});
test('xlsx export retains detail, totals, unknown inventory and explicit text safely',async()=>{
 const {reportWorkbook}=await import('../src/features/kitchen-reconciliation/excel.mjs');
 const f=fixture(),report=buildReport(f),w=await reportWorkbook({input:f,report});
 assert.equal(w.worksheets.length,3);
 assert.equal(w.getWorksheet('TONG_HOP').getCell('H5').value,1.2);
 assert.equal(w.getWorksheet('TONG_HOP').getCell('I5').value,null);
 const bytes=await w.xlsx.writeBuffer();const ExcelJS=(await import('exceljs')).default;const reread=new ExcelJS.Workbook();await reread.xlsx.load(bytes);
 assert.equal(reread.getWorksheet('01_Bò').getCell('L5').value,1.2);
 assert.match(reread.getWorksheet('TONG_HOP').getCell('M5').value,/Thiếu kiểm kê/);
});
test('client and PHP server compute the same report for measured and prepared stock',async()=>{
 const {spawnSync}=await import('node:child_process');
 for(const stage of ['raw','prepared']){
  const f=fixture();f.stockRules['Bò'].baseStage=stage;f.rules['bap bo'].stage='prepared';f.counts={'Bò':{rawOpen:.2,rawClose:.1,preparedOpen:.3,preparedClose:.1}};f.batches=[{stockName:'Bò',date:'2026-10-13',input:1,output:.7}];
  const run=spawnSync('php',['-r','require "public/api/_lib/kitchen_reconciliation.php"; echo json_encode(kitchen_report(json_decode(stream_get_contents(STDIN),true)));'],{input:JSON.stringify(f),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);const server=JSON.parse(run.stdout),client=buildReport(f);
  for(const key of ['theoretical','actual','variance','processingVariance'])assert.ok(Math.abs(server.rows[0][key]-client.rows[0][key])<1e-9,key);
 }
});
