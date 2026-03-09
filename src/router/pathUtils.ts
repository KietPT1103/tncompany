const ADMIN_PREFIX = "/admin";
const ADMIN_PATHS = [
  "/",
  "/reports",
  "/cash-flow",
  "/bills",
  "/product",
  "/categories",
  "/payroll",
  "/timesheet",
  "/pos",
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

  if (href === "/pos") {
    return `${ADMIN_PREFIX}/bills`;
  }

  const shouldPrefix = ADMIN_PATHS.some((path) => {
    if (path === "/") {
      return href === "/";
    }

    return href === path || href.startsWith(`${path}/`);
  });

  if (!shouldPrefix) {
    return href;
  }

  if (href === "/") {
    return ADMIN_PREFIX;
  }

  return `${ADMIN_PREFIX}${href}`;
}

export function denormalizeAdminPathname(pathname: string) {
  if (!pathname.startsWith(ADMIN_PREFIX)) {
    return pathname;
  }

  const stripped = pathname.slice(ADMIN_PREFIX.length) || "/";
  return stripped === "/bills" ? "/pos" : stripped;
}
