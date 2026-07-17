"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  // ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSearch2,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import {
  deleteSeoArticle,
  getSeoArticles,
  type SeoArticle,
  type SeoArticleTargetStore,
} from "@/services/seoArticleService";
import {
  ArticleActions,
  ArticleSlug,
  ArticleStatus,
  ArticleThumbnail,
  ListSkeleton,
  MetricCard,
} from "./_components/SeoArticleListParts";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";

const ARTICLES_PER_PAGE = 5;

type StatusFilter = "all" | "published" | "draft";
type StoreFilter = "all" | SeoArticleTargetStore;

const statusFilterOptions: readonly SelectBoxOption<StatusFilter>[] = [
  {
    value: "all",
    label: "Tất cả trạng thái",
  },
  {
    value: "published",
    label: "Published",
  },
  {
    value: "draft",
    label: "Draft",
  },
];

const targetStoreLabels: Record<SeoArticleTargetStore, string> = {
  company: "Toàn hệ sinh thái",
  cafe: "Tiệm cà phê Ông Quan",
  hotpot: "Tiệm lẩu Ông Quan",
  farm: "Ông Quan Farm",
};

const storeFilterOptions: readonly SelectBoxOption<StoreFilter>[] = [
  {
    value: "all",
    label: "Tất cả nhóm SEO",
  },
  {
    value: "company",
    label: targetStoreLabels.company,
  },
  {
    value: "cafe",
    label: targetStoreLabels.cafe,
  },
  {
    value: "hotpot",
    label: targetStoreLabels.hotpot,
  },
  {
    value: "farm",
    label: targetStoreLabels.farm,
  },
];

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function formatPublishDate(value?: string | null) {
  if (!value) {
    return {
      time: "Chưa lên lịch",
      date: "",
    };
  }

  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return {
      time: value,
      date: "",
    };
  }

  return {
    time: parsed.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    date: parsed.toLocaleDateString("vi-VN"),
  };
}

