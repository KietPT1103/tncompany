import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { navPages } from "../../data/siteData";
import { getSeoArticles, SeoArticle } from "../../services/seoArticleService";
import defaultImage from "../../optimized-media/cafe/cafe-hero.jpg";
import { resolveSeoArticleImageUrl } from "../../components/seo/seoArticleAssets";
import { getSeoArticleDisplayBlocks } from "../../features/seoArticles/articleDisplayBlocks";
import { ShimmerButton } from "@/components/ui/shimmer-button";

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
  const textLength = (article.contentHtml || "").length + (article.excerpt || "").length;
  const minutes = Math.max(1, Math.ceil(textLength / 1500));
  return `${minutes} phút đọc`;
}

function stripHtml(html: string) {
  if (!html) return "";
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},noopener,noreferrer`
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
      article.metaDescription || article.excerpt || stripHtml(article.contentHtml).slice(0, 180);
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
        <AppHeader activePageId="news" onNavigate={() => { }} pages={navPages} />
        <main className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', width: '100%', maxWidth: '100%' }}>
          Đang tải bài viết...
        </main>
        <AppFooter pageId="news" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="app-shell theme-home">
        <AppHeader activePageId="news" onNavigate={() => { }} pages={navPages} />
        <main className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', width: '100%', maxWidth: '100%' }}>
          <h1>Không tìm thấy bài viết</h1>
          <button onClick={() => navigate("/tin-tuc")} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Quay lại Kho nội dung</button>
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
      setShareNotice("Không thể sao chép tự động. Vui lòng chép thủ công từ thanh địa chỉ.");
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

      <main className="page-content" style={{ paddingTop: "2rem", paddingBottom: "4rem", width: "100%", maxWidth: "100%" }}>
        <article className="editorial-page font-inter max-w-[full] mx-auto" style={{ background: 'transparent', boxShadow: 'none', padding: 0, margin: '0 auto' }}>
          
          <nav className="editorial-breadcrumb font-inter mb-2 flex w-full ml-20" aria-label="Điều hướng trang">
            <Link to="/">Home</Link>
            <span aria-hidden="true">›</span>
            <Link to="/tin-tuc">Tin tức</Link>
            <span aria-hidden="true">›</span>
            <span>{getStoreLabel(article.targetStore)}</span>
          </nav>

          <header className="editorial-header">
            <p className="editorial-category-pill font-inter">{getStoreLabel(article.targetStore)}</p>
            <h1 className="font-inter">{article.title}</h1>
            <div className="editorial-meta font-cormorant text-xl font-bold mt-10">
              <span>By Đội ngũ Ông Quan</span>
              <span aria-hidden="true">•</span>
              <span>{formatDateLong(article.publishedAt || article.createdAt)}</span>
              <span aria-hidden="true">•</span>
              <span>{getReadTime(article)}</span>
            </div>
            <div className="editorial-share-bar font-inter" aria-label="Chia sẻ bài viết">
              <span className="editorial-share-label font-cormorant text-2xl font-semibold">Chia sẻ:</span>
              <div className="editorial-share-actions">
                <button
                  type="button"
                  className="editorial-share-button is-facebook"
                  onClick={() => openShareWindow(facebookShareUrl)}
                  aria-label="Chia sẻ bài viết lên Facebook"
                  title="Chia sẻ lên Facebook"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M13.5 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4H16V5.3c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.2V11H9v2.8h2.4V21h2.1Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="editorial-share-button is-zalo"
                  onClick={() => openShareWindow(zaloShareUrl)}
                  aria-label="Chia sẻ bài viết lên Zalo"
                  title="Chia sẻ lên Zalo"
                >
                  <span>Zalo</span>
                </button>
                <button
                  type="button"
                  className="editorial-share-button is-copy"
                  onClick={handleCopyShareLink}
                  aria-label="Sao chép liên kết bài viết"
                  title="Sao chép liên kết"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
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
              <span className="editorial-share-hint font-cormorant text-xl font-bold" role="status" aria-live="polite">
                {shareNotice || "Mở trực tiếp hộp chia sẻ bằng link public của bài viết."}
              </span>
            </div>
          </header>

          <div className="editorial-media editorial-hero-media w-[90%] mx-auto my-10">
            <img
              src={resolveSeoArticleImageUrl(article.coverImageUrl) || defaultImage}
              alt={article.title}
              onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
            />
          </div>

          <div className="editorial-content-rail px-4 sm:px-6">
            <div className="editorial-story-copy seo-article-blocks font-inter">
              {contentBlocks.map((block) => (
                <section className="seo-article-content-block" key={block.id}>
                  {block.heading ? <h2>{block.heading}</h2> : null}

                  {block.html ? (
                    <div
                      className="seo-article-block-copy"
                      dangerouslySetInnerHTML={{ __html: block.html }}
                    />
                  ) : null}

                  {block.imageUrl ? (
                    <figure className="seo-article-block-media">
                      <img
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
                        <figcaption>{block.imageAlt}</figcaption>
                      ) : null}
                    </figure>
                  ) : null}
                </section>
              ))}
            </div>

            <aside className="editorial-side-card font-inter bg-[#EAE4DE]">
              <p className="editorial-side-card-title font-inter font-bold">Trải nghiệm ngay</p>
              <p className="py-1">Khám phá không gian yên bình và thưởng thức những ly cà phê tuyệt hảo tại {getStoreLabel(article.targetStore)} Ông Quan.</p>
              <div className="editorial-side-card-cta">
                <a
                  href="tel:0772770789"
                  className="editorial-side-card-button"
                >
                  Đặt bàn ngay
                </a>
              </div>
            </aside>
          </div>

          {relatedArticles.length > 0 && (
            <section className="editorial-related font-inter mt-6 mx-2 md:m-20">
              <div className="editorial-related-head">
                <h2 className="font-inter">Có thể bạn quan tâm</h2>
              </div>

              <div className="editorial-related-grid">
                {relatedArticles.map((item) => (
                  <Link to={`/tin-tuc/${item.slug}`} className="editorial-related-card" key={item.id} style={{ textDecoration: 'none' }}>
                    <div className="editorial-media editorial-related-media">
                      <img
                        src={resolveSeoArticleImageUrl(item.coverImageUrl) || defaultImage}
                        alt={item.title}
                        onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
                      />
                    </div>
                    <div className="editorial-related-copy font-inter">
                      <p className="font-inter">{getStoreLabel(item.targetStore)}</p>
                      <h3 className="font-inter">{item.title}</h3>
                      <span className="font-inter">{item.excerpt || item.metaDescription}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>

      <AppFooter pageId="news" />
    </div>
  );
}
