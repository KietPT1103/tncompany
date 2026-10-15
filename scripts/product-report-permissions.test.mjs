import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canAccessPath, getDefaultRouteForUser, getEffectivePermissions, MANAGED_PERMISSION_GROUPS } from '../src/lib/permissions.ts';

const reportUser = { role: 'server', permissions: ['reports.products.view'] };

test('product report permission opens only the requested report', () => {
  assert.equal(canAccessPath(reportUser, '/reports/products'), true);
  for (const path of ['/reports', '/reports/revenue', '/reports/profit']) {
    assert.equal(canAccessPath(reportUser, path), false, path);
  }
  assert.equal(getEffectivePermissions(reportUser).includes('reports.access'), false);
});

test('existing report viewers retain access to the product report', () => {
  assert.equal(canAccessPath({ role: 'manager', permissions: ['reports.access'] }, '/reports/products'), true);
  assert.equal(canAccessPath({ role: 'manager', permissions: [] }, '/reports/products'), false);
  assert.equal(canAccessPath({ role: 'admin', permissions: [] }, '/reports/products'), true);
});

test('a user with only product report access can land on that report', () => {
  assert.equal(getDefaultRouteForUser({ role: 'manager', permissions: ['reports.products.view'] }), '/reports/products');
});

test('permission editor has one group per displayed category and exposes active features', () => {
  const categories = MANAGED_PERMISSION_GROUPS.map(group => group.category.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase());
  assert.equal(new Set(categories).size, categories.length);
  const ids = MANAGED_PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.id));
  for (const id of ['bar.access', 'dashboard.access', 'reports.revenue.view', 'reports.profit.access', 'reports.products.view', 'reports.cost.access']) {
    assert.ok(ids.includes(id), id);
  }
});

test('individual report permissions stay isolated and all-report access inherits each one', () => {
  const reports = [['reports.revenue.view', '/reports/revenue'], ['reports.profit.access', '/reports/profit'], ['reports.products.view', '/reports/products'], ['reports.cost.access', '/reports']];
  for (const [permission, path] of reports) {
    const user = { role: 'manager', permissions: [permission] };
    for (const [, otherPath] of reports) assert.equal(canAccessPath(user, otherPath), path === otherPath, `${permission}: ${otherPath}`);
    assert.equal(canAccessPath({ role: 'manager', permissions: ['reports.access'] }, path), true);
  }
});

test('every backend permission is represented in the editor except the replaced legacy inventory alias', () => {
  const authSource = readFileSync(new URL('../public/api/_lib/auth.php', import.meta.url), 'utf8');
  const permissionBlock = authSource.split('function auth_all_permissions(): array')[1].split('function auth_default_permissions_for_role')[0];
  const backendPermissions = [...permissionBlock.matchAll(/'([a-z_]+(?:\.[a-z_]+)+)'/g)].map(match => match[1]);
  const editorPermissions = MANAGED_PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.id));
  for (const permission of backendPermissions) {
    if (permission === 'preparation_inventory.access') continue;
    assert.ok(editorPermissions.includes(permission), `Missing from editor: ${permission}`);
  }
  for (const permission of editorPermissions) assert.ok(backendPermissions.includes(permission), `Backend would discard: ${permission}`);
});
