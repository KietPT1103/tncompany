import assert from 'node:assert/strict';
import test from 'node:test';
import { businessDate, isPreviousDayShift, shiftAcknowledgementKey } from './shiftDay.ts';
test('Vietnam day changes at 17:00 UTC even on a machine in another timezone', () => {
 assert.equal(businessDate(new Date('2026-10-21T16:59:59Z')), '2026-10-21');
 assert.equal(businessDate(new Date('2026-10-21T17:00:00Z')), '2026-10-22');
});
test('only shifts opened before the Vietnam business date need acknowledgement', () => {
 const now = new Date('2026-10-22T06:00:00Z');
 assert.equal(isPreviousDayShift({ openedAt: { seconds: Date.parse('2026-10-21T10:43:26Z') / 1000 } }, now), true);
 assert.equal(isPreviousDayShift({ openedAt: { seconds: Date.parse('2026-10-21T17:00:00Z') / 1000 } }, now), false);
 assert.equal(isPreviousDayShift(null, now), false);
});
test('acknowledgement expires the next day and after an opening-time correction', () => {
 const shift = { id: 'shift', openedAt: { seconds: 100 } };
 assert.notEqual(shiftAcknowledgementKey(shift,new Date('2026-10-22T06:00:00Z')),shiftAcknowledgementKey(shift,new Date('2026-10-23T06:00:00Z')));
 assert.notEqual(shiftAcknowledgementKey(shift,new Date('2026-10-22T06:00:00Z')),shiftAcknowledgementKey({...shift,openedAt:{seconds:200}},new Date('2026-10-22T06:00:00Z')));
});
