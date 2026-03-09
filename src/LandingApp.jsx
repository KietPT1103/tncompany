import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import AppFooter from "./components/AppFooter";
import AppHeader from "./components/AppHeader";
import CompanyHome from "./components/CompanyHome";
import Lightbox from "./components/Lightbox";
import VenuePage from "./components/VenuePage";
import { pages, pagesById, routeByHash, venuesById } from "./data/siteData";
import { normalizeRoute } from "./utils/navigation";

export default function LandingApp() {
  const [activePageId, setActivePageId] = useState(() =>
    normalizeRoute(window.location.hash)
  );
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    const syncFromHash = () => {
      setActivePageId(normalizeRoute(window.location.hash));
    };

    if (!routeByHash[window.location.hash]) {
      window.history.replaceState({}, "", "#/home");
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    if (!lightboxImage) {
      return undefined;
    }

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    };

    window.addEventListener("keydown", onEscape);

    return () => window.removeEventListener("keydown", onEscape);
  }, [lightboxImage]);

  const activeVenue = useMemo(() => venuesById[activePageId] || null, [activePageId]);
  const activePage = useMemo(() => pagesById[activePageId] || pagesById.home, [activePageId]);
  const isHome = activePage.id === "home";

  useEffect(() => {
    if (activeVenue) {
      setHeroImageFailed(false);
    }
  }, [activeVenue]);

  const jumpToPage = (pageId) => {
    const targetPage = pagesById[pageId];

    if (!targetPage) {
      return;
    }

    if (window.location.hash !== targetPage.hash) {
      window.location.hash = targetPage.hash;
    }
  };

  return (
    <div className={`app-shell ${isHome ? "theme-home" : `theme-${activeVenue.id}`}`}>
      <div className="ambient ambient-1" aria-hidden="true" />
      <div className="ambient ambient-2" aria-hidden="true" />
      <div className="ambient ambient-3" aria-hidden="true" />

      <AppHeader activePageId={activePage.id} onNavigate={jumpToPage} pages={pages} />

      <main className="page-content">
        {isHome ? (
          <CompanyHome onOpenPage={jumpToPage} />
        ) : (
          <VenuePage
            activeVenue={activeVenue}
            heroImageFailed={heroImageFailed}
            onHeroImageError={() => setHeroImageFailed(true)}
            onOpenImage={setLightboxImage}
            onOpenPage={jumpToPage}
          />
        )}
      </main>

      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />

      <AppFooter isHome={isHome} />
    </div>
  );
}
