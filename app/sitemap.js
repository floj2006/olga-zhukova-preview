import { siteOrigin } from "../lib/site";

const publicRoutes = [
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
];

export default function sitemap() {
  return publicRoutes.map((route) => ({
    url: siteOrigin + (route === "/" ? "/" : route),
  }));
}
