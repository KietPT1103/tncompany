import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the real form, dialog, table and confirmation flow against an isolated store service.
const mocks = {
  '@/context/StoreContext': `export const useStore=()=>({refreshStores:async()=>{window.refreshed=(window.refreshed||0)+1}});`,
  '@/services/stores.api': `
    const rows=window.storeRows=[{id:'cafe',name:'Cafe',address:'',isTakeAway:false,isActive:true,deletedAt:null}];
    export const getStores=async()=>rows.filter(row=>!row.deletedAt).map(row=>({...row}));
    export const saveStore=async(id,input)=>{
      if(id){const row=rows.find(row=>row.id===id);Object.assign(row,input);return {...row};}
      const row={id:'store_new',...input,deletedAt:null};rows.push(row);return {...row};
    };
    export const deleteStore=async id=>{Object.assign(rows.find(row=>row.id===id),{deletedAt:'2026-11-10',isActive:false})};
  `,
};
const fixture = `
  import React from 'react';import {createRoot} from 'react-dom/client';
  import Page from './src/features/stores/StoresPage.tsx';
  createRoot(document.getElementById('root')).render(<Page/>);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const checks=[];const check=(name,value)=>{checks.push([name,!!value]);if(!value)throw new Error(name)};
  const button=text=>[...document.querySelectorAll('button')].find(item=>item.textContent.trim()===text);
  const setInput=(element,value)=>{Object.getOwnPropertyDescriptor(element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));};
  (async()=>{try {
    await wait(100);
    check('existing store is listed',document.querySelector('tbody').textContent.includes('Cafe'));
    button('Thêm quầy').click();await wait(50);
    check('create dialog is open',document.querySelector('dialog').open);
    check('no operating model field is added',!document.querySelector('dialog select'));
    setInput(document.querySelector('dialog input:not([type])'),'Quầy mới');
    setInput(document.querySelector('dialog textarea'),'123 Đường A');await wait(20);
    document.querySelector('dialog input[type=checkbox]').click();await wait(20);
    const printSetting=[...document.querySelectorAll('dialog label')].find(label=>label.textContent.includes('In hóa đơn và tem qua laptop'));
    check('takeaway exposes opt-in laptop printing setting',!!printSetting && !printSetting.querySelector('input').checked);
    printSetting.querySelector('input').click();await wait(20);
    document.querySelector('dialog form').requestSubmit();await wait(100);
    check('creates store with address and take-away classification',storeRows[1]?.name==='Quầy mới' && storeRows[1].address==='123 Đường A' && storeRows[1].isTakeAway);
    check('saves shared laptop printing configuration',storeRows[1].takeawayPrintingEnabled===true);
    check('new store is rendered',document.querySelector('tbody').textContent.includes('Quầy mới') && document.querySelector('tbody').textContent.includes('Take away'));
    document.querySelector('[aria-label="Sửa Quầy mới"]').click();await wait(30);
    setInput(document.querySelector('dialog input:not([type])'),'Quầy đã sửa');await wait(20);
    document.querySelector('dialog form').requestSubmit();await wait(100);
    check('edits store while preserving address',storeRows[1].name==='Quầy đã sửa' && storeRows[1].address==='123 Đường A');
    document.querySelector('[role=switch][aria-label="Hoạt động: Quầy đã sửa"]').click();await wait(100);
    check('switch deactivates store',!storeRows[1].isActive && document.querySelector('[role=switch][aria-label="Hoạt động: Quầy đã sửa"]').getAttribute('aria-checked')==='false');
    document.querySelector('[aria-label="Xoá Quầy đã sửa"]').click();await wait(200);
    check('delete waits for confirmation',!storeRows[1].deletedAt && !!document.querySelector('[role=alertdialog]') && !!button('Xoá quầy'));
    button('Xoá quầy').click();await wait(250);
    check('soft delete removes listing and preserves stored row',!!storeRows[1].deletedAt && !document.querySelector('tbody').textContent.includes('Quầy đã sửa'));
    check('mutations refresh shared store selectors',window.refreshed===4);
  } catch(error){checks.push([error.message,false]);}
    const result=document.createElement('pre');result.id='result';result.textContent=JSON.stringify(checks);document.body.append(result);
  })();
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
  alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  plugins: [{ name: 'store-test-services', setup(builder) {
    builder.onResolve({ filter: /^@\/(context|services)\// }, args => mocks[args.path] ? { path: args.path, namespace: 'fixture' } : null);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  } }],
});
const dir = mkdtempSync(join(tmpdir(), 'stores-ui-'));
const html = join(dir, 'stores.html');
writeFileSync(html, `<!doctype html><meta charset="utf-8"><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`);
const run = spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-sandbox', `--user-data-dir=${join(dir, 'profile')}`, '--virtual-time-budget=5000', '--dump-dom', new URL('file:///' + html.replaceAll('\\', '/')).href,
], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
assert.equal(run.status, 0, run.stderr);
const result = run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
assert.ok(result, 'Browser fixture must finish: ' + run.stdout.slice(-1000));
const checks = JSON.parse(result[1].replaceAll('&amp;', '&'));
for (const [name, passed] of checks) assert.ok(passed, name);
console.log(`PASS store UI: ${checks.length} checks for creation, editing, metadata, state and confirmed soft deletion`);
