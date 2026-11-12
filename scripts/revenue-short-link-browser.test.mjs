import { build } from 'esbuild';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const directory = resolve('artifacts/revenue-short-link');
mkdirSync(directory, { recursive: true });
const source = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Routes, Route, useLocation, useNavigate} from 'react-router-dom';
import RevenueLinkPage from './src/features/revenue/RevenueLinkPage';
import RevenueAccessGate from './src/features/revenue/RevenueAccessGate';
import RevenueAccessCode from './src/features/outside-expenses/RevenueAccessCode';
const checks=[];
const check=(name,ok)=>{checks.push([name,!!ok]);if(!ok)throw new Error(name);};
const wait=()=>new Promise(r=>setTimeout(r,180));
const token='a'.repeat(64), validLink='AbCdEf012345_-xy';
let activeToken=token;
let mode='valid', exchanges=0, adminCalls=0, copyValue='', pending;
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copyValue=value;}}});
window.fetch=async (url,options)=>{
 const body=options.body?JSON.parse(options.body):{};
 if(String(url).includes('revenue-access-code.php')){
  adminCalls++;check('admin sends link action',body.action==='link');
  return new Response(JSON.stringify(mode==='admin-fail'?{ok:false,error:'Không tạo được link.'}:{ok:true,data:{path:'/d/'+validLink}}),{status:mode==='admin-fail'?502:200});
 }
 if(options.method==='POST'){
  if(body.code){activeToken='b'.repeat(64);return new Response(JSON.stringify({ok:true,data:{token:activeToken}}));}
  exchanges++;check('exchange sends only the short link',body.link===validLink&&body.code===undefined);
  if(mode==='pending')await new Promise(r=>{pending=r;});
  if(mode==='network')throw new TypeError('Network unavailable');
  if(mode==='invalid')return new Response(JSON.stringify({ok:false,error:'Link không hợp lệ hoặc đã được thay mới.'}),{status:403});
  activeToken=token;return new Response(JSON.stringify({ok:true,data:{token}}));
 }
 return new Response(JSON.stringify({ok:true,data:{unlocked:new Headers(options.headers).get('Authorization')==='Bearer '+activeToken}}));
};
function Position(){const location=useLocation(),navigate=useNavigate();return <><output id="path">{location.pathname}</output><button onClick={()=>navigate(-1)}>Back</button><button onClick={()=>navigate('/before')}>Leave</button></>;}
function App(){const [generation,setGeneration]=useState(0);return <><Position/><button onClick={()=>setGeneration(v=>v+1)}>Remount gate</button><Routes><Route path="/d/:link" element={<RevenueLinkPage/>}/><Route path="/doanh-thu" element={<RevenueAccessGate key={generation}>{()=> <div id="report">Revenue report</div>}</RevenueAccessGate>}/><Route path="/before" element={<div>Before</div>}/></Routes></>;}
let root;
async function mount(){root=createRoot(document.getElementById('root'));root.render(<MemoryRouter initialEntries={['/before','/d/'+validLink]} initialIndex={1}><App/></MemoryRouter>);await wait();}
const btn=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
async function unmount(){root.unmount();await wait();}
(async()=>{
 localStorage.clear();await mount();
 check('fresh browser automatically opens reports',!!document.getElementById('report')&&!document.querySelector('input'));
 check('success removes secret from route',document.getElementById('path').textContent==='/doanh-thu');
 check('browser remembers exchanged token',localStorage.getItem('tn_revenue_access_token')===token);
 activeToken='b'.repeat(64);btn('Remount gate').click();await wait();check('revoked link session locks on remount',!!document.querySelector('input[type="password"]'));
 const input=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Current-Code-123');input.dispatchEvent(new Event('input',{bubbles:true}));await wait();document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait();check('shared code can replace a revoked link session',!!document.getElementById('report'));
 btn('Remount gate').click();await wait();check('replacement code session survives a remount',!!document.getElementById('report')&&localStorage.getItem('tn_revenue_access_token')===activeToken);
 btn('Back').click();await wait();check('secret route is replaced in history',document.getElementById('path').textContent==='/before');await unmount();
 mode='invalid';await mount();check('revoked link does not fall back to remembered token',!!document.querySelector('[role="alert"]')&&!document.getElementById('report'));await unmount();
 localStorage.clear();mode='network';await mount();check('network failure offers retry',!!btn('Thử lại'));mode='valid';btn('Thử lại').click();await wait();await wait();check('retry opens reports',!!document.getElementById('report'));await unmount();
 localStorage.clear();const storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('Storage blocked');};await mount();check('blocked storage still allows this visit',!!document.getElementById('report'));Storage.prototype.setItem=storageSet;await unmount();
 localStorage.clear();mode='pending';await mount();btn('Leave').click();await wait();pending();await wait();check('stale response cannot navigate after leaving',document.getElementById('path').textContent==='/before');await unmount();
 mode='valid';root=createRoot(document.getElementById('root'));root.render(<RevenueAccessCode/>);await wait();btn('Tạo link xem doanh thu').click();await wait();
 const link=document.querySelector('[data-revenue-share-link]');check('admin receives a short full URL',link?.textContent===location.origin+'/d/'+validLink);
 check('admin controls fit viewport',document.documentElement.scrollWidth<=innerWidth);
 btn('Sao chép link').click();await wait();check('copy button copies full URL',copyValue===location.origin+'/d/'+validLink);
 mode='admin-fail';btn('Tạo link xem doanh thu').click();await wait();check('failed generation clears stale displayed link',!document.querySelector('[data-revenue-share-link]')&&!!document.querySelector('[role="alert"]'));
 root.unmount();check('browser tests exercised exchanges and rotations',exchanges>=5&&adminCalls===2);
 const result=document.createElement('pre');result.id='test-result';result.textContent=JSON.stringify(checks);document.body.append(result);
})().catch(e=>{const result=document.createElement('pre');result.id='test-result';result.textContent=JSON.stringify([...checks,['exception '+e.stack,false]]);document.body.append(result);});
`;
const bundled = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
const asset = readdirSync('dist/assets').find(name => name.startsWith('index-') && name.endsWith('.css'));
const css = readFileSync(join('dist/assets', asset), 'utf8');
// Serve the fixtures with a real origin: file/srcdoc origins cannot build share URLs.
const fixtures = new Map();
const server = createServer((request, response) => {
  const html = fixtures.get(request.url);
  response.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html || 'Not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
try {
for (const width of [360, 1440]) {
  const fixture = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>#test-result{display:none}' + css + '</style><div id="root"></div><script>window.addEventListener("error",event=>{const result=document.createElement("pre");result.id="test-result";result.textContent=JSON.stringify([[event.message,false]]);document.body.append(result);});</script><script>' + bundled.outputFiles[0].text.replaceAll('</script', '<\\/script') + '</script>';
  const html = join(directory, `test-${width}.html`);
  fixtures.set('/fixture-' + width, fixture);
  const wrapper = '<!doctype html><style>body{margin:0}iframe{border:0}</style><iframe id="frame" style="width:' + width + 'px;height:1000px" src="/fixture-' + width + '"></iframe><script>const timer=setInterval(()=>{const p=document.getElementById("frame").contentDocument.querySelector("#test-result");if(p){clearInterval(timer);const pre=document.createElement("pre");pre.id="test-result";pre.textContent=p.textContent;document.body.append(pre)}},100)</script>';
  writeFileSync(html, wrapper);
  fixtures.set('/test-' + width, wrapper);
  const run = await new Promise((resolve, reject) => {
    const child = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless', '--disable-gpu', '--no-sandbox', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--user-data-dir=' + join(directory, 'profile-' + width), '--window-size=1500,1250', '--virtual-time-budget=12000', '--dump-dom', origin + '/test-' + width], { windowsHide: true });
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Browser timed out')); }, 30000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', status => { clearTimeout(timeout); resolve({ status, stdout, stderr }); });
  });
  assert.equal(run.status, 0, run.stderr);
  const match = run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);
  if (!match) { writeFileSync(join(directory, `failed-${width}.html`), run.stdout); writeFileSync(join(directory, `failed-${width}.log`), run.stderr); }
  assert.ok(match, 'Browser did not complete checks');
  const checks = JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&gt;', '>').replaceAll('&lt;', '<'));
  const failures = checks.filter(([, ok]) => !ok);
  assert.deepEqual(failures, [], JSON.stringify(failures));
  console.log(`Revenue short link ${width}px: PASS (${checks.length} checks)`);
}
} finally { await new Promise(resolve => server.close(resolve)); }
