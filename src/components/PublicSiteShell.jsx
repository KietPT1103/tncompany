import React from "react";
import { navPages, pagesById, routeByHash, venuesById } from "../data/siteData";
import AppFooter from "./AppFooter";
import AppHeader from "./AppHeader";
import CompanyHome from "./CompanyHome";
import VenuePage from "./VenuePage";

export function resolvePublicPageState(pathname) {
  const normalizedPath = routeByHash[pathname] ? pathname : "/";
  const activePageId = routeByHash[normalizedPath] || "home";
  const activePage = pagesById[activePageId] || pagesById.home;
  const activeVenue = venuesById[activePageId] || null;

  return {
    activePage,
    activeVenue,
    isHome: activePage.id === "home",
  };
}

export default function PublicSiteShell({
  pathname,
  heroImageFailed = false,
  onHeroImageError,
  onNavigate,
  onOpenImage,
}) {
  const { activePage, activeVenue, isHome } = resolvePublicPageState(pathname);

  return (
    <div className={`app-shell ${isHome ? "theme-home" : `theme-${activeVenue.id}`}`}>
      <div className="ambient ambient-1" aria-hidden="true" />
      <div className="ambient ambient-2" aria-hidden="true" />
      <div className="ambient ambient-3" aria-hidden="true" />

      <AppHeader activePageId={activePage.id} onNavigate={onNavigate} pages={navPages} />

      <main className="page-content">
        {isHome ? (
          <CompanyHome onOpenPage={onNavigate} />
        ) : (
          <VenuePage
            activeVenue={activeVenue}
            heroImageFailed={heroImageFailed}
            onHeroImageError={onHeroImageError}
            onOpenImage={onOpenImage}
            onOpenPage={onNavigate}
          />
        )}
      </main>

      <AppFooter isHome={isHome} />
    </div>
  );
}
