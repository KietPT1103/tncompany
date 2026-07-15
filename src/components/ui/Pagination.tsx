import { ChevronLeft, ChevronRight } from "lucide-react";

import { getPaginationState, LIST_PAGE_SIZE } from "@/lib/listPagination";
import { Button } from "./Button";

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
};

export function Pagination({
  currentPage,
  totalItems,
  onPageChange,
  pageSize = LIST_PAGE_SIZE,
}: PaginationProps) {
  const pagination = getPaginationState(totalItems, currentPage, pageSize);
  const isFirstPage = pagination.currentPage === 1;
  const isLastPage = pagination.currentPage === pagination.totalPages;

  return (
    <nav
      aria-label="Phân trang"
      className="flex min-h-14 items-center justify-center gap-3 border-t border-slate-200 bg-white px-3 py-2 sm:justify-between sm:px-4"
    >
      <p className="hidden text-sm text-slate-600 tabular-nums sm:block">
        {pagination.rangeStart}–{pagination.rangeEnd} / {pagination.totalItems}
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isFirstPage}
          onClick={() => onPageChange(pagination.currentPage - 1)}
          aria-label="Trang trước"
          title="Trang trước"
          className="h-11 w-11 text-slate-600 transition-[background-color,color,transform] active:scale-[0.96] sm:h-10 sm:w-10"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span
          aria-label={`Trang ${pagination.currentPage} trên ${pagination.totalPages}`}
          aria-live="polite"
          aria-atomic="true"
          className="inline-flex h-10 min-w-16 items-center justify-center rounded-md bg-slate-100 px-2 text-sm font-semibold text-slate-800 tabular-nums"
        >
          {pagination.currentPage} / {pagination.totalPages}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isLastPage}
          onClick={() => onPageChange(pagination.currentPage + 1)}
          aria-label="Trang sau"
          title="Trang sau"
          className="h-11 w-11 text-slate-600 transition-[background-color,color,transform] active:scale-[0.96] sm:h-10 sm:w-10"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
