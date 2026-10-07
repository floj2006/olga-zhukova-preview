import { chromium, webkit, firefox, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";

const routes = [
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
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920];
const eventTypes = ["wedding", "corporate", "anniversary", "graduation"];
const engineName =
  process.env.BROWSER || process.env.SITE_BROWSER || "chromium";
assert.ok(
  ["chromium", "webkit", "firefox"].includes(engineName),
  "BROWSER must be chromium, webkit or firefox",
);
const engine = { chromium, webkit, firefox }[engineName];
const artifactDir = path.resolve(
  "artifacts",
  "multipage-browser-" + engineName,
);
await mkdir(artifactDir, { recursive: true });

// The API receives only random test credentials and a new temporary directory.
// No existing state or administrator session is used by the isolated API.
const dataDir = await mkdtemp(
  path.join(os.tmpdir(), "olga-multipage-browser-"),
);
const server = await createSiteServer({
  dataDir,
  env: {
    NODE_ENV: "test",
    ADMIN_PASSWORD_HASH: await hashPassword(
      randomBytes(24).toString("base64url"),
    ),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
let browser;
let currentPage;
let metadataOrigin;
const failures = [];
const completed = [];
const runtimeErrors = [];
const pages = new Map();
const internalLinks = new Map();
const imageURLs = new Set();

function pathname(value) {
  return value === "/" ? "/" : value.replace(/\/+$/, "");
}
function filename(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
}
async function runCase(label, task) {
  try {
    await task();
    completed.push(label);
    console.log("PASS " + label);
  } catch (error) {
    failures.push({ label, message: error.message });
    console.error("FAIL " + label + ": " + error.message);
    if (currentPage && !currentPage.isClosed()) {
      await currentPage
        .screenshot({
          path: path.join(artifactDir, "failure-" + filename(label) + ".png"),
          fullPage: true,
        })
        .catch(() => {});
    }
  }
}
async function newPage(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    ...(engineName === "webkit"
      ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(45000);
  page.on("pageerror", (error) =>
    runtimeErrors.push({
      page: new URL(page.url()).pathname,
      message: error.message,
    }),
  );
  currentPage = page;
  return { context, page };
}
async function visit(page, route) {
  const response = await page.goto(base + route, {
    waitUntil: "domcontentloaded",
  });
  assert.equal(response?.status(), 200, route + " document response");
  await expect(page.locator("#hero-booking")).toHaveAttribute(
    "data-catalog-state",
    "ready",
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) image.loading = "eager";
  });
}
async function waitImages(page) {
  await expect
    .poll(
      () =>
        page
          .locator("img")
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      { timeout: 20000, message: "All page images decode successfully" },
    )
    .toBe(true);
}
async function openDate(page, trigger, keyboard = false) {
  if (keyboard) {
    await trigger.focus();
    await page.keyboard.press("Enter");
  } else await trigger.click();
  await expect(page.locator("#booking-dialog")).toBeVisible();
  await expect(page.locator("#booking-date-tab")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#booking-date-panel")).toBeVisible();
  await expect(page.locator("#booking-date-tab")).toBeFocused();
}
async function escapeBooking(page, trigger) {
  await page.keyboard.press("Escape");
  await expect(page.locator("#booking-dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
}
async function metadataAndLinks(page, route) {
  const details = await page.evaluate(() => {
    const meta = (name, property = false) =>
      document.querySelector(
        property
          ? 'meta[property="' + name + '"]'
          : 'meta[name="' + name + '"]',
      )?.content;
    const ids = [...document.querySelectorAll("[id]")].map(
      (element) => element.id,
    );
    const images = [...document.images];
    return {
      title: document.title,
      description: meta("description"),
      canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map(
        (element) => element.href,
      ),
      ogTitle: meta("og:title", true),
      ogDescription: meta("og:description", true),
      ogURL: meta("og:url", true),
      ogImage: meta("og:image", true),
      twitterTitle: meta("twitter:title"),
      twitterDescription: meta("twitter:description"),
      ids,
      duplicates: ids.filter((id, index) => ids.indexOf(id) !== index),
      links: [...document.querySelectorAll("a[href]")]
        .map((element) => element.href)
        .filter((href) => {
          const url = new URL(href);
          return (
            ["http:", "https:"].includes(url.protocol) &&
            url.origin === location.origin
          );
        }),
      images: images
        .flatMap((image) => [
          image.src,
          image.currentSrc,
          ...(image.getAttribute("srcset") || "").split(",").map((item) => {
            const source = item.trim().split(/\s+/)[0];
            return source ? new URL(source, location.href).href : null;
          }),
        ])
        .filter(Boolean),
      missingImageDimensions: images
        .filter(
          (image) =>
            !(
              Number(image.getAttribute("width")) > 0 &&
              Number(image.getAttribute("height")) > 0
            ),
        )
        .map((image) => image.getAttribute("src")),
    };
  });
  await expect(page.locator("main h1")).toHaveCount(1);
  assert.ok(details.title.trim(), route + " title");
  assert.ok(details.description?.trim().length > 20, route + " description");
  assert.equal(details.canonicals.length, 1, route + " one canonical");
  const canonical = new URL(details.canonicals[0]);
  metadataOrigin ||= canonical.origin;
  assert.equal(
    canonical.origin,
    metadataOrigin,
    route + " shared canonical origin",
  );
  assert.equal(canonical.protocol, "https:", route + " HTTPS canonical");
  assert.equal(pathname(canonical.pathname), route, route + " canonical route");
  assert.equal(
    canonical.search + canonical.hash,
    "",
    route + " clean canonical",
  );
  assert.equal(
    new URL(details.ogURL).href,
    canonical.href,
    route + " Open Graph URL",
  );
  assert.equal(details.ogTitle, details.title, route + " Open Graph title");
  assert.equal(details.twitterTitle, details.title, route + " Twitter title");
  assert.equal(
    details.ogDescription,
    details.description,
    route + " Open Graph description",
  );
  assert.equal(
    details.twitterDescription,
    details.description,
    route + " Twitter description",
  );
  assert.equal(
    new URL(details.ogImage).origin,
    metadataOrigin,
    route + " Open Graph image origin",
  );
  assert.deepEqual(details.duplicates, [], route + " unique semantic IDs");
  assert.deepEqual(
    details.missingImageDimensions,
    [],
    route + " image dimensions prevent layout shifts",
  );
  pages.set(route, {
    title: details.title,
    description: details.description,
    ids: new Set(details.ids),
  });
  for (const href of details.links) {
    const url = new URL(href);
    internalLinks.set(url.pathname + url.search + url.hash, url);
  }
  for (const url of details.images) imageURLs.add(url);
}
async function responsiveAudit(page, route, width) {
  await page.setViewportSize({
    width,
    height: width >= 1280 ? 1080 : width >= 768 ? 1000 : 844,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  const heading = page.locator("main h1");
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  const intro = page
    .locator("main section")
    .filter({ has: page.locator("h1") })
    .first();
  const action = intro.locator("a,button").first();
  await expect(action).toBeVisible();
  await expect(action).toBeInViewport();
  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const outside = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.right > innerWidth + 1 &&
          getComputedStyle(element).visibility !== "hidden" &&
          !element.closest('[aria-hidden="true"]')
        );
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        id: element.id,
        class: element.className,
      }));
    return { width: innerWidth, scrollWidth: root.scrollWidth, outside };
  });
  assert.ok(
    layout.scrollWidth <= layout.width + 1,
    route + " " + width + "px overflow: " + JSON.stringify(layout),
  );
  assert.equal(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    true,
  );
  const motion = await page.evaluate(() => {
    const hiddenText = [
      ...document.querySelectorAll("main h1, main h2, main .reveal"),
    ]
      .filter(
        (element) =>
          element.getBoundingClientRect().width > 0 &&
          element.textContent.trim() &&
          Number(getComputedStyle(element).opacity) === 0,
      )
      .map((element) => ({ tag: element.tagName, id: element.id }));
    const longAnimations = document
      .getAnimations()
      .filter((animation) => {
        const target = animation.effect?.target;
        const duration = animation.effect?.getComputedTiming().activeDuration;
        return (
          target?.closest?.("main") &&
          animation.playState === "running" &&
          (duration === Infinity || duration > 200)
        );
      })
      .map(
        (animation) =>
          animation.effect.target.id || animation.effect.target.className,
      );
    return { hiddenText, longAnimations };
  });
  assert.deepEqual(
    motion,
    { hiddenText: [], longAnimations: [] },
    route + " usable reduced motion",
  );
  if (width === 390 || width === 1440) {
    await waitImages(page);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      scan.violations.map((violation) => ({
        id: violation.id,
        targets: violation.nodes.map((node) => node.target),
      })),
      [],
      route + " axe at " + width + "px",
    );
    await page.screenshot({
      path: path.join(artifactDir, filename(route) + "-" + width + ".png"),
      fullPage: true,
    });
  }
}
async function destinationAudit(page) {
  assert.equal(pages.size, routes.length, "All public pages audited");
  assert.equal(
    new Set([...pages.values()].map((value) => value.title)).size,
    routes.length,
    "Distinct public titles",
  );
  assert.equal(
    new Set([...pages.values()].map((value) => value.description)).size,
    routes.length,
    "Distinct public descriptions",
  );
  const extraPages = new Map();
  for (const url of internalLinks.values()) {
    const route = pathname(url.pathname);
    let destination = pages.get(route);
    if (!destination) {
      if (!extraPages.has(url.pathname + url.search)) {
        const response = await page.request.get(
          base + url.pathname + url.search,
        );
        assert.equal(
          response.status(),
          200,
          "Internal destination " + url.pathname,
        );
        const html = await response.text();
        extraPages.set(url.pathname + url.search, {
          ids: new Set(
            [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(
              (match) => match[1],
            ),
          ),
        });
      }
      destination = extraPages.get(url.pathname + url.search);
    }
    if (url.hash.length > 1)
      assert.ok(
        destination.ids.has(decodeURIComponent(url.hash.slice(1))),
        "Missing internal hash target " + url.pathname + url.hash,
      );
  }
  for (const href of imageURLs) {
    const url = new URL(href);
    assert.equal(
      url.origin,
      base,
      "Image is served by the isolated application",
    );
    const response = await page.request.get(href);
    assert.equal(response.status(), 200, "Image response " + url.pathname);
    assert.match(
      response.headers()["content-type"] || "",
      /^image\//,
      "Image content type " + url.pathname,
    );
  }
}
async function eventCTAFlow() {
  const { context, page } = await newPage({ width: 390, height: 844 });
  try {
    for (const type of eventTypes) {
      await visit(page, "/events/" + type);
      const selectors = [
        "main .inner-hero [data-discuss]",
        ".event-editorial-package-actions [data-discuss]",
        "main .final-content [data-discuss]",
      ];
      for (const [index, selector] of selectors.entries()) {
        const trigger = page.locator(selector);
        await expect(trigger).toHaveAttribute("data-event", type);
        await openDate(page, trigger, index === 0);
        await expect(page.locator("#hero-event-type")).toHaveValue(type);
        await expect(page.locator("dialog[open]")).toHaveCount(1);
        await escapeBooking(page, trigger);
      }
    }
  } finally {
    await context.close();
  }
}
async function mobileMenuFlow() {
  const { context, page } = await newPage({ width: 390, height: 844 });
  try {
    await visit(page, "/contacts");
    const toggle = page.locator("#menu-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#mobile-menu")).toBeVisible();
    await page.locator("#mobile-menu a.button").click();
    await expect(page.locator("#mobile-menu")).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#booking-date-tab")).toBeFocused();
    await expect(page.locator("#booking-date-panel")).toBeVisible();
    await escapeBooking(page, toggle);
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeInViewport();
    await expect(page.locator("body")).not.toHaveClass(/menu-open|dialog-open/);
    assert.equal(
      await page.locator("main").evaluate((element) => element.inert),
      false,
    );
    assert.equal(
      await page.locator(".footer").evaluate((element) => element.inert),
      false,
    );
  } finally {
    await context.close();
  }
}
async function nativeNavigate(page, selector, destination) {
  await page.evaluate(() => {
    window.__multipageDocumentToken = "synthetic-navigation-check";
  });
  await Promise.all([
    page.waitForURL(base + destination, { waitUntil: "domcontentloaded" }),
    page.locator(selector).first().click(),
  ]);
  await expect(page.locator("#hero-booking")).toHaveAttribute(
    "data-catalog-state",
    "ready",
  );
  assert.equal(
    await page.evaluate(() => window.__multipageDocumentToken),
    undefined,
    "Native navigation creates a new document at " + destination,
  );
}
async function assertRestoredQuote(page, date) {
  await expect(page.locator("#hero-event-type")).toHaveValue("corporate");
  await expect(
    page.locator("#hero-service-options input[value=host]"),
  ).toBeChecked();
  await expect(
    page.locator("#hero-service-options input[value=dj]"),
  ).toBeChecked();
  await expect(
    page.locator(
      "#hero-service-options [data-service-id=host] input[type=number]",
    ),
  ).toHaveValue("6");
  await expect(
    page.locator(
      "#hero-service-options [data-service-id=dj] input[type=number]",
    ),
  ).toHaveValue("3");
  await expect(page.locator("#hero-extra-meetings")).toHaveValue("2");
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("olga-service-builder-v2")),
  );
  assert.deepEqual(saved.selected, { host: 6, dj: 3 });
  assert.equal(saved.eventDate, date);
  assert.equal(saved.eventType, "corporate");
  assert.equal(saved.extraMeetings, 2);
}
async function crossDocumentPrivacyFlow() {
  const { context, page } = await newPage();
  try {
    await visit(page, "/events");
    await openDate(
      page,
      page.locator(".event-overview-grid .format-calc-link").first(),
    );
    await page.locator("#calendar-next").click();
    await expect(page.locator("#hero-calendar")).toHaveAttribute(
      "data-state",
      "ready",
    );
    const dateButton = page
      .locator("#calendar-days button[data-date]:enabled")
      .nth(5);
    const date = await dateButton.getAttribute("data-date");
    assert.match(date || "", /^\d{4}-\d{2}-\d{2}$/);
    await dateButton.click();
    await page.locator("#booking-services-tab").click();
    await page.locator("#hero-event-type").selectOption("corporate");
    await page.locator("#hero-service-options input[value=host]").check();
    await page.locator("#hero-service-options input[value=dj]").check();
    await page
      .locator(
        "#hero-service-options [data-service-id=host] input[type=number]",
      )
      .fill("6");
    await page
      .locator("#hero-service-options [data-service-id=dj] input[type=number]")
      .fill("3");
    await page.locator("#hero-extra-meetings").fill("2");
    await page.locator("#booking-contact-tab").click();
    await expect(page.locator("#request-dialog")).toBeVisible();
    const syntheticName = "Тест переходов между страницами";
    const syntheticPhone = "+7 900 555-01-23";
    await page.locator("[name=name]").fill(syntheticName);
    await page.locator("[name=phone]").fill(syntheticPhone);
    await page
      .locator("[name=comment]")
      .fill("Тестовая заметка, не отправлять");
    await page.locator("[name=consent]").check();
    const saved = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("olga-service-builder-v2")),
    );
    assert.deepEqual(
      Object.keys(saved).sort(),
      ["eventDate", "eventType", "extraMeetings", "selected"].sort(),
    );
    const storageValues = await page.evaluate(() =>
      [...Object.values(sessionStorage), ...Object.values(localStorage)].join(
        "\n",
      ),
    );
    assert.ok(
      !storageValues.includes(syntheticName) &&
        !storageValues.includes(syntheticPhone),
      "Personal fields are not persisted",
    );
    await page.locator("#booking-close").click();
    await nativeNavigate(
      page,
      'main a[href="/events/corporate"]',
      "/events/corporate",
    );
    await openDate(page, page.locator("main .inner-hero [data-discuss]"));
    await assertRestoredQuote(page, date);
    await expect(
      page.locator('#calendar-days button[data-date="' + date + '"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await escapeBooking(page, page.locator("main .inner-hero [data-discuss]"));
    await nativeNavigate(page, '.desktop-nav a[href="/services"]', "/services");
    await assertRestoredQuote(page, date);
    await expect(
      page.locator("#service-options input[value=host]"),
    ).toBeChecked();
    await expect(
      page.locator(
        "#service-options [data-service-id=host] input[type=number]",
      ),
    ).toHaveValue("6");
    await expect(page.locator("[name=eventDate]")).toHaveValue(date);
    await expect(page.locator("[name=eventType]")).toHaveValue("corporate");
    await openDate(page, page.locator(".header-booking"));
    await page.locator("#booking-contact-tab").click();
    await expect(page.locator("#request-dialog")).toBeVisible();
    await expect(page.locator("[name=name]")).toHaveValue("");
    await expect(page.locator("[name=phone]")).toHaveValue("");
    await expect(page.locator("[name=comment]")).toHaveValue("");
    await expect(page.locator("[name=consent]")).not.toBeChecked();
    await page.locator("#booking-close").click();
  } finally {
    await context.close();
  }
}
async function sharedCatalogRetryFlow() {
  const { context, page } = await newPage();
  let releaseRetry = () => {};
  try {
    const response = await page.request.get(base + "/api/catalog");
    assert.equal(response.status(), 200);
    const catalog = await response.json();
    const photo = (id, url) => ({
      id,
      url,
      alt: "Изолированный тестовый кадр",
      caption: "Только тестовые данные",
      width: 1000,
      height: 667,
      published: true,
      featured: true,
    });
    const fallback = {
      ...catalog,
      gallery: [photo("test-offline-gallery", "/images/wedding.jpg")],
    };
    const updated = {
      ...catalog,
      version: catalog.version + 1,
      services: catalog.services.map((service) =>
        service.id === "host"
          ? { ...service, price: service.price + 500 }
          : service,
      ),
      gallery: [
        photo("test-retry-gallery-1", "/images/celebration.jpg"),
        photo("test-retry-gallery-2", "/images/wedding-moment.jpg"),
      ],
    };
    let apiCalls = 0;
    let fallbackCalls = 0;
    const paths = [];
    const retryGate = new Promise((resolve) => {
      releaseRetry = resolve;
    });
    page.on("request", (request) =>
      paths.push(new URL(request.url()).pathname),
    );
    await page.route("**/api/catalog", async (route) => {
      apiCalls++;
      if (apiCalls === 1)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Controlled test failure" }),
        });
      await retryGate;
      return route.fulfill({ json: updated });
    });
    await page.route("**/catalog.json", (route) => {
      fallbackCalls++;
      return route.fulfill({ json: fallback });
    });
    await page.goto(base + "/portfolio", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#hero-booking")).toHaveAttribute(
      "data-catalog-state",
      "offline",
    );
    await expect(page.locator(".gallery-item")).toHaveCount(1);
    await expect(page.locator(".gallery-item")).toHaveAttribute(
      "data-photo-id",
      "test-offline-gallery",
    );
    assert.equal(
      apiCalls,
      1,
      "Provider and gallery share one initial catalog request",
    );
    assert.equal(fallbackCalls, 1);
    await openDate(page, page.locator(".header-booking"));
    await expect(page.locator("#booking-contact-tab")).toBeDisabled();
    await page.locator("#booking-services-tab").click();
    await page.locator("#hero-service-options input[value=host]").check();
    await page
      .locator(
        "#hero-service-options [data-service-id=host] input[type=number]",
      )
      .fill("6");
    const previousTotal = Number(
      (await page.locator("#hero-price").innerText()).replace(/\D/g, ""),
    );
    const retry = page.locator("#hero-booking [data-retry-catalog]");
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute("aria-busy", "true");
    releaseRetry();
    await expect(page.locator("#hero-booking")).toHaveAttribute(
      "data-catalog-state",
      "ready",
    );
    await expect(page.locator("#booking-contact-tab")).toBeEnabled();
    await expect(retry).toBeHidden();
    await expect(
      page.locator(
        "#hero-service-options [data-service-id=host] input[type=number]",
      ),
    ).toHaveValue("6");
    const nextTotal = Number(
      (await page.locator("#hero-price").innerText()).replace(/\D/g, ""),
    );
    assert.equal(
      nextTotal - previousTotal,
      6 * 500,
      "Retained quantity uses the refreshed tariff",
    );
    await page.locator("#booking-close").click();
    await expect(page.locator(".gallery-item")).toHaveCount(2);
    assert.deepEqual(
      await page
        .locator(".gallery-item")
        .evaluateAll((items) =>
          items.map((item) => item.getAttribute("data-photo-id")),
        ),
      ["test-retry-gallery-1", "test-retry-gallery-2"],
    );
    assert.equal(apiCalls, 2, "One explicit retry updates both consumers");
    assert.equal(
      fallbackCalls,
      1,
      "Successful retry does not refetch the fallback",
    );
    for (const legacy of [
      "/gallery.js",
      "/service-builder.js",
      "/availability.js",
      "/booking-dialog.js",
    ])
      assert.ok(
        !paths.includes(legacy),
        "No duplicate legacy controller " + legacy,
      );
  } finally {
    releaseRetry();
    await context.close();
  }
}

