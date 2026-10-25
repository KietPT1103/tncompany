import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission, getDefaultPermissionsForRole } from '../src/lib/permissions.ts';
test('admin automatically accesses hub; other roles require explicit grants', () => {
  assert.equal(hasPermission({role:'admin', permissions:[]}, 'revenue_hub.view'), true);
  assert.equal(getDefaultPermissionsForRole('admin').includes('revenue_hub.view'), true);
  assert.equal(hasPermission({role:'user', permissions:['reports.access']}, 'revenue_hub.view'), false);
  for (const role of ['manager','user','server','bartender']) {
    assert.equal(hasPermission({role, permissions:['revenue_hub.view']}, 'revenue_hub.view'), true);
    assert.equal(hasPermission({role, permissions:[]}, 'revenue_hub.view'), false);
  }
  assert.equal(hasPermission({role:'admin', permissions:[]}, 'accounts.access'), true);
});
