import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'payroll-autosave-'));
const mocks = {
  '@/context/AuthContext': `const user={id:'test',role:'admin'};export const useAuth=()=>({user,loading:false});`,
  '@/context/StoreContext': `export const useStore=()=>({storeId:'cafe',storeName:'Cafe'});`,
  '@/services/employeeRoles': `export const getEmployeeRoles=async()=>[{name:'Thu ngân'}];`,
  '@/services/employees': `export const getEmployees=async()=>[{id:'e1',name:'Nhân viên A',role:'Thu ngân',hourlyRate:25000},{id:'e2',name:'Nhân viên B',role:'Thu ngân',hourlyRate:25000}];export const getEmployeeRoleNames=e=>[e.role];`,
  '@/services/payrolls': `
const api=window.api={creates:[],updates:[],entries:[],loads:0,attempts:0,fail:false,hold:false};
export const getSavedEstimateSchedules=async()=>({items:api.creates.length&&!api.deleted?[{...api.creates[0],id:api.detailId||'schedule1',updatedAt:'2026-10-28 12:00:00',roles:['Thu ngân'],employeeCount:api.entries.length,totalHours:0,totalSalary:0}]:[],total:api.deleted?0:api.creates.length,summary:null});
export const saveImportedPayroll=async p=>{api.creates.push(p);const id='schedule'+api.creates.length;while(api.hold)await new Promise(r=>setTimeout(r,50));api.entries=p.entries.map((e,i)=>({...e,id:'entry'+i}));return id};
export const getPayrollEntries=async()=>{api.attempts++;if(api.fail)throw new Error('Mất kết nối');return structuredClone(api.entries)};
export const updatePayrollEntry=async(id,e)=>{api.entries=api.entries.map(v=>v.id===id?{...e,id}:v)};
export const addPayrollEntry=async(id,e)=>{api.entries.push({...e,id:crypto.randomUUID()})};
export const deletePayrollEntry=async(id)=>{if(api.failDeleteAfter===0)throw new Error('Lỗi khi xoá phân ca');if(api.failDeleteAfter>0)api.failDeleteAfter--;api.entries=api.entries.filter(e=>e.id!==id)};
export const updatePayroll=async(id,p)=>{api.updates.push({id,...p})};
export const getSavedEstimateSchedule=async(store,id)=>{api.loads++;if(!api.allowLoad)throw new Error('Không mở được lịch');api.detailId=id;return {schedule:{...api.creates[0],id,roles:['Thu ngân']},entries:structuredClone(api.entries)}};
export const deleteSavedEstimateSchedules=async()=>{api.deleted=true};
`,
};
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useNavigate} from 'react-router-dom';
import Page from './src/app/(dashboard)/payroll-estimate-page.tsx';
const checks=[];const check=(k,v)=>checks.push([k,!!v]);const wait=ms=>new Promise(r=>setTimeout(r,ms));
function Controller(){window.navigate=useNavigate();return <Page/>}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/payroll-estimate']}><Controller/></MemoryRouter>);
const clickEmployee=name=>{const b=[...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].find(b=>b.textContent.includes(name));if(!b)throw new Error('Missing employee '+name);b.click()};
const status=()=>document.querySelector('[data-autosave-status]')?.textContent;
const closePicker=()=>{document.querySelector('[aria-label="Đóng popup"]')?.click()};
const clickText=(selector,text)=>{const button=[...document.querySelectorAll(selector)].find(b=>b.textContent.trim()===text);if(!button)throw new Error('Missing button '+selector+' '+text);button.click()};
(async()=>{try{
 await wait(500);check('does not save empty initial schedule',api.creates.length===0);
 document.querySelector('[data-schedule-day] [role="button"]').click();await wait(80);
 api.hold=true;clickEmployee('Nhân viên A');await wait(150);clickEmployee('Nhân viên B');await wait(700);
 check('debounces rapid edits',api.creates.length===0);await wait(500);
 check('creates one schedule automatically',api.creates.length===1&&api.creates[0].entries.length===2);
 clickEmployee('Nhân viên A');await wait(80);check('accepts edits while saving',document.querySelector('[role="dialog"] button[aria-pressed="false"]')?.textContent.includes('Nhân viên A'));
 api.hold=false;await wait(1800);
 check('queues latest change against returned id',api.creates.length===1&&api.updates.length===1&&api.updates[0].id==='schedule1'&&api.entries.length===1&&api.entries[0].employeeId==='e2');
 check('does not reload or overwrite own created schedule',api.loads===0);
 check('reports saved state',status()?.includes('Đã lưu lịch'));
 api.fail=true;clickEmployee('Nhân viên A');await wait(1400);
 check('reports automatic save error',status()?.includes('Mất kết nối'));
 const attempts=api.attempts;await wait(1600);check('does not loop on failure',api.attempts===attempts);
 api.fail=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Thử lưu lại').click();await wait(400);
 check('manual retry saves same schedule',api.creates.length===1&&api.entries.length===2&&status()?.includes('Đã lưu lịch'));
 api.failDeleteAfter=1;clickEmployee('Nhân viên A');clickEmployee('Nhân viên B');await wait(1400);
 check('reports partial mutation failure',api.entries.length===1&&status()?.includes('Lỗi khi xoá phân ca'));
 api.failDeleteAfter=undefined;clickEmployee('Nhân viên B');clickEmployee('Nhân viên A');await wait(1400);
 check('reconciles server after reverting a partially saved draft',api.entries.length===2&&status()?.includes('Đã lưu lịch'));
 clickEmployee('Nhân viên A');clickEmployee('Nhân viên B');await wait(1500);
 check('autosaves removal of final assignment',api.entries.length===0&&status()?.includes('Đã lưu lịch')&&api.creates.length===1);
 closePicker();await wait(80);window.navigate('/payroll-estimate?payrollId=bad');await wait(200);
 document.querySelector('[data-schedule-day] [role="button"]').click();await wait(80);clickEmployee('Nhân viên A');await wait(1400);
 const prior=api.attempts;[...document.querySelectorAll('button')].find(b=>b.textContent==='Lưu ước tính')?.click();await wait(200);
 check('failed opening blocks automatic and manual writes of previous schedule',api.attempts===prior&&api.creates.length===1);
 closePicker();api.allowLoad=true;window.navigate('/payroll-estimate?payrollId=loaded2');await wait(1400);
 check('opening a saved schedule does not autosave it',api.detailId==='loaded2'&&api.attempts===prior);
 document.querySelector('button[aria-label="Lịch phân ca đã lưu"]').click();await wait(200);
 clickText('button','Xoá');await wait(200);
 clickText('[role="alertdialog"] button','Xoá lịch');await wait(300);
 clickText('button','Lịch phân ca');await wait(80);
 document.querySelector('[data-schedule-day] [role="button"]').click();await wait(80);clickEmployee('Nhân viên A');await wait(1400);
 check('deleting active saved schedule resets identity for next create',api.creates.length===2&&api.entries.length===1);
}catch(e){check('Exception: '+e.message,false)}
const p=document.createElement('pre');p.id='result';p.textContent=JSON.stringify(checks);document.body.append(p);
})();
`;
const bundled = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': resolve('src'), 'next/link': resolve('src/shims/next-link.tsx'), 'next/navigation': resolve('src/shims/next-navigation.ts') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, plugins: [{ name: 'mock-services', setup(b) { b.onResolve({ filter: /^@\/(context|services)\// }, args => mocks[args.path] ? { path: args.path, namespace: 'fixture' } : null); b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' })); } }], logLevel: 'silent' });
const html=join(dir,'test.html');writeFileSync(html,`<!doctype html><meta charset="utf-8"><div id="root"></div><script>${bundled.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
const run=spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${join(dir,'profile')}`,'--virtual-time-budget=20000','--dump-dom',new URL('file:///'+html.replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
assert.equal(run.status,0,run.stderr);const result=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(result,'Browser must finish: '+run.stdout.slice(-1200));const checks=JSON.parse(result[1].replaceAll('&amp;','&'));console.log(checks);assert.ok(checks.every(([,ok])=>ok));
