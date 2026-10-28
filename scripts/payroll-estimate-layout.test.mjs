import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(process.env.PAYROLL_LAYOUT_OUTPUT_DIR || tmpdir(), 'payroll-layout-'));
const cssPath = join(dir, 'utilities.css');
writeFileSync(join(dir, 'input.css'), '@tailwind base; @tailwind utilities;');
const cssRun = spawnSync(process.execPath, ['node_modules/tailwindcss/lib/cli.js', '-i', join(dir, 'input.css'), '-o', cssPath], { encoding: 'utf8' });
assert.equal(cssRun.status, 0, cssRun.stderr);
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RoleScheduleTable} from './src/app/(dashboard)/payroll-estimate-page.tsx';
const names = ['Nguyễn Thị Hoàng Anh Phương Thảo', 'TênRấtDàiKhôngCóKhoảngTrắng'.repeat(4), ...Array.from({length: 10}, (_, i) => 'Nhân viên ' + i)];
const employees = names.map((name, i) => ({id: String(i), name, hourlyRate: 25000, salaryType: 'hourly'}));
const days = Array.from({length: 7}, (_, i) => ({date: '2026-10-' + (26+i), inRange: true, isToday: i===0, shortDateLabel: String(26+i), dayLabel: 'Ngày '+i}));
const role='Phục vụ bếp';
createRoot(document.getElementById('root')).render(<RoleScheduleTable role={role} week={{key:'test',days}} employeeByKey={new Map(employees.map(e=>[e.id,e]))} schedule={{[days[0].date+'__'+role+'__shift_1']:employees.map(e=>e.id)}} activeCell={null} onRemoveEmployee={()=>{}} onSelectCell={()=>{}} onDelete={()=>{}} onSave={()=>{}} saving={false} saveDisabled={false}/>);
setTimeout(async()=>{
 const checks=[]; const check=(label,ok)=>checks.push([label,!!ok]);
 try {
 const names=[...document.querySelectorAll('[data-employee-name]')];
 check('renders all 12 employees',names.length===12);
 check('names wrap without truncation',names.every(n=>getComputedStyle(n).whiteSpace!=='nowrap' && n.scrollWidth<=n.clientWidth+1));
 check('employees stay inside their cards',names.every(n=>n.getBoundingClientRect().bottom<=n.closest('[role="button"]').getBoundingClientRect().bottom));
 const rows=document.querySelectorAll('tbody tr');
 check('employees do not overlap next shift',names.every(n=>n.getBoundingClientRect().bottom<=rows[1].getBoundingClientRect().top));
 check('page stays within viewport',document.documentElement.scrollWidth<=innerWidth);
 check('fixture uses requested viewport',innerWidth===parseInt(window.frameElement.style.width));
 if(innerWidth>=768){const cards=[...rows[0].querySelectorAll('[role="button"]')];check('desktop cards have equal height',Math.max(...cards.map(c=>c.offsetHeight))-Math.min(...cards.map(c=>c.offsetHeight))<=1);}
 let download;
 HTMLAnchorElement.prototype.click=function(){download=this.href};
 [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Chụp lịch')).click();
 for(let i=0;i<100&&!download;i++)await new Promise(r=>setTimeout(r,50));
 check('schedule PNG is generated',download?.startsWith('data:image/png'));
 if(download){const png=Uint8Array.from(atob(download.split(',')[1]),c=>c.charCodeAt(0));const height=new DataView(png.buffer).getUint32(20);check('PNG includes every shift',height>=window.captureLayoutHeight);}
 } catch(e) {check('Exception: '+e.message,false);}
 const pre=document.createElement('pre');pre.id='result';pre.textContent=JSON.stringify(checks);document.body.append(pre);
},500);
`;
const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', alias: { '@': resolve('src'), 'next/link': resolve('src/shims/next-link.tsx'), 'next/navigation': resolve('src/shims/next-navigation.ts') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, plugins: [{ name: 'expose-table', setup(b) { b.onLoad({ filter: /payroll-estimate-page\.tsx$/ }, args => ({ contents: readFileSync(args.path, 'utf8').replace(/(\s*)},\s*\n\s*}\);\s*\n\s*const link =/, '\nwindow.captureLayoutHeight = clonedSection.getBoundingClientRect().height;\n$1},\n});\nconst link =') + '\nexport {RoleScheduleTable};', loader: 'tsx' })); } }], logLevel: 'silent' });
for (const width of [390, 768, 1024, 1440]) {
  const html = join(dir, `layout-${width}.html`);
  const content = `<!doctype html><meta charset="utf-8"><style>${readFileSync(cssPath, 'utf8')}</style><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`;
  const escaped = content.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  writeFileSync(html, `<!doctype html><style>body{margin:0}iframe{border:0}</style><iframe style="width:${width}px;height:1400px" srcdoc="${escaped}"></iframe><script>const t=setInterval(()=>{const p=document.querySelector('iframe').contentDocument.querySelector('#result');if(p){clearInterval(t);document.body.append(p.cloneNode(true));}},50)</script>`);
  const run = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-sandbox', '--force-device-scale-factor=1', `--user-data-dir=${join(dir, 'profile-'+width)}`, `--window-size=${width},1500`, '--virtual-time-budget=12000', '--dump-dom', `--screenshot=${join(dir, 'layout-'+width+'.png')}`, new URL('file:///' + html.replaceAll('\\', '/')).href], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  writeFileSync(join(dir, 'dom-'+width+'.html'), run.stdout);
  const result = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
  assert.ok(result, 'Browser must finish fixture: '+run.stdout.slice(-1000));
  const checks = JSON.parse(result[1].replaceAll('&amp;', '&'));
  console.log(width, checks);
  assert.ok(checks.every(([, ok]) => ok), 'Layout checks failed');
}
console.log('Screenshots: ' + dir);
