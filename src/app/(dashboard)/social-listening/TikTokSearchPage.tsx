"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, Loader2, MessageSquareText, RefreshCcw, Search } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  createTikTokSearch,
  getTikTokComments,
  getTikTokSearchStatus,
  TikTokCommentPagination,
  TikTokCommentRecord,
  TikTokSearchRecord,
} from "@/services/socialListeningService";

const DEFAULT_PER_PAGE = 10;
const EMPTY_PAGINATION: TikTokCommentPagination = {
  page: 1,
  per_page: DEFAULT_PER_PAGE,
  total: 0,
  from: 0,
  to: 0,
  last_page: 1,
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

export default function TikTokSearchPage() {
  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [keyword, setKeyword] = useState("");
  const [commentQuery, setCommentQuery] = useState("");
  const [appliedCommentQuery, setAppliedCommentQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [search, setSearch] = useState<TikTokSearchRecord | null>(null);
  const [comments, setComments] = useState<TikTokCommentRecord[]>([]);
  const [pagination, setPagination] = useState<TikTokCommentPagination>(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState("");

  async function syncSearch(searchId: string, nextPage = page, silent = false, query = appliedCommentQuery) {
    if (!silent) {
      setIsLoadingComments(true);
    } else {
      setIsPolling(true);
    }

    try {
      const [statusResponse, commentResponse] = await Promise.all([
        getTikTokSearchStatus(searchId),
        getTikTokComments({
          search_id: searchId,
          page: nextPage,
          per_page: DEFAULT_PER_PAGE,
          query,
        }),
      ]);

      setSearch(statusResponse.search);
      setComments(commentResponse.items || []);
      setPagination(commentResponse.pagination || EMPTY_PAGINATION);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu TikTok.");
    } finally {
      setIsLoadingComments(false);
      setIsPolling(false);
    }
  }

  async function handleSubmit() {
    setError("");
    setIsSubmitting(true);
    setPage(1);
    setCommentQuery("");
    setAppliedCommentQuery("");
    setComments([]);
    setPagination(EMPTY_PAGINATION);

    try {
      const response = await createTikTokSearch({
        keyword,
        date_from: dateFrom,
        date_to: dateTo,
      });

      setSearch(response.search);
      await syncSearch(response.search.id, 1);
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Không tạo được search TikTok.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCommentSearch() {
    if (!search?.id) return;
    setPage(1);
    setAppliedCommentQuery(commentQuery);
    await syncSearch(search.id, 1, false, commentQuery);
  }

  useEffect(() => {
    if (!search?.id) return;
    void syncSearch(search.id, page);
  }, [page]);

  useEffect(() => {
    if (!search?.id || search.is_terminal) return;

    const timer = window.setInterval(() => {
      void syncSearch(search.id, page, true);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [page, search?.id, search?.is_terminal]);

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

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    label="Từ khóa"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="ông quan, lẩu ông quan..."
                    className="h-11 rounded-2xl border-white/10 bg-white/10 text-white placeholder:text-slate-300"
                  />
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
                    disabled={!search?.id}
                    onClick={() => search?.id && void syncSearch(search.id, page)}
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

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-[28px] border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900">Trạng thái job</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(search?.status)}`}>
                    {getStatusLabel(search?.status)}
                  </span>
                  {isPolling ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                </div>
                <div className="text-sm text-slate-600">{search?.progress_message || "Chưa có search nào."}</div>
                <div className="text-xs text-slate-500">Provider: {search?.provider || "disabled"}</div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900">Kết quả thu thập</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Videos</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{search?.total_videos ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Comments</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{search?.total_comments ?? 0}</div>
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
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{search?.active_jobs ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Đã xử lý</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{search?.processed_jobs ?? 0}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-[28px] border-slate-200">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Danh sách comment thật</CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  Hiển thị comment đã crawl được cho search hiện tại. Không có mock data.
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
                    placeholder="Loc theo noi dung, user, video_id..."
                    className="h-11 min-w-[280px] rounded-2xl"
                  />
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl"
                    disabled={!search?.id}
                    onClick={() => void handleCommentSearch()}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Tim comment
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
              ) : comments.length ? (
                comments.map((comment) => (
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
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                  {search?.id
                    ? "Không có comment thỏa điều kiện hoặc worker chưa đồng bộ xong."
                    : "Nhập từ khóa và khoảng ngày để bắt đầu crawl dữ liệu TikTok."}
                </div>
              )}

              {pagination.total > 0 && (
                <div className="mt-8 flex flex-col items-center gap-4 py-4 md:flex-row md:justify-center">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={!search?.id || pagination.page <= 1}
                      onClick={() => setPage(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronsLeft className="h-5 w-5" />
                    </button>
                    <button
                      disabled={!search?.id || pagination.page <= 1}
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
                      const p = start + i;
                      if (p > pagination.last_page) return null;
                      
                      const isCurrent = p === pagination.page;
                      
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${
                            isCurrent
                              ? "bg-[#1976D2] font-medium text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    <button
                      disabled={!search?.id || pagination.page >= pagination.last_page}
                      onClick={() =>
                        setPage((current) => Math.min(pagination.last_page || 1, current + 1))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <button
                      disabled={!search?.id || pagination.page >= pagination.last_page}
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
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= pagination.last_page) {
                          setPage(val);
                        } else if (e.target.value === "") {
                          // Allow clearing input briefly before typing
                        }
                      }}
                      onBlur={() => {
                        // Keep current page in sync if input is left empty or invalid
                        const input = document.querySelector('input[type="number"]') as HTMLInputElement;
                        if (input) input.value = String(page);
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
