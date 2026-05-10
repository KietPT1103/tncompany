import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

function formatDateShort(dateString: string | null) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day} Thg ${month}`;
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

export default function ArticlesIndexPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<SeoArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const GRID_ITEMS_PER_PAGE = 9;

  useEffect(() => {
    getSeoArticles("", "published")
      .then((data) => {
        setArticles(data || []);
      })
      .catch(() => {
        setArticles([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const filteredArticles =
    filter === "all" ? articles : articles.filter((a) => a.targetStore === filter);

  const featuredArticle = filteredArticles.length > 0 ? filteredArticles[0] : null;
  const allGridArticles = filteredArticles.slice(1);
  const totalPages = Math.max(1, Math.ceil(allGridArticles.length / GRID_ITEMS_PER_PAGE));
  const gridArticles = allGridArticles.slice((currentPage - 1) * GRID_ITEMS_PER_PAGE, currentPage * GRID_ITEMS_PER_PAGE);

  function getPaginationItems(current: number, total: number) {
    const items: (number | string)[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) items.push(i);
    } else {
      if (current <= 3) {
        items.push(1, 2, 3, 4, '...', total);
      } else if (current >= total - 2) {
        items.push(1, '...', total - 3, total - 2, total - 1, total);
      } else {
        items.push(1, '...', current - 1, current, current + 1, '...', total);
      }
    }
    return items;
  }

  return (
    <div className="">
      <AppHeader
        activePageId="news"
        onNavigate={(id) => {
          const page = navPages.find((p) => p.id === id);
          if (page) navigate(page.hash);
        }}
        pages={navPages}
      />

      <main className="page-content">
        <div className="news-page" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
          <div className="news-page-intro">
            <h1>Tin tức &amp; bài viết mới nhất</h1>
            <p className="news-page-summary my-5 max-w-[100%]">
              Khám phá những câu chuyện về hành trình phát triển bền vững, tinh hoa ẩm thực từ nông trại đến bàn ăn, và những góc nhìn sâu sắc về phong cách sống cân bằng.
            </p>
          </div>

          <div className="news-filter-bar">
            <button
              className={`news-filter-chip ${filter === "all" ? "is-active" : ""}`}
              onClick={() => handleFilterChange("all")}
            >
              All
            </button>
            <button
              className={`news-filter-chip ${filter === "cafe" ? "is-active" : ""}`}
              onClick={() => handleFilterChange("cafe")}
            >
              Cà phê
            </button>
            <button
              className={`news-filter-chip ${filter === "hotpot" ? "is-active" : ""}`}
              onClick={() => handleFilterChange("hotpot")}
            >
              Tiệm lẩu
            </button>
            <button
              className={`news-filter-chip ${filter === "farm" ? "is-active" : ""}`}
              onClick={() => handleFilterChange("farm")}
            >
              Farm
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--news-muted)" }}>
              Đang tải bài viết...
            </div>
          ) : filteredArticles.length > 0 ? (
            <>
              {featuredArticle && currentPage === 1 && (
                <Link to={`/tin-tuc/${featuredArticle.slug}`} className="news-featured-card" style={{ textDecoration: 'none' }}>
                  <div className="news-featured-media font-inter">
                    <img 
                      src={featuredArticle.coverImageUrl || defaultImage} 
                      alt={featuredArticle.title} 
                      onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
                    />
                  </div>
                  <div className="news-featured-copy">
                    <div className="news-featured-badge font-inter">Tin nổi bật</div>
                    <h2 className="font-inter">{featuredArticle.title}</h2>
                    <p className="font-inter">{featuredArticle.excerpt || featuredArticle.metaDescription}</p>
                    <div className="news-meta">
                      <span>{formatDateLong(featuredArticle.publishedAt || featuredArticle.createdAt)}</span>
                      <span>•</span>
                      <span>{getReadTime(featuredArticle)}</span>
                    </div>
                  </div>
                </Link>
              )}

              {gridArticles.length > 0 && (
                <div className="news-grid">
                  {gridArticles.map((article) => (
                    <Link to={`/tin-tuc/${article.slug}`} key={article.id} className="news-card" style={{ textDecoration: 'none' }}>
                      <div className="news-card-media">
                        <img 
                          src={article.coverImageUrl || defaultImage} 
                          alt={article.title} 
                          onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
                        />
                      </div>
                      <div className="news-card-copy">
                        <div className="news-card-meta">
                          <span>{getStoreLabel(article.targetStore)}</span>
                          <span>{formatDateShort(article.publishedAt || article.createdAt)}</span>
                        </div>
                        <h3>{article.title}</h3>
                        <p>{article.excerpt || article.metaDescription}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {totalPages > 0 && (
                <div className="news-pagination" style={{ marginTop: "1rem" }}>
                  {getPaginationItems(currentPage, totalPages).map((item, index) => (
                    item === '...' ? (
                      <span key={`ellipsis-${index}`} className="news-page-ellipsis">...</span>
                    ) : (
                      <button 
                        key={`page-${item}`} 
                        className={`news-page-button ${currentPage === item ? "is-active" : ""}`}
                        onClick={() => {
                          setCurrentPage(item as number);
                          window.scrollTo(0, 0);
                        }}
                      >
                        {item}
                      </button>
                    )
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--news-muted)" }}>
              Chưa có bài viết nào.
            </div>
          )}
        </div>
      </main>

      <AppFooter pageId="news" />
    </div>
  );
}
