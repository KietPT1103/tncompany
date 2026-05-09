"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Eye,
  ImagePlus,
  LayoutPanelTop,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import RichTextEditor from "@/components/seo/RichTextEditor";
import SeoArticlePreview from "@/components/seo/SeoArticlePreview";
import {
  createEmptySeoArticleBlock,
  normalizeSeoArticleBlocks,
  renderSeoArticleBlocksToHtml,
  stripSeoArticleHtml,
} from "@/features/seoArticles/articleBlocks";
import {
  createSeoArticle,
  getSeoArticleById,
  SeoArticlePayload,
  SeoArticleTargetStore,
  uploadSeoArticleImage,
  updateSeoArticle,
} from "@/services/seoArticleService";

type EditorMode = "create" | "edit";

type EditorFormState = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string;
  metaTitle: string;
  metaDescription: string;
  targetStore: SeoArticleTargetStore;
  isPublished: boolean;
  publishedAt: string | null;
  blocks: ReturnType<typeof normalizeSeoArticleBlocks>;
};

const initialFormState: EditorFormState = {
  slug: "",
  title: "",
  excerpt: "",
  coverImageUrl: "",
  metaTitle: "",
  metaDescription: "",
  targetStore: "company",
  isPublished: false,
  publishedAt: null,
  blocks: [createEmptySeoArticleBlock()],
};

