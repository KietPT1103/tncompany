import assert from "node:assert/strict";
import test from "node:test";
import {
  BAR_KDS_DRAG_THRESHOLD_PX,
  getBarKdsDragUpdate,
  isBarKdsDragTargetAllowed,
} from "./barKdsDragScroll.ts";

test("dragging left moves the KDS board toward later columns", () => {
  assert.deepEqual(getBarKdsDragUpdate(300, 220, 120), {
    hasDragged: true,
    scrollLeft: 200,
  });
});

test("dragging right moves the KDS board toward earlier columns", () => {
  assert.deepEqual(getBarKdsDragUpdate(220, 300, 200), {
    hasDragged: true,
    scrollLeft: 120,
  });
});

test("small pointer movement does not start a board drag", () => {
  assert.deepEqual(
    getBarKdsDragUpdate(200, 200 + BAR_KDS_DRAG_THRESHOLD_PX - 1, 120),
    {
      hasDragged: false,
      scrollLeft: 120,
    },
  );
});

test("dragging only starts from non-interactive board space", () => {
  const blankBoardSpace = { closest: () => null };
  const receiptContent = { closest: () => ({ dataset: { barReceipt: "true" } }) };

  assert.equal(isBarKdsDragTargetAllowed(blankBoardSpace), true);
  assert.equal(isBarKdsDragTargetAllowed(receiptContent), false);
  assert.equal(isBarKdsDragTargetAllowed(null), false);
});
