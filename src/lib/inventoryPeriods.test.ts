import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryPeriodRange, inventoryToday } from './inventoryPeriods.ts';
test('today and yesterday use Vietnam business dates across UTC midnight',()=>{
  assert.equal(inventoryToday(new Date('2026-10-07T18:00:00Z')),'2026-10-08');
  assert.deepEqual(inventoryPeriodRange('today','2026-10-08'),{from:'2026-10-08',to:'2026-10-08'});
  assert.deepEqual(inventoryPeriodRange('yesterday','2026-01-01'),{from:'2025-12-31',to:'2025-12-31'});
});
test('last week contains seven days including today',()=>{
  assert.deepEqual(inventoryPeriodRange('week','2026-10-03'),{from:'2026-09-27',to:'2026-10-03'});
});
test('this month ends today and last month includes its complete month',()=>{
  assert.deepEqual(inventoryPeriodRange('month','2026-10-08'),{from:'2026-10-01',to:'2026-10-08'});
  assert.deepEqual(inventoryPeriodRange('previousMonth','2026-01-08'),{from:'2025-12-01',to:'2025-12-31'});
});
test('last month handles leap February',()=>{
  assert.deepEqual(inventoryPeriodRange('previousMonth','2024-03-01'),{from:'2024-02-01',to:'2024-02-29'});
  assert.deepEqual(inventoryPeriodRange('previousMonth','2026-03-01'),{from:'2026-02-01',to:'2026-02-28'});
});
