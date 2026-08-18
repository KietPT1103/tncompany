export type PaginatedItems<T> = {
  items: T[];
  page: number;
  totalPages: number;
  from: number;
  to: number;
};

export function paginateItems<T>(
  items: T[],
  requestedPage: number,
  requestedPageSize: number,
): PaginatedItems<T> {
  const pageSize = Math.max(1, Math.floor(requestedPageSize));
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), totalPages);
  const startIndex = (page - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: pageItems,
    page,
    totalPages,
    from: pageItems.length > 0 ? startIndex + 1 : 0,
    to: startIndex + pageItems.length,
  };
}
