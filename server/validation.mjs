import { createHash } from "node:crypto";
import { validPhone } from "../public/booking-rules.js";

export class HttpError extends Error {
  constructor(status, message, code = "invalid_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[a-z][a-z0-9-]{0,47}$/;
const UNITS = new Set(["hour", "item", "meeting"]);
export const STATUSES = new Set(["new", "contacted", "booked", "closed"]);

export function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Ожидается объект JSON.");
  }
  return value;
}

export function text(value, label, max, { optional = false, min = 1 } = {}) {
  if (optional && (value === undefined || value === null || value === ""))
    return "";
  if (typeof value !== "string")
    throw new HttpError(400, `Проверьте поле «${label}».`);
  const clean = value.trim();
  if (
    clean.length < min ||
    clean.length > max ||
    /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)
  ) {
    throw new HttpError(400, `Проверьте поле «${label}».`);
  }
  return clean;
}

export function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new HttpError(400, `Проверьте поле «${label}».`);
  }
  return value;
}

export function validateServices(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) {
    throw new HttpError(400, "Каталог должен содержать от 1 до 50 услуг.");
  }
  const seen = new Set();
  return input.map((entry) => {
    object(entry);
    if (
      typeof entry.id !== "string" ||
      !ID.test(entry.id) ||
      seen.has(entry.id)
    ) {
      throw new HttpError(
        400,
        "У каждой услуги должен быть уникальный идентификатор.",
      );
    }
    seen.add(entry.id);
    if (
      !UNITS.has(entry.unit) ||
      typeof entry.from !== "boolean" ||
      typeof entry.active !== "boolean"
    ) {
      throw new HttpError(
        400,
        "Проверьте единицу измерения и состояние услуги.",
      );
    }
    if (entry.id === "consultation" && entry.unit !== "meeting") {
      throw new HttpError(400, "Консультации рассчитываются за встречу.");
    }
    return {
      id: entry.id,
      title: text(entry.title, "Название", 120),
      description: text(entry.description, "Описание", 600, { optional: true }),
      unit: entry.unit,
      price: integer(entry.price, 0, 10_000_000, "Цена"),
      from: entry.from,
      category: text(entry.category, "Категория", 60),
      active: entry.active,
    };
  });
}

export function validateSelection(body) {
  object(body);
  if (!Array.isArray(body.items) || body.items.length > 50)
    throw new HttpError(400, "Выберите услуги из каталога.");
  const seen = new Set();
  const items = body.items.map((item) => {
    object(item);
    if (
      typeof item.id !== "string" ||
      !ID.test(item.id) ||
      seen.has(item.id) ||
      item.id === "consultation"
    ) {
      throw new HttpError(
        400,
        "Проверьте выбранные услуги. Встречи указываются отдельно.",
      );
    }
    seen.add(item.id);
    return {
      id: item.id,
      quantity: integer(item.quantity, 1, 100, "Количество"),
    };
  });
  return {
    items,
    extraMeetings: integer(
      body.extraMeetings ?? 0,
      0,
      20,
      "Дополнительные встречи",
    ),
  };
}

export function calculateQuote(catalog, selection) {
  const requested = [...selection.items];
  if (selection.extraMeetings)
    requested.push({ id: "consultation", quantity: selection.extraMeetings });
  const lines = requested.map(({ id, quantity }) => {
    const service = catalog.services.find(
      (entry) => entry.id === id && entry.active,
    );
    if (!service)
      throw new HttpError(
        400,
        "Одна из выбранных услуг больше недоступна. Обновите список.",
        "service_unavailable",
      );
    if (service.unit === "hour" && quantity > 24)
      throw new HttpError(400, "Продолжительность услуги — не более 24 часов.");
    if (service.unit === "item" && quantity > 10)
      throw new HttpError(400, "Количество комплектов — не более 10.");
    if (service.unit === "meeting" && quantity > 20)
      throw new HttpError(400, "Количество встреч — не более 20.");
    return {
      id,
      title: service.title,
      quantity,
      unit: service.unit,
      unitPrice: service.price,
      total: service.price * quantity,
      from: service.from,
    };
  });
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.total, 0),
    from: lines.some((line) => line.from),
    version: catalog.version,
  };
}

