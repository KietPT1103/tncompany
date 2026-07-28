"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  createTikTokSearch,
  getTikTokComments,
  getTikTokSearchStatus,
  TikTokCommentRecord,
  TikTokSearchRecord,
} from "@/services/socialListeningService";

const DEFAULT_PER_PAGE = 10;
const COMMENT_FETCH_BATCH_SIZE = 100;
const MAX_DATE_RANGE_DAYS = 31;
const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DATE_RANGE_PRESETS = [
  { key: "today", label: "H\u00f4m nay", daysBack: 0, singleDay: true },
  { key: "yesterday", label: "H\u00f4m qua", daysBack: 1, singleDay: true },
  { key: "last7", label: "7 ng\u00e0y qua", daysBack: 6, singleDay: false },
  { key: "last30", label: "30 ng\u00e0y qua", daysBack: 29, singleDay: false },
] as const;

const SUMMARY_CARD_CLASS =
  "rounded-xl border-0 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_-1px_rgba(15,23,42,0.08),0_8px_20px_-14px_rgba(15,23,42,0.2)]";
const SUMMARY_CARD_HEADER_CLASS = "px-5 pb-2 pt-5";
const SUMMARY_CARD_TITLE_CLASS =
  "text-base font-semibold leading-5 tracking-normal text-slate-950 text-balance";
const SUMMARY_CARD_CONTENT_CLASS = "px-5 pb-5 pt-0";
const METRIC_GRID_CLASS = "grid grid-cols-2 divide-x divide-slate-100 text-sm";
const METRIC_LABEL_CLASS =
  "min-h-10 text-pretty text-[13px] font-medium leading-5 text-slate-500";
const METRIC_VALUE_CLASS =
  "mt-1.5 text-[1.7rem] font-semibold leading-none tracking-normal text-slate-950 tabular-nums";

const HERO_FILTER_PANEL_CLASS =
  "rounded-2xl bg-white/[0.08] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-sm xl:w-[580px] xl:flex-none";
const HERO_FIELD_LABEL_CLASS = "text-sm font-semibold leading-5 text-white";
const HERO_FIELD_SHELL_CLASS =
  "flex h-11 w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.12] px-1.5 pl-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-white/[0.16] focus-within:border-white/25 focus-within:ring-2 focus-within:ring-white/20";
const HERO_KEYWORD_INPUT_CLASS =
  "min-w-0 flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-teal-50/65";
const DATE_RANGE_TRIGGER_CLASS =
  "flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.12] px-4 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:bg-white/[0.16] focus-visible:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 active:scale-[0.99]";

type AggregatedTikTokComment = TikTokCommentRecord & {
  matchedKeywords: string[];
};

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const now = new Date();
  const dateTo = formatDateInput(now);
  const dateFrom = formatDateInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));

  return { dateFrom, dateTo };
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const fallback = new Date();
  if (!year || !month || !day) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  }

  return new Date(year, month - 1, day);
}

