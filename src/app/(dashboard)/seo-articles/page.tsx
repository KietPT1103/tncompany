"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  deleteSeoArticle,
  getSeoArticles,
  SeoArticle,
  SeoArticleTargetStore,
} from "@/services/seoArticleService";

const targetStoreLabels: Record<SeoArticleTargetStore, string> = {
  company: "Toàn hệ sinh thái",
  cafe: "Tiệm cà phê Ông Quan",
  hotpot: "Tiệm lẩu Ông Quan",
  farm: "Ông Quan Farm",
};

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa lên lịch";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function SeoArticlesPage() {
  const [articles, setArticles] = useState<SeoArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadArticles(query = "") {
    setLoading(true);
    try {
      const items = await getSeoArticles(query, "all");
      setArticles(items);
    } catch (error) {
      console.error(error);
      alert("Không thể tải danh sách bài viết.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArticles();
  }, []);

  const publishedCount = useMemo(
    () => articles.filter((article) => article.isPublished).length,
    [articles]
  );

  async function handleDeleteArticle(article: SeoArticle) {
    const confirmed = confirm(`Xóa bài viết "${article.title}"?`);
    if (!confirmed) return;

    try {
      await deleteSeoArticle(article.id);
      await loadArticles(search);
    } catch (error) {
      console.error(error);
      alert("Không thể xóa bài viết.");
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Bài viết SEO</h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý danh sách bài viết, tạo bài mới và chỉnh sửa nội dung cho website public.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <div>Tổng bài viết: {articles.length}</div>
              <div>Đã publish: {publishedCount}</div>
            </div>
            <Link href="/seo-articles/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Tạo bài viết mới
              </Button>
            </Link>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              loadArticles(search);
            }}
          >
            <div className="min-w-[280px] flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-700">Tìm kiếm bài viết</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Nhập tiêu đề hoặc slug"
                />
              </div>
            </div>
            <Button type="submit" variant="outline">
              Tải danh sách
            </Button>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-medium">Bài viết</th>
                  <th className="px-5 py-4 font-medium">Slug</th>
                  <th className="px-5 py-4 font-medium">Nhóm SEO</th>
                  <th className="px-5 py-4 font-medium">Trạng thái</th>
                  <th className="px-5 py-4 font-medium">Publish</th>
                  <th className="px-5 py-4 text-right font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      Đang tải bài viết...
                    </td>
                  </tr>
                ) : articles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      Chưa có bài viết nào.
                    </td>
                  </tr>
                ) : (
                  articles.map((article) => (
                    <tr key={article.id} className="align-top">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{article.title}</div>
                        <div className="mt-1 max-w-xl text-xs leading-6 text-slate-500">
                          {article.excerpt || "Chưa có mô tả ngắn."}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        /bai-viet/{article.slug}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {targetStoreLabels[article.targetStore] || "Toàn hệ sinh thái"}
                      </td>
                      <td className="px-5 py-4">
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
                      <td className="px-5 py-4 text-slate-600">
                        {formatDateTime(article.publishedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/bai-viet/${article.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Xem
                          </a>
                          <Link href={`/seo-articles/${article.id}`}>
                            <Button variant="outline">
                              <Pencil className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </Button>
                          </Link>
                          <Button variant="outline" onClick={() => handleDeleteArticle(article)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa
                          </Button>
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
