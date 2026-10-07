import assert from 'node:assert/strict';
import test from 'node:test';
import { removeEstimateRole } from '../src/lib/estimateSchedule.ts';

test('removing a role clears every week while preserving other assignments and the original draft', () => {
  const schedule = {
    '2026-10-05__Thu ngân__shift_1':['employee-a'],
    '2026-10-12__Thu ngân__shift_3':['employee-b'],
    '2026-10-05__Phục vụ__shift_1':['employee-a'],
    '2026-10-05__Thu ngân phụ__shift_2':['employee-c'],
  };
  const previous = structuredClone(schedule);
  assert.deepEqual(removeEstimateRole(schedule,'Thu ngân'), {
    '2026-10-05__Phục vụ__shift_1':['employee-a'],
    '2026-10-05__Thu ngân phụ__shift_2':['employee-c'],
  });
  assert.deepEqual(schedule,previous);
});
test('allows removing the final board without leaving stale assignments', () => {
  assert.deepEqual(removeEstimateRole({'2026-10-05__Decor__shift_1':['employee-a']},'Decor'), {});
  assert.deepEqual(removeEstimateRole({},'Decor'), {});
});