function startOfDate(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, amount: number) {
  const nextDate = startOfDate(value);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function compareDates(left: Date, right: Date) {
  return startOfDate(left).getTime() - startOfDate(right).getTime();
}

function isSameCalendarDate(left: Date, right: Date) {
  return compareDates(left, right) === 0;
}

function buildCalendarDays(monthDate: Date) {
  const firstDate = startOfMonth(monthDate);
  const mondayOffset = (firstDate.getDay() + 6) % 7;
  const gridStart = addDays(firstDate, -mondayOffset);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function formatMonthTitle(value: Date) {
  return "Th\u00e1ng " + (value.getMonth() + 1) + " " + value.getFullYear();
}

function formatCompactDate(value: string) {
  const date = parseDateInput(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateRangeLabel(dateFrom: string, dateTo: string) {
  return formatCompactDate(dateFrom) + " - " + formatCompactDate(dateTo);
}

function formatCalendarAriaLabel(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function getPresetRange(daysBack: number, singleDay = false) {
  const today = startOfDate(new Date());
  const startDate = addDays(today, -daysBack);

  return {
    from: formatDateInput(startDate),
    to: formatDateInput(singleDay ? startDate : today),
  };
}


function CommentSkeletonList() {
  return (
    <div role="status" aria-label={"\u0110ang t\u1ea3i comment TikTok"} className="space-y-3">
      <span className="sr-only">{"\u0110ang t\u1ea3i comment TikTok"}</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          style={{ animationDelay: index * 70 + "ms" }}
          className="social-comment-in rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="social-skeleton-shimmer h-4 w-32 rounded-full bg-slate-100" />
              <div className="social-skeleton-shimmer h-3 w-24 rounded-full bg-slate-100" />
            </div>
            <div className="social-skeleton-shimmer h-9 w-32 rounded-xl bg-slate-100" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="social-skeleton-shimmer h-4 w-full rounded-full bg-slate-100" />
            <div className="social-skeleton-shimmer h-4 w-4/5 rounded-full bg-slate-100" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="social-skeleton-shimmer h-7 w-32 rounded-full bg-slate-100" />
            <div className="social-skeleton-shimmer h-7 w-24 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatExportTimestamp(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");

  return `${year}${month}${day}-${hour}${minute}`;
}

function getStatusLabel(status?: string | null) {
  switch (status) {
    case "queued":
      return "Queued";
    case "fetching_videos":
      return "Đang lấy video";
    case "fetching_comments":
      return "Đang lấy comment";
    case "completed":
      return "Hoàn tất";
    case "failed":
      return "Thất bại";
    case "partial_failed":
      return "Có lỗi một phần";
    default:
      return status || "N/A";
  }
}

function getStatusClasses(status?: string | null) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "failed" || status === "partial_failed") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getDateRangeError(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo) {
    return "Vui lòng chọn đầy đủ khoảng ngày.";
  }

  const startDate = new Date(`${dateFrom}T00:00:00`);
  const endDate = new Date(`${dateTo}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Khoảng ngày không hợp lệ.";
  }

  if (startDate > endDate) {
    return "Từ ngày không được lớn hơn Đến ngày.";
  }

  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (dayCount > MAX_DATE_RANGE_DAYS) {
    return `Khoảng ngày tối đa là ${MAX_DATE_RANGE_DAYS} ngày mỗi lần thu thập.`;
  }

  return "";
}

function buildAggregatedComments(items: TikTokCommentRecord[]) {
  const commentMap = new Map<string, AggregatedTikTokComment>();

  items.forEach((comment) => {
    const key = `${comment.comment_id}:${comment.video_id}`;
    const normalizedKeyword = normalizeKeyword(comment.keyword);
    const existing = commentMap.get(key);

    if (existing) {
      const nextKeywords = new Set(existing.matchedKeywords);
      if (normalizedKeyword) {
        nextKeywords.add(normalizedKeyword);
      }

      commentMap.set(key, {
        ...existing,
        matchedKeywords: Array.from(nextKeywords),
      });
      return;
    }

    commentMap.set(key, {
      ...comment,
      matchedKeywords: normalizedKeyword ? [normalizedKeyword] : [],
    });
  });

  return Array.from(commentMap.values()).sort((left, right) => {
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  });
}

async function fetchAllCommentsForSearch(searchId: string, query: string) {
  const firstPage = await getTikTokComments({
    search_id: searchId,
    page: 1,
    per_page: COMMENT_FETCH_BATCH_SIZE,
    query,
  });

  const items = [...(firstPage.items || [])];
  const lastPage = Math.max(1, firstPage.pagination?.last_page || 1);

  for (let nextPage = 2; nextPage <= lastPage; nextPage += 1) {
    const response = await getTikTokComments({
      search_id: searchId,
      page: nextPage,
      per_page: COMMENT_FETCH_BATCH_SIZE,
      query,
    });
    items.push(...(response.items || []));
  }

  return items;
}
export default function TikTokSearchPage() {
  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [appliedCommentQuery, setAppliedCommentQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [searches, setSearches] = useState<TikTokSearchRecord[]>([]);
  const [comments, setComments] = useState<AggregatedTikTokComment[]>([]);
  const [page, setPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const latestSyncRequestId = useRef(0);
  const activeSyncCount = useRef(0);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [rangeDraftStart, setRangeDraftStart] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(parseDateInput(defaults.dateTo))
  );

  const aggregateStatus = useMemo(() => {
    if (!searches.length) {
      return undefined;
    }

    if (searches.some((search) => search.status === "fetching_comments")) {
      return "fetching_comments";
    }

    if (searches.some((search) => search.status === "fetching_videos")) {
      return "fetching_videos";
    }

    if (searches.some((search) => search.status === "queued")) {
      return "queued";
    }

    if (searches.some((search) => search.status === "partial_failed")) {
      return "partial_failed";
    }

    if (searches.some((search) => search.status === "failed")) {
      return "failed";
    }

    if (searches.every((search) => search.status === "completed")) {
      return "completed";
    }

    return searches[0]?.status;
  }, [searches]);

  const aggregateProgressMessage = useMemo(() => {
    if (!searches.length) {
      return "Chưa có search nào.";
    }

    const activeSearch = searches.find((search) => !search.is_terminal) || searches[0];
    return activeSearch?.progress_message || `Đang theo dõi ${searches.length} từ khóa.`;
  }, [searches]);

  const aggregateProvider = useMemo(() => {
    const providers = Array.from(
      new Set(searches.map((search) => search.provider).filter(Boolean))
    ) as string[];

    if (!providers.length) {
      return "disabled";
    }

    return providers.join(", ");
  }, [searches]);

  const totalVideos = useMemo(
    () => searches.reduce((sum, search) => sum + (search.total_videos || 0), 0),
    [searches]
  );
  const totalComments = comments.length;
  const activeJobs = useMemo(
    () => searches.reduce((sum, search) => sum + (search.active_jobs || 0), 0),
    [searches]
  );
  const processedJobs = useMemo(
    () => searches.reduce((sum, search) => sum + (search.processed_jobs || 0), 0),
    [searches]
  );
  const pendingKeyword = normalizeKeyword(keywordInput);
  const activeDateRangeError = useMemo(
    () => getDateRangeError(dateFrom, dateTo),
    [dateFrom, dateTo]
  );
  const canSubmitSearch = Boolean(pendingKeyword || keywords.length) && !activeDateRangeError;
  const selectedStartDate = useMemo(() => parseDateInput(dateFrom), [dateFrom]);
  const selectedEndDate = useMemo(() => parseDateInput(dateTo), [dateTo]);
  const dateRangeLabel = useMemo(
    () => formatDateRangeLabel(dateFrom, dateTo),
    [dateFrom, dateTo]
  );
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  const pagination = useMemo(() => {
    const total = comments.length;
    const lastPage = Math.max(1, Math.ceil(total / DEFAULT_PER_PAGE));
    const safePage = Math.min(page, lastPage);
    const from = total === 0 ? 0 : (safePage - 1) * DEFAULT_PER_PAGE + 1;
    const to = total === 0 ? 0 : Math.min(total, safePage * DEFAULT_PER_PAGE);

    return {
      page: safePage,
      per_page: DEFAULT_PER_PAGE,
      total,
      from,
      to,
      last_page: lastPage,
    };
  }, [comments.length, page]);

  const paginatedComments = useMemo(() => {
    const startIndex = (pagination.page - 1) * DEFAULT_PER_PAGE;
    return comments.slice(startIndex, startIndex + DEFAULT_PER_PAGE);
  }, [comments, pagination.page]);

  function applyDateRange(nextDateFrom: string, nextDateTo: string) {
    const nextStartDate = parseDateInput(nextDateFrom);
    const nextEndDate = parseDateInput(nextDateTo);
    const [safeFrom, safeTo] = compareDates(nextStartDate, nextEndDate) <= 0
      ? [nextDateFrom, nextDateTo]
      : [nextDateTo, nextDateFrom];

    setDateFrom(safeFrom);
    setDateTo(safeTo);
    setRangeDraftStart(null);
    setVisibleMonth(startOfMonth(parseDateInput(safeTo)));
  }

  function handleDatePreset(daysBack: number, singleDay = false) {
    const range = getPresetRange(daysBack, singleDay);
    applyDateRange(range.from, range.to);
  }

  function handleCalendarDaySelect(day: Date) {
    const selectedDate = formatDateInput(day);
    if (!rangeDraftStart) {
      setRangeDraftStart(selectedDate);
      setDateFrom(selectedDate);
      setDateTo(selectedDate);
      return;
    }

    applyDateRange(rangeDraftStart, selectedDate);
  }

  function resetDateRange() {
    const nextDefaults = getDefaultDateRange();
    applyDateRange(nextDefaults.dateFrom, nextDefaults.dateTo);
  }

  useEffect(() => {
    if (page !== pagination.page) {
      setPage(pagination.page);
    }
  }, [page, pagination.page]);

  function addKeyword(rawValue: string) {
    const normalized = normalizeKeyword(rawValue);
    if (!normalized) return false;

    const exists = keywords.some(
      (keyword) => keyword.toLocaleLowerCase("vi-VN") === normalized.toLocaleLowerCase("vi-VN")
    );
    if (exists) {
      setKeywordInput("");
      return false;
    }

    setKeywords((current) => [...current, normalized]);
    setKeywordInput("");
    return true;
  }

  function removeKeyword(keywordToRemove: string) {
    setKeywords((current) => current.filter((keyword) => keyword !== keywordToRemove));
  }

  async function syncSearches(
    commentFilter = appliedCommentQuery,
    silent = false,
    targetSearches: TikTokSearchRecord[] = searches
  ) {
    if (!targetSearches.length) return;
    if (silent && activeSyncCount.current > 0) return;

    const requestId = latestSyncRequestId.current + 1;
    latestSyncRequestId.current = requestId;
    activeSyncCount.current += 1;

    if (!silent) {
      setIsLoadingComments(true);
    } else {
      setIsPolling(true);
    }

    try {
      const statusResponses = await Promise.all(
        targetSearches.map((search) => getTikTokSearchStatus(search.id))
      );

      const nextSearches = statusResponses.map((response) => response.search);
      const commentGroups = await Promise.all(
        nextSearches.map((search) => fetchAllCommentsForSearch(search.id, commentFilter))
      );

      if (requestId !== latestSyncRequestId.current) return;

      setSearches(nextSearches);
      setComments(buildAggregatedComments(commentGroups.flat()));
    } catch (loadError) {
      console.error(loadError);
      if (requestId === latestSyncRequestId.current) {
        setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu TikTok.");
      }
    } finally {
      activeSyncCount.current = Math.max(0, activeSyncCount.current - 1);
      if (!silent) {
        setIsLoadingComments(false);
      } else {
        setIsPolling(false);
      }
    }
  }

  async function handleSubmit() {
    const nextKeywords = [...keywords];
    const pendingKeyword = normalizeKeyword(keywordInput);

    if (pendingKeyword) {
      const exists = nextKeywords.some(
        (keyword) => keyword.toLocaleLowerCase("vi-VN") === pendingKeyword.toLocaleLowerCase("vi-VN")
      );
      if (!exists) {
        nextKeywords.push(pendingKeyword);
      }
    }

    if (!nextKeywords.length) {
      setError("Vui lòng nhập ít nhất một từ khóa.");
      return;
    }

    const dateRangeError = getDateRangeError(dateFrom, dateTo);
    if (dateRangeError) {
      setError(dateRangeError);
      return;
    }

    setError("");
    setIsSubmitting(true);
    setPage(1);
    setAppliedCommentQuery("");
    setComments([]);
    setSearches([]);
    setKeywordInput("");
    setKeywords(nextKeywords);

    try {
      const responses = await Promise.allSettled(
        nextKeywords.map((keyword) =>
          createTikTokSearch({
            keyword,
            date_from: dateFrom,
            date_to: dateTo,
          })
        )
      );

      const succeededSearches = responses.flatMap((response) =>
        response.status === "fulfilled" ? [response.value.search] : []
      );
      const failedMessages = responses.flatMap((response) =>
        response.status === "rejected"
          ? [response.reason instanceof Error ? response.reason.message : "Không tạo được search TikTok."]
          : []
      );

      if (!succeededSearches.length) {
        throw new Error(failedMessages[0] || "Không tạo được search TikTok.");
      }

      setSearches(succeededSearches);
      await syncSearches("", false, succeededSearches);

      if (failedMessages.length) {
        setError(`Có ${failedMessages.length} từ khóa tạo job thất bại. ${failedMessages[0]}`);
      }
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Không tạo được search TikTok.");
    } finally {
      setIsSubmitting(false);
    }
  }


  function handleExportComments() {
    if (!comments.length) {
      setError("Không có comment để xuất Excel.");
      return;
    }

    setError("");
    setIsExporting(true);

    try {
      const rows = comments.map((comment, index) => ({
        STT: index + 1,
        "Từ khóa": comment.matchedKeywords.join(", "),
        Username: comment.username || "",
        "Nội dung comment": comment.content || "",
        "Ngày comment": formatDisplayDate(comment.created_at),
        video_id: comment.video_id,
        "Video username": comment.video_username || "",
        "Link video": comment.post_url || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "TikTokComments");
      XLSX.writeFile(
        workbook,
        `tiktok-comments-${formatExportTimestamp(new Date())}.xlsx`
      );
    } finally {
      setIsExporting(false);
    }
  }

  useEffect(() => {
    if (!isDatePickerOpen) return;

    function handleDatePickerPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && !datePickerRef.current?.contains(target)) {
        setIsDatePickerOpen(false);
        setRangeDraftStart(null);
      }
    }

    function handleDatePickerKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDatePickerOpen(false);
        setRangeDraftStart(null);
      }
    }

    document.addEventListener("pointerdown", handleDatePickerPointerDown);
    document.addEventListener("keydown", handleDatePickerKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleDatePickerPointerDown);
      document.removeEventListener("keydown", handleDatePickerKeyDown);
    };
  }, [isDatePickerOpen]);

  useEffect(() => {
    if (!searches.length) return;
    if (searches.every((search) => search.is_terminal)) return;

    const timer = window.setInterval(() => {
      void syncSearches(appliedCommentQuery, true, searches);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [appliedCommentQuery, searches]);

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-slate-100 p-3 md:p-5">
        <div className="mx-auto max-w-[1180px] space-y-5">
          <section className="relative z-30 rounded-2xl border border-teal-900/10 bg-[linear-gradient(135deg,#14313a_0%,#0f766e_58%,#115e59_100%)] p-5 text-white shadow-sm">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                  <MessageSquareText className="h-4 w-4" />
                  TikTok Social Listening
                </div>
                <h1 className="font-smooch mt-3 max-w-[50ch] text-balance text-2xl font-bold leading-tight tracking-normal md:text-5xl">
                  Tìm kiếm bình luận TikTok theo từ khóa và thời gian
                </h1>
                <p className="font-firasans mt-2 max-w-[50ch] text-pretty text-sm leading-6 text-teal-50/90">
                  Dữ liệu được lấy trực tiếp từ TikTok.
                </p>
              </div>

              <div className={HERO_FILTER_PANEL_CLASS}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold leading-5 text-white">Bộ lọc thu thập</p>
                  </div>
                  <div className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-white/[0.1] px-3 text-xs font-medium text-teal-50/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
                    <span>Theo dõi</span>
                    <strong className="tabular-nums text-white">{keywords.length || 0}</strong>
                    <span>từ khóa</span>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="social-keyword-input" className={HERO_FIELD_LABEL_CLASS}>
                      Từ khóa
                    </label>
                    <div className={HERO_FIELD_SHELL_CLASS}>
                      <input
                        id="social-keyword-input"
                        value={keywordInput}
                        onChange={(event) => setKeywordInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === ",") {
                            event.preventDefault();
                            addKeyword(keywordInput);
                            return;
                          }

                          if (event.key === "Backspace" && !keywordInput.trim() && keywords.length) {
                            event.preventDefault();
                            removeKeyword(keywords[keywords.length - 1]);
                          }
                        }}
                        placeholder="Nhập keyword TikTok"
                        className={HERO_KEYWORD_INPUT_CLASS}
                      />
                      <button
                        type="button"
                        aria-label="Thêm từ khóa"
                        disabled={!pendingKeyword}
                        onClick={() => addKeyword(keywordInput)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-teal-900 shadow-sm transition-[transform,background-color,color,opacity] duration-150 ease-out hover:bg-teal-50 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {keywords.length ? (
                      <div className="flex flex-wrap gap-2">
                        {keywords.map((keyword) => (
                          <button
                            key={keyword}
                            type="button"
                            aria-label={`Xóa từ khóa ${keyword}`}
                            onClick={() => removeKeyword(keyword)}
                            className="social-chip-in inline-flex min-h-8 items-center gap-2 rounded-full bg-white/[0.14] px-3 py-1 text-xs font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-[transform,background-color] duration-150 ease-out hover:bg-white/[0.2] active:scale-[0.96] motion-reduce:transition-none"
                          >
                            <span>{keyword}</span>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="relative space-y-2" ref={datePickerRef}>
                    <label id="social-date-range-label" className={HERO_FIELD_LABEL_CLASS}>
                      {"Kho\u1ea3ng th\u1eddi gian"}
                    </label>
                    <button
                      type="button"
                      aria-labelledby="social-date-range-label"
                      aria-expanded={isDatePickerOpen}
                      aria-controls="social-date-range-popover"
                      onClick={() => setIsDatePickerOpen((current) => !current)}
                      className={cn(
                        DATE_RANGE_TRIGGER_CLASS,
                        isDatePickerOpen && "border-white/25 bg-white/[0.16] ring-2 ring-white/15",
                        activeDateRangeError && "border-rose-200/70 ring-2 ring-rose-200/20"
                      )}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-teal-50/80" />
                        <span className="truncate text-sm font-semibold tabular-nums text-white">
                          {dateRangeLabel}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-teal-50/80 transition-transform duration-150 ease-out",
                          isDatePickerOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {isDatePickerOpen ? (
                      <div
                        id="social-date-range-popover"
                        role="dialog"
                        aria-label={"Ch\u1ecdn kho\u1ea3ng th\u1eddi gian"}
                        className="social-date-popover-in absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] rounded-2xl bg-white p-3 text-slate-900 shadow-[0_22px_52px_-14px_rgba(15,23,42,0.45)] sm:left-auto sm:right-0 sm:w-[42rem]"
                      >
                        <div className="grid gap-4 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
                          <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
                            {DATE_RANGE_PRESETS.map((preset) => {
                              const presetRange = getPresetRange(preset.daysBack, preset.singleDay);
                              const isActivePreset =
                                presetRange.from === dateFrom && presetRange.to === dateTo;

                              return (
                                <button
                                  key={preset.key}
                                  type="button"
                                  onClick={() => handleDatePreset(preset.daysBack, preset.singleDay)}
                                  className={cn(
                                    "flex h-10 items-center rounded-xl px-3 text-left text-sm font-medium transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none",
                                    isActivePreset
                                      ? "bg-sky-50 text-sky-700"
                                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                                  )}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              onClick={resetDateRange}
                              className="mt-1 flex h-10 items-center rounded-xl px-3 text-left text-sm font-semibold text-sky-600 transition-[transform,background-color,color] duration-150 ease-out hover:bg-sky-50 hover:text-sky-700 active:scale-[0.98] motion-reduce:transition-none sm:mt-auto"
                            >
                              {"\u0110\u1eb7t l\u1ea1i"}
                            </button>
                          </div>

                          <div className="min-w-0">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className="text-base font-semibold leading-6 tracking-normal text-slate-900">
                                {formatMonthTitle(visibleMonth)}
                              </h3>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={"Th\u00e1ng tr\u01b0\u1edbc"}
                                  onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-slate-950 active:scale-[0.96]"
                                >
                                  <ChevronLeft className="h-5 w-5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label={"Th\u00e1ng sau"}
                                  onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-slate-950 active:scale-[0.96]"
                                >
                                  <ChevronRight className="h-5 w-5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
                              {WEEKDAY_LABELS.map((label) => (
                                <div key={label} className="py-2">
                                  {label}
                                </div>
                              ))}
                            </div>

                            <div
                              key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`}
                              className="social-calendar-grid grid grid-cols-7 overflow-hidden rounded-xl text-sm tabular-nums"
                            >
                              {calendarDays.map((day) => {
                                const dayValue = formatDateInput(day);
                                const isOutsideMonth = day.getMonth() !== visibleMonth.getMonth();
                                const isRangeStart = isSameCalendarDate(day, selectedStartDate);
                                const isRangeEnd = isSameCalendarDate(day, selectedEndDate);
                                const isSingleDay = isRangeStart && isRangeEnd;
                                const isInRange =
                                  compareDates(day, selectedStartDate) >= 0 &&
                                  compareDates(day, selectedEndDate) <= 0;
                                const draftStartDate = rangeDraftStart
                                  ? parseDateInput(rangeDraftStart)
                                  : null;
                                const isDraftStart = draftStartDate
                                  ? isSameCalendarDate(day, draftStartDate)
                                  : false;

                                return (
                                  <div
                                    key={dayValue}
                                    className={cn(
                                      "flex h-10 items-center justify-center transition-[background-color,border-radius] duration-150 ease-out",
                                      isInRange && "bg-sky-100",
                                      isSingleDay && "rounded-full",
                                      isRangeStart && !isSingleDay && "rounded-l-full",
                                      isRangeEnd && !isSingleDay && "rounded-r-full"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      aria-label={
                                        "Ch\u1ecdn " + formatCalendarAriaLabel(day)
                                      }
                                      aria-pressed={isRangeStart || isRangeEnd}
                                      onClick={() => handleCalendarDaySelect(day)}
                                      className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full font-medium transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.96]",
                                        (isRangeStart || isRangeEnd) &&
                                          "bg-sky-500 text-white shadow-[0_0_0_4px_rgba(14,165,233,0.18)]",
                                        !(isRangeStart || isRangeEnd) &&
                                          isDraftStart &&
                                          "bg-sky-50 text-sky-700 ring-2 ring-sky-200",
                                        !(isRangeStart || isRangeEnd) &&
                                          !isDraftStart &&
                                          isOutsideMonth &&
                                          "text-slate-300 hover:bg-slate-50 hover:text-slate-500",
                                        !(isRangeStart || isRangeEnd) &&
                                          !isDraftStart &&
                                          !isOutsideMonth &&
                                          "text-slate-800 hover:bg-slate-100"
                                      )}
                                    >
                                      {day.getDate()}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {activeDateRangeError ? (
                      <p id="social-date-range-error" className="mt-2 text-xs font-medium text-rose-100" role="alert">
                        {activeDateRangeError}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    className="h-11 flex-1 whitespace-nowrap rounded-xl bg-white pl-4 pr-3.5 text-slate-900 shadow-sm transition-[transform,background-color,color,box-shadow] duration-150 ease-out hover:bg-slate-100 active:scale-[0.96] disabled:opacity-60"
                    onClick={() => void handleSubmit()}
                    disabled={!canSubmitSearch}
                    isLoading={isSubmitting}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Thu thập dữ liệu
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 whitespace-nowrap rounded-xl border-white/15 bg-white/[0.08] pl-4 pr-3.5 text-white shadow-none transition-[transform,background-color,color,box-shadow] duration-150 ease-out hover:bg-white/[0.14] active:scale-[0.96] sm:min-w-[124px]"
                    disabled={!searches.length}
                    onClick={() => void syncSearches(appliedCommentQuery, false)}
                    isLoading={isLoadingComments && !isSubmitting}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Tải lại
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div className="social-alert-in rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className={SUMMARY_CARD_CLASS}>
              <CardHeader className={SUMMARY_CARD_HEADER_CLASS}>
                <CardTitle className={SUMMARY_CARD_TITLE_CLASS}>Trạng thái job</CardTitle>
              </CardHeader>
              <CardContent className={`${SUMMARY_CARD_CONTENT_CLASS} space-y-3`}>
                <div className="flex min-h-7 items-center gap-2">
                  <span className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${getStatusClasses(aggregateStatus)}`}>
                    {getStatusLabel(aggregateStatus)}
                  </span>
                  {isPolling ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                </div>
                <div className="text-pretty text-sm leading-5 text-slate-600">{aggregateProgressMessage}</div>
                <div className="text-xs font-medium text-slate-500">Provider: {aggregateProvider}</div>
              </CardContent>
            </Card>

            <Card className={SUMMARY_CARD_CLASS}>
              <CardHeader className={SUMMARY_CARD_HEADER_CLASS}>
                <CardTitle className={SUMMARY_CARD_TITLE_CLASS}>Từ khóa</CardTitle>
              </CardHeader>
              <CardContent className={`${SUMMARY_CARD_CONTENT_CLASS} ${METRIC_GRID_CLASS}`}>
                <div className="min-w-0 pr-4">
                  <div className={METRIC_LABEL_CLASS}>Đã nhập</div>
                  <div className={METRIC_VALUE_CLASS}>{keywords.length}</div>
                </div>
                <div className="min-w-0 pl-4">
                  <div className={METRIC_LABEL_CLASS}>Job tạo thành công</div>
                  <div className={METRIC_VALUE_CLASS}>{searches.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className={SUMMARY_CARD_CLASS}>
              <CardHeader className={SUMMARY_CARD_HEADER_CLASS}>
                <CardTitle className={SUMMARY_CARD_TITLE_CLASS}>Kết quả thu thập</CardTitle>
              </CardHeader>
              <CardContent className={`${SUMMARY_CARD_CONTENT_CLASS} ${METRIC_GRID_CLASS}`}>
                <div className="min-w-0 pr-4">
                  <div className={METRIC_LABEL_CLASS}>Tổng videos</div>
                  <div className={METRIC_VALUE_CLASS}>{totalVideos}</div>
                </div>
                <div className="min-w-0 pl-4">
                  <div className={METRIC_LABEL_CLASS}>Tổng comments</div>
                  <div className={METRIC_VALUE_CLASS}>{totalComments}</div>
                </div>
              </CardContent>
            </Card>

            <Card className={SUMMARY_CARD_CLASS}>
              <CardHeader className={SUMMARY_CARD_HEADER_CLASS}>
                <CardTitle className={SUMMARY_CARD_TITLE_CLASS}>Queue</CardTitle>
              </CardHeader>
              <CardContent className={`${SUMMARY_CARD_CONTENT_CLASS} ${METRIC_GRID_CLASS}`}>
                <div className="min-w-0 pr-4">
                  <div className={METRIC_LABEL_CLASS}>Job đang chạy</div>
                  <div className={METRIC_VALUE_CLASS}>{activeJobs}</div>
                </div>
                <div className="min-w-0 pl-4">
                  <div className={METRIC_LABEL_CLASS}>Đã xử lý</div>
                  <div className={METRIC_VALUE_CLASS}>{processedJobs}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-2xl border-0 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_-1px_rgba(15,23,42,0.08),0_8px_20px_-12px_rgba(15,23,42,0.22)] transition-[box-shadow] duration-150 ease-out">
            <CardHeader className="flex flex-col gap-3 p-5 pb-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg tracking-normal text-slate-900">{"Danh s\u00e1ch comment th\u1eadt"}</CardTitle>
                <p className="mt-1 text-pretty text-sm text-slate-500">
                  {"H\u1ec7 th\u1ed1ng \u0111ang g\u1ed9p comment t\u1eeb t\u1ea5t c\u1ea3 keyword \u0111\u00e3 t\u1ea1o job."}
                </p>
              </div>

              <div className="flex flex-col gap-2 lg:items-end">
                <Button
                  variant="outline"
                  className="h-10 min-w-[128px] whitespace-nowrap rounded-xl px-4 transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.96]"
                  disabled={!comments.length || isLoadingComments}
                  isLoading={isExporting}
                  onClick={handleExportComments}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {"Xu\u1ea5t Excel"}
                </Button>

                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {pagination.total > 0 ? (
                    <>
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                      {"\u0110ang xem "}
                      <strong className="tabular-nums text-slate-900">{pagination.from}-{pagination.to}</strong>
                      {" / "}
                      <span className="tabular-nums">{pagination.total}</span>
                    </>
                  ) : (
                    "Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u"
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5 pt-0">
              {isLoadingComments && !comments.length ? (
                <CommentSkeletonList />
              ) : paginatedComments.length ? (
                paginatedComments.map((comment, index) => (
                  <article
                    key={comment.id}
                    style={{ animationDelay: `${Math.min(index, 6) * 24}ms` }}
                    className="social-comment-in rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          @{comment.username || "unknown"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDisplayDate(comment.created_at)}
                        </div>
                      </div>

                      <a
                        href={comment.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-slate-800 hover:shadow-sm active:scale-[0.96] motion-reduce:transition-none"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Xem bài TikTok
                      </a>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-700">{comment.content}</p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">video_id: {comment.video_id}</span>
                      {comment.video_username ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1">
                          @{comment.video_username}
                        </span>
                      ) : null}
                      {comment.matchedKeywords.map((keyword) => (
                        <span
                          key={`${comment.comment_id}-${keyword}`}
                          className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <div className="social-empty-in rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  {searches.length
                    ? "Không có comment thỏa điều kiện hoặc worker chưa đồng bộ xong."
                    : "Nhập từ khóa và khoảng ngày để bắt đầu crawl dữ liệu TikTok."}
                </div>
              )}

              {pagination.total > 0 && (
                <div className="mt-6 flex flex-col items-center gap-3 py-3 md:flex-row md:justify-center">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Về trang đầu"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-[transform,background-color,color] duration-150 ease-out hover:bg-slate-100 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronsLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Trang trước"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-[transform,background-color,color] duration-150 ease-out hover:bg-slate-100 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {Array.from({ length: Math.min(5, pagination.last_page) }, (_, i) => {
                      let start = Math.max(1, pagination.page - 2);
                      let end = Math.min(pagination.last_page, start + 4);
                      if (end - start < 4) {
                        start = Math.max(1, end - 4);
                      }
                      const currentPage = start + i;
                      if (currentPage > pagination.last_page) return null;

                      const isCurrent = currentPage === pagination.page;

                      return (
                        <button
                          type="button"
                          key={currentPage}
                          aria-label={`Đến trang ${currentPage}`}
                          aria-current={isCurrent ? "page" : undefined}
                          onClick={() => setPage(currentPage)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm tabular-nums transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96] ${
                            isCurrent
                              ? "bg-[#1976D2] font-medium text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {currentPage}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      aria-label="Trang sau"
                      disabled={pagination.page >= pagination.last_page}
                      onClick={() =>
                        setPage((current) => Math.min(pagination.last_page || 1, current + 1))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-[transform,background-color,color] duration-150 ease-out hover:bg-slate-100 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Đến trang cuối"
                      disabled={pagination.page >= pagination.last_page}
                      onClick={() => setPage(pagination.last_page)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-[transform,background-color,color] duration-150 ease-out hover:bg-slate-100 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronsRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-500 md:ml-4">
                    <input
                      type="number"
                      aria-label="Nhập số trang"
                      min={1}
                      max={pagination.last_page}
                      value={page}
                      onChange={(event) => {
                        const value = parseInt(event.target.value, 10);
                        if (!Number.isNaN(value) && value >= 1 && value <= pagination.last_page) {
                          setPage(value);
                        }
                      }}
                      className="h-10 w-16 rounded-lg border border-slate-300 text-center text-slate-700 tabular-nums outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400 focus:border-[#1976D2] focus:shadow-[0_0_0_3px_rgba(25,118,210,0.12)]"
                    />
                    <span>/ <span className="tabular-nums">{pagination.last_page}</span> trang</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </RoleGuard>
  );
}
