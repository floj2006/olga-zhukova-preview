import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { seoFiles, writeSEO } from "../scripts/seo.mjs";

test("SEO uses one configured origin, known person facts and no private pages", () => {
  const result = seoFiles({ SITE_URL: "https://example.org/", VERCEL_ENV: "production" });
  assert.match(result.metadata, /rel="canonical" href="https:\/\/example.org\/"/);
  assert.match(result.metadata, /og:image.*https:\/\/example.org\/olga.jpg/);
  const person = JSON.parse(result.metadata.match(/application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(person["@type"], "Person");
  assert.equal(person.telephone, "+79114449071");
  assert.equal(person.url, "https://example.org/");
  assert.equal(person.aggregateRating, undefined);
  assert.equal((result.sitemap.match(/<loc>/g) || []).length, 1);
  assert.doesNotMatch(result.sitemap, /admin|api|privacy/);
  assert.match(result.robots, /Sitemap: https:\/\/example.org\/sitemap.xml/);
});

test("preview builds are not indexed; invalid origins fail before writing", () => {
  const result = seoFiles({ VERCEL_ENV: "preview" });
  assert.match(result.metadata, /noindex, nofollow/);
  assert.equal(result.robots, "User-agent: *\nDisallow: /\n");
  for (const SITE_URL of ["http://example.org", "https://user:password@example.org", "https://example.org/page", "https://example.org/?token=secret", "https://example.org/#top", "https://foo&bar.org"])
    assert.throws(() => seoFiles({ SITE_URL }));
});

test("repeat builds replace metadata without duplicating it or editing page content", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "olga-seo-test-"));
  try {
    const file = path.join(directory, "index.html");
    await writeFile(file, '<head><!-- generated-seo:start --><!-- generated-seo:end --></head><body>Existing content</body>');
    await writeSEO(directory, { SITE_URL: "https://example.org" });
    await writeSEO(directory, { SITE_URL: "https://new.example.org" });
    const html = await readFile(file, "utf8");
    assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
    assert.match(html, /https:\/\/new.example.org/);
    assert.ok(html.endsWith('<body>Existing content</body>'));
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("olga-seo-test-"));
    await rm(directory, { recursive: true, force: true });
  }
});
