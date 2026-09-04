import assert from "node:assert/strict";
import test from "node:test";
import {
  getBarSidebarVariant,
  getBarSidebarContentPadding,
  getInitialBarSidebarCollapsed,
  getNextBarSidebarCollapsed,
} from "./barSidebarState.ts";

test("the bar sidebar starts collapsed when no preference was saved", () => {
  assert.equal(getInitialBarSidebarCollapsed(null), true);
});

test("the bar sidebar restores an explicit expanded preference", () => {
  assert.equal(getInitialBarSidebarCollapsed("0"), false);
});

test("the bar sidebar toggle switches between its two display modes", () => {
  assert.equal(getNextBarSidebarCollapsed(true), false);
  assert.equal(getNextBarSidebarCollapsed(false), true);
});

test("only bartender accounts use the focused bar sidebar", () => {
  assert.equal(getBarSidebarVariant("bartender"), "bar");
  assert.equal(getBarSidebarVariant("admin"), "admin");
  assert.equal(getBarSidebarVariant("user"), "admin");
});

test("the bar board reserves the full desktop width of the sidebar", () => {
  assert.equal(
    getBarSidebarContentPadding(true),
    "pt-16 lg:pl-[72px] lg:pt-0",
  );
  assert.equal(
    getBarSidebarContentPadding(false),
    "pt-16 lg:pl-[248px] lg:pt-0",
  );
});
