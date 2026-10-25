import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = buildSync({ stdin: { contents: `export { getAdjustedShiftHandover, getDailyAdjustedHandover, summarizeBillsForShift } from './src/services/shiftService.ts'; export { transferOutForShifts, transferVoucherNote } from './src/services/cashVoucherService.ts';`, resolveDir: root, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', define: { 'import.meta.env': '{}' } });
const mod = { exports: {} };
new Function('module','exports','require',built.outputFiles[0].text)(mod,mod.exports,createRequire(import.meta.url));
const { getAdjustedShiftHandover, getDailyAdjustedHandover, summarizeBillsForShift, transferOutForShifts, transferVoucherNote } = mod.exports;
const voucher = { id:'v', code:'T1', type:'income', amount:10000000, includeInCashFlow:true, sourceShiftId:'s1', shiftId:'s3', sourceShiftLabel:'Ca 1', receiverShiftLabel:'Ca 3' };
const shifts = [ { id:'s1', status:'closed', openingCash:100, closingCash:10000100 }, { id:'s2', status:'closed', openingCash:100, closingCash:10000100 }, { id:'s3', status:'closed', openingCash:100, closingCash:20000100 } ];
test('raw recorded receiver cash already contains incoming, source loses transfer once', () => {
  assert.deepEqual(shifts.map(s => getAdjustedShiftHandover(s, [], [voucher])), [0,10000000,20000000]);
  assert.equal(shifts.reduce((sum,s) => sum+getAdjustedShiftHandover(s,[],[voucher]),0),30000000);
});
test('cancelled/excluded transfer restores derived source handover', () => {
  assert.equal(transferOutForShifts([{...voucher,isCancelled:true}],['s1']),0);
  assert.equal(transferOutForShifts([{...voucher,includeInCashFlow:false}],['s1']),0);
});
test('current receiver expected cash still contains income and local expenses', () => {
  const summary = summarizeBillsForShift([{status:'completed',paymentMethod:'cash',total:10000000}],100,[voucher,{type:'expense',amount:2000000}]);
  assert.equal(summary.expectedClosingCash,18000100);
  assert.equal(getAdjustedShiftHandover({id:'s3',status:'open',openingCash:100,closingCash:999},[{shiftId:'s3',status:'completed',total:10000000}],[voucher]),20000000);
});
test('note uses stored relation labels', () => {
  assert.match(transferVoucherNote(voucher),/Ca 1.*Ca 3/);
});
test('income source selection is required and receiver has no picker', () => {
  const source = readFileSync(path.join(root,'src/app/(dashboard)/pos/page.tsx'),'utf8');
  assert.match(source,/showVoucherModal === "income" && <div/);
  assert.match(source,/voucherFromShift && \(!activeShift \|\| !voucherSourceShiftId/);
  assert.match(source,/sourceShiftId: voucherFromShift \? voucherSourceShiftId : null/);
  assert.match(source,/shiftId: activeShift\?\.id/);
  assert.doesNotMatch(source,/<select[^>]*receiver/i);
  assert.match(source,/voucherSaveLock.current = true/);
});

test('daily all includes mixed single and numbered shifts plus unassigned cash', () => {
  const mixed = [{id:'single',status:'closed',shiftType:'single',openingCash:100,closingCash:2100}, {id:'numbered',status:'closed',shiftType:'shift_1',openingCash:100,closingCash:3100}];
  const vouchers = [{type:'income',amount:500,shiftId:'single'}, {type:'income',amount:200,shiftId:'numbered'}, {type:'income',amount:50}];
  const bills = [{shiftId:'single',status:'completed',total:1500}, {shiftId:'numbered',status:'completed',total:2800}, {status:'completed',total:100}];
  assert.equal(getDailyAdjustedHandover(mixed,bills,vouchers,true),5150);
  assert.equal(getDailyAdjustedHandover([mixed[1]],bills,vouchers,false),3150);
  const page = readFileSync(path.join(root,'src/app/(dashboard)/pos/page.tsx'),'utf8');
  assert.match(page,/getShiftsForReport\(\{ storeId, startDate: start, endDate: end, shiftType: "single" \}\)/);
});
