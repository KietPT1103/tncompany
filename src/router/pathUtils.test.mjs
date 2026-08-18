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
