import assert from "node:assert/strict";
import test from "node:test";
import { getBillDatePresetRange } from "./billDatePresets.ts";

const toLocalDate = (date: Date) => [
  date.getFullYear(),
  date.getMonth() + 1,
  date.getDate(),
];

const referenceDate = new Date(2026, 7, 18, 15, 30);

test("uses today as the default one-day invoice range", () => {
  const range = getBillDatePresetRange("today", referenceDate);

  assert.deepEqual(toLocalDate(range.start), [2026, 8, 18]);
  assert.deepEqual(toLocalDate(range.end), [2026, 8, 18]);
});

test("builds yesterday and the inclusive last-seven-days ranges", () => {
  const yesterday = getBillDatePresetRange("yesterday", referenceDate);
  const lastSevenDays = getBillDatePresetRange("last7Days", referenceDate);

  assert.deepEqual(toLocalDate(yesterday.start), [2026, 8, 17]);
  assert.deepEqual(toLocalDate(yesterday.end), [2026, 8, 17]);
  assert.deepEqual(toLocalDate(lastSevenDays.start), [2026, 8, 12]);
  assert.deepEqual(toLocalDate(lastSevenDays.end), [2026, 8, 18]);
});

test("builds this-month-to-date and the full previous month", () => {
  const thisMonth = getBillDatePresetRange("thisMonth", referenceDate);
  const previousMonth = getBillDatePresetRange("previousMonth", referenceDate);

  assert.deepEqual(toLocalDate(thisMonth.start), [2026, 8, 1]);
  assert.deepEqual(toLocalDate(thisMonth.end), [2026, 8, 18]);
  assert.deepEqual(toLocalDate(previousMonth.start), [2026, 7, 1]);
  assert.deepEqual(toLocalDate(previousMonth.end), [2026, 7, 31]);
});
