import test from 'node:test';
import assert from 'node:assert/strict';
import { quickRange, validRange, loginRevenueTarget } from '../src/features/revenue/filters.ts';
test('Vietnam dates, presets, range cap and safe login return', () => {
  assert.deepEqual(quickRange('today',new Date('2026-10-25T18:00:00Z')), ['2026-10-26','2026-10-26']);
  assert.deepEqual(quickRange('week',new Date('2026-10-25T18:00:00Z')), ['2026-10-20','2026-10-26']);
  assert.equal(validRange('2026-02-30','2026-03-01'),false);
  assert.equal(validRange('2026-01-01','2026-04-03'),true);
  assert.equal(validRange('2026-01-01','2026-04-04'),false);
  assert.equal(loginRevenueTarget('/doanh-thu?source=mohomestay'),'/doanh-thu?source=mohomestay');
  assert.equal(loginRevenueTarget('/revenue?source=mohomestay'),'/doanh-thu?source=mohomestay');
  assert.equal(loginRevenueTarget('/doanh-thu/evil'),null);
  for(const target of ['//evil.test','https://evil.test','/admin','/revenue/evil','/revenue\\evil']) assert.equal(loginRevenueTarget(target),null);
});
