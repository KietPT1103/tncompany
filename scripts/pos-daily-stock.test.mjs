import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync('src/services/posDailyStock.ts','utf8').replace('import { apiRequest } from "@/lib/api";', 'const apiRequest = (...args) => globalThis.dailyStockRequest(...args);');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {getDailyPosStock}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
globalThis.dailyStockRequest=async path=>{
 const url=new URL(path,'https://test.local');
 assert.equal(url.pathname,'/inventory-pos-stock.php');
 assert.equal(url.searchParams.get('date'),'2026-10-18');
 assert.equal(url.searchParams.get('storeId'),'cafe');
 return {items:[{posCode:'SP1',opening:5,received:18,quantity:0},{posCode:'SP2',opening:0,received:0,quantity:-2}]};
};
const result=await getDailyPosStock('cafe','2026-10-18');
assert.deepEqual(result.SP1,{opening:5,received:18,quantity:0});
assert.deepEqual(result.SP2,{opening:0,received:0,quantity:-2});
assert.equal(result.UNLINKED,undefined);
delete globalThis.dailyStockRequest;
console.log('PASS daily POS stock: selected day/store, linked products, zero, deficit and unlinked');
