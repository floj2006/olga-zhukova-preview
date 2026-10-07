import { deploymentStatus } from "./deployment.mjs";
import { checkCloud } from "./cloud-check.mjs";
import { normalizeImage } from "./images.mjs";
import { notifyLead, vkConfigured } from "./notifications.mjs";
import { emptyContent, validateContent } from "./content.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createLocalStorage,
  createSupabaseStorage,
  publicCatalog,
  publicPhoto,
} from "./storage.mjs";
import { checkOrigin, rateKey, sessionSecurity } from "./security.mjs";
import {
  HttpError,
  UUID,
  STATUSES,
  object,
  text,
  integer,
  validateServices,
  validateSelection,
  calculateQuote,
  validateLead,
  galleryFields,
  decodeImage,
  availabilityMonth,
  availabilityChanges,
  galleryOrder,
} from "./validation.mjs";

export async function loadLocalEnvironment(
  root = process.cwd(),
  target = process.env,
) {
  if (target.VERCEL || target.NODE_ENV === "production") return;
  let source;
  try {
    source = await readFile(path.join(root, ".env.local"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const line of source.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match || target[match[1]] !== undefined) continue;
    const value = match[2].trim();
    target[match[1]] = (
      /^(".*"|'.*')$/.test(value) ? value.slice(1, -1) : value
    ).replace(/\\\$/g, "$");
  }
}

async function bodyJson(req, maxBytes = 24_000) {
  if (
    String(req.headers["content-type"] ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  ) {
    throw new HttpError(415, "Запрос должен быть в формате JSON.");
  }
  if (Number(req.headers["content-length"]) > maxBytes)
    throw new HttpError(413, "Слишком большой запрос.");
  let raw;
  if (req.body !== undefined) {
    raw = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > maxBytes)
      throw new HttpError(413, "Слишком большой запрос.");
  } else {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > maxBytes) throw new HttpError(413, "Слишком большой запрос.");
      chunks.push(chunk);
    }
    raw = Buffer.concat(chunks).toString("utf8");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Не удалось прочитать запрос JSON.");
  }
  return object(parsed);
}

const send = (res, status, data, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(data));
};

