"use client";

import Link from "next/link";
import {
  Clipboard,
  ClipboardCheck,
  Eye,
  Loader2,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";
import defaultImage from "@/optimized-media/cafe/cafe-hero.jpg";
import type { SeoArticle } from "@/services/seoArticleService";
import { cn } from "@/lib/utils";
import { resolveSeoArticleImageUrl } from "@/components/seo/seoArticleAssets";

export function ArticlePublishSwitch({
  isPublished,
  disabled = false,
  onToggle,
}: {
  isPublished: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPublished}
      aria-label={isPublished ? "Chuyển bài viết về Draft" : "Publish bài viết"}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "group inline-flex h-9 min-w-[112px] items-center gap-2 rounded-md border px-2 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none",
        isPublished
          ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
          : "border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
          isPublished ? "bg-white/30" : "bg-slate-200",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out motion-reduce:transition-none",
            isPublished ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>

      {disabled ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
      ) : (
        <span>{isPublished ? "Published" : "Draft"}</span>
      )}
    </button>
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
      src={resolveSeoArticleImageUrl(article.coverImageUrl) || defaultImage}
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
    ? "inline-flex h-10 w-10 items-center justify-center rounded transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none"
    : "inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none sm:gap-1.5 sm:px-2 sm:text-xs";

  const viewAction = (
    <a
      href={`/tin-tuc/${article.slug}`}
      target="_blank"
      rel="noreferrer"
      aria-label={compact ? "Xem bài viết" : undefined}
      className={`${actionClassName} border border-emerald-600 bg-white text-emerald-700 hover:border-emerald-600 hover:bg-emerald-700 hover:text-[#F6C85F]`}
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className={compact ? "sr-only" : undefined}>Xem</span>
    </a>
  );

  const editAction = (
    <Link
      href={`/seo-articles/${article.id}`}
      aria-label={compact ? "Chỉnh sửa bài viết" : undefined}
      className={`${actionClassName} border border-emerald-600 bg-white text-emerald-700 hover:border-emerald-200 hover:bg-emerald-700 hover:text-[#F6C85F]`}
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
      className={`${actionClassName} border border-rose-500 bg-white text-rose-700 hover:bg-rose-700 hover:text-white`}
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
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-firasans flex h-16 min-w-[190px] items-center gap-3 rounded bg-white px-4",
        "shadow-[6px_8px_14px_rgba(15,23,42,0.14)]",
        "transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[8px_10px_18px_rgba(15,23,42,0.18)]",
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F6C85F] text-[#063B2E]">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-600">{label}</p>

        <p className="mt-0.5 text-xl font-semibold leading-none text-[#B8860B]">
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
