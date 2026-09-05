import assert from "node:assert/strict";
import test from "node:test";
import type {
  BarPrintJob,
  BarPrintJobItem,
} from "../../../services/barPrintJobService.ts";
import {
  BAR_KDS_COLUMN_GAP,
  BAR_KDS_RECEIPT_CONTENT_FOOTER_GAP_PX,
  BAR_KDS_RECEIPT_FOOTER_SAFE_AREA_PX,
  BAR_KDS_RECEIPT_HEADER_SAFE_AREA_PX,
  BAR_KDS_TICKET_HORIZONTAL_OVERLAP_PX,
  BAR_KDS_TICKET_WIDTH,
  buildBarKdsColumns,
  flattenBarKdsColumns,
  getActiveBarQueue,
  getBarKdsBoardContentHeight,
  repackBarKdsColumnsByRenderedHeight,
} from "./barBoardQueue.ts";

test("uses compact KDS ticket dimensions and gutters", () => {
  assert.equal(BAR_KDS_TICKET_WIDTH, 320);
  assert.equal(BAR_KDS_COLUMN_GAP, 4);
  assert.equal(BAR_KDS_TICKET_HORIZONTAL_OVERLAP_PX, 20);
});

test("keeps receipt actions above the jagged paper safe area", () => {
  assert.equal(BAR_KDS_RECEIPT_FOOTER_SAFE_AREA_PX, 40);
});

test("keeps receipt headers below the jagged paper safe area", () => {
  assert.equal(BAR_KDS_RECEIPT_HEADER_SAFE_AREA_PX, 40);
});

test("keeps one consistent gap between the last item and the receipt footer", () => {
  assert.equal(BAR_KDS_RECEIPT_CONTENT_FOOTER_GAP_PX, 12);
});

test("packs tickets inside the board content height without counting its padding", () => {
  assert.equal(getBarKdsBoardContentHeight(547, 6, 6), 535);
});

test("uses the remaining desktop viewport when the flex board underreports its height", () => {
  assert.equal(getBarKdsBoardContentHeight(547, 6, 6, 862, 136), 714);
});

const createItems = (count: number): BarPrintJobItem[] =>
  Array.from({ length: count }, (_, index) => ({
    menuId: `item-${index + 1}`,
    name: `Món ${index + 1}`,
    price: 20_000,
    quantity: 1,
  }));

const createJob = (
  id: string,
  seconds: number,
  workflowStatus: "new" | "preparing" | "ready" | "collected",
  itemCount = 1,
): BarPrintJob => ({
  id,
  storeId: "cafe",
  tableNumber: id,
  items: createItems(itemCount),
  status: "printed",
  workflowStatus,
  createdAt: { seconds },
});

const testLayout = {
  columnHeight: 200,
  columnGap: 10,
  firstSegmentBaseHeight: 80,
  continuationSegmentBaseHeight: 50,
  completionActionHeight: 30,
  continuationCueHeight: 0,
  estimateItemHeight: () => 20,
};

test("keeps every active legacy workflow status in one queue", () => {
  const queue = getActiveBarQueue([
    createJob("new", 1, "new"),
    createJob("preparing", 2, "preparing"),
    createJob("ready", 3, "ready"),
    createJob("collected", 4, "collected"),
  ]);

  assert.deepEqual(
    queue.map((job) => job.id),
    ["new", "preparing", "ready"],
  );
});

test("sorts the continuous queue from the oldest bill to the newest", () => {
  const queue = getActiveBarQueue([
    createJob("newest", 30, "new"),
    createJob("oldest", 10, "ready"),
    createJob("middle", 20, "preparing"),
  ]);

  assert.deepEqual(
    queue.map((job) => job.id),
    ["oldest", "middle", "newest"],
  );
});

test("does not mutate the realtime job array while sorting", () => {
  const jobs = [
    createJob("newest", 30, "new"),
    createJob("oldest", 10, "new"),
  ];

  getActiveBarQueue(jobs);

  assert.deepEqual(
    jobs.map((job) => job.id),
    ["newest", "oldest"],
  );
});

test("splits a long bill into a first ticket and a continuation ticket", () => {
  const columns = buildBarKdsColumns(
    [createJob("long", 1, "new", 8)],
    testLayout,
  );
  const segments = flattenBarKdsColumns(columns);

  assert.equal(columns.length, 2);
  assert.equal(segments.length, 2);
  assert.deepEqual(
    segments.map((segment) => segment.items.length),
    [6, 2],
  );
  assert.equal(segments[0].isContinuation, false);
  assert.equal(segments[0].isFinal, false);
  assert.equal(segments[1].isContinuation, true);
  assert.equal(segments[1].isFinal, true);
  assert.equal(segments[0].segmentCount, 2);
  assert.equal(segments[1].segmentCount, 2);
});

test("reserves vertical space for the continuation cue above the jagged edge", () => {
  const segments = flattenBarKdsColumns(
    buildBarKdsColumns([createJob("long", 1, "new", 8)], {
      ...testLayout,
      continuationCueHeight: 20,
    }),
  );

  assert.deepEqual(
    segments.map((segment) => segment.items.length),
    [5, 3],
  );
  assert.equal(segments[0].estimatedHeight, 200);
});

