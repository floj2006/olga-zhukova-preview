import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";
const password = randomBytes(24).toString("base64url");
const server = await createSiteServer({
  dataDir: await mkdtemp("artifacts/mvp-browser-"),
  env: {
    NODE_ENV: "test",
    ADMIN_PASSWORD_HASH: await hashPassword(password),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port,
  browser = await chromium.launch(),
  context = await browser.newContext({ reducedMotion: "reduce" }),
  page = await context.newPage(),
  admin = await context.newPage(),
  errors = [];
function watch(p) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/401 \(Unauthorized\)/.test(m.text()))
      errors.push(m.text());
  });
}
for (const p of [page, admin]) watch(p);
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(page.locator("#showreel")).toBeHidden();
  await expect(page.locator("#reviews")).toBeHidden();
  await expect(page.locator("#result-price")).toHaveText("—");
  await expect(page.locator("#price-unit")).toBeHidden();
  await expect(page.locator("h1")).toHaveCount(1);
  await page.evaluate(()=>{window.testMetrics=[];document.addEventListener("olga:metric",e=>window.testMetrics.push(e.detail));});
  await page.locator("#calculator [data-check-date]").click();
  await expect(page.locator("#booking-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  assert.ok(await page.evaluate(()=>window.testMetrics.some(e=>e.value?.action==="calendar_open")));
  await page.evaluate(()=>scrollTo(0,0));
  assert.match(
    await page.locator("link[rel=canonical]").getAttribute("href"),
    /^https:\/\//,
  );
  assert.equal(
    (
      await page.request.get(base + "/privacy.html", { maxRedirects: 0 })
    ).status(),
    308,
  );
  assert.match(
    await (await page.request.get(base + "/robots.txt")).text(),
    /Disallow: \/admin/,
  );
  assert.doesNotMatch(
    await (await page.request.get(base + "/sitemap.xml")).text(),
    /\/admin|\/privacy/,
  );
  const response = await page.request.get(base);
  assert.equal(response.headers()["x-frame-options"], "DENY");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(13, 12, 10)");
    await expect(page.locator("body")).toHaveCSS("color", "rgb(250, 247, 239)");
    assert.deepEqual(await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return ["--gold", "--champagne"].map(name => root.getPropertyValue(name).trim());
    }), ["#c9a227", "#f3e7c3"], "Original gold/champagne tokens must be applied");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (width !== 320)
      await page.screenshot({ path: "artifacts/mvp-hero-" + width + ".png" });
  }
  await admin.goto(base + "/admin", { waitUntil: "networkidle" });
  await admin.locator("#password").fill(password);
  await admin.locator("#login-submit").click();
  await expect(admin.locator("#workspace")).toBeVisible();
  await admin.locator("#tab-content").click();
  await expect(admin.locator("#content-fields")).toBeEnabled();
  await admin.locator("#content-video").fill("https://vk.com/video-example");
  await admin
    .locator("#content-caption")
    .fill("Тестовое видео — только в тестовой базе");
  await admin.locator("#content-add-review").click();
  await admin.locator("[data-key=name]").fill("Тестовый автор");
  await admin
    .locator("[data-key=quote]")
    .fill("Проверка публикации реального отзыва через админку.");
  await admin.locator("[data-key=published]").check();
  await admin.locator("#content-save").click();
  await expect(admin.locator("#content-message")).toContainText(
    "Материалы сохранены",
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#showreel")).toBeVisible();
  await expect(page.locator("#reviews")).toBeVisible();
  await expect(page.locator("#review-list")).toContainText("Тестовый автор");
  await expect(page.locator("#showreel-link")).toHaveAttribute(
    "href",
    "https://vk.com/video-example",
  );
  const portfolio = await context.newPage();
  watch(portfolio);
  await portfolio.goto(base + "/portfolio", { waitUntil: "networkidle" });
  await expect(portfolio.locator("#showreel")).toBeVisible();
  await expect(portfolio.locator("#showreel-link")).toHaveAttribute("href", "https://vk.com/video-example");
  await expect(portfolio.locator("#showreel-caption")).toHaveText("Тестовое видео — только в тестовой базе");
  await expect(portfolio.locator("#review-list")).toContainText("Тестовый автор");
  await expect(portfolio.locator(".portfolio-empty")).toHaveCount(0);
  await admin.locator("[data-key=published]").uncheck();
  await admin.locator("#content-video").fill("");
  await admin.locator("#content-save").click();
  await expect(admin.locator("#content-message")).toContainText(
    "Материалы сохранены",
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#reviews")).toBeHidden();
  await expect(page.locator("#showreel")).toBeHidden();
  await portfolio.reload({ waitUntil: "networkidle" });
  await expect(portfolio.locator("#reviews")).toBeHidden();
  await expect(portfolio.locator("#showreel")).toBeHidden();
  await expect(portfolio.locator(".portfolio-empty")).toBeVisible();
  await portfolio.close();
  for (const p of [page, admin]) {
    const audit = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
      [],
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Next metadata/headers, empty estimate, desktop/mobile overflow, CMS publish/hide, accessibility and no console errors.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
