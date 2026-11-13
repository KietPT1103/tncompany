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
