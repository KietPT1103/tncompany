import assert from "node:assert/strict";
import test from "node:test";
import * as corrections from "./corrections.ts";

test("admin can edit completed issues while cancelled issues stay locked", () => {
  assert.equal(corrections.canEditIssue("admin", "completed"), true);
  assert.equal(corrections.canEditIssue("manager", "completed"), false);
  assert.equal(corrections.canEditIssue("admin", "cancelled"), false);
  assert.equal(corrections.canEditIssue("user", "draft"), true);
});
test("editing stock availability includes only the original deducted base quantity", () => {
  assert.equal(corrections.availableIssueStock(70, "completed", { baseQuantity: 30, stockBefore: 100, quantity: 0.03 }), 100);
  assert.equal(corrections.availableIssueStock(70, "draft", { baseQuantity: 30, stockBefore: 100, quantity: 0.03 }), 70);
  assert.equal(corrections.availableIssueStock(0, "completed", { baseQuantity: 30, stockBefore: null, quantity: 30 }), 0);
});