import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const directory = mkdtempSync(join(tmpdir(), 'receipt-entry-'));
const code = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Routes, Route} from 'react-router-dom';
import Page from './src/app/(dashboard)/inventory-receipts/[id]/page.tsx';
const product={id:'bread',productCode:'SP000164',productName:'Bánh Mì Hàn Quốc',unit:'Cái',areaId:'cafe',areaName:'Cafe',attachedToCurrentArea:true,similar:false};
const receipt={id:'r1',receiptCode:'NK20261018-021',warehouseType:'equipment',areaId:'cafe',area:{name:'Cà phê'},status:'draft',createdAt:'2026-10-18T12:00:00Z',createdByName:'admin',orderCreatorName:'admin',supplierId:'s1',supplier:{supplierName:'Nhà cung cấp'},canEdit:true,items:[],images:[],imageCount:0,itemCount:0,totalQuantity:0,totalAmount:0};
let posts=0, failSecond=true;
window.fetch=async(url,options)=>{
 const path=new URL(String(url),'https://test.local').pathname;
 let data={items:[]},ok=true;
 if(path.endsWith('/inventory-receipts.php'))data={item:{...receipt}};
 if(path.endsWith('/products.php'))data={items:[product]};
 if(path.endsWith('/inventory-receipt-items.php')){
  posts++;
  if(posts===2&&failSecond){failSecond=false;ok=false;}
  else {const body=JSON.parse(options.body);receipt.items.push({...body,id:posts,lineTotal:body.quantity*body.unitPrice});receipt.itemCount++;receipt.totalAmount+=body.quantity*body.unitPrice;receipt.totalQuantity+=body.quantity;}
 }
 return new Response(JSON.stringify({ok,data,error:ok?undefined:'Lỗi thử nghiệm'}),{status:ok?200:500,headers:{'Content-Type':'application/json'}});
};
const checks=[];const check=(name,value)=>checks.push([name,Boolean(value)]);
const wait=(ms=100)=>new Promise(resolve=>setTimeout(resolve,ms));
const button=(text)=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
const input=(label)=>document.querySelector('input[aria-label="'+label+'"]');
const fill=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/receipt/r1']}><Routes><Route path='/receipt/:id' element={<Page/>}/></Routes></MemoryRouter>);
(async()=>{
 for(let i=0;i<30&&!input('Mặt hàng dòng 1');i++)await wait();
 const goods=document.querySelector('.receipt-goods-panel');
 const photos=[...document.querySelectorAll('section')].find(el=>el.querySelector('h2')?.textContent.includes('Ảnh hóa đơn'));
 check('photos below full width goods panel',goods.getBoundingClientRect().bottom<=photos.getBoundingClientRect().top&&Math.abs(goods.getBoundingClientRect().width-photos.getBoundingClientRect().width)<2);
 for(const index of [1,2]){
  if(index===2){button('Thêm dòng').click();await wait();}
  fill(input('Mặt hàng dòng '+index),'Bánh');await wait(500);
  button('Bánh Mì Hàn Quốc').click();await wait();
  fill(input('Số lượng dòng '+index),String(index));fill(input('Đơn giá dòng '+index),'10000');await wait();
 }
 check('multiple editable rows',!!input('Số lượng dòng 2'));
 check('completion blocked until rows saved',button('Lưu & cộng kho').disabled);
 button('Lưu các dòng vào phiếu').click();await wait(600);
 check('partial failure keeps unsaved row only',posts===2&&receipt.items.length===1&&input('Số lượng dòng 1')?.value==='2'&&!input('Số lượng dòng 2'));
 button('Lưu các dòng vào phiếu').click();await wait(600);
 check('retry does not duplicate successful row',posts===3&&receipt.items.length===2&&receipt.totalQuantity===3);
 check('completion enabled after save',!button('Lưu & cộng kho').disabled);
 check('no page horizontal overflow',document.documentElement.scrollWidth<=innerWidth);
 const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify(checks);document.body.append(pre);
})().catch(e=>{const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify([['exception '+e.message,false]]);document.body.append(pre)});
`;
const bundled=await build({stdin:{contents:code,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve('src')},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'test-auth',setup(b){b.onLoad({filter:/AuthContext\.tsx$/},()=>({contents:'export const useAuth=()=>({role:"admin",user:{id:"admin",role:"admin"}});',loader:'tsx'}));}}],logLevel:'silent'});
const asset=readdirSync('dist/assets').find(n=>n.startsWith('index-')&&n.endsWith('.css'));
const css=readFileSync(join('dist/assets',asset),'utf8');
for(const width of [1440,390]){
 const fixture='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script>'+bundled.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>';
 const escaped=fixture.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const html=join(directory,'index.html');
 writeFileSync(html,'<!doctype html><style>body{margin:0}iframe{border:0}</style><iframe id="frame" style="width:'+width+'px;height:1100px" srcdoc="'+escaped+'"></iframe><script>const timer=setInterval(()=>{const result=document.getElementById("frame").contentDocument.querySelector("#test-result");if(result){clearInterval(timer);const pre=document.createElement("pre");pre.id="test-result";pre.textContent=result.textContent;document.body.append(pre)}},100)</script>');
 const run=spawnSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless','--disable-gpu','--no-sandbox','--disable-extensions','--disable-background-networking','--no-first-run','--user-data-dir='+join(directory,'profile-'+width),'--window-size=1500,1300','--virtual-time-budget=12000','--dump-dom','--screenshot='+join(directory,'receipt-'+width+'.png'),new URL('file:///'+resolve(html).replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
 assert.equal(run.status,0,run.stderr);
 const match=run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);
 assert.ok(match,'Browser did not finish checks');
 const checks=JSON.parse(match[1].replaceAll('&amp;','&'));
 console.log(width,checks);assert.ok(checks.every(([,ok])=>ok),'Receipt entry interaction failed');
}
console.log('Screenshots: '+directory);
