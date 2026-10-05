import { ChevronLeft, ChevronRight } from "lucide-react";

import { getPaginationState, LIST_PAGE_SIZE } from "@/lib/listPagination";
import { cn } from "@/lib/utils";

type PaginationItem = number | "ellipsis";

export function getVisiblePaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 5)
    return Array.from({ length: totalPages }, (_, index) => index + 1);

  if (currentPage <= 3) return [1, 2, 3, "ellipsis", totalPages];
  if (currentPage >= totalPages - 2)
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];

  return [1, "ellipsis", currentPage, "ellipsis", totalPages];
}

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  className?: string;
  showSummary?: boolean;
  disabled?: boolean;
};

export function Pagination({
  currentPage,
  totalItems,
  onPageChange,
  pageSize = LIST_PAGE_SIZE,
  className,
  showSummary = true,
  disabled = false,
}: PaginationProps) {
  const pagination = getPaginationState(totalItems, currentPage, pageSize);
  const isFirstPage = pagination.currentPage === 1;
  const isLastPage = pagination.currentPage === pagination.totalPages;
  const visibleItems = getVisiblePaginationItems(
    pagination.currentPage,
    pagination.totalPages,
  );

  return (
    <nav
      aria-label="Phân trang"
      className={cn(
        "flex min-h-14 items-center justify-center gap-3 border-t border-slate-200 bg-white px-3 py-2",
        showSummary && "sm:justify-between sm:px-4",
        className,
      )}
    >
      {showSummary ? (
        <p className="hidden text-sm text-slate-600 tabular-nums sm:block">
          {pagination.rangeStart}–{pagination.rangeEnd} / {pagination.totalItems}
        </p>
      ) : null}

      <div className="flex items-center gap-1.5" aria-live="polite">
        <button
          type="button"
          disabled={disabled || isFirstPage}
          onClick={() => onPageChange(pagination.currentPage - 1)}
          aria-label="Trang trước"
          title="Trang trước"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 transition-[background-color,color,transform] hover:bg-emerald-100 active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-slate-50 sm:h-10 sm:w-10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {visibleItems.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="inline-flex h-10 min-w-7 items-center justify-center text-sm font-semibold text-emerald-700/60"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => onPageChange(item)}
              aria-label={`Trang ${item}`}
              aria-current={item === pagination.currentPage ? "page" : undefined}
              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-xl border px-2 text-sm font-bold tabular-nums transition-[background-color,border-color,color,transform] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-w-10 ${
                item === pagination.currentPage
                  ? "border-[#064E3B] bg-[#064E3B] text-[#F6C85F] shadow-sm"
                  : "border-emerald-200 bg-white text-emerald-950 hover:border-emerald-400 hover:bg-emerald-50"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={disabled || isLastPage}
          onClick={() => onPageChange(pagination.currentPage + 1)}
          aria-label="Trang sau"
          title="Trang sau"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 transition-[background-color,color,transform] hover:bg-emerald-100 active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-slate-50 sm:h-10 sm:w-10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