function getArticleSummary(article: SeoArticle) {
  return (
    article.excerpt || article.metaDescription || "Bài viết chưa có mô tả ngắn."
  );
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | string> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("start-ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push("end-ellipsis");

  pages.push(totalPages);
  return pages;
}

export default function SeoArticlesPage() {
  const [articles, setArticles] = useState<SeoArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [articleToDelete, setArticleToDelete] = useState<SeoArticle | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [copiedArticleId, setCopiedArticleId] = useState<string | null>(null);

  async function loadArticles() {
    setLoading(true);
    setErrorMessage("");

    try {
      const items = await getSeoArticles("", "all");
      setArticles(items);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Không thể tải danh sách bài viết. Vui lòng thử làm mới dữ liệu.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles();
  }, []);

  const publishedCount = useMemo(
    () => articles.filter((article) => article.isPublished).length,
    [articles],
  );

  const filteredArticles = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(search);

    return articles.filter((article) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && article.isPublished) ||
        (statusFilter === "draft" && !article.isPublished);
      const matchesStore =
        storeFilter === "all" || article.targetStore === storeFilter;
      const searchableContent = normalizeSearchValue(
        [
          article.title,
          article.slug,
          article.excerpt,
          article.metaDescription,
          targetStoreLabels[article.targetStore],
        ].join(" "),
      );
      const matchesSearch =
        !normalizedSearch || searchableContent.includes(normalizedSearch);

      return matchesStatus && matchesStore && matchesSearch;
    });
  }, [articles, search, statusFilter, storeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredArticles.length / ARTICLES_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedArticles = filteredArticles.slice(
    (safeCurrentPage - 1) * ARTICLES_PER_PAGE,
    safeCurrentPage * ARTICLES_PER_PAGE,
  );
  const rangeStart =
    filteredArticles.length === 0
      ? 0
      : (safeCurrentPage - 1) * ARTICLES_PER_PAGE + 1;
  const rangeEnd = Math.min(
    safeCurrentPage * ARTICLES_PER_PAGE,
    filteredArticles.length,
  );
  const visiblePages = getVisiblePages(safeCurrentPage, totalPages);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handleStatusChange(value: StatusFilter) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  function handleStoreChange(value: StoreFilter) {
    setStoreFilter(value);
    setCurrentPage(1);
  }

  async function handleCopySlug(article: SeoArticle) {
    try {
      await navigator.clipboard.writeText(`/tin-tuc/${article.slug}`);
      setCopiedArticleId(article.id);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleConfirmDelete() {
    if (!articleToDelete) return;

    setDeleting(true);
    setErrorMessage("");

    try {
      await deleteSeoArticle(articleToDelete.id);
      setArticleToDelete(null);
      await loadArticles();
    } catch (error) {
      console.error(error);
      setErrorMessage("Không thể xóa bài viết. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <header
        aria-label="Thanh công cụ bài viết SEO"
        className="fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-center border-b border-[#F6C85F]/20 bg-[linear-gradient(135deg,#064E3B,#033C2F)] px-16 shadow-[0_2px_6px_rgba(0,35,25,0.2)] lg:hidden"
      >
        <div className="flex h-10 w-[140px] items-center overflow-hidden">
          <img
            src="/assets/tn_services.png"
            alt="TN Services"
            className="h-auto w-full max-w-none"
            draggable={false}
          />
        </div>

        <Link
          href="/seo-articles/new"
          aria-label="Tạo bài viết mới"
          className="absolute top-3 right-4 inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-700 text-white shadow-[0_2px_6px_rgba(0,25,18,0.22)] transition-[background-color,transform] duration-150 ease-out hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E3B] active:scale-[0.96] motion-reduce:transition-none"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1600px] space-y-5 p-4 pt-20 sm:p-6 sm:pt-20 lg:p-6 lg:pt-6 xl:p-8">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              {/* <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 sm:h-14 sm:w-14">
                <FileSearch2 className="h-6 w-6" />
              </span> */}
              <div className="min-w-0">
                <h1 className="font-smooch text-balance text-xl font-semibold text-[#D4A017] sm:text-5xl">
                  Danh Sách Bài Viết SEO
                </h1>
                <p className="mt-1 max-w-2xl text-pretty text-sm leading-6 text-slate-600">
                  Quản lý danh sách, điều chỉnh nội dung bài viết
                </p>
              </div>
            </div>

            <Link
              href="/seo-articles/new"
              aria-label="Tạo bài viết mới"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white shadow-[0_2px_6px_rgba(4,120,87,0.22)] transition-[background-color,transform] duration-150 ease-out hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:scale-[0.96] motion-reduce:transition-none lg:inline-flex xl:hidden"
            >
              <Plus className="h-5 w-5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2.5 xl:flex xl:items-center">
            <MetricCard
              icon={FileText}
              label="Tổng bài viết"
              value={articles.length}
            />
            <MetricCard
              icon={CheckCircle2}
              label="Đã publish"
              value={publishedCount}
            />
            <Link
              href="/seo-articles/new"
              className="hidden h-10 items-center justify-center rounded-[2px] border-2 border-slate-950 bg-[#F7C948] px-5 text-sm font-bold text-slate-950 shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#FFD45F] hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#0f172a] xl:inline-flex"
            >
              Tạo bài viết mới
            </Link>
          </div>
        </header>

        <section
          aria-label="Bộ lọc bài viết"
          className="rounded-lg bg-white p-4 shadow-[0_2px_6px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80 sm:p-5"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.35fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto] lg:items-end">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Tìm kiếm
              </span>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />

                <Input
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  aria-label="Tìm kiếm bài viết"
                  className="h-10 rounded-[3px] border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 transition-[border-color,box-shadow] placeholder:text-slate-400 focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-800"
                  placeholder="Tìm theo tiêu đề, slug hoặc mô tả..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:contents">
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Trạng thái
                </span>

                <SelectBox
                  value={statusFilter}
                  options={statusFilterOptions}
                  onValueChange={handleStatusChange}
                  ariaLabel="Lọc bài viết theo trạng thái"
                  className="w-full"
                  triggerClassName="h-10 rounded-[3px] border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[background-color,border-color,box-shadow,color] hover:border-emerald-600 hover:bg-emerald-50/40 focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/20"
                />
              </div>

              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Nhóm SEO
                </span>

                <SelectBox
                  value={storeFilter}
                  options={storeFilterOptions}
                  onValueChange={handleStoreChange}
                  ariaLabel="Lọc bài viết theo nhóm SEO"
                  className="w-full"
                  triggerClassName="h-10 rounded-[3px] border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[background-color,border-color,box-shadow,color] hover:border-emerald-600 hover:bg-emerald-50/40 focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700/20"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadArticles()}
              disabled={loading}
              className="group h-10 gap-1.5 rounded-[3px] item-center border border-emerald-600 bg-white px-3 text-sm font-semibold text-emerald-800 shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out hover:border-emerald-800 hover:bg-emerald-800 hover:text-white hover:shadow-[0_4px_10px_rgba(4,120,87,0.24)] active:scale-[0.97] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 shrink-0 transition-transform duration-500 ${
                  loading
                    ? "animate-spin motion-reduce:animate-none"
                    : "group-hover:rotate-180"
                }`}
              />
              Làm mới
            </Button>
          </div>
        </section>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200"
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="leading-6">{errorMessage}</span>
          </div>
        ) : null}

        {loading ? (
          <ListSkeleton />
        ) : filteredArticles.length === 0 ? (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-lg bg-white px-6 py-10 text-center ring-1 ring-slate-200">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <FileSearch2 className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              Không tìm thấy bài viết
            </h2>
            <p className="mt-1 max-w-md text-pretty text-sm leading-6 text-slate-600">
              Thử thay đổi từ khóa hoặc điều kiện lọc để xem thêm kết quả.
            </p>
          </section>
        ) : (
          <>
            <section className="hidden overflow-hidden rounded-lg bg-white shadow-[0_2px_6px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80 xl:block">
              <table className="w-full table-fixed text-sm">
                <caption className="sr-only">Danh sách bài viết SEO</caption>
                <colgroup>
                  <col className="w-[35%]" />
                  <col className="w-[17%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-4">Bài viết</th>
                    <th className="px-4 py-4">Slug</th>
                    <th className="px-4 py-4">Nhóm SEO</th>
                    <th className="px-4 py-4">Trạng thái</th>
                    <th className="px-4 py-4">Ngày tạo</th>
                    <th className="px-5 py-4 text-center">Tác vụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedArticles.map((article) => {
                    const publishDate = formatPublishDate(article.publishedAt);

                    return (
                      <tr
                        key={article.id}
                        className="align-middle transition-colors duration-150 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <ArticleThumbnail
                              article={article}
                              className="h-32 w-28 shrink-0 rounded-md object-cover outline outline-1 -outline-offset-1 outline-black/10"
                            />
                            <div className="min-w-0">
                              <h2 className="line-clamp-3 text-sm font-semibold leading-5 text-slate-950">
                                {article.title}
                              </h2>
                              <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-slate-600">
                                {getArticleSummary(article)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <ArticleSlug
                            article={article}
                            copied={copiedArticleId === article.id}
                            onCopy={handleCopySlug}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm leading-5 text-slate-700">
                            {targetStoreLabels[article.targetStore] ||
                              targetStoreLabels.company}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <ArticleStatus isPublished={article.isPublished} />
                        </td>
                        <td className="px-4 py-4 text-sm leading-5 text-slate-700 tabular-nums">
                          <span className="block">{publishDate.time}</span>
                          {publishDate.date ? (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {publishDate.date}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-4">
                          <ArticleActions
                            article={article}
                            onDelete={setArticleToDelete}
                            compact
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section
              aria-label="Danh sách bài viết SEO"
              className="space-y-4 xl:hidden"
            >
              {paginatedArticles.map((article) => {
                const publishDate = formatPublishDate(article.publishedAt);

                return (
                  <article
                    key={article.id}
                    className="rounded-lg bg-white p-4 shadow-[0_2px_6px_rgba(15,23,42,0.08)] ring-1 ring-slate-200"
                  >
                    <div className="grid grid-cols-[116px_minmax(0,1fr)] items-stretch gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
                      <ArticleThumbnail
                        article={article}
                        className="h-full min-h-[132px] w-full rounded-md object-cover outline outline-1 -outline-offset-1 outline-black/10 sm:min-h-[176px]"
                      />
                      <div className="min-w-0">
                        <h2 className="line-clamp-3 text-sm font-semibold leading-5 text-slate-950 sm:text-base sm:leading-6">
                          {article.title}
                        </h2>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
                          {getArticleSummary(article)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <ArticleSlug
                        article={article}
                        copied={copiedArticleId === article.id}
                        onCopy={handleCopySlug}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-slate-700 sm:text-sm">
                        <FolderOpen className="h-4 w-4 shrink-0 text-slate-500" />
                        <span className="truncate">
                          {targetStoreLabels[article.targetStore] ||
                            targetStoreLabels.company}
                        </span>
                      </span>
                      <ArticleStatus isPublished={article.isPublished} />
                      <span className="ml-auto text-right text-xs leading-5 text-slate-600 tabular-nums">
                        <span className="block">{publishDate.time}</span>
                        {publishDate.date ? (
                          <span className="block">{publishDate.date}</span>
                        ) : null}
                      </span>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <ArticleActions
                        article={article}
                        onDelete={setArticleToDelete}
                      />
                    </div>
                  </article>
                );
              })}
            </section>

            <nav
              aria-label="Phân trang bài viết SEO"
              className="flex min-h-16 flex-col items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-[0_2px_6px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 sm:flex-row"
            >
              <p
                aria-live="polite"
                className="text-sm text-slate-600 tabular-nums"
              >
                Hiển thị {rangeStart}–{rangeEnd} / {filteredArticles.length} kết
                quả
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage(safeCurrentPage - 1)}
                  aria-label="Trang trước"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {visiblePages.map((page) =>
                  typeof page === "number" ? (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      aria-current={
                        page === safeCurrentPage ? "page" : undefined
                      }
                      aria-label={`Trang ${page}`}
                      className={
                        page === safeCurrentPage
                          ? "inline-flex h-11 min-w-11 items-center justify-center rounded-md bg-emerald-700 px-2 text-sm font-semibold text-white shadow-[0_2px_6px_rgba(4,120,87,0.2)] tabular-nums"
                          : "inline-flex h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none"
                      }
                    >
                      {page}
                    </button>
                  ) : (
                    <span
                      key={page}
                      aria-hidden="true"
                      className="inline-flex h-11 min-w-7 items-center justify-center text-sm text-slate-500"
                    >
                      …
                    </span>
                  ),
                )}

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage(safeCurrentPage + 1)}
                  aria-label="Trang sau"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </nav>
          </>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(articleToDelete)}
        title="Xóa bài viết SEO?"
        description={
          <>
            Bài viết{" "}
            <strong className="font-semibold text-slate-900">
              {articleToDelete?.title}
            </strong>{" "}
            sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.
          </>
        }
        confirmLabel="Xóa bài viết"
        cancelLabel="Hủy"
        variant="destructive"
        icon={Trash2}
        isLoading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleting) setArticleToDelete(null);
        }}
      />
    </RoleGuard>
  );
}
