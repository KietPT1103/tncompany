import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = `
import React from 'react';import {createRoot} from 'react-dom/client';
import ClosedShiftHistory from './src/features/stores/ClosedShiftHistory';
let calls=0,printed='';const report={storeId:'cart',storeName:'Xe',businessDate:'2026-11-13',shiftId:'s1',shiftNumber:2,isFinalShift:true,openedAt:'2026-11-13 18:00:00',closedAt:'2026-11-14 01:00:00',openingCash:100000,closingCash:300000,cashierName:'Thu ngân',note:'',summary:{totalSales:500000,cashSales:200000,transferSales:300000,incomeVouchers:0,expenseVouchers:0,expectedClosingCash:300000},cycle:null};
window.historyRequest=async(resource,options,params)=>{calls++;if(params.storeId!=='cart'||params.closedHistory!==1)throw new Error('Wrong request scope');return {items:[{...report,shiftId:params.offset?'s2':'s1'}],hasMore:!params.offset};};
createRoot(document.getElementById('root')).render(<ClosedShiftHistory storeId="cart" onPrint={html=>{printed=html;}}/>);
const wait=()=>new Promise(r=>setTimeout(r,150));const checks=[];const check=(name,ok)=>{checks.push([name,!!ok]);if(!ok)throw new Error(name);};
const btn=text=>[...document.querySelectorAll('button')].find(button=>button.textContent.includes(text));
(async()=>{await wait();check('history starts collapsed without fetching',calls===0&&!document.querySelector('section'));
btn('Ca đã kết').click();await wait();check('button opens history',calls===1&&!!document.querySelector('details'));
document.querySelector('summary').click();await wait();check('expanded history shows amounts and time',document.querySelector('details').open&&document.body.textContent.includes('500.000')&&document.body.textContent.includes('2026-11-14 01:00:00'));
btn('In lại phiếu').click();check('reprint uses selected closed report',printed.includes('PHIẾU KẾT CA CUỐI NGÀY')&&printed.includes('s1'));
btn('Xem thêm').click();await wait();check('older sessions append',document.querySelectorAll('details').length===2&&calls===2);
btn('Ca đã kết').click();await wait();check('history can collapse',!document.querySelector('section'));
const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify(checks);document.body.append(pre);
})().catch(error=>{const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify([...checks,[error.stack,false]]);document.body.append(pre);});
`;
const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, plugins: [{ name: 'history-api', setup(builder) {
  builder.onResolve({ filter: /services\/posApi$/ }, () => ({ path: 'api', namespace: 'fixture' }));
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const posRequest=(...args)=>window.historyRequest(...args);', loader: 'js' }));
} }] });
const directory = mkdtempSync(join(tmpdir(), 'closed-shift-ui-'));
const path = join(directory, 'index.html');
writeFileSync(path, '<!doctype html><meta charset="utf-8"><div id="root"></div><script>' + bundle.outputFiles[0].text.replaceAll('</script', '<\\/script') + '</script>');
const run = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-sandbox', '--user-data-dir='+join(directory,'profile'), '--virtual-time-budget=6000', '--dump-dom', new URL('file:///'+path.replaceAll('\\','/')).href], { encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024, windowsHide: true });
assert.equal(run.status,0,run.stderr);
const result=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(result,'Browser checks did not finish');
const checks=JSON.parse(result[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));assert.deepEqual(checks.filter(([,ok])=>!ok),[]);
console.log('PASS closed shift history UI ('+checks.length+' checks)');
