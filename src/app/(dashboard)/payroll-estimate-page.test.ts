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

test("styles week shortcut buttons with green hover and gold focus states", () => {
  assert.match(source, /const WEEK_SHORTCUT_BUTTON_CLASS/);
  assert.match(source, /hover:border-\[#064E3B\]/);
  assert.match(source, /focus-visible:border-\[#D6A621\]/);
  assert.match(source, /active:scale-\[0\.97\]/);
});

test("shows every scheduled employee and keeps cells in each shift row equally tall", () => {
  assert.match(source, /selectedEmployees\.map\(\(employee\) =>/);
  assert.doesNotMatch(source, /MAX_VISIBLE_EMPLOYEES/);
  assert.match(source, /const maxEmployeesInRow = Math\.max/);
  assert.match(source, /getScheduleCellHeight\(maxEmployeesInRow\)/);
  assert.match(source, /style=\{\{ height: synchronizedCellHeight \}\}/);
});

test("downloads the complete schedule section as a PNG", () => {
  assert.match(source, /await import\("html2canvas"\)/);
  assert.match(source, /data-schedule-capture=\{captureKey\}/);
  assert.match(source, /data-html2canvas-ignore="true"/);
  assert.match(source, /data-schedule-scroll="true"/);
  assert.match(source, /data-employee-name="true"/);
  assert.match(source, /data-today-badge="true"/);
  assert.match(source, /height: captureHeight \+ 4/);
  assert.match(source, /Math\.max\(\s*section\.scrollWidth,\s*scheduleScroller\?\.scrollWidth/);
  assert.match(source, /link\.download = `lich-phan-ca-/);
  assert.match(source, /canvas\.toDataURL\("image\/png"\)/);
  assert.match(source, /shadow-\[5px_6px_0_#0F172A\]/);
  assert.match(source, /active:translate-x-\[3px\]/);
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
  assert.match(source, /getEmployeeRoleNames\(employee\).*estimateRoles\.includes/s);
  assert.match(source, /label: value,\s*icon: CalendarDays/);
});

test("excludes MKT from the schedule role selector", () => {
  assert.match(source, /function isVisibleEstimateRole\(role: string\)/);
  assert.match(source, /toLocaleLowerCase\("vi"\) !== "mkt"/);
  assert.match(source, /\.filter\(isVisibleEstimateRole\)/);
});

test("keeps fixed-salary employees schedulable without showing salary amounts", () => {
  assert.match(source, /function isFixedSalaryEmployee\(employee: Employee\)/);
  assert.match(source, /function getEstimatedHourlyRate\(employee: Employee\)/);
  assert.match(source, /Không tính theo ca/);
  assert.doesNotMatch(
    source,
    /getEmployeeRoleNames\(employee\)\.some\(\(role\) => estimateRoles\.includes\(role\)\)\s*&&\s*resolveEmployeeSalaryType/,
  );
});

test("does not show employee codes in the shift picker", () => {
  assert.doesNotMatch(source, /employee\.employeeCode \|\| "Không có mã"/);
  assert.match(source, /adminSearchText\(\(employee\.employeeCode \|\| ""\)\)\.includes\(keyword\)/);
});

test("allows one employee to be scheduled for each assigned role", () => {
  assert.match(source, /getEmployeeRoleNames\(employee\)\.forEach/);
  assert.match(source, /next\[role\]\.push\(employee\)/);
  assert.match(source, /assignedRoles\.includes\(selectedRole\)/);
});

test("uses full-width tabs for schedule and employee summary on laptops", () => {
  assert.match(source, /setWorkspaceView\("schedule"\)/);
  assert.match(source, /setWorkspaceView\("summary"\)/);
  assert.match(source, /Tổng hợp nhân viên/);
  assert.match(source, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(source, /min-w-\[920px\].*2xl:min-w-\[1080px\]/);
  assert.match(source, /2xl:flex-row/);
  assert.doesNotMatch(source, /className="sticky top-0 z-30 flex overflow-x-auto/);
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