test("keeps every segment of one bill consecutive before the next bill", () => {
  const columns = buildBarKdsColumns(
    [
      createJob("long", 1, "new", 6),
      createJob("short", 2, "new", 1),
    ],
    testLayout,
  );
  const segments = flattenBarKdsColumns(columns);

  assert.deepEqual(
    segments.map((segment) => segment.job.id),
    ["long", "long", "short"],
  );
  assert.deepEqual(
    segments.map((segment) => segment.queueNumber),
    [1, 1, 2],
  );
});

test("only the final continuation ticket can complete the whole bill", () => {
  const segments = flattenBarKdsColumns(
    buildBarKdsColumns([createJob("long", 1, "new", 8)], testLayout),
  );

  assert.deepEqual(
    segments.map((segment) => segment.isFinal),
    [false, true],
  );
  assert.ok(segments.every((segment) => segment.job.id === "long"));
});

test("fills the remaining vertical space before starting the next column", () => {
  const columns = buildBarKdsColumns(
    [
      createJob("first", 1, "new", 1),
      createJob("second", 2, "new", 1),
      createJob("third", 3, "new", 1),
    ],
    { ...testLayout, columnHeight: 270 },
  );

  assert.deepEqual(
    columns.map((column) => column.map((segment) => segment.job.id)),
    [["first", "second"], ["third"]],
  );
});

test("packs two rendered-height short bills into one desktop KDS column", () => {
  const columns = buildBarKdsColumns(
    [
      createJob("first-short", 1, "new", 2),
      createJob("second-short", 2, "new", 2),
    ],
    { columnHeight: 598 },
  );

  assert.deepEqual(
    columns.map((column) => column.map((segment) => segment.job.id)),
    [["first-short", "second-short"]],
  );
  assert.ok(
    columns[0].reduce(
      (height, segment, index) =>
        height + segment.estimatedHeight + (index ? BAR_KDS_COLUMN_GAP : 0),
      0,
    ) <= 598,
  );
});

test("re-packs short bills using their rendered height when the estimate is too large", () => {
  const estimatedColumns = buildBarKdsColumns(
    [
      createJob("first-short", 1, "new", 2),
      createJob("second-short", 2, "new", 2),
    ],
    {
      columnHeight: 598,
      firstSegmentBaseHeight: 210,
      completionActionHeight: 58,
    },
  );

  assert.equal(estimatedColumns.length, 2);
  assert.deepEqual(
    repackBarKdsColumnsByRenderedHeight(estimatedColumns, {
      columnHeight: 598,
      getRenderedHeight: () => 288,
    }).map((column) => column.map((segment) => segment.job.id)),
    [["first-short", "second-short"]],
  );
});

test("packs two short rendered bills at the compact 100-percent desktop height", () => {
  const columns = buildBarKdsColumns(
    [
      createJob("first-short", 1, "new", 2),
      createJob("second-short", 2, "new", 2),
    ],
    { columnHeight: 580 },
  );

  assert.deepEqual(
    repackBarKdsColumnsByRenderedHeight(columns, {
      columnHeight: 580,
      getRenderedHeight: () => 288.1,
    }).map((column) => column.map((segment) => segment.job.id)),
    [["first-short", "second-short"]],
  );
});

test("keeps continuation tickets at the start of the next KDS column", () => {
  const estimatedColumns = buildBarKdsColumns(
    [createJob("long", 1, "new", 8)],
    testLayout,
  );

  assert.equal(flattenBarKdsColumns(estimatedColumns).length, 2);
  assert.deepEqual(
    repackBarKdsColumnsByRenderedHeight(estimatedColumns, {
      columnHeight: 1_000,
      getRenderedHeight: () => 80,
    }).map((column) => column.map((segment) => segment.segmentIndex)),
    [[0], [1]],
  );
});

test("moves a short bill intact when only its completion action would overflow", () => {
  const columns = buildBarKdsColumns(
    [
      createJob("first", 1, "new", 1),
      createJob("second", 2, "new", 1),
    ],
    { ...testLayout, columnHeight: 250 },
  );
  const segments = flattenBarKdsColumns(columns);

  assert.deepEqual(
    columns.map((column) => column.map((segment) => segment.job.id)),
    [["first"], ["second"]],
  );
  assert.equal(segments.length, 2);
  assert.ok(segments.every((segment) => segment.isFinal));
  assert.ok(segments.every((segment) => segment.items.length === 1));
});

test("mobile flow includes every ticket segment without the old fifteen-bill cap", () => {
  const jobs = Array.from({ length: 17 }, (_, index) =>
    createJob(`bill-${index + 1}`, index + 1, "new", 1),
  );
  const segments = flattenBarKdsColumns(
    buildBarKdsColumns(jobs, testLayout),
  );

  assert.equal(segments.length, 17);
  assert.deepEqual(
    segments.map((segment) => segment.queueNumber),
    Array.from({ length: 17 }, (_, index) => index + 1),
  );
});
