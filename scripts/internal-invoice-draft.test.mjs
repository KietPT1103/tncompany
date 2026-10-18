import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = fs.readFileSync('src/lib/internalInvoiceDraft.ts', 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {createInternalInvoiceRows, internalInvoicePayload} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const rows = createInternalInvoiceRows();
assert.equal(rows.length,12);
assert.equal(new Set(rows.map(r=>r.localId)).size,12);
assert.equal(internalInvoicePayload(rows).length,0);
rows[0] = {...rows[0],name:'Wood',quantity:'2',unitPrice:'3',categoryName:'Gỗ'};
assert.equal(internalInvoicePayload(rows)[0].categoryName,'Gỗ');
assert.equal(internalInvoicePayload(rows)[0].quantity,2);
for(const change of [{quantity:'0'},{unitPrice:'-1'},{unitPrice:'Infinity'},{quantity:'abc'},{name:''}]) {
 assert.throws(()=>internalInvoicePayload([{...rows[0],...change}]), /1/);
}
assert.equal(internalInvoicePayload(Array.from({length:15},()=>({...rows[0]}))).length,15);
console.log('PASS internal draft rows and strict validation');
