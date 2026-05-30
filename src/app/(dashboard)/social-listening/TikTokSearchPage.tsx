"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  createTikTokSearch,
  getTikTokComments,
  getTikTokSearchStatus,
  TikTokCommentRecord,
  TikTokSearchRecord,
} from "@/services/socialListeningService";

const DEFAULT_PER_PAGE = 10;
const COMMENT_FETCH_BATCH_SIZE = 100;

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
  const [commentQuery, setCommentQuery] = useState("");
  const [appliedCommentQuery, setAppliedCommentQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [searches, setSearches] = useState<TikTokSearchRecord[]>([]);
  const [comments, setComments] = useState<AggregatedTikTokComment[]>([]);
  const [page, setPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState("");

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

      setSearches(nextSearches);
      setComments(buildAggregatedComments(commentGroups.flat()));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu TikTok.");
    } finally {
      setIsLoadingComments(false);
      setIsPolling(false);
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

    setError("");
    setIsSubmitting(true);
    setPage(1);
    setCommentQuery("");
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

  async function handleCommentSearch() {
    if (!searches.length) return;
    setPage(1);
    setAppliedCommentQuery(commentQuery);
    await syncSearches(commentQuery, false, searches);
  }

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
      <main className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.18),_transparent_32%),linear-gradient(135deg,#111827_0%,#0f766e_55%,#164e63_100%)] p-6 text-white shadow-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-lg">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-semibold">
                  <MessageSquareText className="h-4 w-4" />
                  TikTok Social Listening
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  Tìm comment TikTok thật theo keyword và khoảng ngày
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                  Module này chỉ đọc dữ liệu thật từ TikTok thông qua provider được cấu hình. Nếu
                  không lấy được dữ liệu, hệ thống trả về rỗng và không sinh comment giả.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur lg:min-w-[560px]">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <Input
                      label="Từ khóa"
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
                      placeholder="Nhập từ khóa rồi nhấn Enter để thêm"
                      className="h-11 rounded-2xl border-white/10 bg-white/10 text-white placeholder:text-slate-300"
                    />

                    {keywords.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {keywords.map((keyword) => (
                          <button
                            key={keyword}
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/15"
                          >
                            <span>{keyword}</span>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <Input
                    label="Từ ngày"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-11 rounded-2xl border-white/10 bg-white/10 text-white"
                  />
                  <Input
                    label="Đến ngày"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-11 rounded-2xl border-white/10 bg-white/10 text-white"
                  />
                  <div className="flex items-end">
                    <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      Đang theo dõi <strong className="text-white">{keywords.length || 0}</strong> từ khóa
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    className="h-11 rounded-2xl bg-white text-slate-900 hover:bg-slate-100"
                    onClick={() => void handleSubmit()}
                    isLoading={isSubmitting}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Thu thập dữ liệu
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
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
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-4">
            <Card className="rounded-[28px] border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900">Trạng thái job</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(aggregateStatus)}`}>
                    {getStatusLabel(aggregateStatus)}
                  </span>
                  {isPolling ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                </div>
                <div className="text-sm text-slate-600">{aggregateProgressMessage}</div>
                <div className="text-xs text-slate-500">Provider: {aggregateProvider}</div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900">Từ khóa</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Đã nhập</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{keywords.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Job tạo thành công</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{searches.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900">Kết quả thu thập</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Videos đã thu thập</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{totalVideos}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Comments unique</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{totalComments}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900">Queue</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Job đang chạy</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{activeJobs}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Đã xử lý</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{processedJobs}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-[28px] border-slate-200">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Danh sách comment thật</CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  Hệ thống đang gộp comment từ tất cả keyword đã tạo job. Không có mock data.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                  <Input
                    value={commentQuery}
                    onChange={(event) => setCommentQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCommentSearch();
                      }
                    }}
                    placeholder="Lọc theo nội dung, user, video_id..."
                    className="h-11 min-w-[280px] rounded-2xl"
                  />
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl"
                    disabled={!searches.length}
                    onClick={() => void handleCommentSearch()}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Tìm comment
                  </Button>
                </div>

                <div className="inline-flex items-center gap-2 rounded-[20px] bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                  {pagination.total > 0 ? (
                    <>
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                      Đang xem <strong className="text-slate-900">{pagination.from}-{pagination.to}</strong> / {pagination.total}
                    </>
                  ) : (
                    "Chưa có dữ liệu"
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingComments && !comments.length ? (
                <div className="flex min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                </div>
              ) : paginatedComments.length ? (
                paginatedComments.map((comment) => (
                  <article
                    key={comment.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
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
                        className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Xem bài TikTok
                      </a>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-700">{comment.content}</p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
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
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  {searches.length
                    ? "Không có comment thỏa điều kiện hoặc worker chưa đồng bộ xong."
                    : "Nhập từ khóa và khoảng ngày để bắt đầu crawl dữ liệu TikTok."}
                </div>
              )}

              {pagination.total > 0 && (
                <div className="mt-8 flex flex-col items-center gap-4 py-4 md:flex-row md:justify-center">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setPage(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronsLeft className="h-5 w-5" />
                    </button>
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
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
                          key={currentPage}
                          onClick={() => setPage(currentPage)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${
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
                      disabled={pagination.page >= pagination.last_page}
                      onClick={() =>
                        setPage((current) => Math.min(pagination.last_page || 1, current + 1))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <button
                      disabled={pagination.page >= pagination.last_page}
                      onClick={() => setPage(pagination.last_page)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronsRight className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-500 md:ml-4">
                    <input
                      type="number"
                      min={1}
                      max={pagination.last_page}
                      value={page}
                      onChange={(event) => {
                        const value = parseInt(event.target.value, 10);
                        if (!Number.isNaN(value) && value >= 1 && value <= pagination.last_page) {
                          setPage(value);
                        }
                      }}
                      className="h-10 w-16 rounded border border-slate-300 text-center text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-[#1976D2]"
                    />
                    <span>of {pagination.total} items</span>
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
