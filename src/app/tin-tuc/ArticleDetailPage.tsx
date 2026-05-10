import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { navPages } from "../../data/siteData";
import { getSeoArticles, SeoArticle } from "../../services/seoArticleService";
import defaultImage from "../../optimized-media/cafe/cafe-hero.jpg";

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

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<SeoArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<SeoArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [slug]);

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

  // Parse HTML content to paragraphs
  const contentText = stripHtml(article.contentHtml);
  // Split into paragraphs roughly based on line breaks or just use excerpt if content is too simple
  let paragraphs = contentText.split('\n').filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) {
    paragraphs = [article.excerpt || "Đang cập nhật nội dung..."];
  }

  // Split paragraphs to create a quote somewhere in the middle
  const middleIndex = Math.max(1, Math.floor(paragraphs.length / 2));
  const leadParagraphs = paragraphs.slice(0, middleIndex);
  const quote = article.metaDescription || "Không gian tại đây mang lại cảm giác bình yên đến lạ, một sự kết hợp hoàn hảo giữa kiến trúc hiện đại và hơi thở thiên nhiên.";
  const trailingParagraphs = paragraphs.slice(middleIndex);

  // Extract a secondary image from content blocks if available
  const secondaryImage = article.contentJson?.find(b => b.imageUrl)?.imageUrl || defaultImage;

  return (
    <div className="overflow-x-hidden">
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
            <div className="editorial-meta font-inter mt-10">
              <span>By Đội ngũ Ông Quan</span>
              <span aria-hidden="true">•</span>
              <span>{formatDateLong(article.publishedAt || article.createdAt)}</span>
              <span aria-hidden="true">•</span>
              <span>{getReadTime(article)}</span>
            </div>
          </header>

          <div className="editorial-media editorial-hero-media w-[90%] mx-auto my-10">
            <img
              src={article.coverImageUrl || defaultImage}
              alt={article.title}
              onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
            />
          </div>

          <div className="editorial-content-rail">
            <section className="editorial-body-grid">
              <div className="editorial-story-copy font-inter">
                {leadParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}

                <blockquote className="editorial-quote">
                  <p>"{quote}"</p>
                </blockquote>

                {trailingParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              <aside className="editorial-side-card font-inter bg-[#EAE4DE]  ">
                <p className="editorial-side-card-title font-inter font-bold">Trải nghiệm ngay</p>
                <p className="py-1">Khám phá không gian yên bình và thưởng thức những ly cà phê tuyệt hảo tại {getStoreLabel(article.targetStore)} Ông Quan.</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <a
                    href="tel:0772770789"
                    style={{ textDecoration: 'none' }}
                  >
                    Đặt bàn ngay
                  </a>
                </div>
              </aside>
            </section>

            <div className="editorial-media editorial-secondary-media">
              <img
                src={secondaryImage}
                alt="Trải nghiệm"
                onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
              />
              <span className="editorial-media-play" aria-hidden="true">▶</span>
            </div>
          </div>

          {relatedArticles.length > 0 && (
            <section className="editorial-related font-inter m-20">
              <div className="editorial-related-head">
                <h2 className="font-inter">Có thể bạn quan tâm</h2>
              </div>

              <div className="editorial-related-grid">
                {relatedArticles.map((item) => (
                  <Link to={`/tin-tuc/${item.slug}`} className="editorial-related-card" key={item.id} style={{ textDecoration: 'none' }}>
                    <div className="editorial-media editorial-related-media">
                      <img
                        src={item.coverImageUrl || defaultImage}
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
