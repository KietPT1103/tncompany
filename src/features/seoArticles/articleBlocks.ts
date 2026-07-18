import type { SeoArticleBlock } from "@/services/seoArticleService";

export function createEmptySeoArticleBlock(): SeoArticleBlock {
  return {
    id: crypto.randomUUID(),
    heading: "",
    html: "",
    imageUrl: "",
    imageAlt: "",
  };
}

export function clearSeoArticleBlockImage(
  block: SeoArticleBlock,
): SeoArticleBlock {
  return {
    ...block,
    imageUrl: "",
    imageAlt: "",
  };
}

export function normalizeSeoArticleBlocks(
  blocks?: SeoArticleBlock[] | null,
  fallbackHtml = ""
): SeoArticleBlock[] {
  if (blocks && blocks.length > 0) {
    return blocks.map((block) => ({
      id: block.id || crypto.randomUUID(),
      heading: block.heading || "",
      html: block.html || "",
      imageUrl: block.imageUrl || "",
      imageAlt: block.imageAlt || "",
    }));
  }

  if (!fallbackHtml.trim()) {
    return [createEmptySeoArticleBlock()];
  }

  return [
    {
      ...createEmptySeoArticleBlock(),
      html: fallbackHtml,
    },
  ];
}

export function renderSeoArticleBlocksToHtml(blocks: SeoArticleBlock[]) {
  return blocks
    .map((block) => {
      const parts: string[] = [];
      const heading = block.heading.trim();
      const imageUrl = block.imageUrl.trim();
      const imageAlt = block.imageAlt.trim();
      const html = block.html.trim();

      if (heading) {
        parts.push(`<h2>${escapeHtml(heading)}</h2>`);
      }

      if (html) {
        parts.push(html);
      }

      if (imageUrl) {
        parts.push(
          `<figure><img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(
            imageAlt || heading
          )}" loading="lazy" /></figure>`
        );
      }

      return parts.length ? `<section>${parts.join("\n")}</section>` : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function stripSeoArticleHtml(html: string) {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  return (container.textContent || container.innerText || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
