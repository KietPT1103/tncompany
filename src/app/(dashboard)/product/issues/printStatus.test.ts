import assert from "node:assert/strict";
import test from "node:test";
import { canManualPrintInventoryIssue, getPrintStatusPresentation } from "./printStatus.ts";

test("maps every queue status to an operator-facing Vietnamese label", () => {
  assert.equal(getPrintStatusPresentation("pending").label, "Chờ in");
  assert.equal(getPrintStatusPresentation("processing").label, "Đang in");
  assert.equal(getPrintStatusPresentation("printed").label, "Đã gửi máy in");
  assert.equal(getPrintStatusPresentation("failed").label, "In lỗi");
  assert.equal(getPrintStatusPresentation("cancelled").label, "Đã hủy");
  assert.equal(getPrintStatusPresentation("uncertain").label, "Cần kiểm tra");
});

test("offers A4 reprint only for terminal jobs that need operator action", () => {
  for (const status of ["failed", "cancelled", "uncertain"] as const) {
    assert.equal(getPrintStatusPresentation(status).canReprint, true, status);
  }
  for (const status of ["pending", "processing", "printed"] as const) {
    assert.equal(getPrintStatusPresentation(status).canReprint, false, status);
  }
});

test("keeps manual browser printing available only for completed inventory issues", () => {
  assert.equal(canManualPrintInventoryIssue("completed"), true);
  assert.equal(canManualPrintInventoryIssue("draft"), false);
  assert.equal(canManualPrintInventoryIssue("cancelled"), false);
});
