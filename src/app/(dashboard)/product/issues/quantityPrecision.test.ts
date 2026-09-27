import assert from "node:assert/strict";
import test from "node:test";
import { formatInventoryQuantity, isInventoryIssueQuantityInsufficient } from "./quantityPrecision.ts";

test("shows small purchase-unit stock without rounding it up", () => {
  assert.equal(formatInventoryQuantity(0.0004), "0,0004");
  assert.equal(formatInventoryQuantity(0.001), "0,001");
});

test("compares requested quantity at base-unit precision", () => {
  assert.equal(isInventoryIssueQuantityInsufficient(0.0004, 1000, 0.4), false);
  assert.equal(isInventoryIssueQuantityInsufficient(0.001, 1000, 0.4), true);
});
