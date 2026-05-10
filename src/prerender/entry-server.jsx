import React from "react";
import { renderToString } from "react-dom/server";
import PublicSiteShell from "../components/PublicSiteShell";
import { pages } from "../data/siteData";
import { getSeoForPath } from "../seo/pageSeo";

const noop = () => {};

export const PUBLIC_PRERENDER_ROUTES = pages
  .filter((page) => page.hash !== "/tin-tuc")
  .map((page) => page.hash);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createHeadTags(seo) {
  const tags = [
    `<title>${escapeHtml(seo.title)}</title>`,
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="robots" content="${escapeHtml(seo.robots)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(seo.image)}" />`,
    `<meta property="og:type" content="${escapeHtml(seo.openGraphType || "website")}" />`,
    `<meta property="og:locale" content="vi_VN" />`,
    `<meta property="og:site_name" content="${escapeHtml(seo.siteName)}" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(seo.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(seo.image)}" />`,
    `<link rel="canonical" href="${escapeHtml(seo.canonical)}" />`,
  ];

  if (seo.schema) {
    tags.push(
      `<script id="app-seo-jsonld" type="application/ld+json">${JSON.stringify(seo.schema).replace(
        /</g,
        "\\u003c"
      )}</script>`
    );
  }

  return tags.join("\n    ");
}

export function renderPublicRoute(pathname) {
  const seo = getSeoForPath(pathname);
  const appHtml = renderToString(
    <PublicSiteShell
      pathname={pathname}
      onHeroImageError={noop}
      onNavigate={undefined}
      onOpenImage={noop}
    />
  );

  return {
    appHtml,
    headTags: createHeadTags(seo),
    pathname,
  };
}
