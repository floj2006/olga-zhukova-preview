import { after, before, test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { chromium, expect } from "@playwright/test";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";

// Only synthetic records, random credentials and a new temporary store are used.
// The production Next build is read by createSiteServer; this suite never builds it.
const test = (name, task) => nodeTest(name, { timeout: 60000 }, task);
let server;
let browser;
let base;
let image;
let authCookies;
const password = randomBytes(24).toString("base64url");
const runtimeErrors = [];
let artifactNumber = 0;

before(async () => {
  await mkdir("artifacts", { recursive: true });
  const dataDir = await mkdtemp(
    path.join(os.tmpdir(), "olga-admin-regressions-"),
  );
  server = await createSiteServer({
    dataDir,
    env: {
      NODE_ENV: "test",
      ADMIN_PASSWORD_HASH: await hashPassword(password),
      ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  browser = await chromium.launch();
  const bootstrap = await browser.newContext();
  const signedIn = await bootstrap.request.post(base + "/api/admin/login", {
    headers: { Origin: base },
    data: { password },
  });
  assert.equal(signedIn.status(), 200, "Test session uses the real login API");
  authCookies = await bootstrap.cookies(base + "/api/admin/session");
  await bootstrap.close();
  image =
    "data:image/png;base64," +
    (
      await sharp({
        create: { width: 2, height: 2, channels: 3, background: "#c9a227" },
      })
        .png()
        .toBuffer()
    ).toString("base64");
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  assert.deepEqual(
    runtimeErrors,
    [],
    "No browser runtime errors in admin recovery scenarios",
  );
});

async function login(page) {
  await page.locator("#password").fill(password);
  await page.locator("#login-submit").click();
  await expect(page.locator("#workspace")).toBeVisible();
  await expect(page.locator("#add-service")).toBeEnabled();
}

async function withAdmin(task) {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies(authCookies);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  try {
    await page.goto(base + "/admin", { waitUntil: "networkidle" });
    await expect(page.locator("#workspace")).toBeVisible();
    await expect(page.locator("#add-service")).toBeEnabled();
    const session = await (
      await page.request.get(base + "/api/admin/session")
    ).json();
    const auth = {
      context,
      page,
      async call(url, method = "GET", data, expectedStatus = 200) {
        const response = await page.request.fetch(base + url, {
          method,
          headers: { Origin: base, "x-csrf-token": session.csrfToken },
          ...(data === undefined ? {} : { data }),
        });
        assert.equal(response.status(), expectedStatus, method + " " + url);
        return response.json();
      },
    };
    await task(auth);
  } catch (error) {
    await page
      .screenshot({
        path: `artifacts/admin-regression-failure-${++artifactNumber}.png`,
        fullPage: true,
      })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function gateResponse(
  page,
  url,
  method = "GET",
  transform = (value) => value,
) {
  let release;
  let ready;
  let finished;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const captured = new Promise((resolve) => {
    ready = resolve;
  });
  const completed = new Promise((resolve) => {
    finished = resolve;
  });
  let intercepted = false;
  const handler = async (route) => {
    if (intercepted || route.request().method() !== method)
      return route.continue();
    intercepted = true;
    try {
      const response = await route.fetch();
      const data = transform(await response.json());
      ready();
      await gate;
      await route
        .fulfill({
          status: response.status(),
          contentType: "application/json",
          body: JSON.stringify(data),
        })
        .catch(() => {});
    } finally {
      finished();
    }
  };
  await page.route(base + url, handler);
  return {
    captured,
    async release() {
      release();
      await completed;
      await page.unroute(base + url, handler);
      // Let response handlers and the browser's next paint finish, without a timed sleep.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    },
  };
}

async function seedPhoto(auth, alt) {
  return (
    await auth.call(
      "/api/admin/gallery",
      "POST",
      { dataUrl: image, alt, caption: alt },
      201,
    )
  ).photo;
}

async function seedLead(auth) {
  const catalog = await auth.call("/api/catalog");
  const name = "Синтетическая заявка " + randomBytes(4).toString("hex");
  const result = await auth.call(
    "/api/leads",
    "POST",
    {
      requestId: randomUUID(),
      name,
      phone: "+7 900 123-45-67",
      eventType: "wedding",
      eventDate: "",
      comment: "Только тестовое хранилище",
      items: [],
      extraMeetings: 0,
      consent: true,
      website: "",
      catalogVersion: catalog.version,
    },
    201,
  );
  return { ...result, name };
}

async function openLead(auth, lead) {
  await auth.page.locator("#tab-leads").click();
  await auth.page.locator("#leads-refresh").click();
  const row = auth.page.locator(`.admin-lead[data-id="${lead.id}"]`);
  await expect(row).toBeVisible();
  await row.locator("summary").click();
  return row;
}

async function latestLead(auth, id) {
  const result = await auth.call("/api/admin/leads?limit=100");
  const lead = result.leads.find((entry) => entry.id === id);
  assert.ok(lead, "Synthetic lead still exists");
  return lead;
}

for (const operation of ["catalog", "calendar", "gallery"]) {
  test(`late ${operation} response cannot restore private records after logout`, async () =>
    withAdmin(async (auth) => {
      const { page } = auth;
      const marker = "PRIVATE LATE RESPONSE " + randomBytes(5).toString("hex");
      const url =
        operation === "calendar"
          ? "/api/admin/availability"
          : "/api/admin/catalog";
      const held = await gateResponse(page, url, "GET", (value) =>
        operation === "calendar"
          ? {
              ...value,
              dates: [
                {
                  id: randomUUID(),
                  date: "2035-06-17",
                  status: "busy",
                  note: marker,
                },
              ],
            }
          : {
              ...value,
              services: value.services.map((service, index) =>
                index === 0 ? { ...service, title: marker } : service,
              ),
              gallery: [
                ...value.gallery,
                {
                  id: randomUUID(),
                  url: "/olga.jpg",
                  alt: marker,
                  caption: marker,
                  published: false,
                  version: 1,
                },
              ],
            },
      );
      if (operation === "catalog")
        await page.locator("#catalog-reload").click();
      else if (operation === "calendar")
        await page.locator("#tab-calendar").click();
      else {
        await page.locator("#tab-gallery").click();
        await page.locator("#gallery-refresh").click();
      }
      await held.captured;
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("#logout").click();
      await expect(page.locator("#login-view")).toBeVisible();
      await held.release();
      await expect(
        page.locator(".admin-service,.admin-photo,.admin-busy-date"),
      ).toHaveCount(0);
      await expect(page.locator("#workspace")).not.toContainText(marker);
      await login(page);
      await expect(page.locator("#workspace")).not.toContainText(marker);
      if (operation === "calendar")
        await expect(page.locator("#calendar-editor")).toHaveAttribute(
          "aria-busy",
          "false",
        );
    }));
}

test("failed leads refresh retains visible saved records and the local draft", async () =>
  withAdmin(async (auth) => {
    const lead = await seedLead(auth);
    const row = await openLead(auth, lead);
    await row
      .locator("textarea")
      .fill("Черновик не должен исчезнуть из-за сети");
    const failure = (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Синтетическая ошибка обновления",
          code: "storage_unavailable",
        }),
      });
    await auth.page.route("**/api/admin/leads?*", failure);
    await auth.page.locator("#leads-refresh").click();
    await expect(auth.page.locator("#leads-message")).toContainText(
      "Синтетическая ошибка обновления",
    );
    await expect(auth.page.locator("#leads-list")).toBeVisible();
    await expect(row).toBeVisible();
    await expect(row.locator("textarea")).toHaveValue(
      "Черновик не должен исчезнуть из-за сети",
    );
    await expect(
      row.getByRole("button", { name: "Сохранить заявку", exact: true }),
    ).toBeEnabled();
    await auth.page.unroute("**/api/admin/leads?*", failure);
    await row
      .getByRole("button", { name: "Сохранить заявку", exact: true })
      .click();
    await expect(row.locator(".admin-message[role=status]")).toContainText(
      "сохранены",
    );
    assert.equal(
      (await latestLead(auth, lead.id)).note,
      "Черновик не должен исчезнуть из-за сети",
    );
  }));

test("a lead conflict retains the draft and permits an explicit save against the latest version", async () =>
  withAdmin(async (auth) => {
    const lead = await seedLead(auth);
    const row = await openLead(auth, lead);
    await row.locator("select").selectOption("contacted");
    await row.locator("textarea").fill("Мой черновик после конфликта");
    const original = await latestLead(auth, lead.id);
    await auth.call(`/api/admin/leads/${lead.id}`, "PATCH", {
      version: original.version,
      status: "booked",
      note: "Свежая заметка другой вкладки",
    });
    await row
      .getByRole("button", { name: "Сохранить заявку", exact: true })
      .click();
    await expect(
      row.getByRole("button", { name: "Применить мой черновик", exact: true }),
    ).toBeVisible();
    await expect(row.locator("textarea")).toHaveValue(
      "Мой черновик после конфликта",
    );
    await expect(row).toContainText("Свежая заметка другой вкладки");
    await expect(
      row.getByRole("button", { name: "Сохранить заявку", exact: true }),
    ).toBeDisabled();
    assert.equal(
      (await latestLead(auth, lead.id)).note,
      "Свежая заметка другой вкладки",
    );
    await row
      .getByRole("button", { name: "Применить мой черновик", exact: true })
      .click();
    await expect(
      row.getByRole("button", { name: "Сохранить заявку", exact: true }),
    ).toBeEnabled();
    await row
      .getByRole("button", { name: "Сохранить заявку", exact: true })
      .click();
    await expect(row.locator(".admin-message[role=status]")).toContainText(
      "сохранены",
    );
    const saved = await latestLead(auth, lead.id);
    assert.equal(saved.note, "Мой черновик после конфликта");
    assert.equal(saved.status, "contacted");
    await auth.page.reload({ waitUntil: "networkidle" });
    await openLead(auth, lead);
    await expect(row.locator("textarea")).toHaveValue(
      "Мой черновик после конфликта",
    );
  }));

test("refresh detects a stale lead draft and accepting fresh data leaves the newer record intact", async () =>
  withAdmin(async (auth) => {
    const lead = await seedLead(auth);
    const row = await openLead(auth, lead);
    await row.locator("textarea").fill("Черновик для отказа");
    const original = await latestLead(auth, lead.id);
    await auth.call(`/api/admin/leads/${lead.id}`, "PATCH", {
      version: original.version,
      status: "booked",
      note: "Запись актуальной версии",
    });
    await auth.page.locator("#leads-refresh").click();
    await expect(
      row.getByRole("button", { name: "Принять свежие данные", exact: true }),
    ).toBeVisible();
    await expect(row.locator("textarea")).toHaveValue("Черновик для отказа");
    await row
      .getByRole("button", { name: "Принять свежие данные", exact: true })
      .click();
    await expect(row.locator("textarea")).toHaveValue(
      "Запись актуальной версии",
    );
    await expect(row.locator("select")).toHaveValue("booked");
    await expect(
      row.getByRole("button", { name: "Сохранить заявку", exact: true }),
    ).toBeDisabled();
    assert.equal(
      (await latestLead(auth, lead.id)).note,
      "Запись актуальной версии",
    );
  }));

async function assertGalleryLocked(page) {
  await expect(page.locator("#gallery-refresh")).toBeDisabled();
  await expect(page.locator("#upload-submit")).toBeDisabled();
  await expect(page.locator("#gallery-list")).toHaveAttribute("inert", "");
  await expect(
    page.locator(
      ".admin-photo button[type=submit]:enabled,.admin-photo-order button:enabled",
    ),
  ).toHaveCount(0);
}

test("photo saves and deletes lock refresh, order and other photo forms until their response completes", async () =>
  withAdmin(async (auth) => {
    const { page } = auth;
    const first = await seedPhoto(auth, "Синтетическое первое фото");
    const second = await seedPhoto(auth, "Синтетическое второе фото");
    await page.locator("#tab-gallery").click();
    await page.locator("#gallery-refresh").click();
    const firstRow = page.locator(`.admin-photo[data-photo-id="${first.id}"]`);
    const secondRow = page.locator(
      `.admin-photo[data-photo-id="${second.id}"]`,
    );
    await expect(firstRow).toBeVisible();
    await firstRow
      .getByLabel("Подпись на сайте")
      .fill("Сохранённая первая подпись");
    await secondRow
      .getByLabel("Подпись на сайте")
      .fill("Сохранённая вторая подпись");
    let patchRequests = 0;
    page.on("request", (request) => {
      if (
        request.method() === "PATCH" &&
        request.url().includes("/api/admin/gallery/")
      )
        patchRequests++;
    });
    const patch = await gateResponse(
      page,
      `/api/admin/gallery/${first.id}`,
      "PATCH",
    );
    await firstRow.locator("button[type=submit]").click();
    await patch.captured;
    await assertGalleryLocked(page);
    await secondRow.locator("form").evaluate((form) => form.requestSubmit());
    await page.locator("#gallery-refresh").evaluate((button) => button.click());
    await firstRow
      .locator(".admin-photo-order button")
      .last()
      .evaluate((button) => button.click());
    await patch.release();
    assert.equal(
      patchRequests,
      1,
      "An in-flight photo save cannot start a second mutation",
    );
    await expect(firstRow.locator(".admin-message")).toContainText("сохранены");
    await expect(page.locator("#gallery-refresh")).toBeEnabled();
    await expect(secondRow.getByLabel("Подпись на сайте")).toHaveValue(
      "Сохранённая вторая подпись",
    );
    await secondRow.locator("button[type=submit]").click();
    await expect(secondRow.locator(".admin-message")).toContainText(
      "сохранены",
    );
    const deletion = await gateResponse(
      page,
      `/api/admin/gallery/${first.id}`,
      "DELETE",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await firstRow.locator(".danger").click();
    await deletion.captured;
    await assertGalleryLocked(page);
    await deletion.release();
    await expect(firstRow).toHaveCount(0);
    await page.locator("#gallery-refresh").click();
    await expect(secondRow.getByLabel("Подпись на сайте")).toHaveValue(
      "Сохранённая вторая подпись",
    );
    const publicCatalog = await auth.call("/api/catalog");
    assert.equal(
      publicCatalog.gallery.some((photo) => photo.id === first.id),
      false,
    );
    assert.equal(
      publicCatalog.gallery.find((photo) => photo.id === second.id).caption,
      "Сохранённая вторая подпись",
    );
  }));

test("a manually chosen new service identifier survives a form rerender and subsequent title edits", async () =>
  withAdmin(async (auth) => {
    const { page } = auth;
    const originalCount = await page.locator(".admin-service").count();
    const customId = "custom-test-" + randomBytes(4).toString("hex");
    await page.locator("#add-service").click();
    await page
      .locator(`#service-title-${originalCount}`)
      .fill("Первое тестовое название");
    await page.locator(`#service-id-${originalCount}`).fill(customId);
    await page.locator(`#service-price-${originalCount}`).fill("1500");
    await page.locator("#add-service").click();
    await page
      .locator(`#service-title-${originalCount}`)
      .fill("Новое тестовое название");
    await expect(page.locator(`#service-id-${originalCount}`)).toHaveValue(
      customId,
    );
    await page
      .locator(`#service-title-${originalCount + 1}`)
      .fill("Вторая тестовая услуга");
    await page.locator("#catalog-save").click();
    await expect(page.locator("#catalog-status")).toContainText("сохранены");
    const catalog = await auth.call("/api/admin/catalog");
    assert.equal(
      catalog.services.find(
        (service) => service.title === "Новое тестовое название",
      ).id,
      customId,
    );
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(`#service-id-${originalCount}`)).toHaveValue(
      customId,
    );
    await expect(page.locator(`#service-id-${originalCount}`)).toHaveAttribute(
      "readonly",
      "",
    );
  }));

test("a late upload response cannot refill private gallery or upload fields after logout", async () =>
  withAdmin(async (auth) => {
    const { page } = auth;
    const marker = "PRIVATE UPLOAD " + randomBytes(5).toString("hex");
    await page.locator("#tab-gallery").click();
    await page.locator("#photo-file").setInputFiles("public/olga.jpg");
    await page.locator("#photo-alt").fill(marker);
    await page.locator("#photo-caption").fill(marker);
    const held = await gateResponse(page, "/api/admin/gallery", "POST");
    await page.locator("#upload-submit").click();
    await held.captured;
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#logout").click();
    await expect(page.locator("#login-view")).toBeVisible();
    await held.release();
    await expect(page.locator(".admin-photo")).toHaveCount(0);
    await expect(page.locator("#photo-alt")).toHaveValue("");
    await expect(page.locator("#photo-caption")).toHaveValue("");
    await expect(page.locator("#upload-preview")).toBeHidden();
    assert.equal(
      await page.locator("#photo-file").evaluate((input) => input.files.length),
      0,
    );
    await login(page);
    await page.locator("#tab-gallery").click();
    await expect(
      page
        .locator(".admin-photo")
        .filter({ has: page.locator(`img[alt="${marker}"]`) }),
    ).toHaveCount(1);
  }));

test("expired service session clears private rows and restores the unsaved price after login", async () =>
  withAdmin(async (auth) => {
    const { page } = auth;
    await page.locator(".admin-service summary").first().click();
    const field = page.locator("#service-price-0");
    const nextPrice = String(Number(await field.inputValue()) + 123);
    await field.fill(nextPrice);
    await auth.context.clearCookies();
    await page.locator("#catalog-save").click();
    await expect(page.locator("#login-view")).toBeVisible();
    await expect(
      page.locator(".admin-service,.admin-photo,.admin-lead"),
    ).toHaveCount(0);
    await login(page);
    await expect(field).toHaveValue(nextPrice);
    await expect(page.locator("#catalog-save")).toBeEnabled();
    await page.locator("#catalog-save").click();
    await expect(page.locator("#catalog-status")).toContainText("сохранены");
    const updated = await (
      await page.request.get(base + "/api/admin/catalog")
    ).json();
    assert.equal(updated.services[0].price, Number(nextPrice));
  }));
