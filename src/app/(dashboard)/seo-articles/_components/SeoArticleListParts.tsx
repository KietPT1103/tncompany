"use client";

import Link from "next/link";
import {
  Clipboard,
  ClipboardCheck,
  Eye,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";
import defaultImage from "@/optimized-media/cafe/cafe-hero.jpg";
import type { SeoArticle } from "@/services/seoArticleService";

export function ArticleStatus({ isPublished }: { isPublished: boolean }) {
  return (
    <span
      className={
        isPublished
          ? "inline-flex min-h-7 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          : "inline-flex min-h-7 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
      }
    >
      <span
        aria-hidden="true"
        className={
          isPublished
            ? "h-2 w-2 rounded-full bg-emerald-500"
            : "h-2 w-2 rounded-full bg-amber-500"
        }
      />
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

export function ArticleThumbnail({
  article,
  className,
}: {
  article: SeoArticle;
  className: string;
}) {
  return (
    <img
      src={article.coverImageUrl || defaultImage}
      alt=""
      loading="lazy"
      className={className}
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = defaultImage;
      }}
    />
  );
}

export function ArticleSlug({
  article,
  copied,
  onCopy,
}: {
  article: SeoArticle;
  copied: boolean;
  onCopy: (article: SeoArticle) => void;
}) {
  const articlePath = `/tin-tuc/${article.slug}`;

  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="min-w-0 break-words text-xs leading-5 text-slate-600">
        {articlePath}
      </span>
      <Tooltip content={copied ? "Đã sao chép" : "Sao chép đường dẫn"}>
        <button
          type="button"
          onClick={() => onCopy(article)}
          aria-label={copied ? "Đã sao chép đường dẫn" : "Sao chép đường dẫn"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none"
        >
          {copied ? (
            <ClipboardCheck className="h-4 w-4" />
          ) : (
            <Clipboard className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
    </div>
  );
}

export function ArticleActions({
  article,
  onDelete,
  compact = false,
}: {
  article: SeoArticle;
  onDelete: (article: SeoArticle) => void;
  compact?: boolean;
}) {
  const actionClassName = compact
    ? "inline-flex h-10 w-10 items-center justify-center rounded-md transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none"
    : "inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none sm:gap-1.5 sm:px-2 sm:text-xs";

  const viewAction = (
    <a
      href={`/tin-tuc/${article.slug}`}
      target="_blank"
      rel="noreferrer"
      aria-label={compact ? "Xem bài viết" : undefined}
      className={`${actionClassName} border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800`}
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className={compact ? "sr-only" : undefined}>Xem</span>
    </a>
  );

  const editAction = (
    <Link
      href={`/seo-articles/${article.id}`}
      aria-label={compact ? "Chỉnh sửa bài viết" : undefined}
      className={`${actionClassName} border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800`}
    >
      <Pencil className="h-4 w-4 shrink-0" />
      <span className={compact ? "sr-only" : undefined}>Chỉnh sửa</span>
    </Link>
  );

  const deleteAction = (
    <button
      type="button"
      onClick={() => onDelete(article)}
      aria-label={compact ? "Xóa bài viết" : undefined}
      className={`${actionClassName} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800`}
    >
      <Trash2 className="h-4 w-4 shrink-0" />
      <span className={compact ? "sr-only" : undefined}>Xóa</span>
    </button>
  );

  return (
    <div
      className={
        compact ? "grid grid-cols-3 gap-1.5" : "grid w-full grid-cols-3 gap-2"
      }
    >
      {compact ? (
        <Tooltip content="Xem bài viết">{viewAction}</Tooltip>
      ) : (
        viewAction
      )}
      {compact ? (
        <Tooltip content="Chỉnh sửa bài viết">{editAction}</Tooltip>
      ) : (
        editAction
      )}
      {compact ? (
        <Tooltip content="Xóa bài viết">{deleteAction}</Tooltip>
      ) : (
        deleteAction
      )}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex h-16 min-w-[190px] items-center gap-3 rounded bg-white px-4 shadow-[0_1px_4px_rgba(15,23,42,0.07)] ring-1 ring-slate-200">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F6C85F] text-[#063B2E]">
        <Icon className="h-4 w-4" />
      </span>

      <div>
        <p className="text-sm text-slate-600">{label}</p>
        <p className="text-xl font-semibold leading-none text-[#B8860B]">
          {value}
        </p>
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div aria-label="Đang tải bài viết" role="status">
      <div className="hidden overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 xl:block">
        <div className="h-14 border-b border-slate-200 bg-slate-50" />
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_0.8fr_0.7fr_0.8fr_1.2fr] gap-5 border-b border-slate-100 px-5 py-5 last:border-0"
          >
            {Array.from({ length: 6 }, (_, cellIndex) => (
              <div
                key={cellIndex}
                className="h-12 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none"
              />
            ))}
          </div>
        ))}
      </div>

      <div className="space-y-4 xl:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-lg bg-white p-4 shadow-[0_2px_6px_rgba(15,23,42,0.08)] ring-1 ring-slate-200"
          >
            <div className="flex gap-3">
              <div className="h-28 w-24 shrink-0 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none" />
              <div className="flex-1 space-y-3">
                <div className="h-5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
                <div className="h-4 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
