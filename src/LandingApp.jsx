import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import Lightbox from "./components/Lightbox";
import PublicSiteShell from "./components/PublicSiteShell";
import { pagesById, routeByHash, venuesById } from "./data/siteData";
import { normalizePathname, normalizeRoute } from "./utils/navigation";

export default function LandingApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activePageId, setActivePageId] = useState(() =>
    normalizeRoute(location.pathname)
  );
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    const normalizedPath = normalizePathname(location.pathname);

    if (!routeByHash[normalizedPath]) {
      navigate("/", { replace: true });
      return;
    }

    setActivePageId(normalizeRoute(normalizedPath));
  }, [location.pathname, navigate]);

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

    if (location.pathname !== targetPage.hash) {
      navigate(targetPage.hash);
    }
  };

  return (
    <>
      <PublicSiteShell
        pathname={activePage.hash}
        heroImageFailed={heroImageFailed}
        onHeroImageError={() => setHeroImageFailed(true)}
        onNavigate={jumpToPage}
        onOpenImage={setLightboxImage}
      />
      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  );
}
