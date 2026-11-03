import { build } from 'esbuild';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const outfile=resolve('node_modules/.cache/revenue-cashflow-render-test.mjs');
await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Panel from './src/features/revenue/CashflowPanel.tsx'; export const render=(data,all)=>renderToStaticMarkup(<Panel data={data} allStores={all} stores={[{id:'cafe',name:'Cà phê'},{id:'bakery',name:'Bánh'}]}/>);`,resolveDir:process.cwd(),loader:'tsx'},outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
try {
 const {render}=await import(pathToFileURL(outfile).href);
 const day={date:'2026-10-26',grossHandover:2000,outsideExpense:null,netHandover:null,complete:false,provisional:false,shifts:[],syncStatus:'missing',lastSyncedAt:null,expenses:[{name:'Cà phê hạt',amount:200,storeId:'cafe'},{name:'Bột',amount:300,storeId:'bakery'}]};
 const data={complete:false,provisional:false,grossHandover:2000,outsideExpense:null,netHandover:null,days:[day]};
 const single=render(data,false);
 assert.ok(single.includes('Chưa đủ dữ liệu'));
 assert.ok(!single.includes('data-store-tag'));
 const all=render(data,true);
 assert.ok(all.includes('500 ₫'),'All counters show known expense total despite missing sources');
 assert.ok(all.includes('1.500 ₫'),'Net handover deducts known expenses');
 assert.ok(all.includes('Tạm tính'),'Partial totals must be labelled');
 assert.ok(all.includes('data-store-tag="cafe"')&&all.includes('data-store-tag="bakery"'),'Each expense identifies its counter');
 assert.ok(all.includes('Cà phê')&&all.includes('Bánh'));
 const empty=render({...data,days:[{...day,expenses:[]}]},true);
 assert.ok(!empty.includes('>0 ₫'),'Missing data must not appear as confirmed zero');
 console.log('Cashflow rendering: PASS');
} finally {unlinkSync(outfile);}
