import assert from "node:assert/strict";
import test from "node:test";
import {
  BAR_RECEIPT_COMPACT_ITEM_THRESHOLD,
  getBarReceiptItemColumns,
} from "./barReceiptLayout.ts";

test("keeps short bills in one readable item column", () => {
  const items = Array.from(
    { length: BAR_RECEIPT_COMPACT_ITEM_THRESHOLD },
    (_, index) => `item-${index + 1}`,
  );

  assert.deepEqual(getBarReceiptItemColumns(items), [items]);
});

test("splits long bills into two balanced columns without hiding or reordering items", () => {
  const items = Array.from({ length: 15 }, (_, index) => `item-${index + 1}`);

  const columns = getBarReceiptItemColumns(items);

  assert.equal(columns.length, 2);
  assert.deepEqual(columns.map((column) => column.length), [8, 7]);
  assert.deepEqual(columns.flat(), items);
});
