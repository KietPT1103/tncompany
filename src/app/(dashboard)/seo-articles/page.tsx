"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Pencil, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createSeoArticle,
  deleteSeoArticle,
  getSeoArticleById,
  getSeoArticles,
  SeoArticle,
  SeoArticlePayload,
  SeoArticleTargetStore,
  updateSeoArticle,
} from "@/services/seoArticleService";

type ArticleFormState = SeoArticlePayload;

const initialFormState: ArticleFormState = {
  slug: "",
  title: "",
  excerpt: "",
  contentHtml: "",
  coverImageUrl: "",
  metaTitle: "",
  metaDescription: "",
  targetStore: "company",
  isPublished: false,
  publishedAt: null,
};

const targetStoreOptions: Array<{ value: SeoArticleTargetStore; label: string }> = [
  { value: "company", label: "Toan he sinh thai" },
  { value: "cafe", label: "Tiem ca phe Ong Quan" },
  { value: "hotpot", label: "Tiem lau Ong Quan" },
  { value: "farm", label: "Ong Quan Farm" },
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

function formatDateTime(value?: string | null) {
  if (!value) return "Chua len lich";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function SeoArticlesPage() {
  const [articles, setArticles] = useState<SeoArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<ArticleFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  async function loadArticles() {
    setLoading(true);
    try {
      const items = await getSeoArticles(search, statusFilter);
      setArticles(items);
    } catch (error) {
      console.error(error);
      alert("Khong the tai danh sach bai viet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const publishedCount = useMemo(
    () => articles.filter((article) => article.isPublished).length,
    [articles]
  );

  function resetForm() {
    setForm(initialFormState);
    setEditingId(null);
    setSlugTouched(false);
  }

  function updateFormField<Key extends keyof ArticleFormState>(
    field: Key,
    value: ArticleFormState[Key]
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSaveArticle() {
    if (!form.title.trim()) {
      alert("Vui long nhap tieu de bai viet.");
      return;
    }

    if (!form.slug.trim()) {
      alert("Vui long nhap slug bai viet.");
      return;
    }

    if (!form.contentHtml.trim()) {
      alert("Vui long nhap noi dung HTML.");
      return;
    }

    setSaving(true);
    try {
      const payload: SeoArticlePayload = {
        ...form,
        slug: slugify(form.slug),
        publishedAt: form.publishedAt ? form.publishedAt.replace("T", " ") + ":00" : null,
      };

      if (editingId) {
        await updateSeoArticle(editingId, payload);
      } else {
        await createSeoArticle(payload);
      }

      resetForm();
      await loadArticles();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Khong the luu bai viet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditArticle(id: string) {
    try {
      const article = await getSeoArticleById(id);
      if (!article) {
        alert("Khong tim thay bai viet.");
        return;
      }

      setEditingId(article.id);
      setSlugTouched(true);
      setForm({
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt || "",
        contentHtml: article.contentHtml,
        coverImageUrl: article.coverImageUrl || "",
        metaTitle: article.metaTitle || "",
        metaDescription: article.metaDescription || "",
        targetStore: article.targetStore || "company",
        isPublished: article.isPublished,
        publishedAt: article.publishedAt ? toDateTimeLocal(article.publishedAt) : null,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      alert("Khong the tai chi tiet bai viet.");
    }
  }

  async function handleDeleteArticle(article: SeoArticle) {
    const confirmed = confirm(`Xoa bai viet "${article.title}"?`);
    if (!confirmed) return;

    try {
      await deleteSeoArticle(article.id);
      if (editingId === article.id) {
        resetForm();
      }
      await loadArticles();
    } catch (error) {
      console.error(error);
      alert("Khong the xoa bai viet.");
    }
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadArticles();
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-white hover:text-slate-800"
              title="Quay lai dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Bai viet SEO</h1>
              <p className="mt-1 text-sm text-slate-500">
                Quan tri bai viet public de dang moi hang ngay va cho Google crawl truc tiep.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            <div>Tong bai viet: {articles.length}</div>
            <div>Bai dang publish: {publishedCount}</div>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Chinh sua bai viet" : "Tao bai viet moi"}
              </h2>
              <p className="text-sm text-slate-500">
                Noi dung ho tro HTML co ban nhu h2, p, ul, li, strong, a.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Lam moi form
              </Button>
              <Button onClick={handleSaveArticle} disabled={saving}>
                {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {saving ? "Dang luu..." : editingId ? "Luu thay doi" : "Dang bai moi"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tieu de</label>
              <Input
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  updateFormField("title", title);
                  if (!slugTouched) {
                    updateFormField("slug", slugify(title));
                  }
                }}
                placeholder="Vi du: Quan cafe dep o Can Tho cho chup anh cuoi tuan"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Slug URL</label>
              <Input
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  updateFormField("slug", slugify(event.target.value));
                }}
                placeholder="quan-cafe-dep-can-tho"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Mo ta ngan / excerpt</label>
              <textarea
                value={form.excerpt}
                onChange={(event) => updateFormField("excerpt", event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Doan mo ta ngan de hien o danh sach bai viet va ho tro snippet."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Anh dai dien URL</label>
              <Input
                value={form.coverImageUrl}
                onChange={(event) => updateFormField("coverImageUrl", event.target.value)}
                placeholder="https://tnservice.vn/uploads/..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nhom SEO</label>
              <select
                value={form.targetStore}
                onChange={(event) =>
                  updateFormField("targetStore", event.target.value as SeoArticleTargetStore)
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {targetStoreOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Meta title</label>
              <Input
                value={form.metaTitle}
                onChange={(event) => updateFormField("metaTitle", event.target.value)}
                placeholder="De trong neu muon dung tieu de bai viet"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Meta description</label>
              <Input
                value={form.metaDescription}
                onChange={(event) => updateFormField("metaDescription", event.target.value)}
                placeholder="Mo ta SEO khoang 140-160 ky tu"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Lich publish</label>
              <Input
                type="datetime-local"
                value={form.publishedAt || ""}
                onChange={(event) =>
                  updateFormField("publishedAt", event.target.value ? event.target.value : null)
                }
              />
            </div>

            <label className="mt-7 inline-flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) => updateFormField("isPublished", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Publish bai viet ngay khi luu
            </label>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Noi dung HTML</label>
              <textarea
                value={form.contentHtml}
                onChange={(event) => updateFormField("contentHtml", event.target.value)}
                rows={18}
                className="w-full rounded-2xl border border-slate-300 px-3 py-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder={`<p>Doan mo dau...</p>\n<h2>Tieu de phu</h2>\n<p>Noi dung chi tiet...</p>`}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <form className="flex flex-wrap items-end gap-3" onSubmit={handleSearchSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tim kiem</label>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nhap tieu de hoac slug"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Trang thai</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">Tat ca</option>
                  <option value="published">Da publish</option>
                  <option value="draft">Ban nhap</option>
                </select>
              </div>

              <Button type="submit" variant="outline">
                Tai danh sach
              </Button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-y bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Tieu de</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Nhom</th>
                  <th className="px-4 py-3 font-medium">Trang thai</th>
                  <th className="px-4 py-3 font-medium">Publish</th>
                  <th className="px-4 py-3 text-right font-medium">Hanh dong</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Dang tai bai viet...
                    </td>
                  </tr>
                ) : articles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      Chua co bai viet nao.
                    </td>
                  </tr>
                ) : (
                  articles.map((article) => (
                    <tr key={article.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{article.title}</div>
                        <div className="mt-1 max-w-md text-xs text-slate-500">
                          {article.excerpt || "Khong co mo ta ngan."}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        /bai-viet/{article.slug}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {targetStoreOptions.find((option) => option.value === article.targetStore)?.label ||
                          "Toan he sinh thai"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            article.isPublished
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {article.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(article.publishedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/bai-viet/${article.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Xem
                          </a>
                          <button
                            type="button"
                            onClick={() => handleEditArticle(article.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Sua
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteArticle(article)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-600 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xoa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </RoleGuard>
  );
}
