import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";

await mkdir("artifacts", { recursive: true });
const dataDir = await mkdtemp("artifacts/site-test-");
const password = randomBytes(24).toString("base64url");
const server = await createSiteServer({
  dataDir,
  env: {
    NODE_ENV: "test",
    ADMIN_PASSWORD_HASH: await hashPassword(password),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
function watch(page) {
  page.on("pageerror", (error) =>
    errors.push(page.url() + ": " + error.message),
  );
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !/401 \(Unauthorized\)|409 \(Conflict\)|503 \(Service Unavailable\)/.test(
        msg.text(),
      )
    )
      errors.push(msg.text());
  });
}
const page = await context.newPage();
watch(page);
const numericTotal = async () =>
  Number(
    (await page.locator("#result-price").textContent()).replace(/\D/g, ""),
  );
async function audit(target, width) {
  await target.setViewportSize({ width, height: 1000 });
  assert.ok(
    await target.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `Overflow at ${width}`,
  );
  const scan = await new AxeBuilder({ page: target })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    `Accessibility ${width}`,
  );
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(
    await page.locator("canvas,[data-scene-3d]").count(),
    0,
    "3D objects removed",
  );
  assert.equal(
    await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((r) => /hero-scene|three/.test(r.name)),
    ),
    false,
  );
  await page.screenshot({ path: "artifacts/desktop-hero.png" });
  await expect(page.locator(".service-option")).toHaveCount(3);
  await page.locator(".hero-calendar-link").click();
  await page.locator("#booking-services-tab").click();
  const mainService = (id) =>
    page.locator(`#service-options [data-service-id="${id}"]`);
  const heroService = (id) =>
    page.locator(`#hero-service-options [data-service-id="${id}"]`);
  await heroService("host").locator("input[type=checkbox]").check();
  await expect(
    mainService("host").locator("input[type=checkbox]"),
  ).toBeChecked();
  await heroService("host").locator("input[type=number]").fill("5");
  await expect(mainService("host").locator("input[type=number]")).toHaveValue(
    "5",
  );
  assert.equal(await numericTotal(), 40000);
  await page.locator("#booking-close").click();
  const hostQuantity = mainService("host").locator("input[type=number]");
  for (const invalid of ["0", "25", "2.5", ""]) {
    await hostQuantity.fill(invalid);
    assert.equal(
      await numericTotal(),
      40000,
      "Invalid quantity never changes quote",
    );
    await hostQuantity.blur();
    await expect(hostQuantity).toHaveValue("5");
    await expect(heroService("host").locator("input[type=number]")).toHaveValue(
      "5",
    );
  }
  await hostQuantity.fill("1");
  await expect(
    mainService("host").getByRole("button", {
      name: "Ведущая: уменьшить количество",
    }),
  ).toBeDisabled();
  await mainService("host")
    .getByRole("button", { name: "Ведущая: увеличить количество" })
    .click();
  await expect(hostQuantity).toHaveValue("2");
  await expect(heroService("host").locator("input[type=number]")).toHaveValue(
    "2",
  );
  await hostQuantity.fill("24");
  await expect(
    mainService("host").getByRole("button", {
      name: "Ведущая: увеличить количество",
    }),
  ).toBeDisabled();
  await mainService("host")
    .getByRole("button", { name: "Ведущая: уменьшить количество" })
    .click();
  await expect(hostQuantity).toHaveValue("23");
  await hostQuantity.fill("5");
  await mainService("dj").locator("input[type=checkbox]").check();
  await expect(heroService("dj").locator("input[type=checkbox]")).toBeChecked();
  await mainService("host").locator("input[type=number]").fill("6");
  await expect(heroService("host").locator("input[type=number]")).toHaveValue(
    "6",
  );
  await page.locator(".hero-calendar-link").click();
  await page.locator("#booking-services-tab").click();
  await page.locator("#hero-extra-meetings").fill("2");
  await page.locator("#booking-close").click();
  await expect(page.locator("#extra-meetings")).toHaveValue("2");
  assert.equal(await numericTotal(), 62000);
  await page.locator("#extra-meetings").fill("1");
  await expect(page.locator("#hero-extra-meetings")).toHaveValue("1");
  await expect(page.locator("#hero-price")).toHaveText(/61\s?000/);
  await page.locator("#estimate-details > summary").click();
  await page
    .getByRole("button", { name: "Убрать из расчёта: Ведущая", exact: true })
    .click();
  await expect(
    mainService("host").locator("input[type=checkbox]"),
  ).not.toBeChecked();
  await expect(
    heroService("host").locator("input[type=checkbox]"),
  ).not.toBeChecked();
  assert.equal(await numericTotal(), 13000);
  await expect(page.locator("#request-summary")).not.toContainText("Ведущая");
  await expect(page.locator("#request-summary > div")).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Убрать из расчёта: Дополнительные консультации",
      exact: true,
    })
    .click();
  await expect(page.locator("#extra-meetings")).toHaveValue("0");
  await expect(page.locator("#hero-extra-meetings")).toHaveValue("0");
  await expect(page.locator("#result-summary > div")).toHaveCount(1);
  await expect(page.locator("#request-summary > div")).toHaveCount(1);
  await expect(page.locator("#open-request")).toBeFocused();
  assert.equal(await numericTotal(), 12000);
  await page.locator("#reset-services").click();
  assert.equal(await numericTotal(), 0);
  await expect(page.locator("#hero-service-options input:checked")).toHaveCount(
    0,
  );
  await expect(page.locator("#service-options input:checked")).toHaveCount(0);
  await expect(page.locator("#hero-extra-meetings")).toHaveValue("0");
  await expect(page.locator("#extra-meetings")).toHaveValue("0");
  await expect(page.locator("#hero-price")).toHaveText("Бесплатно");
  await expect(page.locator("#request-summary > div")).toHaveCount(0);
  await expect(page.locator("#result-summary .summary-empty")).toContainText(
    "бесплатную консультацию",
  );
  await page.locator(".hero-calendar-link").click();
  await page.locator("#booking-services-tab").click();
  await page.locator("#hero-request").click();
  await expect(page.locator("#request-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#booking-services-tab")).toBeFocused();
  await page.locator("#booking-close").click();
  await page.locator("#calculator").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Все услуги", exact: true }).click();
  await expect(page.locator(".service-option")).toHaveCount(8);
  assert.equal(await numericTotal(), 0);
  await mainService("host").locator("input[type=checkbox]").check();
  await mainService("dj").locator("input[type=checkbox]").check();
  assert.equal(await numericTotal(), 44000);
  await page
    .locator(".service-option")
    .filter({ has: page.locator('input[value="host"]') })
    .locator("input[type=number]")
    .fill("6");
  assert.equal(await numericTotal(), 60000);
  await page.getByRole("button", { name: "Оборудование", exact: true }).click();
  await expect(page.locator(".service-option")).toHaveCount(4);
  await mainService("led").locator("input[type=checkbox]").check();
  await page.locator("#extra-meetings").fill("2");
  assert.equal(await numericTotal(), 72000);
  await expect(page.locator("#price-prefix")).toHaveText("от ");
  await page.getByRole("button", { name: "Все услуги", exact: true }).click();
  await expect(
    mainService("host").locator("input[type=checkbox]"),
  ).toBeChecked();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await numericTotal(), 72000, "Selections survive reload");
  await page.locator("#calculator").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/compact-services-desktop.png" });
  await page.locator("#exact-quote").click();
  await expect(page.locator("#contact-dialog")).toBeVisible();
  await expect(page.locator("#dialog-event")).toContainText("72");
  await page.keyboard.press("Escape");
  // Keyboard submission from the picker opens contact fields before validation.
  await page.locator("input[name=eventDate]").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#request-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#booking-close").click();
  await page.locator("#open-request").click();
  await page.locator("input[name=name]").fill("Тестовая заявка");
  await page.locator("input[name=phone]").fill("wrong phone");
  assert.equal(
    await page
      .locator("input[name=phone]")
      .evaluate((input) => input.checkValidity()),
    false,
  );
  await page.locator("input[name=phone]").fill("+7 900 123-45-67");
  await page
    .locator("textarea[name=comment]")
    .fill("Проверка заявки и расчёта");
  await page.locator("input[name=consent]").check();
  await page.locator("#send-request").click();
  await expect(page.locator("#request-status")).toContainText(
    "Заявка сохранена",
  );
  await page.locator("#request-done").click();

  const admin = await context.newPage();
  watch(admin);
  await admin.goto(`${base}/admin/`, { waitUntil: "networkidle" });
  await admin.locator("#password").fill(password);
  await admin.locator("#login-submit").click();
  await expect(admin.locator("#workspace")).toBeVisible();
  await expect(admin.locator(".admin-service")).toHaveCount(9);
  await admin.locator("#tab-leads").click();
  await expect(admin.locator(".admin-lead")).toHaveCount(1);
  await admin.locator(".admin-lead summary").click();
  await expect(admin.locator(".admin-lead")).toContainText("72");
  await admin.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    }),
  );
  await admin.getByRole("button", { name: "Скопировать расчёт" }).click();
  const manualQuote = admin.getByLabel("Расчёт для копирования");
  await expect(manualQuote).toBeFocused();
  await expect(manualQuote).toHaveAttribute("readonly", "");
  const copiedQuote = await manualQuote.inputValue();
  assert.match(copiedQuote, /Предварительный расчёт/);
  assert.match(copiedQuote, /Итого:/);
  await admin.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedQuote = text;
        },
      },
    }),
  );
  await admin.getByRole("button", { name: "Скопировать расчёт" }).click();
  await expect(manualQuote).toHaveCount(0);
  assert.equal(await admin.evaluate(() => window.copiedQuote), copiedQuote);
  await admin.locator(".admin-lead select").selectOption("contacted");
  await admin.locator(".admin-lead textarea").fill("Связались, обсуждаем дату");
  await admin.locator("#leads-search").fill("Несуществующий клиент");
  await expect(admin.locator(".admin-lead")).toHaveCount(0);
  await admin.locator("#leads-search").fill("");
  await expect(admin.locator(".admin-lead")).toHaveCount(1);
  await admin.locator(".admin-lead summary").click();
  await expect(admin.locator(".admin-lead textarea")).toHaveValue(
    "Связались, обсуждаем дату",
  );
  await expect(admin.locator(".admin-lead select")).toHaveValue("contacted");
  await admin.getByRole("button", { name: "Сохранить заявку" }).click();
  await expect(
    admin.locator(".admin-lead .admin-message[role=status]"),
  ).toContainText("сохранены");
  await expect(
    admin.getByRole("button", { name: "Отменить правки", exact: true }),
  ).toBeDisabled();
  await admin.locator(".admin-lead select").selectOption("closed");
  await admin.locator(".admin-lead textarea").fill("Правки для отмены");
  await admin
    .getByRole("button", { name: "Отменить правки", exact: true })
    .click();
  await expect(admin.locator(".admin-lead select")).toHaveValue("contacted");
  await expect(admin.locator(".admin-lead textarea")).toHaveValue(
    "Связались, обсуждаем дату",
  );
  await expect(admin.locator(".admin-lead select")).toBeFocused();
  await expect(
    admin.getByRole("button", { name: "Сохранить заявку", exact: true }),
  ).toBeDisabled();
  await admin.locator("#tab-services").click();
  await admin.locator(".admin-service summary").first().click();
  await admin.locator("#service-price-0").fill("8500");
  await admin.locator("#catalog-save").click();
  await expect(admin.locator("#catalog-status")).toContainText("сохранены");
  // A stale quote is refreshed without creating a lead or disabling both entry points.
  await page.locator(".hero-calendar-link").click();
  await page.locator("#booking-services-tab").click();
  await page.locator("#hero-request").click();
  await page.locator("input[name=name]").fill("Проверка изменения тарифа");
  await page.locator("input[name=phone]").fill("+7 900 123-45-67");
  await page.locator("input[name=consent]").check();
  await page.locator("#send-request").click();
  await expect(page.locator("#request-status")).toContainText(
    "Данные расчёта обновились",
  );
  await expect(page.locator("#request-total")).toHaveText(/75\s?000/);
  await expect(page.locator("#result-summary")).toContainText(
    /8\s?500 ₽ × 6 ч/,
  );
  await expect(page.locator("#request-summary")).toContainText(/51\s?000 ₽/);
  await expect(page.locator("#send-request")).toBeEnabled();
  await page.locator("#request-close").click();
  await expect(page.locator("#hero-request")).toBeEnabled();
  await expect(page.locator("#open-request")).toBeEnabled();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await numericTotal(),
    75000,
    "New tariff is applied from server",
  );
  await admin.locator("#add-service").click();
  await admin.locator("#service-title-9").fill("Тестовая услуга");
  await admin.locator("#service-price-9").fill("1500");
  await admin.locator("#catalog-save").click();
  await expect(admin.locator("#catalog-status")).toContainText("сохранены");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Все услуги", exact: true }).click();
  await expect(
    page
      .locator("#service-options")
      .getByRole("checkbox", { name: "Тестовая услуга", exact: true }),
  ).toBeVisible();
  const servicesPage = await context.newPage();
  watch(servicesPage);
  await servicesPage.goto(base + "/services", { waitUntil: "networkidle" });
  await servicesPage
    .getByRole("button", { name: "Все услуги", exact: true })
    .click();
  await servicesPage
    .locator('#service-options [data-service-id="host"] input[type=checkbox]')
    .check();
  await servicesPage
    .locator('#service-options [data-service-id="host"] input[type=number]')
    .fill("2");
  await servicesPage
    .locator("#service-options")
    .getByRole("checkbox", { name: "Тестовая услуга", exact: true })
    .check();
  await expect(servicesPage.locator("#result-price")).toHaveText(/18\s?500/);
  await admin
    .locator(".admin-service")
    .last()
    .getByRole("checkbox", { name: "Показывать на сайте" })
    .uncheck();
  await admin.locator("#catalog-save").click();
  await expect(admin.locator("#catalog-status")).toContainText("сохранены");
  await page.reload({ waitUntil: "networkidle" });
  await expect(
    page.getByRole("checkbox", { name: "Тестовая услуга", exact: true }),
  ).toHaveCount(0);
  await servicesPage.reload({ waitUntil: "networkidle" });
  await expect(
    servicesPage.getByRole("checkbox", {
      name: "Тестовая услуга",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(servicesPage.locator("#result-price")).toHaveText(/17\s?000/);
  await servicesPage.close();
  await admin.locator("#tab-leads").click();
  await admin.locator("#leads-refresh").click();
  await expect(
    admin.locator(".admin-lead .admin-price"),
    "Old lead keeps price snapshot",
  ).toHaveText(/72\s?000/);
  await admin.screenshot({ path: "artifacts/admin-leads.png" });
  await admin.locator("#tab-gallery").click();
  await admin.locator("#photo-file").setInputFiles("public/olga.jpg");
  await admin.locator("#photo-alt").fill("Ольга Жукова на мероприятии");
  await admin.locator("#photo-caption").fill("Тест галереи");
  await admin.locator("#upload-submit").click();
  await expect(admin.locator(".admin-photo")).toHaveCount(1);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#gallery")).toBeVisible();
  await page.locator("#gallery").scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator("#gallery img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await expect(page.locator("#gallery figcaption span").last()).toHaveText(
    "Тест галереи",
  );
  await admin.screenshot({ path: "artifacts/admin-gallery.png" });
  const caption = admin.locator('.admin-photo input[id^="photo-caption-"]');
  await caption.fill("Обновлённая подпись");
  await admin.locator(".admin-photo button[type=submit]").click();
  await expect(admin.locator(".admin-photo .admin-message")).toContainText(
    "сохранены",
  );
  await admin.reload({ waitUntil: "networkidle" });
  await expect(admin.locator("#workspace")).toBeVisible();
  await admin.locator("#tab-gallery").click();
  await expect(
    admin.locator('.admin-photo input[id^="photo-caption-"]'),
  ).toHaveValue("Обновлённая подпись");
  admin.once("dialog", (dialog) => dialog.accept());
  await admin.locator(".admin-photo .danger").click();
  await expect(admin.locator(".admin-photo")).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#gallery")).toBeHidden();

  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [375, 812],
    [430, 932],
    [320, 640],
  ]) {
    await page.setViewportSize({ width, height });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#top").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .locator("#mobile-menu")
    .getByRole("link", { name: "Услуги и цены" })
    .click();
  await expect(page.locator("#mobile-menu")).toBeHidden();
  await page.screenshot({ path: "artifacts/compact-services-mobile.png" });
  await page.locator("#open-request").click();
  await page.screenshot({ path: "artifacts/request-mobile.png" });
  await audit(page, 390);
  await page.locator("#request-close").click();
  for (const width of [1440, 390]) {
    await audit(page, width);
    await audit(admin, width);
  }
  await admin.locator("#logout").click();
  await expect(admin.locator("#login-view")).toBeVisible();
  const noJS = await browser.newPage({ javaScriptEnabled: false });
  await noJS.goto(base);
  await expect(noJS.locator(".no-script")).toBeVisible();
  await expect(noJS.locator(".format-tabs")).toBeHidden();
  await expect(
    noJS.locator(".editorial-formats .event-card:visible"),
  ).toHaveCount(4);
  await expect(
    noJS.locator('.editorial-formats [role="tabpanel"]'),
  ).toHaveCount(0);
  for (const card of await noJS
    .locator(".editorial-formats .event-card")
    .all()) {
    await expect(card.locator('a[href^="/events/"]')).toHaveCount(1);
    await expect(card.locator('a[href="#calculator"]')).toHaveCount(1);
  }
  await noJS.close();
  const fallback = await browser.newPage();
  await fallback.route("**/api/catalog", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await fallback.goto(base, { waitUntil: "networkidle" });
  if (await fallback.locator("#page-loader").isVisible())
    await fallback.locator("#page-loader-continue").click();
  await fallback
    .getByRole("button", { name: "Все услуги", exact: true })
    .click();
  await expect(fallback.locator(".service-option")).toHaveCount(8);
  await expect(fallback.locator("#open-request")).toBeDisabled();
  await expect(fallback.locator("#hero-request")).toBeDisabled();
  await expect(fallback.locator("#hero-booking-feedback")).toContainText(
    "Онлайн-заявка недоступна",
  );
  await expect(fallback.locator("#connection-note")).toBeVisible();
  await fallback.locator('#service-options input[value="host"]').check();
  await fallback
    .locator('#service-options [data-service-id="host"] input[type="number"]')
    .fill("6");
  await fallback.locator("#calculator [data-retry-catalog]").click();
  await expect(fallback.locator("#catalog-retry-status")).toContainText(
    "Связь пока не восстановилась",
  );
  await expect(fallback.locator("#open-request")).toBeDisabled();
  await fallback.unroute("**/api/catalog");
  await fallback.locator("#calculator [data-retry-catalog]").click();
  await expect(fallback.locator("#catalog-retry-status")).toContainText(
    "Услуги обновлены",
  );
  await expect(fallback.locator("#connection-note")).toBeHidden();
  await expect(fallback.locator("#open-request")).toBeEnabled();
  await expect(
    fallback.locator('#service-options input[value="host"]'),
  ).toBeChecked();
  await expect(
    fallback.locator(
      '#service-options [data-service-id="host"] input[type="number"]',
    ),
  ).toHaveValue("6");
  await expect(fallback.locator("#result-price")).toHaveText(/51\s?000/);
  await fallback.locator("#open-request").click();
  await expect(fallback.locator("#request-dialog")).toBeVisible();
  await fallback.keyboard.press("Escape");
  await fallback.close();
  const persisted = JSON.parse(await readFile(`${dataDir}/state.json`, "utf8"));
  assert.equal(persisted.leads.length, 1);
  assert.equal(persisted.leads[0].quote.total, 72000);
  assert.equal(persisted.leads[0].status, "contacted");
  assert.equal(persisted.catalog.services[0].price, 8500);
  assert.deepEqual(errors, [], "Console/runtime errors");
  console.log(
    "PASS: synchronized Hero/main services, quantities, removal/reset, persistence, real lead submission, stale quote recovery, admin login/catalog/leads/gallery, mobile, accessibility, offline fallback; no 3D loads or overflow.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
