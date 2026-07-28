import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { navPages } from "../../data/siteData";
import { getSeoArticles, SeoArticle } from "../../services/seoArticleService";
import defaultImage from "../../optimized-media/cafe/cafe-hero.jpg";
import { resolveSeoArticleImageUrl } from "../../components/seo/seoArticleAssets";
import { getSeoArticleDisplayBlocks } from "../../features/seoArticles/articleDisplayBlocks";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

function upsertMetaByName(name: string, content: string) {
  let meta = document.head.querySelector(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
  meta.setAttribute("data-managed-seo", "true");
}

function upsertMetaByProperty(property: string, content: string) {
  let meta = document.head.querySelector(`meta[property="${property}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
  meta.setAttribute("data-managed-seo", "true");
}

function upsertLink(rel: string, href: string) {
  let link = document.head.querySelector(`link[rel="${rel}"]`);

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", rel);
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
  link.setAttribute("data-managed-seo", "true");
}

function upsertStructuredData(schema: Record<string, unknown> | null) {
  const scriptId = "app-seo-jsonld";
  let script = document.getElementById(scriptId);

  if (!schema) {
    script?.remove();
    return;
  }

  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-managed-seo", "true");
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(schema);
}

function getStoreLabel(targetStore: string) {
  if (targetStore === "cafe") return "Cà phê";
  if (targetStore === "hotpot") return "Tiệm lẩu";
  if (targetStore === "farm") return "Farm";
  return "Company";
}

function formatDateLong(dateString: string | null) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day} Tháng ${month}, ${d.getFullYear()}`;
}

function getReadTime(article: SeoArticle) {
  const textLength =
    (article.contentHtml || "").length + (article.excerpt || "").length;
  const minutes = Math.max(1, Math.ceil(textLength / 1500));
  return `${minutes} phút đọc`;
}

function stripHtml(html: string) {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function buildArticleShareUrl(slug: string) {
  if (typeof window === "undefined") {
    return `/tin-tuc/${slug}`;
  }

  return new URL(`/tin-tuc/${slug}`, window.location.origin).toString();
}

function buildFacebookShareUrl(url: string) {
  return `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({
    u: url,
  }).toString()}`;
}

function buildZaloShareUrl(url: string) {
  return `https://zalo.me/share?${new URLSearchParams({
    url,
  }).toString()}`;
}

function openShareWindow(url: string) {
  if (typeof window === "undefined") {
    return;
  }

  const width = 720;
  const height = 680;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    url,
    "tn-article-share",
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},noopener,noreferrer`,
  );

  if (popup) {
    popup.focus();
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard API unavailable");
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("Copy command failed");
  }
}

type ArticleDetailPageProps = {
  previewArticle?: SeoArticle | null;
  previewMode?: boolean;
};

export default function ArticleDetailPage({
  previewArticle = null,
  previewMode = false,
}: ArticleDetailPageProps = {}) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<SeoArticle | null>(previewArticle);
  const [relatedArticles, setRelatedArticles] = useState<SeoArticle[]>([]);
  const [loading, setLoading] = useState(!previewArticle);
  const [shareNotice, setShareNotice] = useState("");

  useEffect(() => {
    if (previewArticle) {
      setArticle(previewArticle);
      setRelatedArticles([]);
      setLoading(false);
      return;
    }

    window.scrollTo(0, 0);
    getSeoArticles("", "published")
      .then((data) => {
        const articles = data || [];
        const current = articles.find((a) => a.slug === slug);
        setArticle(current || null);
        setRelatedArticles(articles.filter((a) => a.slug !== slug).slice(0, 3));
      })
      .catch(() => {
        setArticle(null);
        setRelatedArticles([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [previewArticle, slug]);

  useEffect(() => {
    if (!shareNotice || typeof window === "undefined") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShareNotice("");
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [shareNotice]);

  useEffect(() => {
    if (
      previewMode ||
      typeof document === "undefined" ||
      typeof window === "undefined" ||
      !article
    ) {
      return;
    }

    const canonical = buildArticleShareUrl(article.slug);
    const title = `${article.metaTitle || article.title} | T&N Company`;
    const description =
      article.metaDescription ||
      article.excerpt ||
      stripHtml(article.contentHtml).slice(0, 180);
    const image =
      resolveSeoArticleImageUrl(article.coverImageUrl) || defaultImage;

    document.documentElement.lang = "vi";
    document.title = title;

    upsertMetaByName("description", description);
    upsertMetaByName("robots", "index,follow");
    upsertMetaByName("twitter:card", "summary_large_image");
    upsertMetaByName("twitter:title", title);
    upsertMetaByName("twitter:description", description);
    upsertMetaByName("twitter:image", image);

    upsertMetaByProperty("og:type", "article");
    upsertMetaByProperty("og:locale", "vi_VN");
    upsertMetaByProperty("og:site_name", "T&N Company");
    upsertMetaByProperty("og:title", title);
    upsertMetaByProperty("og:description", description);
    upsertMetaByProperty("og:url", canonical);
    upsertMetaByProperty("og:image", image);

    upsertLink("canonical", canonical);
    upsertStructuredData({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description,
      datePublished: article.publishedAt || article.createdAt,
      dateModified: article.updatedAt,
      mainEntityOfPage: canonical,
      image: [image],
      author: {
        "@type": "Organization",
        name: "T&N Company",
      },
      publisher: {
        "@type": "Organization",
        name: "T&N Company",
        logo: {
          "@type": "ImageObject",
          url: `${window.location.origin}/favicon.svg`,
        },
      },
    });
  }, [article, previewMode]);

  if (loading) {
    return (
      <div className="app-shell theme-home">
        <AppHeader activePageId="news" onNavigate={() => {}} pages={navPages} />
        <main
          className="page-content"
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "4rem 0",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          Đang tải bài viết...
        </main>
        <AppFooter pageId="news" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="app-shell theme-home">
        <AppHeader activePageId="news" onNavigate={() => {}} pages={navPages} />
        <main
          className="page-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "4rem 0",
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <h1>Không tìm thấy bài viết</h1>
          <button
            onClick={() => navigate("/tin-tuc")}
            style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
          >
            Quay lại Kho nội dung
          </button>
        </main>
        <AppFooter pageId="news" />
      </div>
    );
  }

  const contentBlocks = getSeoArticleDisplayBlocks(
    article.contentJson,
    article.contentHtml,
    article.excerpt || "Đang cập nhật nội dung...",
  );
  const shareUrl = buildArticleShareUrl(article.slug);
  const facebookShareUrl = buildFacebookShareUrl(shareUrl);
  const zaloShareUrl = buildZaloShareUrl(shareUrl);

  const handleCopyShareLink = async () => {
    try {
      await copyText(shareUrl);
      setShareNotice("Đã sao chép liên kết bài viết.");
    } catch {
      setShareNotice(
        "Không thể sao chép tự động. Vui lòng chép thủ công từ thanh địa chỉ.",
      );
    }
  };

  return (
    <div
      className={
        previewMode
          ? "min-h-full overflow-x-hidden bg-white"
          : "overflow-x-hidden"
      }
      data-preview-mode={previewMode ? "true" : undefined}
      onClickCapture={
        previewMode
          ? (event) => {
              const target = event.target as HTMLElement;
              if (target.closest("a, button")) {
                event.preventDefault();
                event.stopPropagation();
              }
            }
          : undefined
      }
    >
      <AppHeader
        activePageId="news"
        onNavigate={(id) => {
          const page = navPages.find((p) => p.id === id);
          if (page) navigate(page.hash);
        }}
        pages={navPages}
      />

      <main
        className="page-content"
        style={{
          paddingTop: "2rem",
          paddingBottom: "4rem",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <article
          className="editorial-page font-inter max-w-[full] mx-auto"
          style={{
            background: "transparent",
            boxShadow: "none",
            padding: 0,
            margin: "0 auto",
          }}
        >
          <nav
            className="editorial-breadcrumb font-inter mb-2 flex w-full ml-20"
            aria-label="Điều hướng trang"
          >
            <Link to="/">Home</Link>
            <span aria-hidden="true">›</span>
            <Link to="/tin-tuc">Tin tức</Link>
            <span aria-hidden="true">›</span>
            <span>{getStoreLabel(article.targetStore)}</span>
          </nav>

          <header className="editorial-header">
            <p className="editorial-category-pill font-inter">
              {getStoreLabel(article.targetStore)}
            </p>
            <h1 className="font-inter !leading-[1.2]">{article.title}</h1>
            <div className="editorial-meta text-lg font-nunito font-semibold mt-10">
              <span>By Đội ngũ Ông Quan</span>
              <span aria-hidden="true">•</span>
              <span>
                {formatDateLong(article.publishedAt || article.createdAt)}
              </span>
              <span aria-hidden="true">•</span>
              <span>{getReadTime(article)}</span>
            </div>
            <div
              className="font-inter mx-auto mt-6 flex w-fit flex-col items-center gap-3 bg-transparent p-0"
              aria-label="Chia sẻ bài viết"
            >
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        cx="18"
                        cy="5"
                        r="2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <circle
                        cx="6"
                        cy="12"
                        r="2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <circle
                        cx="18"
                        cy="19"
                        r="2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="m8.2 10.8 7.5-4.3M8.2 13.2l7.5 4.3"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </div>

                  <span className="font-nunito whitespace-nowrap text-lg font-semibold text-slate-700">
                    Chia sẻ:
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => openShareWindow(facebookShareUrl)}
                    aria-label="Chia sẻ bài viết lên Facebook"
                    title="Chia sẻ lên Facebook"
                    className="group flex h-12 min-w-[92px] items-center justify-center rounded-full bg-white px-5 text-[#1877F2] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:bg-blue-50 hover:shadow-[0_10px_25px_rgba(24,119,242,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    <svg
                      className="h-7 w-7 transition-transform duration-300 group-hover:scale-110"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M13.5 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4H16V5.3c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.2V11H9v2.8h2.4V21h2.1Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => openShareWindow(zaloShareUrl)}
                    aria-label="Chia sẻ bài viết lên Zalo"
                    title="Chia sẻ lên Zalo"
                    className="group flex h-12 min-w-[112px] items-center justify-center rounded-full bg-white px-6 text-[#0068FF] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#0068FF]/50 hover:bg-blue-50 hover:shadow-[0_10px_25px_rgba(0,104,255,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    <span className="text-lg font-bold transition-transform duration-300 group-hover:scale-105">
                      Zalo
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    aria-label="Sao chép liên kết bài viết"
                    title="Sao chép liên kết"
                    className="group flex h-12 min-w-[92px] items-center justify-center rounded-full  bg-white px-5 text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-[0_10px_25px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    <svg
                      className="h-6 w-6 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M10.6 13.4a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 1 0-4.2-4.2l-.7.7"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M13.4 10.6a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 1 0 4.2 4.2l.7-.7"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <span
                className={`font-nunito text-center text-sm font-medium transition-colors duration-300 ${
                  shareNotice ? "text-emerald-800" : "text-slate-400"
                }`}
                role="status"
                aria-live="polite"
              >
                {shareNotice ||
                  "Chọn nền tảng để chia sẻ hoặc sao chép liên kết bài viết."}
              </span>
            </div>
          </header>

          <div className="editorial-media editorial-hero-media w-[80%] mx-auto my-10">
            <img
              src={
                resolveSeoArticleImageUrl(article.coverImageUrl) || defaultImage
              }
              alt={article.title}
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultImage;
              }}
            />
          </div>

          <div className="editorial-content-rail px-4 sm:px-6">
            <div className="editorial-story-copy seo-article-blocks font-inter">
              {contentBlocks.map((block) => (
                <section className="min-w-0" key={block.id}>
                  {block.heading ? (
                    <h2 className="mb-5 w-max max-w-none whitespace-nowrap font-['Bricolage_Grotesque','Be_Vietnam_Pro',sans-serif] text-[clamp(1.65rem,3vw,2.45rem)] font-bold leading-[1.16] text-[#191613]">
                      {block.heading}
                    </h2>
                  ) : null}

                  {block.html ? (
                    <div
                      className="max-w-[70ch] text-[clamp(1rem,1.2vw,1.08rem)] leading-[1.82] text-[#403832] [&_a]:font-semibold [&_a]:text-[#205b38] [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-[0.18em] [&_blockquote]:my-7 [&_blockquote]:rounded-lg [&_blockquote]:bg-[#f5f3f0] [&_blockquote]:px-[1.4rem] [&_blockquote]:py-5 [&_blockquote]:text-[1.08em] [&_blockquote]:font-semibold [&_blockquote]:text-[#2c251f] [&_blockquote_p]:m-0 [&_h2]:mb-[0.85rem] [&_h2]:mt-8 [&_h2]:font-['Bricolage_Grotesque','Be_Vietnam_Pro',sans-serif] [&_h2]:text-[clamp(1.45rem,2.5vw,2rem)] [&_h2]:leading-[1.22] [&_h2]:text-[#191613] [&_h3]:mb-[0.85rem] [&_h3]:mt-8 [&_h3]:font-['Bricolage_Grotesque','Be_Vietnam_Pro',sans-serif] [&_h3]:text-[clamp(1.2rem,2vw,1.55rem)] [&_h3]:leading-[1.22] [&_h3]:text-[#191613] [&_li]:mb-[0.55rem] [&_li]:pl-[0.2rem] [&_ol]:mb-6 [&_ol]:mt-4 [&_ol]:pl-[1.4rem] [&_p:last-child]:mb-0 [&_p]:mb-5 [&_p]:mt-0 [&_ul]:mb-6 [&_ul]:mt-4 [&_ul]:pl-[1.4rem]"
                      dangerouslySetInnerHTML={{ __html: block.html }}
                    />
                  ) : null}

                  {block.imageUrl ? (
                    <figure className="mb-0 mt-7">
                      <img
                        className="block h-auto max-h-[760px] w-full rounded-xl object-contain outline outline-1 -outline-offset-1 outline-black/10"
                        src={
                          resolveSeoArticleImageUrl(block.imageUrl) ||
                          defaultImage
                        }
                        alt={
                          block.imageAlt ||
                          block.heading ||
                          "Ảnh minh họa bài viết"
                        }
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = defaultImage;
                        }}
                      />

                      {block.imageAlt ? (
                        <figcaption className="mt-[0.7rem] text-center text-[0.82rem] leading-[1.55] text-[#75695f]">
                          {block.imageAlt}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}
                </section>
              ))}
            </div>

            <aside className="editorial-side-card font-inter bg-[#EAE4DE]">
              <p className="editorial-side-card-title font-inter font-bold">
                Trải nghiệm ngay
              </p>
              <p className="py-1">
                Khám phá không gian yên bình và thưởng thức những ly cà phê
                tuyệt hảo tại {getStoreLabel(article.targetStore)} Ông Quan.
              </p>
              <div className="editorial-side-card-cta">
                <a href="tel:0772770789" className="editorial-side-card-button">
                  Đặt bàn ngay
                </a>
              </div>
            </aside>
          </div>

          {relatedArticles.length > 0 && (
            <RevealOnScroll direction="up" duration={1200}>
              <section className="editorial-related mx-2 mt-6 font-inter md:m-20">
                <RevealOnScroll direction="up" duration={1200}>
                  <div className="editorial-related-head">
                    <h2 className="font-inter">Có thể bạn quan tâm</h2>
                  </div>
                </RevealOnScroll>

                <div className="editorial-related-grid">
                  {relatedArticles.map((item, index) => (
                    <RevealOnScroll
                      key={item.id}
                      direction="up"
                      delay={120 + index * 120}
                      duration={750}
                      className="h-full"
                    >
                      <Link
                        to={`/tin-tuc/${item.slug}`}
                        style={{ textDecoration: "none" }}
                        className="editorial-related-card group block h-full cursor-pointer transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(15,23,42,0.16)]"
                      >
                        <div className="editorial-media editorial-related-media overflow-hidden">
                          <img
                            src={
                              resolveSeoArticleImageUrl(item.coverImageUrl) ||
                              defaultImage
                            }
                            alt={item.title}
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.src = defaultImage;
                            }}
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                        </div>

                        <div className="editorial-related-copy font-inter">
                          <p className="font-inter transition-colors duration-300 group-hover:text-[#8B5E3C]">
                            {getStoreLabel(item.targetStore)}
                          </p>

                          <h3 className="font-inter transition-colors duration-300 group-hover:text-[#8B5E3C]">
                            {item.title}
                          </h3>

                          <span className="font-nunito transition-colors duration-300">
                            {item.excerpt || item.metaDescription}
                          </span>
                        </div>
                      </Link>
                    </RevealOnScroll>
                  ))}
                </div>
              </section>
            </RevealOnScroll>
          )}
        </article>
      </main>

      <AppFooter pageId="news" />
    </div>
  );
}
