import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOverviewSnapshot,
  calculatePercentageChange,
  calculateOverviewVoucherTotals,
  getOverviewDateRanges,
  getOverviewComparisonLabel,
} from "./overviewData.ts";

const timestamp = (value: string) => ({
  seconds: Math.floor(new Date(value).getTime() / 1000),
});

test("summarizes completed bills and keeps cancelled bills out of revenue", () => {
  const snapshot = buildOverviewSnapshot(
    [
      {
        id: "bill-1",
        total: 120_000,
        status: "completed",
        createdAt: timestamp("2026-08-17T09:00:00+07:00"),
        items: [
          { menuId: "CF01", name: "Cà phê sữa", quantity: 2, lineTotal: 70_000 },
          { menuId: "TRA01", name: "Trà đào", quantity: 1, lineTotal: 50_000 },
        ],
      },
      {
        id: "bill-2",
        total: 80_000,
        status: "completed",
        createdAt: timestamp("2026-08-18T14:00:00+07:00"),
        items: [{ menuId: "CF01", name: "Cà phê sữa", quantity: 2, lineTotal: 80_000 }],
      },
      {
        id: "bill-3",
        total: 999_000,
        status: "cancelled",
        createdAt: timestamp("2026-08-18T15:00:00+07:00"),
        items: [{ menuId: "CF01", name: "Không tính", quantity: 9, lineTotal: 999_000 }],
      },
    ],
    new Date("2026-08-17T00:00:00+07:00"),
    new Date("2026-08-18T23:59:59+07:00"),
    new Set(),
    new Set(["CF01", "TRA01"]),
  );

  assert.equal(snapshot.totalRevenue, 200_000);
  assert.equal(snapshot.orderCount, 2);
  assert.equal(snapshot.customerCount, 5);
  assert.equal(snapshot.cancelledCount, 1);
  assert.equal(snapshot.averageOrder, 100_000);
  assert.equal(snapshot.itemsSold, 5);
  assert.deepEqual(snapshot.salesSeries.map((point) => point.revenue), [120_000, 80_000]);
  assert.equal(snapshot.hourlySeries.find((point) => point.key === "09")?.revenue, 120_000);
  assert.equal(snapshot.hourlySeries.find((point) => point.key === "14")?.orders, 1);
  assert.deepEqual(snapshot.topProducts[0], {
    name: "Cà phê sữa",
    quantity: 4,
    revenue: 150_000,
  });
});

test("returns a zero-filled daily series when there are no bills", () => {
  const snapshot = buildOverviewSnapshot(
    [],
    new Date("2026-08-15T00:00:00+07:00"),
    new Date("2026-08-17T23:59:59+07:00"),
  );

  assert.equal(snapshot.salesSeries.length, 3);
  assert.deepEqual(snapshot.salesSeries.map((point) => point.revenue), [0, 0, 0]);
  assert.deepEqual(snapshot.topProducts, []);
  assert.equal(snapshot.customerCount, 0);
});

test("aggregates cup-based customer counts by hour and excludes cancelled bills", () => {
  const snapshot = buildOverviewSnapshot(
    [
      {
        id: "bill-hour-1",
        total: 120_000,
        status: "completed",
        createdAt: timestamp("2026-08-18T09:15:00+07:00"),
        items: [{ menuId: "CF01", name: "Cà phê", quantity: 2, lineTotal: 120_000 }],
      },
      {
        id: "bill-hour-2",
        total: 80_000,
        status: "completed",
        createdAt: timestamp("2026-08-18T09:45:00+07:00"),
        items: [{ menuId: "TRA01", name: "Trà", quantity: 1, lineTotal: 80_000 }],
      },
      {
        id: "bill-hour-cancelled",
        total: 999_000,
        status: "cancelled",
        createdAt: timestamp("2026-08-18T09:55:00+07:00"),
        items: [{ menuId: "CF01", name: "Không tính", quantity: 9, lineTotal: 999_000 }],
      },
    ],
    new Date("2026-08-18T00:00:00+07:00"),
    new Date("2026-08-18T23:59:59+07:00"),
    new Set(),
    new Set(["CF01", "TRA01"]),
  );

  const nineAm = snapshot.hourlySeries.find((point) => point.key === "09");
  assert.equal(nineAm?.orders, 2);
  assert.equal(nineAm?.customers, 3);
  assert.equal(snapshot.customerCount, 3);
});

test("percentage change handles a zero comparison period", () => {
  assert.equal(calculatePercentageChange(120, 100), 20);
  assert.equal(calculatePercentageChange(0, 0), 0);
  assert.equal(calculatePercentageChange(120, 0), null);
});

const assertSameDate = (actual: Date, expected: Date) => {
  assert.equal(actual.getTime(), expected.getTime());
};