export function validateLead(body) {
  object(body);
  if (body.website) throw new HttpError(400, "Не удалось отправить заявку.");
  if (body.consent !== true)
    throw new HttpError(
      400,
      "Подтвердите согласие на обработку контактных данных.",
    );
  if (!UUID.test(body.requestId ?? ""))
    throw new HttpError(400, "Обновите страницу и повторите отправку.");
  const phone = text(body.phone, "Телефон", 32);
  if (!validPhone(phone)) {
    throw new HttpError(400, "Укажите корректный номер телефона.");
  }
  const eventDate = text(body.eventDate, "Дата", 10, { optional: true });
  if (
    eventDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
      !Number.isFinite(Date.parse(`${eventDate}T12:00:00Z`)) ||
      new Date(`${eventDate}T12:00:00Z`).toISOString().slice(0, 10) !==
        eventDate)
  ) {
    throw new HttpError(400, "Укажите корректную дату мероприятия.");
  }
  const lead = {
    ...validateSelection(body),
    requestId: body.requestId.toLowerCase(),
    name: text(body.name, "Имя", 100, { min: 2 }),
    phone,
    eventType: text(body.eventType, "Формат", 100, { optional: true }),
    eventDate,
    comment: text(body.comment, "Комментарий", 2000, { optional: true }),
    consent: true,
  };
  if (body.catalogVersion !== undefined)
    lead.catalogVersion = integer(
      body.catalogVersion,
      1,
      Number.MAX_SAFE_INTEGER,
      "Версия каталога",
    );
  return {
    ...lead,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(lead))
      .digest("hex"),
  };
}

export function calendarDate(value) {
  if (
    typeof value !== "string" ||
    !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) ||
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new HttpError(400, "Укажите корректную календарную дату.");
  }
  return value;
}

export function availabilityMonth(value) {
  if (
    typeof value !== "string" ||
    !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)
  )
    throw new HttpError(400, "Укажите месяц в формате ГГГГ-ММ.");
  return value;
}

export function availabilityChanges(body) {
  object(body);
  const version = integer(
    body.version,
    1,
    Number.MAX_SAFE_INTEGER,
    "Версия календаря",
  );
  if (
    !Array.isArray(body.changes) ||
    body.changes.length < 1 ||
    body.changes.length > 366
  )
    throw new HttpError(400, "Выберите от 1 до 366 дат.");
  const seen = new Set();
  const changes = body.changes.map((entry) => {
    object(entry);
    const date = calendarDate(entry.date);
    if (seen.has(date) || typeof entry.busy !== "boolean")
      throw new HttpError(400, "Проверьте выбранные даты и их статус.");
    seen.add(date);
    const change = { date, busy: entry.busy };
    if (entry.note !== undefined)
      change.note = text(entry.note, "Заметка к дате", 2000, {
        optional: true,
      });
    return change;
  });
  return { version, changes };
}

export function galleryOrder(body) {
  object(body);
  if (
    !Array.isArray(body.ids) ||
    body.ids.length > 200 ||
    body.ids.some((id) => typeof id !== "string" || !UUID.test(id)) ||
    new Set(body.ids.map((id) => id.toLowerCase())).size !== body.ids.length
  )
    throw new HttpError(
      400,
      "Передайте фотографии в нужном порядке без повторений.",
    );
  return body.ids.map((id) => id.toLowerCase());
}

export function galleryFields(body, { partial = false } = {}) {
  object(body);
  const fields = {};
  if (body.published !== undefined && typeof body.published !== "boolean")
    throw new HttpError(400, "Проверьте статус публикации фотографии.");
  if (!partial || body.published !== undefined)
    fields.published = body.published ?? true;
  if (!partial || body.alt !== undefined)
    fields.alt = text(body.alt, "Описание фотографии", 240);
  if (!partial || body.caption !== undefined)
    fields.caption = text(body.caption, "Подпись", 240, { optional: true });
  if (body.featured !== undefined && typeof body.featured !== "boolean")
    throw new HttpError(400, "Проверьте признак избранной фотографии.");
  if (!partial || body.featured !== undefined)
    fields.featured = body.featured ?? false;
  if (!partial && (body.width !== undefined || body.height !== undefined)) {
    fields.width = integer(body.width, 1, 16_384, "Ширина фотографии");
    fields.height = integer(body.height, 1, 16_384, "Высота фотографии");
  }
  if (!Object.keys(fields).length)
    throw new HttpError(400, "Укажите изменения фотографии.");
  return fields;
}

export function decodeImage(dataUrl) {
  if (typeof dataUrl !== "string")
    throw new HttpError(400, "Выберите изображение JPEG, PNG или WebP.");
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/.exec(
      dataUrl,
    );
  if (!match)
    throw new HttpError(400, "Допустимы только изображения JPEG, PNG и WebP.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 12 || bytes.length > 3 * 1024 * 1024)
    throw new HttpError(413, "Размер фотографии — не более 3 МБ.");
  const mime = match[1];
  const valid =
    mime === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : mime === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid)
    throw new HttpError(400, "Формат файла не соответствует изображению.");
  return {
    bytes,
    mime,
    extension: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[mime],
  };
}
