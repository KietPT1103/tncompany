import assert from "node:assert/strict";
import test from "node:test";

import { collectAllBillPages } from "./billPagination.ts";

test("collects every bill when the selected range exceeds one API page", async () => {
  const source = Array.from({ length: 4501 }, (_, index) => ({ id: `bill-${index}` }));
  const requests: Array<{ offset: number; limit: number }> = [];

  const bills = await collectAllBillPages(async (offset, limit) => {
    requests.push({ offset, limit });
    return source.slice(offset, offset + limit);
  });

  assert.equal(bills.length, 4501);
  assert.deepEqual(requests, [
    { offset: 0, limit: 2000 },
    { offset: 2000, limit: 2000 },
    { offset: 4000, limit: 2000 },
  ]);
});

test("requests an empty final page when the bill count is an exact multiple", async () => {
  const source = Array.from({ length: 4000 }, (_, index) => ({ id: `bill-${index}` }));
  const offsets: number[] = [];

  const bills = await collectAllBillPages(async (offset, limit) => {
    offsets.push(offset);
    return source.slice(offset, offset + limit);
  });

  assert.equal(bills.length, 4000);
  assert.deepEqual(offsets, [0, 2000, 4000]);
});
