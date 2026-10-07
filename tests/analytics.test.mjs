import test from "node:test";
import assert from "node:assert/strict";
import { conversionActions, redactAnalytics } from "../lib/analytics.js";
test("Analytics drops private routes, arbitrary actions, form data and URL parameters", () => {
  for (const url of [
    "https://example.com/admin",
    "https://example.com/admin/",
    "https://example.com/api/leads",
    "not a url",
  ])
    assert.equal(redactAnalytics({ url }), null);
  assert.equal(
    redactAnalytics({
      url: "https://example.com",
      type: "event",
      name: "PRIVATE_NAME",
    }),
    null,
  );
  for (const name of conversionActions) {
    const event = redactAnalytics({
      type: "event",
      url: "https://example.com/?phone=PRIVATE_PHONE#PRIVATE_NAME",
      name,
      data: { phone: "PRIVATE_PHONE" },
      referrer: "https://other.com/?token=PRIVATE_TOKEN",
    });
    assert.deepEqual(event, {
      type: "event",
      url: "https://example.com/",
      name,
      referrer: "https://other.com",
    });
  }
});
