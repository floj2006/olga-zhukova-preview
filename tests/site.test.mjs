import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
const failedResources = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (
    response.url().startsWith("http://127.0.0.1:4173") &&
    response.status() >= 400
  )
    failedResources.push(`${response.status()} ${response.url()}`);
});
const base = process.env.TEST_URL || "http://127.0.0.1:4173";

async function choose(value) {
  await page.locator(`input[value="${value}"]`).check();
  assert.equal(await page.locator("#quiz-next").isEnabled(), true);
  await page.locator("#quiz-next").click();
}
async function noOverflow(width, height) {
  await page.setViewportSize({ width, height });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
    `Overflow at ${width}px`,
  );
}

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator("h1").count(), 1);
  assert.match(await page.title(), /Ольга Жукова/);
  assert.equal(await page.locator("#quiz-next").isDisabled(), true);
  await page.screenshot({ path: "artifacts/desktop-hero.png" });
  for (const section of await page.locator("main > section").all()) {
    await section.scrollIntoViewIfNeeded();
  }
  assert.deepEqual(
    await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src),
      ),
    [],
  );
  await page.screenshot({ path: "artifacts/desktop-full.png", fullPage: true });

  // All five steps, back navigation and a known independent arithmetic result.
  await page.locator(".hero .button").click();
  await choose("wedding");
  assert.equal(await page.locator("#step-number").textContent(), "02");
  await choose("medium");
  await page.locator("#quiz-back").click();
  assert.equal(await page.locator('input[value="medium"]').isChecked(), true);
  await page.locator("#quiz-next").click();
  await choose("standard");
  await choose("city");
  await choose("dj");
  assert.equal(await page.locator("#quiz-result").isVisible(), true);
  assert.equal(
    (await page.locator("#result-price").textContent()).replace(/\s/g, ""),
    "57000",
  );
  assert.match(await page.locator("#result-summary").textContent(), /Свадьба/);
  assert.match(
    await page.locator("#result-disclaimer").textContent(),
    /Демонстрационный/,
  );
  await page
    .locator("#booking")
    .screenshot({ path: "artifacts/calculator-result.png" });

  // Real contact action, focus restoration, clipboard and permission-denied fallback.
  await page.locator("#exact-quote").click();
  assert.equal(await page.locator("#contact-dialog").isVisible(), true);
  assert.equal(
    await page.locator("#contact-dialog .button").getAttribute("href"),
    "tel:+79114449071",
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#copy-details").click();
  await expect(page.locator("#copy-status")).toHaveText(/скопированы/);
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /57.000/,
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard permission denied for fallback test");
        },
      },
    });
  });
  await page.locator("#copy-details").click();
  await expect(page.locator("#copy-fallback")).toBeVisible();
  assert.match(await page.locator("#copy-fallback").inputValue(), /Свадьба/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#contact-dialog").isVisible(), false);
  assert.equal(
    await page
      .locator("#exact-quote")
      .evaluate((el) => document.activeElement === el),
    true,
  );

  // A different format must produce a different sum and preserve prior choices.
  await page.locator("#quiz-restart").click();
  assert.equal(await page.locator('input[value="wedding"]').isChecked(), true);
  await choose("anniversary");
  await choose("intimate");
  await choose("short");
  await choose("nearby");
  await choose("host");
  assert.equal(
    (await page.locator("#result-price").textContent()).replace(/\s/g, ""),
    "29000",
  );

  // Unknown selections explicitly identify unpriced services.
  await page.locator("#quiz-restart").click();
  await choose("corporate");
  await choose("grand");
  await choose("undecided");
  await choose("other");
  await choose("undecided");
  assert.equal(
    (await page.locator("#result-price").textContent()).replace(/\s/g, ""),
    "40000",
  );
  assert.match(
    await page.locator("#result-disclaimer").textContent(),
    /Дорога и проживание/,
  );
  assert.match(
    await page.locator("#result-disclaimer").textContent(),
    /Музыка и оборудование/,
  );

  // Card shortcuts and session persistence.
  await page.locator('[data-event="graduation"]').click();
  assert.equal(
    await page.locator('input[value="graduation"]').isChecked(),
    true,
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.locator('input[value="graduation"]').isChecked(),
    true,
  );
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [320, 640],
  ]) {
    await noOverflow(width, height);
  }

  // Mobile navigation, native keyboard radios and accordion.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/mobile-hero.png" });
  await page.getByRole("button", { name: "Открыть меню" }).click();
  assert.equal(await page.locator("#mobile-menu").isVisible(), true);
  await page
    .locator("#mobile-menu")
    .getByRole("link", { name: "Калькулятор" })
    .click();
  assert.equal(await page.locator("#mobile-menu").isVisible(), false);
  assert.equal(
    await page
      .locator("body")
      .evaluate((el) => el.classList.contains("menu-open")),
    false,
  );
  await page
    .locator("#booking")
    .screenshot({ path: "artifacts/mobile-calculator.png" });
  await page.locator('input[value="graduation"]').focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.locator('input[value="anniversary"]').isChecked(),
    true,
  );
  await page.getByText("Создаём программу", { exact: true }).click();
  assert.equal(await page.locator(".program details[open]").count(), 1);
  assert.match(
    await page.locator(".program details[open]").textContent(),
    /Продумываем сценарий/,
  );

  // Mobile calculation and dialog also fit a narrow screen.
  await page.locator("#quiz-next").click();
  await choose("intimate");
  await choose("short");
  await choose("city");
  await choose("host");
  await page.locator("#exact-quote").click();
  await page.screenshot({ path: "artifacts/mobile-contact.png" });
  await noOverflow(320, 640);
  assert.equal(await page.locator("#dialog-close").isVisible(), true);
  await page.locator("#dialog-close").click();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.map((v) => ({
        rule: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      [],
      `Accessibility at ${width}px`,
    );
  }

  assert.deepEqual(errors, [], "Browser runtime errors");
  assert.deepEqual(failedResources, [], "Failed local resources");
  console.log(
    "PASS: desktop/mobile layouts, resources, 5-step totals, back/edit, unknown extras, shortcuts, persistence, contact dialog, clipboard, keyboard navigation and accordion.",
  );
} finally {
  await browser.close();
}
