import assert from 'node:assert/strict';
import test from 'node:test';
import { estimatePeriodForDate } from '../src/lib/estimatePeriods.ts';

test('weeks start on Monday and may cross year boundaries', () => {
  assert.deepEqual(estimatePeriodForDate('2027-01-03', 'week'), {startDate:'2026-12-28',endDate:'2027-01-03'});
  assert.deepEqual(estimatePeriodForDate('2026-10-05', 'week'), {startDate:'2026-10-05',endDate:'2026-10-11'});
});
test('month boundaries account for leap years and December', () => {
  assert.deepEqual(estimatePeriodForDate('2028-02-29', 'month'), {startDate:'2028-02-01',endDate:'2028-02-29'});
  assert.deepEqual(estimatePeriodForDate('2026-12-15', 'month'), {startDate:'2026-12-01',endDate:'2026-12-31'});
});
test('rejects impossible or incomplete dates', () => {
  for (const value of ['2026-02-29', '2026-10', '', '2026-13-01']) assert.throws(() => estimatePeriodForDate(value, 'week'));
});
