export const LIST_PAGE_SIZE = 10;

export type PaginationState = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
};

function getCreatedAtMilliseconds(value: unknown): number {
  if (value instanceof Date) return value.getTime();

  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const milliseconds = Date.parse(value);
    return Number.isNaN(milliseconds) ? Number.NEGATIVE_INFINITY : milliseconds;
  }

  if (value && typeof value === "object") {
    const timestamp = value as {
      seconds?: unknown;
      _seconds?: unknown;
    };
    const seconds = timestamp.seconds ?? timestamp._seconds;

    if (typeof seconds === "number") return seconds * 1000;
  }

  return Number.NEGATIVE_INFINITY;
}

export function sortByCreatedAtDesc<T extends { createdAt?: unknown }>(
  items: readonly T[],
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      createdAt: getCreatedAtMilliseconds(item.createdAt),
    }))
    .sort(
      (left, right) =>
        right.createdAt - left.createdAt || left.index - right.index,
    )
    .map(({ item }) => item);
}

export function getPaginationState(
  totalItems: number,
  requestedPage: number,
  requestedPageSize = LIST_PAGE_SIZE,
): PaginationState {
  const safeTotalItems = Math.max(0, Math.floor(totalItems));
  const pageSize = Math.max(1, Math.floor(requestedPageSize));
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / pageSize));
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Math.floor(requestedPage) || 1),
  );
  const rangeStart = safeTotalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, safeTotalItems);

  return {
    currentPage,
    totalPages,
    pageSize,
    totalItems: safeTotalItems,
    rangeStart,
    rangeEnd,
  };
}

export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize = LIST_PAGE_SIZE,
) {
  const pagination = getPaginationState(items.length, requestedPage, pageSize);
  const startIndex = (pagination.currentPage - 1) * pagination.pageSize;

  return {
    items: items.slice(startIndex, startIndex + pagination.pageSize),
    pagination,
  };
}
