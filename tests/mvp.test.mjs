import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createNextHandler } from "../server/next-adapter.mjs";
import { hashPassword } from "../server/security.mjs";
import { notifyLead } from "../server/notifications.mjs";
import { normalizeImage } from "../server/images.mjs";
const password = "mvp-test-password";
const hash = await hashPassword(password);
async function fixture(run, extra = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "olga-mvp-"));
  const handler = createNextHandler({
    dataDir,
    env: {
      NODE_ENV: "test",
      ADMIN_PASSWORD_HASH: hash,
      ADMIN_SESSION_SECRET:
        "mvp-test-session-secret-with-more-than-32-characters",
      ...extra.env,
    },
    fetchImpl: extra.fetchImpl,
  });
  const call = async (route, { method = "GET", body, headers = {} } = {}) => {
    const response = await handler(
      new Request("http://localhost" + route, {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        ...(body === undefined
          ? {}
          : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      }),
    );
    return {
      status: response.status,
      headers: response.headers,
      data: await response.json(),
    };
  };
  try {
    await run(call);
  } finally {
    assert.equal(path.dirname(dataDir), os.tmpdir());
    assert.ok(path.basename(dataDir).startsWith("olga-mvp-"));
    await rm(dataDir, { recursive: true, force: true });
  }
}
async function login(call) {
  const r = await call("/api/admin/login", {
    method: "POST",
    body: { password },
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  return {
    Cookie: r.headers.get("set-cookie").split(";")[0],
    "x-csrf-token": r.data.csrfToken,
  };
}
test("Next adapter: request streams, cookies, CSRF and body limits", () =>
  fixture(async (call) => {
    assert.equal((await call("/api/admin/content")).status, 401);
    const headers = await login(call);
    assert.equal((await call("/api/admin/content", { headers })).status, 200);
    assert.equal(
      (
        await call("/api/admin/content", {
          method: "PUT",
          headers: { Cookie: headers.Cookie },
          body: {},
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/api/quote", { method: "POST", body: "{" })).status,
      400,
    );
    assert.equal(
      (
        await call("/api/quote", {
          method: "POST",
          body: { extra: "x".repeat(25000) },
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await call("/api/quote", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "{}",
        })
      ).status,
      415,
    );
    assert.equal((await call("/api/unknown")).status, 404);
  }));
test("Editorial content: draft privacy, atomic conflicts, price independence and validation", () =>
  fixture(async (call) => {
    const headers = await login(call),
      initial = (await call("/api/admin/content", { headers })).data;
    const catalog = (await call("/api/catalog")).data;
    const body = {
      ...initial,
      videoUrl: "https://vk.com/video-test",
      videoCaption: "Тестовое видео",
      reviews: [
        {
          name: "Тестовый автор",
          event: "Тест",
          quote: "Тестовый опубликованный отзыв",
          source: "https://vk.com/example",
          published: true,
        },
        {
          name: "Черновик",
          event: "",
          quote: "Не должен попасть на сайт",
          source: "",
          published: false,
        },
      ],
    };
    const results = await Promise.all([
      call("/api/admin/content", { method: "PUT", headers, body }),
      call("/api/admin/content", { method: "PUT", headers, body }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const published = (await call("/api/catalog")).data;
    assert.equal(published.version, catalog.version);
    assert.equal(published.content.reviews.length, 1);
    assert.equal(
      (await call("/api/admin/content", { headers })).data.reviews.length,
      2,
    );
    for (const videoUrl of [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:password@example.com",
    ])
      assert.equal(
        (
          await call("/api/admin/content", {
            method: "PUT",
            headers,
            body: { ...body, version: 2, videoUrl },
          })
        ).status,
        400,
      );
  }));
test("VK messages use stable deduplication IDs, no personal details and recoverable failures", async () => {
  const lead = {
    id: randomUUID(),
    eventDate: "2027-06-14",
    name: "PRIVATE_NAME",
    phone: "PRIVATE_PHONE",
    comment: "PRIVATE_COMMENT",
  };
  const env = {
    VK_NOTIFICATIONS_ENABLED: "true",
    VK_COMMUNITY_TOKEN: "TEST_TOKEN",
    VK_PEER_ID: "123",
    APP_ORIGIN: "https://example.com",
  };
  const payloads = [];
  const send = async (url, options) => {
    assert.equal(url, "https://api.vk.com/method/messages.send");
    payloads.push(options.body);
    return Response.json({ response: 55 });
  };
  assert.equal((await notifyLead(lead, env, send)).status, "sent");
  await notifyLead(lead, env, send);
  assert.equal(payloads[0].get("random_id"), payloads[1].get("random_id"));
  assert.doesNotMatch(payloads[0].get("message"), /PRIVATE|TEST_TOKEN/);
  assert.equal(
    (
      await notifyLead(lead, env, async () => {
        throw new Error("Network unavailable");
      })
    ).status,
    "failed",
  );
  assert.equal(
    (
      await notifyLead(lead, {}, () =>
        assert.fail("Disabled integration must not call network"),
      )
    ).status,
    "disabled",
  );
});
test("A VK outage cannot discard a saved lead; retrying a submission does not duplicate it", () =>
  fixture(
    async (call) => {
      const headers = await login(call),
        catalog = (await call("/api/catalog")).data;
      const body = {
        requestId: randomUUID(),
        name: "Тестовый клиент",
        phone: "+79111234567",
        eventType: "wedding",
        eventDate: "",
        comment: "",
        items: [],
        extraMeetings: 0,
        consent: true,
        website: "",
        catalogVersion: catalog.version,
      };
      const saved = await call("/api/leads", { method: "POST", body });
      assert.equal(saved.status, 201);
      const retry = await call("/api/leads", { method: "POST", body });
      assert.equal(retry.data.id, saved.data.id);
      const leads = (await call("/api/admin/leads", { headers })).data.leads;
      assert.equal(leads.length, 1);
      assert.equal(leads[0].notification.status, "failed");
      assert.equal(
        (
          await call("/api/admin/leads/" + saved.data.id + "/notify", {
            method: "POST",
            body: {},
          })
        ).status,
        401,
      );
    },
    {
      env: {
        VK_NOTIFICATIONS_ENABLED: "true",
        VK_COMMUNITY_TOKEN: "test",
        VK_PEER_ID: "123",
        APP_ORIGIN: "http://localhost",
      },
      fetchImpl: async () => {
        throw new Error("VK unavailable");
      },
    },
  ));
test("Server fully decodes and bounds uploaded images", async () => {
  await assert.rejects(
    () => normalizeImage({ bytes: Buffer.from("RIFFxxxxWEBPfake") }),
    { status: 400 },
  );
  const bytes = await sharp({
    create: { width: 2500, height: 100, channels: 3, background: "#c9a227" },
  })
    .jpeg()
    .toBuffer();
  const r = await normalizeImage({ bytes });
  assert.equal(r.extension, "webp");
  assert.equal(r.width, 2048);
  assert.ok(r.bytes.length < 3 * 1024 * 1024);
  assert.equal((await sharp(r.bytes).metadata()).format, "webp");
});

test("Stale edits of leads and photos cannot overwrite a newer admin save", () =>
  fixture(async (call) => {
    const headers = await login(call),
      catalog = (await call("/api/catalog")).data;
    const lead = (
      await call("/api/leads", {
        method: "POST",
        body: {
          requestId: randomUUID(),
          name: "Тестовый клиент",
          phone: "+79111234567",
          eventType: "wedding",
          eventDate: "",
          comment: "",
          items: [],
          extraMeetings: 0,
          consent: true,
          website: "",
          catalogVersion: catalog.version,
        },
      })
    ).data;
    const route = "/api/admin/leads/" + lead.id;
    const edits = await Promise.all(
      ["Первая заметка", "Вторая заметка"].map((note) =>
        call(route, {
          method: "PATCH",
          headers,
          body: { status: "contacted", note, version: 1 },
        }),
      ),
    );
    assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#c9a227" },
    })
      .png()
      .toBuffer();
    const photo = (
      await call("/api/admin/gallery", {
        method: "POST",
        headers,
        body: {
          dataUrl: "data:image/png;base64," + bytes.toString("base64"),
          alt: "Тестовое фото",
        },
      })
    ).data.photo;
    const edits2 = await Promise.all(
      ["Первая подпись", "Вторая подпись"].map((caption) =>
        call("/api/admin/gallery/" + photo.id, {
          method: "PATCH",
          headers,
          body: { caption, version: photo.version },
        }),
      ),
    );
    assert.deepEqual(edits2.map((r) => r.status).sort(), [200, 409]);
  }));

test("Booking terms: draft privacy, publication validation, legacy clients and independent prices", () =>
  fixture(async (call) => {
    const headers = await login(call);
    const initial = (await call("/api/admin/content", { headers })).data;
    const catalog = (await call("/api/catalog")).data;
    const draft = {
      ...initial,
      terms: {
        published: false,
        duration: "ТЕСТ: продолжительность",
        travel: "ТЕСТ: выезд",
        payment: "ТЕСТ: оплата",
        cancellation: "ТЕСТ: отмена",
      },
    };
    const saved = await call("/api/admin/content", {
      method: "PUT",
      headers,
      body: draft,
    });
    assert.equal(saved.status, 200);
    assert.equal((await call("/api/catalog")).data.content.terms, undefined);
    assert.equal(saved.data.terms.payment, draft.terms.payment);
    const published = await call("/api/admin/content", {
      method: "PUT",
      headers,
      body: { ...saved.data, terms: { ...draft.terms, published: true } },
    });
    assert.equal(published.status, 200);
    assert.deepEqual(
      (await call("/api/catalog")).data.content.terms,
      published.data.terms,
    );
    assert.equal((await call("/api/catalog")).data.version, catalog.version);
    const { terms, ...legacy } = published.data;
    const compatibility = await call("/api/admin/content", {
      method: "PUT",
      headers,
      body: { ...legacy, videoCaption: "Редактор без новых полей" },
    });
    assert.equal(compatibility.status, 200);
    assert.deepEqual(compatibility.data.terms, terms);
    for (const bad of [
      null,
      { ...terms, published: "yes" },
      { ...terms, payment: "" },
      { ...terms, payment: "<script>" },
      { ...terms, payment: "x".repeat(601) },
    ]) {
      const result = await call("/api/admin/content", {
        method: "PUT",
        headers,
        body: { ...compatibility.data, terms: bad },
      });
      assert.equal(result.status, 400);
    }
    assert.equal(
      (
        await call("/api/admin/content", {
          method: "PUT",
          headers,
          body: published.data,
        })
      ).status,
      409,
    );
    const hidden = await call("/api/admin/content", {
      method: "PUT",
      headers,
      body: { ...compatibility.data, terms: { ...terms, published: false } },
    });
    assert.equal(hidden.status, 200);
    assert.equal((await call("/api/catalog")).data.content.terms, undefined);
  }));
