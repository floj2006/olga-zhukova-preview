import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { createSiteServer } from "../scripts/serve.mjs";

await mkdir("artifacts", { recursive: true });
const dataDir = await mkdtemp("artifacts/loading-test-");
const server = await createSiteServer({ dataDir, env: { NODE_ENV: "test" } });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const errors = [];
async function newPage(options = {}) {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    ...options,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}
async function delay(page, pattern) {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}
try {
  const loading = await newPage({ viewport: { width: 390, height: 844 } });
  const release = await delay(loading, "**/api/catalog");
  await loading.goto(base, { waitUntil: "commit" });
  await expect(loading.locator("#hero-title")).toBeVisible();
  await expect(loading.locator("dialog[open]")).toHaveCount(0);
  await loading.locator(".hero-calendar-link").click();
  await expect(loading.locator("#booking-dialog")).toBeVisible();
  await expect(loading.locator("#booking-date-tab")).toBeFocused();
  assert.equal(
    await loading
      .locator("#booking-dialog")
      .evaluate((node) => node.getAnimations().length),
    0,
  );
  release();
  await expect(loading.locator("#hero-request")).toBeEnabled();
  await loading.locator("#calendar-next").click();
  await expect(loading.locator("#calendar-days")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await loading.locator("#calendar-days button:enabled").nth(17).click();
  await expect(loading.locator("#booking-date-panel")).toBeVisible();
  await expect(loading.locator("#calendar-services")).toBeVisible();
  await expect(loading.locator("#hero-request")).toHaveText(/ВЫБРАТЬ УСЛУГИ/);
  await loading.locator("#hero-request").click();
  await expect(loading.locator("#request-dialog")).toBeHidden();
  await expect(loading.locator("#booking-services-panel")).toBeVisible();
  await expect(loading.locator("#booking-services-tab")).toBeFocused();
  await loading.keyboard.press("Escape");
  await expect(loading.locator(".hero-calendar-link")).toBeFocused();
  const scan = await new AxeBuilder({ page: loading })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    scan.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((n) => n.target),
    })),
    [],
  );

  const offline = await newPage();
  await offline.route("**/api/availability?*", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await offline.goto(base, { waitUntil: "networkidle" });
  await expect(offline.locator("#hero-title")).toBeVisible();
  await expect(offline.locator("dialog[open]")).toHaveCount(0);
  await offline.locator(".hero-calendar-link").click();
  await expect(offline.locator("#calendar-retry")).toBeVisible();
  await expect(offline.locator("#calendar-days button:enabled")).toHaveCount(0);
  await offline.locator("#booking-services-tab").click();
  await expect(offline.locator("#hero-service-options")).toBeVisible();

  // Restored date remains selected while the calendar API is delayed.
  const late = await newPage();
  const date = new Date();
  date.setMonth(date.getMonth() + 2, 18);
  const savedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-18`;
  await late.addInitScript(
    (date) =>
      sessionStorage.setItem(
        "olga-service-builder-v2",
        JSON.stringify({
          selected: { host: 4 },
          eventType: "wedding",
          eventDate: date,
        }),
      ),
    savedDate,
  );
  const releaseCalendar = await delay(late, "**/api/availability?*");
  await late.goto(base, { waitUntil: "commit" });
  await expect(late.locator("#hero-booking")).toHaveAttribute(
    "data-catalog-state",
    "ready",
  );
  await expect(late.locator("[name=eventDate]")).toHaveValue(savedDate);
  await late.locator(".hero-calendar-link").click();
  await expect(late.locator("#calendar-days")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  releaseCalendar();
  await expect(late.locator("#calendar-days")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(late.locator("#page-loader")).toBeHidden();
  await expect(
    late.locator(`#calendar-days [data-date="${savedDate}"]`),
  ).toHaveAttribute("aria-pressed", "true");

  const noJS = await newPage({ javaScriptEnabled: false });
  await noJS.goto(base);
  await expect(noJS.locator("#page-loader")).toBeHidden();
  await expect(noJS.locator(".no-script")).toBeVisible();
  const retryPage = await newPage();
  const navigation = await newPage({ viewport: { width: 1440, height: 900 } });
  await navigation.goto(base, { waitUntil: "networkidle" });
  for (const id of ["about", "program", "calculator"]) {
    const link = navigation.locator(`.desktop-nav a[href="#${id}"]`);
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect(navigation.locator(`#${id}`)).toBeFocused();
    assert.ok(
      await navigation
        .locator(`#${id}`)
        .evaluate(
          (el) =>
            el.getBoundingClientRect().top >=
            document.querySelector(".header-inner").getBoundingClientRect()
              .bottom -
              2,
        ),
      "Heading remains below fixed header",
    );
  }
  await navigation.locator('#service-options input[value="host"]').check();
  await navigation.locator(".final-cta [data-discuss]").click();
  await expect(navigation.locator("#request-dialog")).toBeHidden();
  await expect(navigation.locator("#booking-date-panel")).toBeVisible();
  await expect(navigation.locator("#booking-date-tab")).toBeFocused();
  await navigation.locator("#hero-request").click();
  await expect(navigation.locator("#booking-services-panel")).toBeVisible();
  await expect(
    navigation.locator('#hero-service-options input[value="host"]'),
  ).toBeChecked();
  await expect(navigation.locator("#hero-price")).toHaveText(/32\s?000/);
  await expect(
    navigation.locator('#service-options input[value="host"]'),
  ).toBeChecked();
  await navigation.keyboard.press("Escape");
  await expect(navigation.locator(".final-cta [data-discuss]")).toBeFocused();
  await navigation.setViewportSize({ width: 390, height: 844 });
  await navigation.locator("#menu-toggle").click();
  await navigation.locator('.mobile-menu a[href="/events"]').click();
  await expect(navigation.locator("#mobile-menu")).toBeHidden();
  await expect(navigation).toHaveURL(base + "/events");
  await expect(
    navigation.locator(".event-overview-grid .event-card"),
  ).toHaveCount(4);
  await expect(
    navigation.locator('.mobile-menu a[href="/events"]'),
  ).toHaveAttribute("aria-current", "page");
  await navigation.goto(base, { waitUntil: "networkidle" });
  await navigation.evaluate(() => scrollTo(0, 0));
  await expect(navigation.locator(".desktop-nav [aria-current]")).toHaveCount(
    0,
  );
  await navigation.close();
  await retryPage.clock.install();
  const attempts = [];
  await retryPage.route("**/api/leads", async (route) => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) return; // Simulate a lost response after the request was sent.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await retryPage.goto(base, { waitUntil: "networkidle" });
  await retryPage.evaluate(() => {
    window.conversionActions = [];
    document.addEventListener("olga:metric", (e) => {
      if (e.detail.name === "conversion")
        window.conversionActions.push(e.detail.value);
    });
  });
  await retryPage.locator(".hero [data-discuss]").click();
  await expect(retryPage.locator("#booking-date-panel")).toBeVisible();
  await expect(retryPage.locator("#booking-date-tab")).toBeFocused();
  assert.deepEqual(await retryPage.evaluate(() => window.conversionActions), [
    { action: "booking_open" },
    { action: "calendar_open" },
  ]);
  await expect(retryPage.locator("#hero-request")).toHaveText(
    /ДАТУ ВЫБЕРЕМ ПОЗЖЕ/,
  );
  await retryPage.locator("#hero-request").click();
  assert.deepEqual(await retryPage.evaluate(() => window.conversionActions), [
    { action: "booking_open" },
    { action: "calendar_open" },
    { action: "services_view" },
  ]);
  await expect(retryPage.locator("#booking-services-panel")).toBeVisible();
  await expect(retryPage.locator("#request-dialog")).toBeHidden();
  await expect(retryPage.locator("#hero-request")).toHaveText(
    /БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ/,
  );
  await retryPage.locator("#hero-request").click();
  await expect(retryPage.locator("#request-quote-note")).toContainText(
    "Услуги пока не выбраны",
  );
  assert.deepEqual(
    await retryPage.evaluate(() => window.conversionActions.at(-1)),
    { action: "request_open" },
  );
  const quoteAudit = await new AxeBuilder({ page: retryPage })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    quoteAudit.violations.map((v) => v.id),
    [],
  );
  await retryPage.locator("[name=name]").fill("Черновик имени");
  await retryPage.locator("#request-edit").click();
  await expect(retryPage.locator("#booking-services-tab")).toBeFocused();
  await retryPage.locator('#hero-service-options input[value="host"]').check();
  await retryPage
    .locator(
      '#hero-service-options [data-service-id="host"] input[type=number]',
    )
    .fill("6");
  await retryPage.locator("#hero-event-type").selectOption("corporate");
  await retryPage.locator("#hero-extra-meetings").fill("2");
  await retryPage.locator("#hero-request").click();
  await expect(retryPage.locator("[name=name]")).toHaveValue("Черновик имени");
  await expect(retryPage.locator("#request-date")).toContainText(
    "Корпоратив · Дату обсудим",
  );
  await expect(retryPage.locator("#request-summary")).toContainText("Ведущая");
  await expect(retryPage.locator("#request-total")).toHaveText(/50\s?000/);
  for (const width of [1440, 390, 320]) {
    await retryPage.setViewportSize({ width, height: 900 });
    assert.ok(
      await retryPage
        .locator("#request-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await retryPage.screenshot({
      path: "artifacts/booking-summary-" + width + ".png",
    });
  }
  await retryPage.locator("[name=name]").fill("Тест повтора");
  await retryPage.locator("[name=phone]").fill("..........");
  await retryPage.locator("[name=consent]").check();
  await retryPage.locator("#send-request").click();
  assert.equal(attempts.length, 0, "Invalid phone never reaches API");
  await retryPage.locator("[name=phone]").fill("+7 900 123-45-67");
  await retryPage.locator("#send-request").click();
  await expect.poll(() => attempts.length).toBe(1);
  await retryPage.clock.fastForward(21000);
  await expect(retryPage.locator("#request-status")).toContainText(
    "Сервер не успел ответить",
  );
  await expect(retryPage.locator("#send-request")).toBeEnabled();
  await retryPage.locator("#send-request").click();
  await expect(retryPage.locator("#request-status")).toContainText(
    "Заявка сохранена",
  );
  assert.deepEqual(attempts[1].items, [{ id: "host", quantity: 6 }]);
  assert.equal(attempts[1].extraMeetings, 2);
  assert.equal(attempts[1].eventType, "corporate");
  assert.deepEqual(
    await retryPage.evaluate(() => window.conversionActions.at(-1)),
    { action: "lead_saved" },
  );
  assert.ok(
    await retryPage.evaluate(() =>
      window.conversionActions.every((v) => Object.keys(v).join() === "action"),
    ),
    "Conversion events contain no contact or event details",
  );
  assert.equal(
    attempts[0].requestId,
    attempts[1].requestId,
    "Retry preserves idempotency key",
  );
  assert.deepEqual(errors, [], "Runtime errors");
  console.log(
    "PASS: nonblocking loading, calendar dialog, explicit services step, focus return, reduced motion, API failure, no JS and delayed calendar restoration.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
