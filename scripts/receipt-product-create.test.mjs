import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
let source = readFileSync(new URL('../src/services/inventoryReceiptService.ts', import.meta.url), 'utf8');
source = source.replace('import { apiRequest } from "@/lib/api";', 'const apiRequest = (...args) => globalThis.receiptTestRequest(...args);');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const service = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
let request;
globalThis.receiptTestRequest = async (url, options) => {
  request = { url, body: JSON.parse(options.body) };
  return { item: url === '/products.php'
    ? { id: 'product-1', productCode: 'SP000165', productName: 'Cake', unit: 'cai', areaId: 'cafe' }
    : { id: 'ingredient-1', ingredientCode: 'NL000123', ingredientName: 'Flour', unit: 'cai', storeId: 'cafe' } };
};
const cake = await service.createReceiptProduct({ areaId: 'cafe', ingredientName: ' Cake ', warehouseType: 'equipment' });
assert.equal(request.url, '/products.php', 'Equipment must use server-generated product codes');
assert.equal(request.body.productCode, undefined, 'Do not send a manually generated code');
assert.equal(request.body.productName, 'Cake');
assert.equal(request.body.unit, '\u0063\u00e1\u0069');
assert.equal(request.body.isSelling, false, 'Creating a receipt item must not put it on sale');
assert.equal(cake.productCode, 'SP000165');
assert.equal(cake.attachedToCurrentArea, true);
await service.createReceiptProduct({ areaId: 'cafe', ingredientName: 'Flour', warehouseType: 'ingredient', unit: ' kg ' });
assert.equal(request.url, '/ingredients.php');
assert.equal(request.body.ingredientCode, undefined);
assert.equal(request.body.ingredientName, 'Flour');
assert.equal(request.body.unit, 'kg');
await service.createReceiptProduct({ areaId: 'cafe', ingredientName: 'Flour', unit: ' ' });
assert.equal(request.body.unit, '\u0063\u00e1\u0069');
delete globalThis.receiptTestRequest;
console.log('PASS receipt creation: name-only, server-generated code, default/custom unit, no implicit POS sale');
