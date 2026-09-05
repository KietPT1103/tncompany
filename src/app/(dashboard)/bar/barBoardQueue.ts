import type {
  BarPrintJob,
  BarPrintJobItem,
} from "@/services/barPrintJobService";

export const BAR_KDS_TICKET_WIDTH = 320;
export const BAR_KDS_COLUMN_GAP = 4;
export const BAR_KDS_TICKET_HORIZONTAL_OVERLAP_PX = 20;
export const BAR_KDS_TICKET_VERTICAL_OVERLAP_PX = 20;
export const BAR_KDS_DEFAULT_COLUMN_HEIGHT = 640;
export const BAR_KDS_MOBILE_SEGMENT_HEIGHT = 560;
export const BAR_KDS_RECEIPT_CONTENT_FOOTER_GAP_PX = 12;
export const BAR_KDS_RECEIPT_FOOTER_SAFE_AREA_PX = 40;
export const BAR_KDS_RECEIPT_HEADER_SAFE_AREA_PX = 40;

const BAR_KDS_PREVIOUS_FOOTER_INSET = 24;
const BAR_KDS_FOOTER_INSET_GROWTH =
  BAR_KDS_RECEIPT_FOOTER_SAFE_AREA_PX - BAR_KDS_PREVIOUS_FOOTER_INSET;
const BAR_KDS_PREVIOUS_HEADER_INSET = 24;
const BAR_KDS_HEADER_INSET_GROWTH =
  BAR_KDS_RECEIPT_HEADER_SAFE_AREA_PX - BAR_KDS_PREVIOUS_HEADER_INSET;
const BAR_KDS_FIRST_SEGMENT_BASE_HEIGHT =
  164 + BAR_KDS_FOOTER_INSET_GROWTH + BAR_KDS_HEADER_INSET_GROWTH;
const BAR_KDS_CONTINUATION_SEGMENT_BASE_HEIGHT =
  100 + BAR_KDS_FOOTER_INSET_GROWTH + BAR_KDS_HEADER_INSET_GROWTH;
const BAR_KDS_COMPLETION_ACTION_HEIGHT = 48;
const BAR_KDS_CONTINUATION_CUE_HEIGHT = 24;

export type BarKdsTicketSegment = {
  job: BarPrintJob;
  queueNumber: number;
  segmentIndex: number;
  segmentCount: number;
  itemStartIndex: number;
  items: BarPrintJobItem[];
  remainingItemCount: number;
  estimatedHeight: number;
  isContinuation: boolean;
  isFinal: boolean;
};

export type BarKdsLayoutOptions = {
  columnHeight: number;
  columnGap?: number;
  firstSegmentBaseHeight?: number;
  continuationSegmentBaseHeight?: number;
  completionActionHeight?: number;
  continuationCueHeight?: number;
  estimateItemHeight?: (item: BarPrintJobItem) => number;
};

const getCreatedTime = (job: BarPrintJob) =>
  job.createdAt?.seconds ? job.createdAt.seconds * 1000 : 0;

const getTextLineCount = (value: string | undefined, charactersPerLine: number) =>
  Math.max(1, Math.ceil((value?.trim().length || 1) / charactersPerLine));

export const estimateBarKdsItemHeight = (item: BarPrintJobItem) => {
  const nameHeight = getTextLineCount(item.name, 34) * 18;
  const noteHeight = item.note
    ? getTextLineCount(`Ghi chú: ${item.note}`, 38) * 15 + 2
    : 0;
  return nameHeight + noteHeight + 4;
};

export const getBarKdsBoardContentHeight = (
  clientHeight: number,
  paddingTop: number,
  paddingBottom: number,
  viewportHeight?: number,
  boardTop?: number,
) => {
  const viewportAvailableHeight =
    viewportHeight !== undefined && boardTop !== undefined
      ? Math.max(0, viewportHeight - boardTop)
      : 0;

  return Math.max(
    1,
    Math.max(clientHeight, viewportAvailableHeight) -
      paddingTop -
      paddingBottom,
  );
};

export function getActiveBarQueue(jobs: BarPrintJob[]): BarPrintJob[] {
  return jobs
    .filter((job) => job.workflowStatus !== "collected")
    .slice()
    .sort((left, right) => getCreatedTime(left) - getCreatedTime(right));
}

