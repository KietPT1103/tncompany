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
  getTikTokVideos,
  TikTokCommentRecord,
  TikTokSearchRecord,
  TikTokVideoRecord,
} from "@/services/socialListeningService";

const DEFAULT_PER_PAGE = 10;
const COMMENT_FETCH_BATCH_SIZE = 100;

type AggregatedTikTokComment = TikTokCommentRecord & {
  matchedKeywords: string[];
};

type AggregatedTikTokVideo = TikTokVideoRecord & {
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
      return "Dang lay video";
    case "fetching_comments":
      return "Dang lay comment";
    case "completed":
      return "Hoan tat";
    case "failed":
      return "That bai";
    case "partial_failed":
      return "Co loi mot phan";
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

function buildAggregatedVideos(items: TikTokVideoRecord[], searchMap: Map<string, TikTokSearchRecord>) {
  const videoMap = new Map<string, AggregatedTikTokVideo>();

  items.forEach((video) => {
    const key = video.video_id;
    const keyword = normalizeKeyword(searchMap.get(video.search_id)?.keyword || "");
    const existing = videoMap.get(key);

    if (existing) {
      const nextKeywords = new Set(existing.matchedKeywords);
      if (keyword) {
        nextKeywords.add(keyword);
      }

      videoMap.set(key, {
        ...existing,
        matchedKeywords: Array.from(nextKeywords),
      });
      return;
    }

    videoMap.set(key, {
      ...video,
      matchedKeywords: keyword ? [keyword] : [],
    });
  });

  return Array.from(videoMap.values()).sort((left, right) => {
    const leftTime = left.published_at ? new Date(left.published_at).getTime() : 0;
    const rightTime = right.published_at ? new Date(right.published_at).getTime() : 0;
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

async function fetchAllVideosForSearch(searchId: string, query: string) {
  const firstPage = await getTikTokVideos({
    search_id: searchId,
    page: 1,
    per_page: COMMENT_FETCH_BATCH_SIZE,
    query,
  });

  const items = [...(firstPage.items || [])];
  const lastPage = Math.max(1, firstPage.pagination?.last_page || 1);

  for (let nextPage = 2; nextPage <= lastPage; nextPage += 1) {
    const response = await getTikTokVideos({
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
  const [videoQuery, setVideoQuery] = useState("");
  const [appliedVideoQuery, setAppliedVideoQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [searches, setSearches] = useState<TikTokSearchRecord[]>([]);
  const [videos, setVideos] = useState<AggregatedTikTokVideo[]>([]);
  const [comments, setComments] = useState<AggregatedTikTokComment[]>([]);
  const [videoPage, setVideoPage] = useState(1);
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
      return "Chua co search nao.";
    }

    const activeSearch = searches.find((search) => !search.is_terminal) || searches[0];
    return activeSearch?.progress_message || `Dang theo doi ${searches.length} tu khoa.`;
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
  const totalUniqueVideos = videos.length;
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

  const videoPagination = useMemo(() => {
    const total = videos.length;
    const lastPage = Math.max(1, Math.ceil(total / DEFAULT_PER_PAGE));
    const safePage = Math.min(videoPage, lastPage);
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
  }, [videoPage, videos.length]);

  const paginatedVideos = useMemo(() => {
    const startIndex = (videoPagination.page - 1) * DEFAULT_PER_PAGE;
    return videos.slice(startIndex, startIndex + DEFAULT_PER_PAGE);
  }, [videoPagination.page, videos]);

  useEffect(() => {
    if (page !== pagination.page) {
      setPage(pagination.page);
    }
  }, [page, pagination.page]);

  useEffect(() => {
    if (videoPage !== videoPagination.page) {
      setVideoPage(videoPagination.page);
    }
  }, [videoPage, videoPagination.page]);

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
    targetSearches: TikTokSearchRecord[] = searches,
    videoFilter = appliedVideoQuery
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
      const searchMap = new Map(nextSearches.map((search) => [search.id, search] as const));
      const [commentGroups, videoGroups] = await Promise.all([
        Promise.all(
          nextSearches.map((search) => fetchAllCommentsForSearch(search.id, commentFilter))
        ),
        Promise.all(
          nextSearches.map((search) => fetchAllVideosForSearch(search.id, videoFilter))
        ),
      ]);

      setSearches(nextSearches);
      setComments(buildAggregatedComments(commentGroups.flat()));
      setVideos(buildAggregatedVideos(videoGroups.flat(), searchMap));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Khong tai duoc du lieu TikTok.");
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
      setError("Vui long nhap it nhat mot tu khoa.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    setPage(1);
    setVideoPage(1);
    setCommentQuery("");
    setAppliedCommentQuery("");
    setVideoQuery("");
    setAppliedVideoQuery("");
    setVideos([]);
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
          ? [response.reason instanceof Error ? response.reason.message : "Khong tao duoc search TikTok."]
          : []
      );

      if (!succeededSearches.length) {
        throw new Error(failedMessages[0] || "Khong tao duoc search TikTok.");
      }

      setSearches(succeededSearches);
      await syncSearches("", false, succeededSearches, "");

      if (failedMessages.length) {
        setError(`Co ${failedMessages.length} tu khoa tao job that bai. ${failedMessages[0]}`);
      }
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Khong tao duoc search TikTok.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCommentSearch() {
    if (!searches.length) return;
    setPage(1);
    setAppliedCommentQuery(commentQuery);
    await syncSearches(commentQuery, false, searches, appliedVideoQuery);
  }

  async function handleVideoSearch() {
    if (!searches.length) return;
    setVideoPage(1);
    setAppliedVideoQuery(videoQuery);
    await syncSearches(appliedCommentQuery, false, searches, videoQuery);
  }

  useEffect(() => {
    if (!searches.length) return;
    if (searches.every((search) => search.is_terminal)) return;

    const timer = window.setInterval(() => {
      void syncSearches(appliedCommentQuery, true, searches, appliedVideoQuery);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [appliedCommentQuery, appliedVideoQuery, searches]);

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
                  Tim comment TikTok that theo keyword va khoang ngay
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                  Module nay chi doc du lieu that tu TikTok thong qua provider duoc cau hinh. Neu
                  khong lay duoc du lieu, he thong tra ve rong va khong sinh comment gia.
                </p>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur lg:min-w-[560px]">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <Input
                      label="Tu khoa"
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
                      placeholder="Nhap tu khoa roi nhan Enter de them"
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
                    label="Tu ngay"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-11 rounded-2xl border-white/10 bg-white/10 text-white"
                  />
                  <Input
                    label="Den ngay"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-11 rounded-2xl border-white/10 bg-white/10 text-white"
                  />
                  <div className="flex items-end">
                    <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      Dang theo doi <strong className="text-white">{keywords.length || 0}</strong> tu khoa
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
                    Thu thap du lieu
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    disabled={!searches.length}
                    onClick={() => void syncSearches(appliedCommentQuery, false)}
                    isLoading={isLoadingComments && !isSubmitting}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Tai lai
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
                <CardTitle className="text-lg text-slate-900">Trang thai job</CardTitle>
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
                <CardTitle className="text-lg text-slate-900">Tu khoa</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Da nhap</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{keywords.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Job tao thanh cong</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{searches.length}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-slate-900">Ket qua thu thap</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Videos da thu thap</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{totalVideos}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Video unique hien thi</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{totalUniqueVideos}</div>
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
                  <div className="text-slate-500">Job dang chay</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{activeJobs}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-slate-500">Da xu ly</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{processedJobs}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-[28px] border-slate-200">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Danh sach video</CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  Day la tap video TikTok tim duoc tu cac keyword truoc khi he thong di lay comment.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                  <Input
                    value={videoQuery}
                    onChange={(event) => setVideoQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleVideoSearch();
                      }
                    }}
                    placeholder="Loc theo mo ta, username, video_id..."
                    className="h-11 min-w-[280px] rounded-2xl"
                  />
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl"
                    disabled={!searches.length}
                    onClick={() => void handleVideoSearch()}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Tim video
                  </Button>
                </div>

                <div className="inline-flex items-center gap-2 rounded-[20px] bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                  {videoPagination.total > 0 ? (
                    <>
                      <span className="flex h-2 w-2 rounded-full bg-sky-500"></span>
                      Dang xem <strong className="text-slate-900">{videoPagination.from}-{videoPagination.to}</strong> / {videoPagination.total}
                    </>
                  ) : (
                    "Chua co video"
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingComments && !videos.length ? (
                <div className="flex min-h-[180px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                </div>
              ) : paginatedVideos.length ? (
                paginatedVideos.map((video) => (
                  <article
                    key={video.video_id}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          @{video.video_username || "unknown"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDisplayDate(video.published_at)}
                        </div>
                      </div>

                      <a
                        href={video.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-2xl bg-sky-700 px-4 text-sm font-medium text-white transition hover:bg-sky-800"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Xem video TikTok
                      </a>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-700">
                      {video.description || "Khong co mo ta video."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1">video_id: {video.video_id}</span>
                      {video.matchedKeywords.map((keyword) => (
                        <span
                          key={`${video.video_id}-${keyword}`}
                          className="rounded-full bg-sky-50 px-3 py-1 text-sky-700"
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
                    ? "Khong co video thoa dieu kien hoac worker chua dong bo xong."
                    : "Nhap tu khoa va khoang ngay de bat dau crawl du lieu TikTok."}
                </div>
              )}

              {videoPagination.total > 0 && (
                <div className="mt-8 flex flex-col items-center gap-4 py-4 md:flex-row md:justify-center">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={videoPagination.page <= 1}
                      onClick={() => setVideoPage(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronsLeft className="h-5 w-5" />
                    </button>
                    <button
                      disabled={videoPagination.page <= 1}
                      onClick={() => setVideoPage((current) => Math.max(1, current - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {Array.from({ length: Math.min(5, videoPagination.last_page) }, (_, i) => {
                      let start = Math.max(1, videoPagination.page - 2);
                      let end = Math.min(videoPagination.last_page, start + 4);
                      if (end - start < 4) {
                        start = Math.max(1, end - 4);
                      }
                      const currentPage = start + i;
                      if (currentPage > videoPagination.last_page) return null;

                      const isCurrent = currentPage === videoPagination.page;

                      return (
                        <button
                          key={`video-page-${currentPage}`}
                          onClick={() => setVideoPage(currentPage)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${
                            isCurrent
                              ? "bg-sky-700 font-medium text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {currentPage}
                        </button>
                      );
                    })}

                    <button
                      disabled={videoPagination.page >= videoPagination.last_page}
                      onClick={() =>
                        setVideoPage((current) => Math.min(videoPagination.last_page || 1, current + 1))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <button
                      disabled={videoPagination.page >= videoPagination.last_page}
                      onClick={() => setVideoPage(videoPagination.last_page)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50"
                    >
                      <ChevronsRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Danh sach comment that</CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  He thong dang gop comment tu tat ca keyword da tao job. Khong co mock data.
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
                    disabled={!searches.length}
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
                      Dang xem <strong className="text-slate-900">{pagination.from}-{pagination.to}</strong> / {pagination.total}
                    </>
                  ) : (
                    "Chua co du lieu"
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
                        Xem bai TikTok
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
                    ? "Khong co comment thoa dieu kien hoac worker chua dong bo xong."
                    : "Nhap tu khoa va khoang ngay de bat dau crawl du lieu TikTok."}
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
