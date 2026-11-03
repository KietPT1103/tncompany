import assert from "node:assert/strict";
import test from "node:test";
import { matchesPayrollDate, formatLastPayrollDate } from "../src/app/(dashboard)/payroll/_components/employeeCleanup.ts";
const paid = { lastPayrollDate: "2026-08-31", payrollCount: 2 };
const never = { lastPayrollDate: null, payrollCount: 0 };
const unknown = { lastPayrollDate: null, payrollCount: 1 };
test("before excludes the boundary, ranges include both boundaries", () => {
  assert.equal(matchesPayrollDate(paid, "before", "", "2026-08-31"), false);
  assert.equal(matchesPayrollDate(paid, "before", "", "2026-09-01"), true);
  assert.equal(matchesPayrollDate(paid, "range", "2026-08-31", "2026-08-31"), true);
  assert.equal(matchesPayrollDate(paid, "range", "2026-09-01", "2026-08-01"), false);
  assert.equal(matchesPayrollDate(paid, "range", "", "2026-08-30"), false);
});
test("unknown dates do not masquerade as never paid or dated records", () => {
  assert.equal(matchesPayrollDate(never, "never", "", ""), true);
  assert.equal(matchesPayrollDate(unknown, "never", "", ""), false);
  assert.equal(matchesPayrollDate(never, "before", "", "2026-09-01"), false);
  assert.equal(matchesPayrollDate(unknown, "range", "2026-01-01", ""), false);
  assert.equal(matchesPayrollDate(unknown, "all", "", ""), true);
  assert.equal(formatLastPayrollDate(never), "Chưa từng tính lương");
  assert.equal(formatLastPayrollDate(unknown), "Chưa có ngày kỳ lương");
  assert.equal(formatLastPayrollDate(paid), "31/08/2026");
});
