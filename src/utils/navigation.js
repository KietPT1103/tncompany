import { routeByHash } from "../data/siteData";

export function normalizePathname(pathname) {
  if (!pathname) {
    return "/";
  }

  const normalized = pathname.replace(/\/+$|^\s+|\s+$/g, "");
  return normalized || "/";
}

export function normalizeRoute(hashValue) {
  const normalized = normalizePathname(hashValue);

  if (!routeByHash[normalized]) {
    return "home";
  }

  return routeByHash[normalized];
}

export function activateWithKeyboard(event, callback) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
}
