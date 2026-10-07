export type InventoryPeriod = "today" | "yesterday" | "week" | "month" | "previousMonth";
export function inventoryToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function inventoryPeriodRange(period: InventoryPeriod, today = inventoryToday()) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  if (period === "yesterday") { date.setUTCDate(date.getUTCDate() - 1); return { from: iso(date), to: iso(date) }; }
  if (period === "week") { date.setUTCDate(date.getUTCDate() - 6); return { from: iso(date), to: today }; }
  if (period === "month") return { from: iso(new Date(Date.UTC(year, month - 1, 1))), to: today };
  if (period === "previousMonth") return { from: iso(new Date(Date.UTC(year, month - 2, 1))), to: iso(new Date(Date.UTC(year, month - 1, 0))) };
  return { from: today, to: today };
}
