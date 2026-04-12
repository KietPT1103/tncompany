import { companyFaqs, venueSeoContentById } from "../data/seoContent";
import { company, venues } from "../data/siteData";
import defaultOgImagePath from "../optimized-media/cafe/cafe-hero.jpg";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://tnservice.vn").replace(/\/+$/, "");
const DEFAULT_OG_IMAGE = new URL(defaultOgImagePath, `${SITE_URL}/`).toString();
const BRAND_LOGO = toAbsoluteUrl("/favicon.svg");

function toAbsoluteUrl(pathname = "/") {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

function buildAddress() {
  return {
    "@type": "PostalAddress",
    streetAddress: "267 Đường 30/4",
    addressLocality: "Ninh Kiều",
    addressRegion: "Cần Thơ",
    addressCountry: "VN",
  };
}

function buildFaqSchema(pageUrl, faqs) {
  if (!faqs?.length) {
    return null;
  }

  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

function buildOrganizationSchema() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: company.shortName,
      legalName: company.name,
      url: SITE_URL,
      logo: BRAND_LOGO,
      image: BRAND_LOGO,
      telephone: company.phone,
      address: buildAddress(),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: company.shortName,
      inLanguage: "vi-VN",
    },
  ];

  const faqSchema = buildFaqSchema(toAbsoluteUrl("/"), companyFaqs);
  if (faqSchema) {
    graph.push(faqSchema);
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function buildVenueSchema(venue) {
  const schemaTypeByVenue = {
    cafe: "CafeOrCoffeeShop",
    hotpot: "Restaurant",
    farm: "TouristAttraction",
  };

  const pageUrl = toAbsoluteUrl(venue.hash);
  const placeSchema = {
    "@type": schemaTypeByVenue[venue.id] || "LocalBusiness",
    "@id": `${pageUrl}#place`,
    name: venue.name,
    description: venue.description,
    url: pageUrl,
    image: toAbsoluteUrl(venue.heroImage),
    telephone: venue.contact,
    address: buildAddress(),
    openingHours: `Mo-Su ${venue.time.replace(/\s+/g, "")}`,
    areaServed: "C\u1ea7n Th\u01a1",
  };

  const faqSchema = buildFaqSchema(pageUrl, venueSeoContentById[venue.id]?.faqs);

  return {
    "@context": "https://schema.org",
    "@graph": faqSchema ? [placeSchema, faqSchema] : [placeSchema],
  };
}

function buildVenueMetaDescription(venue) {
  const seoParagraph = venueSeoContentById[venue.id]?.sections?.[0]?.paragraphs?.[0];
  return seoParagraph || venue.description;
}

const publicSeoByPath = {
  "/": {
    title: `${company.shortName} | Doanh nghiệp và hệ sinh thái Ông Quan tại Cần Thơ`,
    description:
      "Trang giới thiệu T&N Services, thông tin doanh nghiệp, lĩnh vực hoạt động và hệ sinh thái Ông Quan gồm cà phê, tiệm lẩu và farm tại Cần Thơ.",
    canonical: toAbsoluteUrl("/"),
    image: DEFAULT_OG_IMAGE,
    siteName: company.shortName,
    openGraphType: "website",
    robots: "index,follow",
    schema: buildOrganizationSchema(),
  },
  ...Object.fromEntries(
    venues.map((venue) => [
      venue.hash,
      {
        title: `${venue.name} | ${venue.address} | ${company.shortName}`,
        description: buildVenueMetaDescription(venue),
        canonical: toAbsoluteUrl(venue.hash),
        image: toAbsoluteUrl(venue.heroImage),
        siteName: company.shortName,
        openGraphType: "website",
        robots: "index,follow",
        schema: buildVenueSchema(venue),
      },
    ])
  ),
};

export function getSeoForPath(pathname) {
  if (pathname === "/home") {
    return publicSeoByPath["/"];
  }

  if (pathname === "/login" || pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return {
      title: `${company.shortName} | Trang nội bộ`,
      description: "Khu vực quản trị nội bộ của T&N Services.",
      canonical: toAbsoluteUrl(pathname),
      image: DEFAULT_OG_IMAGE,
      siteName: company.shortName,
      openGraphType: "website",
      robots: "noindex,nofollow",
      schema: null,
    };
  }

  return (
    publicSeoByPath[pathname] || {
      ...publicSeoByPath["/"],
      canonical: toAbsoluteUrl(pathname),
      robots: "noindex,nofollow",
      schema: null,
    }
  );
}
