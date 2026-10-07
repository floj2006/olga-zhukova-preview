const configuredOrigin =
  process.env.SITE_URL || "https://olga-zhukova-preview.vercel.app";
const url = new URL(configuredOrigin);
if (
  url.protocol !== "https:" ||
  !/^[a-z0-9.-]+$/i.test(url.hostname) ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
)
  throw new Error("SITE_URL must be an HTTPS origin");
export const siteOrigin = url.origin;
export const isPreview = process.env.VERCEL_ENV === "preview";
export const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": siteOrigin + "/#olga",
  name: "Ольга Жукова",
  jobTitle: "Ведущая мероприятий",
  url: siteOrigin,
  image: siteOrigin + "/olga.jpg",
  telephone: "+79114449071",
};
