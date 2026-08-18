import assert from "node:assert/strict";
import test from "node:test";
import {
  getBillActionVisibility,
  shouldActivateBillRow,
} from "./billRowInteraction.ts";

test("activates an invoice row with Enter or Space", () => {
  assert.equal(shouldActivateBillRow("Enter", true), true);
  assert.equal(shouldActivateBillRow(" ", true), true);
});

test("ignores unrelated keys and keyboard events from nested controls", () => {
  assert.equal(shouldActivateBillRow("ArrowDown", true), false);
  assert.equal(shouldActivateBillRow("Enter", false), false);
  assert.equal(shouldActivateBillRow(" ", false), false);
});

test("keeps the edit action beside cancel for an editable active invoice", () => {
  assert.deepEqual(getBillActionVisibility(true, true, false), {
    showEdit: true,
    showCancel: true,
    showColumn: true,
  });
});

test("keeps edit available but hides cancel for a cancelled invoice", () => {
  assert.deepEqual(getBillActionVisibility(true, true, true), {
    showEdit: true,
    showCancel: false,
    showColumn: true,
  });
});
