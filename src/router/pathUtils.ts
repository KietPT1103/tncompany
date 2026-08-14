const ADMIN_PREFIX = "/admin";
const ADMIN_PATHS = [
  "/",
  "/reports",
  "/cash-flow",
  "/bills",
  "/virtual-bills",
  "/sample-bills",
  "/product",
  "/inventory-receipts",
  "/categories",
  "/accounts",
  "/activity-logs",
  "/internal-invoices",
  "/payroll",
  "/payroll-estimate",
  "/social-listening",
  "/gesture-studio",
  "/seo-articles",
  "/tax-invoices",
  "/timesheet",
  "/pos",
  "/bar",
];

const isExternalHref = (value: string) =>
  /^(https?:\/\/|mailto:|tel:)/i.test(value);

export function normalizeAdminHref(href: string) {
  if (!href || isExternalHref(href) || !href.startsWith("/")) {
    return href;
  }

  if (href === "/login") {
    return href;
  }

  if (href === "/pos" || href === "/bar") {
    return "/pos";
  }

  const queryIndex = href.search(/[?#]/);
  const pathname = queryIndex >= 0 ? href.slice(0, queryIndex) : href;
  const suffix = queryIndex >= 0 ? href.slice(queryIndex) : "";

  const shouldPrefix = ADMIN_PATHS.some((path) => {
    if (path === "/") {
      return pathname === "/";
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  });

  if (!shouldPrefix) {
    return href;
  }

  if (pathname === "/") {
    return `${ADMIN_PREFIX}${suffix}`;
  }

  return `${ADMIN_PREFIX}${pathname}${suffix}`;
}

export function denormalizeAdminPathname(pathname: string) {
  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return pathname;
  }

  const stripped = pathname.slice(ADMIN_PREFIX.length) || "/";
  return stripped;
}
