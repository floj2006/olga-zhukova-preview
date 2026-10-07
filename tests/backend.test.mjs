import sharp from "sharp";
import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createApiHandler } from "../server/index.mjs";
import { hashPassword, verifyPassword } from "../server/security.mjs";
import {
  createSupabaseStorage,
  createLocalStorage,
} from "../server/storage.mjs";
import { eventToday, validPhone } from "../public/booking-rules.js";
import { calendarList, nextBusyDate } from "../public/admin/calendar-list.js";
import { quoteText } from "../public/admin/quote-copy.js";

test("shareable quote uses saved prices and excludes private fields", () => {
  const text = quoteText({
    total: 16000,
    from: true,
    phone: "PRIVATE_PHONE",
    note: "PRIVATE_NOTE",
    lines: [
      {
        title: "Ведущая",
        quantity: 2,
        unit: "hour",
        unitPrice: 8000,
        total: 16000,
      },
    ],
  });
  assert.match(text, /Итого: от 16\s000 ₽/);
  assert.match(text, /2 ч × 8\s000 ₽/);
  assert.doesNotMatch(text, /PRIVATE/);
  assert.doesNotMatch(quoteText(undefined), /Итого/);
});

const password = "test-admin-strong-password";
const hash = await hashPassword(password);
const basicEnv = {
  NODE_ENV: "test",
  ADMIN_PASSWORD_HASH: hash,
  ADMIN_SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
};
const pixel =
  "data:image/png;base64," +
  (
    await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#c9a227" },
    })
      .png()
      .toBuffer()
  ).toString("base64");

async function start(dataDir, env = basicEnv) {
  const handler = await createApiHandler({ dataDir, env });
  const server = http.createServer(async (req, res) => {
    if (!(await handler(req, res))) res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, { method = "GET", body, headers = {} } = {}) => {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    });
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, data };
  };
  return {
    call,
    base,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function fixture(fn, env) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "olga-backend-test-"));
  const app = await start(dataDir, env);
  try {
    return await fn(app, dataDir);
  } finally {
    await app.close();
    // Only remove the exact temporary directory created above, never a caller-computed project path.
    assert.equal(
      path.dirname(path.resolve(dataDir)),
      path.resolve(os.tmpdir()),
    );
    assert.ok(path.basename(dataDir).startsWith("olga-backend-test-"));
    await rm(dataDir, { recursive: true, force: true });
  }
}

