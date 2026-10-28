import {build} from 'esbuild';
import {mkdtempSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const dir=mkdtempSync(join(tmpdir(),'kitchen-browser-'));
const code=`
import React from 'react';import {createRoot} from 'react-dom/client';import * as XLSX from 'xlsx';
import Page from './src/features/kitchen-reconciliation/KitchenReconciliationPage.jsx';
import {StoreProvider,useStore} from './src/context/StoreContext.tsx';
const checks=[],requests=[];const check=(k,v)=>checks.push([k,!!v]);const wait=()=>new Promise(r=>setTimeout(r,80));
const src={name:'fixture.xlsx',sha256:'a'.repeat(64)};
const config={recipes:[{id:'r',name:'Lẩu',source:'Cost t10-2026',lines:[{name:'Bắp bò',kind:'ingredient',quantity:120,unit:'g'}]}],rules:{'bap bo':{stockName:'Bò',stage:'raw'}},saleRules:{SP1:{recipeId:'r',confirmed:true}},stockRules:{'Bò':{confirmed:true,baseStage:'raw',yield:.8}},recipeSource:src};
window.fetch=async(url,opts={})=>{requests.push([String(url),opts]);const action=new URL(String(url),'http://localhost').searchParams.get('action');return new Response(JSON.stringify({ok:true,data:action==='config'?{config}:action==='list'||action==='versions'?{items:[]}:{saved:true}}));};
function Switch(){const{storeId,setStoreId}=useStore();return <button onClick={()=>setStoreId(storeId==='restaurant'?'cafe':'restaurant')}>Switch cafe</button>}
localStorage.setItem('selected_store_id','restaurant');createRoot(document.getElementById('root')).render(<StoreProvider><Switch/><Page/></StoreProvider>);
const click=text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);if(!b)throw Error('Missing button '+text);b.click();};
async function upload(label,file){const input=document.querySelector('input[aria-label="'+label+'"]');const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await wait();await wait();}
(async()=>{
 for(let i=0;i<25&&!document.querySelector('nav');i++)await wait();
 check('loads restaurant config',document.body.textContent.includes('1 công thức'));
 const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['Tên Nguyên Liệu','Tồn đầu kỳ','Đơn Vị',new Date(2026,9,12),new Date(2026,9,18)],['Bò',10,'kg',-2,0]]),'Tháng 10');
 await upload('Nhập–xuất kho',new File([XLSX.write(w,{type:'array',bookType:'xlsx'})],'kho.xlsx'));
 await upload('Báo cáo bán hàng',new File(['fixture-pdf'],'sales.pdf'));
 check('imports stock and PDF fixture',document.body.textContent.includes('1 mặt hàng bán')&&document.body.textContent.includes('2026-10-12'));
 click('4. Báo cáo & lịch sử');await wait();
 check('no count is unknown, never zero actual',document.querySelector('tbody')?.textContent.includes('Chưa đủ dữ liệu'));
 check('finalization enabled after rules satisfied',![...document.querySelectorAll('button')].find(b=>b.textContent==='Chốt báo cáo')?.disabled);
 click('3. Kiểm kê & sơ chế');await wait();
 const field=document.querySelector('input[aria-label="Bò rawOpen"]');field.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'0');field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));await wait();
 check('inventory has explicit raw/prepared and stage controls',document.querySelector('input[aria-label="Bò preparedClose"]')&&document.querySelector('select[aria-label="Trạng thái kho Bò"]'));
 click('2. Công thức & quy đổi');await wait();check('combo editor available',!!document.querySelector('select[aria-label="Kiểu dòng 1"]'));
 click('Switch cafe');await wait();const requestCount=requests.length;await wait();
 check('other store denies direct page',document.body.textContent.includes('Module chỉ có trong mô hình Lẩu/Bếp')&&!document.querySelector('nav'));
 check('other store sends no kitchen API calls',requests.length===requestCount);
 check('responsive page has no horizontal overflow',document.documentElement.scrollWidth<=innerWidth);
 click('Switch cafe');for(let i=0;i<25&&!document.querySelector('nav');i++)await wait();
 await upload('Nhập–xuất kho',new File([XLSX.write(w,{type:'array',bookType:'xlsx'})],'kho.xlsx'));await upload('Báo cáo bán hàng',new File(['fixture-pdf'],'sales.pdf'));click('4. Báo cáo & lịch sử');await wait();
 const result=document.createElement('pre');result.id='test-result';result.textContent=JSON.stringify(checks);document.body.append(result);
})().catch(e=>{const p=document.createElement('pre');p.id='test-result';p.textContent=JSON.stringify([['Exception '+e.message,false]]);document.body.append(p)});
`;
const pdfItems=[{str:'Từ ngày 12/10/2026 đến ngày 18/10/2026',transform:[1,0,0,1,30,800]},{str:'SL',transform:[1,0,0,1,241,700]},{str:'bán',transform:[1,0,0,1,254,700]},{str:'SP1',transform:[1,0,0,1,56,640]},{str:'Lẩu',transform:[1,0,0,1,150,640]},{str:'10',transform:[1,0,0,1,261,640]}];
const bundled=await build({stdin:{contents:code,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve('src')},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'pdf-fixture',setup(b){b.onResolve({filter:/pdfjs-dist\/legacy\/build\/pdf\.mjs$/},()=>({path:'pdf-fixture',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const GlobalWorkerOptions={};export function getDocument(){return {promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:${JSON.stringify(pdfItems)}})}),destroy:async()=>{}})}}`,loader:'js'}));b.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'worker-fixture',namespace:'worker'}));b.onLoad({filter:/.*/,namespace:'worker'},()=>({contents:'export default "fixture-worker";',loader:'js'}));}}],logLevel:'silent'});
const cssFile=readdirSync('dist/assets').find(n=>n.startsWith('index-')&&n.endsWith('.css'));assert.ok(cssFile,'Build first');const css=readFileSync(join('dist/assets',cssFile),'utf8');
for(const width of [1280,390]){
 const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundled.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`;
 const escaped=fixture.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const html=join(dir,`test-${width}.html`);writeFileSync(html,`<!doctype html><style>body{margin:0}iframe{border:0}</style><iframe id="frame" style="width:${width}px;height:900px" srcdoc="${escaped}"></iframe><script>const t=setInterval(()=>{const p=document.getElementById('frame').contentDocument.querySelector('#test-result');if(p){clearInterval(t);const result=document.createElement('pre');result.id='test-result';result.textContent=p.textContent;document.body.append(result);}},100)</script>`);
 const run=spawnSync('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${join(dir,`profile-${width}`)}`,`--window-size=${width},950`,'--virtual-time-budget=12000','--dump-dom',`--screenshot=${join(dir,`kitchen-${width}.png`)}`,new URL('file:///'+resolve(html).replaceAll('\\','/')).href],{encoding:'utf8',timeout:40000,maxBuffer:20*1024*1024});
 assert.equal(run.status,0,run.stderr);const match=run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);assert.ok(match,'Browser did not finish');const checks=JSON.parse(match[1].replaceAll('&amp;','&'));console.log(width,checks);assert.ok(checks.every(([,ok])=>ok));
}
console.log('Screenshots: '+dir);
