import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppFooter from "../../components/AppFooter";
import AppHeader from "../../components/AppHeader";
import { navPages } from "../../data/siteData";
import { getSeoArticles, SeoArticle } from "../../services/seoArticleService";
import defaultImage from "../../optimized-media/cafe/cafe-hero.jpg";
import { resolveSeoArticleImageUrl } from "../../components/seo/seoArticleAssets";
import { Pagination } from "@/components/ui/Pagination";

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
  const textLength =
    (article.contentHtml || "").length + (article.excerpt || "").length;
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
    filter === "all"
      ? articles
      : articles.filter((a) => a.targetStore === filter);

  const featuredArticle =
    filteredArticles.length > 0 ? filteredArticles[0] : null;
  const allGridArticles = filteredArticles.slice(1);
  const totalPages = Math.max(
    1,
    Math.ceil(allGridArticles.length / GRID_ITEMS_PER_PAGE),
  );
  const gridArticles = allGridArticles.slice(
    (currentPage - 1) * GRID_ITEMS_PER_PAGE,
    currentPage * GRID_ITEMS_PER_PAGE,
  );

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
        <div
          className="news-page"
          style={{ paddingTop: "2rem", paddingBottom: "4rem" }}
        >
          <div className="news-page-intro">
            <h1>Tin tức &amp; bài viết mới nhất</h1>
            <p className="news-page-summary my-5 max-w-[100%]">
              Khám phá những câu chuyện về hành trình phát triển bền vững, tinh
              hoa ẩm thực từ nông trại đến bàn ăn, và những góc nhìn sâu sắc về
              phong cách sống cân bằng.
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
            <div
              style={{
                textAlign: "center",
                padding: "4rem 0",
                color: "var(--news-muted)",
              }}
            >
              Đang tải bài viết...
            </div>
          ) : filteredArticles.length > 0 ? (
            <>
              {featuredArticle && currentPage === 1 && (
                <Link
                  to={`/tin-tuc/${featuredArticle.slug}`}
                  className="news-featured-card group transform-gpu overflow-hidden transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(50,35,25,0.16)] focus-visible:-translate-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6A43]/40"
                  style={{ textDecoration: "none" }}
                >
                  <div className="news-featured-media overflow-hidden font-inter">
                    <img
                      src={
                        resolveSeoArticleImageUrl(
                          featuredArticle.coverImageUrl,
                        ) || defaultImage
                      }
                      alt={featuredArticle.title}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] group-focus-visible:scale-[1.035]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = defaultImage;
                      }}
                    />
                  </div>

                  <div className="news-featured-copy">
                    <div className="news-featured-badge font-inter">
                      Tin nổi bật
                    </div>

                    <h2 className="font-inter transition-colors duration-300 group-hover:text-[#9B6A43]">
                      {featuredArticle.title}
                    </h2>

                    <p className="font-inter">
                      {featuredArticle.excerpt ||
                        featuredArticle.metaDescription}
                    </p>

                    <div className="news-meta">
                      <span>
                        {formatDateLong(
                          featuredArticle.publishedAt ||
                            featuredArticle.createdAt,
                        )}
                      </span>
                      <span>•</span>
                      <span>{getReadTime(featuredArticle)}</span>
                    </div>
                  </div>
                </Link>
              )}

              {gridArticles.length > 0 && (
                <div className="news-grid">
                  {gridArticles.map((article) => (
                    <Link
                      to={`/tin-tuc/${article.slug}`}
                      key={article.id}
                      className="news-card group transform-gpu overflow-hidden transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_16px_35px_rgba(50,35,25,0.14)] focus-visible:-translate-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6A43]/40"
                      style={{ textDecoration: "none" }}
                    >
                      <div className="news-card-media overflow-hidden">
                        <img
                          src={
                            resolveSeoArticleImageUrl(article.coverImageUrl) ||
                            defaultImage
                          }
                          alt={article.title}
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 group-focus-visible:scale-105"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = defaultImage;
                          }}
                        />
                      </div>

                      <div className="news-card-copy">
                        <div className="news-card-meta">
                          <span>{getStoreLabel(article.targetStore)}</span>
                          <span>
                            {formatDateShort(
                              article.publishedAt || article.createdAt,
                            )}
                          </span>
                        </div>

                        <h3 className="transition-colors duration-300 group-hover:text-[#9B6A43]">
                          {article.title}
                        </h3>

                        <p>{article.excerpt || article.metaDescription}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {totalPages > 0 ? (
                <Pagination
                  currentPage={currentPage}
                  totalItems={allGridArticles.length}
                  pageSize={GRID_ITEMS_PER_PAGE}
                  onPageChange={(nextPage) => {
                    setCurrentPage(nextPage);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="mt-4 rounded-xl border border-slate-200"
                />
              ) : null}
            </>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "4rem 0",
                color: "var(--news-muted)",
              }}
            >
              Chưa có bài viết nào.
            </div>
          )}
        </div>
      </main>

      <AppFooter pageId="news" />
    </div>
  );
}
