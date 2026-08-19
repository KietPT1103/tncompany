import assert from "node:assert/strict";
import test from "node:test";

import {
  getAccountEffectivePermissions,
  getAccountPermissionCount,
  getAccountPermissionGroups,
} from "./accountPermissions.ts";
import type { AppPermission } from "../../types/auth.ts";

test("account permission groups expose effective role permissions", () => {
  const user = {
    role: "bartender" as const,
    permissions: ["bar.access", "bar.checkout"] as AppPermission[],
  };

  const groups = getAccountPermissionGroups(user);
  const enabledItems = groups.flatMap((group) =>
    group.items.filter((item) => item.enabled),
  );

  assert.equal(enabledItems.length, 1);
  assert.equal(
    enabledItems.find((item) => item.id === "bar.checkout")?.enabled,
    true,
  );
  assert.equal(getAccountPermissionCount(user), 1);
});

test("admin accounts are shown with all managed permissions enabled", () => {
  const user = {
    role: "admin" as const,
    permissions: [],
  };

  const effective = getAccountEffectivePermissions(user);
  const groups = getAccountPermissionGroups(user);

  assert.ok(effective.includes("accounts.access"));
  assert.equal(
    getAccountPermissionCount(user),
    groups.reduce((total, group) => total + group.items.length, 0),
  );
  assert.ok(groups.every((group) => group.items.every((item) => item.enabled)));
});
