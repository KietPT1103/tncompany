import { useEffect, useState } from "react";
import { pagesById } from "../data/siteData";
import { venueEditorialContentById } from "../data/venueEditorialData";
import {
  getLatestVenueEditorialArticle,
  mapSeoArticleToVenueContent,
} from "../services/venueEditorialService";

function openInternalPage(onOpenPage, pageId, event) {
  if (!onOpenPage) {
    return;
  }

  event.preventDefault();
  onOpenPage(pageId);
}

function normalizePhoneLink(phoneValue) {
  return `tel:${String(phoneValue || "").replace(/[^\d+]/g, "")}`;
}

function EditorialMedia({
  src,
  fallbackSrc = "",
  alt,
  className,
  onOpenImage,
  playButton = false,
}) {
  const [activeSrc, setActiveSrc] = useState(src || fallbackSrc || "");

  useEffect(() => {
    setActiveSrc(src || fallbackSrc || "");
  }, [src, fallbackSrc]);

  const effectiveSrc = activeSrc;
  const canOpenImage = Boolean(effectiveSrc && onOpenImage);

  if (!effectiveSrc) {
    return (
      <div className={`${className} editorial-media editorial-media-placeholder`} aria-hidden="true">
        <span className="editorial-media-arrow is-left">‹</span>
        <span className="editorial-media-arrow is-right">›</span>
      </div>
    );
  }

  const content = (
    <>
      <img
        src={effectiveSrc}
        alt={alt}
        loading="lazy"
        onError={() => {
          if (effectiveSrc !== fallbackSrc && fallbackSrc) {
            setActiveSrc(fallbackSrc);
            return;
          }

          setActiveSrc("");
        }}
      />
      {playButton ? <span className="editorial-media-play" aria-hidden="true">▶</span> : null}
    </>
  );

  if (!canOpenImage) {
    return <div className={`${className} editorial-media`}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={`${className} editorial-media is-clickable`}
      onClick={() => onOpenImage({ src: effectiveSrc, alt, caption: alt })}
      aria-label={`Phóng to ảnh: ${alt}`}
    >
      {content}
    </button>
  );
}

function VenueBreadcrumb({ activeVenue, onOpenPage }) {
  return (
    <nav className="editorial-breadcrumb" aria-label="Điều hướng trang">
      <a
        href={pagesById.home.hash}
        onClick={(event) => openInternalPage(onOpenPage, "home", event)}
      >
        Trang chủ
      </a>
      <span aria-hidden="true">›</span>
      <span>{activeVenue.shortLabel}</span>
    </nav>
  );
}

function VenueHeader({ activeVenue, content }) {
  return (
    <header className="editorial-header">
      <p className="editorial-category-pill">{content.category || activeVenue.shortLabel}</p>
      <h1>{content.title}</h1>
      <div className="editorial-meta">
        <span>{content.author}</span>
        <span aria-hidden="true">•</span>
        <span>{content.displayDate}</span>
        <span aria-hidden="true">•</span>
        <span>{content.readTime}</span>
      </div>
    </header>
  );
}

function VenueBody({ activeVenue, content }) {
  return (
    <section className="editorial-body-grid">
      <div className="editorial-story-copy">
        {content.paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 48)}`}>{paragraph}</p>
        ))}

        <blockquote className="editorial-quote">
          <p>{content.quote}</p>
        </blockquote>

        <p>{content.closing}</p>
      </div>

      <aside className="editorial-side-card">
        <p className="editorial-side-card-title">{content.sideCard.title}</p>
        <p>{content.sideCard.description}</p>
        <a href={normalizePhoneLink(activeVenue.contact)}>{content.sideCard.buttonLabel}</a>
      </aside>
    </section>
  );
}

function VenueRelated({ items, fallbackItems = [] }) {
  return (
    <section className="editorial-related">
      <div className="editorial-related-head">
        <h2>Có thể bạn quan tâm</h2>
      </div>

      <div className="editorial-related-grid">
        {items.map((item, index) => (
          <article className="editorial-related-card" key={`${index}-${item.title}`}>
            <EditorialMedia
              src={item.image}
              fallbackSrc={fallbackItems[index]?.image || ""}
              alt={item.imageAlt || item.title}
              className="editorial-related-media"
            />
            <div className="editorial-related-copy">
              <p>{item.label}</p>
              <h3>{item.title}</h3>
              <span>{item.description}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function VenuePage({ activeVenue, onOpenImage, onOpenPage }) {
  const fallbackContent = venueEditorialContentById[activeVenue.id];
  const [remoteContent, setRemoteContent] = useState(null);

  useEffect(() => {
    let isDisposed = false;

    setRemoteContent(null);

    if (!activeVenue?.id || !fallbackContent) {
      return undefined;
    }

    async function loadVenueContent() {
      try {
        const article = await getLatestVenueEditorialArticle(activeVenue.id);
        if (isDisposed) {
          return;
        }

        setRemoteContent(
          article ? mapSeoArticleToVenueContent(article, fallbackContent, activeVenue) : null
        );
      } catch (error) {
        console.error("Failed to load venue editorial article", error);
        if (!isDisposed) {
          setRemoteContent(null);
        }
      }
    }

    void loadVenueContent();

    return () => {
      isDisposed = true;
    };
  }, [activeVenue, fallbackContent]);

  const content = remoteContent || fallbackContent;

  if (!content) {
    return null;
  }

  return (
    <article className="editorial-page">
      <VenueBreadcrumb activeVenue={activeVenue} onOpenPage={onOpenPage} />
      <VenueHeader activeVenue={activeVenue} content={content} />

      <EditorialMedia
        src={content.heroImage}
        fallbackSrc={fallbackContent.heroImage}
        alt={content.heroAlt}
        className="editorial-hero-media"
        onOpenImage={onOpenImage}
      />

      <div className="editorial-content-rail">
        <VenueBody activeVenue={activeVenue} content={content} />

        <EditorialMedia
          src={content.secondaryImage}
          fallbackSrc={fallbackContent.secondaryImage}
          alt={content.secondaryImageAlt}
          className="editorial-secondary-media"
          onOpenImage={onOpenImage}
          playButton
        />
      </div>

      <VenueRelated items={content.relatedItems} fallbackItems={fallbackContent.relatedItems} />
    </article>
  );
}
