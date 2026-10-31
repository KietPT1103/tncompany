import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(process.env.SHIFT_CAPTURE_OUTPUT_DIR || tmpdir(), 'shift-detail-capture-'));
writeFileSync(join(dir, 'input.css'), '@tailwind base; @tailwind utilities;');
const css = spawnSync(process.execPath, ['node_modules/tailwindcss/lib/cli.js', '-i', join(dir, 'input.css'), '-o', join(dir, 'style.css')], { encoding: 'utf8' });
assert.equal(css.status, 0, css.stderr);
const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import ShiftDetailModal from './src/app/(dashboard)/timesheet/ShiftDetailModal.tsx';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[];
const check=(label,ok)=>{checks.push([label,!!ok]);if(!ok)throw new Error(label)};
const copies=[];
let saves=0, fail=false;
Object.defineProperty(window,'ClipboardItem',{value:class{constructor(data){this.data=data}}});
Object.defineProperty(navigator,'clipboard',{value:{write:async items=>{
 if(fail)throw new Error('Permission denied');
 copies.push(await items[0].data['image/png']);
}}});
const shifts=Array.from({length:16},(_,i)=>({id:String(i),date:'2026/10/'+String(i+1).padStart(2,'0'),inTime:'2026-10-'+String(i+1).padStart(2,'0')+' 08:00:00',outTime:'2026-10-'+String(i+1).padStart(2,'0')+' 16:00:00',hours:8,isValid:true,isWeekend:false}));
createRoot(document.getElementById('root')).render(<ShiftDetailModal isOpen onClose={()=>{}} onSave={()=>saves++} employeeName="Nguyễn Thị An" employeeId="75" initialShifts={shifts}/>);
const capture=()=>document.querySelector('button[aria-label="Sao chép ảnh chấm công"]');
(async()=>{try{
 await wait(500);
 check('capture button is available',!!capture());
 check('capture button fits viewport',capture().getBoundingClientRect().right<=innerWidth);
 const scroller=document.querySelector('[data-shift-scroll]');
 const fullHeight=scroller.scrollHeight;
 scroller.scrollTop=scroller.scrollHeight;
 const scrollTop=scroller.scrollTop;
 capture().click(); await wait(30);
 check('blocks duplicate capture while rendering',capture().disabled);
 for(let i=0;i<150&&!copies.length;i++)await wait(50);
 check('copies a PNG to clipboard',copies[0]?.type==='image/png');
 const pngBytes=new Uint8Array(await copies[0].arrayBuffer());
 const png=new DataView(pngBytes.buffer);
 const image=document.createElement('pre');image.id='png';image.textContent=btoa(Array.from(pngBytes,b=>String.fromCharCode(b)).join(''));document.body.append(image);
 check('PNG contains full scrollable content',png.getUint32(20)>=fullHeight*2);
 const preview=new Image();const previewUrl=URL.createObjectURL(copies[0]);preview.src=previewUrl;
 for(let i=0;i<100&&!preview.complete;i++)await wait(50);
 check('PNG can be decoded',preview.naturalWidth>0);
 const canvas=document.createElement('canvas');canvas.width=preview.naturalWidth;canvas.height=preview.naturalHeight;
 const context=canvas.getContext('2d');context.drawImage(preview,0,0);URL.revokeObjectURL(previewUrl);
 const panel=document.querySelector('[data-shift-capture]').getBoundingClientRect();
 const save=document.querySelector('footer button:last-child');const button=save.getBoundingClientRect();
 const scale=canvas.width/panel.width;
 const whiteTextCenter=element=>{
   const rect=element.getBoundingClientRect();
   const x=Math.round((rect.left-panel.left)*scale);
   const y=Math.round(canvas.height-(panel.bottom-button.top)*scale+2*scale);
   const width=Math.max(1,Math.round(rect.width*scale));
   const height=Math.round((button.height-4)*scale);
   const pixels=context.getImageData(x,y,width,height).data;const rows=[];
   for(let row=0;row<height;row++)for(let col=0;col<width;col++){
     const offset=(row*width+col)*4;
     if(pixels[offset]>220&&pixels[offset+1]>220&&pixels[offset+2]>220){rows.push(row);break;}
   }
   return rows.length?(rows[0]+rows[rows.length-1])/2:null;
 };
 const iconCenter=whiteTextCenter(save.querySelector('svg'));
 const labelCenter=whiteTextCenter(save.querySelector('span'));
 check('save button text aligns with its icon in exported PNG',iconCenter!==null&&labelCenter!==null&&Math.abs(iconCenter-labelCenter)<=2.5*scale);
 check('capture preserves scroll position',scroller.scrollTop===scrollTop);
 check('capture does not save edits',saves===0);
 check('shows paste instructions',document.body.textContent.includes('Ctrl+V'));
 await wait(100);
 fail=true; capture().click(); await wait(300);
 check('clipboard denial shows error and allows retry',!capture().disabled&&document.body.textContent.includes('Không thể sao chép ảnh'));
 navigator.clipboard.write=undefined; capture().click(); await wait(100);
 check('unsupported clipboard shows guidance',document.body.textContent.includes('HTTPS'));
}catch(error){checks.push(['Exception: '+error.message,false]);}
const result=document.createElement('pre');result.id='result';result.textContent=JSON.stringify(checks);document.body.append(result);
})();
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  alias: { '@': resolve('src') },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  logLevel: 'silent',
});
for (const width of [390, 1440]) {
  const html = join(dir, `test-${width}.html`);
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${readFileSync(join(dir, 'style.css'), 'utf8')}</style><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`);
  const run = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless', '--disable-gpu', '--no-sandbox', '--force-device-scale-factor=1',
    `--user-data-dir=${join(dir, 'profile-'+width)}`, `--window-size=${width},800`,
    '--virtual-time-budget=15000', '--dump-dom', new URL('file:///' + html.replaceAll('\\', '/')).href,
  ], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  const result = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
  assert.ok(result, 'Browser must finish: ' + run.stdout.slice(-1200));
  const checks = JSON.parse(result[1].replaceAll('&amp;', '&'));
  const png = run.stdout.match(/<pre id="png">([^<]+)<\/pre>/);
  if (png) writeFileSync(join(dir, `capture-${width}.png`), Buffer.from(png[1], 'base64'));
  console.log(width, checks);
  assert.ok(checks.every(([, ok]) => ok));
}
console.log('Capture previews: ' + dir);
