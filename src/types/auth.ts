export type UserRole = "admin" | "manager" | "user" | "server";
export type AppPermission =
  | "dashboard.access"
  | "bills.access"
  | "payroll_estimate.access"
  | "payroll.access"
  | "timesheet.access"
  | "reports.access"
  | "cash_flow.access"
  | "product.access"
  | "inventory_checks.access"
  | "inventory_receipts.access"
  | "categories.access"
  | "internal_invoices.access"
  | "tax_invoices.access"
  | "social_listening.access"
  | "seo_articles.access"
  | "activity_logs.access"
  | "accounts.access";
const KNOWN_USER_ROLES: UserRole[] = ["admin", "manager", "user", "server"];

export type AppUser = {
  id: string;
  uid: string;
  email: string;
  username?: string | null;
  displayName?: string | null;
  role: UserRole;
  storeId?: string | null;
  permissions?: AppPermission[];
};

export function normalizeUserRole(
  user: Partial<AppUser> | null | undefined
): UserRole | null {
  if (!user) {
    return null;
  }

  const rawRole =
    typeof user.role === "string" ? user.role.trim().toLowerCase() : "";
  if (KNOWN_USER_ROLES.includes(rawRole as UserRole)) {
    return rawRole as UserRole;
  }

  const username =
    typeof user.username === "string" ? user.username.trim().toLowerCase() : "";
  const email =
    typeof user.email === "string" ? user.email.trim().toLowerCase() : "";

  if (username === "admin" || email === "admin@admin.local") {
    return "admin";
  }

  if (username === "manager" || email === "manager@admin.local") {
    return "manager";
  }

  if (username === "phucvu1" || email.endsWith("@service.local")) {
    return "server";
  }

  return "user";
}
