import assert from 'node:assert/strict';
import test from 'node:test';
import { getMonthlyEstimateCosts } from '../src/lib/estimateMonthlySalary.ts';

test('counts a monthly employee once per scheduled day, across shifts and months', () => {
  const result = getMonthlyEstimateCosts(9000000, [
    {date:'2026-11-30',role:'Bếp',hours:5},
    {date:'2026-11-30',role:'Bếp',hours:6},
    {date:'2026-12-01',role:'Bếp',hours:5},
  ]);
  assert.equal(result.salary,600000);
  assert.deepEqual(result.roleSalaries,{'Bếp':600000});
});

test('splits one daily salary across roles by hours, regardless of assignment order', () => {
  const shifts = [{date:'2026-11-02',role:'Pha chế',hours:5},{date:'2026-11-02',role:'Leader',hours:5}];
  assert.deepEqual(getMonthlyEstimateCosts(9000000,shifts),{
    salary:300000,roleSalaries:{'Pha chế':150000,Leader:150000},
  });
  assert.deepEqual(getMonthlyEstimateCosts(9000000,shifts.toReversed()),getMonthlyEstimateCosts(9000000,shifts));
});

test('removing the final assignment on a day removes its cost', () => {
  assert.equal(getMonthlyEstimateCosts(9000000,[]).salary,0);
  assert.equal(getMonthlyEstimateCosts(0,[{date:'2026-11-02',role:'Bếp',hours:5}]).salary,0);
});
