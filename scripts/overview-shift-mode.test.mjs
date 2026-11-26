import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';

const bundled = await build({
  entryPoints: ['src/services/overviewShiftService.ts'], bundle: true, write: false,
  format: 'esm', platform: 'node', alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'shift-api-fixture', setup(builder) {
    builder.onResolve({ filter: /services\/posApi$/ }, () => ({ path: 'pos-api', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const posRequest=(...args)=>globalThis.overviewRequest(...args);', loader: 'js' }));
  } }],
});
const service = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
let requested = [];
globalThis.overviewRequest = async (resource, options, params) => {
  assert.equal(resource, 'shifts');
  requested.push(params.shiftType);
  return { items: [] };
};
const range = { storeId: 'cafe', startDate: new Date('2026-11-13T00:00:00+07:00'), endDate: new Date('2026-11-13T23:59:59+07:00') };
await service.loadOverviewShiftRevenue(range);
assert.deepEqual(requested, ['shift_1', 'shift_2', 'shift_3'], 'Cafe overview retains its three-shift scope');
requested = [];
await service.loadOverviewShiftRevenue({ ...range, storeId: 'cart', includeSingleShifts: true });
assert.deepEqual(requested, ['shift_1', 'shift_2', 'shift_3', 'single']);
console.log('PASS overview shift scope for cafe and configured takeaway');

globalThis.overviewRequest = async (resource, options, params) => {
  if (resource === 'shifts') return { items: params.shiftType === 'shift_2' ? [{
    id: 'overnight', shiftType: 'shift_2', businessDate: '2026-11-12',
    openedAt: { seconds: new Date('2026-11-13T00:10:00+07:00').getTime() / 1000 },
  }] : [] };
  assert.equal(resource, 'bills');
  assert.equal(params.shiftId, 'overnight');
  assert.equal(params.startDate, undefined, 'Shift sales include bills beyond the calendar range');
  assert.equal(params.endDate, undefined);
  return { items: [{ status: 'completed', total: 50000, items: [] }] };
};
const weekly = await service.loadOverviewWeeklyQuantity({
  storeId: 'cart', startDate: new Date('2026-11-09T00:00:00+07:00'), endDate: new Date('2026-11-15T23:59:59+07:00'),
});
assert.equal(weekly.find(row => row.dateKey === '2026-11-12').shifts.shift_2.revenue, 50000);
assert.equal(weekly.find(row => row.dateKey === '2026-11-13').shifts.shift_2.revenue, 0);
console.log('PASS weekly takeaway sales follow the business date across midnight');
