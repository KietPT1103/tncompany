import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=readFileSync(new URL('../src/app/(dashboard)/inventory/equipment-stock.tsx',import.meta.url),'utf8');
const start=source.indexOf('  async function saveStock()');
const end=source.indexOf('  const [items, setItems]',start);
const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
async function save(form) {
 let body,error;
 const context={editTarget:{productCode:'OLD',productName:'Cookie',unit:'piece',quantity:14,value:225000},editForm:form,editBusy:false,storeId:'cafe',date:'2026-10-18',
 apiRequest:async(url,options)=>{body=JSON.parse(options.body)},setError:message=>{error=message},setEditBusy:()=>{},setEditTarget:()=>{},setVersion:()=>{},window:{dispatchEvent:()=>{}},Event};
 const names=Object.keys(context);
 await new Function(...names,js+'\nreturn saveStock();')(...Object.values(context));
 return {body,error};
}
const renamed=await save({code:'SP000166',name:'New Cookie',unit:'piece',quantity:'14',reason:'Rename'});
assert.equal(renamed.body.quantity,undefined,'Metadata-only edit must omit count to avoid unintended stock correction');
assert.equal(renamed.body.productCode,'OLD');
assert.equal(renamed.body.newProductCode,'SP000166');
const counted=await save({code:'OLD',name:'Cookie',unit:'piece',quantity:'12',reason:'Physical count'});
assert.equal(counted.body.quantity,12);
assert.equal(counted.body.reason,'Physical count');
const denied=await save({code:'OLD',name:'Cookie',unit:'piece',quantity:'12',reason:''});
assert.equal(denied.body,undefined);
assert.ok(denied.error);
console.log('PASS stock edit requests: rename without count, intentional count with reason, missing-reason rejection');
