import React from "react";
import { venueSeoContentById } from "../data/seoContent";
import { venues } from "../data/siteData";
import ClickableImage from "./ClickableImage";
import ImageCarousel from "./ImageCarousel";

function VenueSeoSections({ sections }) {
  if (!sections?.length) {
    return null;
  }

  return (
    <section className="section-stack">
      <div className="section-head">
        <p className="eyebrow">{"N\u1ed9i dung m\u1edf r\u1ed9ng"}</p>
        <h2>{"Th\u00f4ng tin b\u1ed5 sung cho t\u00ecm ki\u1ebfm \u0111\u1ecba ph\u01b0\u01a1ng"}</h2>
      </div>
      <div className="seo-copy-grid">
        {sections.map((section) => (
          <article className="seo-copy-card" key={section.title}>
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}

function VenueFaqs({ faqs }) {
  if (!faqs?.length) {
    return null;
  }

  return (
    <section className="section-stack">
      <div className="section-head">
        <p className="eyebrow">{"C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p"}</p>
        <h2>{"FAQ v\u1ec1 \u0111\u1ecba \u0111i\u1ec3m n\u00e0y"}</h2>
      </div>
      <div className="faq-grid">
        {faqs.map((item) => (
          <article className="faq-card" key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VenueHero({ activeVenue, heroImageFailed, onHeroImageError, onOpenImage }) {
  return (
    <section className="hero-block">
      <article className="hero-copy">
        <p className="eyebrow">{activeVenue.tag}</p>
        <h1>{activeVenue.name}</h1>
        <p className="hero-headline">{activeVenue.headline}</p>
        <p className="hero-description">{activeVenue.description}</p>

        <div className="meta-grid">
          <p>
            <span>Địa chỉ</span>
            {activeVenue.address}
          </p>
          <p>
            <span>Khung giờ</span>
            {activeVenue.time}
          </p>
          <p>
            <span>Liên hệ</span>
            {activeVenue.contact}
          </p>
        </div>
      </article>

      <article className="hero-media">
        <ClickableImage
          alt={activeVenue.heroAlt}
          ariaLabel={`Phóng to ảnh chính: ${activeVenue.name}`}
          caption={activeVenue.name}
          className="hero-image-shell"
          fetchPriority="high"
          loading="eager"
          onError={onHeroImageError}
          onOpenImage={onOpenImage}
          showImage={!heroImageFailed}
          src={activeVenue.heroImage}
        />

        <div className="hero-image-meta">
          <p>Điểm nhấn</p>
          <h2>{activeVenue.headline}</h2>
        </div>
      </article>
    </section>
  );
}

function VenueStats({ stats }) {
  return (
    <section className="stats-grid" aria-label="Thống kê địa điểm">
      {stats.map((item, index) => (
        <article className="stat-card" key={item.label} style={{ "--delay": `${index * 0.08}s` }}>
          <p>{item.label}</p>
          <h3>{item.value}</h3>
        </article>
      ))}
    </section>
  );
}

function VenueZones({ activeVenue }) {
  return (
    <section className="section-stack">
      <div className="section-head">
        <p className="eyebrow">{activeVenue.zonesEyebrow || "Không gian nổi bật"}</p>
        <h2>{activeVenue.zonesTitle || `Một phần khu trải nghiệm tại ${activeVenue.name}`}</h2>
      </div>

      <div className="zone-grid">
        {activeVenue.zones.map((zone, index) => (
          <article className="zone-card" key={zone.title} style={{ "--delay": `${index * 0.1}s` }}>
            <p className="zone-order">{activeVenue.zoneItemLabel || "Khu nổi bật"} {index + 1}</p>
            <h3>{zone.title}</h3>
            <p>{zone.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VenueIntroSections({ activeVenue, onOpenImage }) {
  if (!activeVenue.introSections?.length) {
    return null;
  }

  return (
    <section className="section-stack">
      <div className="section-head">
        <p className="eyebrow">{activeVenue.introEyebrow || "Ảnh giới thiệu theo phần"}</p>
        <h2>{activeVenue.introTitle || `Tách rõ từng phần trải nghiệm tại ${activeVenue.name}`}</h2>
      </div>

      <div className="intro-grid">
        {activeVenue.introSections.map((section) => (
          <article className="intro-card" key={section.title}>
            <ClickableImage
              alt={section.alt}
              ariaLabel={`Phóng to ảnh: ${section.title}`}
              caption={section.title}
              className={`intro-media ${section.tone}`}
              onOpenImage={onOpenImage}
              src={section.image}
            />
            <h3>{section.title}</h3>
            <p>{section.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VenueHighlights({ activeVenue }) {
  return (
    <section className="split-panel">
      <article className="menu-card">
        <div className="section-head compact">
          <p className="eyebrow">Điểm nổi bật</p>
          <h2>Menu / dịch vụ signature</h2>
        </div>
        <ul>
          {activeVenue.signature.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article className="discovery-card">
        <div className="section-head compact">
          <p className="eyebrow">Trải nghiệm mở rộng</p>
          <h2>{activeVenue.discoveryTitle}</h2>
        </div>
        <ul>
          {activeVenue.discoveryItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="discovery-tip">{activeVenue.discoveryNote}</p>
      </article>
    </section>
  );
}

function VenueEcosystem({ activeVenue, onOpenPage }) {
  return (
    <section className="section-stack" id="he-sinh-thai">
      <div className="section-head">
        <p className="eyebrow">Toàn hệ sinh thái</p>
        <h2>3 trang độc lập trong cùng một thương hiệu Ông Quan</h2>
      </div>

      <div className="ecosystem-grid">
        {venues.map((venue) => (
          <article key={venue.id} className={`ecosystem-card ${venue.id === activeVenue.id ? "is-current" : ""}`}>
            <p className="card-tag">{venue.tag}</p>
            <h3>{venue.name}</h3>
            <p>{venue.description}</p>
            <a
              href={venue.hash}
              onClick={(event) => {
                if (!onOpenPage) {
                  return;
                }

                event.preventDefault();
                onOpenPage(venue.id);
              }}
            >
              {venue.id === activeVenue.id ? "Đang hiển thị" : "Mở trang này"}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function VenuePage({
  activeVenue,
  heroImageFailed,
  onHeroImageError,
  onOpenImage,
  onOpenPage,
}) {
  const seoContent = venueSeoContentById[activeVenue.id] || {};

  return (
    <>
      <VenueHero
        activeVenue={activeVenue}
        heroImageFailed={heroImageFailed}
        onHeroImageError={onHeroImageError}
        onOpenImage={onOpenImage}
      />
      <VenueStats stats={activeVenue.stats} />
      <VenueZones activeVenue={activeVenue} />
      <VenueIntroSections activeVenue={activeVenue} onOpenImage={onOpenImage} />

      <section className="section-stack" id="thu-vien-anh">
        <div className="section-head">
          <p className="eyebrow">Hình ảnh</p>
          <h2>Thư viện không gian thực tế</h2>
        </div>
        <ImageCarousel slides={activeVenue.slides} onOpenImage={onOpenImage} />
      </section>

      <VenueHighlights activeVenue={activeVenue} />
      <VenueSeoSections sections={seoContent.sections} />
      <VenueFaqs faqs={seoContent.faqs} />
      <VenueEcosystem activeVenue={activeVenue} onOpenPage={onOpenPage} />
    </>
  );
}
