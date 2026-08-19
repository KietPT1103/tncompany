import {
  getEffectivePermissions,
  MANAGED_PERMISSION_GROUPS,
} from "../../lib/permissions.ts";
import type { ManagedUser } from "../../services/users.api.ts";
import type { AppPermission } from "../../types/auth.ts";

export type AccountPermissionItem = {
  id: AppPermission;
  label: string;
  description: string;
  path: string;
  enabled: boolean;
};

export type AccountPermissionGroup = {
  category: string;
  enabledCount: number;
  items: AccountPermissionItem[];
};

export function getAccountEffectivePermissions(user: Pick<ManagedUser, "role" | "permissions">) {
  return getEffectivePermissions({
    role: user.role,
    permissions: user.permissions,
  });
}

export function getAccountPermissionGroups(
  user: Pick<ManagedUser, "role" | "permissions">,
): AccountPermissionGroup[] {
  const enabled = new Set(getAccountEffectivePermissions(user));

  return MANAGED_PERMISSION_GROUPS.map((group) => {
    const items = group.items.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      path: item.path,
      enabled: enabled.has(item.id),
    }));

    return {
      category: group.category,
      enabledCount: items.filter((item) => item.enabled).length,
      items,
    };
  });
}

export function getAccountPermissionCount(
  user: Pick<ManagedUser, "role" | "permissions">,
) {
  return getAccountPermissionGroups(user).reduce(
    (total, group) => total + group.enabledCount,
    0,
  );
}
