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
import RevenueAccessCode from './src/features/outside-expenses/RevenueAccessCode.tsx';
import {DateRangePicker} from './src/components/ui/DateRangePicker.tsx';
const metrics={revenue:1234567,cash:1000000,transfer:234567,cups:150,bakery:42,expense:50000,income:10000,bills:65};
const mo={room:4000000,retail:200000,surcharge:121000,collected:4321000,cash:1000000,transfer:3321000,expense:200000,other:0,bookings:8};
window.testAuth={user:null,loading:false};
localStorage.removeItem('tn_revenue_access_token');
let accessValid=true,accessHang=false,generated=0;const revenueToken='a'.repeat(64);
let requests=[],fail=false,delay=30;
window.fetch=async(url,options)=>{
 if(String(url).includes('revenue-access-code.php')){generated++;const body=JSON.parse(options.body);return new Response(JSON.stringify({ok:true,data:{code:body.code||'ABCD-1234-5678-90EF'}}));}
 if(String(url).includes('revenue-access.php')){
  if(accessHang)await new Promise(r=>setTimeout(r,30000));
  if(options.method==='POST'){const ok=JSON.parse(options.body).code==='Open-123';return new Response(JSON.stringify({ok,data:{token:revenueToken},error:ok?undefined:'Mã xem doanh thu không đúng.'}),{status:ok?200:403});}
  return new Response(JSON.stringify({ok:true,data:{unlocked:accessValid&&new Headers(options.headers).get('Authorization')==='Bearer '+revenueToken}}));
 }
 if(!accessValid||new Headers(options.headers).get('Authorization')!=='Bearer '+revenueToken)return new Response(JSON.stringify({ok:false,error:'Vui lòng nhập mã xem doanh thu.',meta:{code:'REVENUE_LOCKED'}}),{status:403});
 const q=new URL(String(url),'http://test').searchParams;requests.push(q);const source=q.get('source');const from=q.get('from'),to=q.get('to');
 const data={version:1,source,from,to,updatedAt:'2026-10-25T10:30:00Z',totals:source==='tnservice'?metrics:mo,stores:[{id:'cafe',name:'Cà phê'}],days:[{date:from,totals:source==='tnservice'?metrics:mo,shifts:{shift_1:metrics,shift_2:{...metrics,revenue:0},shift_3:{...metrics,revenue:0}},transactions:[{type:'room',code:'MO-1',room:'Phòng Mơ',amount:4000000,time:'2026-10-25T03:00:00Z',payment:'transfer'}]}]};
 if(source==='tnservice') data.cashflow={complete:true,provisional:false,grossHandover:30000000,outsideExpense:15000000,netHandover:15000000,days:[{date:from,grossHandover:30000000,outsideExpense:15000000,netHandover:15000000,complete:true,provisional:false,syncStatus:'ready',lastSyncedAt:'2026-10-25T10:30:00Z',expenses:[{name:'Chi quảng cáo',amount:15000000,storeId:'cafe'}],shifts:[{id:'s1',storeId:'cafe',label:'Ca 1',baseHandover:10000000,transferIn:0,transferOut:10000000,handover:0,outsideExpense:0,netHandover:0,status:'closed'},{id:'s2',storeId:'cafe',label:'Ca 2',baseHandover:10000000,transferIn:0,transferOut:0,handover:10000000,outsideExpense:0,netHandover:10000000,status:'closed'},{id:'s3',storeId:'cafe',label:'Ca 3',baseHandover:20000000,transferIn:10000000,transferOut:0,handover:20000000,outsideExpense:15000000,netHandover:5000000,status:'closed'}]}]};
 if(source==='tnservice'&&q.get('store')==='all'){
  data.cashflow.complete=false;data.cashflow.outsideExpense=null;data.cashflow.netHandover=null;
  Object.assign(data.cashflow.days[0],{complete:false,outsideExpense:null,netHandover:null,syncStatus:'missing'});
 }
 const bad=fail;await new Promise(r=>setTimeout(r,delay));return new Response(JSON.stringify({ok:!bad,data,error:bad?'Nguồn tạm ngưng':undefined}),{status:bad?502:200});
};
const root=createRoot(document.getElementById('root'));
function Login(){return <pre id='login-target'>{useLocation().search}</pre>}
const render=()=>root.render(<MemoryRouter initialEntries={['/doanh-thu?source=tnservice&from=2026-10-25&to=2026-10-25']}><Routes><Route path='/doanh-thu' element={<RevenuePage/>}/><Route path='/login' element={<Login/>}/></Routes></MemoryRouter>);
render();
const checks=[];const check=(n,v)=>checks.push([n,!!v,...(v?[]:[document.getElementById('root').textContent.slice(0,500),requests.at(-1)?.toString()])]);
const wait=(ms=120)=>new Promise(r=>setTimeout(r,ms));
const fill=(element,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));};
const btn=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
(async()=>{
 await wait(200);check('public visitor sees code gate',!!document.querySelector('input[type="password"]')&&!document.querySelector('#login-target'));check('no report fetched before unlock',requests.length===0);
 fill(document.querySelector('input[type="password"]'),'wrong');btn('Mở trang doanh thu').click();await wait(200);check('wrong code stays locked',!!document.querySelector('[role="alert"]')&&requests.length===0);
 fill(document.querySelector('input[type="password"]'),'Open-123');btn('Mở trang doanh thu').click();await wait(450);check('unlock remembers token not code',localStorage.getItem('tn_revenue_access_token')===revenueToken);
 check('TN report loads',document.getElementById('root').textContent.includes('1.234.567'));check('all three shifts visible',document.getElementById('root').textContent.includes('Ca 3'));
 const cf=document.querySelector('section[aria-label="Dòng tiền thực tế"]');const costs=cf?.querySelector('details[data-expense-list]');
 check('vertical cash subtraction shows correct total',cf?.textContent.includes('30.000.000')&&cf?.textContent.includes('15.000.000')&&cf?.textContent.includes('Bàn giao sau chi'));
 check('outside expense list starts collapsed',costs&&!costs.open&&!costs.querySelector('li').checkVisibility());
 check('formula is above outside expense list',Boolean(cf.querySelector('dl').compareDocumentPosition(costs)&Node.DOCUMENT_POSITION_FOLLOWING));
 costs.querySelector('summary').click();await wait();check('expanded expense shows name and amount',costs.open&&costs.textContent.includes('Chi quảng cáo')&&costs.textContent.includes('15.000.000'));costs.querySelector('summary').click();await wait();
 check('no mobile overflow',document.documentElement.scrollWidth<=innerWidth);
 check('default counter is cafe',requests[0].get('store')==='cafe'&&document.querySelector('select[aria-label="Quầy"]').value==='cafe');
 const select=document.querySelector('select[aria-label="Quầy"]');
 select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));await wait(250);
 const combined=document.querySelector('section[aria-label="Dòng tiền thực tế"]');
 check('all counters retain expense total with missing sources',combined.textContent.includes('15.000.000')&&combined.textContent.includes('Tạm tính'));
 const list=combined.querySelector('details[data-expense-list]');list.querySelector('summary').click();await wait();
 check('all counters show visible counter tag',list.querySelector('[data-store-tag="cafe"]')?.checkVisibility());
 check('all counters no mobile overflow',document.documentElement.scrollWidth<=innerWidth);
 select.value='cafe';select.dispatchEvent(new Event('change',{bubbles:true}));await wait(250);
 check('single counter hides counter tags',!document.querySelector('[data-store-tag]'));
 check('one day hides chart' ,!document.querySelector('[aria-label="Doanh thu theo ngày"]'));
 const n=requests.length;document.querySelector('button[aria-label="Tải lại"]').click();await wait(250);check('reload fetches again',requests.length===n+1);
 btn('7 ngày').click();await wait(250);check('quick range applies',requests.at(-1).get('from')!==requests.at(-1).get('to'));check('multiple days show chart',!!document.querySelector('[aria-label="Doanh thu theo ngày"]'));
 const picker=document.querySelector('button[aria-haspopup="dialog"]');check('one date range field',!!picker&&!document.querySelector('input[type="date"]'));picker.click();await wait();
 check('calendar opens without mobile overflow',!!document.querySelector('[role="dialog"]')&&document.documentElement.scrollWidth<=innerWidth);
 const day=value=>[...document.querySelectorAll('[role="dialog"] button')].find(b=>b.textContent.trim()===String(value));
 const beforePick=requests.length;day(25).click();await wait();check('first date waits for second click',requests.length===beforePick);day(26).click();await wait(250);
 check('two date clicks apply automatically',!document.querySelector('[role="dialog"]')&&requests.at(-1).get('from')==='2026-10-25'&&requests.at(-1).get('to')==='2026-10-26');
 document.querySelector('button[aria-haspopup="dialog"]').click();await wait();day(25).click();await wait();day(25).click();await wait(250);check('same date twice hides chart',requests.at(-1).get('from')===requests.at(-1).get('to')&&!document.querySelector('[aria-label="Doanh thu theo ngày"]'));

 delay=500;btn('MoHomestay').click();await wait(30);check('old source cleared while loading',!document.getElementById('root').textContent.includes('1.234.567'));btn('TN Service').click();delay=20;await wait(650);check('stale Mo response ignored',!document.getElementById('root').textContent.includes('4.321.000')&&document.getElementById('root').textContent.includes('1.234.567'));
 fail=true;btn('MoHomestay').click();await wait(250);check('source error visible',document.querySelector('[role="alert"]')?.textContent.includes('Nguồn tạm ngưng'));fail=false;btn('Thử lại').click();await wait(250);check('retry restores Mo report',document.getElementById('root').textContent.includes('4.321.000'));check('Mo has distinct native fields',document.getElementById('root').textContent.includes('Tiền phòng')&&!document.getElementById('root').textContent.includes('Ly nước'));
 check('mobile Mo no overflow',document.documentElement.scrollWidth<=innerWidth);
 delay=30000;document.querySelector('button[aria-label="Tải lại"]').click();await wait(14300);check('slow source times out with retry',document.querySelector('[role="alert"]')?.textContent.includes('Tải dữ liệu quá lâu'));delay=20;btn('TN Service').click();await wait(250);check('other source remains usable after timeout',document.getElementById('root').textContent.includes('1.234.567'));
 accessValid=false;document.querySelector('button[aria-label="Tải lại"]').click();await wait(200);
 check('revoked token returns to code gate',!!document.querySelector('input[type="password"]')&&!document.querySelector('section[aria-label="Dòng tiền thực tế"]'));
 check('revoked token removed',!localStorage.getItem('tn_revenue_access_token'));accessValid=true;
 root.unmount();
 const adminRoot=createRoot(document.getElementById('root'));let adminChanges=0;
 adminRoot.render(<DateRangePicker label="Khoảng ngày admin" startDate="2026-10-25" endDate="2026-10-25" onChange={()=>adminChanges++}/>);await wait();document.querySelector('button[aria-haspopup="dialog"]').click();await wait();day(25).click();await wait();day(26).click();await wait();check('admin picker still waits for apply',adminChanges===0&&!!document.querySelector('[role="dialog"]'));btn('Áp dụng').click();await wait();check('admin apply still works',adminChanges===1&&!document.querySelector('[role="dialog"]'));adminRoot.unmount();
 const root2=createRoot(document.getElementById('root'));accessHang=true;localStorage.setItem('tn_revenue_access_token',revenueToken);
 root2.render(<MemoryRouter initialEntries={['/doanh-thu?source=tnservice&from=2026-10-25&to=2026-10-25']}><RevenuePage/></MemoryRouter>);await wait(14200);
 check('stalled access check offers retry',!!document.querySelector('[role="alert"]')&&!!btn('Thử lại'));accessHang=false;btn('Thử lại').click();await wait(350);
 check('remembered token opens without login or code prompt',!!document.querySelector('section[aria-label="Dòng tiền thực tế"]')&&!document.querySelector('input[type="password"]'));root2.unmount();
 localStorage.removeItem('tn_revenue_access_token');const root3=createRoot(document.getElementById('root'));root3.render(<MemoryRouter><RevenuePage/></MemoryRouter>);await wait(150);check('clearing browser storage requires code again',!!document.querySelector('input[type="password"]'));root3.unmount();
 const root4=createRoot(document.getElementById('root'));root4.render(<RevenueAccessCode/>);await wait(150);
 btn('Tạo mã xem doanh thu ngẫu nhiên').click();await wait(150);check('admin generates a code',generated===1&&document.querySelector('code')?.textContent==='ABCD-1234-5678-90EF');
 fill(document.querySelector('input'),'My-Own-123');btn('Lưu mã tự nhập').click();await wait(150);check('admin saves own code',generated===2&&document.querySelector('code')?.textContent==='My-Own-123');
 check('code controls fit mobile width',document.documentElement.scrollWidth<=innerWidth);
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
 const run=spawnSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless','--disable-gpu','--no-sandbox','--disable-extensions','--disable-background-networking','--no-first-run','--user-data-dir='+join(directory,'profile-'+width),'--window-size=1500,1250','--virtual-time-budget=40000','--dump-dom','--screenshot='+join(directory,'revenue-'+width+'.png'),new URL('file:///'+resolve(html).replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
 assert.equal(run.status,0,run.stderr);const match=run.stdout.match(/<pre id="test-result">([^<]+)<\/pre>/);assert.ok(match,'Browser did not complete checks');const checks=JSON.parse(match[1].replaceAll('&amp;','&'));console.log(width,checks);assert.ok(checks.every(([,ok])=>ok),'Revenue UI failed');
}
console.log('Screenshots: '+directory);
