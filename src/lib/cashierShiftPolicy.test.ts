import assert from 'node:assert/strict';
import test from 'node:test';
import { supportsCashierShifts } from './cashierShiftPolicy.ts';

test('existing stores keep shift behavior without store metadata',()=>{
  for(const id of ['cafe','restaurant','bakery'])assert.equal(supportsCashierShifts(id),true);
  for(const id of ['farm','warehouse','store_other',''])assert.equal(supportsCashierShifts(id),false);
});
test('new takeaway stores get cashier opening and closing shifts',()=>{
  assert.equal(supportsCashierShifts('store_bau',{isTakeAway:true}),true);
  assert.equal(supportsCashierShifts('store_bau',{isTakeAway:false}),false);
  assert.equal(supportsCashierShifts('store_bau'),false);
});
