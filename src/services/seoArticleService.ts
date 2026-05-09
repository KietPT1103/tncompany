import { apiRequest } from "@/lib/api";

export type SeoArticleTargetStore = "company" | "cafe" | "hotpot" | "farm";

export type SeoArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentJson: SeoArticleBlock[];
  coverImageUrl: string;
  metaTitle: string;
  metaDescription: string;
  targetStore: SeoArticleTargetStore;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SeoArticleBlock = {
  id: string;
  heading: string;
  html: string;
  imageUrl: string;
  imageAlt: string;
};

export type SeoArticlePayload = {
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentJson: SeoArticleBlock[];
  coverImageUrl: string;
  metaTitle: string;
  metaDescription: string;
  targetStore: SeoArticleTargetStore;
  isPublished: boolean;
  publishedAt: string | null;
};

export async function getSeoArticles(query = "", status = "all") {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("query", query.trim());
  }
  if (status && status !== "all") {
    params.set("status", status);
  }

  const suffix = params.toString();
  const { items } = await apiRequest<{ items: SeoArticle[] }>(
    `/seo-articles.php${suffix ? `?${suffix}` : ""}`,
    { method: "GET" }
  );

  return items;
}

export async function getSeoArticleById(id: string) {
  const { item } = await apiRequest<{ item: SeoArticle | null }>(
    `/seo-articles.php?id=${encodeURIComponent(id)}`,
    { method: "GET" }
  );

  return item;
}

export async function createSeoArticle(payload: SeoArticlePayload) {
  const { id } = await apiRequest<{ id: string }>("/seo-articles.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return id;
}

export async function updateSeoArticle(id: string, payload: SeoArticlePayload) {
  await apiRequest<{ updated: boolean }>("/seo-articles.php", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      ...payload,
    }),
  });
}

export async function deleteSeoArticle(id: string) {
  await apiRequest<{ deleted: boolean }>(
    `/seo-articles.php?id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function uploadSeoArticleImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const { url } = await apiRequest<{ url: string }>(
    "/seo-article-upload.php",
    {
      method: "POST",
      body: formData,
    }
  );

  return url;
}
