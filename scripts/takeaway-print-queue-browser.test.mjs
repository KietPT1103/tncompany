import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixture=`
import React from 'react';import {createRoot} from 'react-dom/client';
import Queue from './src/features/stores/TakeawayPrintQueue.tsx';
window.confirm=()=>true;window.calls=[];
createRoot(document.getElementById('root')).render(<Queue storeId="cart"/>);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[];const check=(name,ok)=>{checks.push([name,!!ok]);if(!ok)throw Error(name);};
const button=text=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===text);
(async()=>{try {
await wait(100);button('Hàng đợi in bill / tem').click();await wait(100);
check('shows independent receipt and label states',document.body.textContent.includes('Đã gửi máy in')&&document.body.textContent.includes('Lỗi'));
button('Thử lại').click();await wait(100);
check('retry is scoped to one failed label',calls[0]?.action==='retry'&&calls[0]?.id==='label1'&&calls[0]?.storeId==='cart');
button('In thêm bản').click();await wait(100);
check('receipt reprint has distinct idempotency request',calls[1]?.action==='reprint'&&calls[1]?.id==='receipt1'&&calls[1]?.requestId.length>=16);
button('Trang sau').click();await wait(100);
check('older jobs are accessible',document.body.textContent.includes('OLD-BILL'));
window.dispatchEvent(new CustomEvent('takeaway-print-queue',{detail:'B42'}));await wait(100);
check('sold bill action filters queue by exact bill',document.querySelector('input').value==='B42'&&window.lastQuery.includes('billId=B42')&&window.lastQuery.includes('offset=0'));
window.dispatchEvent(new Event('takeaway-print-queued'));await wait(30);
check('checkout reports queued, not physical print success',document.body.textContent.includes('Đã lưu bill và xếp hàng'));
}catch(e){checks.push([e.message,false]);}
const result=document.createElement('pre');result.id='result';result.textContent=JSON.stringify(checks);document.body.append(result);
})();
`;
const mock=`export async function apiRequest(url,options={}) {
if(options.method==='POST'){window.calls.push(JSON.parse(options.body));return {};}
window.lastQuery=url;const old=url.includes('offset=200');
if(old)return {items:[{id:'old',billId:'OLD-BILL',kind:'label',status:'uncertain',error:'',document:{item:{name:'Bánh'}}}]};
return {items:[{id:'receipt1',billId:'B42',kind:'receipt',status:'printed',error:'',document:{}},{id:'label1',billId:'B42',kind:'label',status:'failed',error:'Hết giấy',document:{item:{name:'Trà đào'},labelNumber:1}},...Array.from({length:198},(_,i)=>({id:'pending'+i,billId:'B42',kind:'label',status:'pending',error:'',document:{item:{name:'Nước'}}}))]};
}`;
const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{'@':resolve('src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'api',setup(b){b.onResolve({filter:/^@\/lib\/api$/},()=>({path:'api',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js'}));}}]});
const dir=mkdtempSync(join(tmpdir(),'takeaway-queue-')),html=join(dir,'index.html');
writeFileSync(html,`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
const run=spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox','--window-size=390,844',`--user-data-dir=${join(dir,'profile')}`,'--virtual-time-budget=5000','--dump-dom',new URL('file:///'+html.replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
assert.equal(run.status,0,run.stderr);
const result=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(result,'Fixture must finish');
const checks=JSON.parse(result[1].replaceAll('&amp;','&'));for(const [name,passed] of checks)assert.ok(passed,name);
console.log(`PASS takeaway queue UI: ${checks.length} checks`);
