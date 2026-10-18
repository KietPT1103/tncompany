import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessPath, getDefaultRouteForUser, MANAGED_PERMISSION_GROUPS } from '../src/lib/permissions.ts';
test('usage report requires its own permission and can be the default landing page', () => {
  assert.equal(canAccessPath({ role: 'server', permissions: [] }, '/reports/ingredient-usage'), false);
  const user = { role: 'server', permissions: ['reports.ingredient_usage.view'] };
  assert.equal(canAccessPath(user, '/reports/ingredient-usage'), true);
  assert.equal(canAccessPath(user, '/reports/revenue'), false);
  assert.equal(getDefaultRouteForUser(user), '/reports/ingredient-usage');
});
test('all-report permission inherits usage report and editor exposes it', () => {
  assert.equal(canAccessPath({ role: 'manager', permissions: ['reports.access'] }, '/reports/ingredient-usage'), true);
  assert.ok(MANAGED_PERMISSION_GROUPS.flatMap(group => group.items).some(item => item.id === 'reports.ingredient_usage.view'));
});
