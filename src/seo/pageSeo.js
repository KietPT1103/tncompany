import { companyFaqs, venueSeoContentById } from "../data/seoContent";
import { company, venues } from "../data/siteData";
import defaultOgImagePath from "../optimized-media/cafe/cafe-hero.jpg";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://tnservice.vn").replace(/\/+$/, "");

function toAbsoluteUrl(pathname = "/") {
  return new URL(pathname, `${SITE_URL}/`).toString();
}

const DEFAULT_OG_IMAGE = new URL(defaultOgImagePath, `${SITE_URL}/`).toString();
const BRAND_LOGO = toAbsoluteUrl("/favicon.svg");

function buildHomepageSeoDescription() {
  return `Kh\u00e1m ph\u00e1 h\u1ec7 sinh th\u00e1i \u00d4ng Quan t\u1ea1i ${buildHomepageAddressText()} g\u1ed3m Ti\u1ec7m c\u00e0 ph\u00ea \u00d4ng Quan, Ti\u1ec7m l\u1ea9u \u00d4ng Quan v\u00e0 \u00d4ng Quan Farm; ph\u00f9 h\u1ee3p t\u00ecm qu\u00e1n cafe \u0111\u1eb9p, qu\u00e1n l\u1ea9u \u0103n s\u00e1ng, \u0111i\u1ec3m tham quan check-in t\u1ea1i C\u1ea7n Th\u01a1.`;
}

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
      description: buildHomepageSeoDescription(),
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
      description: buildHomepageSeoDescription(),
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

function buildVenueSchema(venue, seoDescription = venue.description) {
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
    description: seoDescription,
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
      "Ti\u1ec7m c\u00e0 ph\u00ea \u00d4ng Quan t\u1ea1i 701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i, qu\u1eadn Ninh Ki\u1ec1u, C\u1ea7n Th\u01a1 l\u00e0 qu\u00e1n cafe \u0111\u1eb9p c\u00f3 nhi\u1ec1u khu nh\u01b0 H\u1ed9i An, nh\u00e0 b\u00ean su\u1ed1i, nh\u00e0 gia ti\u00ean; ph\u00f9 h\u1ee3p g\u1eb7p g\u1ee1, ch\u1ee5p \u1ea3nh v\u00e0 th\u01b0 gi\u00e3n.",
  },
  hotpot: {
    title: "Ti\u1ec7m l\u1ea9u \u00d4ng Quan C\u1ea7n Th\u01a1 | L\u1ea9u, \u0103n s\u00e1ng v\u00e0 m\u00f3n n\u01b0\u1edbng t\u1ea1i Ninh Ki\u1ec1u",
    description:
      "Ti\u1ec7m l\u1ea9u \u00d4ng Quan t\u1ea1i 701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i, qu\u1eadn Ninh Ki\u1ec1u, C\u1ea7n Th\u01a1 ph\u1ee5c v\u1ee5 l\u1ea9u, \u0103n s\u00e1ng, m\u00f3n n\u01b0\u1edbng v\u00e0 m\u00f3n \u0103n k\u00e8m; ph\u00f9 h\u1ee3p nh\u00f3m b\u1ea1n, gia \u0111\u00ecnh v\u00e0 kh\u00e1ch \u0103n theo nhi\u1ec1u khung gi\u1edd.",
  },
  farm: {
    title: "\u00d4ng Quan Farm C\u1ea7n Th\u01a1 | \u0110i\u1ec3m tham quan, check-in v\u00e0 vui ch\u01a1i gia \u0111\u00ecnh",
    description:
      "\u00d4ng Quan Farm t\u1ea1i 701/78 \u0110\u01b0\u1eddng 30/4, ph\u01b0\u1eddng H\u01b0ng L\u1ee3i, qu\u1eadn Ninh Ki\u1ec1u, C\u1ea7n Th\u01a1 l\u00e0 \u0111i\u1ec3m tham quan, check-in v\u00e0 vui ch\u01a1i ngo\u00e0i tr\u1eddi v\u1edbi khu th\u00fa, g\u00f3c ch\u1ee5p \u1ea3nh, kh\u00f4ng gian ph\u00f9 h\u1ee3p gia \u0111\u00ecnh v\u00e0 nh\u00f3m b\u1ea1n cu\u1ed1i tu\u1ea7n.",
  },
};

const homepageSeo = {
  title: "T&N Company | H\u1ec7 sinh th\u00e1i \u00d4ng Quan g\u1ed3m cafe, l\u1ea9u v\u00e0 farm t\u1ea1i C\u1ea7n Th\u01a1",
  description: buildHomepageSeoDescription(),
};

const aboutSeo = {
  title: "V\u1ec1 ch\u00fang t\u00f4i | T&N Company",
  description:
    "T\u00ecm hi\u1ec3u th\u00f4ng tin doanh nghi\u1ec7p, n\u0103ng l\u1ef1c v\u1eadn h\u00e0nh v\u00e0 h\u1ec7 sinh th\u00e1i \u00d4ng Quan c\u1ee7a T&N Company t\u1ea1i C\u1ea7n Th\u01a1.",
};

const newsIndexSeo = {
  title: "Tin tuc | T&N Company",
  description:
    "Cap nhat bai viet va tin tuc moi nhat cua he sinh thai Ong Quan, gom ca phe, tiem lau va farm tai Can Tho.",
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
  "/about": {
    title: aboutSeo.title,
    description: aboutSeo.description,
    canonical: toAbsoluteUrl("/about"),
    image: DEFAULT_OG_IMAGE,
    siteName: company.shortName,
    openGraphType: "website",
    robots: "index,follow",
    schema: buildOrganizationSchema(),
  },
  "/tin-tuc": {
    title: newsIndexSeo.title,
    description: newsIndexSeo.description,
    canonical: toAbsoluteUrl("/tin-tuc"),
    image: DEFAULT_OG_IMAGE,
    siteName: company.shortName,
    openGraphType: "website",
    robots: "index,follow",
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Tin tuc",
      description: newsIndexSeo.description,
      url: toAbsoluteUrl("/tin-tuc"),
    },
  },
  ...Object.fromEntries(
    venues.map((venue) => {
      const metaOverride = venueMetaOverrides[venue.id] || {};
      const seoDescription = metaOverride.description || venue.description;

      return [
        venue.hash,
        {
          title: metaOverride.title || `${venue.name} | ${company.shortName}`,
          description: seoDescription,
          canonical: toAbsoluteUrl(venue.hash),
          image: toAbsoluteUrl(venue.heroImage),
          siteName: company.shortName,
          openGraphType: "website",
          robots: "index,follow",
          schema: buildVenueSchema(venue, seoDescription),
        },
      ];
    })
  ),
};

export function getSeoForPath(pathname) {
  if (pathname === "/home") {
    return publicSeoByPath["/"];
  }

  if (pathname.startsWith("/tin-tuc/")) {
    return null;
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
