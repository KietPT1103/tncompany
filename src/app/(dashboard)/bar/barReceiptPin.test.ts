import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowBarReceiptPin } from "./barReceiptPin.ts";

test("shows a pin only on the original receipt segment", () => {
  assert.equal(shouldShowBarReceiptPin({ isContinuation: false }), true);
  assert.equal(shouldShowBarReceiptPin({ isContinuation: true }), false);
});
