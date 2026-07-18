"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Eye,
  Loader2,
  Plus,
  Save,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import RichTextEditor from "@/components/seo/RichTextEditor";
import { SeoArticleImageField } from "@/components/seo/SeoArticleImageField";
import SeoArticlePreview from "@/components/seo/SeoArticlePreview";
import { SeoArticlePublishPanel } from "@/components/seo/SeoArticlePublishPanel";
import {
  combinePublishDateTime,
  formatLocalDateTime,
  resolvePublishedAt,
  toApiDateTime,
} from "@/components/seo/seoArticlePublish";
import {
  clearSeoArticleBlockImage,
  createEmptySeoArticleBlock,
  normalizeSeoArticleBlocks,
  renderSeoArticleBlocksToHtml,
  stripSeoArticleHtml,
} from "@/features/seoArticles/articleBlocks";
import {
  createSeoArticle,
  generateSeoArticleWithAi,
  getSeoArticleById,
  GenerateSeoArticleInput,
  SeoArticle,
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

type AiAssistFormState = {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string;
  tone: string;
  audience: string;
  customNotes: string;
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

const initialAiAssistState: AiAssistFormState = {
  topic: "",
  primaryKeyword: "",
  secondaryKeywords: "",
  tone: "Chuyên nghiệp, thuyết phục, dễ đọc",
  audience: "Khách hàng đang tìm hiểu dịch vụ và sản phẩm",
  customNotes: "",
};

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
      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
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
  const [aiAssist, setAiAssist] =
    useState<AiAssistFormState>(initialAiAssistState);
  const [generatingAi, setGeneratingAi] = useState(false);

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
          publishedAt: article.publishedAt
            ? toDateTimeLocal(article.publishedAt)
            : null,
          blocks: normalizeSeoArticleBlocks(
            article.contentJson,
            article.contentHtml,
          ),
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
    const combined = form.blocks
      .map((block) => stripSeoArticleHtml(block.html))
      .join(" ")
      .trim();
    return combined.slice(0, 220);
  }, [form.blocks, form.excerpt]);

  const previewArticle = useMemo<SeoArticle>(() => {
    const contentBlocks = form.blocks.filter(
      (block) =>
        block.heading.trim() || block.html.trim() || block.imageUrl.trim(),
    );
    const previewDate =
      toApiDateTime(resolvePublishedAt(true, form.publishedAt)) || "";

    return {
      id: articleId || "seo-preview",
      slug: slugify(form.slug || form.title) || "bai-viet-xem-truoc",
      title: form.title.trim() || "Tiêu đề bài viết",
      excerpt:
        previewExcerpt || "Mô tả ngắn của bài viết sẽ hiển thị tại vị trí này.",
      contentHtml: renderSeoArticleBlocksToHtml(contentBlocks),
      contentJson: contentBlocks,
      coverImageUrl: form.coverImageUrl.trim(),
      metaTitle: form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim(),
      targetStore: form.targetStore,
      isPublished: form.isPublished,
      publishedAt: previewDate,
      createdAt: previewDate,
      updatedAt: previewDate,
    };
  }, [articleId, form, previewExcerpt]);

  function updateField<Key extends keyof EditorFormState>(
    field: Key,
    value: EditorFormState[Key],
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateAiAssistField<Key extends keyof AiAssistFormState>(
    field: Key,
    value: AiAssistFormState[Key],
  ) {
    setAiAssist((previous) => ({ ...previous, [field]: value }));
  }

  function handlePublishToggle() {
    setForm((previous) => {
      const nextPublished = !previous.isPublished;
      return {
        ...previous,
        isPublished: nextPublished,
        publishedAt: resolvePublishedAt(nextPublished, previous.publishedAt),
      };
    });
  }

  function handlePublishDateChange(date: string) {
    setForm((previous) => {
      if (!date) {
        return {
          ...previous,
          publishedAt: previous.isPublished
            ? resolvePublishedAt(true, null)
            : null,
        };
      }

      const fallbackTime = formatLocalDateTime(new Date()).slice(11, 16);
      const currentTime = previous.publishedAt?.slice(11, 16) || fallbackTime;
      return {
        ...previous,
        publishedAt: combinePublishDateTime(date, currentTime),
      };
    });
  }

  function handlePublishTimeChange(time: string) {
    setForm((previous) => {
      if (!time) {
        return {
          ...previous,
          publishedAt: previous.isPublished
            ? resolvePublishedAt(true, null)
            : null,
        };
      }

      const fallbackDate = formatLocalDateTime(new Date()).slice(0, 10);
      const currentDate = previous.publishedAt?.slice(0, 10) || fallbackDate;
      return {
        ...previous,
        publishedAt: combinePublishDateTime(currentDate, time),
      };
    });
  }

  function updateBlock(
    blockId: string,
    updater: (
      block: EditorFormState["blocks"][number],
    ) => EditorFormState["blocks"][number],
  ) {
    setForm((previous) => ({
      ...previous,
      blocks: previous.blocks.map((block) =>
        block.id === blockId ? updater(block) : block,
      ),
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
      const nextBlocks = previous.blocks.filter(
        (block) => block.id !== blockId,
      );
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
      alert(
        error instanceof Error ? error.message : "Không thể upload ảnh cover.",
      );
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
      alert(
        error instanceof Error
          ? error.message
          : "Không thể upload ảnh cho đoạn.",
      );
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
      (block) =>
        block.heading.trim() || block.html.trim() || block.imageUrl.trim(),
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
      publishedAt: toApiDateTime(
        resolvePublishedAt(form.isPublished, form.publishedAt),
      ),
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

  async function handleGenerateWithAi() {
    const topic = aiAssist.topic.trim() || form.title.trim();
    const primaryKeyword =
      aiAssist.primaryKeyword.trim() ||
      form.metaTitle.trim() ||
      form.title.trim();

    if (!topic) {
      alert("Nhập chủ đề bài viết để AI có thể viết nội dung.");
      return;
    }

    if (!primaryKeyword) {
      alert("Nhập từ khóa chính để AI tối ưu bài SEO.");
      return;
    }

    const payload: GenerateSeoArticleInput = {
      topic,
      primaryKeyword,
      secondaryKeywords: aiAssist.secondaryKeywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      targetStore: form.targetStore,
      tone: aiAssist.tone.trim() || initialAiAssistState.tone,
      audience: aiAssist.audience.trim() || initialAiAssistState.audience,
      customNotes: aiAssist.customNotes.trim(),
    };

    setGeneratingAi(true);
    try {
      const { article } = await generateSeoArticleWithAi(payload);
      setForm((previous) => ({
        ...previous,
        title: article.title || previous.title,
        slug: article.slug || slugify(article.title || previous.title),
        excerpt: article.excerpt || previous.excerpt,
        metaTitle: article.metaTitle || previous.metaTitle,
        metaDescription: article.metaDescription || previous.metaDescription,
        blocks: normalizeSeoArticleBlocks(article.blocks, ""),
      }));
      setSlugTouched(true);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Không thể tạo bài viết bằng AI.",
      );
    } finally {
      setGeneratingAi(false);
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-slate-50 px-3 py-4 pb-24 sm:px-6 sm:py-5 sm:pb-8 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="sticky top-0 z-20 -mx-3 mb-5 border-b border-slate-200 bg-slate-50/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 ">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/seo-articles"
                  aria-label="Quay lại danh sách bài viết"
                  title="Quay lại danh sách bài viết"
                  className="group inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-[20px] border-0 bg-emerald-700 text-white shadow-none transition-all duration-200 hover:bg-[#f2aa00] hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb800] focus-visible:ring-offset-2 active:scale-[0.96] motion-reduce:transition-none"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                </Link>
                <div className="min-w-0">
                  <h1 className="font-smooch text-emerald-800 truncate text-lg font-bold sm:text-5xl">
                    {isEditMode
                      ? "Chỉnh sửa bài viết SEO"
                      : "Tạo bài viết SEO mới"}
                  </h1>
                  <p className="font-firasans font-bold text-[#d6ba5d] mt-0.5 hidden text-sm sm:block">
                    {form.isPublished
                      ? "Đang thiết lập xuất bản"
                      : "Bản nháp chưa công khai"}
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-3 sm:flex">
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(true)}
                  className="h-10 rounded-[2px] border-2 border-slate-700 bg-white px-4 font-semibold text-slate-900 shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#0f172a]"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Xem trước
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="h-10 rounded-[2px] border-2 border-emerald-700 bg-emerald-700 px-4 font-semibold text-white shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-emerald-800 hover:text-white hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#0f172a] disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-[3px_3px_0_#64748b] disabled:opacity-100"
                >
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
            <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white px-8 py-16 text-center text-slate-600 shadow-[0_2px_6px_rgba(15,23,42,0.06)]">
              Đang tải dữ liệu bài viết...
            </div>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[6px_8px_14px_rgba(6,78,59,0.1)]">
                  <div className="px-5 py-5 sm:p-6 lg:p-8">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span
                        className={
                          form.isPublished
                            ? "inline-flex h-7 items-center rounded bg-emerald-700 px-2.5 text-xs font-semibold text-[#e8c75d] ring-1 ring-inset ring-emerald-700"
                            : "inline-flex h-7 items-center rounded bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
                        }
                      >
                        {form.isPublished ? "Published" : "Draft"}
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
                      rows={3}
                      className="mt-4 min-h-[180px] w-full resize-none overflow-y-hidden border-0 bg-transparent p-0 text-3xl font-bold leading-[1.18] py-2 text-slate-950 outline-none placeholder:text-slate-300 sm:min-h-[200px] sm:text-4xl lg:min-h-[220px] lg:text-5xl"
                      placeholder="Nhập tiêu đề bài viết"
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-600/15">
                      <span className="font-medium text-slate-700">Slug</span>
                      <span className="font-mono text-xs text-slate-400">
                        /tin-tuc/
                      </span>
                      <input
                        value={form.slug}
                        onChange={(event) => {
                          setSlugTouched(true);
                          updateField("slug", slugify(event.target.value));
                        }}
                        className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm text-slate-700 outline-none placeholder:text-slate-400"
                        placeholder="ten-bai-viet"
                      />
                    </div>

                    <textarea
                      value={form.excerpt}
                      onChange={(event) =>
                        updateField("excerpt", event.target.value)
                      }
                      rows={4}
                      className="mt-5 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-base leading-7 text-slate-700 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15 sm:text-lg"
                      placeholder="Viết phần mô tả mở đầu ngắn để hiển thị trên Google và ở đầu bài viết."
                    />

                    <div className="mt-6">
                      <SeoArticleImageField
                        label="Ảnh bìa bài viết"
                        value={form.coverImageUrl}
                        alt={form.title.trim() || "Ảnh bìa bài viết"}
                        uploading={uploadingCover}
                        variant="cover"
                        onUpload={(file) => void uploadCoverImage(file)}
                        onChange={(value) =>
                          updateField("coverImageUrl", value)
                        }
                        onRemove={() => updateField("coverImageUrl", "")}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-200 px-4 py-5 sm:p-6 lg:p-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-950">
                          Nội dung bài viết
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={addBlock}
                        className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-[background-color,border-color,color,transform] hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.98] motion-reduce:transition-none"
                      >
                        <Plus className="h-4 w-4" />
                        Thêm mục
                      </button>
                    </div>

                    <div className="space-y-1">
                      {form.blocks.map((block, index) => (
                        <section
                          key={block.id}
                          className="group border-t border-slate-200 py-7 first:border-t-0 first:pt-0 sm:py-8"
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                            <div className="flex items-center gap-3">
                              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                Phần {index + 1}
                              </span>
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
                            className="w-full border-0 bg-transparent p-0 text-xl font-bold leading-snug text-slate-950 outline-none placeholder:text-slate-300 sm:text-2xl"
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

                          <div className="mt-6 border-t border-slate-100 pt-5">
                            <SeoArticleImageField
                              label="Ảnh minh họa"
                              value={block.imageUrl}
                              alt={
                                block.imageAlt ||
                                block.heading ||
                                "Ảnh minh họa"
                              }
                              uploading={uploadingBlockId === block.id}
                              onUpload={(file) =>
                                void uploadBlockImage(block.id, file)
                              }
                              onChange={(value) =>
                                updateBlock(block.id, (current) => ({
                                  ...current,
                                  imageUrl: value,
                                }))
                              }
                              onRemove={() =>
                                updateBlock(
                                  block.id,
                                  clearSeoArticleBlockImage,
                                )
                              }
                            />

                            {block.imageUrl ? (
                              <input
                                value={block.imageAlt}
                                onChange={(event) =>
                                  updateBlock(block.id, (current) => ({
                                    ...current,
                                    imageAlt: event.target.value,
                                  }))
                                }
                                className="mt-3 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
                                placeholder="Mô tả ảnh để hỗ trợ SEO và trợ năng"
                              />
                            ) : null}
                          </div>
                        </section>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addBlock}
                      className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition-[background-color,border-color,color] hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm một mục nội dung mới
                    </button>
                  </div>
                </article>
              </div>

              <aside className="flex flex-col gap-4 xl:sticky xl:top-24 ">
                <section className="order-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[6px_8px_14px_rgba(6,78,59,0.1)] sm:p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Sparkles className="h-5 w-5 text-emerald-700" />
                    <h2 className="text-base font-semibold">AI viết bài SEO</h2>
                  </div>

                  <div className="mt-4 space-y-4">
                    <Input
                      label="Chủ đề bài viết"
                      value={aiAssist.topic}
                      onChange={(event) =>
                        updateAiAssistField("topic", event.target.value)
                      }
                      placeholder="Ví dụ: kinh nghiệm mở quán cà phê"
                      className="h-10 rounded-md border-slate-300 bg-white focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                    />

                    <Input
                      label="Từ khóa chính"
                      value={aiAssist.primaryKeyword}
                      onChange={(event) =>
                        updateAiAssistField(
                          "primaryKeyword",
                          event.target.value,
                        )
                      }
                      placeholder="Ví dụ: mở quán cà phê"
                      className="h-10 rounded-md border-slate-300 bg-white focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                    />

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Từ khóa phụ
                      </label>
                      <textarea
                        value={aiAssist.secondaryKeywords}
                        onChange={(event) =>
                          updateAiAssistField(
                            "secondaryKeywords",
                            event.target.value,
                          )
                        }
                        rows={3}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-[border-color,box-shadow] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                        placeholder="Cách nhau bằng dấu phẩy"
                      />
                    </div>

                    <Input
                      label="Giọng văn"
                      value={aiAssist.tone}
                      onChange={(event) =>
                        updateAiAssistField("tone", event.target.value)
                      }
                      placeholder="Chuyên nghiệp, dễ đọc, thuyết phục"
                      className="h-10 rounded-md border-slate-300 bg-white focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                    />

                    <Input
                      label="Đối tượng độc giả"
                      value={aiAssist.audience}
                      onChange={(event) =>
                        updateAiAssistField("audience", event.target.value)
                      }
                      placeholder="Khách hàng tiềm năng"
                      className="h-10 rounded-md border-slate-300 bg-white focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                    />

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Ghi chú thêm cho AI
                      </label>
                      <textarea
                        value={aiAssist.customNotes}
                        onChange={(event) =>
                          updateAiAssistField("customNotes", event.target.value)
                        }
                        rows={4}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-[border-color,box-shadow] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                        placeholder="Ví dụ: nhắc đến ưu điểm thương hiệu"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateWithAi}
                    disabled={generatingAi || loading || saving}
                    className="mt-4 h-10 w-full rounded-md bg-emerald-700 text-white shadow-none hover:bg-emerald-800"
                  >
                    {generatingAi ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {generatingAi ? "AI đang viết bài..." : "Tạo bài bằng AI"}
                  </Button>
                </section>

                <SeoArticlePublishPanel
                  isPublished={form.isPublished}
                  publishedAt={form.publishedAt}
                  targetStore={form.targetStore}
                  onToggle={handlePublishToggle}
                  onDateChange={handlePublishDateChange}
                  onTimeChange={handlePublishTimeChange}
                  onTargetStoreChange={(value) =>
                    updateField("targetStore", value)
                  }
                />

                <section className="order-2 rounded-lg border border-slate-200 bg-white p-4 shadow-[6px_8px_14px_rgba(6,78,59,0.1)] sm:p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Settings2 className="h-5 w-5 text-emerald-700" />
                    <h2 className="text-base font-semibold">SEO</h2>
                  </div>

                  <div className="mt-4 space-y-4">
                    <Input
                      label="Meta title"
                      value={form.metaTitle}
                      onChange={(event) =>
                        updateField("metaTitle", event.target.value)
                      }
                      placeholder="Để trống nếu dùng tiêu đề bài viết"
                      className="h-10 rounded-md border-slate-300 bg-white focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                    />

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Meta description
                      </label>
                      <textarea
                        value={form.metaDescription}
                        onChange={(event) =>
                          updateField("metaDescription", event.target.value)
                        }
                        rows={4}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-[border-color,box-shadow] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
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

      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          className="h-11 min-w-0 rounded-md border-slate-300 bg-white px-3 text-sm shadow-none"
        >
          <Eye className="mr-2 h-4 w-4" />
          Xem trước
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="h-11 min-w-0 rounded-md bg-emerald-700 px-3 text-sm text-white shadow-none hover:bg-emerald-800"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Đang lưu..." : "Lưu bài viết"}
        </Button>
      </div>

      {previewOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="seo-article-preview-title"
          className="fixed inset-0 z-[120] isolate flex min-h-0 flex-col bg-white"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setPreviewOpen(false);
            }
          }}
        >
          <div className="relative z-10 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-amber-500/70 bg-white px-3 py-3 text-black shadow-sm sm:px-4">
            <div>
              <div
                id="seo-article-preview-title"
                className="text-sm font-semibold"
              >
                Xem trước bài viết
              </div>
              <div className="hidden text-xs text-black sm:block">
                Hiển thị đúng giao diện trang tin tức public.
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              autoFocus
              className="h-10 shrink-0 rounded-[2px] border-2 border-emerald-900 bg-white px-4 font-semibold text-black shadow-[4px_4px_0_#064E3B] transition-[background-color,box-shadow,color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#F3E7DA] hover:text-[#6B4423] hover:shadow-[6px_6px_0_#064E3B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#064E3B]"
            >
              Đóng
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white [scrollbar-gutter:stable]">
            <SeoArticlePreview article={previewArticle} />
          </div>
        </div>
      ) : null}
    </RoleGuard>
  );
}
