import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'estimate-month-picker-'));
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {SavedEstimateSchedules} from './src/app/(dashboard)/payroll/_components/SavedEstimateSchedules.tsx';
createRoot(document.getElementById('root')).render(<SavedEstimateSchedules storeId="cafe" revision={0} initialRange={{startDate:'2026-11-02',endDate:'2026-11-08'}} onOpen={()=>{}} onDeleted={()=>{}} onCreate={()=>{}} onRefresh={()=>{}} opening={false}/>);
const wait=ms=>new Promise(r=>setTimeout(r,ms));const checks=[];const check=(name,ok)=>checks.push([name,!!ok]);
const select=async text=>{document.querySelector('[aria-haspopup="listbox"]').click();await wait(50);[...document.querySelectorAll('[role="option"]')].find(o=>o.textContent.trim()===text).click();await wait(100)};
(async()=>{try{
await wait(300);await select('Theo tháng');
const input=document.querySelector('input[type="month"]');check('month preset has a month picker',!!input);
check('month preset does not ask for a day',!document.body.textContent.includes('Chọn ngày trong tháng'));
if(!input)throw new Error('Missing month picker');
check('initial month follows current range',input.value==='2026-11');
const setValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
const change=async value=>{setValue.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));await wait(100)};
await change('2026-10');check('October requests the full month',window.requests.at(-1)?.startDate==='2026-10-01'&&window.requests.at(-1)?.endDate==='2026-10-31');
await change('2028-02');check('leap February ends on the 29th',window.requests.at(-1)?.endDate==='2028-02-29');
const count=window.requests.length;await change('');check('clearing month does not request an invalid period',window.requests.length===count);
await select('Theo tuần');check('week preset keeps its day picker',document.body.textContent.includes('Chọn ngày trong tuần')&&!document.querySelector('input[type="month"]'));
}catch(e){check(e.message,false)}const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify(checks);document.body.append(pre)})();
`;
const bundled=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{'@':resolve('src')},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'mock-payroll',setup(b){b.onResolve({filter:/^@\/services\/payrolls$/},()=>({path:'payrolls',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`window.requests=[];export const getSavedEstimateSchedules=async(s,p,period)=>{window.requests.push(period);return {items:[],total:0,summary:null}};export const deleteSavedEstimateSchedules=async()=>{};`,loader:'js'}));}}],logLevel:'silent'});
const html=join(dir,'test.html');writeFileSync(html,`<!doctype html><meta charset="utf-8"><div id="root"></div><script>${bundled.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
const run=spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${join(dir,'profile')}`,'--virtual-time-budget=4000','--dump-dom',new URL('file:///'+html.replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
assert.equal(run.status,0,run.stderr);const result=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(result,'Browser must finish: '+run.stdout.slice(-1000));const checks=JSON.parse(result[1].replaceAll('&amp;','&'));console.log(checks);assert.ok(checks.every(([,ok])=>ok));
