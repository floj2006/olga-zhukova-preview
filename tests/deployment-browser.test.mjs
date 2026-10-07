import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createSiteServer } from "../scripts/serve.mjs";
import { hashPassword } from "../server/security.mjs";
await mkdir("artifacts", { recursive: true });
const password = randomBytes(20).toString("base64url");
const server = await createSiteServer({
  dataDir: await mkdtemp("artifacts/launch-browser-"),
  env: {
    NODE_ENV: "test",
    ADMIN_PASSWORD_HASH: await hashPassword(password),
    ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`,
  browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  }),
  page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function login() {
  await page.locator("#password").fill(password);
  await page.locator("#login-submit").click();
  await expect(page.locator("#workspace")).toBeVisible();
}
try {
  await page.goto(base + "/admin/", { waitUntil: "networkidle" });
  await login();
  await page.locator("#launch-status > summary").click();
  await expect(page.locator("[data-check=storage]")).toContainText(
    "Облако не подключено",
  );
  await expect(page.locator("#launch-cloud-check")).toBeDisabled();
  await expect(page.locator("[data-check=vk]")).toContainText("Выключены");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#launch-status").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "artifacts/launch-settings-" + width + ".png",
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Status refresh must not discard a draft in the existing editor.
  await page.locator(".admin-service summary").first().click();
  const price = page.locator("#service-price-0"),
    old = await price.inputValue();
  await price.fill("9000");
  await page
    .getByRole("button", { name: "Обновить настройки", exact: true })
    .click();
  await expect(price).toHaveValue("9000");
  await expect(page.locator("#catalog-save")).toBeEnabled();
  await price.fill(old);
  // Test the read-only cloud result UI independently of unavailable account credentials.
  await page.route("**/api/admin/launch-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "local",
        cloudConfigured: true,
        checks: [
          {
            id: "storage",
            title: "Постоянное хранение",
            status: "configured",
            detail: "Настройки облака заданы. <img src=x onerror=alert(1)>",
          },
        ],
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Обновить настройки", exact: true })
    .click();
  await expect(page.locator("#launch-cloud-check")).toBeEnabled();
  assert.equal(
    await page.locator("#launch-status img").count(),
    0,
    "Status details are rendered as text",
  );
  await page.route("**/api/admin/cloud-check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        checkedAt: new Date().toISOString(),
        results: [{ ok: false, label: "Хранилище фотографий: HTTP 403." }],
      }),
    }),
  );
  await page.locator("#launch-cloud-check").click();
  await expect(page.locator(".launch-cloud-result")).toContainText(
    "Подключение требует внимания",
  );
  await page.unroute("**/api/admin/cloud-check");
  await page.route("**/api/admin/cloud-check", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [{ ok: true, label: "Доступ к таблицам" }],
      }),
    }),
  );
  await page.locator("#launch-cloud-check").click();
  await expect(page.locator(".launch-cloud-result")).toContainText(
    "Запись и доступ публичного клиента нужно проверить",
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator("#launch-status").scrollIntoViewIfNeeded();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await expect(page.locator(".admin-body")).toHaveCSS(
      "background-color",
      "rgb(13, 12, 10)",
    );
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
    await page.screenshot({ path: `artifacts/launch-status-${width}.png` });
  }
  // A late diagnostic result after logout must not repopulate the next session.
  await page.unroute("**/api/admin/cloud-check");
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/api/admin/cloud-check", async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [{ ok: false, label: "Поздний результат старой сессии" }],
      }),
    });
  });
  await page.locator("#launch-cloud-check").click();
  await expect(page.locator("#launch-cloud-check")).toBeDisabled();
  await page.locator("#logout").click();
  await expect(page.locator("#login-view")).toBeVisible();
  release();
  await login();
  await page.locator("#launch-status > summary").click();
  await expect(page.locator("#launch-cloud-check")).toBeEnabled();
  await expect(page.locator(".launch-cloud-result")).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: launch status permissions, config/offline cloud UI, draft preservation, safe rendering, late result after logout, 320/390/1440px, existing palette and axe. No real cloud or VK requests.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
