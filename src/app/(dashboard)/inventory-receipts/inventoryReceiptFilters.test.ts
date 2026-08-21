import assert from "node:assert/strict";
import test from "node:test";
import {
  inventoryReceiptFiltersFromSearchParams,
  inventoryReceiptFiltersToSearchParams,
} from "./inventoryReceiptFilters.ts";

test("restores inventory receipt filters and pagination from the URL", () => {
  const params = new URLSearchParams({
    status: "completed",
    keyword: "NK2026",
    areaId: "cafe",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-21",
    employeeId: "user-12",
    productKeyword: "cacao",
    page: "3",
    limit: "50",
  });

  assert.deepEqual(inventoryReceiptFiltersFromSearchParams(params), {
    status: "completed",
    keyword: "NK2026",
    areaId: "cafe",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-21",
    employeeId: "user-12",
    productKeyword: "cacao",
    page: 3,
    limit: 50,
  });
});

test("distinguishes the all tab from the default pending tab", () => {
  assert.equal(inventoryReceiptFiltersFromSearchParams(new URLSearchParams()).status, "pending_explanation");
  assert.equal(inventoryReceiptFiltersFromSearchParams(new URLSearchParams("status=all")).status, undefined);

  const params = inventoryReceiptFiltersToSearchParams({ status: undefined, page: 1, limit: 20 });
  assert.equal(params.get("status"), "all");
});

test("drops invalid URL values and serializes the active filters", () => {
  const parsed = inventoryReceiptFiltersFromSearchParams(new URLSearchParams("status=unknown&page=-2&limit=999"));
  assert.deepEqual(parsed, { status: "pending_explanation", page: 1, limit: 20 });

  const params = inventoryReceiptFiltersToSearchParams({ status: "draft", keyword: "  sữa  ", page: 2, limit: 20 });
  assert.equal(params.toString(), "status=draft&keyword=s%E1%BB%AFa&page=2&limit=20");
});