export async function createApiHandler({
  env = process.env,
  dataDir = path.join(process.cwd(), ".data"),
  fetchImpl = fetch,
} = {}) {
  const production = Boolean(env.VERCEL) || env.NODE_ENV === "production";
  const security = sessionSecurity(env);
  let storagePromise;
  const storage = () => {
    if (!storagePromise) {
      storagePromise = (async () => {
        const useSupabase = Boolean(
          env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
        );
        if (
          production &&
          (!useSupabase ||
            !security.configured ||
            !env.APP_ORIGIN?.startsWith("https://"))
        ) {
          throw new HttpError(
            503,
            "Приём заявок пока не настроен. Позвоните Ольге.",
            "not_configured",
          );
        }
        if (useSupabase) {
          let url;
          try {
            url = new URL(env.SUPABASE_URL);
          } catch {
            throw new HttpError(
              503,
              "Хранилище не настроено.",
              "not_configured",
            );
          }
          if (
            url.protocol !== "https:" ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
          )
            throw new HttpError(
              503,
              "Хранилище не настроено.",
              "not_configured",
            );
          return createSupabaseStorage(env, fetchImpl);
        }
        return createLocalStorage(dataDir);
      })().catch((error) => {
        storagePromise = undefined;
        throw error;
      });
    }
    return storagePromise;
  };

  return async function handleApi(req, res) {
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      return false;
    }
    const route = url.pathname.replace(/\/$/, "");
    if (!route.startsWith("/api/") && !route.startsWith("/uploads/"))
      return false;
    try {
      const method = req.method ?? "GET";
      if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method))
        throw new HttpError(
          405,
          "Метод не поддерживается.",
          "method_not_allowed",
        );
      if (!["GET", "HEAD"].includes(method)) checkOrigin(req, env);

      if (route.startsWith("/uploads/")) {
        if (method !== "GET" && method !== "HEAD")
          throw new HttpError(405, "Метод не поддерживается.");
        const filename = route.slice("/uploads/".length);
        if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(filename))
          throw new HttpError(404, "Файл не найден.");
        const store = await storage();
        if (store.kind !== "local") throw new HttpError(404, "Файл не найден.");
        let data;
        try {
          data = await store.readUpload(filename);
        } catch (error) {
          if (error.code === "ENOENT")
            throw new HttpError(404, "Файл не найден.");
          throw error;
        }
        const mime = {
          ".jpg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp",
        }[path.extname(filename)];
        res.writeHead(200, {
          "Content-Type": mime,
          "Content-Length": data.length,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(method === "HEAD" ? undefined : data);
        return true;
      }

      if (route === "/api/admin/session" && method === "GET") {
        const session = security.read(req);
        send(res, session ? 200 : 401, {
          authenticated: Boolean(session),
          csrfToken: session?.csrf ?? null,
          configured: security.configured,
        });
        return true;
      }

      if (route === "/api/admin/login" && method === "POST") {
        if (!security.configured)
          throw new HttpError(
            503,
            "Админ-панель ещё не настроена.",
            "admin_not_configured",
          );
        const store = await storage();
        if (!(await store.rateLimit(rateKey(req, "login", env), 8, 15 * 60)))
          throw new HttpError(
            429,
            "Слишком много попыток входа. Повторите через 15 минут.",
            "rate_limited",
          );
        const body = await bodyJson(req, 2000);
        if (!(await security.verify(body.password)))
          throw new HttpError(401, "Неверный пароль.", "invalid_credentials");
        const session = security.issue();
        send(
          res,
          200,
          { authenticated: true, csrfToken: session.csrfToken },
          { "Set-Cookie": session.cookie },
        );
        return true;
      }

      const isAdmin = route.startsWith("/api/admin/");
      const session = isAdmin ? security.read(req) : null;
      if (isAdmin && !session)
        throw new HttpError(401, "Войдите в админ-панель.", "unauthorized");
      if (isAdmin && !["GET", "HEAD"].includes(method))
        security.checkCsrf(req, session);
      if (route === "/api/admin/logout" && method === "POST") {
        send(res, 200, { ok: true }, { "Set-Cookie": security.clearCookie() });
        return true;
      }

      if (route === "/api/admin/launch-status") {
        if (method !== "GET")
          throw new HttpError(405, "Метод не поддерживается.");
        send(res, 200, deploymentStatus(env));
        return true;
      }
      if (route === "/api/admin/cloud-check") {
        if (method !== "GET")
          throw new HttpError(405, "Метод не поддерживается.");
        send(res, 200, {
          results: await checkCloud(env, fetchImpl),
          checkedAt: new Date().toISOString(),
        });
        return true;
      }

      const store = await storage();
      if (route === "/api/availability" && method === "GET") {
        const month = availabilityMonth(url.searchParams.get("month"));
        const availability = await store.getAvailability();
        send(res, 200, {
          month,
          busyDates: availability.dates
            .filter((entry) => entry.date.startsWith(`${month}-`))
            .map((entry) => entry.date),
        });
      } else if (route === "/api/admin/availability" && method === "GET") {
        send(res, 200, await store.getAvailability());
      } else if (route === "/api/admin/availability" && method === "PATCH") {
        const { version, changes } = availabilityChanges(
          await bodyJson(req, 1_000_000),
        );
        send(res, 200, await store.saveAvailability(version, changes));
      } else if (
        (route === "/api/catalog" || route === "/api/admin/catalog") &&
        method === "GET"
      ) {
        const catalog = publicCatalog(await store.getCatalog(), {
          includeDrafts: isAdmin,
        });
        if (!isAdmin)
          catalog.services = catalog.services.filter((entry) => entry.active);
        send(res, 200, catalog);
      } else if (route === "/api/admin/content" && method === "GET") {
        send(res, 200, (await store.getCatalog()).content || emptyContent());
      } else if (route === "/api/admin/content" && method === "PUT") {
        const body = await bodyJson(req, 64000);
        const previous = (await store.getCatalog()).content || emptyContent();
        send(
          res,
          200,
          await store.saveContent(validateContent(body, previous.terms)),
        );
      } else if (route === "/api/quote" && method === "POST") {
        const selection = validateSelection(await bodyJson(req));
        send(res, 200, calculateQuote(await store.getCatalog(), selection));
      } else if (route === "/api/leads" && method === "POST") {
        const lead = validateLead(await bodyJson(req));
        // Rate-limit retries as well, preventing unrestricted lookups of random request IDs.
        if (!(await store.rateLimit(rateKey(req, "leads", env), 12, 60 * 60))) {
          const error = new HttpError(
            429,
            "Слишком много заявок. Позвоните Ольге или повторите позже.",
            "rate_limited",
          );
          error.retryAfter = 3600;
          throw error;
        }
        const existing = await store.findLead(lead.requestId);
        if (existing) {
          if (existing.fingerprint !== lead.fingerprint)
            throw new HttpError(
              409,
              "Номер отправки уже использован. Обновите форму.",
              "request_conflict",
            );
          send(res, 200, { id: existing.id, ok: true, quote: existing.quote });
        } else {
          const catalog = await store.getCatalog();
          const quote = calculateQuote(catalog, lead);
          if (
            lead.catalogVersion !== undefined &&
            lead.catalogVersion !== catalog.version
          ) {
            send(res, 409, {
              error: "Цены обновились. Проверьте расчёт перед отправкой.",
              code: "catalog_changed",
              quote,
              catalog: publicCatalog(catalog),
            });
          } else {
            const entry = await store.addLead(
              {
                ...lead,
                id: randomUUID(),
                createdAt: new Date().toISOString(),
                status: "new",
                note: "",
                quote,
              },
              catalog.version,
            );
            if (vkConfigured(env)) {
              const notification = await notifyLead(entry, env, fetchImpl);
              await store
                .updateLead(entry.id, { notification })
                .catch(() => {});
            }
            send(res, 201, { id: entry.id, ok: true, quote: entry.quote });
          }
        }
      } else if (
        /^\/api\/admin\/leads\/[^/]+\/notify$/.test(route) &&
        method === "POST"
      ) {
        const id = route.split("/")[4];
        if (!UUID.test(id)) throw new HttpError(404, "Заявка не найдена.");
        const lead = await store.getLead(id);
        if (!lead) throw new HttpError(404, "Заявка не найдена.");
        if (!vkConfigured(env))
          throw new HttpError(503, "Уведомления ВК ещё не настроены.");
        if (!(await store.rateLimit("notify:" + id, 1, 30)))
          throw new HttpError(429, "Повторите попытку через 30 секунд.");
        const notification =
          lead.notification?.status === "sent"
            ? lead.notification
            : await notifyLead(lead, env, fetchImpl);
        await store.updateLead(id, { notification });
        send(res, 200, { notification });
      } else if (route === "/api/admin/catalog" && method === "PUT") {
        const body = await bodyJson(req, 80_000);
        const version = integer(
          body.version,
          1,
          Number.MAX_SAFE_INTEGER,
          "Версия каталога",
        );
        send(
          res,
          200,
          publicCatalog(
            await store.saveCatalog(version, validateServices(body.services)),
            { includeDrafts: true },
          ),
        );
      } else if (route === "/api/admin/leads" && method === "GET") {
        const limit = integer(
          Number(url.searchParams.get("limit") ?? 50),
          1,
          100,
          "Количество заявок",
        );
        const offset = integer(
          Number(url.searchParams.get("offset") ?? 0),
          0,
          1_000_000,
          "Страница",
        );
        const query = text(url.searchParams.get("q") || "", "Поиск", 200, {
          optional: true,
        });
        const status = url.searchParams.get("status") || "";
        if (status && !STATUSES.has(status))
          throw new HttpError(400, "Выберите статус заявки.");
        const result = await store.getLeads({ limit, offset, query, status });
        // Internal idempotency fingerprints are never exposed to the admin browser.
        result.leads = result.leads.map(({ fingerprint, ...entry }) => entry);
        send(res, 200, {
          ...result,
          offset,
          limit,
          hasMore:
            result.hasMore ?? offset + result.leads.length < result.total,
        });
      } else if (
        /^\/api\/admin\/leads\/[^/]+$/.test(route) &&
        method === "PATCH"
      ) {
        const id = route.split("/").at(-1);
        if (!UUID.test(id)) throw new HttpError(404, "Заявка не найдена.");
        const body = await bodyJson(req);
        if (!STATUSES.has(body.status))
          throw new HttpError(400, "Выберите статус заявки.");
        const { fingerprint, ...lead } = await store.updateLead(
          id,
          {
            status: body.status,
            note: text(body.note, "Заметка", 4000, { optional: true }),
          },
          body.version === undefined
            ? undefined
            : integer(
                body.version,
                1,
                Number.MAX_SAFE_INTEGER,
                "Версия заявки",
              ),
        );
        send(res, 200, { lead });
      } else if (route === "/api/admin/gallery" && method === "POST") {
        const body = await bodyJson(req, 4_300_000);
        const fields = galleryFields(body);
        const normalized = await normalizeImage(decodeImage(body.dataUrl));
        const upload = await store.upload(normalized);
        fields.width = normalized.width;
        fields.height = normalized.height;
        let entry;
        try {
          entry = await store.addGallery({
            id: randomUUID(),
            ...upload,
            ...fields,
          });
        } catch (error) {
          await store.removeUpload(upload.filename).catch(() => {});
          throw error;
        }
        send(res, 201, { photo: publicPhoto(entry) });
      } else if (route === "/api/admin/gallery/order" && method === "PUT") {
        const ids = galleryOrder(await bodyJson(req));
        send(res, 200, {
          gallery: (await store.orderGallery(ids)).map(publicPhoto),
        });
      } else if (
        /^\/api\/admin\/gallery\/[^/]+$/.test(route) &&
        ["PATCH", "DELETE"].includes(method)
      ) {
        const id = route.split("/").at(-1);
        if (!UUID.test(id)) throw new HttpError(404, "Фотография не найдена.");
        if (method === "PATCH") {
          const body = await bodyJson(req);
          const photo = await store.updateGallery(
            id,
            galleryFields(body, { partial: true }),
            body.version === undefined
              ? undefined
              : integer(
                  body.version,
                  1,
                  Number.MAX_SAFE_INTEGER,
                  "Версия фотографии",
                ),
          );
          send(res, 200, { photo: publicPhoto(photo) });
        } else {
          const photo = await store.deleteGallery(id);
          // Delete content first; a storage outage can leave an unreferenced file but never a broken public gallery entry.
          await store.removeUpload(photo.filename).catch(() => {});
          send(res, 200, { ok: true });
        }
      } else {
        throw new HttpError(404, "Страница API не найдена.", "not_found");
      }
    } catch (error) {
      if (!res.headersSent)
        send(
          res,
          error instanceof HttpError ? error.status : 503,
          {
            error:
              error instanceof HttpError
                ? error.message
                : "Сервис временно недоступен. Попробуйте позже.",
            code:
              error instanceof HttpError ? error.code : "service_unavailable",
          },
          error.status === 429
            ? { "Retry-After": String(error.retryAfter ?? 900) }
            : {},
        );
      else if (!res.writableEnded) res.end();
    }
    return true;
  };
}
