import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectAllBillPages } from "../../../services/billPagination.ts";
import { buildOverviewSnapshot, type OverviewBill } from "./overviewData.ts";

test("dashboard loads all bill pages instead of a capped list", () => {
  const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(page, /getAllBills\(\{/);
  assert.doesNotMatch(page, /getBills\(\{/);
});

test("September overview includes early days beyond the 2000 most recent bills", async () => {
  const bill = (id: string, date: string, total: number, status: "completed" | "cancelled" = "completed"): OverviewBill => ({
    id, total, status, items: [], paymentMethod: "cash",
    createdAt: { seconds: new Date(date).getTime() / 1000 },
  });
  const source = [
    ...Array.from({ length: 1999 }, (_, i) => bill(`recent-${i}`, "2026-09-15T12:00:00+07:00", i === 0 ? 228_601_000 : 0)),
    bill("cancelled", "2026-09-15T12:00:00+07:00", 999_000, "cancelled"),
    bill("sep-4", "2026-09-04T12:00:00+07:00", 69_702_000),
    bill("sep-3", "2026-09-03T12:00:00+07:00", 33_461_000),
    bill("sep-2", "2026-09-02T12:00:00+07:00", 138_211_000),
    bill("sep-1", "2026-09-01T00:00:00+07:00", 133_615_000),
    bill("previous", "2026-08-31T23:59:59+07:00", 10_000_000),
  ];
  const bills = await collectAllBillPages(async (offset, limit) => source.slice(offset, offset + limit));
  const snapshot = buildOverviewSnapshot(bills, new Date("2026-09-01T00:00:00+07:00"), new Date("2026-09-15T23:59:59.999+07:00"));
  assert.equal(snapshot.totalRevenue, 603_590_000);
  assert.equal(snapshot.orderCount, 2003);
  assert.equal(snapshot.cancelledCount, 1);
  assert.equal(snapshot.paymentTotals.cash, 603_590_000);
  assert.equal(snapshot.salesSeries.reduce((sum, day) => sum + day.revenue, 0), 603_590_000);
});
