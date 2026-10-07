import { conversionActions } from "../public/metric-actions.js";
export { conversionActions } from "../public/metric-actions.js";
// Keep only known public pages and fixed action names. No form values, query
// strings, fragments, customer IDs or administrative URLs enter analytics.
export function redactAnalytics(event) {
  try {
    const url = new URL(event.url);
    if (
      ![
        "/",
        "/about",
        "/events",
        "/events/wedding",
        "/events/corporate",
        "/events/anniversary",
        "/events/graduation",
        "/portfolio",
        "/services",
        "/contacts",
      ].includes(url.pathname) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const { data, ...safe } = event;
    if (safe.type === "event" && !conversionActions.has(safe.name)) return null;
    url.search = "";
    url.hash = "";
    safe.url = url.href;
    if (safe.referrer) {
      const referrer = new URL(safe.referrer);
      safe.referrer = referrer.origin;
    }
    return safe;
  } catch {
    return null;
  }
}
