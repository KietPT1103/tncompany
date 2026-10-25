import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const directory = mkdtempSync(join(tmpdir(), 'shift-management-'));
const code = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import ShiftManagement from './src/components/ShiftManagement.tsx';
const stamp = text => ({seconds:Date.parse(text)/1000});
const source={id:'wrong',storeId:'cafe',cashierUid:'cashier2',cashierName:'Thungan2',shiftType:'shift_2',status:'closed',openingCash:100,openedAt:stamp('2026-10-21T10:43:26Z'),closedAt:stamp('2026-10-22T09:48:21Z')};
const target={...source,id:'correct',cashierName:'Thungan3',shiftType:'shift_3',openedAt:stamp('2026-10-21T10:04:00Z'),closedAt:stamp('2026-10-21T16:00:00Z')};
const bills=[{id:'CF-yesterday',table_number:'T01',total:200,status:'completed',payment_method:'cash',created_at:'2026-10-21 20:00:00'},{id:'CF-today',table_number:'T02',total:300,status:'completed',payment_method:'transfer',created_at:'2026-10-22 14:00:00'}];
let submitted=null,conflict=false,changed=0;
window.confirm=()=>true;
window.fetch=async(url,options={})=>{
 const query=new URL(String(url),'https://test.local').searchParams;
 let data={},ok=true;
 if(query.get('resource')==='shift-management') data={items:[source,target]};
 if(query.get('resource')==='shift-review'&&!options.body) data={shift:source,bills,reviewToken:'version1',vouchers:[{id:'v1',amount:20,voucher_type:'income',happened_at:'2026-10-22 14:00:00',cancelled_at:null,include_in_cash_flow:1}],history:[]};
 if(options.body){
  submitted=JSON.parse(options.body);
  if(conflict)ok=false;
  else {source.openedAt=stamp('2026-10-22T05:55:00Z');bills.splice(0,1);data={updated:true,movedBills:1};}
 }
 return new Response(JSON.stringify({ok,data,error:ok?undefined:'Dữ liệu đã thay đổi. Tải lại ca.'}),{status:ok?200:409,headers:{'Content-Type':'application/json'}});
};
createRoot(document.getElementById('root')).render(<ShiftManagement storeId='cafe' onChanged={()=>changed++}/>);
const checks=[];const check=(name,value)=>checks.push([name,Boolean(value)]);
const wait=(ms=100)=>new Promise(resolve=>setTimeout(resolve,ms));
const button=text=>[...document.querySelectorAll('button')].find(item=>item.textContent.includes(text));
const fill=(element,value)=>{const proto=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));};
(async()=>{
 await wait();button('Quản lý ca').click();await wait(300);
 check('native dialog opens',document.querySelector('dialog').open);
 button('Ca 2 · Thungan2').click();await wait(300);
 check('loads every attached invoice',!!document.querySelector('select[aria-label="Ca đích cho CF-yesterday"]')&&!!document.querySelector('select[aria-label="Ca đích cho CF-today"]'));
 check('Vietnam opening time independent of browser timezone',document.querySelector('input[type="datetime-local"]').value==='2026-10-21T17:43:26');
 fill(document.querySelector('input[type="datetime-local"]'),'2026-10-22T12:55:00');await wait();
 check('flags invoice outside corrected interval',document.querySelector('dialog').textContent.includes('Có 1 hóa đơn và 0 phiếu'));
 const select=document.querySelector('select[aria-label="Ca đích cho CF-yesterday"]');select.value='correct';select.dispatchEvent(new Event('change',{bubbles:true}));await wait();
 fill(document.querySelector('textarea'),'Sửa ca mở nhầm hôm qua');await wait();
 check('cannot save without review acknowledgement',button('Lưu điều chỉnh').disabled);
 document.querySelector('input[type="checkbox"]').click();await wait();button('Lưu điều chỉnh').click();await wait(500);
 check('sends corrected Vietnam time and chosen invoice only',submitted?.openedAt==='2026-10-22 12:55:00'&&submitted?.closedAt==='2026-10-22 16:48:21'&&submitted.transfers.length===1&&submitted.transfers[0].billId==='CF-yesterday'&&submitted.transfers[0].targetShiftId==='correct');
 check('sends reason, review token and acknowledgement',submitted?.reason==='Sửa ca mở nhầm hôm qua'&&submitted?.reviewToken==='version1'&&submitted?.reviewed===true);
 check('refreshes after successful save',changed===1&&!!document.querySelector('[role="status"]')&&document.querySelectorAll('select[aria-label^="Ca đích"]').length===1);
 conflict=true;fill(document.querySelector('textarea'),'Kiểm tra xung đột');await wait();document.querySelector('input[type="checkbox"]').click();await wait();button('Lưu điều chỉnh').click();await wait(300);
 check('server conflict is visible without false success',document.querySelector('[role="alert"]')?.textContent.includes('Dữ liệu đã thay đổi')&&changed===1&&!document.querySelector('[role="status"]'));
 check('page has no horizontal overflow',document.documentElement.scrollWidth<=innerWidth);
 const result=document.createElement('pre');result.id='test-result';result.textContent=JSON.stringify(checks);document.body.append(result);
})().catch(error=>{const result=document.createElement('pre');result.id='test-result';result.textContent=JSON.stringify([['exception '+error.message,false]]);document.body.append(result)});
`;
const bundled=await build({stdin:{contents:code,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve('src')},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const asset=readdirSync('dist/assets').find(name=>name.startsWith('index-')&&name.endsWith('.css'));
const css=readFileSync(join('dist/assets',asset),'utf8');
for(const [width,height] of [[1440,1000],[390,844]]){
 const fixture='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script>'+bundled.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>';
 const escaped=fixture.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const html=join(directory,'index.html');
 writeFileSync(html,'<!doctype html><style>body{margin:0}iframe{border:0}</style><iframe id="frame" style="width:'+width+'px;height:'+height+'px" srcdoc="'+escaped+'"></iframe><script>const timer=setInterval(()=>{const result=document.getElementById("frame").contentDocument.querySelector("#test-result");if(result){clearInterval(timer);const pre=document.createElement("pre");pre.id="test-result";pre.textContent=result.textContent;document.body.append(pre)}},100)</script>');
 const run=spawnSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless','--disable-gpu','--no-sandbox','--disable-extensions','--disable-background-networking','--no-first-run','--user-data-dir='+join(directory,'profile-'+width),'--window-size=1500,1300','--virtual-time-budget=12000','--dump-dom','--screenshot='+join(directory,'shift-'+width+'.png'),new URL('file:///'+resolve(html).replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
 assert.equal(run.status,0,run.stderr);
 const match=run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);
 assert.ok(match,'Browser did not finish checks');
 const checks=JSON.parse(match[1].replaceAll('&amp;','&'));
 console.log(width,checks);assert.ok(checks.every(([,ok])=>ok),'Shift management interaction failed');
}
console.log('Screenshots: '+directory);
