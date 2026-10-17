import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/permissions.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const p = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
for (const role of ['user', 'server', 'bartender']) {
  const granted = { role, permissions: ['stores.switch'], storeId: 'cafe', storeIds: ['cafe', 'farm', 'warehouse'] };
  assert.equal(p.hasPermission(granted, 'stores.switch'), true, `${role}: grant preserved`);
  assert.equal(p.canSwitchStore(granted), true, `${role}: grant overrides role lock`);
  assert.deepEqual(p.getSelectableStoreIds(granted), ['cafe', 'farm', 'warehouse']);
  assert.equal(p.canSwitchStore({ ...granted, permissions: [] }), false);
  assert.equal(p.hasPermission({ role }, 'stores.switch'), false);
}
assert.equal(p.canSwitchStore(null), false);
assert.equal(p.canSwitchStore({ role: 'admin', permissions: [] }), true);
assert.equal(p.canSwitchStore({ role: 'manager', permissions: [] }), true);
assert.equal(p.getSelectableStoreIds({ role: 'admin' }), null);
assert.equal(p.getSelectableStoreIds({ role: 'manager' }), null);
assert.deepEqual(p.getSelectableStoreIds({ role: 'server', permissions: ['stores.switch'], storeId: 'restaurant' }), ['restaurant']);
assert.deepEqual(p.getSelectableStoreIds({ role: 'server', permissions: ['stores.switch'], storeIds: ['farm', 'unknown', 'farm'] }), ['farm']);
assert.deepEqual(p.getSelectableStoreIds({ role: 'server', permissions: ['stores.switch'] }), []);
assert.equal(p.canAccessPath({ role: 'server', permissions: ['stores.switch'] }, '/accounts'), false);
console.log('PASS store switching: explicit grants, role override, scoped options, legacy fallback');
