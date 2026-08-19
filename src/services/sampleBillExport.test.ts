import assert from "node:assert/strict";
import test from "node:test";

import {
  getSampleBillExportFileName,
  resolveSampleBillExportFileName,
} from "./sampleBillExport.ts";

test("sample water bill export uses the bill type and selected date in the file name", () => {
  assert.equal(
    getSampleBillExportFileName("coffee", "2026-08-18"),
    "Bill_mau_nuoc_18_08_2026.xlsx",
  );
});

test("sample bill export falls back to a safe date when the date is invalid", () => {
  assert.equal(
    getSampleBillExportFileName("coffee", "not-a-date"),
    "Bill_mau_nuoc.xlsx",
  );
});

test("sample bill export replaces the generic download fallback", () => {
  assert.equal(
    resolveSampleBillExportFileName("download.xlsx", "coffee", "2026-08-18"),
    "Bill_mau_nuoc_18_08_2026.xlsx",
  );
  assert.equal(
    resolveSampleBillExportFileName("download", "coffee", "2026-08-18"),
    "Bill_mau_nuoc_18_08_2026.xlsx",
  );
});