export function buildBarKdsColumns(
  jobs: BarPrintJob[],
  options: BarKdsLayoutOptions,
): BarKdsTicketSegment[][] {
  const columnHeight = Math.max(1, options.columnHeight);
  const columnGap = options.columnGap ?? BAR_KDS_COLUMN_GAP;
  const firstBaseHeight =
    options.firstSegmentBaseHeight ?? BAR_KDS_FIRST_SEGMENT_BASE_HEIGHT;
  const continuationBaseHeight =
    options.continuationSegmentBaseHeight ??
    BAR_KDS_CONTINUATION_SEGMENT_BASE_HEIGHT;
  const completionActionHeight =
    options.completionActionHeight ?? BAR_KDS_COMPLETION_ACTION_HEIGHT;
  const continuationCueHeight =
    options.continuationCueHeight ?? BAR_KDS_CONTINUATION_CUE_HEIGHT;
  const estimateItemHeight =
    options.estimateItemHeight ?? estimateBarKdsItemHeight;
  const columns: BarKdsTicketSegment[][] = [[]];
  const usedHeights = [0];

  const getColumnIndex = () => columns.length - 1;
  const startColumn = () => {
    if (columns[getColumnIndex()].length === 0) return;
    columns.push([]);
    usedHeights.push(0);
  };

  const pushSegment = (segment: BarKdsTicketSegment) => {
    const columnIndex = getColumnIndex();
    const gap = columns[columnIndex].length ? columnGap : 0;
    columns[columnIndex].push(segment);
    usedHeights[columnIndex] += gap + segment.estimatedHeight;
  };

  jobs.forEach((job, jobIndex) => {
    const itemHeights = job.items.map(estimateItemHeight);
    const jobSegments: BarKdsTicketSegment[] = [];
    let itemStartIndex = 0;
    let segmentIndex = 0;
    let complete = false;

    while (!complete) {
      const isContinuation = segmentIndex > 0;
      const baseHeight = isContinuation
        ? continuationBaseHeight
        : firstBaseHeight;
      const columnIndex = getColumnIndex();
      const gap = columns[columnIndex].length ? columnGap : 0;
      const availableHeight =
        columnHeight - usedHeights[columnIndex] - gap;
      const remainingItemHeights = itemHeights.slice(itemStartIndex);
      const finalHeight =
        baseHeight +
        remainingItemHeights.reduce((total, height) => total + height, 0) +
        completionActionHeight;

      if (finalHeight <= availableHeight || job.items.length === 0) {
        const segment: BarKdsTicketSegment = {
          job,
          queueNumber: jobIndex + 1,
          segmentIndex,
          segmentCount: 0,
          itemStartIndex,
          items: job.items.slice(itemStartIndex),
          remainingItemCount: job.items.length - itemStartIndex,
          estimatedHeight: finalHeight,
          isContinuation,
          isFinal: true,
        };
        pushSegment(segment);
        jobSegments.push(segment);
        complete = true;
        continue;
      }

      let fittedItemCount = 0;
      let fittedItemsHeight = 0;
      for (const itemHeight of remainingItemHeights) {
        if (
          baseHeight +
            continuationCueHeight +
            fittedItemsHeight +
            itemHeight >
          availableHeight
        ) {
          break;
        }
        fittedItemsHeight += itemHeight;
        fittedItemCount += 1;
      }

      if (fittedItemCount === 0 && columns[columnIndex].length > 0) {
        startColumn();
        continue;
      }

      if (fittedItemCount >= remainingItemHeights.length) {
        if (columns[columnIndex].length > 0) {
          startColumn();
          continue;
        }
        fittedItemCount = Math.max(0, remainingItemHeights.length - 1);
        fittedItemsHeight = remainingItemHeights
          .slice(0, fittedItemCount)
          .reduce((total, height) => total + height, 0);
      }

      if (fittedItemCount === 0) {
        fittedItemCount = 1;
        fittedItemsHeight = remainingItemHeights[0] || 0;
      }

      const segment: BarKdsTicketSegment = {
        job,
        queueNumber: jobIndex + 1,
        segmentIndex,
        segmentCount: 0,
        itemStartIndex,
        items: job.items.slice(
          itemStartIndex,
          itemStartIndex + fittedItemCount,
        ),
        remainingItemCount: job.items.length - itemStartIndex,
        estimatedHeight:
          baseHeight + fittedItemsHeight + continuationCueHeight,
        isContinuation,
        isFinal: false,
      };
      pushSegment(segment);
      jobSegments.push(segment);
      itemStartIndex += fittedItemCount;
      segmentIndex += 1;

      // A continuation always begins in the next visual KDS column.
      startColumn();
    }

    for (const segment of jobSegments) {
      segment.segmentCount = jobSegments.length;
    }
  });

  return columns.filter((column) => column.length > 0);
}

export function flattenBarKdsColumns(
  columns: BarKdsTicketSegment[][],
): BarKdsTicketSegment[] {
  return columns.flat();
}

type BarKdsRenderedHeightPackingOptions = {
  columnHeight: number;
  columnGap?: number;
  getRenderedHeight: (segment: BarKdsTicketSegment) => number | undefined;
};

export function repackBarKdsColumnsByRenderedHeight(
  columns: BarKdsTicketSegment[][],
  options: BarKdsRenderedHeightPackingOptions,
): BarKdsTicketSegment[][] {
  const segments = flattenBarKdsColumns(columns);
  if (!segments.length) return [];

  const columnHeight = Math.max(1, options.columnHeight);
  const columnGap = options.columnGap ?? BAR_KDS_COLUMN_GAP;
  const packedColumns: BarKdsTicketSegment[][] = [[]];
  const usedHeights = [0];

  for (const segment of segments) {
    let columnIndex = packedColumns.length - 1;
    const renderedHeight = options.getRenderedHeight(segment);
    const segmentHeight =
      renderedHeight && renderedHeight > 0
        ? Math.floor(renderedHeight)
        : segment.estimatedHeight;
    const gap = packedColumns[columnIndex].length ? columnGap : 0;
    const mustStartNextColumn =
      packedColumns[columnIndex].length > 0 &&
      (segment.isContinuation ||
        usedHeights[columnIndex] + gap + segmentHeight > columnHeight);

    if (mustStartNextColumn) {
      packedColumns.push([]);
      usedHeights.push(0);
      columnIndex += 1;
    }

    const appliedGap = packedColumns[columnIndex].length ? columnGap : 0;
    packedColumns[columnIndex].push(segment);
    usedHeights[columnIndex] += appliedGap + segmentHeight;
  }

  return packedColumns;
}
