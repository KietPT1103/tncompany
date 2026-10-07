import assert from 'node:assert/strict';
import { aggregateDailyRevenue, createDailyRevenueWorkbook, revenueRangeDate } from './dailyRevenueReport.ts';
const seconds = (date) => new Date(date).getTime() / 1000;
const rows = aggregateDailyRevenue([
  { total: 100000, createdAt: { seconds: seconds('2026-10-01T17:00:00Z') } },
  { total: 50000, createdAt: { seconds: seconds('2026-10-02T16:59:59Z') } },
  { total: 20000, createdAt: { seconds: seconds('2026-10-01T16:59:59Z') } },
  { total: 999999, status: 'cancelled', createdAt: { seconds: seconds('2026-10-02T00:00:00Z') } },
  { total: 1, createdAt: { seconds: seconds('2026-10-02T17:00:00Z') } },
], '2026-10-01', '2026-10-02');
assert.deepEqual(rows, [{ date: '2026-10-02', revenue: 150000 }, { date: '2026-10-01', revenue: 20000 }]);
assert.equal(revenueRangeDate('2026-10-02').toISOString(), '2026-10-01T17:00:00.000Z');
assert.equal(revenueRangeDate('2026-10-02', true).toISOString(), '2026-10-02T16:59:59.999Z');
assert.deepEqual(aggregateDailyRevenue([], '2026-10-01', '2026-10-02'), []);
assert.throws(() => aggregateDailyRevenue([{ total: 5 }], '2026-10-01', '2026-10-02'));
const workbook = await createDailyRevenueWorkbook(rows, '2026-10-01', '2026-10-02', 'Cafe');
const bytes = await workbook.xlsx.writeBuffer();
const { default: ExcelJS } = await import('exceljs');
const readback = new ExcelJS.Workbook();
await readback.xlsx.load(bytes);
const sheet = readback.worksheets[0];
assert.equal(sheet.columnCount, 2);
assert.equal(sheet.getCell('B7').value, 170000);
assert.equal(sheet.getCell('B8').value, 150000);
assert.equal(sheet.getCell('A8').numFmt, 'dd/mm/yyyy');
assert.equal(sheet.getCell('A8').value.toISOString(), '2026-10-02T00:00:00.000Z');
console.log('Daily revenue aggregation and XLSX round-trip passed.');
