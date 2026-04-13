import { companyFaqs, venueSeoContentById } from "../data/seoContent";
import { company, venues } from "../data/siteData";
import defaultOgImagePath from "../optimized-media/cafe/cafe-hero.jpg";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://tnservice.vn").replace(/\/+$/, "");

function toAbsoluteUrl(pathname = "/") {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

const DEFAULT_OG_IMAGE = new URL(defaultOgImagePath, `${SITE_URL}/`).toString();
const BRAND_LOGO = toAbsoluteUrl("/favicon.svg");

function buildAddress() {
  return {
    "@type": "PostalAddress",
    streetAddress: "701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i",
    addressLocality: "Ninh Ki\u1ec1u",
    addressRegion: "C\u1ea7n Th\u01a1",
    addressCountry: "VN",
  };
}

function buildHomepageAddressText() {
  return "701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i, qu\u1eadn Ninh Ki\u1ec1u, C\u1ea7n Th\u01a1";
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

const venueMetaOverrides = {
  cafe: {
    title: "Ti\u1ec7m c\u00e0 ph\u00ea \u00d4ng Quan C\u1ea7n Th\u01a1 | Qu\u00e1n cafe \u0111\u1eb9p t\u1ea1i Ninh Ki\u1ec1u",
    description:
      "Kh\u00e1m ph\u00e1 Ti\u1ec7m c\u00e0 ph\u00ea \u00d4ng Quan t\u1ea1i 701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i, qu\u1eadn Ninh Ki\u1ec1u, C\u1ea7n Th\u01a1. Xem kh\u00f4ng gian cafe, h\u00ecnh \u1ea3nh th\u1ef1c t\u1ebf, gi\u1edd m\u1edf c\u1eeda v\u00e0 th\u00f4ng tin li\u00ean h\u1ec7.",
  },
  hotpot: {
    title: "Ti\u1ec7m l\u1ea9u \u00d4ng Quan C\u1ea7n Th\u01a1 | L\u1ea9u, \u0103n s\u00e1ng v\u00e0 m\u00f3n n\u01b0\u1edbng t\u1ea1i Ninh Ki\u1ec1u",
    description:
      "Ti\u1ec7m l\u1ea9u \u00d4ng Quan ph\u1ee5c v\u1ee5 l\u1ea9u v\u00e0 m\u00f3n n\u01b0\u1edbng t\u1ea1i 701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i, qu\u1eadn Ninh Ki\u1ec1u, C\u1ea7n Th\u01a1. Xem menu n\u1ed5i b\u1eadt, khung gi\u1edd v\u00e0 h\u00ecnh \u1ea3nh th\u1ef1c t\u1ebf.",
  },
  farm: {
    title: "\u00d4ng Quan Farm C\u1ea7n Th\u01a1 | \u0110i\u1ec3m tham quan, check-in v\u00e0 vui ch\u01a1i gia \u0111\u00ecnh",
    description:
      "\u00d4ng Quan Farm l\u00e0 \u0111i\u1ec3m tham quan t\u1ea1i 701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i, qu\u1eadn Ninh Ki\u1ec1u, C\u1ea7n Th\u01a1, ph\u00f9 h\u1ee3p cho gia \u0111\u00ecnh, nh\u00f3m b\u1ea1n v\u00e0 kh\u00e1ch ch\u1ee5p \u1ea3nh. Xem khu th\u00fa, g\u00f3c check-in v\u00e0 gi\u1edd tham quan.",
  },
};

const homepageSeo = {
  title: "T&N Company | H\u1ec7 sinh th\u00e1i \u00d4ng Quan g\u1ed3m cafe, l\u1ea9u v\u00e0 farm t\u1ea1i C\u1ea7n Th\u01a1",
  description:
    `Kh\u00e1m ph\u00e1 h\u1ec7 sinh th\u00e1i \u00d4ng Quan t\u1ea1i ${buildHomepageAddressText()}: ti\u1ec7m c\u00e0 ph\u00ea, ti\u1ec7m l\u1ea9u v\u00e0 farm tham quan. Xem h\u00ecnh \u1ea3nh, gi\u1edd m\u1edf c\u1eeda v\u00e0 th\u00f4ng tin li\u00ean h\u1ec7.`,
};

const publicSeoByPath = {
  "/": {
    title: homepageSeo.title,
    description: homepageSeo.description,
    canonical: toAbsoluteUrl("/"),
    image: DEFAULT_OG_IMAGE,
    siteName: company.shortName,
    openGraphType: "website",
    robots: "index,follow",
    schema: buildOrganizationSchema(),
  },
  ...Object.fromEntries(
    venues.map((venue) => {
      const metaOverride = venueMetaOverrides[venue.id] || {};

      return [
        venue.hash,
        {
          title: metaOverride.title || `${venue.name} | ${company.shortName}`,
          description: metaOverride.description || venue.description,
          canonical: toAbsoluteUrl(venue.hash),
          image: toAbsoluteUrl(venue.heroImage),
          siteName: company.shortName,
          openGraphType: "website",
          robots: "index,follow",
          schema: buildVenueSchema(venue),
        },
      ];
    })
  ),
};

export function getSeoForPath(pathname) {
  if (pathname === "/home") {
    return publicSeoByPath["/"];
  }

  if (pathname === "/login" || pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return {
      title: `${company.shortName} | Trang n\u1ed9i b\u1ed9`,
      description: "Khu v\u1ef1c qu\u1ea3n tr\u1ecb n\u1ed9i b\u1ed9 c\u1ee7a T&N Company.",
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
