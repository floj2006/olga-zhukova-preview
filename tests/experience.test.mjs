import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";
const dataDir = await mkdtemp("artifacts/experience-test-"),
  password = randomBytes(24).toString("base64url");
const server = await createSiteServer({
  dataDir,
  env: {
    NODE_ENV: "test",
    ADMIN_PASSWORD_HASH: await hashPassword(password),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`,
  browser = await chromium.launch();
const visitor = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  }),
  owner = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
const page = await visitor.newPage(),
  admin = await owner.newPage(),
  errors = [];
function watch(tab) {
  tab.on("pageerror", (error) => errors.push(error.message));
  tab.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      !/401 \(Unauthorized\)|409 \(Conflict\)|503 \(Service Unavailable\)/.test(
        msg.text(),
      )
    )
      errors.push(msg.text());
  });
}
for (const tab of [page, admin]) watch(tab);
async function audit(tab, label) {
  const result = await new AxeBuilder({ page: tab })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
    [],
    label,
  );
}
async function selectMonth(month, refresh = false) {
  if (!(await page.locator("#booking-dialog").isVisible())) await page.locator(".hero-calendar-link").click();
  await page.locator("#booking-date-tab").click();
  if (!(await page.locator(`#calendar-days [data-date="${month}-17"]`).count()))
    await page.locator("#calendar-next").click();
  if (refresh)
    await page.evaluate(() =>
      document.dispatchEvent(new Event("olga:date-recheck")),
    );
  await expect(page.locator("#calendar-days")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
try {
  await page.goto(base, { waitUntil: "networkidle" });
  const formatTabs = page.locator('.format-tabs [role="tab"]');
  await expect(formatTabs).toHaveCount(4);
  await page.locator('#service-options input[value="host"]').check();
  await page.locator('#service-options [data-service-id="host"] input[type="number"]').fill('6');
  for (let index = 0; index < 4; index++) {
    await formatTabs.nth(index).click();
    await expect(page.locator('.formats-ready [role="tabpanel"]:visible')).toHaveCount(1);
    const card = page.locator('.formats-ready [role="tabpanel"]:visible .event-card');
    await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    const format = await card.getAttribute('data-event');
    await card.click();
    await expect(page.locator('[name=eventType]')).toHaveValue(format);
    await expect(page.locator('#hero-event-type')).toHaveValue(format);
    await expect(page.locator('#service-options input[value="host"]')).toBeChecked();
    await expect(page.locator('#service-options [data-service-id="host"] input[type="number"]')).toHaveValue('6');
    await expect(page.locator('#result-price')).toHaveText(/48\s?000/);
    await expect(page.locator('.formats-ready [role="tabpanel"]:visible')).toHaveCSS('animation-name', 'none');
  }
  await page.locator('#reset-services').click();
  await formatTabs.last().focus();
  await page.keyboard.press('ArrowRight');
  await expect(formatTabs.first()).toBeFocused();
  await expect(formatTabs.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(formatTabs.last()).toBeFocused();
  await page.keyboard.press('Home');
  await page.locator('.event-card[data-event="wedding"]').click();
  await audit(page, 'Event formats and keyboard navigation');
  const month = await page.evaluate(() => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  });
  const date17 = `${month}-17`,
    date18 = `${month}-18`,
    date19 = `${month}-19`;
  await admin.goto(`${base}/admin/`, { waitUntil: "networkidle" });
  await admin.locator("#password").fill(password);
  await admin.locator("#login-submit").click();
  await expect(admin.locator("#workspace")).toBeVisible();
  await admin.locator("#tab-calendar").click();
  await expect(admin.locator("#calendar-editor")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await admin.locator("#calendar-next").click();
  await expect(admin.locator("#calendar-jump")).toHaveValue(month);
  await admin.locator("#calendar-jump").fill("2035-06");
  await admin.locator("#calendar-jump").dispatchEvent("change");
  await expect(admin.locator('#calendar-days [data-date="2035-06-01"]')).toBeVisible();
  await admin.locator("#calendar-today").click();
  const currentMonth = await admin.evaluate(async () => (await import('/booking-rules.js')).eventToday().slice(0, 7));
  await expect(admin.locator("#calendar-jump")).toHaveValue(currentMonth);
  await expect(admin.locator('#calendar-days [aria-current="date"]')).toHaveCount(1);
  await admin.locator("#calendar-jump").fill("2032-01");
  await admin.locator("#calendar-jump").dispatchEvent("change");
  await admin.locator('[data-date="2032-01-31"]').focus();
  await admin.keyboard.press("PageDown");
  await expect(admin.locator('[data-date="2032-02-29"]')).toBeFocused();
  await admin.keyboard.press("ArrowRight");
  await expect(admin.locator('[data-date="2032-03-01"]')).toBeFocused();
  await admin.keyboard.press("End");
  await expect(admin.locator('[data-date="2032-03-31"]')).toBeFocused();
  await admin.keyboard.press("Home");
  await expect(admin.locator('[data-date="2032-03-01"]')).toBeFocused();
  await admin.keyboard.press("ArrowLeft");
  await expect(admin.locator('[data-date="2032-02-29"]')).toBeFocused();
  await expect(admin.locator('#calendar-days [data-busy="true"]')).toHaveCount(0);
  await admin.locator("#calendar-jump").fill(month);
  await admin.locator("#calendar-jump").dispatchEvent("change");
  await admin.locator(`[data-date="${date17}"]`).click();
  await expect(admin.locator("#calendar-message")).toContainText(
    "Календарь сохранён",
  );
  await admin.reload({ waitUntil: "networkidle" });
  await admin.locator("#tab-calendar").click();
  await expect(admin.locator("#calendar-editor")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await admin.locator("#calendar-next").click();
  await expect(
    admin.locator(`#calendar-days [data-date="${date17}"]`),
  ).toHaveAttribute("data-busy", "true");
  await admin.locator(".admin-busy-date summary").click();
  await admin
    .locator(".admin-date-form textarea")
    .fill("Личная заметка, скрытая от посетителей");
  await admin.locator(".admin-date-form button[type=submit]").click();
  await expect(admin.locator("#calendar-message")).toContainText(
    "Календарь сохранён",
  );
  const publicDates = await (
    await page.request.get(`${base}/api/availability?month=${month}`)
  ).json();
  await expect(admin.locator("#calendar-upcoming")).toContainText("Ближайшая занятая дата");
  await admin.locator("#calendar-search").fill("СКРЫТАЯ");
  await expect(admin.locator(".admin-busy-date")).toHaveCount(1);
  await admin.locator("#calendar-period").selectOption("past");
  await expect(admin.locator(".admin-busy-date")).toHaveCount(0);
  await admin.locator("#calendar-period").selectOption("upcoming");
  await admin.locator(".admin-busy-date summary").click();
  await admin.locator(".admin-date-form textarea").fill("Несохранённая заметка");
  await admin.locator("#calendar-jump").fill("2035-06");
  await admin.locator("#calendar-jump").dispatchEvent("change");
  await expect(admin.locator(".admin-date-form textarea")).toHaveValue("Несохранённая заметка");
  await admin.locator("#calendar-search").fill("не существующая площадка");
  await expect(admin.locator(".admin-busy-date")).toHaveCount(0);
  await admin.locator("#calendar-search").fill("");
  await admin.locator(".admin-busy-date summary").click();
  await expect(admin.locator(".admin-date-form textarea")).toHaveValue("Несохранённая заметка");
  await admin.locator(".admin-date-form textarea").fill("Личная заметка, скрытая от посетителей");
  await admin.getByRole("button", { name: "Показать в календаре" }).click();
  await expect(admin.locator(`#calendar-days [data-date="${date17}"]`)).toBeFocused();
  await admin.screenshot({ path: "artifacts/admin-calendar-filters.png" });
  assert.deepEqual(publicDates, { month, busyDates: [date17] });
  await selectMonth(month);
  await page.locator(`#calendar-days [data-date="${date17}"]`).click();
  await expect(page.locator("#calendar-status")).toContainText("уже занята");
  await expect(page.locator("#calendar-services")).toBeHidden();
  await expect(page.locator("#booking-date-tab")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.locator(`#calendar-days [data-date="${date18}"]`).click();
  await expect(page.locator("#calendar-status")).toContainText("дата свободна");
  await page.locator("#calendar-services").click();
  await expect(page.locator("#booking-services-tab")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#hero-service-options")).toBeVisible();
  await expect(page.locator("[name=eventDate]")).toHaveValue(date18);
  await page.locator("#booking-close").click();
  await page.locator("[name=eventDate]").fill(date19);
  await page.locator("[name=eventDate]").blur();
  await expect(page.locator("#hero-date-label")).toContainText("19");
  await page.locator(".hero-calendar-link").click();
  await page.locator("#hero-date-label").click();
  await expect(
    page.locator(`#calendar-days [data-date="${date19}"]`),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("#hero-clear-date").click();
  await expect(page.locator("[name=eventDate]")).toHaveValue("");
  await expect(page.locator("#calendar-days [aria-pressed=true]")).toHaveCount(
    0,
  );
  await page.locator(`#calendar-days [data-date="${date18}"]`).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[name=eventDate]")).toHaveValue(date18);
  await page.locator(".hero-calendar-link").click();
  await expect(
    page.locator(`#calendar-days [data-date="${date18}"]`),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#hero-date-label")).toContainText("18");
  await page.screenshot({ path: "artifacts/calendar-desktop.png" });
  await audit(page, "Public calendar");
  await page.locator("#booking-services-tab").click();
  await page.locator("#hero-request").click();
  await expect(page.locator("#request-dialog")).toBeVisible();
  await expect(page.locator("[name=eventDate]")).toHaveValue(date18);
  await expect(page.locator("#request-date")).toContainText("18");
  await page.locator("[name=name]").fill("Календарная заявка");
  await page.locator("[name=phone]").fill("+7 900 123-45-67");
  await page.locator("[name=consent]").check();
  await page.locator("#send-request").click();
  await expect(page.locator("#request-status")).toContainText(
    "Заявка сохранена",
  );
  await page.locator("#request-done").click();
  await expect(page.locator(".hero-calendar-link")).toBeFocused();
  assert.deepEqual(
    (
      await (
        await page.request.get(`${base}/api/availability?month=${month}`)
      ).json()
    ).busyDates,
    [date17],
    "A lead never books the date automatically",
  );
  await admin.locator("#calendar-multiple").check();
  await admin.locator(`#calendar-days [data-date="${date18}"]`).click();
  await admin.locator(`#calendar-days [data-date="${date19}"]`).click();
  await admin.locator("#calendar-mark-busy").click();
  await expect(admin.locator("#calendar-message")).toContainText(
    "Календарь сохранён",
  );
  await admin.locator(`#calendar-days [data-date="${date19}"]`).click();
  await admin.locator("#calendar-mark-free").click();
  await expect(admin.locator("#calendar-message")).toContainText(
    "Календарь сохранён",
  );
  await selectMonth(month, true);
  await expect(
    page.locator(`#calendar-days [data-date="${date18}"]`),
  ).toHaveAttribute("data-busy", "true");
  await page.locator(`#calendar-days [data-date="${date19}"]`).click();
  await admin.locator("#calendar-multiple").uncheck();
  await admin.locator(`#calendar-days [data-date="${date19}"]`).click();
  await expect(admin.locator("#calendar-message")).toContainText(
    "Календарь сохранён",
  );
  await page.locator("#booking-services-tab").click();
  await page.evaluate(() => {
    window.failedDateRequests = [];
    document.addEventListener('olga:metric', e => {
      if (e.detail.value?.action === 'request_open') window.failedDateRequests.push(e.detail);
    });
  });
  await page.locator("#hero-request").click();
  await expect(page.locator("#calendar-status")).toContainText("уже занята");
  assert.deepEqual(await page.evaluate(() => window.failedDateRequests), [], 'A rejected date does not count as an opened request');
  await expect(page.locator("#hero-booking-feedback")).toContainText(
    "уже занята",
  );
  await expect(page.locator("#request-dialog")).toBeHidden();
  await admin.screenshot({ path: "artifacts/admin-calendar.png" });
  await audit(admin, "Admin calendar");

  await admin.locator("#tab-gallery").click();
  await admin.locator("#photo-alt").fill("Описание до выбора файла");
  await admin.locator("#photo-caption").fill("Подпись до выбора файла");
  await admin.locator("#photo-file").setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(admin.locator("#gallery-message")).toContainText("Не удалось открыть фотографию");
  await expect(admin.locator("#upload-preview")).toBeHidden();
  await expect(admin.locator("#upload-clear")).toBeHidden();
  await expect(admin.locator("#photo-alt")).toHaveValue("Описание до выбора файла");
  await expect(admin.locator("#photo-caption")).toHaveValue("Подпись до выбора файла");
  assert.equal(await admin.locator("#photo-file").evaluate(input => input.files.length), 0);
  const inputs = [
    "public/olga.jpg",
    "public/images/evening.jpg",
    "public/images/celebration.jpg",
  ];
  for (const [i, file] of inputs.entries()) {
    await admin.locator("#photo-file").setInputFiles(file);
    await admin.locator("#photo-alt").fill(`Проверка фото ${i + 1}`);
    await admin.locator("#photo-caption").fill(`Подпись ${i + 1}`);
    if (i === 0) {
      await admin.locator("#upload-clear").click();
      await expect(admin.locator("#photo-file")).toBeFocused();
      await expect(admin.locator("#upload-preview")).toBeHidden();
      await expect(admin.locator("#photo-alt")).toHaveValue("Проверка фото 1");
      await expect(admin.locator("#photo-caption")).toHaveValue("Подпись 1");
      assert.equal(await admin.locator("#photo-file").evaluate(input => input.files.length), 0);
      await admin.locator("#photo-file").setInputFiles(file);
      await admin.locator("#photo-published").uncheck();
    }
    if (i === 1) await admin.locator("#photo-featured").check();
    await admin.locator("#upload-submit").click();
    await expect(admin.locator(".admin-photo")).toHaveCount(i + 1);
    if (i === 0) {
      await expect(admin.locator("#gallery-message")).toContainText("скрыта с сайта");
      await expect(admin.locator("#upload-clear")).toBeHidden();
      const uploaded = admin.locator(".admin-photo").first();
      await uploaded.getByRole("checkbox", { name: "Показывать на сайте", exact: true }).check();
      await uploaded.locator("button[type=submit]").click();
      await expect(uploaded.locator(".admin-message")).toContainText("сохранены");
    }
  }
  await admin
    .locator(".admin-photo")
    .nth(1)
    .getByRole("button", { name: /Переместить раньше/ })
    .click();
  await expect(admin.locator("#gallery-message")).toContainText(
    "Порядок фотографий сохранён",
  );
  await admin.reload({ waitUntil: "networkidle" });
  await admin.locator("#tab-gallery").click();
  await expect(
    admin.locator(".admin-photo").first().locator("img"),
  ).toHaveAttribute("alt", "Проверка фото 2");
  await admin
    .locator(".admin-photo")
    .last()
    .getByRole("checkbox", { name: "Крупный акцентный кадр" })
    .check();
  await admin
    .locator(".admin-photo")
    .last()
    .locator("button[type=submit]")
    .click();
  await expect(
    admin.locator(".admin-photo").last().locator(".admin-message"),
  ).toContainText("сохранены");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".gallery-item")).toHaveCount(3);
  const portfolio = await visitor.newPage();
  watch(portfolio);
  await portfolio.goto(base + "/portfolio", { waitUntil: "networkidle" });
  await expect(portfolio.locator(".gallery-item")).toHaveCount(3);
  assert.deepEqual(
    await portfolio.locator(".gallery-item").evaluateAll((items) => items.map((item) => item.dataset.photoId)),
    await admin.locator(".admin-photo").evaluateAll((items) => items.map((item) => item.dataset.photoId)),
    "Portfolio uses the gallery order saved by the administrator",
  );
  await expect(portfolio.locator(".portfolio-empty")).toHaveCount(0);
  // Publication is reversible; hiding does not remove the photo or reorder the others.
  const firstPhoto = admin.locator(".admin-photo").first();
  await firstPhoto.getByRole("checkbox", { name: "Показывать на сайте", exact: true }).uncheck();
  await firstPhoto.locator("button[type=submit]").click();
  await expect(firstPhoto.locator(".admin-message")).toContainText("сохранены");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".gallery-item")).toHaveCount(2);
  await portfolio.reload({ waitUntil: "networkidle" });
  await expect(portfolio.locator(".gallery-item")).toHaveCount(2);
  const hiddenPhotoId = await firstPhoto.getAttribute("data-photo-id");
  await expect(portfolio.locator('.gallery-item[data-photo-id="' + hiddenPhotoId + '"]')).toHaveCount(0);
  await admin.locator("#gallery-filter").selectOption("draft");
  await expect(admin.locator(".admin-photo:visible")).toHaveCount(1);
  await expect(firstPhoto.getByRole("button", { name: /Переместить позже/ })).toBeDisabled();
  const captionInput = firstPhoto.getByLabel("Подпись на сайте");
  const originalCaption = await captionInput.inputValue();
  await captionInput.fill("Несохранённая подпись");
  await admin.locator("#gallery-search").fill("нет такого снимка");
  await expect(admin.locator("#gallery-filter-empty")).toBeVisible();
  await admin.locator("#gallery-search").fill("НЕСОХРАНЁННАЯ");
  await expect(firstPhoto).toBeVisible();
  await expect(captionInput).toHaveValue("Несохранённая подпись");
  await captionInput.fill(originalCaption);
  await admin.locator("#gallery-search").fill("");
  await admin.locator("#gallery-filter").selectOption("published");
  await expect(admin.locator(".admin-photo:visible")).toHaveCount(2);
  await admin.locator("#gallery-filter").selectOption("");
  await expect(admin.locator(".admin-photo:visible")).toHaveCount(3);
  await admin.reload({ waitUntil: "networkidle" });
  await admin.locator("#tab-gallery").click();
  await expect(admin.locator(".admin-photo")).toHaveCount(3);
  await expect(firstPhoto.getByRole("checkbox", { name: "Показывать на сайте", exact: true })).not.toBeChecked();
  await firstPhoto.getByRole("checkbox", { name: "Показывать на сайте", exact: true }).check();
  await firstPhoto.locator("button[type=submit]").click();
  await expect(firstPhoto.locator(".admin-message")).toContainText("сохранены");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".gallery-item")).toHaveCount(3);
  await expect(page.locator(".gallery-item").first()).toHaveAttribute(
    "data-featured",
    "true",
  );
  await portfolio.reload({ waitUntil: "networkidle" });
  await expect(portfolio.locator(".gallery-item")).toHaveCount(3);
  await expect(portfolio.locator(".gallery-item").first()).toHaveAttribute("data-featured", "true");
  await portfolio.close();
  for (const image of await page.locator("#gallery img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
  const brokenGallery = await visitor.newPage();
  await brokenGallery.route("**/uploads/**", route => route.fulfill({ status: 200, contentType: "image/png", body: "invalid image" }));
  await brokenGallery.goto(base, { waitUntil: "networkidle" });
  const brokenPhoto = brokenGallery.locator('.gallery-open').first();
  await brokenPhoto.scrollIntoViewIfNeeded();
  await expect(brokenPhoto).toHaveAttribute('data-image-error', 'true');
  await expect(brokenPhoto.locator('.gallery-open-hint')).toContainText('Фото не загрузилось');
  await brokenPhoto.click();
  await expect(brokenGallery.locator('.lightbox-feedback')).toContainText('Фото не загрузилось');
  await expect(brokenGallery.locator('.lightbox-image')).toBeHidden();
  await brokenGallery.unroute("**/uploads/**");
  await brokenGallery.keyboard.press('ArrowRight');
  await expect(brokenGallery.locator('.lightbox-image')).toBeVisible();
  await expect.poll(() => brokenGallery.locator('.lightbox-image').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await brokenGallery.keyboard.press('Escape');
  await expect(brokenPhoto).toBeFocused();
  await brokenGallery.close();
  const brokenAdmin = await owner.newPage();
  await brokenAdmin.route("**/uploads/**", route => route.fulfill({ status: 200, contentType: "image/png", body: "invalid image" }));
  await brokenAdmin.goto(`${base}/admin/`, { waitUntil: "networkidle" });
  await brokenAdmin.locator("#tab-gallery").click();
  const adminPhoto = brokenAdmin.locator(".admin-photo").first();
  await adminPhoto.scrollIntoViewIfNeeded();
  await expect(adminPhoto.locator(".admin-photo-fallback")).toBeVisible();
  await expect(adminPhoto.locator("img")).toBeHidden();
  await adminPhoto.getByLabel("Подпись на сайте").fill("Черновик при ошибке фото");
  await audit(brokenAdmin, "Admin image fallback accessibility");
  await brokenAdmin.setViewportSize({ width: 320, height: 740 });
  await adminPhoto.scrollIntoViewIfNeeded();
  assert.equal(await brokenAdmin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Admin image fallback must fit 320px");
  await expect(adminPhoto.getByRole("button", { name: "Загрузить фото снова" })).toBeVisible();
  await brokenAdmin.unroute("**/uploads/**");
  await adminPhoto.getByRole("button", { name: "Загрузить фото снова" }).click();
  await expect(adminPhoto.locator(".admin-photo-fallback")).toBeHidden();
  await expect(adminPhoto.locator("img")).toBeVisible();
  await expect.poll(() => adminPhoto.locator("img").evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(adminPhoto.getByLabel("Подпись на сайте")).toHaveValue("Черновик при ошибке фото");
  await brokenAdmin.screenshot({ path: "artifacts/admin-photo-recovered-mobile.png" });
  await brokenAdmin.close();
  await page.locator("#gallery-title").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/gallery-editorial.png" });
  await page.locator(".gallery-open").first().click();
  await expect(page.locator("#gallery-lightbox")).toBeVisible();
  await expect(page.locator("#lightbox-counter")).toHaveText("01 / 03");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#lightbox-counter")).toHaveText("02 / 03");
  await page.getByRole("button", { name: "Предыдущая фотография" }).click();
  await expect(page.locator("#lightbox-counter")).toHaveText("01 / 03");
  await audit(page, "Lightbox");
  await page.keyboard.press("Escape");
  await expect(page.locator(".gallery-open").first()).toBeFocused();
  for (const [width, height] of [
    [320, 640],
    [360, 780],
    [375, 812],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1024, 900],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await admin.setViewportSize({ width, height });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Public overflow ${width}`,
    );
    assert.ok(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Admin overflow ${width}`,
    );
    await page.locator("#top").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/hero-${width}.png` });
    if (width <= 600) {
      const contentWidth = await page.locator(".hero-content").evaluate(el => el.getBoundingClientRect().width);
      assert.ok(contentWidth >= width * .8, `Mobile Hero uses the full content column ${width}`);
      const portrait = await page.locator(".hero-portrait").boundingBox();
      const content = await page.locator(".hero-content").boundingBox();
      const action = await page.locator(".hero [data-discuss]").boundingBox();
      assert.ok(portrait.y >= content.y && portrait.y + portrait.height <= action.y, "Portrait is visible beside the name before the mobile CTA");
    }
    await page.locator(".hero-calendar-link").click();
    await expect(page.locator("#calendar-days")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    assert.ok(
      await page
        .locator("#hero-booking")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Calendar overflow ${width}`,
    );
    if (width === 320) {
      await page.screenshot({ path: "artifacts/calendar-320.png" });
      await audit(page, "Calendar 320");
    }
    await page.locator("#booking-close").click();
    await admin.locator("#tab-calendar").click();
    assert.ok(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Admin calendar overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".gallery-open").first().click();
  await page.locator(".lightbox-stage").evaluate((el) => {
    const touch = new Touch({
      identifier: 1,
      target: el,
      clientX: 290,
      clientY: 200,
    });
    el.dispatchEvent(
      new TouchEvent("touchstart", { touches: [touch], bubbles: true }),
    );
    const end = new Touch({
      identifier: 1,
      target: el,
      clientX: 80,
      clientY: 220,
    });
    el.dispatchEvent(
      new TouchEvent("touchend", { changedTouches: [end], bubbles: true }),
    );
  });
  await expect(page.locator("#lightbox-counter")).toHaveText("02 / 03");
  await page.screenshot({ path: "artifacts/lightbox-mobile.png" });
  await page.keyboard.press("Escape");
  await page.route("**/api/availability?*", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.locator(".hero-calendar-link").click();
  await page.locator("#booking-date-tab").click();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("olga:date-recheck")),
  );
  await expect(page.locator("#calendar-status")).toContainText(
    "Не удалось проверить",
  );
  await expect(page.locator("#calendar-days button:enabled")).toHaveCount(0);
  await expect(page.locator("#calendar-services")).toBeHidden();
  await page.locator("#booking-services-tab").click();
  await page.locator("#hero-request").click();
  await expect(page.locator("#hero-booking-feedback")).toContainText(
    "Не удалось проверить",
  );
  await expect(page.locator("#request-dialog")).toBeHidden();
  const persisted = JSON.parse(await readFile(`${dataDir}/state.json`, "utf8"));
  assert.equal(persisted.leads[0].eventDate, date18);
  assert.equal(persisted.availability.dates.length, 3);
  assert.ok(
    persisted.catalog.gallery.every(
      (photo) => photo.width <= 2048 && photo.height <= 2048,
    ),
  );
  assert.deepEqual(errors, [], "Runtime and console errors");
  console.log(
    "PASS: persistent admin calendar, private notes, bulk edits, cross-visitor availability, date-to-lead, stale-date check, gallery ordering/featured/optimization, lightbox keyboard/swipe, 320–1920 layouts, accessibility and fail-closed calendar.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
