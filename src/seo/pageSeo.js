import defaultOgImagePath from "../optimized-media/cafe/cafe-hero.jpg";
import { company, venues } from "../data/siteData";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://tnservice.vn").replace(/\/+$/, "");
const DEFAULT_OG_IMAGE = new URL(defaultOgImagePath, `${SITE_URL}/`).toString();

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

function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: company.shortName,
        legalName: company.name,
        url: SITE_URL,
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
    ],
  };
}

function buildVenueSchema(venue) {
  const schemaTypeByVenue = {
    cafe: "CafeOrCoffeeShop",
    hotpot: "Restaurant",
    farm: "TouristAttraction",
  };

  return {
    "@context": "https://schema.org",
    "@type": schemaTypeByVenue[venue.id] || "LocalBusiness",
    "@id": `${toAbsoluteUrl(venue.hash)}#place`,
    name: venue.name,
    description: venue.description,
    url: toAbsoluteUrl(venue.hash),
    image: toAbsoluteUrl(venue.heroImage),
    telephone: venue.contact,
    address: buildAddress(),
    openingHours: `Mo-Su ${venue.time.replace(/\s+/g, "")}`,
    areaServed: "Cần Thơ",
  };
}

const publicSeoByPath = {
  "/": {
    title: `${company.shortName} | Doanh nghiệp và hệ sinh thái Ông Quan tại Cần Thơ`,
    description:
      "Trang giới thiệu T&N Company, thông tin doanh nghiệp, lĩnh vực hoạt động và hệ sinh thái Ông Quan gồm cà phê, tiệm lẩu và farm tại Cần Thơ.",
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
        description: venue.description,
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
      description: "Khu vực quản trị nội bộ của T&N Company.",
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
