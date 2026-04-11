import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSeoForPath } from "../seo/pageSeo";

function upsertMetaByName(name, content) {
  let meta = document.head.querySelector(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
  meta.setAttribute("data-managed-seo", "true");
}

function upsertMetaByProperty(property, content) {
  let meta = document.head.querySelector(`meta[property="${property}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
  meta.setAttribute("data-managed-seo", "true");
}

function upsertLink(rel, href) {
  let link = document.head.querySelector(`link[rel="${rel}"]`);

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", rel);
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
  link.setAttribute("data-managed-seo", "true");
}

function upsertStructuredData(schema) {
  const scriptId = "app-seo-jsonld";
  let script = document.getElementById(scriptId);

  if (!schema) {
    script?.remove();
    return;
  }

  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    script.setAttribute("data-managed-seo", "true");
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(schema);
}

export default function SeoManager() {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);

    document.documentElement.lang = "vi";
    document.title = seo.title;

    upsertMetaByName("description", seo.description);
    upsertMetaByName("robots", seo.robots);
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", seo.title);
    upsertMetaByName("twitter:description", seo.description);
    upsertMetaByName("twitter:image", seo.image);

    upsertMetaByProperty("og:type", seo.openGraphType || "website");
    upsertMetaByProperty("og:locale", "vi_VN");
    upsertMetaByProperty("og:site_name", seo.siteName);
    upsertMetaByProperty("og:title", seo.title);
    upsertMetaByProperty("og:description", seo.description);
    upsertMetaByProperty("og:url", seo.canonical);
    upsertMetaByProperty("og:image", seo.image);

    upsertLink("canonical", seo.canonical);
    upsertStructuredData(seo.schema);
  }, [location.pathname]);

  return null;
}
