import type { BarPrintJob } from "@/services/barPrintJobService";

export const BAR_BILLS_PER_COLUMN = 5;
export const BAR_VISIBLE_COLUMN_COUNT = 3;
export const BAR_MAX_VISIBLE_BILLS =
  BAR_BILLS_PER_COLUMN * BAR_VISIBLE_COLUMN_COUNT;

const getCreatedTime = (job: BarPrintJob) =>
  job.createdAt?.seconds ? job.createdAt.seconds * 1000 : 0;

export function getActiveBarQueue(jobs: BarPrintJob[]): BarPrintJob[] {
  return jobs
    .filter((job) => job.workflowStatus !== "collected")
    .slice()
    .sort((left, right) => getCreatedTime(left) - getCreatedTime(right));
}

export function getBarQueueColumns(
  jobs: BarPrintJob[],
): [BarPrintJob[], BarPrintJob[], BarPrintJob[]] {
  return [
    jobs.slice(0, BAR_BILLS_PER_COLUMN),
    jobs.slice(BAR_BILLS_PER_COLUMN, BAR_BILLS_PER_COLUMN * 2),
    jobs.slice(BAR_BILLS_PER_COLUMN * 2, BAR_MAX_VISIBLE_BILLS),
  ];
}

export function getMobileBarQueue(jobs: BarPrintJob[]): BarPrintJob[] {
  return jobs.slice(0, BAR_MAX_VISIBLE_BILLS);
}

export function getBarQueueOverflowCount(jobs: BarPrintJob[]): number {
  return Math.max(0, jobs.length - BAR_MAX_VISIBLE_BILLS);
}

export function getBarQueueNumber(
  columnIndex: number,
  billIndex: number,
): number {
  return columnIndex * BAR_BILLS_PER_COLUMN + billIndex + 1;
}
