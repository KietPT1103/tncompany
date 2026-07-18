import type { SeoArticleBlock } from "../../services/seoArticleService";

export type SeoArticleDisplayBlock = {
  id: string;
  heading: string;
  html: string;
  imageUrl: string;
  imageAlt: string;
};

function hasVisibleContent(block: SeoArticleBlock): boolean {
  return Boolean(
    block.heading?.trim() || block.html?.trim() || block.imageUrl?.trim(),
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeDisplayHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'")
    .trim();
}

export function getSeoArticleDisplayBlocks(
  blocks: SeoArticleBlock[] | null | undefined,
  fallbackHtml = "",
  fallbackText = "",
): SeoArticleDisplayBlock[] {
  const structuredBlocks = (blocks || [])
    .filter(hasVisibleContent)
    .map((block, index) => ({
      id: block.id?.trim() || `article-part-${index + 1}`,
      heading: block.heading?.trim() || "",
      html: sanitizeDisplayHtml(block.html || ""),
      imageUrl: block.imageUrl?.trim() || "",
      imageAlt: block.imageAlt?.trim() || "",
    }));

  if (structuredBlocks.length > 0) {
    return structuredBlocks;
  }

  if (fallbackHtml.trim()) {
    return [
      {
        id: "legacy-content",
        heading: "",
        html: sanitizeDisplayHtml(fallbackHtml),
        imageUrl: "",
        imageAlt: "",
      },
    ];
  }

  if (fallbackText.trim()) {
    return [
      {
        id: "fallback-content",
        heading: "",
        html: `<p>${escapeHtml(fallbackText.trim())}</p>`,
        imageUrl: "",
        imageAlt: "",
      },
    ];
  }

  return [];
}
