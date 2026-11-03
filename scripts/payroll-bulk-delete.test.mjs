import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'payroll-bulk-delete-'));
const mocks = {
  '@/services/payrolls': `
    const api = window.api = { deleted: [], fail: null, hold: false };
    export const getPayrollEntries = async () => ['An', 'Bình', 'Chi'].map((name, i) => ({
      id: String(i), payrollId: 'test', employeeId: 'e'+i, employeeName: name,
      role: 'Thu ngân', hourlyRate: 20000, totalHours: 10-i, weekendHours: 0,
      salary: 0, salaryType: 'hourly', shifts: [], note: ''
    }));
    export const deletePayrollEntry = async id => {
      while(api.hold) await new Promise(r => setTimeout(r, 20));
      if (api.fail === id) throw new Error('Không thể xóa');
      api.deleted.push(id);
    };
    export const addPayrollEntry = async () => {};
    export const updatePayrollEntry = async () => {};
  `,
  '@/services/employees': `export const getEmployees=async()=>[]; export const createEmployee=async()=>({}); export const updateEmployee=async()=>{}; export const getEmployeeRoleNames=e=>e?.role?[e.role]:[];`,
  '@/services/roleStartTimes': `export const getRoleStartTimes=async()=>[];`,
};
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import PayrollDetail from './src/app/(dashboard)/payroll/_components/PayrollDetail.tsx';
const wait = ms => new Promise(r => setTimeout(r, ms));
const checks = [];
const check = (label, ok) => { checks.push([label, !!ok]); if(!ok) throw new Error(label); };
const click = text => { const b = [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text); if(!b) throw new Error('Missing button '+text); b.click(); };
const select = name => document.querySelector('table input[aria-label="Chọn '+name+'"]').click();
const all = () => document.querySelector('table input[aria-label="Chọn tất cả nhân viên đang hiển thị"]');
const search = async value => {
 const input=document.querySelector('input[placeholder="Tìm theo mã, tên hoặc vai trò"]');
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);
 input.dispatchEvent(new Event('input',{bubbles:true})); await wait(50);
};
createRoot(document.getElementById('root')).render(<PayrollDetail payrollId="test" onBack={()=>{}}/>);
(async()=>{try {
 await wait(400);
 check('renders row selection', !!all());
 select('An'); await wait(40);
 check('select-all shows partial selection', all().indeterminate);
 click('Xóa đã chọn (1)'); await wait(40);
 check('requires confirmation before deleting', api.deleted.length===0 && !!document.querySelector('[role="alertdialog"]'));
 click('Hủy'); await wait(180);
 check('cancel preserves rows', document.querySelectorAll('table tbody tr').length===3 && api.deleted.length===0);
 all().click(); await wait(40);
 check('select-all selects every visible row', [...document.querySelectorAll('table tbody input[type="checkbox"]')].every(input=>input.checked));
 all().click(); await wait(40);
 check('select-all can clear the selection', !all().checked && !all().indeterminate);
 document.querySelector('article input[aria-label="Chọn An"]').click(); await wait(40);
 check('mobile and desktop share selection', document.querySelector('table input[aria-label="Chọn An"]').checked);
 await search('Bình');
 check('filter change clears selection', !all().checked && !all().indeterminate);
 all().click(); await wait(40);
 click('Xóa đã chọn (1)'); await wait(40);
 api.hold=true; click('Xóa dòng lương'); await wait(40);
 check('blocks repeat confirmation', document.querySelector('[role="alertdialog"] button:last-child').disabled);
 api.hold=false; await wait(100);
 check('deletes only filtered selection', JSON.stringify(api.deleted)==='["1"]');
 await search(''); all().click(); await wait(40);
 api.fail='2'; click('Xóa đã chọn (2)'); await wait(40); click('Xóa dòng lương'); await wait(100);
 check('partial failure removes successful rows only', document.querySelectorAll('table tbody tr').length===1 && !!document.querySelector('table input[aria-label="Chọn Chi"]'));
 check('failed row stays selected for retry', document.querySelector('table input[aria-label="Chọn Chi"]').checked);
 api.fail=null; click('Xóa đã chọn (1)'); await wait(40); click('Xóa dòng lương'); await wait(100);
 check('can remove final row and render empty state', document.querySelector('table tbody').textContent.includes('Không có nhân viên'));
 check('empty list disables select-all', all().disabled);
} catch(e) { checks.push(['Exception: '+e.message,false]); }
const pre=document.createElement('pre'); pre.id='result'; pre.textContent=JSON.stringify(checks); document.body.append(pre);
})();
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  alias: { '@': resolve('src'), 'next/link': resolve('src/shims/next-link.tsx'), 'next/navigation': resolve('src/shims/next-navigation.ts') },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  plugins: [{ name: 'mock-services', setup(b) {
    b.onResolve({ filter: /^@\/services\// }, args => mocks[args.path] ? { path: args.path, namespace: 'fixture' } : null);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  } }], logLevel: 'silent',
});
const html = join(dir, 'test.html');
writeFileSync(html, `<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.onerror=(m)=>{document.body.append('ERROR: '+m)};window.onunhandledrejection=e=>{document.body.append('REJECTION: '+e.reason)};</script><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`);
const run = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-sandbox', `--user-data-dir=${join(dir, 'profile')}`,
  '--virtual-time-budget=6000', '--dump-dom', new URL('file:///' + html.replaceAll('\\', '/')).href,
], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
assert.equal(run.status, 0, run.stderr);
const result = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
assert.ok(result, 'Browser must finish: ' + run.stdout.slice(-1200));
const checks = JSON.parse(result[1].replaceAll('&amp;', '&'));
console.log(checks);
if (checks.some(([, ok]) => !ok)) console.log(run.stdout.slice(-3000));
assert.ok(checks.every(([, ok]) => ok));


