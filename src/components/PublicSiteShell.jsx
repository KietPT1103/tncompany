import { navPages, pagesById, routeByHash, venuesById } from "../data/siteData";
import AppFooter from "./AppFooter";
import AppHeader from "./AppHeader";
import CompanyHome from "./CompanyHome";
import HomePage from "./HomePage";
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
    isAbout: activePage.id === "about",
  };
}

export default function PublicSiteShell({
  pathname,
  heroImageFailed = false,
  onHeroImageError,
  onNavigate,
  onOpenImage,
}) {
  const { activePage, activeVenue, isHome, isAbout } = resolvePublicPageState(pathname);
  const themeClass = activeVenue ? `theme-${activeVenue.id}` : "theme-home";
  const isVenuePage = Boolean(activeVenue);
  return (
    <div className={`app-shell ${themeClass}${isVenuePage ? " is-editorial-shell" : ""}`}>
      {!isVenuePage ? <div className="ambient ambient-1" aria-hidden="true" /> : null}
      {!isVenuePage ? <div className="ambient ambient-2" aria-hidden="true" /> : null}
      {!isVenuePage ? <div className="ambient ambient-3" aria-hidden="true" /> : null}

      <AppHeader activePageId={activePage.id} onNavigate={onNavigate} pages={navPages} />

      <main className={`page-content${isHome ? " is-home" : ""}${isVenuePage ? " is-editorial" : ""}`}>
        {isHome ? (
          <HomePage onOpenPage={onNavigate} />
        ) : isAbout ? (
          <CompanyHome onOpenPage={onNavigate} />
        ) : isVenuePage ? (
          <VenuePage
            key={activeVenue.id}
            activeVenue={activeVenue}
            heroImageFailed={heroImageFailed}
            onHeroImageError={onHeroImageError}
            onOpenImage={onOpenImage}
            onOpenPage={onNavigate}
          />
        ) : null}
      </main>

      <AppFooter pageId={activePage.id} />
    </div>
  );
}
