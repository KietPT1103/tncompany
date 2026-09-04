import assert from "node:assert/strict";
import test from "node:test";
import { toggleHistoryBillDisclosure } from "./barHistoryDisclosure.ts";

test("opens only the selected history bill", () => {
  const expanded = toggleHistoryBillDisclosure(new Set<string>(), "bill-2");

  assert.deepEqual([...expanded], ["bill-2"]);
});

test("keeps other history bills open when another bill is expanded", () => {
  const expanded = toggleHistoryBillDisclosure(
    new Set(["bill-1"]),
    "bill-2",
  );

  assert.deepEqual([...expanded], ["bill-1", "bill-2"]);
});

test("collapses an expanded history bill without mutating the current set", () => {
  const current = new Set(["bill-1", "bill-2"]);
  const expanded = toggleHistoryBillDisclosure(current, "bill-1");

  assert.deepEqual([...expanded], ["bill-2"]);
  assert.deepEqual([...current], ["bill-1", "bill-2"]);
});
