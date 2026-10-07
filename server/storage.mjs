import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "./validation.mjs";
import { eventToday } from "../public/booking-rules.js";
import { matchesLead } from "./lead-search.mjs";

import { emptyContent, publicContent } from "./content.mjs";

const seedUrl = new URL("./catalog-default.json", import.meta.url);
const clone = (value) => structuredClone(value);
export const seedCatalog = async () =>
  JSON.parse(await readFile(seedUrl, "utf8"));

export function publicPhoto({
  id,
  url,
  caption,
  alt,
  featured,
  published,
  width,
  height,
  version,
}) {
  return {
    id,
    url,
    caption,
    alt,
    version: version || 1,
    featured: featured === true,
    published: published !== false,
    ...(width && height ? { width, height } : {}),
  };
}

export function publicCatalog(catalog, { includeDrafts = false } = {}) {
  return {
    version: catalog.version,
    content: publicContent(catalog.content, includeDrafts),
    services: catalog.services,
    firstMeetingFree: true,
    gallery: catalog.gallery
      .filter((photo) => includeDrafts || photo.published !== false)
      .map(publicPhoto),
  };
}

export async function createLocalStorage(dataDir) {
  const directory = path.resolve(dataDir);
  const stateFile = path.join(directory, "state.json");
  await mkdir(path.join(directory, "uploads"), { recursive: true });
  let state;
  try {
    state = JSON.parse(await readFile(stateFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    state = { catalog: await seedCatalog(), leads: [] };
    await writeFile(stateFile, JSON.stringify(state), {
      flag: "wx",
      mode: 0o600,
    });
  }
  if (!state.catalog?.services || !Array.isArray(state.leads))
    throw new Error("Invalid local data store.");
  let queue = Promise.resolve();
  const mutate = (update) => {
    const job = queue.then(async () => {
      const next = clone(state);
      const result = await update(next);
      const temporary = path.join(directory, `state-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
        await rename(temporary, stateFile);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      state = next;
      return clone(result);
    });
    queue = job.catch(() => {});
    return job;
  };
  // Existing installations keep their catalog, requests and uploaded files.
  if (state.availability === undefined)
    await mutate((next) => {
      next.availability = { version: 1, dates: [] };
    });
  if (
    !Number.isSafeInteger(state.availability?.version) ||
    state.availability.version < 1 ||
    !Array.isArray(state.availability.dates)
  )
    throw new Error("Invalid availability data store.");
  const rates = new Map();
  return {
    kind: "local",
    getLead: async (id) => {
      await queue;
      return clone(state.leads.find((lead) => lead.id === id) || null);
    },
    saveContent: (content) =>
      mutate((next) => {
        const current = next.catalog.content || emptyContent();
        if (current.version !== content.version)
          throw new HttpError(
            409,
            "Материалы изменены. Обновите страницу.",
            "content_changed",
          );
        next.catalog.content = { ...content, version: content.version + 1 };
        return next.catalog.content;
      }),
    getAvailability: async () => {
      await queue;
      return clone(state.availability);
    },
    saveAvailability: (version, changes) =>
      mutate((next) => {
        if (version !== next.availability.version)
          throw new HttpError(
            409,
            "Календарь уже изменён. Загрузите свежую версию.",
            "availability_changed",
          );
        const dates = new Map(
          next.availability.dates.map((entry) => [entry.date, entry]),
        );
        const now = new Date().toISOString();
        for (const change of changes) {
          if (!change.busy) {
            dates.delete(change.date);
            continue;
          }
          const existing = dates.get(change.date);
          dates.set(change.date, {
            id: existing?.id ?? randomUUID(),
            date: change.date,
            status: "busy",
            note: change.note ?? existing?.note ?? "",
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          });
        }
        next.availability = {
          version: version + 1,
          dates: [...dates.values()].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        };
        return next.availability;
      }),
    getCatalog: async () => {
      await queue;
      return clone(state.catalog);
    },
    saveCatalog: (version, services) =>
      mutate((next) => {
        if (version !== next.catalog.version)
          throw new HttpError(
            409,
            "Каталог уже изменён. Загрузите свежую версию.",
            "catalog_changed",
          );
        next.catalog.services = services;
        next.catalog.version += 1;
        return next.catalog;
      }),
    findLead: async (requestId) => {
      await queue;
      return clone(
        state.leads.find((lead) => lead.requestId === requestId) ?? null,
      );
    },
    addLead: (lead, version) =>
      mutate((next) => {
        const existing = next.leads.find(
          (entry) => entry.requestId === lead.requestId,
        );
        if (existing) {
          if (existing.fingerprint !== lead.fingerprint)
            throw new HttpError(
              409,
              "Номер отправки уже использован. Обновите форму.",
              "request_conflict",
            );
          return existing;
        }
        if (version !== next.catalog.version)
          throw new HttpError(
            409,
            "Цены обновились. Проверьте расчёт перед отправкой.",
            "catalog_changed",
          );
        if (lead.eventDate && lead.eventDate < eventToday())
          throw new HttpError(
            400,
            "Выберите сегодняшнюю или будущую дату.",
            "date_past",
          );
        if (
          lead.eventDate &&
          next.availability.dates.some((entry) => entry.date === lead.eventDate)
        )
          throw new HttpError(
            409,
            "Эта дата уже занята. Выберите другую дату.",
            "date_busy",
          );
        next.leads.unshift(lead);
        return lead;
      }),
    getLeads: async ({ offset, limit, query = "", status = "" }) => {
      await queue;
      const matches = state.leads.filter((lead) =>
        matchesLead(lead, query, status),
      );
      return {
        leads: clone(matches.slice(offset, offset + limit)),
        total: matches.length,
      };
    },
    updateLead: (id, changes, expectedVersion) =>
      mutate((next) => {
        const lead = next.leads.find((entry) => entry.id === id);
        if (!lead) throw new HttpError(404, "Заявка не найдена.", "not_found");
        if (
          expectedVersion !== undefined &&
          (lead.version || 1) !== expectedVersion
        )
          throw new HttpError(
            409,
            "Заявка изменена в другой вкладке. Скопируйте правки и обновите список.",
            "record_changed",
          );
        Object.assign(lead, changes, {
          updatedAt: new Date().toISOString(),
          version: (lead.version || 1) + (changes.status !== undefined ? 1 : 0),
        });
        return lead;
      }),
    upload: async ({ bytes, extension }) => {
      const filename = `${randomUUID()}.${extension}`;
      await writeFile(path.join(directory, "uploads", filename), bytes, {
        flag: "wx",
        mode: 0o600,
      });
      return { filename, url: `/uploads/${filename}` };
    },
    removeUpload: (filename) =>
      unlink(path.join(directory, "uploads", filename)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      }),
    readUpload: (filename) =>
      readFile(path.join(directory, "uploads", filename)),
    addGallery: (entry) =>
      mutate((next) => {
        if (next.catalog.gallery.length >= 200)
          throw new HttpError(
            400,
            "В галерее уже 200 фотографий. Удалите ненужные снимки.",
          );
        next.catalog.gallery.push(entry);
        return entry;
      }),
    updateGallery: (id, changes, expectedVersion) =>
      mutate((next) => {
        const entry = next.catalog.gallery.find((photo) => photo.id === id);
        if (!entry)
          throw new HttpError(404, "Фотография не найдена.", "not_found");
        if (
          expectedVersion !== undefined &&
          (entry.version || 1) !== expectedVersion
        )
          throw new HttpError(
            409,
            "Фотография изменена в другой вкладке. Скопируйте правки и обновите галерею.",
            "record_changed",
          );
        Object.assign(entry, changes, { version: (entry.version || 1) + 1 });
        return entry;
      }),
    deleteGallery: (id) =>
      mutate((next) => {
        const index = next.catalog.gallery.findIndex(
          (photo) => photo.id === id,
        );
        if (index < 0)
          throw new HttpError(404, "Фотография не найдена.", "not_found");
        return next.catalog.gallery.splice(index, 1)[0];
      }),
    orderGallery: (ids) =>
      mutate((next) => {
        const photos = new Map(
          next.catalog.gallery.map((photo) => [photo.id, photo]),
        );
        if (
          ids.length !== photos.size ||
          new Set(ids).size !== ids.length ||
          ids.some((id) => !photos.has(id))
        )
          throw new HttpError(
            409,
            "Галерея уже изменилась. Обновите список фотографий.",
            "gallery_changed",
          );
        next.catalog.gallery = ids.map((id) => photos.get(id));
        return next.catalog.gallery;
      }),
    rateLimit: async (key, limit, windowSeconds) => {
      const now = Date.now();
      // Bound the memory used by distinct clients without keeping IP addresses.
      if (rates.size > 1000)
        for (const [entry, rate] of rates)
          if (rate.until <= now) rates.delete(entry);
      let rate = rates.get(key);
      if (!rate || rate.until <= now) {
        rate = { count: 0, until: now + windowSeconds * 1000 };
        rates.set(key, rate);
      }
      rate.count += 1;
      return rate.count <= limit;
    },
  };
}

export async function createSupabaseStorage(env, fetchImpl = fetch) {
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = env.SUPABASE_GALLERY_BUCKET || "olga-gallery";
  if (!/^[a-z0-9-]{1,63}$/.test(bucket))
    throw new Error("Invalid gallery bucket.");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const request = async (url, options = {}) => {
    let response;
    try {
      response = await fetchImpl(`${base}${url}`, {
        ...options,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HttpError(
        503,
        "Хранилище временно недоступно. Попробуйте позже.",
        "storage_unavailable",
      );
    }
    const body = await response.text();
    let data;
    try {
      data = body ? JSON.parse(body) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message = data?.message ?? "";
      if (message.includes("record_changed"))
        throw new HttpError(
          409,
          "Запись изменена в другой вкладке. Скопируйте правки и обновите список.",
          "record_changed",
        );
      if (message.includes("content_changed"))
        throw new HttpError(
          409,
          "Материалы изменены. Обновите страницу.",
          "content_changed",
        );
      if (message.includes("date_busy"))
        throw new HttpError(
          409,
          "Эта дата уже занята. Выберите другую дату.",
          "date_busy",
        );
      if (message.includes("date_past"))
        throw new HttpError(
          400,
          "Выберите сегодняшнюю или будущую дату.",
          "date_past",
        );
      if (message.includes("content_changed"))
        throw new HttpError(
          409,
          "Материалы изменены. Обновите страницу.",
          "content_changed",
        );
      if (message.includes("catalog_changed"))
        throw new HttpError(
          409,
          "Цены обновились. Проверьте расчёт.",
          "catalog_changed",
        );
      if (message.includes("availability_changed"))
        throw new HttpError(
          409,
          "Календарь уже изменён. Загрузите свежую версию.",
          "availability_changed",
        );
      if (message.includes("gallery_changed"))
        throw new HttpError(
          409,
          "Галерея уже изменилась. Обновите список фотографий.",
          "gallery_changed",
        );
      if (message.includes("request_conflict"))
        throw new HttpError(
          409,
          "Номер отправки уже использован. Обновите форму.",
          "request_conflict",
        );
      if (message.includes("gallery_limit"))
        throw new HttpError(400, "В галерее уже 200 фотографий.");
      if (message.includes("not_found"))
        throw new HttpError(404, "Запись не найдена.", "not_found");
      throw new HttpError(
        503,
        "Хранилище временно недоступно. Попробуйте позже.",
        "storage_unavailable",
      );
    }
    return data;
  };
  const rpc = (name, body) =>
    request(`/rest/v1/rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  await rpc("olga_initialize", { seed: await seedCatalog() });
  return {
    kind: "supabase",
    getLead: async (id) =>
      (
        await request(
          "/rest/v1/olga_leads?id=eq." +
            encodeURIComponent(id) +
            "&select=data",
        )
      )[0]?.data || null,
    saveContent: (content) =>
      rpc("olga_save_content", {
        expected_version: content.version,
        new_content: content,
      }),
    getAvailability: async () => {
      const rows = await request(
        "/rest/v1/olga_availability?id=eq.main&select=version,dates",
      );
      if (
        !Number.isSafeInteger(rows?.[0]?.version) ||
        !Array.isArray(rows?.[0]?.dates)
      )
        throw new HttpError(
          503,
          "Календарь временно недоступен.",
          "storage_unavailable",
        );
      return rows[0];
    },
    saveAvailability: (version, changes) =>
      rpc("olga_save_availability", {
        expected_version: version,
        date_changes: changes,
      }),
    getCatalog: async () => {
      const rows = await request(
        "/rest/v1/olga_site?id=eq.main&select=catalog",
      );
      if (!rows?.[0]?.catalog)
        throw new HttpError(
          503,
          "Каталог пока недоступен.",
          "storage_unavailable",
        );
      return rows[0].catalog;
    },
    saveCatalog: (version, services) =>
      rpc("olga_save_catalog", {
        expected_version: version,
        new_services: services,
      }),
    findLead: async (requestId) => {
      const rows = await request(
        `/rest/v1/olga_leads?request_id=eq.${requestId}&select=data&limit=1`,
      );
      return rows?.[0]?.data ?? null;
    },
    addLead: (lead, version) =>
      rpc("olga_add_lead", { entry: lead, expected_version: version }),
    getLeads: async ({ offset, limit, query = "", status = "" }) => {
      if (query || status)
        return rpc("olga_search_leads", {
          search_text: query,
          status_filter: status,
          page_offset: offset,
          page_limit: limit,
        });
      const rows = await request(
        `/rest/v1/olga_leads?select=data&order=created_at.desc&offset=${offset}&limit=${limit + 1}`,
      );
      return {
        leads: rows.slice(0, limit).map((row) => row.data),
        hasMore: rows.length > limit,
      };
    },
    updateLead: (id, changes, expectedVersion) =>
      rpc("olga_update_lead", {
        lead_id: id,
        changes: {
          ...changes,
          updatedAt: new Date().toISOString(),
          ...(expectedVersion === undefined
            ? {}
            : { _expectedVersion: expectedVersion }),
        },
      }),
    upload: async ({ bytes, extension, mime }) => {
      const filename = `${randomUUID()}.${extension}`;
      await request(`/storage/v1/object/${bucket}/${filename}`, {
        method: "POST",
        headers: {
          "Content-Type": mime,
          "Cache-Control": "3600",
          "x-upsert": "false",
        },
        body: bytes,
      });
      return {
        filename,
        url: `${base}/storage/v1/object/public/${bucket}/${filename}`,
      };
    },
    removeUpload: (filename) =>
      request(`/storage/v1/object/${bucket}`, {
        method: "DELETE",
        body: JSON.stringify({ prefixes: [filename] }),
      }),
    addGallery: (entry) =>
      rpc("olga_gallery", { operation: "add", photo_id: entry.id, entry }),
    updateGallery: (id, changes, expectedVersion) =>
      rpc("olga_gallery", {
        operation: "update",
        photo_id: id,
        entry: {
          ...changes,
          ...(expectedVersion === undefined
            ? {}
            : { _expectedVersion: expectedVersion }),
        },
      }),
    deleteGallery: (id) =>
      rpc("olga_gallery", { operation: "delete", photo_id: id, entry: {} }),
    orderGallery: (ids) => rpc("olga_order_gallery", { photo_ids: ids }),
    rateLimit: (key, limit, windowSeconds) =>
      rpc("olga_rate_limit", {
        bucket_key: key,
        max_count: limit,
        window_seconds: windowSeconds,
      }),
  };
}
