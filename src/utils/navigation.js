import { routeByHash } from "../data/siteData";

export function normalizeRoute(hashValue) {
  if (!hashValue || !routeByHash[hashValue]) {
    return "home";
  }

  return routeByHash[hashValue];
}

export function activateWithKeyboard(event, callback) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
}
