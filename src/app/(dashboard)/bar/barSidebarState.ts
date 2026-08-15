export const BAR_SIDEBAR_STORAGE_KEY = "bar_sidebar_collapsed";

export function getBarSidebarVariant(role: string | null | undefined) {
  return role === "bartender" ? "bar" : "admin";
}

export function getInitialBarSidebarCollapsed(
  storedValue: string | null | undefined,
) {
  return storedValue !== "0";
}

export function getNextBarSidebarCollapsed(currentValue: boolean) {
  return !currentValue;
}
