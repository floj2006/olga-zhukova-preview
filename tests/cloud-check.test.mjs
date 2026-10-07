import test from "node:test";
import assert from "node:assert/strict";
import { checkCloud } from "../scripts/check-cloud.mjs";
const env = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "private-test-key" };
test("missing cloud configuration makes no requests", async () => {
  const results = await checkCloud({}, () => { throw new Error("Must not make a request"); });
  assert.equal(results[0].ok, false);
  assert.match(results[0].label, /SUPABASE_URL/);
});
test("cloud preflight uses only GET and does not fetch lead contents", async () => {
  const calls = [];
  const results = await checkCloud(env, async (url, options) => {
    calls.push(url);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
    let data = [];
    if (url.endsWith('/rest/v1/')) data = { paths: Object.fromEntries([
      "olga_save_content", "olga_initialize", "olga_add_lead", "olga_search_leads", "olga_save_catalog", "olga_save_availability", "olga_update_lead", "olga_gallery", "olga_order_gallery", "olga_rate_limit",
    ].map(name => [`/rpc/${name}`, {}])) };
    else if (url.includes('/bucket/')) data = { public: true, file_size_limit: 3145728, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] };
    else assert.match(url, /select=id&limit=0$/);
    return new Response(JSON.stringify(data));
  });
  assert.equal(calls.length, 5);
  assert.ok(results.every(item => item.ok));
});
test("HTTP failures and exceptions never expose server bodies or secrets", async () => {
  for (const impl of [async () => new Response('private-test-key', { status: 403 }), async () => { throw new Error('private-test-key'); }]) {
    const result = await checkCloud(env, impl);
    assert.ok(result.every(item => !item.ok));
    assert.doesNotMatch(JSON.stringify(result), /private-test-key/);
  }
});
