import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAdminHref } from "./pathUtils.ts";
import {
  getDefaultRouteForUser,
  getPermissionForPath,
} from "../lib/permissions.ts";

test("the cost tab resolves to the protected admin cost route", () => {
  assert.equal(normalizeAdminHref("/cost"), "/admin/cost");
  assert.equal(getPermissionForPath("/cost"), "dashboard.access");
});

test("the inventory workspace resolves to its protected admin route", () => {
  assert.equal(normalizeAdminHref("/inventory"), "/admin/inventory");
  assert.equal(normalizeAdminHref("/inventory?tab=stock"), "/admin/inventory?tab=stock");
});

test("the old root route is not a default fallback for restricted roles", () => {
  assert.equal(
    getDefaultRouteForUser({
      id: "manager-1",
      uid: "manager-1",
      email: "manager@example.com",
      role: "manager",
      permissions: [],
    }),
    "/pos",
  );
});

test("non-admin users do not fall back to the admin-only cost screen", () => {
  assert.equal(
    getDefaultRouteForUser({
      id: "manager-2",
      uid: "manager-2",
      email: "manager@example.com",
      role: "manager",
      permissions: ["dashboard.access"],
    }),
    "/pos",
  );
});

test("an export-only warehouse employee starts in the inventory workspace", () => {
  assert.equal(
    getDefaultRouteForUser({
      id: "warehouse-employee",
      uid: "warehouse-employee",
      email: "warehouse@example.com",
      role: "manager",
      storeId: "warehouse",
      permissions: ["inventory_issues.access"],
    }),
    "/inventory",
  );
});
