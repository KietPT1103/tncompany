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

test("warehouse employees can be granted separate import and export permissions", () => {
  const importEmployee = {
    role: "manager" as const,
    permissions: ["inventory_receipts.access"] as AppPermission[],
  };
  const exportEmployee = {
    role: "manager" as const,
    permissions: ["inventory_issues.access"] as AppPermission[],
  };

  const importEffective = getAccountEffectivePermissions(importEmployee);
  const importGroups = getAccountPermissionGroups(importEmployee);
  const exportGroups = getAccountPermissionGroups(exportEmployee);

  assert.ok(importEffective.includes("inventory_receipts.complete"));
  assert.equal(
    importGroups.flatMap((group) => group.items).find((item) => item.id === "inventory_receipts.access")?.enabled,
    true,
  );
  assert.equal(
    exportGroups.flatMap((group) => group.items).find((item) => item.id === "inventory_issues.access")?.enabled,
    true,
  );
});
