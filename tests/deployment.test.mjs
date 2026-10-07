import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deploymentStatus } from "../server/deployment.mjs";
import { checkCloud } from "../server/cloud-check.mjs";
import { createNextHandler } from "../server/next-adapter.mjs";
import { hashPassword, sessionSecurity } from "../server/security.mjs";
const env = {
  NODE_ENV: "test",
  ADMIN_PASSWORD_HASH: await hashPassword("launch-test-password"),
  ADMIN_SESSION_SECRET: "launch-test-session-key-over-32-characters",
};
test("launch configuration is explicit and never contains secrets or ready guarantees", () => {
  const local = deploymentStatus(env);
  assert.equal(local.mode, "local");
  assert.equal(local.cloudConfigured, false);
  assert.equal(local.checks.find((c) => c.id === "vk").status, "optional");
  const configured = {
    ...env,
    NODE_ENV: "production",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "cloud-private-key",
    APP_ORIGIN: "https://example.com",
    SITE_URL: "https://example.com",
    VK_NOTIFICATIONS_ENABLED: "true",
    VK_COMMUNITY_TOKEN: "vk-private-key",
    VK_PEER_ID: "123",
  };
  const result = deploymentStatus(configured);
  assert.ok(result.checks.every((c) => c.status === "configured"));
  assert.doesNotMatch(
    JSON.stringify(result),
    /cloud-private-key|vk-private-key|launch-test-session-key|scrypt\$/,
  );
  assert.equal(Object.hasOwn(result, "ready"), false);
  for (const address of [
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com/?token=secret",
  ]) {
    assert.equal(
      deploymentStatus({ ...configured, APP_ORIGIN: address }).checks.find(
        (c) => c.id === "origin",
      ).status,
      "blocked",
    );
  }
  assert.equal(
    deploymentStatus({
      ...configured,
      SITE_URL: "https://another.com",
    }).checks.find((c) => c.id === "origin").status,
    "blocked",
  );
});
test("admin checks require a session, do not initialize storage and make read-only limited requests", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "olga-launch-"));
  const configured = {
    ...env,
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "cloud-private-key",
  };
  const calls = [];
  const handler = createNextHandler({
    env: configured,
    dataDir: directory,
    fetchImpl: async (url, options) => {
      calls.push(url);
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      let value = [];
      if (url.endsWith("/rest/v1/"))
        value = {
          paths: Object.fromEntries(
            [
              "olga_save_content",
              "olga_initialize",
              "olga_add_lead",
              "olga_search_leads",
              "olga_save_catalog",
              "olga_save_availability",
              "olga_update_lead",
              "olga_gallery",
              "olga_order_gallery",
              "olga_rate_limit",
            ].map((name) => ["/rpc/" + name, {}]),
          ),
        };
      else if (url.includes("/bucket/"))
        value = {
          public: true,
          file_size_limit: 3145728,
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
        };
      else assert.match(url, /select=id&limit=0$/);
      return Response.json(value);
    },
  });
  const issued = sessionSecurity(configured).issue();
  const call = (route, auth = true, method = "GET") =>
    handler(
      new Request("http://localhost" + route, {
        method,
        headers: auth
          ? {
              cookie: issued.cookie.split(";")[0],
              "x-csrf-token": issued.csrfToken,
            }
          : {},
      }),
    );
  try {
    for (const route of ["/api/admin/launch-status", "/api/admin/cloud-check"])
      assert.equal((await call(route, false)).status, 401);
    assert.equal(calls.length, 0);
    const status = await call("/api/admin/launch-status");
    assert.equal(status.status, 200);
    assert.equal(status.headers.get("cache-control"), "no-store");
    assert.equal(calls.length, 0);
    const cloud = await call("/api/admin/cloud-check");
    assert.equal(cloud.status, 200);
    assert.ok((await cloud.json()).results.every((c) => c.ok));
    assert.equal(calls.length, 5);
    assert.equal(
      (await call("/api/admin/cloud-check", true, "POST")).status,
      405,
    );
    assert.equal(calls.length, 5);
    assert.deepEqual(
      await readdir(directory),
      [],
      "No schema initialization or local data writes",
    );
  } finally {
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith("olga-launch-"));
    await rm(directory, { recursive: true, force: true });
  }
});
test("cloud reads begin together instead of multiplying the timeout", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let started = 0;
  const pending = checkCloud(
    {
      ...env,
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "key",
    },
    async () => {
      started++;
      await gate;
      return new Response("{}", { status: 503 });
    },
  );
  assert.equal(started, 5);
  release();
  assert.ok((await pending).every((c) => !c.ok));
});
