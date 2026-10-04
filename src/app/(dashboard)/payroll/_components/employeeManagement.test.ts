import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const employeeManager = readFileSync(
  new URL("./EmployeeManager.tsx", import.meta.url),
  "utf8",
);
const roleManager = readFileSync(
  new URL("./EmployeeRoleManager.tsx", import.meta.url),
  "utf8",
);
const roleApi = readFileSync(
  new URL("../../../../../public/api/employee-roles.php", import.meta.url),
  "utf8",
);
const employeeApi = readFileSync(
  new URL("../../../../../public/api/employees.php", import.meta.url),
  "utf8",
);
const salaryFields = readFileSync(
  new URL("./EmployeeSalaryFields.tsx", import.meta.url),
  "utf8",
);

test("paginates employees in groups of 15 on desktop and mobile", () => {
  assert.match(employeeManager, /EMPLOYEE_PAGE_SIZE = 15/);
  assert.match(employeeManager, /paginateItems\(/);
  assert.match(employeeManager, /paginatedEmployees\.items\.map/g);
  assert.match(employeeManager, /<Pagination/);
});

test("shows nested employee and role tabs", () => {
  assert.match(employeeManager, />\s*Nhân sự\s*</);
  assert.match(employeeManager, />\s*Vai trò\s*</);
  assert.match(employeeManager, /<EmployeeRoleManager/);
});

test("role management supports create, rename, and guarded deletion", () => {
  assert.match(roleManager, /addEmployeeRole/);
  assert.match(roleManager, /updateEmployeeRole/);
  assert.match(roleManager, /deleteEmployeeRole/);
  assert.match(roleApi, /UPDATE employees SET role = :name/);
  assert.match(roleApi, /Vai trò đang được sử dụng/);
});

test("employees can have multiple roles while retaining a primary role", () => {
  assert.match(employeeApi, /roles_json/);
  assert.match(employeeApi, /employees_normalize_roles/);
  assert.match(salaryFields, /<MultiSelectBox/);
  assert.match(employeeManager, /getEmployeeRoleNames\(employee\)/);
});
