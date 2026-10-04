import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./payroll-estimate-page.tsx", import.meta.url), "utf8");

test("only shows the payroll back link to users with payroll access", () => {
  assert.match(source, /hasPermission\(user,\s*"payroll\.access"\)/);
  assert.match(source, /canAccessPayroll\s*\?\s*\(/);
});

test("uses the shared select and toast components", () => {
  assert.match(source, /<SelectBox/);
  assert.doesNotMatch(source, /<select/);
  assert.match(source, /<DateRangePicker/);
  assert.doesNotMatch(source, /type="date"/);
  assert.match(source, /<Toast/);
});

test("keeps crowded schedule cells compact", () => {
  assert.match(source, /selectedEmployees\.slice\(0, MAX_VISIBLE_EMPLOYEES\)/);
  assert.match(source, /selectedEmployees\.length - MAX_VISIBLE_EMPLOYEES/);
});

test("shows each shift time range and duration in the schedule", () => {
  assert.match(source, /shift_1:\s*\{ start: "07:00", end: "12:00" \}/);
  assert.match(source, /shift_2:\s*\{ start: "12:00", end: "17:00" \}/);
  assert.match(source, /shift_3:\s*\{ start: "17:00", end: "23:00" \}/);
  assert.match(source, /formatShiftTime\(SHIFT_TIME_RANGES\[shift\.id\]\.start\)/);
  assert.match(source, /\{shift\.hours\} tiếng/);
});

test("uses operational roles from the selected Cafe, Bep, or Farm store", () => {
  assert.match(source, /getRoleGroupsForStore\(storeId\)/);
  assert.match(source, /groupName !== "Chung"/);
  assert.match(source, /estimateRoles\.includes\(employee\.role\)/);
  assert.match(source, /label: value,\s*icon: CalendarDays/);
});

test("uses full-width tabs for schedule and employee summary on laptops", () => {
  assert.match(source, /setWorkspaceView\("schedule"\)/);
  assert.match(source, /setWorkspaceView\("summary"\)/);
  assert.match(source, /Tổng hợp nhân viên/);
  assert.match(source, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(source, /min-w-\[920px\].*2xl:min-w-\[1080px\]/);
  assert.match(source, /2xl:flex-row/);
});

test("keeps the employee picker inside the viewport with one scrollable list", () => {
  assert.match(source, /createPortal\(/);
  assert.match(source, /document\.body/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /max-h-\[calc\(100dvh-24px\)\]/);
  assert.match(source, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(source, /Tìm theo tên hoặc mã nhân viên/);
});
