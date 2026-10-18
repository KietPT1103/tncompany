import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const directory = mkdtempSync(join(tmpdir(), 'ingredient-usage-'));
const code = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Page from './src/app/(dashboard)/reports/ingredient-usage/page.tsx';
import {StoreProvider} from './src/context/StoreContext.tsx';
localStorage.setItem('selected_store_id','restaurant');
let synced=false;
const requests=[];
window.fetch=async (url, options) => {
  requests.push([String(url),options.method,options.body]);
  if(options.method==='POST') {synced=true;return new Response(JSON.stringify({ok:true,data:{saved:1,errors:[],nextCursor:null}}));}
  return new Response(JSON.stringify({ok:true,data:{sales:[{code:'CF',name:'Coffee',unit:'ly',quantity:7,pendingQuantity:synced?0:2}],ingredients:[{code:'NL1',name:'Coffee beans',unit:'g',quantity:synced?140:100}],totalSoldQuantity:7,pendingQuantity:synced?0:2}}));
};
const checks=[];
const check=(label,value)=>checks.push([label,Boolean(value)]);
const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
createRoot(document.getElementById('root')).render(<StoreProvider><Page/></StoreProvider>);
(async()=>{
  for(let i=0;i<20&&!document.querySelector('tbody');i++)await wait();
  check('sold tab renders quantity and unit',document.querySelector('tbody')?.textContent.includes('ly')&&document.querySelector('tbody')?.textContent.includes('Coffee'));
  const params=new URL(requests[0][0],'http://localhost').searchParams;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  check('defaults to today and active store',params.get('from')===today&&params.get('to')===today&&params.get('storeId')==='restaurant');
  check('pending formula warning shown',document.body.textContent.includes('chưa lưu công thức'));
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Nguyên liệu đã dùng').click();await wait();
  check('second tab renders ingredient totals',document.querySelector('tbody')?.textContent.includes('Coffee beans')&&document.querySelector('tbody')?.textContent.includes('100'));
  [...document.querySelectorAll('button')].find(b=>b.textContent==='Đồng bộ theo công thức hiện tại').click();
  for(let i=0;i<20&&!document.querySelector('tbody')?.textContent.includes('140');i++)await wait();
  check('sync refreshes report',document.querySelector('tbody')?.textContent.includes('140'));
  const posted=JSON.parse(requests.find(r=>r[1]==='POST')[2]);
  check('sync uses active scope',posted.storeId==='restaurant'&&posted.from===today&&posted.to===today);
  check('sync disabled once complete',[...document.querySelectorAll('button')].find(b=>b.textContent==='Đồng bộ theo công thức hiện tại')?.disabled);
  check('viewport has no page overflow',document.documentElement.scrollWidth<=innerWidth);
  const result=document.createElement('pre');result.id='test-result';result.textContent=JSON.stringify(checks);document.body.append(result);
})().catch(e=>{const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify([['exception '+e.message,false]]);document.body.append(pre)});
`;
const bundled = await build({stdin:{contents:code,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve('src')},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const asset = readdirSync('dist/assets').find(name => name.startsWith('index-') && name.endsWith('.css'));
assert.ok(asset,'Run npm run build first');
const css=readFileSync(join('dist/assets',asset),'utf8');
const html=join(directory,'index.html');
for(const [width,height] of [[1280,900],[390,844]]) {
  const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundled.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`;
  const escaped=fixture.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  writeFileSync(html,`<!doctype html><style>body{margin:0}iframe{border:0}</style><iframe id="frame" style="width:${width}px;height:${height}px" srcdoc="${escaped}"></iframe><script>const timer=setInterval(()=>{const result=document.getElementById('frame').contentDocument.querySelector('#test-result');if(result){clearInterval(timer);const pre=document.createElement('pre');pre.id='test-result';pre.textContent=result.textContent;document.body.append(pre)}},100)</script>`);
  const run=spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${join(directory,`profile-${width}`)}`,'--window-size=1400,1100','--virtual-time-budget=5000','--dump-dom',`--screenshot=${join(directory,`usage-${width}.png`)}`,new URL('file:///'+resolve(html).replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
  assert.equal(run.status,0,run.stderr);
  const match=run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);
  assert.ok(match,'Browser did not finish report interaction checks');
  const checks=JSON.parse(match[1].replaceAll('&amp;','&'));
  console.log(`${width}x${height}`,checks);
  assert.ok(checks.every(([,ok])=>ok),'Usage report interaction failed');
}
console.log('Screenshots: '+directory);