try {
  browser = await engine.launch();
  const { context, page } = await newPage();
  try {
    for (const route of routes) {
      await runCase(route + " metadata/resources", async () => {
        await visit(page, route);
        await metadataAndLinks(page, route);
      });
      for (const width of widths)
        await runCase(route + " layout " + width, () =>
          responsiveAudit(page, route, width),
        );
    }
    await runCase("internal destinations and image responses", () =>
      destinationAudit(page),
    );
  } finally {
    await context.close();
  }
  await runCase("event CTA type/date/focus on all four formats", eventCTAFlow);
  await runCase(
    "mobile menu to booking and Escape restores the visible opener",
    mobileMenuFlow,
  );
  await runCase(
    "native cross-document quote persistence and personal-data privacy",
    crossDocumentPrivacyFlow,
  );
  await runCase(
    "catalog failure/retry updates provider and gallery through one store",
    sharedCatalogRetryFlow,
  );
  await runCase("no browser runtime errors", async () =>
    assert.deepEqual(runtimeErrors, []),
  );
  await writeFile(
    path.join(artifactDir, "report.json"),
    JSON.stringify(
      {
        engine: engineName,
        routes,
        widths,
        completed,
        failures,
        runtimeErrors,
      },
      null,
      2,
    ) + "\n",
  );
  assert.deepEqual(failures, [], "Multipage browser regressions");
  console.log(
    "PASS: 10 public routes, 80 responsive checks, 20 axe audits, metadata/links/images, date-first event CTAs, mobile menu focus, native quote/privacy persistence and shared gallery retry.",
  );
  console.log(
    "Deep occupied-date, availability-error and dialog-tab keyboard cases remain in the existing booking/experience suites.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