test("builds current and comparison periods for every overview filter", () => {
  const now = new Date(2026, 7, 18, 11, 26, 0, 0);
  const cases = [
    {
      preset: "today" as const,
      expected: [
        new Date(2026, 7, 18, 0, 0, 0, 0),
        new Date(2026, 7, 18, 23, 59, 59, 999),
        new Date(2026, 7, 17, 0, 0, 0, 0),
        new Date(2026, 7, 17, 23, 59, 59, 999),
      ],
    },
    {
      preset: "yesterday" as const,
      expected: [
        new Date(2026, 7, 17, 0, 0, 0, 0),
        new Date(2026, 7, 17, 23, 59, 59, 999),
        new Date(2026, 7, 16, 0, 0, 0, 0),
        new Date(2026, 7, 16, 23, 59, 59, 999),
      ],
    },
    {
      preset: "last7Days" as const,
      expected: [
        new Date(2026, 7, 12, 0, 0, 0, 0),
        new Date(2026, 7, 18, 23, 59, 59, 999),
        new Date(2026, 7, 5, 0, 0, 0, 0),
        new Date(2026, 7, 11, 23, 59, 59, 999),
      ],
    },
    {
      preset: "thisMonth" as const,
      expected: [
        new Date(2026, 7, 1, 0, 0, 0, 0),
        new Date(2026, 7, 18, 23, 59, 59, 999),
        new Date(2026, 6, 1, 0, 0, 0, 0),
        new Date(2026, 6, 18, 23, 59, 59, 999),
      ],
    },
    {
      preset: "lastMonth" as const,
      expected: [
        new Date(2026, 6, 1, 0, 0, 0, 0),
        new Date(2026, 6, 31, 23, 59, 59, 999),
        new Date(2026, 5, 1, 0, 0, 0, 0),
        new Date(2026, 5, 30, 23, 59, 59, 999),
      ],
    },
  ];

  cases.forEach(({ preset, expected }) => {
    const ranges = getOverviewDateRanges(preset, now);
    assertSameDate(ranges.startDate, expected[0]);
    assertSameDate(ranges.endDate, expected[1]);
    assertSameDate(ranges.previousStartDate, expected[2]);
    assertSameDate(ranges.previousEndDate, expected[3]);
  });
});

test("caps this-month comparison at the final day of a shorter previous month", () => {
  const ranges = getOverviewDateRanges(
    "thisMonth",
    new Date(2026, 2, 31, 9, 0, 0, 0),
  );

  assertSameDate(ranges.previousStartDate, new Date(2026, 1, 1, 0, 0, 0, 0));
  assertSameDate(ranges.previousEndDate, new Date(2026, 1, 28, 23, 59, 59, 999));
});

test("builds a same-length comparison period for a custom range", () => {
  const ranges = getOverviewDateRanges(
    "custom",
    new Date(2026, 7, 31, 9, 0, 0, 0),
    {
      startDate: new Date(2026, 7, 21, 0, 0, 0, 0),
      endDate: new Date(2026, 7, 23, 23, 59, 59, 999),
    },
  );

  assertSameDate(ranges.startDate, new Date(2026, 7, 21, 0, 0, 0, 0));
  assertSameDate(ranges.endDate, new Date(2026, 7, 23, 23, 59, 59, 999));
  assertSameDate(ranges.previousStartDate, new Date(2026, 7, 18, 0, 0, 0, 0));
  assertSameDate(ranges.previousEndDate, new Date(2026, 7, 20, 23, 59, 59, 999));
});

test("calculates cash voucher totals only inside the selected period", () => {
  const totals = calculateOverviewVoucherTotals(
    [
      { type: "income", amount: 50_000, happenedAt: timestamp("2026-08-18T09:00:00+07:00") },
      { type: "expense", amount: 20_000, happenedAt: timestamp("2026-08-18T10:00:00+07:00") },
      { type: "income", amount: 90_000, happenedAt: timestamp("2026-08-17T10:00:00+07:00") },
      { type: "income", amount: 10_000, happenedAt: timestamp("2026-08-18T11:00:00+07:00"), includeInCashFlow: false },
    ],
    new Date("2026-08-18T00:00:00+07:00"),
    new Date("2026-08-18T23:59:59+07:00"),
  );

  assert.deepEqual(totals, { income: 50_000, expense: 20_000 });
});

test("describes the comparison period for each overview preset", () => {
  const previousStart = new Date(2026, 7, 18);
  const previousEnd = new Date(2026, 7, 20);

  assert.equal(getOverviewComparisonLabel("today", previousStart, previousEnd), "hôm qua (18/08/2026)");
  assert.equal(getOverviewComparisonLabel("yesterday", previousStart, previousEnd), "hôm kia (18/08/2026)");
  assert.equal(getOverviewComparisonLabel("thisMonth", previousStart, previousEnd), "tháng trước (cùng số ngày)");
  assert.equal(getOverviewComparisonLabel("custom", previousStart, previousEnd), "18/08/2026 - 20/08/2026");
});

test("returns the ten best-selling products ordered by sold quantity", () => {
  const snapshot = buildOverviewSnapshot(
    [
      {
        id: "bill-top-products",
        total: 780_000,
        status: "completed",
        createdAt: timestamp("2026-08-18T12:00:00+07:00"),
        items: Array.from({ length: 12 }, (_, index) => ({
          name: `Món ${index + 1}`,
          quantity: index + 1,
          lineTotal: (index + 1) * 10_000,
        })),
      },
    ],
    new Date("2026-08-18T00:00:00+07:00"),
    new Date("2026-08-18T23:59:59+07:00"),
  );

  assert.equal(snapshot.topProducts.length, 10);
  assert.equal(snapshot.topProducts[0].name, "Món 12");
  assert.equal(snapshot.topProducts[9].name, "Món 3");
});
