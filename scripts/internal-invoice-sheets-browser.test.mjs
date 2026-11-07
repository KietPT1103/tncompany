import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const directory=resolve('artifacts/internal-invoice-sheets');mkdirSync(directory,{recursive:true});
const code=`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Seller from './src/app/(dashboard)/_components/InternalInvoicePartnerInput';
import Sync from './src/app/(dashboard)/_components/InternalInvoiceSheetSync';
const requests=[];let refreshes=0;
window.fetch=async(url,options={})=>{requests.push({url:String(url),options});return new Response(JSON.stringify({ok:true,data:String(url).includes('partners')?{items:['Chiêu Thuỷ','Nhà cung cấp cũ']}:{spreadsheetUrl:'https://docs.google.com/spreadsheets/d/test/edit',lastAttemptAt:1794096000,lastSyncedAt:null,result:{created:1,updated:0,unchanged:2,tabs:1,errors:['Tuần 1 · dòng 4: Thiếu đơn giá']}}}),{status:200})};
function App(){const [seller,setSeller]=useState('');return <div className="p-4"><div className="mb-5 max-w-sm"><Seller value={seller} onChange={setSeller}/></div><Sync onSynced={()=>refreshes++}/></div>}
createRoot(document.getElementById('root')).render(<App/>);
const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));const checks=[];const check=(name,value)=>checks.push([name,!!value]);
(async()=>{
await wait(500);const input=document.querySelector('[role=combobox]');input.focus();await wait(400);
check('historical seller suggestions visible',document.querySelectorAll('[role=option]').length===2);
input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await wait(30);input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(50);
check('keyboard selects seller',input.value==='Chiêu Thuỷ' && input.getAttribute('aria-expanded')==='false');
check('automatic sync and refresh',requests.some(r=>r.options.body&&JSON.parse(r.options.body).automatic===true)&&refreshes===1);
check('sync counts and row errors visible',document.body.textContent.includes('1 hóa đơn mới')&&document.body.textContent.includes('Tuần 1 · dòng 4'));
document.querySelector('button').click();await wait(200);
check('manual sync requested',requests.some(r=>r.options.body&&JSON.parse(r.options.body).automatic===false));
check('no horizontal overflow',document.documentElement.scrollWidth<=innerWidth);
input.focus();await wait(300);input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(30);
check('escape closes suggestions',input.getAttribute('aria-expanded')==='false');
const p=document.createElement('pre');p.id='test-result';p.textContent=JSON.stringify(checks);document.body.append(p);
})().catch(e=>{const p=document.createElement('pre');p.id='test-result';p.textContent=JSON.stringify([['exception '+e.stack,false]]);document.body.append(p)});
`;
const bundle=await build({stdin:{contents:code,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve('src')},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const css=readFileSync(join('dist/assets',readdirSync('dist/assets').find(n=>n.startsWith('index-')&&n.endsWith('.css'))),'utf8');
for(const width of [390,1440]){
  const fixture='<!doctype html><meta charset="utf-8"><style>#test-result{display:none}'+css+'</style><div id="root"></div><script>'+bundle.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>';
  const escaped=fixture.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const file=join(directory,'sync-'+width+'.html');
  writeFileSync(file,'<!doctype html><style>body{margin:0}iframe{border:0}#test-result{display:none}</style><iframe id="frame" style="width:'+width+'px;height:900px" srcdoc="'+escaped+'"></iframe><script>const timer=setInterval(()=>{const result=document.getElementById("frame").contentDocument.querySelector("#test-result");if(result){clearInterval(timer);const p=document.createElement("pre");p.id="test-result";p.textContent=result.textContent;document.body.append(p)}},100)</script>');
  const run=spawnSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless','--disable-gpu','--no-sandbox','--disable-extensions','--disable-background-networking','--no-first-run','--user-data-dir='+join(directory,'profile-'+width),'--window-size=1500,1100','--virtual-time-budget=6000','--dump-dom','--screenshot='+join(directory,'sync-'+width+'.png'),new URL('file:///'+resolve(file).replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
  assert.equal(run.status,0,run.stderr);const match=run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);assert.ok(match,'Browser did not finish');const checks=JSON.parse(match[1].replaceAll('&amp;','&'));console.log(width,checks);assert.ok(checks.every(([,ok])=>ok),'Sheet sync UI failed');
}
console.log('PASS seller keyboard selection and automatic/manual sync UI; screenshots: '+directory);
