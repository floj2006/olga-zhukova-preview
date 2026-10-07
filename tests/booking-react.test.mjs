import { chromium, webkit, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { createSiteServer } from "../scripts/serve.mjs";
await mkdir("artifacts", { recursive: true });
const server = await createSiteServer({
  dataDir: await mkdtemp("artifacts/booking-${label}-test-"),
  env: { NODE_ENV: "test" },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const engine = process.env.BROWSER === "webkit" ? webkit : chromium;
const label = engine.name();
const browser = await engine.launch();
const context = await browser.newContext({
  ...(label === "webkit"
    ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : {}),
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(new URL(r.url()).pathname));
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".hero [data-discuss]").click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page.locator("#booking-date-tab")).toBeFocused();
  await page.locator("#calendar-next").click();
  const dateButton = page.locator("#calendar-days button:enabled").nth(17);
  await expect(dateButton).toBeEnabled();
  const date = await dateButton.getAttribute("data-date");
  await dateButton.click();
  await page.screenshot({
    path: `artifacts/booking-${label}-calendar-390.png`,
  });
  await page.locator("#hero-request").click();
  const selectStyle = await page
    .locator("#hero-event-type")
    .evaluate((el) => ({
      appearance: getComputedStyle(el).appearance,
      background: getComputedStyle(el).backgroundColor,
    }));
  assert.deepEqual(selectStyle, {
    appearance: "none",
    background: "rgb(13, 12, 10)",
  });
  await page.locator("#hero-service-options input[value=host]").check();
  await page.locator("#hero-service-options input[value=dj]").check();
  await page
    .locator("#hero-service-options [data-service-id=host] input[type=number]")
    .fill("6");
  await expect(page.locator("#hero-price")).toHaveText(/60\s?000/);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page
        .locator("#booking-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `artifacts/booking-${label}-services-${width}.png`,
    });
  }
  // A late availability response must not switch steps after closing/reopening.
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/availability?*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.locator("#hero-request").click();
  await expect(page.locator("#hero-request")).toBeDisabled();
  await page.locator("#booking-close").click();
  await page.locator(".hero [data-discuss]").click();
  release();
  await expect(page.locator("#calendar-days")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator("#booking-date-panel")).toBeVisible();
  await expect(page.locator("#request-dialog")).toBeHidden();
  await page.unroute("**/api/availability?*");
  await page.locator("#hero-clear-date").click();
  await expect(
    page.locator(`#calendar-days [data-date="${date}"]`),
  ).toBeVisible();
  await page.locator("#hero-request").click();
  await page.locator("#hero-request").click();
  await expect(page.locator("#request-dialog")).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  assert.equal(
    await page.locator("#request-dialog").evaluate((el) => el.tagName),
    "SECTION",
  );
  const attempts = [];
  await page.route("**/api/leads", async (route) => {
    attempts.push(route.request().postDataJSON());
    await route.fulfill({
      status: attempts.length === 1 ? 503 : 200,
      contentType: "application/json",
      body:
        attempts.length === 1
          ? JSON.stringify({
              error: "Не удалось сохранить заявку. Повторите попытку.",
            })
          : "{}",
    });
  });
  await page.locator("[name=name]").fill("Тест единого окна");
  await page.locator("[name=phone]").fill("+7 900 123-45-67");
  await page.locator("[name=consent]").check();
  // Smaller visible viewport models the space remaining above a phone keyboard.
  await page.setViewportSize({ width: 390, height: 420 });
  await page.locator("[name=phone]").focus();
  await page.locator("[name=phone]").scrollIntoViewIfNeeded();
  await expect(page.locator("[name=phone]")).toBeInViewport();
  await expect(page.locator("#booking-close")).toBeInViewport();
  await page.locator("#send-request").click();
  await expect(page.locator("#request-status")).toContainText(
    "Не удалось сохранить",
  );
  await expect(page.locator("[name=name]")).toHaveValue("Тест единого окна");
  await page.locator("#request-edit").click();
  await page
    .locator("#hero-service-options [data-service-id=host] input[type=number]")
    .fill("5");
  await page.locator("#hero-request").click();
  await expect(page.locator("#request-total")).toHaveText(/52\s?000/);
  await expect(page.locator("[name=name]")).toHaveValue("Тест единого окна");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#booking-dialog").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: `artifacts/booking-${label}-contact-390.png` });
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
  );
  await page.locator("#send-request").click();
  await expect(page.locator("#request-success")).toBeVisible();
  assert.notEqual(
    attempts[0].requestId,
    attempts[1].requestId,
    "Editing the quote after failure uses a new idempotency key",
  );
  assert.deepEqual(attempts[1].items, [
    { id: "host", quantity: 5 },
    { id: "dj", quantity: 4 },
  ]);
  await page.locator("#request-done").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".hero [data-discuss]")).toBeFocused();
  const saved = await page.evaluate(() =>
    sessionStorage.getItem("olga-service-builder-v2"),
  );
  assert.ok(
    !saved.includes("Тест единого окна") && !saved.includes("900"),
    "Contact details are not persisted",
  );
  for (const legacy of [
    "/service-builder.js",
    "/availability.js",
    "/booking-dialog.js",
  ])
    assert.ok(!requests.includes(legacy), "No legacy handler " + legacy);
  const invalidContext = await browser.newContext();
  const invalid = await invalidContext.newPage();
  invalid.on("pageerror", (error) => errors.push(error.message));
  await invalid.addInitScript(() =>
    sessionStorage.setItem(
      "olga-service-builder-v2",
      JSON.stringify({
        eventDate: "9999-99-99",
        eventType: "__proto__",
        selected: {},
      }),
    ),
  );
  await invalid.goto(base, { waitUntil: "networkidle" });
  await invalid.locator(".hero [data-discuss]").click();
  await expect(invalid.locator("#booking-date-panel")).toBeVisible();
  await expect(invalid.locator("[name=eventDate]")).toHaveValue("");
  await expect(invalid.locator("#hero-event-type")).toHaveValue("wedding");
  await invalidContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: one React dialog, date/services/contact state, late response cancellation, unchanged month after date clearing, editable retry payload, privacy, 320/390/1440px, constrained mobile viewport and accessibility.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
