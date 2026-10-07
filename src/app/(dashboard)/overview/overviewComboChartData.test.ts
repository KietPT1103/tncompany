import assert from "node:assert/strict";
import test from "node:test";
import { buildComboChartLayout } from "./overviewComboChartData.ts";

test("revenue and cups use independent scales and align on the same time point", () => {
  const layout = buildComboChartLayout([
    { key: "a", label: "01/09", revenue: 1000000, customers: 10, orders: 2 },
    { key: "b", label: "02/09", revenue: 500000, customers: 20, orders: 3 },
  ]);
  assert.equal(layout.maxRevenue, 1000000);
  assert.equal(layout.maxQuantity, 20);
  assert.equal(layout.points[0].barHeight, layout.plotHeight);
  assert.equal(layout.points[1].lineY, layout.top);
  assert.equal(layout.points[0].lineY, layout.top + layout.plotHeight / 2);
  assert.ok(layout.points[1].x > layout.points[0].x);
});

test("zero and single-point series produce finite coordinates", () => {
  const layout = buildComboChartLayout([{ key: "a", label: "00:00", revenue: 0, customers: 0, orders: 0 }]);
  assert.equal(layout.points[0].barHeight, 0);
  assert.equal(layout.points[0].lineY, layout.top + layout.plotHeight);
  assert.equal(layout.points[0].x, layout.width / 2);
  assert.equal(buildComboChartLayout([]).points.length, 0);
});
