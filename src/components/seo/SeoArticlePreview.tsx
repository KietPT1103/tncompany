"use client";

import ArticleDetailPage from "@/app/tin-tuc/ArticleDetailPage";
import type { SeoArticle } from "@/services/seoArticleService";

export default function SeoArticlePreview({ article }: { article: SeoArticle }) {
  return <ArticleDetailPage previewArticle={article} previewMode />;
}
