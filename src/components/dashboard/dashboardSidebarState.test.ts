import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardSidebarMobileState } from "./dashboardSidebarState.ts";

test("the shared mobile sidebar starts off-screen without an overlay", () => {
  assert.deepEqual(getDashboardSidebarMobileState(false), {
    drawerTransform: "-translate-x-full",
    overlayVisible: false,
  });
});

test("opening the shared mobile sidebar reveals it with an overlay", () => {
  assert.deepEqual(getDashboardSidebarMobileState(true), {
    drawerTransform: "translate-x-0",
    overlayVisible: true,
  });
});
