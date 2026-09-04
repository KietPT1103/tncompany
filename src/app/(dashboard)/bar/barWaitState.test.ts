import assert from "node:assert/strict";
import test from "node:test";
import {
  BAR_URGENT_PULSE_INTERVAL_MS,
  getBarUrgentPulsePhase,
  getBarWaitState,
} from "./barWaitState.ts";

test("bills from 0 through 5 minutes stay in the normal state", () => {
  assert.equal(getBarWaitState(0), "normal");
  assert.equal(getBarWaitState(5), "normal");
});

test("bills from 6 through 11 minutes enter the warning state", () => {
  assert.equal(getBarWaitState(6), "warning");
  assert.equal(getBarWaitState(10), "warning");
  assert.equal(getBarWaitState(11), "warning");
});

test("bills become urgent only after waiting more than 11 minutes", () => {
  assert.equal(getBarWaitState(12), "urgent");
  assert.equal(getBarWaitState(60), "urgent");
});

test("all urgent bills derive their pulse phase from the same clock", () => {
  assert.equal(getBarUrgentPulsePhase(0), true);
  assert.equal(getBarUrgentPulsePhase(BAR_URGENT_PULSE_INTERVAL_MS - 1), true);
  assert.equal(getBarUrgentPulsePhase(BAR_URGENT_PULSE_INTERVAL_MS), false);
  assert.equal(getBarUrgentPulsePhase(BAR_URGENT_PULSE_INTERVAL_MS * 2), true);
});
