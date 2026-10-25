import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, getDefaultPermissionsForRole } from '../src/lib/permissions.ts';
test('hub requires an explicit grant even for admin and reports access', () => {
  assert.equal(hasPermission({role:'admin', permissions:[]}, 'revenue_hub.view'), false);
  assert.equal(getDefaultPermissionsForRole('admin').includes('revenue_hub.view'), false);
  assert.equal(hasPermission({role:'user', permissions:['reports.access']}, 'revenue_hub.view'), false);
  for (const role of ['admin','manager','user']) {
    assert.equal(hasPermission({role, permissions:['revenue_hub.view']}, 'revenue_hub.view'), true);
    assert.equal(hasPermission({role, permissions:[]}, 'revenue_hub.view'), false);
  }
  assert.equal(hasPermission({role:'admin', permissions:[]}, 'accounts.access'), true);
});
