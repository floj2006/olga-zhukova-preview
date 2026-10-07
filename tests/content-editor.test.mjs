import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";
const password = randomBytes(24).toString("hex");
const server = await createSiteServer({
  dataDir: await mkdtemp("artifacts/content-editor-"),
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
  errors = [];
function watch(p) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/401 \(Unauthorized\)|409 \(Conflict\)/.test(m.text())
    )
      errors.push(m.text());
  });
}
watch(page);
async function login(p) {
  await p.locator("#password").fill(password);
  await p.locator("#login-submit").click();
  await expect(p.locator("#workspace")).toBeVisible();
}
async function open(p) {
  await p.goto(base + "/admin", { waitUntil: "networkidle" });
  if (await p.locator("#login-view").isVisible()) await login(p);
  await p.locator("#tab-content").click();
  await expect(p.locator("#content-fields")).toBeEnabled();
}
async function confirmClick(selector, accept = true) {
  page.once("dialog", (d) => (accept ? d.accept() : d.dismiss()));
  await page.locator(selector).click();
}
try {
  await open(page);
  await expect(page.locator("#content-save")).toBeDisabled();
  await expect(page.locator("#content-empty")).toBeVisible();
  await page.locator("#content-add-review").click();
  await expect(page.locator("[data-key=name]")).toBeFocused();
  await page.locator("[data-key=name]").fill("Тестовый автор");
  await page.locator("[data-key=quote]").fill("Первый текст");
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator("#content-preview")).not.toContainText(
    "Первый текст",
  );
  await page.locator("[data-key=published]").check();
  await expect(page.locator("#content-preview")).toContainText("Первый текст");
  await page.locator("[data-key=quote]").fill("<img src=x onerror=alert(1)>");
  await expect(page.locator("#content-preview")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#content-preview img")).toHaveCount(0);
  await page.locator("[data-key=quote]").fill("Первый текст");
  await page.locator("#content-save").click();
  await expect(page.locator("#content-state")).toHaveText(
    "Все изменения сохранены",
  );
  await expect(page.locator("#content-terms-published")).toBeDisabled();
  const termText = {
    duration: "ТЕСТ: длительность программы",
    travel: "ТЕСТ: выезд обсуждается",
    payment: "ТЕСТ: условия оплаты",
    cancellation: "ТЕСТ: условия переноса и отмены",
  };
  for (const [key, text] of Object.entries(termText))
    await page.locator("#content-term-" + key).fill(text);
  await expect(page.locator("#content-preview")).not.toContainText(
    termText.payment,
  );
  await page.locator("#content-save").click();
  await expect(page.locator("#content-save")).toBeDisabled();
  const publicPage = await context.newPage();
  watch(publicPage);
  await publicPage.goto(base, { waitUntil: "networkidle" });
  await expect(publicPage.locator("[data-booking-term]")).toHaveCount(0);
  const servicesPage = await context.newPage();
  watch(servicesPage);
  await servicesPage.goto(base + "/services", { waitUntil: "networkidle" });
  await expect(servicesPage.locator("[data-booking-term]")).toHaveCount(0);
  await page.locator("#content-terms-published").check();
  await expect(page.locator("#content-preview")).toContainText(
    termText.payment,
  );
  await page.locator("#content-save").click();
  await expect(page.locator("#content-save")).toBeDisabled();
  await publicPage.reload({ waitUntil: "networkidle" });
  await expect(publicPage.locator("[data-booking-term]")).toHaveCount(4);
  await publicPage.locator("[data-booking-term=payment] summary").click();
  await expect(publicPage.locator("[data-booking-term=payment] p")).toHaveText(
    termText.payment,
  );
  await servicesPage.reload({ waitUntil: "networkidle" });
  await expect(servicesPage.locator("[data-booking-term]")).toHaveCount(4);
  for (const [key, text] of Object.entries(termText))
    await expect(servicesPage.locator('[data-booking-term="' + key + '"] p')).toHaveText(text);
  await page.locator("#content-terms-published").uncheck();
  await page.locator("#content-save").click();
  await expect(page.locator("#content-save")).toBeDisabled();
  await publicPage.reload({ waitUntil: "networkidle" });
  await expect(publicPage.locator("[data-booking-term]")).toHaveCount(0);
  await servicesPage.reload({ waitUntil: "networkidle" });
  await expect(servicesPage.locator("[data-booking-term]")).toHaveCount(0);
  await servicesPage.close();
  await publicPage.close();
  const second = await context.newPage();
  watch(second);
  await open(second);
  await second.locator("[data-key=quote]").fill("Правка из второй вкладки");
  await second.locator("#content-save").click();
  await expect(second.locator("#content-message")).toContainText(
    "Материалы сохранены",
  );
  await page.locator("[data-key=quote]").fill("Мой несохранённый текст");
  await page.locator("#content-save").click();
  await expect(page.locator("#content-state")).toHaveText("Конфликт версий");
  await expect(page.locator("[data-key=quote]")).toHaveValue(
    "Мой несохранённый текст",
  );
  await expect(page.locator("#content-save")).toBeDisabled();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    }),
  );
  await page.locator("#content-copy").click();
  await expect(page.locator("#content-copy-fallback")).toBeFocused();
  await expect(page.locator("#content-copy-fallback")).toContainText(
    "Мой несохранённый текст",
  );
  await confirmClick("#content-refresh", false);
  await expect(page.locator("[data-key=quote]")).toHaveValue(
    "Мой несохранённый текст",
  );
  await confirmClick("#content-refresh");
  await expect(page.locator("[data-key=quote]")).toHaveValue(
    "Правка из второй вкладки",
  );
  // Enforce the limit visibly; discarding incomplete new drafts requires no server writes.
  for (let i = 1; i < 12; i++)
    await page.locator("#content-add-review").click();
  await expect(page.locator("#content-add-review")).toBeDisabled();
  await expect(page.locator("#content-review-count")).toContainText("12 из 12");
  await confirmClick("#content-discard");
  await expect(page.locator(".content-review:not(.content-terms)")).toHaveCount(
    1,
  );
  await expect(page.locator("#content-save")).toBeDisabled();
  await page
    .locator("[data-key=quote]")
    .fill("Черновик после истечения сессии");
  await context.clearCookies();
  await page.locator("#content-save").click();
  await expect(page.locator("#login-view")).toBeVisible();
  await login(page);
  await expect(page.locator("[data-key=quote]")).toHaveValue(
    "Черновик после истечения сессии",
  );
  await expect(page.locator("#content-fields")).toBeEnabled();
  await page.locator("#content-save").click();
  await expect(page.locator("#content-state")).toHaveText(
    "Все изменения сохранены",
  );
  // A late response from an earlier authenticated session must not restore private drafts after logout.
  let held;
  await page.route("**/api/admin/content", async (route) => {
    if (route.request().method() === "GET") {
      held = route;
      return;
    }
    await route.continue();
  });
  await page.locator("#content-refresh").click();
  await expect.poll(() => Boolean(held)).toBe(true);
  await page.locator("#logout").click();
  await expect(page.locator("#login-view")).toBeVisible();
  await held.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      version: 999,
      videoUrl: "",
      videoCaption: "STALE RESPONSE",
      reviews: [],
    }),
  });
  await page.unroute("**/api/admin/content");
  await expect(page.locator("#content-caption")).toHaveValue("");
  await login(page);
  await expect(page.locator("#content-fields")).toBeEnabled();
  await expect(page.locator("[data-key=quote]")).toHaveValue(
    "Черновик после истечения сессии",
  );
  await expect(page.locator("#content-caption")).toHaveValue("");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    audit.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
    [],
  );
  await page.screenshot({
    path: "artifacts/react-content-editor-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: React editor preview/XSS, draft limit, conflicts/copy, cancellation, expired session, late logout response, mobile and accessibility.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
