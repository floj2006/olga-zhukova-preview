import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

export function seoFiles(env = {}) {
  const url = new URL(env.SITE_URL || "https://olga-zhukova-preview.vercel.app");
  if (url.protocol !== "https:" || !/^[a-z0-9.-]+$/i.test(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("SITE_URL must be an HTTPS origin without credentials, path, query or fragment.");
  const origin = url.origin;
  const preview = env.VERCEL_ENV === "preview";
  const structured = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${origin}/#olga`,
    name: "Ольга Жукова",
    jobTitle: "Ведущая мероприятий",
    url: `${origin}/`,
    image: `${origin}/olga.jpg`,
    telephone: "+79114449071",
  };
  return {
    metadata: `<!-- generated-seo:start -->
    <link rel="canonical" href="${origin}/" />
    <meta name="robots" content="${preview ? "noindex, nofollow" : "index, follow"}" />
    <meta property="og:url" content="${origin}/" />
    <meta property="og:site_name" content="Ольга Жукова" />
    <meta property="og:image" content="${origin}/olga.jpg" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="1536" />
    <meta property="og:image:alt" content="Ольга Жукова — ведущая мероприятий" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Ольга Жукова — ведущая мероприятий в Вологде" />
    <meta name="twitter:description" content="Свадьбы, корпоративы, юбилеи и выпускные. Обсудим дату и программу вашего события." />
    <meta name="twitter:image" content="${origin}/olga.jpg" />
    <meta name="twitter:image:alt" content="Ольга Жукова — ведущая мероприятий" />
    <script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>
    <!-- generated-seo:end -->`,
    robots: preview ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /admin$\nSitemap: ${origin}/sitemap.xml\n`,
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`,
  };
}

export async function writeSEO(directory, env = process.env) {
  const generated = seoFiles(env);
  const file = path.join(directory, "index.html");
  const html = await readFile(file, "utf8");
  const marker = /<!-- generated-seo:start -->[\s\S]*?<!-- generated-seo:end -->/;
  if (!marker.test(html)) throw new Error("SEO marker is missing from index.html.");
  await writeFile(file, html.replace(marker, () => generated.metadata));
  await writeFile(path.join(directory, "robots.txt"), generated.robots);
  await writeFile(path.join(directory, "sitemap.xml"), generated.sitemap);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await writeSEO(fileURLToPath(new URL("../dist/", import.meta.url)));
  console.log("Canonical, sharing metadata, robots and sitemap generated.");
}
