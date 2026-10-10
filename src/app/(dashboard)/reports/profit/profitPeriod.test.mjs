import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
// Run the same production module in Node while resolving its bundler-style TS import.
const source = await readFile(new URL('./profitPeriod.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace('"./dailyProfit"', JSON.stringify(new URL('./dailyProfit.ts', import.meta.url).href)).replace("'./dailyProfit'", JSON.stringify(new URL('./dailyProfit.ts', import.meta.url).href));
const { profitPresetRange, calculateProfitPeriod } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const inputs = { salary: 20, electricity: 3, water: 2, other: 10, marketing: 0, costOverrides: {} };
const days = [{ date: '2026-10-07', saved: null, source: { revenue: 100, billCount: 1, sales: [], vouchers: [{ id: 'v1', code: 'PC1', category: 'Chi', amount: 5 }] } }, { date: '2026-10-08', saved: null, source: { revenue: 200, billCount: 1, sales: [], vouchers: [] } }];
test('week starts Monday and crosses year boundaries', () => {
  assert.deepEqual(profitPresetRange('week','2026-10-08'), { startDate: '2026-10-05', endDate: '2026-10-11' });
  assert.deepEqual(profitPresetRange('week','2027-01-01'), { startDate: '2026-12-28', endDate: '2027-01-03' });
});
test('month includes all days including leap day; invalid dates rejected', () => {
  assert.deepEqual(profitPresetRange('month','2024-02-15'), { startDate: '2024-02-01', endDate: '2024-02-29' });
  assert.throws(() => profitPresetRange('day','2026-02-30'));
});
test('period sums daily profit and uses total revenue for margin', () => {
  const result = calculateProfitPeriod(days, { '2026-10-07': inputs, '2026-10-08': inputs });
  assert.equal(result.profit, 225);
  assert.equal(result.margin, 75);
});
test('one missing day prevents a partial result being shown as the full period', () => {
  const result = calculateProfitPeriod(days, { '2026-10-07': inputs });
  assert.equal(result.profit, null);
  assert.deepEqual(result.missingDays, ['2026-10-08']);
  assert.equal(calculateProfitPeriod([], {}).complete, false);
});

test('period includes new daily adjustments without counting inventory or debt as expenses', () => {
  const adjusted = { ...inputs, thienExpense: 7, ingredientInventory: 12, debt: 3 };
  const result = calculateProfitPeriod(days, { '2026-10-07': adjusted, '2026-10-08': adjusted });
  assert.equal(result.totalCosts, 89);
  assert.equal(result.profit, 229);
});
