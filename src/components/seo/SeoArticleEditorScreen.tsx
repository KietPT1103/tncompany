"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Save,
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

  function updateBlock(blockId: string, updater: (block: EditorFormState["blocks"][number]) => EditorFormState["blocks"][number]) {
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

    const contentHtml = renderSeoArticleBlocksToHtml(blocks);

    const payload: SeoArticlePayload = {
      slug: slugify(form.slug || form.title),
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      contentHtml,
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
      <main className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/seo-articles"
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-white hover:text-slate-800"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEditMode ? "Chỉnh sửa bài viết SEO" : "Tạo bài viết SEO mới"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Soạn theo từng đoạn nội dung, chèn ảnh, định dạng chữ và xem trước toàn trang.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-2 h-4 w-4" />
              Xem trước
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Đang lưu..." : "Lưu bài viết"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Đang tải dữ liệu bài viết...
          </div>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Tiêu đề bài viết</label>
                    <Input
                      value={form.title}
                      onChange={(event) => {
                        const title = event.target.value;
                        updateField("title", title);
                        if (!slugTouched) {
                          updateField("slug", slugify(title));
                        }
                      }}
                      placeholder="Ví dụ: 10 kỹ năng làm việc với AI cho người mới"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Slug URL</label>
                    <Input
                      value={form.slug}
                      onChange={(event) => {
                        setSlugTouched(true);
                        updateField("slug", slugify(event.target.value));
                      }}
                      placeholder="10-ky-nang-lam-viec-voi-ai"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Mô tả ngắn</label>
                    <textarea
                      value={form.excerpt}
                      onChange={(event) => updateField("excerpt", event.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="Phần mở đầu ngắn dùng cho danh sách bài viết và snippet tìm kiếm."
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Ảnh cover</label>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <ImagePlus className="h-4 w-4" />
                        {uploadingCover ? "Đang upload..." : "Chọn ảnh"}
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
                    </div>
                    <Input
                      value={form.coverImageUrl}
                      onChange={(event) => updateField("coverImageUrl", event.target.value)}
                      placeholder="Hoặc dán URL ảnh cover"
                    />
                    {form.coverImageUrl ? (
                      <img
                        src={form.coverImageUrl}
                        alt="Ảnh cover"
                        className="h-44 w-full rounded-2xl border border-slate-200 object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Nhóm SEO</label>
                      <select
                        value={form.targetStore}
                        onChange={(event) =>
                          updateField("targetStore", event.target.value as SeoArticleTargetStore)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        {targetStoreOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Lịch publish</label>
                      <Input
                        type="datetime-local"
                        value={form.publishedAt || ""}
                        onChange={(event) =>
                          updateField("publishedAt", event.target.value ? event.target.value : null)
                        }
                      />
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      onChange={(event) => updateField("isPublished", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Publish bài viết ngay khi lưu
                  </label>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Meta title</label>
                    <Input
                      value={form.metaTitle}
                      onChange={(event) => updateField("metaTitle", event.target.value)}
                      placeholder="Để trống nếu muốn dùng tiêu đề bài viết"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Meta description</label>
                    <textarea
                      value={form.metaDescription}
                      onChange={(event) => updateField("metaDescription", event.target.value)}
                      rows={3}
                      className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="Mô tả SEO khoảng 140-160 ký tự"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Các đoạn nội dung</h2>
                  <p className="text-sm text-slate-500">
                    Mỗi đoạn có thể có tiêu đề, nội dung định dạng và một ảnh minh họa riêng.
                  </p>
                </div>

                <Button onClick={addBlock}>
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm đoạn
                </Button>
              </div>

              <div className="space-y-4">
                {form.blocks.map((block, index) => (
                  <div
                    key={block.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-100 p-2 text-slate-500">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Đoạn {index + 1}</div>
                          <div className="text-xs text-slate-500">Khối nội dung có thể di chuyển lên xuống</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => moveBlock(block.id, -1)}>
                          Lên
                        </Button>
                        <Button variant="outline" onClick={() => moveBlock(block.id, 1)}>
                          Xuống
                        </Button>
                        <Button variant="outline" onClick={() => removeBlock(block.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa đoạn
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Tiêu đề đoạn</label>
                          <Input
                            value={block.heading}
                            onChange={(event) =>
                              updateBlock(block.id, (current) => ({
                                ...current,
                                heading: event.target.value,
                              }))
                            }
                            placeholder="Ví dụ: 1. Học cách đặt câu hỏi cho AI"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Nội dung đoạn</label>
                          <RichTextEditor
                            value={block.html}
                            onChange={(value) =>
                              updateBlock(block.id, (current) => ({
                                ...current,
                                html: value,
                              }))
                            }
                            placeholder="Nhập nội dung, dùng toolbar để bôi đậm, tạo danh sách, gắn link..."
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Ảnh minh họa đoạn</label>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <ImagePlus className="h-4 w-4" />
                            {uploadingBlockId === block.id ? "Đang upload..." : "Chọn ảnh"}
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
                          <Input
                            value={block.imageUrl}
                            onChange={(event) =>
                              updateBlock(block.id, (current) => ({
                                ...current,
                                imageUrl: event.target.value,
                              }))
                            }
                            placeholder="Hoặc dán URL ảnh cho đoạn"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Mô tả ảnh (alt)</label>
                          <Input
                            value={block.imageAlt}
                            onChange={(event) =>
                              updateBlock(block.id, (current) => ({
                                ...current,
                                imageAlt: event.target.value,
                              }))
                            }
                            placeholder="Mô tả ngắn cho ảnh, hỗ trợ SEO"
                          />
                        </div>

                        {block.imageUrl ? (
                          <img
                            src={block.imageUrl}
                            alt={block.imageAlt || block.heading || "Ảnh minh họa"}
                            className="h-52 w-full rounded-2xl border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                            Chưa có ảnh cho đoạn này
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {previewOpen ? (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">Xem trước bài viết</div>
              <div className="text-xs text-slate-300">Bản nháp hiển thị gần giống trang public</div>
            </div>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
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
