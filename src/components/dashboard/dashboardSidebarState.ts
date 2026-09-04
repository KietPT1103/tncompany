export function getDashboardSidebarMobileState(open: boolean) {
  return {
    drawerTransform: open ? "translate-x-0" : "-translate-x-full",
    overlayVisible: open,
  } as const;
}
