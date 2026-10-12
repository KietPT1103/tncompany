import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Catch clipped totals/actions and inaccessible final rows using the production CSS.
const dialog = readFileSync('src/app/(dashboard)/product/issues/InventoryIssueFormDialog.tsx', 'utf8');
const page = readFileSync('src/app/(dashboard)/product/issues/page.tsx', 'utf8');
const classFor = (source, pattern) => source.match(pattern)[1];
const dialogClass = classFor(dialog, /aria-labelledby="issue-form-title" className="([^"]+)"/);
const panelClass = classFor(page, /<section className="(inventory-issue-form[^"]+)"/);
const metaClass = classFor(page, /className="(inventory-issue-meta[^"]+)"/);
const tableClass = classFor(page, /className="(inventory-issue-lines[^"]+)"/);
const actionClass = classFor(page, /className="(inventory-issue-actions[^"]+)"/);
const saveClass = classFor(page, /className="(inventory-issue-save[^"]+)"/);
const asset = readdirSync('dist/assets').find(name => name.startsWith('index-') && name.endsWith('.css'));
assert.ok(asset, 'Run npm run build before the layout check');
const css = readFileSync(join('dist/assets', asset), 'utf8') + '\n' + readFileSync('src/admin.css', 'utf8');
const labels = [...page.matchAll(/data-label="([^"]+)"/g)].map(match => match[1]);
const directory = mkdtempSync(join(tmpdir(), 'issue-dialog-'));
const file = join(directory, 'test.html');
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
for (const [width, height] of [[1705,948],[1280,720],[390,844],[320,568],[844,390]]) {
 const fixture = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>
 <div class="warehouse-ui fixed inset-0 flex items-center justify-center p-2 sm:p-4"><section id="dialog" class="${dialogClass}">
 <header class="flex shrink-0 items-center justify-between p-3"><h2>Issue form</h2><button>Close</button></header>
 <section class="${panelClass}"><div class="${metaClass}">${['Date','Destination','Issuer','Note'].map(label=>`<label>${label}<input class="mt-2 w-full" value="Sample"></label>`).join('')}</div>
 <div id="list" class="inventory-issue-items overflow-auto"><table class="${tableClass}"><thead><tr>${labels.map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody id="rows"></tbody></table></div>
 <div class="inventory-issue-footer border-t bg-white"><div id="summary" class="flex flex-wrap justify-between gap-1 bg-emerald-50 px-3 py-2"><span>Total: 30</span><span>Value: 1,000,000</span></div>
 <div class="${actionClass}"><button id="add" class="min-h-10">Add line</button><div class="${saveClass}"><button class="min-h-11">Save draft</button><button class="min-h-11">Complete and deduct stock</button></div></div></div>
 </section></section></div><script>
 const rows=document.getElementById('rows'),add=document.getElementById('add'),list=document.getElementById('list');
 const labels=${JSON.stringify(labels)};let count=0;
 function append(){count++;const row=document.createElement('tr');row.innerHTML=labels.map((label,index)=>'<td data-label="'+label+'">'+(index===0?count:index===2?'<select><option>Ingredient name</option></select>':index===3||index===7?'<input value="1">':'Sample')+'</td>').join('');rows.append(row)}
 for(let i=0;i<9;i++)append();add.onclick=append;
 const checks=[];function check(label,value){checks.push([label,!!value])}
 function visible(element){const r=element.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&hit&&(element===hit||element.contains(hit))}
 check('exact viewport',innerWidth===${width}&&innerHeight===${height});
 check('list can scroll',getComputedStyle(list).overflowY==='auto');
 check('add visible at 9 rows',visible(add));
 for(let i=0;i<21;i++){if(!visible(add))break;add.click()}
 check('can add through 30 rows',count===30);check('add remains visible',visible(add));
 check('total visible with 30 rows',visible(document.getElementById('summary')));
 check('save actions visible',[...document.querySelectorAll('.inventory-issue-save button')].every(visible));
 list.scrollTop=list.scrollHeight;check('last row reachable',rows.lastElementChild.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom+1);
 if(innerWidth<640){check('mobile cards',getComputedStyle(rows.firstElementChild).display==='grid');check('no horizontal scrolling',list.scrollWidth<=list.clientWidth+1)}
 parent.document.getElementById('result').textContent=JSON.stringify(checks);
 </script>`;
 writeFileSync(file, `<!doctype html><pre id="result"></pre><iframe style="border:0;width:${width}px;height:${height}px" srcdoc="${fixture.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')}"></iframe>`);
 const run=spawnSync(chrome,['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${join(directory,`${width}-${height}`)}`,'--window-size=1800,1100','--virtual-time-budget=2000','--dump-dom',new URL('file:///'+resolve(file).replaceAll('\\','/')).href],{encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stderr);const match=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);assert.ok(match,'Missing browser results');
 const checks=JSON.parse(match[1]);console.log(`${width}x${height}`,checks);assert.ok(checks.every(([,ok])=>ok),'Issue form inaccessible');
}
