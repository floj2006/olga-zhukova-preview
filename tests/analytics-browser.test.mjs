import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { createSiteServer } from "../scripts/serve.mjs";
import { redactAnalytics } from "../lib/analytics.js";
const server = await createSiteServer({
  dataDir: await mkdtemp("artifacts/analytics-test-"),
  env: { NODE_ENV: "test" },
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/?phone=PRIVATE_PHONE#PRIVATE_NAME", {
    waitUntil: "networkidle",
  });
  await expect(page.locator('script[src^="/_vercel/"]')).toHaveCount(0);
  let loads = 0;
  await page.route("**/_vercel/**/script.js", async (route) => {
    loads++;
    const speed = route.request().url().includes("speed-insights");
    const api = speed ? "si" : "va",
      queue = speed ? "siq" : "vaq";
    await route.fulfill({
      contentType: "text/javascript",
      body:
        "(function(){window.loadedMetrics = (window.loadedMetrics || 0) + 1; const pending = window." +
        queue +
        " || []; window.mockMetrics = window.mockMetrics || []; window." +
        api +
        ' = function(command, arg) { if(command === "beforeSend") window.' +
        api +
        '.filter=arg; else if(command === "event") window.mockMetrics.push(window.' +
        api +
        '.filter({type:"event",name:arg.name,url:location.href,data:arg.data})); }; for(const args of pending) window.' +
        api +
        "(...args);})();",
    });
  });
  await page.evaluate(async (middleware) => {
    const { initializeMetrics } = await import("/metrics-loader.js");
    // Browser test uses the same redactor as the compiled React adapter.
    const beforeSend = (0, eval)("(" + middleware + ")");
    window.conversionActions = new Set([
      "phone_click",
      "booking_open",
      "calendar_open",
      "services_view",
      "request_open",
      "lead_saved",
    ]);
    window.stopMetrics = initializeMetrics({
      web: true,
      speed: true,
      conversions: true,
      beforeSend,
    });
  }, redactAnalytics.toString());
  await expect.poll(() => page.evaluate(() => window.loadedMetrics)).toBe(2);
  await expect(page.locator('script[src*="speed-insights"]')).toHaveAttribute(
    "data-sample-rate",
    "0.1",
  );
  await page.evaluate(() => {
    const emit = (detail) =>
      document.dispatchEvent(new CustomEvent("olga:metric", { detail }));
    emit({
      name: "conversion",
      value: { action: "lead_saved", phone: "PRIVATE_PHONE" },
    });
    emit({ name: "conversion", value: { action: "PRIVATE_NAME" } });
    window.va("event", {
      name: "phone_click",
      data: { phone: "PRIVATE_PHONE" },
    });
  });
  assert.deepEqual(await page.evaluate(() => window.mockMetrics), [
    { type: "event", name: "lead_saved", url: base + "/" },
    { type: "event", name: "phone_click", url: base + "/" },
  ]);
  await page.evaluate(() => window.stopMetrics());
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent("olga:metric", {
        detail: { name: "conversion", value: { action: "lead_saved" } },
      }),
    ),
  );
  assert.equal((await page.evaluate(() => window.mockMetrics)).length, 2);
  const privatePage = await browser.newPage();
  await privatePage.goto(base + "/admin", { waitUntil: "networkidle" });
  await privatePage.evaluate(async () => {
    const { initializeMetrics } = await import("/metrics-loader.js");
    initializeMetrics({ web: true, speed: true, beforeSend: (e) => e });
  });
  await expect(privatePage.locator('script[src^="/_vercel/"]')).toHaveCount(0);
  await privatePage.close();
  const dnt = await browser.newPage();
  await dnt.addInitScript(() =>
    Object.defineProperty(navigator, "doNotTrack", {
      value: "1",
      configurable: true,
    }),
  );
  await dnt.goto(base, { waitUntil: "networkidle" });
  await dnt.evaluate(async () => {
    const { initializeMetrics } = await import("/metrics-loader.js");
    initializeMetrics({ web: true, speed: true, beforeSend: (e) => e });
  });
  await expect(dnt.locator('script[src^="/_vercel/"]')).toHaveCount(0);
  assert.equal(loads, 2);
  await dnt.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: analytics disabled by default, native queue, safe conversions, URL redaction, sampling, cleanup, admin exclusion and Do Not Track (mock collector).",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
