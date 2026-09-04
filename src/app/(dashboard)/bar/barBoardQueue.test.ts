import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveBarQueue,
  getMobileBarQueue,
  getBarQueueColumns,
  getBarQueueNumber,
  getBarQueueOverflowCount,
} from "./barBoardQueue.ts";

const createJob = (
  id: string,
  seconds: number,
  workflowStatus: "new" | "preparing" | "ready" | "collected",
) => ({
  id,
  storeId: "cafe",
  tableNumber: id,
  items: [],
  status: "printed" as const,
  workflowStatus,
  createdAt: { seconds },
});

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

test("keeps the first five bills together in the left column", () => {
  const jobs = Array.from({ length: 5 }, (_, index) =>
    createJob(`bill-${index + 1}`, index + 1, "new"),
  );

  const columns = getBarQueueColumns(jobs);

  assert.deepEqual(
    columns.map((column) => column.map((job) => job.id)),
    [["bill-1", "bill-2", "bill-3", "bill-4", "bill-5"], [], []],
  );
});

test("fills each column with five bills before using the next column", () => {
  const jobs = Array.from({ length: 12 }, (_, index) =>
    createJob(`bill-${index + 1}`, index + 1, "new"),
  );

  const columns = getBarQueueColumns(jobs);

  assert.deepEqual(
    columns.map((column) => column.map((job) => job.id)),
    [
      ["bill-1", "bill-2", "bill-3", "bill-4", "bill-5"],
      ["bill-6", "bill-7", "bill-8", "bill-9", "bill-10"],
      ["bill-11", "bill-12"],
    ],
  );
});

test("shows the first fifteen bills as one continuous mobile queue", () => {
  const jobs = Array.from({ length: 17 }, (_, index) =>
    createJob(`bill-${index + 1}`, index + 1, "new"),
  );

  const mobileQueue = getMobileBarQueue(jobs);

  assert.deepEqual(mobileQueue, jobs.slice(0, 15));
});

test("shows at most five bills in the right column and reports the hidden queue", () => {
  const jobs = Array.from({ length: 17 }, (_, index) =>
    createJob(`bill-${index + 1}`, index + 1, "new"),
  );

  const columns = getBarQueueColumns(jobs);

  assert.equal(columns[0].length, 5);
  assert.equal(columns[1].length, 5);
  assert.equal(columns[2].length, 5);
  assert.deepEqual(columns.flat(), jobs.slice(0, 15));
  assert.equal(getBarQueueOverflowCount(jobs), 2);
});

test("promotes the oldest hidden bill when a visible bill is completed", () => {
  const jobs = Array.from({ length: 17 }, (_, index) =>
    createJob(`bill-${index + 1}`, index + 1, "new"),
  );
  const jobsAfterCompletion = jobs.filter((job) => job.id !== "bill-1");

  const visibleJobs = getBarQueueColumns(jobsAfterCompletion).flat();

  assert.deepEqual(visibleJobs, jobs.slice(1, 16));
  assert.equal(getBarQueueOverflowCount(jobsAfterCompletion), 1);
});

test("numbers visible bills continuously from the left column to the right column", () => {
  assert.equal(getBarQueueNumber(0, 0), 1);
  assert.equal(getBarQueueNumber(0, 4), 5);
  assert.equal(getBarQueueNumber(1, 0), 6);
  assert.equal(getBarQueueNumber(2, 4), 15);
});
