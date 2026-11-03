import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir=mkdtempSync(join(tmpdir(),'profit-product-cost-'));
const fixture=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {ReportProductCostInput} from './src/app/(dashboard)/reports/profit/ReportProductCostInput.tsx';
function App(){const [value,setValue]=useState(null);return <ReportProductCostInput id="cost" label="Cost Bánh Donut" storeId="cafe" productCode="DONUT" value={value} onChange={setValue} onSaved={amount=>window.savedAmount=amount}/>}
createRoot(document.getElementById('root')).render(<App/>);
const wait=ms=>new Promise(r=>setTimeout(r,ms));const checks=[];const check=(k,v)=>checks.push([k,!!v]);
const change=async value=>{const el=document.querySelector('#cost');el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));await wait(40);el.blur();await wait(100)};
(async()=>{try{await wait(200);
await change('20.000');check('leaving the field saves product cost in its store',api.calls.length===1&&api.calls[0].code==='DONUT'&&api.calls[0].store==='cafe'&&api.calls[0].data.cost===20000);
check('successful save is visible',document.body.textContent.includes('Đã lưu vào danh mục')&&window.savedAmount===20000);
await change('20.000');check('unchanged value is not saved twice',api.calls.length===1);
await change('');check('empty cost never clears catalog cost',api.calls.length===1);
api.fail=true;await change('25.000');check('failure shows error and retry',document.body.textContent.includes('Không kết nối')&&document.body.textContent.includes('Thử lưu lại'));
api.fail=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Thử lưu lại').click();await wait(100);
check('retry saves the entered cost',window.savedAmount===25000&&document.body.textContent.includes('Đã lưu vào danh mục'));
await change('0');check('explicit zero is saved',api.calls.at(-1).data.cost===0&&window.savedAmount===0);
}catch(e){check(e.stack,false)}const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify(checks);document.body.append(pre)})();`;
const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{'@':resolve('src')},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'mock-products',setup(b){b.onResolve({filter:/^@\/services\/products$/},()=>({path:'products',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`const api=window.api={calls:[],fail:false};export const updateProductCost=async(code,data,store)=>{api.calls.push({code,data,store});if(api.fail)throw new Error('Không kết nối')};`,loader:'js'}));}}],logLevel:'silent'});
const html=join(dir,'test.html');writeFileSync(html,`<!doctype html><meta charset="utf-8"><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
const run=spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${join(dir,'profile')}`,'--virtual-time-budget=4000','--dump-dom',new URL('file:///'+html.replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
assert.equal(run.status,0,run.stderr);const result=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(result,'Browser must finish: '+run.stdout.slice(-1000));const checks=JSON.parse(result[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));console.log(checks);assert.ok(checks.every(([,ok])=>ok));