const targetStoreOptions: Array<{ value: SeoArticleTargetStore; label: string }> = [
  { value: "company", label: "Toàn hệ sinh thái" },
  { value: "cafe", label: "Tiệm cà phê Ông Quan" },
  { value: "hotpot", label: "Tiệm lẩu Ông Quan" },
  { value: "farm", label: "Ông Quan Farm" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return normalized.slice(0, 16);
}

function GhostIconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function SeoArticleEditorScreen({ mode }: { mode: EditorMode }) {
  const router = useRouter();
  const params = useParams();
  const articleId = typeof params.id === "string" ? params.id : "";
  const isEditMode = mode === "edit";

  const [form, setForm] = useState<EditorFormState>(initialFormState);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !articleId) return;

    let mounted = true;

    async function loadArticle() {
      setLoading(true);
      try {
        const article = await getSeoArticleById(articleId);
        if (!article || !mounted) return;

        setForm({
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt || "",
          coverImageUrl: article.coverImageUrl || "",
          metaTitle: article.metaTitle || "",
          metaDescription: article.metaDescription || "",
          targetStore: article.targetStore || "company",
          isPublished: article.isPublished,
          publishedAt: article.publishedAt ? toDateTimeLocal(article.publishedAt) : null,
          blocks: normalizeSeoArticleBlocks(article.contentJson, article.contentHtml),
        });
        setSlugTouched(true);
      } catch (error) {
        console.error(error);
        alert("Không thể tải bài viết.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadArticle();
    return () => {
      mounted = false;
    };
  }, [articleId, isEditMode]);

  const previewExcerpt = useMemo(() => {
    if (form.excerpt.trim()) return form.excerpt.trim();
    const combined = form.blocks.map((block) => stripSeoArticleHtml(block.html)).join(" ").trim();
    return combined.slice(0, 220);
  }, [form.blocks, form.excerpt]);

  function updateField<Key extends keyof EditorFormState>(
    field: Key,
    value: EditorFormState[Key]
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateBlock(
    blockId: string,
    updater: (
      block: EditorFormState["blocks"][number]
    ) => EditorFormState["blocks"][number]
  ) {
    setForm((previous) => ({
      ...previous,
      blocks: previous.blocks.map((block) => (block.id === blockId ? updater(block) : block)),
    }));
  }

  function addBlock() {
    setForm((previous) => ({
      ...previous,
      blocks: [...previous.blocks, createEmptySeoArticleBlock()],
    }));
  }

  function removeBlock(blockId: string) {
    setForm((previous) => {
      const nextBlocks = previous.blocks.filter((block) => block.id !== blockId);
      return {
        ...previous,
        blocks: nextBlocks.length ? nextBlocks : [createEmptySeoArticleBlock()],
      };
    });
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    setForm((previous) => {
      const index = previous.blocks.findIndex((block) => block.id === blockId);
      if (index < 0) return previous;

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= previous.blocks.length) {
        return previous;
      }

      const nextBlocks = [...previous.blocks];
      const [moved] = nextBlocks.splice(index, 1);
      nextBlocks.splice(targetIndex, 0, moved);

      return {
        ...previous,
        blocks: nextBlocks,
      };
    });
  }

  async function uploadCoverImage(file: File) {
    setUploadingCover(true);
    try {
      const url = await uploadSeoArticleImage(file);
      updateField("coverImageUrl", url);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Không thể upload ảnh cover.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function uploadBlockImage(blockId: string, file: File) {
    setUploadingBlockId(blockId);
    try {
      const url = await uploadSeoArticleImage(file);
      updateBlock(blockId, (block) => ({ ...block, imageUrl: url }));
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Không thể upload ảnh cho đoạn.");
    } finally {
      setUploadingBlockId(null);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert("Vui lòng nhập tiêu đề bài viết.");
      return;
    }

    const blocks = form.blocks.filter(
      (block) => block.heading.trim() || block.html.trim() || block.imageUrl.trim()
    );

    if (!blocks.length) {
      alert("Bài viết cần có ít nhất một đoạn nội dung.");
      return;
    }

    const payload: SeoArticlePayload = {
      slug: slugify(form.slug || form.title),
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      contentHtml: renderSeoArticleBlocksToHtml(blocks),
      contentJson: blocks,
      coverImageUrl: form.coverImageUrl.trim(),
      metaTitle: form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim(),
      targetStore: form.targetStore,
      isPublished: form.isPublished,
      publishedAt: form.publishedAt ? form.publishedAt.replace("T", " ") + ":00" : null,
    };

    setSaving(true);
    try {
      if (isEditMode && articleId) {
        await updateSeoArticle(articleId, payload);
      } else {
        await createSeoArticle(payload);
      }

      router.push("/seo-articles");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Không thể lưu bài viết.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-[#f4efe7] px-4 py-5 md:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-[#e8dfd3] bg-[#f4efe7]/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link
                  href="/seo-articles"
                  className="rounded-full border border-[#ddd3c5] bg-white p-2 text-slate-500 transition hover:text-slate-800"
                  title="Quay lại danh sách"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                    {isEditMode ? "Chỉnh sửa bài viết SEO" : "Tạo bài viết SEO mới"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Soạn theo kiểu tài liệu liền mạch, xem trước giống trang public.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  className="rounded-full border-[#d9cfbf] bg-white"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Xem trước
                </Button>
                <Button onClick={handleSave} disabled={saving || loading} className="rounded-full px-5">
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving ? "Đang lưu..." : "Lưu bài viết"}
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mx-auto max-w-4xl rounded-[32px] border border-[#e5dbcd] bg-white px-8 py-16 text-center text-slate-500 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
              Đang tải dữ liệu bài viết...
            </div>
          ) : (
            <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="mx-auto w-full max-w-4xl">
                <article className="overflow-hidden rounded-[36px] border border-[#e5dbcd] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
                  <div className="px-6 py-8 md:px-12 md:py-10">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="rounded-full bg-[#eff6ff] px-4 py-1.5 font-semibold text-[#1d4ed8]">
                        Bản nháp
                      </span>
                    </div>

                    <textarea
                      value={form.title}
                      onChange={(event) => {
                        const title = event.target.value;
                        updateField("title", title);
                        if (!slugTouched) {
                          updateField("slug", slugify(title));
                        }
                      }}
                      rows={2}
                      className="mt-6 w-full resize-none border-0 bg-transparent p-0 text-[clamp(2.4rem,5vw,4.5rem)] font-extrabold leading-[1.02] tracking-tight text-slate-950 outline-none placeholder:text-slate-300"
                      placeholder="Nhập tiêu đề bài viết"
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-[#f7f4ee] px-4 py-3 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">Slug</span>
                      <span className="font-mono text-xs text-slate-400">/tin-tuc/</span>
                      <input
                        value={form.slug}
                        onChange={(event) => {
                          setSlugTouched(true);
                          updateField("slug", slugify(event.target.value));
                        }}
                        className="min-w-[220px] flex-1 border-0 bg-transparent font-mono text-sm text-slate-700 outline-none placeholder:text-slate-300"
                        placeholder="ten-bai-viet"
                      />
                    </div>

                    <textarea
                      value={form.excerpt}
                      onChange={(event) => updateField("excerpt", event.target.value)}
                      rows={4}
                      className="mt-6 w-full resize-none border-0 bg-transparent p-0 text-xl leading-9 text-slate-600 outline-none placeholder:text-slate-300"
                      placeholder="Viết phần mô tả mở đầu ngắn để hiển thị trên Google và ở đầu bài viết."
                    />

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ddd3c5] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#faf7f2]">
                        <ImagePlus className="h-4 w-4" />
                        {uploadingCover ? "Đang upload ảnh cover..." : "Chọn ảnh cover"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void uploadCoverImage(file);
                            }
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>

                      <input
                        value={form.coverImageUrl}
                        onChange={(event) => updateField("coverImageUrl", event.target.value)}
                        className="min-w-[260px] flex-1 rounded-full border border-[#ddd3c5] bg-[#faf7f2] px-4 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        placeholder="Hoặc dán URL ảnh cover"
                      />
                    </div>

                    {form.coverImageUrl ? (
                      <img
                        src={form.coverImageUrl}
                        alt="Ảnh cover"
                        className="mt-8 w-full rounded-[30px] object-cover shadow-[0_24px_60px_rgba(15,23,42,0.08)]"
                      />
                    ) : null}
                  </div>

                  <div className="border-t border-[#efe7db] px-6 py-8 md:px-12 md:py-10">
                    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1d4ed8]">
                          Nội dung bài viết
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Viết theo từng mục. Mỗi mục có thể có tiêu đề, nội dung và ảnh minh họa riêng.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addBlock}
                        className="inline-flex items-center gap-2 rounded-full border border-[#d9cfbf] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#faf7f2]"
                      >
                        <Plus className="h-4 w-4" />
                        Thêm mục
                      </button>
                    </div>

                    <div className="space-y-2">
                      {form.blocks.map((block, index) => (
                        <section
                          key={block.id}
                          className="group border-t border-[#efe7db] py-10 first:border-t-0 first:pt-0"
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                            <div className="flex items-center gap-3">
                              <span className="rounded-full bg-[#f6f2eb] px-3 py-1 font-semibold text-slate-700">
                                Phần {index + 1}
                              </span>
                              <span>Kéo nội dung theo ý, ảnh nằm ngay dưới phần chữ.</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <GhostIconButton
                                onClick={() => moveBlock(block.id, -1)}
                                title="Đưa phần này lên"
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </GhostIconButton>
                              <GhostIconButton
                                onClick={() => moveBlock(block.id, 1)}
                                title="Đưa phần này xuống"
                                disabled={index === form.blocks.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </GhostIconButton>
                              <GhostIconButton
                                onClick={() => removeBlock(block.id)}
                                title="Xóa phần này"
                              >
                                <Trash2 className="h-4 w-4" />
                              </GhostIconButton>
                            </div>
                          </div>

                          <input
                            value={block.heading}
                            onChange={(event) =>
                              updateBlock(block.id, (current) => ({
                                ...current,
                                heading: event.target.value,
                              }))
                            }
                            className="w-full border-0 bg-transparent p-0 text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-[1.08] tracking-tight text-[#1428f0] outline-none placeholder:text-slate-300"
                            placeholder="Tiêu đề mục"
                          />

                          <div className="mt-5">
                            <RichTextEditor
                              value={block.html}
                              onChange={(value) =>
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  html: value,
                                }))
                              }
                              minimal
                              placeholder="Bắt đầu viết nội dung. Có thể bôi đậm, tạo danh sách, gắn link như trong Word."
                            />
                          </div>

                          <div className="mt-8 border-t border-[#f1eadf] pt-5">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#ddd3c5] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#faf7f2]">
                                <ImagePlus className="h-4 w-4" />
                                {uploadingBlockId === block.id ? "Đang upload ảnh..." : "Thêm ảnh minh họa"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                      void uploadBlockImage(block.id, file);
                                    }
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>

                              <input
                                value={block.imageUrl}
                                onChange={(event) =>
                                  updateBlock(block.id, (current) => ({
                                    ...current,
                                    imageUrl: event.target.value,
                                  }))
                                }
                                className="min-w-[260px] flex-1 rounded-full border border-[#ddd3c5] bg-[#faf7f2] px-4 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                                placeholder="Hoặc dán URL ảnh cho phần này"
                              />
                            </div>

                            <input
                              value={block.imageAlt}
                              onChange={(event) =>
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  imageAlt: event.target.value,
                                }))
                              }
                              className="mt-3 w-full rounded-full border border-[#ddd3c5] bg-[#faf7f2] px-4 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                              placeholder="Mô tả ảnh để hỗ trợ SEO và trợ năng"
                            />

                            {block.imageUrl ? (
                              <figure className="mt-6">
                                <img
                                  src={block.imageUrl}
                                  alt={block.imageAlt || block.heading || "Ảnh minh họa"}
                                  className="w-full rounded-[30px] object-cover shadow-[0_20px_50px_rgba(15,23,42,0.07)]"
                                />
                                {block.imageAlt ? (
                                  <figcaption className="mt-3 text-sm text-slate-500">
                                    {block.imageAlt}
                                  </figcaption>
                                ) : null}
                              </figure>
                            ) : null}
                          </div>
                        </section>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addBlock}
                      className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#d7ccbc] px-4 py-4 text-sm font-semibold text-slate-600 transition hover:border-[#c4b49d] hover:bg-[#faf7f2]"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm một mục nội dung mới
                    </button>
                  </div>
                </article>
              </div>

              <aside className="space-y-5 xl:sticky xl:top-24">
                <section className="rounded-[28px] border border-[#e5dbcd] bg-white/92 p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900">
                    <LayoutPanelTop className="h-5 w-5 text-[#1d4ed8]" />
                    <h2 className="text-lg font-semibold">Xuất bản</h2>
                  </div>

                  <label className="mt-5 flex items-start gap-3 rounded-[24px] bg-[#f7f4ee] px-4 py-4">
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      onChange={(event) => updateField("isPublished", event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">Publish ngay khi lưu</div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Bật nếu muốn bài xuất hiện ở trang public và sitemap ngay sau khi lưu.
                      </p>
                    </div>
                  </label>

                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Nhóm SEO
                      </label>
                      <select
                        value={form.targetStore}
                        onChange={(event) =>
                          updateField("targetStore", event.target.value as SeoArticleTargetStore)
                        }
                        className="h-11 w-full rounded-2xl border border-[#ddd3c5] bg-[#faf7f2] px-4 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
                      >
                        {targetStoreOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Input
                      type="datetime-local"
                      label="Lịch publish"
                      value={form.publishedAt || ""}
                      onChange={(event) =>
                        updateField("publishedAt", event.target.value ? event.target.value : null)
                      }
                      className="h-11 rounded-2xl border-[#ddd3c5] bg-[#faf7f2] focus-visible:ring-emerald-100"
                    />
                  </div>

                  <div className="mt-5 rounded-[24px] bg-[#f7f4ee] px-4 py-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2 font-medium text-slate-700">
                      <CalendarClock className="h-4 w-4" />
                      Trạng thái hiện tại
                    </div>
                    <p className="mt-2 leading-6">
                      {form.isPublished
                        ? "Bài sẽ được hiển thị công khai sau khi lưu."
                        : "Bài đang ở dạng nháp, chưa xuất hiện ở trang public."}
                    </p>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#e5dbcd] bg-white/92 p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Settings2 className="h-5 w-5 text-[#1d4ed8]" />
                    <h2 className="text-lg font-semibold">SEO</h2>
                  </div>

                  <div className="mt-5 space-y-4">
                    <Input
                      label="Meta title"
                      value={form.metaTitle}
                      onChange={(event) => updateField("metaTitle", event.target.value)}
                      placeholder="Để trống nếu dùng tiêu đề bài viết"
                      className="h-11 rounded-2xl border-[#ddd3c5] bg-[#faf7f2] focus-visible:ring-emerald-100"
                    />

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Meta description
                      </label>
                      <textarea
                        value={form.metaDescription}
                        onChange={(event) => updateField("metaDescription", event.target.value)}
                        rows={4}
                        className="w-full rounded-[24px] border border-[#ddd3c5] bg-[#faf7f2] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white"
                        placeholder="Mô tả SEO khoảng 140-160 ký tự"
                      />
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>

      {previewOpen ? (
        <div className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-sm">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">Xem trước bài viết</div>
              <div className="text-xs text-slate-300">
                Bản nháp hiển thị gần giống trang public.
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              className="border-white bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900"
            >
              Đóng preview
            </Button>
          </div>
          <div className="max-h-[calc(100vh-64px)] overflow-y-auto">
            <SeoArticlePreview
              title={form.title}
              excerpt={previewExcerpt}
              coverImageUrl={form.coverImageUrl}
              blocks={form.blocks}
            />
          </div>
        </div>
      ) : null}
    </RoleGuard>
  );
}
