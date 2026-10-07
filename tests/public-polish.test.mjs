import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium, expect } from "@playwright/test";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";

// This runner needs a completed production build. Catalog requests are mocked;
// the remaining local API uses a fresh temporary directory and random credentials.
const artifactDir = path.resolve("artifacts/public-polish");
await mkdir(artifactDir, { recursive: true });
const catalog = JSON.parse(await readFile(new URL("../server/catalog-default.json", import.meta.url), "utf8"));
const dataDir = await mkdtemp(path.join(os.tmpdir(), "olga-public-polish-"));
const server = await createSiteServer({
  dataDir,
  env: {
    NODE_ENV: "test",
    ADMIN_PASSWORD_HASH: await hashPassword(randomBytes(24).toString("base64url")),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
const report = { completed: [], failures: [], runtimeErrors: [], typography: [], motion: [], gallery: [] };
let browser;
let currentPage;

async function runCase(label, task) {
  try {
    await task();
    report.completed.push(label);
    console.log("PASS " + label);
  } catch (error) {
    report.failures.push({ label, message: error.message });
    console.error("FAIL " + label + ": " + error.message);
    if (currentPage && !currentPage.isClosed()) {
      await currentPage.screenshot({ path: path.join(artifactDir, "failure-" + label.replace(/[^a-z0-9]+/gi, "-") + ".png"), fullPage: true }).catch(() => {});
    }
  }
}

async function newPage(viewport, { delayedCatalog = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  // Browser/environment warnings are not runtime exceptions.
  page.on("pageerror", (error) => report.runtimeErrors.push({ url: page.url(), message: error.message }));
  await page.addInitScript(() => {
    const ids = new WeakMap();
    let nextId = 0;
    window.__polish = { animations: [], headerAnimations: [], shifts: [], contacts: [], watchContacts: false };
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (!ids.has(this)) ids.set(this, ++nextId);
      const animation = original.call(this, frames, options);
      if (this.matches(".reveal,[data-editorial-reveal],[data-editorial-entrance]")) {
        const item = {
          id: ids.get(this), target: this === window.__polishTarget,
          name: this.id || this.className,
          transforms: animation.effect.getKeyframes().map((frame) => frame.transform).filter(Boolean),
          samples: [],
        };
        window.__polish.animations.push(item);
        const sample = () => {
          item.samples.push({ y: this.getBoundingClientRect().top + scrollY, transform: getComputedStyle(this).transform });
          if (animation.playState === "running" || animation.playState === "pending") requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
      return animation;
    };
    document.addEventListener("animationstart", (event) => {
      if (event.target.closest?.(".header")) window.__polish.headerAnimations.push(event.animationName);
    }, true);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__polish.shifts.push({
          value: entry.value, time: entry.startTime,
          sources: entry.sources.map((source) => source.node?.id || source.node?.className || source.node?.tagName),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
    const contactFrame = () => {
      if (window.__polish.watchContacts) {
        const contact = document.getElementById("contact");
        if (contact) window.__polish.contacts.push({ top: contact.getBoundingClientRect().top, time: performance.now() });
      }
      requestAnimationFrame(contactFrame);
    };
    requestAnimationFrame(contactFrame);
  });
  let release;
  let intercepted = false;
  const gate = delayedCatalog ? new Promise((resolve) => { release = resolve; }) : Promise.resolve();
  let value = structuredClone(catalog);
  await page.route("**/api/catalog", async (route) => {
    intercepted = true;
    await gate;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
  return { context, page, setCatalog(next) { value = next; }, release() { release?.(); }, intercepted() { return intercepted; } };
}

async function visit(page, route, ready = true) {
  const response = await page.goto(base + route, { waitUntil: "domcontentloaded" });
  assert.equal(response.status(), 200);
  await page.evaluate(() => document.fonts.ready);
  if (ready) await expect(page.locator("#hero-booking")).toHaveAttribute("data-catalog-state", "ready");
}

// Poll actual animation/scroll frames until positions settle, with a bounded deadline.
async function stableFrames(page, selectors = ["#header", "main h1"]) {
  return page.evaluate(async (selectors) => {
    const nodes = selectors.map((selector) => document.querySelector(selector)).filter(Boolean);
    const start = performance.now();
    let previous, stable = 0;
    while (performance.now() - start < 8000) {
      await new Promise(requestAnimationFrame);
      const positions = [scrollY, ...nodes.flatMap((node) => {
        const box = node.getBoundingClientRect();
        return [box.top, box.left, box.width, box.height];
      })];
      const active = nodes.some((node) => node.getAnimations().some((animation) => animation.playState === "running"));
      stable = !active && previous && positions.every((value, index) => Math.abs(value - previous[index]) < 0.2) ? stable + 1 : 0;
      previous = positions;
      if (stable >= 8) return positions;
    }
    throw new Error("Positions did not settle within the frame polling deadline");
  }, selectors);
}

async function bookingMotion(page) {
  const panels = page.locator('.booking-dialog [role="tabpanel"]:not([hidden])');
  await expect(panels).toHaveCount(1);
  await expect(panels).toBeVisible();
  const styles = await page.locator('.booking-dialog [role="tabpanel"]:not([hidden]),.booking-dialog .calendar-days').evaluateAll((nodes) => nodes.map((node) => ({ id: node.id, animation: getComputedStyle(node).animationName, transform: getComputedStyle(node).transform })));
  assert.ok(styles.length >= 2, "inspect active booking panel and calendar grid");
  for (const node of styles) {
    assert.equal(node.animation, "none", node.id + " has a positional booking/calendar entrance animation");
    assert.equal(node.transform, "none", node.id + " opens with a transformed pose");
  }
  return styles;
}

function cls(entries) {
  let maximum = 0, total = 0, first = -Infinity, previous = -Infinity;
  for (const entry of entries) {
    if (entry.time - previous > 1000 || entry.time - first > 5000) { total = 0; first = entry.time; }
    total += entry.value;
    maximum = Math.max(maximum, total);
    previous = entry.time;
  }
  return maximum;
}

try {
  browser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 360, height: 844 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 1024, height: 900 }, { width: 1024, height: 600 },
    { width: 1366, height: 768 }, { width: 1440, height: 1000 },
  ];
  const prose = {
    "/": ".hero-description,.about-content .body-copy,.format-description",
    "/events": ".events-index-intro-grid p,.format-description",
    "/services": ".services-intro-grid > div > p:first-child,.service-notes dd",
    "/contacts": ".contact-editorial-copy > p:not(.eyebrow)",
  };
  for (const viewport of viewports) {
    await runCase("reading sizes and layout " + viewport.width + "x" + viewport.height, async () => {
      const { context, page } = await newPage(viewport);
      try {
        for (const [route, selector] of Object.entries(prose)) {
          await visit(page, route);
          await stableFrames(page);
          await expect(page.locator("main h1")).toBeVisible();
          const metrics = await page.evaluate((selector) => {
            const visible = (node) => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden";
            const fonts = (nodes) => [...nodes].filter(visible).map((node) => ({ text: node.textContent.trim().slice(0, 55), size: parseFloat(getComputedStyle(node).fontSize) }));
            return {
              width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
              body: parseFloat(getComputedStyle(document.querySelector(".public-site")).fontSize),
              prose: fonts(document.querySelectorAll(selector)),
              buttons: fonts(document.querySelectorAll(".public-site .button")),
            };
          }, selector);
          report.typography.push({ viewport, route, ...metrics });
          assert.ok(metrics.scrollWidth <= metrics.width + 1, route + " has horizontal overflow");
          assert.ok(metrics.body >= 16, route + " body size is below 16px");
          assert.ok(metrics.prose.length > 0, route + " contains readable prose");
          for (const item of metrics.prose) assert.ok(item.size >= 16, route + " small prose: " + JSON.stringify(item));
          assert.ok(metrics.buttons.length > 0, route + " contains a visible primary button");
          for (const item of metrics.buttons) assert.ok(item.size >= 14, route + " small button: " + JSON.stringify(item));
        }
      } finally { await context.close(); }
    });
  }

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await runCase("normal motion remains in place " + viewport.width, async () => {
      const { context, page } = await newPage(viewport);
      try {
        await visit(page, "/");
        await stableFrames(page);
        const initial = await page.locator("#hero-title,.hero-image,#header").evaluateAll((nodes) => nodes.map((node) => ({ name: node.id || node.className, animation: getComputedStyle(node).animationName, transform: getComputedStyle(node).transform, opacity: Number(getComputedStyle(node).opacity) })));
        for (const node of initial) {
          assert.equal(node.animation, "none", node.name + " starts a CSS entrance animation");
          assert.equal(node.transform, "none", node.name + " starts with a transformed pose");
          assert.equal(node.opacity, 1, node.name + " is initially hidden/faded");
        }
        // A real wheel scroll crosses the header state boundary twice.
        await page.mouse.wheel(0, 140);
        await expect(page.locator("#header")).toHaveClass(/scrolled/);
        await stableFrames(page);
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await expect(page.locator("#header")).not.toHaveClass(/scrolled/);
        await page.mouse.wheel(0, 140);
        await expect(page.locator("#header")).toHaveClass(/scrolled/);
        await stableFrames(page);
        const header = await page.locator("#header").evaluate((node) => ({ top: node.getBoundingClientRect().top, transform: getComputedStyle(node).transform }));
        assert.ok(Math.abs(header.top) < 1, "header jumps away from viewport top");
        assert.equal(header.transform, "none");
        assert.deepEqual(await page.evaluate(() => window.__polish.headerAnimations), []);
        const anchorId = viewport.width <= 1200 ? "about" : "events";
        if (viewport.width <= 1200) {
          await page.locator("#menu-toggle").click();
          await page.locator('#mobile-menu a[href="#about"]').click();
        } else {
          await page.locator(".scroll-cue").click();
        }
        await expect(page).toHaveURL(base + "/#" + anchorId);
        await stableFrames(page, ["#header", "#" + anchorId]);
        assert.equal(await page.locator("#" + anchorId).evaluate((node) => getComputedStyle(node).transform), "none", "anchor destination has a transformed pose");

        const before = await page.evaluate(() => {
          const target = [...document.querySelectorAll("main .reveal,[data-editorial-reveal]")].find((node) => node.getClientRects().length && node.getBoundingClientRect().top > innerHeight + 160);
          if (!target) throw new Error("No offscreen reveal target to exercise");
          window.__polishTarget = target;
          const y = target.getBoundingClientRect().top + scrollY;
          scrollTo({ top: y - innerHeight / 2, behavior: "instant" });
          return y;
        });
        await expect.poll(() => page.evaluate(() => window.__polish.animations.filter((item) => item.target).length), { message: "Normal scroll exercises a reveal animation" }).toBeGreaterThan(0);
        await page.evaluate(async () => {
          await new Promise(requestAnimationFrame);
          await Promise.all(window.__polishTarget.getAnimations().map((animation) => animation.finished.catch(() => {})));
        });
        await stableFrames(page);
        const motion = await page.evaluate(() => window.__polish.animations.filter((item) => item.target));
        for (const item of motion) {
          assert.ok(item.transforms.every((value) => value === "none"), "reveal keyframes translate content");
          assert.ok(item.samples.length > 1, "sample the actual animated frames");
          for (const sample of item.samples) {
            assert.equal(sample.transform, "none", "reveal transforms content during scroll");
            assert.ok(Math.abs(sample.y - before) < 1, "reveal moves content in document coordinates (including the former 20px jump)");
          }
        }
        const count = await page.evaluate(() => window.__polish.animations.length);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
        await stableFrames(page);
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(false);
        await stableFrames(page);
        assert.equal(await page.evaluate(() => window.__polish.animations.length), count, "changing motion preference replays revealed content");
        for (const index of [1, 2, 3, 0]) {
          await page.locator("#format-tab-" + index).click();
          await expect(page.locator("#format-tab-" + index)).toHaveAttribute("aria-selected", "true");
          const panel = page.locator(".formats-ready > .format-panel:not([hidden])");
          await expect(panel).toHaveCount(1);
          await expect(panel).toBeVisible();
          await expect(panel).toHaveAttribute("id", "format-panel-" + index);
          const style = await panel.evaluate((node) => ({ animation: getComputedStyle(node).animationName, transform: getComputedStyle(node).transform }));
          assert.equal(style.animation, "none", "format " + index + " enters with a positional animation");
          assert.equal(style.transform, "none", "format " + index + " starts with a transformed pose");
        }
        await page.evaluate(() => document.dispatchEvent(new Event("olga:phone-details")));
        await expect(page.locator("#contact-dialog")).toBeVisible();
        const contact = await page.locator("#contact-dialog").evaluate((node) => ({ animation: getComputedStyle(node).animationName, transform: getComputedStyle(node).transform, bodySize: parseFloat(getComputedStyle(node.querySelector(".dialog-event")).fontSize) }));
        assert.equal(contact.animation, "none", "contact details enters with a positional animation");
        assert.equal(contact.transform, "none", "contact details starts with a transformed pose");
        assert.ok(contact.bodySize >= 16, "contact details body is below 16px");
        await page.keyboard.press("Escape");
        await expect(page.locator("#contact-dialog")).toBeHidden();
        await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
        report.motion.push({ viewport, initial, header, targetDocumentY: before, animations: motion, contact });
      } finally { await context.close(); }
    });

    await runCase("events navigation is native with four formats " + viewport.width, async () => {
      const { context, page } = await newPage(viewport);
      try {
        await visit(page, "/");
        await page.evaluate(() => { window.__polishDocumentToken = "home-document"; });
        let link = page.locator('.desktop-nav a[href="/events"]');
        if (viewport.width <= 1200) {
          await page.locator("#menu-toggle").click();
          await expect(page.locator("#mobile-menu")).toBeVisible();
          link = page.locator('#mobile-menu nav a[href="/events"]');
        }
        await expect(link).toHaveAttribute("href", "/events");
        await Promise.all([page.waitForURL(base + "/events"), link.click()]);
        await expect(page.locator("#hero-booking")).toHaveAttribute("data-catalog-state", "ready");
        assert.equal(await page.evaluate(() => window.__polishDocumentToken), undefined, "events link did not perform native document navigation");
        await expect(page.locator("#events .event-card")).toHaveCount(4);
        for (const type of ["wedding", "corporate", "anniversary", "graduation"]) {
          const card = page.locator('#events .event-card[data-event="' + type + '"]');
          await expect(card).toBeVisible();
          await expect(card.locator(".format-cta")).toHaveAttribute("href", "/events/" + type);
          const calculate = card.locator(".format-calc-link");
          await expect(calculate).toHaveAttribute("data-discuss", "");
          await expect(calculate).toHaveAttribute("data-event", type);
          await calculate.click();
          await expect(page.locator("#booking-dialog")).toBeVisible();
          await expect(page.locator("#booking-date-tab")).toHaveAttribute("aria-selected", "true");
          await expect(page.locator("#booking-date-tab")).toBeFocused();
          await expect(page.locator("#booking-date-panel")).toBeVisible();
          await expect(page.locator("#hero-event-type")).toHaveValue(type);
          await expect(page).toHaveURL(base + "/events");
          await bookingMotion(page);
          await page.locator("#booking-services-tab").click();
          await expect(page.locator("#booking-services-panel")).toBeVisible();
          await expect(page.locator("#booking-services-tab")).toHaveAttribute("aria-selected", "true");
          await bookingMotion(page);
          await page.keyboard.press("Escape");
          await expect(page.locator("#booking-dialog")).toBeHidden();
          await expect(calculate).toBeFocused();
        }
        await page.evaluate(() => { window.__polishDocumentToken = "events-document"; });
        await Promise.all([
          page.waitForURL(base + "/events/wedding"),
          page.locator('#events .event-card[data-event="wedding"] .format-cta').click(),
        ]);
        await expect(page.locator("#hero-booking")).toHaveAttribute("data-catalog-state", "ready");
        assert.equal(await page.evaluate(() => window.__polishDocumentToken), undefined, "format details link did not perform native navigation");
        await expect(page.locator("#booking-dialog")).toBeHidden();
      } finally { await context.close(); }
    });

    await runCase("delayed CMS gallery avoids layout jumps " + viewport.width, async () => {
      const fixture = await newPage(viewport, { delayedCatalog: true });
      const { context, page } = fixture;
      try {
        const value = structuredClone(catalog);
        value.gallery = [
          { id: "polish-test-1", url: "/images/olga-1024.webp", alt: "Тестовый кадр один", caption: "Тестовый кадр", published: true, featured: true, width: 1024, height: 1536 },
          { id: "polish-test-2", url: "/images/olga-768.webp", alt: "Тестовый кадр два", caption: "Тестовый кадр", published: true, width: 768, height: 1152 },
        ];
        fixture.setCatalog(value);
        await visit(page, "/portfolio", false);
        await expect.poll(fixture.intercepted).toBe(true);
        await expect(page.locator(".portfolio-loading")).toBeVisible();
        await stableFrames(page, [".portfolio-materials", "#contact"]);
        const before = await page.evaluate(() => {
          window.__polish.shifts = [];
          window.__polish.contacts = [];
          window.__polish.watchContacts = true;
          return { contactTop: document.getElementById("contact").getBoundingClientRect().top, height: innerHeight };
        });
        assert.ok(before.contactTop >= before.height, "contacts flash into the initial viewport while photographs are loading");
        fixture.release();
        await expect(page.locator("#hero-booking")).toHaveAttribute("data-catalog-state", "ready");
        await expect(page.locator("#gallery .gallery-item")).toHaveCount(2);
        await expect(page.locator("#gallery")).toBeVisible();
        await expect(page.locator(".portfolio-loading")).toHaveCount(0);
        await expect.poll(() => page.locator("#gallery img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), { message: "Fixture photographs decode" }).toBe(true);
        await stableFrames(page, [".portfolio-materials", "#contact", ".gallery-item"]);
        const result = await page.evaluate(() => {
          window.__polish.watchContacts = false;
          return { shifts: window.__polish.shifts, contacts: window.__polish.contacts, tiles: [...document.querySelectorAll(".gallery-item")].map((node) => ({ transform: getComputedStyle(node).transform, opacity: getComputedStyle(node).opacity })) };
        });
        const maximumCLS = cls(result.shifts);
        report.gallery.push({ viewport, before, maximumCLS, ...result });
        assert.ok(maximumCLS < 0.1, "delayed fixture gallery CLS was " + maximumCLS);
        assert.ok(result.contacts.length > 0, "recorded actual loading frames");
        assert.ok(result.contacts.every((frame) => frame.top >= before.height), "contacts flash into viewport during intermediate gallery commits");
        for (const tile of result.tiles) {
          assert.equal(tile.transform, "none", "gallery tile reveals with positional movement");
          assert.equal(tile.opacity, "1", "gallery tile disappears after mounting");
        }
        const opener = page.locator("#gallery .gallery-open").first();
        await opener.click();
        await expect(page.locator("#gallery-lightbox")).toBeVisible();
        const lightbox = await page.locator("#gallery-lightbox").evaluate((node) => ({ animation: getComputedStyle(node).animationName, transform: getComputedStyle(node).transform, captionSize: parseFloat(getComputedStyle(node.querySelector(".lightbox-caption")).fontSize) }));
        assert.equal(lightbox.animation, "none", "portal lightbox enters with a positional animation");
        assert.equal(lightbox.transform, "none", "portal lightbox starts with a transformed pose");
        assert.ok(lightbox.captionSize >= 16, "lightbox caption is below 16px");
        await page.keyboard.press("Escape");
        await expect(page.locator("#gallery-lightbox")).toBeHidden();
        await expect(opener).toBeFocused();
        await expect(page.locator("body")).not.toHaveClass(/dialog-open/);
        report.gallery.at(-1).lightbox = lightbox;
      } finally { fixture.release(); await context.close(); }
    });
  }
  await runCase("menu breakpoint focus inert and resize regression", async () => {
    for (const width of [901, 1024, 1200, 1201]) {
      const { context, page } = await newPage({ width, height: 800 });
      try {
        await visit(page, "/");
        const toggle = page.locator("#menu-toggle");
        let events = page.locator('.desktop-nav a[href="/events"]');
        if (width <= 1200) {
          await expect(toggle).toBeVisible();
          await toggle.click();
          await expect(page.locator("#mobile-menu")).toBeVisible();
          await expect(page.locator('#mobile-menu nav a').first()).toBeFocused();
          assert.equal(await page.locator("main").evaluate((node) => node.inert), true, "main stays interactive under open menu at " + width);
          assert.equal(await page.locator(".public-site > .footer").evaluate((node) => node.inert), true, "footer stays interactive under open menu at " + width);
          await page.locator(".mobile-menu-close").focus();
          await page.keyboard.press("Shift+Tab");
          await expect(page.locator("#mobile-menu .menu-phone")).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(page.locator(".mobile-menu-close")).toBeFocused();
          await page.keyboard.press("Escape");
          await expect(page.locator("#mobile-menu")).toBeHidden();
          await expect(toggle).toBeFocused();
          assert.equal(await page.locator("main").evaluate((node) => node.inert), false, "main remains inert after Escape at " + width);
          assert.equal(await page.locator(".public-site > .footer").evaluate((node) => node.inert), false, "footer remains inert after Escape at " + width);
          await expect(page.locator("body")).not.toHaveClass(/menu-open/);
          await toggle.click();
          events = page.locator('#mobile-menu nav a[href="/events"]');
        } else {
          await expect(toggle).toBeHidden();
          await expect(events).toBeVisible();
        }
        await Promise.all([page.waitForURL(base + "/events"), events.click()]);
        await expect(page.locator("#hero-booking")).toHaveAttribute("data-catalog-state", "ready");
        await expect(page.locator("#events .event-card")).toHaveCount(4);
        await expect(page.locator("#mobile-menu")).toBeHidden();
        assert.equal(await page.locator("main").evaluate((node) => node.inert), false);
        await expect(page.locator("body")).not.toHaveClass(/menu-open/);
      } finally { await context.close(); }
    }
    const { context, page } = await newPage({ width: 1024, height: 800 });
    try {
      await visit(page, "/");
      await page.locator("#menu-toggle").click();
      await expect(page.locator("#mobile-menu")).toBeVisible();
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(page.locator("#mobile-menu")).toBeHidden();
      await expect(page.locator("#menu-toggle")).toBeHidden();
      await expect(page.locator("body")).not.toHaveClass(/menu-open/);
      assert.equal(await page.locator("main").evaluate((node) => node.inert), false, "resize leaves main inert");
      assert.equal(await page.locator(".public-site > .footer").evaluate((node) => node.inert), false, "resize leaves footer inert");
    } finally { await context.close(); }
  });
  assert.deepEqual(report.runtimeErrors, [], "no browser runtime exceptions");
} catch (error) {
  report.failures.push({ label: "runner", message: error.message });
} finally {
  await writeFile(path.join(artifactDir, "report.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log(JSON.stringify({ passed: report.completed.length, failed: report.failures.length, artifact: path.join(artifactDir, "report.json") }));
if (report.failures.length) process.exitCode = 1;
