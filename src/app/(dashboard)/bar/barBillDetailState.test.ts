import assert from "node:assert/strict";
import test from "node:test";
import {
  barBillDetailReducer,
  getBarBillDetailAdvance,
  initialBarBillDetailState,
  shouldOpenBarBillDetailFromCard,
} from "./barBillDetailState.ts";

test("opens the requested bill in the detail dialog", () => {
  const state = barBillDetailReducer(initialBarBillDetailState, {
    type: "open",
    jobId: "bill-123",
  });

  assert.equal(state, "bill-123");
});

test("switches the detail dialog to another bill", () => {
  const state = barBillDetailReducer("bill-123", {
    type: "open",
    jobId: "bill-456",
  });

  assert.equal(state, "bill-456");
});

test("closes the detail dialog", () => {
  const state = barBillDetailReducer("bill-123", { type: "close" });

  assert.equal(state, null);
});

test("completes a new bill directly from the dialog", () => {
  assert.deepEqual(getBarBillDetailAdvance("new"), {
    label: "Hoàn thành",
    targetStatus: "collected",
  });
});

test("completes any legacy active bill directly from the dialog", () => {
  assert.deepEqual(getBarBillDetailAdvance("preparing"), {
    label: "Hoàn thành",
    targetStatus: "collected",
  });
  assert.deepEqual(getBarBillDetailAdvance("ready"), {
    label: "Hoàn thành",
    targetStatus: "collected",
  });
});

test("does not show a completion action for collected bills", () => {
  assert.equal(getBarBillDetailAdvance("collected"), null);
});

test("opens bill details when the card is clicked normally", () => {
  assert.equal(shouldOpenBarBillDetailFromCard(false), true);
});

test("does not open bill details from the click emitted after dragging", () => {
  assert.equal(shouldOpenBarBillDetailFromCard(true), false);
});
