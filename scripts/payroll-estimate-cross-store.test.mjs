import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'estimate-cross-store-'));
for (const [storeId, userRole] of [['cafe','admin'], ['restaurant','admin'], ['cafe','manager'], ['cafe','user'], ['farm','admin'], ['bakery','admin']]) {
  const mocks = {
    '@/context/AuthContext': `export const useAuth=()=>({user:{id:'test',role:${JSON.stringify(userRole)},permissions:['payroll_estimate.access']},loading:false});`,
    '@/context/StoreContext': `export const useStore=()=>({storeId:${JSON.stringify(storeId)},storeName:'Test'});`,
    '@/services/employeeRoles': `export const getEmployeeRoles=async store=>[{name:store==='restaurant'?'Bếp':'Thu ngân'},{name:'Leader'},{name:'MKT'}];`,
    '@/services/employees': `export const getEmployees=async store=>[{id:store+'-e',storeId:store,employeeCode:'001',name:store+' employee',role:store==='restaurant'?'Bếp':'Thu ngân',hourlyRate:store==='restaurant'?30000:25000},{id:store+'-monthly',storeId:store,employeeCode:'002',name:store+' monthly employee',role:store==='restaurant'?'Bếp':'Thu ngân',salaryType:'monthly',monthlySalary:9000000,hourlyRate:99999},{id:store+'-other-role',storeId:store,employeeCode:'003',name:store+' other role employee',role:store==='restaurant'?'Phụ bếp':'Pha chế',hourlyRate:20000},{id:store+'-marketing',storeId:store,name:store+' marketing only',role:'MKT',hourlyRate:20000}];export const getEmployeeRoleNames=e=>[e.role];`,
    '@/services/payrolls': `
      const api=window.api={saved:null};
      export const getEstimateDayLocks=async()=>({dates:[]});
      export const setEstimateDayLock=async()=>({dates:[]});
      export const getSavedEstimateSchedules=async()=>({items:[],total:0,summary:null});
      export const saveImportedPayroll=async p=>{api.saved=p;return 'saved'};
      export const getSavedEstimateSchedule=async()=>({schedule:{...api.saved,roles:api.saved.entries.map(e=>e.role)},entries:api.saved.entries});
      export const getPayrollEntries=async()=>api.saved.entries.map(e=>({...e,id:e.employeeId}));
      export const updatePayroll=async()=>{};
      export const updatePayrollEntry=async(id,entry)=>{api.saved.entries=api.saved.entries.map(e=>e.employeeId===id?entry:e)};
      export const addPayrollEntry=async()=>{};
      export const deletePayrollEntry=async()=>{};
      export const deleteSavedEstimateSchedules=async()=>{};
    `,
  };
  const fixture = `
    import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useNavigate} from 'react-router-dom';
    import Page from './src/app/(dashboard)/payroll-estimate-page.tsx';
    function Controller(){window.navigate=useNavigate();return <Page/>}
    createRoot(document.getElementById('root')).render(<MemoryRouter><Controller/></MemoryRouter>);
    const wait=ms=>new Promise(r=>setTimeout(r,ms));const checks=[];const check=(name,ok)=>checks.push([name,!!ok]);
    const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    (async()=>{try{
      await wait(500);
      document.querySelector('[aria-haspopup="listbox"]').click();await wait(80);
      const options=[...document.querySelectorAll('[role="option"]')];
      check('MKT stays hidden',!options.some(o=>o.textContent.includes('MKT')));
      check('common roles appear once',options.filter(o=>o.textContent.includes('Leader')).length===1);
      const shared=['cafe','restaurant'].includes(${JSON.stringify(storeId)});
      const other=${JSON.stringify(storeId === 'cafe' ? 'restaurant' : 'cafe')};
      const role=other==='restaurant'?'Bếp':'Thu ngân';
      const option=options.find(o=>o.textContent.trim()===role);
      if(shared){
        check('other store role is selectable',!!option);if(!option)throw new Error('Missing other store role');
        option.click();await wait(80);button('Thêm lịch phân ca').click();await wait(80);
        const board=document.getElementById('estimate-board-'+encodeURIComponent(role));
        board.querySelector('[data-schedule-day] [role="button"]').click();await wait(80);
        const employee=[...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].find(b=>b.textContent.includes(other+' employee'));
        check('other store employee is available',!!employee);if(!employee)throw new Error('Missing other store employee');
        check('other store employees with different role are available',[...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].some(b=>b.textContent.includes(other+' other role employee')));
        check('marketing-only staff remain excluded',!document.querySelector('[role="dialog"]').textContent.includes('marketing only'));
        employee.click();await wait(80);
        const monthly=[...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].find(b=>b.textContent.includes(other+' monthly employee'));
        check('daily salary visibility follows admin role',monthly&&(monthly.textContent.includes('300.000 đ/ngày')===${userRole === 'admin'}));
        monthly.click();await wait(1500);
        check('saves under current store',api.saved?.storeId===${JSON.stringify(storeId)});
        const entry=api.saved?.entries[0];
        check('keeps employee identity and assigned role',entry?.employeeId===other+'-e'&&entry?.role===role);
        check('uses other store hourly rate',entry?.salary===(other==='restaurant'?150000:125000));
        const monthlyEntry=()=>api.saved?.entries.find(e=>e.employeeId===other+'-monthly');
        check('saves monthly daily cost',monthlyEntry()?.salary===300000);
        const amount=new Intl.NumberFormat('vi-VN').format(300000+(other==='restaurant'?150000:125000));
        check('combined total includes monthly daily cost',document.body.textContent.includes(amount));
        check('day header shows hourly and monthly cost',board.querySelector('th[data-schedule-day]').textContent.includes('Tổng ngày'+amount));
        check('schedule cell hides monthly cost',!board.querySelector('tbody [data-schedule-day]').textContent.includes('300.000'));
        document.querySelector('[aria-label="Đóng popup"]').click();await wait(80);
        window.navigate('/payroll-estimate?payrollId=reopened');await wait(500);
        check('restores cross-store assignment',document.getElementById('estimate-board-'+encodeURIComponent(role))?.textContent.includes(other+' employee'));
        const restoredBoard=document.getElementById('estimate-board-'+encodeURIComponent(role));
        restoredBoard.querySelectorAll('tbody tr')[1].querySelector('[data-schedule-day] [role="button"]').click();await wait(80);
        [...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].find(b=>b.textContent.includes(other+' monthly employee')).click();await wait(1500);
        check('two shifts on one day count once',monthlyEntry()?.salary===300000&&monthlyEntry()?.shifts.length===2);
        check('day header counts monthly salary once across shifts',restoredBoard.querySelector('th[data-schedule-day]').textContent.includes('Tổng ngày'+amount));
        document.querySelector('[aria-label="Đóng popup"]').click();await wait(80);
        restoredBoard.querySelectorAll('tbody tr')[0].querySelectorAll('[data-schedule-day] [role="button"]')[1].click();await wait(80);
        [...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].find(b=>b.textContent.includes(other+' monthly employee')).click();await wait(1500);
        check('second scheduled day adds daily salary',monthlyEntry()?.salary===600000);
        const alternate=[...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].find(b=>b.textContent.includes(other+' other role employee'));
        check('employee row identifies its store',alternate?.textContent.includes(other==='restaurant'?'Bếp / Lẩu':'Cafe'));
        alternate.click();await wait(80);
        check('can select other-store employee with a different profile role',alternate.getAttribute('aria-pressed')==='true');
        document.querySelector('[aria-label="Đóng popup"]').click();await wait(80);
        api.saved.entries[0].hourlyRate=50000;
        api.saved.entries.push({...structuredClone(api.saved.entries[0]),employeeId:'deleted-person',employeeCode:'old-99',employeeName:'Nhân viên đã xóa',hourlyRate:40000});
        window.navigate('/payroll-estimate?payrollId=historical');await wait(400);
        const historicalBoard=document.getElementById('estimate-board-'+encodeURIComponent(role));
        check('restores employees no longer in current roster',historicalBoard?.textContent.includes('Nhân viên đã xóa'));
        historicalBoard.querySelector('[data-schedule-day] [role="button"]').click();await wait(80);
        const historicalEmployee=[...document.querySelectorAll('[role="dialog"] button[aria-pressed]')].find(b=>b.textContent.includes(other+' employee'));
        check('reopened schedule uses its saved hourly rate',historicalEmployee?.textContent.includes('250.000 đ'));
      }else{
        check('unrelated stores do not gain kitchen roles',!options.some(o=>o.textContent.trim()==='Bếp'));
      }
    }catch(e){check(e.message,false)}
    const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify(checks);document.body.append(pre);
    })();
  `;
  const bundle = await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{'@':resolve('src'),'next/link':resolve('src/shims/next-link.tsx'),'next/navigation':resolve('src/shims/next-navigation.ts')},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'mock-services',setup(b){b.onResolve({filter:/^@\/(context|services)\//},args=>mocks[args.path]?{path:args.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js'}));}}],logLevel:'silent'});
  const html=join(dir,storeId+'-'+userRole+'.html');
  writeFileSync(html,`<!doctype html><meta charset="utf-8"><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
  const run=spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${join(dir,'profile-'+storeId)}`,'--virtual-time-budget=10000','--dump-dom',new URL('file:///'+html.replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  assert.equal(run.status,0,run.stderr);
  const result=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
  assert.ok(result,'Browser must finish: '+run.stdout.slice(-1000));
  const checks=JSON.parse(result[1].replaceAll('&amp;','&'));
  console.log(storeId,userRole,checks);
  assert.ok(checks.every(([,ok])=>ok));
}
