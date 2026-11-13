import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AccountEditorModal} from './src/features/accounts/account-management-ui';
import {takeawayShiftReportHtml} from './src/features/stores/takeawayShiftReport';
import {isPreviousDayShift} from './src/lib/shiftDay';
const checks=[];const check=(name,ok)=>{checks.push([name,!!ok]);if(!ok)throw new Error(name);};
const wait=()=>new Promise(resolve=>setTimeout(resolve,150));
const initial={email:'cashier@example.test',username:'cashier',displayName:'Cashier',password:'',role:'user',storeId:'cart',storeIds:['cart'],isActive:true,permissions:['bills.access'],takeawayShiftAssignments:{}};
function App(){const [form,setForm]=useState(initial);const [admin,setAdmin]=useState(true);window.form=form;return <><button id="readonly" onClick={()=>setAdmin(false)}>Read only</button><AccountEditorModal open editingId="u" form={form} canManageAccess={admin} saving={false} error="" onClose={()=>{}} onChange={patch=>setForm(current=>({...current,...patch}))} onRoleChange={()=>{}} onSave={()=>{window.saved=form;}}/></>;}
createRoot(document.getElementById('root')).render(<App/>);
(async()=>{
 await wait();const select=document.querySelector('select[aria-label="Ca take away tại Xe"]');
 check('account editor lists all configured slots',select&&select.options.length===13);
 check('final slot is labeled',select.options[10].textContent==='Ca 10 · Ca cuối');
 select.value='10';select.dispatchEvent(new Event('change',{bubbles:true}));await wait();check('account assignment uses numeric slot',window.form.takeawayShiftAssignments.cart===10);
 document.getElementById('readonly').click();await wait();check('non-admin cannot change assignment',document.querySelector('select[aria-label="Ca take away tại Xe"]').disabled);
 const shift={id:'s',openedAt:{seconds:Date.parse('2026-11-12T16:00:00Z')/1000},businessCycleId:'cycle'};
 check('configured shift continues after midnight',!isPreviousDayShift(shift,new Date('2026-11-12T18:00:00Z')));
 check('legacy overnight review still works',isPreviousDayShift({...shift,businessCycleId:null},new Date('2026-11-12T18:00:00Z')));
 const summary={totalSales:500,cashSales:200,transferSales:300,incomeVouchers:0,expenseVouchers:0,expectedClosingCash:300};
 const report={storeName:'<Xe>',storeId:'cart',businessDate:'2026-11-12',shiftId:'s',shiftNumber:10,isFinalShift:true,openedAt:'2026-11-12 23:00:00',closedAt:'2026-11-13 01:00:00',openingCash:100,closingCash:300,cashierName:'A&B',note:'<script>bad</script>',summary,cycle:{...summary,shifts:Array.from({length:12},(_,i)=>({number:i+1,worked:i!==10,actualHandover:i===9?200:0})),expectedHandover:200,actualHandover:200,difference:0}};
 const html=takeawayShiftReportHtml(report);const doc=new DOMParser().parseFromString(html,'text/html');
 check('final report covers business day and real close time',doc.body.textContent.includes('2026-11-12')&&doc.body.textContent.includes('2026-11-13 01:00:00')&&doc.body.textContent.includes('PHIẾU KẾT CA CUỐI NGÀY'));
 check('report prints dynamic slots beyond three',doc.body.textContent.includes('Ca 10')&&doc.body.textContent.includes('Ca 12')&&doc.body.textContent.includes('Ca 11 · Chưa phát sinh'));
 check('print escapes store cashier and notes',!doc.querySelector('script')&&doc.body.textContent.includes('<Xe>')&&doc.body.textContent.includes('A&B'));
 const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify(checks);document.body.append(pre);
})().catch(error=>{const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify([...checks,[error.stack,false]]);document.body.append(pre);});
`;
const bundled = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
  alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  plugins: [{ name: 'account-store-fixture', setup(builder) {
    builder.onResolve({ filter: /context\/StoreContext$/ }, () => ({ path: 'stores', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const useStore=()=>({stores:[{id:'cart',name:'Xe',isActive:true,isTakeAway:true,takeawayShiftEnabled:true,takeawayShiftCount:12,takeawayFinalShift:10}]});`, loader: 'js' }));
  } }],
});
const directory = mkdtempSync(join(tmpdir(), 'takeaway-shift-ui-'));
const html = join(directory, 'index.html');
writeFileSync(html, '<!doctype html><meta charset="utf-8"><div id="root"></div><script>' + bundled.outputFiles[0].text.replaceAll('</script', '<\\/script') + '</script>');
const run = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-sandbox', '--disable-extensions', '--user-data-dir=' + join(directory, 'profile'), '--virtual-time-budget=5000', '--dump-dom', new URL('file:///' + html.replaceAll('\\', '/')).href], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
assert.equal(run.status, 0, run.stderr);
const result = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
assert.ok(result, 'Browser checks did not complete');
const checks = JSON.parse(result[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
assert.deepEqual(checks.filter(([, ok]) => !ok), []);
console.log('PASS takeaway account and closing print UI (' + checks.length + ' checks)');
