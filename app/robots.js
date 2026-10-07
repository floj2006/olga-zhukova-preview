import { siteOrigin, isPreview } from "../lib/site";
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      ...(isPreview
        ? { disallow: "/" }
        : { allow: "/", disallow: ["/api/", "/admin", "/uploads/"] }),
    },
    sitemap: siteOrigin + "/sitemap.xml",
  };
}