async function login(app) {
  const response = await app.call("/api/admin/login", {
    method: "POST",
    body: { password },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /HttpOnly/);
  assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  assert.match(response.headers.get("set-cookie"), /Max-Age=28800/);
  return {
    Cookie: response.headers.get("set-cookie").split(";")[0],
    "x-csrf-token": response.data.csrfToken,
  };
}

const makeLead = (overrides = {}) => ({
  requestId: randomUUID(),
  name: "Анна Иванова",
  phone: "+7 (911) 123-45-67",
  eventType: "Свадьба",
  eventDate: "2027-06-14",
  comment: "Вечер на 60 гостей",
  items: [
    { id: "host", quantity: 5 },
    { id: "dj", quantity: 5 },
  ],
  extraMeetings: 1,
  consent: true,
  website: "",
  ...overrides,
});

test("admin calendar separates past dates, searches notes and sorts the nearest dates", () => {
  const entries = [
    { date: "2027-03-20", note: "Банкет Анны" },
    { date: "2026-09-29", note: "Архив" },
    { date: "2026-09-30", note: "Сегодня" },
    { date: "2026-01-01", note: "Раннее событие" },
  ];
  const before = structuredClone(entries);
  const today = "2026-09-30";
  assert.equal(nextBusyDate(entries, today), today);
  assert.deepEqual(
    calendarList(entries, "upcoming", "", today).map((e) => e.date),
    [today, "2027-03-20"],
  );
  assert.deepEqual(
    calendarList(entries, "past", "", today).map((e) => e.date),
    ["2026-09-29", "2026-01-01"],
  );
  for (const query of [" АННЫ ", "20.03.2027", "20 марта", "2027-03-20"])
    assert.equal(
      calendarList(entries, "all", query, today)[0].date,
      "2027-03-20",
    );
  assert.deepEqual(calendarList(entries, "all", "не найдено", today), []);
  assert.deepEqual(
    entries,
    before,
    "Filtering never mutates stored calendar entries",
  );
});

test("booking dates use Vologda time and phones require digits", () => {
  assert.equal(eventToday(new Date("2026-09-30T21:30:00Z")), "2026-10-01");
  assert.equal(validPhone(".........."), false);
  assert.equal(validPhone("+7 (911) 123-45-67"), true);
});

test("server rejects busy and past dates while retries stay idempotent", () =>
  fixture(async (app) => {
    const headers = await login(app);
    const lead = makeLead();
    assert.equal(
      (await app.call("/api/leads", { method: "POST", body: lead })).status,
      201,
    );
    const calendar = await app.call("/api/admin/availability", { headers });
    assert.equal(
      (
        await app.call("/api/admin/availability", {
          method: "PATCH",
          headers,
          body: {
            version: calendar.data.version,
            changes: [{ date: lead.eventDate, busy: true }],
          },
        })
      ).status,
      200,
    );
    // A successful request can be retried even if the owner subsequently marks its date busy.
    assert.equal(
      (await app.call("/api/leads", { method: "POST", body: lead })).status,
      200,
    );
    const busy = await app.call("/api/leads", {
      method: "POST",
      body: makeLead(),
    });
    assert.equal(busy.status, 409);
    assert.equal(busy.data.code, "date_busy");
    const past = await app.call("/api/leads", {
      method: "POST",
      body: makeLead({ eventDate: "2000-01-01" }),
    });
    assert.equal(past.status, 400);
    assert.equal(past.data.code, "date_past");
    assert.equal(
      (
        await app.call("/api/leads", {
          method: "POST",
          body: makeLead({ eventDate: "" }),
        })
      ).status,
      201,
    );
    assert.equal(
      (await app.call("/api/admin/leads", { headers })).data.total,
      2,
    );
  }));

test("catalog and server quotes use current tariffs, inclusive DJ equipment and free first meeting", () =>
  fixture(async (app) => {
    const catalog = await app.call("/api/catalog");
    assert.equal(catalog.status, 200);
    assert.equal(catalog.data.services.length, 9);
    assert.equal(
      catalog.data.services.find((service) => service.id === "dj").price,
      3000,
    );
    assert.equal(catalog.data.firstMeetingFree, true);
    const quote = await app.call("/api/quote", {
      method: "POST",
      body: {
        items: [
          { id: "host", quantity: 5, price: 1 },
          { id: "dj", quantity: 5 },
          { id: "led", quantity: 1 },
        ],
        extraMeetings: 2,
        total: 1,
      },
    });
    assert.equal(quote.status, 200);
    assert.equal(quote.data.total, 67000);
    assert.equal(quote.data.from, true);
    assert.equal(quote.data.lines[0].unitPrice, 8000);
    const free = await app.call("/api/quote", {
      method: "POST",
      body: { items: [], extraMeetings: 0 },
    });
    assert.equal(free.data.total, 0);
  }));

test("quote rejects duplicates, unknown services, fractional or excessive quantities and duplicate consultations", () =>
  fixture(async (app) => {
    for (const body of [
      {
        items: [
          { id: "host", quantity: 1 },
          { id: "host", quantity: 1 },
        ],
      },
      { items: [{ id: "unknown", quantity: 1 }] },
      { items: [{ id: "host", quantity: 1.5 }] },
      { items: [{ id: "host", quantity: -1 }] },
      { items: [{ id: "host", quantity: 25 }] },
      { items: [{ id: "projector", quantity: 11 }] },
      { items: [{ id: "consultation", quantity: 1 }] },
      { items: [], extraMeetings: 21 },
    ])
      assert.equal(
        (await app.call("/api/quote", { method: "POST", body })).status,
        400,
      );
  }));

test("lead snapshots persist after server restart, repeated request IDs are idempotent", () =>
  fixture(async (app, dataDir) => {
    const lead = makeLead();
    const first = await app.call("/api/leads", { method: "POST", body: lead });
    assert.equal(first.status, 201);
    assert.equal(first.data.quote.total, 56000);
    const repeated = await app.call("/api/leads", {
      method: "POST",
      body: lead,
    });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.data.id, first.data.id);
    const conflict = await app.call("/api/leads", {
      method: "POST",
      body: { ...lead, name: "Другое имя" },
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.code, "request_conflict");
    const restarted = await start(dataDir);
    try {
      const headers = await login(restarted);
      const list = await restarted.call("/api/admin/leads", { headers });
      assert.equal(list.data.leads.length, 1);
      assert.equal(list.data.leads[0].name, lead.name);
      assert.equal(list.data.leads[0].quote.total, 56000);
      assert.equal(list.data.leads[0].fingerprint, undefined);
      const update = await restarted.call(`/api/admin/leads/${first.data.id}`, {
        method: "PATCH",
        headers,
        body: { status: "contacted", note: "Договорились о встрече" },
      });
      assert.equal(update.status, 200);
      assert.equal(update.data.lead.status, "contacted");
      assert.equal(update.data.lead.quote.total, 56000);
    } finally {
      await restarted.close();
    }
  }));

test("lead validation rejects missing consent, malformed dates, XSS, spam and bad phone", () =>
  fixture(async (app) => {
    for (const override of [
      { consent: false },
      { phone: "123" },
      { phone: "abc123456789012" },
      { name: "<img src=x>" },
      { eventDate: "2027-02-30" },
      { website: "spam.example" },
      { requestId: "bad" },
      { items: [{ id: "missing", quantity: 1 }] },
    ]) {
      assert.equal(
        (
          await app.call("/api/leads", {
            method: "POST",
            body: makeLead(override),
          })
        ).status,
        400,
      );
    }
    const free = await app.call("/api/leads", {
      method: "POST",
      body: makeLead({ items: [], extraMeetings: 0 }),
    });
    assert.equal(free.status, 201);
    assert.equal(free.data.quote.total, 0);
  }));

test("admin authentication, signed cookies, CSRF, origins and password rotation protect mutations", () =>
  fixture(async (app, dataDir) => {
    assert.equal((await app.call("/api/admin/session")).status, 401);
    assert.equal((await app.call("/api/admin/catalog")).status, 401);
    assert.equal(
      (
        await app.call("/api/admin/login", {
          method: "POST",
          body: { password: "wrong" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await app.call("/api/admin/login", {
          method: "POST",
          headers: { Origin: "https://evil.example" },
          body: { password },
        })
      ).status,
      403,
    );
    const headers = await login(app);
    const session = await app.call("/api/admin/session", { headers });
    assert.equal(session.data.authenticated, true);
    assert.equal(session.data.csrfToken, headers["x-csrf-token"]);
    assert.equal(
      (
        await app.call("/api/admin/catalog", {
          headers: { Cookie: `${headers.Cookie}x` },
        })
      ).status,
      401,
    );
    const catalog = (await app.call("/api/admin/catalog", { headers })).data;
    assert.equal(
      (
        await app.call("/api/admin/catalog", {
          method: "PUT",
          headers: { Cookie: headers.Cookie },
          body: catalog,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await app.call("/api/admin/catalog", {
          method: "PUT",
          headers: { ...headers, Origin: "https://evil.example" },
          body: catalog,
        })
      ).status,
      403,
    );
    const loggedOut = await app.call("/api/admin/logout", {
      method: "POST",
      headers,
    });
    assert.equal(loggedOut.status, 200);
    assert.match(loggedOut.headers.get("set-cookie"), /Max-Age=0/);
    const changedPassword = await hashPassword("changed-admin-strong-password");
    const rotated = await start(dataDir, {
      ...basicEnv,
      ADMIN_PASSWORD_HASH: changedPassword,
    });
    try {
      assert.equal(
        (await rotated.call("/api/admin/session", { headers })).status,
        401,
      );
    } finally {
      await rotated.close();
    }
  }));

test("catalog edits are versioned, stale lead prices require confirmation, old lead snapshots stay unchanged", () =>
  fixture(async (app) => {
    const headers = await login(app);
    const original = (await app.call("/api/admin/catalog", { headers })).data;
    const before = await app.call("/api/leads", {
      method: "POST",
      body: makeLead({ catalogVersion: original.version }),
    });
    const services = original.services.map((service) =>
      service.id === "host" ? { ...service, price: 9000 } : service,
    );
    const edit = await app.call("/api/admin/catalog", {
      method: "PUT",
      headers,
      body: { version: original.version, services },
    });
    assert.equal(edit.status, 200);
    assert.equal(edit.data.version, original.version + 1);
    assert.equal(
      (
        await app.call("/api/admin/catalog", {
          method: "PUT",
          headers,
          body: original,
        })
      ).status,
      409,
    );
    const stale = await app.call("/api/leads", {
      method: "POST",
      body: makeLead({ catalogVersion: original.version }),
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.code, "catalog_changed");
    assert.equal(stale.data.quote.total, 61000);
    assert.equal(stale.data.catalog.version, edit.data.version);
    const list = (await app.call("/api/admin/leads", { headers })).data.leads;
    assert.equal(list.length, 1);
    assert.equal(list[0].id, before.data.id);
    assert.equal(list[0].quote.total, 56000);
    services[0].active = false;
    assert.equal(
      (
        await app.call("/api/admin/catalog", {
          method: "PUT",
          headers,
          body: { version: edit.data.version, services },
        })
      ).status,
      200,
    );
    assert.equal(
      (await app.call("/api/catalog")).data.services.some(
        (service) => service.id === "host",
      ),
      false,
    );
    assert.equal(
      (
        await app.call("/api/quote", {
          method: "POST",
          body: { items: [{ id: "host", quantity: 1 }] },
        })
      ).status,
      400,
    );
  }));

test("concurrent catalog edits permit exactly one writer and concurrent lead retries create one record", () =>
  fixture(async (app) => {
    const headers = await login(app);
    const catalog = (await app.call("/api/admin/catalog", { headers })).data;
    const edits = await Promise.all([
      app.call("/api/admin/catalog", { method: "PUT", headers, body: catalog }),
      app.call("/api/admin/catalog", { method: "PUT", headers, body: catalog }),
    ]);
    assert.deepEqual(edits.map((result) => result.status).sort(), [200, 409]);
    const lead = makeLead();
    const saved = await Promise.all(
      Array.from({ length: 4 }, () =>
        app.call("/api/leads", { method: "POST", body: lead }),
      ),
    );
    assert.ok(
      saved.every((result) => result.status === 200 || result.status === 201),
    );
    assert.equal(new Set(saved.map((result) => result.data.id)).size, 1);
    assert.equal(
      (await app.call("/api/admin/leads", { headers })).data.leads.length,
      1,
    );
  }));

test("gallery uploads persist, expose only generated image paths and support caption editing/deletion", () =>
  fixture(async (app, dataDir) => {
    const headers = await login(app);
    const saved = await app.call("/api/admin/gallery", {
      method: "POST",
      headers,
      body: {
        dataUrl: pixel,
        alt: "Вечер в банкетном зале",
        caption: "Золотой свет",
      },
    });
    assert.equal(saved.status, 201);
    assert.match(saved.data.photo.url, /^\/uploads\/[a-f0-9-]+\.webp$/);
    assert.equal(saved.data.photo.filename, undefined);
    const photo = await app.call(saved.data.photo.url);
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get("content-type"), "image/webp");
    assert.match(photo.headers.get("cache-control"), /immutable/);
    assert.equal((await sharp(photo.data).metadata()).format, "webp");
    const state = JSON.parse(
      await readFile(path.join(dataDir, "state.json"), "utf8"),
    );
    assert.equal(state.catalog.gallery.length, 1);
    assert.equal(
      (await app.call("/api/catalog")).data.gallery[0].alt,
      "Вечер в банкетном зале",
    );
    assert.equal(
      (
        await app.call(`/api/admin/gallery/${saved.data.photo.id}`, {
          method: "PATCH",
          headers,
          body: { alt: "Обновлённое описание", caption: "" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await app.call(`/api/admin/gallery/${saved.data.photo.id}`, {
          method: "DELETE",
          headers,
        })
      ).status,
      200,
    );
    assert.equal((await app.call("/api/catalog")).data.gallery.length, 0);
    assert.equal((await app.call(saved.data.photo.url)).status, 404);
    assert.equal((await app.call("/uploads/state.json")).status, 404);
  }));

test("gallery rejects SVG, spoofed image signatures, oversize bodies and markup captions", () =>
  fixture(async (app) => {
    const headers = await login(app);
    for (const dataUrl of [
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:image/png;base64,SGVsbG8gdGhpcyBpcyBub3QgYSBwaG90bw==",
    ]) {
      assert.equal(
        (
          await app.call("/api/admin/gallery", {
            method: "POST",
            headers,
            body: { dataUrl, alt: "Фото" },
          })
        ).status,
        400,
      );
    }
    assert.equal(
      (
        await app.call("/api/admin/gallery", {
          method: "POST",
          headers,
          body: { dataUrl: pixel, alt: "<script>oops</script>" },
        })
      ).status,
      400,
    );
    const tooLarge = `data:image/png;base64,${Buffer.alloc(3 * 1024 * 1024 + 1).toString("base64")}`;
    assert.equal(
      (
        await app.call("/api/admin/gallery", {
          method: "POST",
          headers,
          body: { dataUrl: tooLarge, alt: "Фото" },
        })
      ).status,
      413,
    );
  }));

test("availability protects notes, persists dates across restart and uses an independent optimistic version", () =>
  fixture(async (app, dataDir) => {
    assert.equal((await app.call("/api/admin/availability")).status, 401);
    assert.equal(
      (
        await app.call("/api/admin/availability", {
          method: "PATCH",
          body: { version: 1, changes: [] },
        })
      ).status,
      401,
    );
    const headers = await login(app);
    const initial = await app.call("/api/admin/availability", { headers });
    assert.deepEqual(initial.data, { version: 1, dates: [] });
    const changes = [
      { date: "2028-02-29", busy: true, note: "Анна, закрытая встреча" },
      { date: "2028-03-01", busy: true, note: "Личная заметка" },
      { date: "2028-02-14", busy: true },
    ];
    assert.equal(
      (
        await app.call("/api/admin/availability", {
          method: "PATCH",
          headers: { Cookie: headers.Cookie },
          body: { version: 1, changes },
        })
      ).status,
      403,
    );
    const saved = await app.call("/api/admin/availability", {
      method: "PATCH",
      headers,
      body: { version: 1, changes },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.version, 2);
    assert.deepEqual(
      saved.data.dates.map((date) => date.date),
      ["2028-02-14", "2028-02-29", "2028-03-01"],
    );
    assert.ok(
      saved.data.dates.every(
        (date) =>
          date.id && date.createdAt && date.updatedAt && date.status === "busy",
      ),
    );
    const publicDates = await app.call("/api/availability?month=2028-02");
    assert.equal(publicDates.status, 200);
    assert.deepEqual(publicDates.data, {
      month: "2028-02",
      busyDates: ["2028-02-14", "2028-02-29"],
    });
    assert.equal(JSON.stringify(publicDates.data).includes("Анна"), false);
    assert.equal((await app.call("/api/catalog")).data.version, 1);
    const stale = await app.call("/api/admin/availability", {
      method: "PATCH",
      headers,
      body: { version: 1, changes },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.code, "availability_changed");
    const concurrent = await Promise.all([
      app.call("/api/admin/availability", {
        method: "PATCH",
        headers,
        body: { version: 2, changes: [{ date: "2028-02-14", busy: false }] },
      }),
      app.call("/api/admin/availability", {
        method: "PATCH",
        headers,
        body: { version: 2, changes: [{ date: "2028-02-14", busy: false }] },
      }),
    ]);
    assert.deepEqual(
      concurrent.map((entry) => entry.status).sort(),
      [200, 409],
    );
    const before = (await app.call("/api/admin/availability", { headers }))
      .data;
    const preserve = await app.call("/api/admin/availability", {
      method: "PATCH",
      headers,
      body: { version: 3, changes: [{ date: "2028-02-29", busy: true }] },
    });
    assert.equal(preserve.data.dates[0].id, before.dates[0].id);
    assert.equal(preserve.data.dates[0].note, "Анна, закрытая встреча");
    const restarted = await start(dataDir);
    try {
      const recovered = (
        await restarted.call("/api/admin/availability", { headers })
      ).data;
      assert.deepEqual(recovered, preserve.data);
      assert.deepEqual(
        (await restarted.call("/api/availability?month=2028-02")).data
          .busyDates,
        ["2028-02-29"],
      );
    } finally {
      await restarted.close();
    }
  }));

test("availability rejects invalid dates and batches atomically and migrates existing stores without losing data", () =>
  fixture(async (app, dataDir) => {
    const headers = await login(app);
    for (const month of ["", "2028-13", "2028-2", "0000-01", "2028-02-01"])
      assert.equal(
        (await app.call(`/api/availability?month=${month}`)).status,
        400,
      );
    for (const changes of [
      [],
      [{ date: "2027-02-29", busy: true }],
      [{ date: "2028-04-31", busy: true }],
      [{ date: "2028-02-01", busy: "true" }],
      [{ date: "0000-01-01", busy: true }],
      [
        { date: "2028-02-01", busy: true },
        { date: "2028-02-01", busy: false },
      ],
      [
        { date: "2028-02-01", busy: true },
        { date: "2028-02-30", busy: true },
      ],
      [{ date: "2028-02-01", busy: true, note: "<script>private</script>" }],
      Array.from({ length: 367 }, () => ({ date: "2028-02-01", busy: true })),
    ]) {
      assert.equal(
        (
          await app.call("/api/admin/availability", {
            method: "PATCH",
            headers,
            body: { version: 1, changes },
          })
        ).status,
        400,
      );
    }
    assert.deepEqual(
      (await app.call("/api/admin/availability", { headers })).data,
      { version: 1, dates: [] },
    );
    await app.call("/api/leads", { method: "POST", body: makeLead() });
    const file = path.join(dataDir, "state.json");
    const legacy = JSON.parse(await readFile(file, "utf8"));
    delete legacy.availability;
    await writeFile(file, JSON.stringify(legacy));
    const migrated = await start(dataDir);
    try {
      assert.deepEqual(
        (await migrated.call("/api/availability?month=2028-02")).data.busyDates,
        [],
      );
      const recovered = JSON.parse(await readFile(file, "utf8"));
      assert.deepEqual(recovered.catalog, legacy.catalog);
      assert.deepEqual(recovered.leads, legacy.leads);
      assert.deepEqual(recovered.availability, { version: 1, dates: [] });
    } finally {
      await migrated.close();
    }
  }));

test("lead search includes matches beyond the first page and paginates filtered results", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "olga-search-test-"));
  let app;
  try {
    const store = await createLocalStorage(dataDir);
    const version = (await store.getCatalog()).version;
    for (let i = 0; i < 62; i++)
      await store.addLead(
        {
          id: randomUUID(),
          requestId: randomUUID(),
          fingerprint: String(i),
          name: `Клиент ${i}`,
          phone: "+7 (900) 123-45-67",
          eventType: "wedding",
          eventDate: "",
          status: i < 3 ? "closed" : "new",
          note: i < 3 ? "Редкая площадка" : "",
          createdAt: new Date().toISOString(),
          quote: { total: 0 },
        },
        version,
      );
    app = await start(dataDir);
    const headers = await login(app);
    const result = await app.call(
      "/api/admin/leads?q=" + encodeURIComponent("редкая") + "&limit=2",
      { headers },
    );
    assert.equal(result.data.total, 3);
    assert.equal(result.data.leads.length, 2);
    assert.equal(result.data.hasMore, true);
    assert.equal(result.data.leads[0].fingerprint, undefined);
    const next = await app.call(
      "/api/admin/leads?q=" +
        encodeURIComponent("редкая") +
        "&limit=2&offset=2",
      { headers },
    );
    assert.equal(next.data.leads.length, 1);
    assert.equal(next.data.hasMore, false);
    assert.equal(
      (await app.call("/api/admin/leads?status=closed", { headers })).data
        .total,
      3,
    );
    assert.equal(
      (await app.call("/api/admin/leads?q=9001234567", { headers })).data.total,
      62,
    );
    assert.equal(
      (
        await app.call("/api/admin/leads?q=" + encodeURIComponent("свадьба"), {
          headers,
        })
      ).data.total,
      62,
    );
    assert.equal(
      (await app.call("/api/admin/leads?status=unknown", { headers })).status,
      400,
    );
    assert.equal((await app.call("/api/admin/leads?q=secret")).status, 401);
  } finally {
    await app?.close();
    assert.equal(
      path.dirname(path.resolve(dataDir)),
      path.resolve(os.tmpdir()),
    );
    assert.ok(path.basename(dataDir).startsWith("olga-search-test-"));
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("gallery publication is reversible and hidden photos are excluded from the public catalog", () =>
  fixture(async (app) => {
    const headers = await login(app);
    const upload = await app.call("/api/admin/gallery", {
      method: "POST",
      headers,
      body: { dataUrl: pixel, alt: "Черновик", published: false },
    });
    assert.equal(upload.status, 201);
    const id = upload.data.photo.id;
    assert.equal(upload.data.photo.published, false);
    assert.equal((await app.call("/api/catalog")).data.gallery.length, 0);
    assert.equal(
      (await app.call("/api/admin/catalog", { headers })).data.gallery.length,
      1,
    );
    const catalog = (await app.call("/api/admin/catalog", { headers })).data;
    const repriced = await app.call("/api/admin/catalog", {
      method: "PUT",
      headers,
      body: {
        version: catalog.version,
        services: catalog.services.map((service) =>
          service.id === "host"
            ? { ...service, price: service.price + 1 }
            : service,
        ),
      },
    });
    assert.equal(repriced.status, 200);
    assert.equal(
      repriced.data.gallery.length,
      1,
      "Saving a tariff retains hidden gallery records for the administrator",
    );
    assert.equal(repriced.data.gallery[0].id, id);
    assert.equal(repriced.data.gallery[0].published, false);
    assert.equal(
      (await app.call("/api/admin/catalog", { headers })).data.gallery[0].id,
      id,
    );
    assert.equal(
      (await app.call("/api/catalog")).data.gallery.length,
      0,
      "A tariff save cannot publish a hidden photo",
    );
    const publish = () =>
      app.call(`/api/admin/gallery/${id}`, {
        method: "PATCH",
        headers,
        body: { published: true },
      });
    assert.equal((await publish()).status, 200);
    assert.equal((await app.call("/api/catalog")).data.gallery[0].id, id);
    assert.equal(
      (
        await app.call(`/api/admin/gallery/${id}`, {
          method: "PATCH",
          headers,
          body: { published: "false" },
        })
      ).status,
      400,
    );
    await app.call(`/api/admin/gallery/${id}`, {
      method: "PATCH",
      headers,
      body: { published: false },
    });
    assert.equal((await app.call("/api/catalog")).data.gallery.length, 0);
    assert.equal((await publish()).status, 200);
    assert.equal(
      (await app.call("/api/catalog")).data.gallery[0].url,
      upload.data.photo.url,
    );
  }));

test("gallery supports featured metadata and complete atomic ordering without leaking upload names", () =>
  fixture(async (app, dataDir) => {
    const headers = await login(app);
    const photos = [];
    for (const label of ["Первое", "Второе", "Третье"]) {
      const saved = await app.call("/api/admin/gallery", {
        method: "POST",
        headers,
        body: { dataUrl: pixel, alt: label, width: 1, height: 1 },
      });
      assert.equal(saved.status, 201);
      assert.equal(saved.data.photo.featured, false);
      assert.equal(saved.data.photo.width, 2);
      photos.push(saved.data.photo);
    }
    const selected = await app.call(`/api/admin/gallery/${photos[1].id}`, {
      method: "PATCH",
      headers,
      body: { featured: true },
    });
    assert.equal(selected.status, 200);
    assert.equal(selected.data.photo.alt, "Второе");
    assert.equal(selected.data.photo.featured, true);
    const ids = [photos[2].id, photos[0].id, photos[1].id];
    assert.equal(
      (
        await app.call("/api/admin/gallery/order", {
          method: "PUT",
          body: { ids },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await app.call("/api/admin/gallery/order", {
          method: "PUT",
          headers: { Cookie: headers.Cookie },
          body: { ids },
        })
      ).status,
      403,
    );
    const ordered = await app.call("/api/admin/gallery/order", {
      method: "PUT",
      headers,
      body: { ids },
    });
    assert.equal(ordered.status, 200);
    assert.deepEqual(
      ordered.data.gallery.map((photo) => photo.id),
      ids,
    );
    assert.ok(
      ordered.data.gallery.every((photo) => photo.filename === undefined),
    );
    assert.equal(ordered.data.gallery[2].featured, true);
    for (const staleIds of [[ids[0]], [randomUUID(), ids[1], ids[2]]]) {
      const result = await app.call("/api/admin/gallery/order", {
        method: "PUT",
        headers,
        body: { ids: staleIds },
      });
      assert.equal(result.status, 409);
      assert.equal(result.data.code, "gallery_changed");
    }
    assert.equal(
      (
        await app.call("/api/admin/gallery/order", {
          method: "PUT",
          headers,
          body: { ids: [ids[0], ids[0]] },
        })
      ).status,
      400,
    );
    for (const fields of [
      { featured: "true" },
      { width: 0, height: 1 },
      { width: 1 },
      { width: 20_000, height: 1 },
    ])
      assert.equal(
        (
          await app.call("/api/admin/gallery", {
            method: "POST",
            headers,
            body: { dataUrl: pixel, alt: "Фото", ...fields },
          })
        ).status,
        400,
      );
    const restarted = await start(dataDir);
    try {
      assert.deepEqual(
        (await restarted.call("/api/catalog")).data.gallery,
        ordered.data.gallery,
      );
    } finally {
      await restarted.close();
    }
  }));

test("login throttling and fail-closed production keep misconfigured services private", async () => {
  await fixture(async (app) => {
    for (let attempt = 0; attempt < 8; attempt += 1)
      assert.equal(
        (
          await app.call("/api/admin/login", {
            method: "POST",
            body: { password: "wrong" },
          })
        ).status,
        401,
      );
    const blocked = await app.call("/api/admin/login", {
      method: "POST",
      body: { password },
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), "900");
  });
  await fixture(
    async (app, dataDir) => {
      assert.equal((await app.call("/api/catalog")).status, 503);
      const availability = await app.call("/api/availability?month=2028-02");
      assert.equal(availability.status, 503);
      assert.equal(availability.data.busyDates, undefined);
      assert.equal(
        (await app.call("/api/leads", { method: "POST", body: makeLead() }))
          .status,
        503,
      );
      await assert.rejects(readFile(path.join(dataDir, "state.json")), {
        code: "ENOENT",
      });
    },
    { ...basicEnv, NODE_ENV: "production", APP_ORIGIN: "https://olga.example" },
  );
});

test("malformed JSON, wrong content type and unexpected methods are rejected", () =>
  fixture(async (app) => {
    assert.equal(
      (await app.call("/api/quote", { method: "POST", body: "{" })).status,
      400,
    );
    assert.equal(
      (await app.call("/api/quote", { method: "POST", body: "[]" })).status,
      400,
    );
    assert.equal(
      (
        await app.call("/api/quote", {
          method: "POST",
          body: {},
          headers: { "Content-Type": "text/plain" },
        })
      ).status,
      415,
    );
    assert.equal(
      (await app.call("/api/catalog", { method: "OPTIONS" })).status,
      405,
    );
    assert.equal(
      (
        await app.call("/api/quote", {
          method: "POST",
          body: { items: [] },
          headers: { "Sec-Fetch-Site": "cross-site" },
        })
      ).status,
      403,
    );
  }));

test("password hashing and verification are salted and reject incorrect passwords", async () => {
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("incorrect", hash), false);
  assert.equal(await verifyPassword(password, "not-a-hash"), false);
  const otherHash = await hashPassword(password);
  assert.notEqual(hash, otherHash);
  await assert.rejects(hashPassword("short"));
});

test("Supabase adapter uses server credentials and transactional RPC without client SDK", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers.apikey, "server-only-test-key");
    assert.equal(options.headers.Authorization, "Bearer server-only-test-key");
    let payload = null;
    if (url.includes("olga_rate_limit")) payload = true;
    if (url.includes("olga_search_leads")) payload = { leads: [], total: 0 };
    if (url.includes("olga_site?"))
      payload = [{ catalog: { version: 1, services: [], gallery: [] } }];
    if (url.includes("olga_availability?"))
      payload = [{ version: 2, dates: [] }];
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const store = await createSupabaseStorage(
    {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-test-key",
    },
    fetchImpl,
  );
  assert.equal(store.kind, "supabase");
  assert.equal((await store.getCatalog()).version, 1);
  assert.equal(await store.rateLimit("hashed-key", 8, 900), true);
  await store.saveCatalog(1, []);
  assert.equal((await store.getAvailability()).version, 2);
  await store.saveAvailability(2, [{ date: "2028-02-29", busy: true }]);
  await store.orderGallery([]);
  await store.addLead({ id: randomUUID(), requestId: randomUUID() }, 1);
  assert.deepEqual(
    await store.getLeads({
      query: "Площадка",
      status: "new",
      offset: 50,
      limit: 50,
    }),
    { leads: [], total: 0 },
  );
  assert.ok(
    calls.some(
      (call) =>
        call.url.endsWith("/rpc/olga_search_leads") &&
        JSON.stringify(JSON.parse(call.options.body)) ===
          JSON.stringify({
            search_text: "Площадка",
            status_filter: "new",
            page_offset: 50,
            page_limit: 50,
          }),
    ),
  );
  const image = await store.upload({
    bytes: Buffer.from("test"),
    extension: "png",
    mime: "image/png",
  });
  assert.match(
    image.url,
    /^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/olga-gallery\//,
  );
  assert.ok(calls.some((call) => call.url.endsWith("/rpc/olga_initialize")));
  assert.ok(calls.some((call) => call.url.endsWith("/rpc/olga_save_catalog")));
  assert.ok(calls.some((call) => call.url.endsWith("/rpc/olga_add_lead")));
  assert.ok(
    calls.some(
      (call) =>
        call.url.endsWith("/rpc/olga_save_availability") &&
        JSON.parse(call.options.body).expected_version === 2,
    ),
  );
  assert.ok(calls.some((call) => call.url.endsWith("/rpc/olga_order_gallery")));
  assert.ok(
    calls.some((call) => call.options.headers["Content-Type"] === "image/png"),
  );
});

test("setup creates private local credentials without printing passwords or replacing an existing setup", () =>
  fixture(async (app, dataDir) => {
    const run = promisify(execFile);
    const script = fileURLToPath(
      new URL("../scripts/setup-admin.mjs", import.meta.url),
    );
    const result = await run(process.execPath, [script], {
      cwd: dataDir,
      env: { ...process.env, ADMIN_SETUP_PASSWORD: password },
    });
    assert.equal(result.stdout.includes(password), false);
    assert.equal(result.stderr.includes(password), false);
    const env = await readFile(path.join(dataDir, ".env.local"), "utf8");
    assert.equal(env.includes(password), false);
    const savedHash = /^ADMIN_PASSWORD_HASH=(.+)$/m
      .exec(env)[1]
      .replace(/\\\$/g, "$");
    assert.equal(await verifyPassword(password, savedHash), true);
    const credentials = await readFile(
      path.join(dataDir, "artifacts", "admin-access.txt"),
      "utf8",
    );
    assert.ok(credentials.includes(password));
    await assert.rejects(
      run(process.execPath, [script], {
        cwd: dataDir,
        env: {
          ...process.env,
          ADMIN_SETUP_PASSWORD: "different-strong-password",
        },
      }),
      { code: 1 },
    );
    assert.equal(await readFile(path.join(dataDir, ".env.local"), "utf8"), env);
  }));
