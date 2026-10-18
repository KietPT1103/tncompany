import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync(new URL('../src/services/inventoryReceiptService.ts', import.meta.url), 'utf8').replace('import { apiRequest } from "@/lib/api";', 'const apiRequest = (...args) => globalThis.receiptSearchRequest(...args);');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const service = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const product = { id: 'bread', productCode: 'SP000164', productName: 'Bánh Mì Hàn Quốc', unit: 'Cái', areaId: 'cafe', areaName: 'Cafe', attachedToCurrentArea: true, similar: false };
globalThis.receiptSearchRequest = async (path) => {
  const url = new URL(path, 'https://example.test');
  assert.equal(url.searchParams.get('areaId'), 'cafe');
  if (url.pathname === '/products.php') {
    assert.equal(url.searchParams.get('search'), 'Bánh');
    return { items: [product] };
  }
  if (url.pathname === '/inventory-warehouse-products.php') return { items: [] };
  if (url.pathname === '/ingredients.php') return { items: [{ id: 'flour', ingredientCode: 'NL1', ingredientName: 'Flour', unit: 'kg', storeId: 'cafe', cost: 100 }] };
  throw new Error(`Unexpected endpoint: ${path}`);
};
assert.deepEqual(await service.searchWarehouseProducts('Bánh', 'cafe', 'equipment'), [product], 'Existing products without receipt history must be selectable');
assert.deepEqual(await service.searchWarehouseProducts('  ', 'cafe', 'equipment'), [], 'Empty searches keep warehouse history suggestions');
assert.equal((await service.searchWarehouseProducts('Flour', 'cafe', 'ingredient'))[0].productCode, 'NL1');
delete globalThis.receiptSearchRequest;
console.log('PASS receipt product search: full catalog, empty history suggestions, ingredient isolation');
