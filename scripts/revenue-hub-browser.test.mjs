import { build } from 'esbuild';
import { writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const directory = process.env.REVENUE_TEST_OUTPUT || resolve('artifacts/revenue-hub');
mkdirSync(directory,{recursive:true});
const code = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import RevenuePage from './src/features/revenue/RevenuePage.tsx';
const metrics={revenue:1234567,cash:1000000,transfer:234567,cups:150,bakery:42,expense:50000,income:10000,bills:65};
const mo={room:4000000,retail:200000,surcharge:121000,collected:4321000,cash:1000000,transfer:3321000,expense:200000,other:0,bookings:8};
window.testAuth={user:{id:'u',role:'admin',permissions:['revenue_hub.view']},loading:false};
let requests=[],fail=false,delay=30;
window.fetch=async(url,options)=>{
 const q=new URL(String(url),'http://test').searchParams;requests.push(q);const source=q.get('source');const from=q.get('from'),to=q.get('to');
 const data={version:1,source,from,to,updatedAt:'2026-10-25T10:30:00Z',totals:source==='tnservice'?metrics:mo,stores:[{id:'cafe',name:'Nước'}],days:[{date:from,totals:source==='tnservice'?metrics:mo,shifts:{shift_1:metrics,shift_2:{...metrics,revenue:0},shift_3:{...metrics,revenue:0}},transactions:[{type:'room',code:'MO-1',room:'Phòng Mơ',amount:4000000,time:'2026-10-25T03:00:00Z',payment:'transfer'}]}]};
 const bad=fail;await new Promise(r=>setTimeout(r,delay));return new Response(JSON.stringify({ok:!bad,data,error:bad?'Nguồn tạm ngưng':undefined}),{status:bad?502:200});
};
const root=createRoot(document.getElementById('root'));
function Login(){return <pre id='login-target'>{useLocation().search}</pre>}
const render=()=>root.render(<MemoryRouter initialEntries={['/revenue?source=tnservice&from=2026-10-25&to=2026-10-25']}><Routes><Route path='/revenue' element={<RevenuePage/>}/><Route path='/login' element={<Login/>}/></Routes></MemoryRouter>);
render();
const checks=[];const check=(n,v)=>checks.push([n,!!v,...(v?[]:[document.getElementById('root').textContent.slice(0,500),requests.at(-1)?.toString()])]);
const wait=(ms=120)=>new Promise(r=>setTimeout(r,ms));
const fill=(element,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));};
const btn=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
(async()=>{
 await wait(450);check('TN report loads',document.getElementById('root').textContent.includes('1.234.567'));check('all three shifts visible',document.getElementById('root').textContent.includes('Ca 3'));
 check('no mobile overflow',document.documentElement.scrollWidth<=innerWidth);
 const n=requests.length;document.querySelector('button[aria-label="Tải lại"]').click();await wait(250);check('reload fetches again',requests.length===n+1);
 btn('7 ngày').click();await wait(250);check('quick range applies',requests.at(-1).get('from')!==requests.at(-1).get('to'));
 const beforeInvalid=requests.length;fill(document.querySelector('input[aria-label="Từ ngày"]'),'2099-01-01');await wait();check('invalid range blocks request',requests.length===beforeInvalid&&!!document.querySelector('[role="alert"]'));fill(document.querySelector('input[aria-label="Từ ngày"]'),'2026-10-25');await wait(250);check('native date change applies',requests.at(-1).get('from')==='2026-10-25');
 delay=500;btn('MoHomestay').click();await wait(30);check('old source cleared while loading',!document.getElementById('root').textContent.includes('1.234.567'));btn('TN Service').click();delay=20;await wait(650);check('stale Mo response ignored',!document.getElementById('root').textContent.includes('4.321.000')&&document.getElementById('root').textContent.includes('1.234.567'));
 fail=true;btn('MoHomestay').click();await wait(250);check('source error visible',document.querySelector('[role="alert"]')?.textContent.includes('Nguồn tạm ngưng'));fail=false;btn('Thử lại').click();await wait(250);check('retry restores Mo report',document.getElementById('root').textContent.includes('4.321.000'));check('Mo has distinct native fields',document.getElementById('root').textContent.includes('Tiền phòng')&&!document.getElementById('root').textContent.includes('Ly nước'));
 check('mobile Mo no overflow',document.documentElement.scrollWidth<=innerWidth);
 delay=30000;document.querySelector('button[aria-label="Tải lại"]').click();await wait(14300);check('slow source times out with retry',document.querySelector('[role="alert"]')?.textContent.includes('Tải dữ liệu quá lâu'));delay=20;btn('TN Service').click();await wait(250);check('other source remains usable after timeout',document.getElementById('root').textContent.includes('1.234.567'));
 window.testAuth={user:{id:'u',role:'admin',permissions:[]},loading:false};render();await wait();check('ungranted admin denied',document.getElementById('root').textContent.includes('Chưa được cấp quyền'));
 window.testAuth={user:null,loading:false};render();await wait();check('TN login preserves hub URL',document.querySelector('#login-target')?.textContent.includes('returnTo=%2Frevenue'));
 root.unmount();const root2=createRoot(document.getElementById('root'));window.testAuth={user:{id:'u',role:'user',permissions:['revenue_hub.view']},loading:false};
 root2.render(<MemoryRouter initialEntries={['/revenue?source=mohomestay&from=2026-10-25&to=2026-10-25']}><RevenuePage/></MemoryRouter>);await wait(250);
 const pre=document.createElement('pre');pre.id='test-result';pre.textContent=JSON.stringify(checks);document.body.append(pre);
})().catch(e=>{const p=document.createElement('pre');p.id='test-result';p.textContent=JSON.stringify([['exception '+e.stack,false]]);document.body.append(p)});
`;
const bundled=await build({stdin:{contents:code,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':resolve('src')},plugins:[{name:'test-auth',setup(build){build.onResolve({filter:/context\/AuthContext/},()=>({path:'auth',namespace:'test-auth'}));build.onLoad({filter:/.*/,namespace:'test-auth'},()=>({contents:'export const useAuth = () => window.testAuth;',loader:'js'}));}}],define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const asset=readdirSync('dist/assets').find(n=>n.startsWith('index-')&&n.endsWith('.css'));
const css=readFileSync(join('dist/assets',asset),'utf8');
for(const [width,height] of [[360,900],[1440,1100]]){
 const fixture='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>#test-result{display:none}'+css+'</style><div id="root"></div><script>'+bundled.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script>';
 const escaped=fixture.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const html=join(directory,'test-'+width+'.html');writeFileSync(html,'<!doctype html><style>body{margin:0}iframe{border:0}#test-result{display:none}</style><iframe id="frame" style="width:'+width+'px;height:'+height+'px" srcdoc="'+escaped+'"></iframe><script>const timer=setInterval(()=>{const p=document.getElementById("frame").contentDocument.querySelector("#test-result");if(p){clearInterval(timer);const pre=document.createElement("pre");pre.id="test-result";pre.textContent=p.textContent;document.body.append(pre)}},100)</script>');
 const run=spawnSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless','--disable-gpu','--no-sandbox','--disable-extensions','--disable-background-networking','--no-first-run','--user-data-dir='+join(directory,'profile-'+width),'--window-size=1500,1250','--virtual-time-budget=23000','--dump-dom','--screenshot='+join(directory,'revenue-'+width+'.png'),new URL('file:///'+resolve(html).replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
 assert.equal(run.status,0,run.stderr);const match=run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);assert.ok(match,'Browser did not complete checks');const checks=JSON.parse(match[1].replaceAll('&amp;','&'));console.log(width,checks);assert.ok(checks.every(([,ok])=>ok),'Revenue UI failed');
}
console.log('Screenshots: '+directory);
