"use client";

import { useEffect, useId, useState } from "react";
import {
  ChevronDown,
  ImageOff,
  ImagePlus,
  Link2,
  Loader2,
  Trash2,
} from "lucide-react";
import { resolveSeoArticleImageUrl } from "@/components/seo/seoArticleAssets";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

type SeoArticleImageFieldProps = {
  label: string;
  value: string;
  alt: string;
  uploading: boolean;
  variant?: "cover" | "content";
  onUpload: (file: File) => void;
  onChange: (value: string) => void;
  onRemove: () => void;
};

export function SeoArticleImageField({
  label,
  value,
  alt,
  uploading,
  variant = "content",
  onUpload,
  onChange,
  onRemove,
}: SeoArticleImageFieldProps) {
  const urlInputId = useId();
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [value]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) {
      onUpload(file);
    }
    event.currentTarget.value = "";
  }

  const hasImage = Boolean(value.trim());
  const previewClassName =
    variant === "cover"
      ? "aspect-[1.62] object-cover"
      : "aspect-video object-contain";

  return (
    <div
      className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
      aria-busy={uploading}
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        {hasImage ? (
          <span className="text-xs font-medium text-emerald-700">
            Đã chọn ảnh
          </span>
        ) : null}
      </div>

      <div
        className={`relative w-full overflow-hidden bg-slate-100 ${
          variant === "cover" ? "aspect-[1.62]" : "aspect-video"
        }`}
      >
        {hasImage && !imageLoadFailed ? (
          <img
            src={resolveSeoArticleImageUrl(value)}
            alt={alt || label}
            className={`h-full w-full ${previewClassName}`}
            onError={() => setImageLoadFailed(true)}
          />
        ) : (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center ${
              hasImage ? "pb-16" : ""
            }`}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
              {imageLoadFailed ? (
                <ImageOff className="h-5 w-5" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {imageLoadFailed ? "Không tải được ảnh" : "Chưa có ảnh"}
              </p>
              {imageLoadFailed ? (
                <p className="mt-1 text-xs text-slate-500">
                  Chọn ảnh khác hoặc kiểm tra đường dẫn.
                </p>
              ) : null}
            </div>
            {!hasImage ? (
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-emerald-800 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-offset-2 active:scale-[0.96] motion-reduce:transition-none">
                <ImagePlus className="h-4 w-4" />
                Chọn ảnh
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  className="sr-only"
                  disabled={uploading}
                  onChange={handleFileChange}
                />
              </label>
            ) : null}
          </div>
        )}

        {hasImage ? (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-end gap-2 bg-slate-950/70 p-3 backdrop-blur-sm">
            <label
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-slate-800 transition-[background-color,transform] duration-150 hover:bg-slate-100 focus-within:outline-none focus-within:ring-2 focus-within:ring-white focus-within:ring-offset-2 focus-within:ring-offset-slate-900 active:scale-[0.96] motion-reduce:transition-none ${
                uploading
                  ? "pointer-events-none opacity-60"
                  : "cursor-pointer"
              }`}
            >
              <ImagePlus className="h-4 w-4" />
              Đổi ảnh
              <input
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                className="sr-only"
                disabled={uploading}
                onChange={handleFileChange}
              />
            </label>
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/30 bg-slate-950/40 px-3 text-sm font-semibold text-white transition-[background-color,border-color,transform] duration-150 hover:border-rose-300 hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              <Trash2 className="h-4 w-4" />
              Xóa ảnh
            </button>
          </div>
        ) : null}

        {uploading ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-slate-950/50 text-white backdrop-blur-[2px]"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-2 rounded-md bg-slate-950/75 px-4 py-2 text-sm font-semibold">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải ảnh...
            </span>
          </div>
        ) : null}
      </div>

      <details className="group border-t border-slate-200 bg-white">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 transition-[background-color,color] duration-150 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Dùng URL ảnh
          </span>
          <ChevronDown className="h-4 w-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="px-4 pb-4 pt-1">
          <label
            htmlFor={urlInputId}
            className="mb-1.5 block text-xs font-semibold text-slate-600"
          >
            URL ảnh
          </label>
          <input
            id={urlInputId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
            placeholder="Dán đường dẫn ảnh"
          />
        </div>
      </details>
    </div>
  );
}
