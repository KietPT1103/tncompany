import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function load(path) {
  const source = readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from('const posRequest=(...args)=>globalThis.shiftScopeRequest(...args);\n' + js).toString('base64'));
}
const bills = await load('src/services/billService.ts');
const shifts = await load('src/services/shiftService.ts');
let last;
globalThis.shiftScopeRequest = async (...args) => { last = args; return { items: [] }; };
for (const storeId of ['store_bau', 'store_new_takeaway', 'cafe', 'restaurant', 'bakery']) {
  await bills.getBillsByShift('shift-1', storeId);
  assert.equal(last[0], 'bills');
  assert.equal(last[2].storeId, storeId);
  assert.equal(last[2].shiftId, 'shift-1');
  assert.equal(last[2].includeCancelled, true);
  await shifts.closeShift('shift-1', { storeId, closingCash: 120000, summary: {} });
  assert.equal(last[0], 'shifts');
  assert.equal(last[1].method, 'PATCH');
  assert.deepEqual(JSON.parse(last[1].body), { id: 'shift-1', storeId, closingCash: 120000, summary: {} });
}
assert.throws(() => bills.getBillsByShift('shift-1', ''), /quầy/);
await assert.rejects(() => shifts.closeShift('shift-1', { storeId: '', closingCash: 0, summary: {} }), /quầy/);
const page = readFileSync('src/app/(dashboard)/pos/page.tsx', 'utf8');
assert.match(page, /getBillsByShift\(activeShift.id, activeShift.storeId\)/);
assert.match(page, /closeShift\(activeShift.id, \{\s*storeId: activeShift.storeId/);
console.log('PASS shift preview and close use owning store for takeaway and legacy stores; empty scope rejected');
