import assert from "node:assert/strict";
import test from "node:test";
import { paginateItems } from "./billPagination.ts";

test("returns the requested invoice page and its visible range", () => {
  const invoices = Array.from({ length: 23 }, (_, index) => `bill-${index + 1}`);

  const result = paginateItems(invoices, 2, 10);

  assert.deepEqual(result.items, invoices.slice(10, 20));
  assert.deepEqual(
    { page: result.page, totalPages: result.totalPages, from: result.from, to: result.to },
    { page: 2, totalPages: 3, from: 11, to: 20 },
  );
});

test("clamps an invoice page that is beyond the available data", () => {
  const invoices = Array.from({ length: 23 }, (_, index) => `bill-${index + 1}`);

  const result = paginateItems(invoices, 9, 10);

  assert.deepEqual(result.items, invoices.slice(20));
  assert.deepEqual(
    { page: result.page, totalPages: result.totalPages, from: result.from, to: result.to },
    { page: 3, totalPages: 3, from: 21, to: 23 },
  );
});

test("keeps pagination controls stable for an empty invoice list", () => {
  const result = paginateItems([], 4, 10);

  assert.deepEqual(result, {
    items: [],
    page: 1,
    totalPages: 1,
    from: 0,
    to: 0,
  });
});
