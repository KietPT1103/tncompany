type SeoArticleAssetContext = {
  siteOrigin?: string;
  apiBase?: string;
  localApiBase?: string;
  proxyTarget?: string;
  isLocalHost?: boolean;
};

type SeoArticleAssetEnvironment = {
  VITE_API_BASE_URL?: string;
  VITE_LOCAL_API_BASE_URL?: string;
  VITE_PROXY_TARGET?: string;
};

const absoluteUrlPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function resolveSeoArticleImageUrl(
  value: string,
  context: SeoArticleAssetContext = {},
) {
  const imageUrl = value.trim();
  if (!imageUrl || absoluteUrlPattern.test(imageUrl)) return imageUrl;
  if (!imageUrl.startsWith("/uploads/")) return imageUrl;

  const environment = (import.meta.env || {}) as SeoArticleAssetEnvironment;
  const siteOrigin =
    context.siteOrigin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const apiBase =
    context.apiBase ?? (environment.VITE_API_BASE_URL || "/api");
  const localApiBase =
    context.localApiBase ?? (environment.VITE_LOCAL_API_BASE_URL || "");
  const proxyTarget =
    context.proxyTarget ?? (environment.VITE_PROXY_TARGET || "");
  const hostname = (() => {
    try {
      return siteOrigin ? new URL(siteOrigin).hostname.toLowerCase() : "";
    } catch {
      return "";
    }
  })();
  const isLocalHost =
    context.isLocalHost ??
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]");
  const assetBase = isLocalHost
    ? localApiBase || proxyTarget || apiBase
    : apiBase;

  try {
    const apiOrigin = new URL(assetBase, siteOrigin || undefined).origin;
    return new URL(imageUrl, `${apiOrigin}/`).toString();
  } catch {
    return imageUrl;
  }
}
