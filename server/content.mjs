import { HttpError, object, text } from "./validation.mjs";
import { emptyTerms, termFields } from "../lib/terms.js";
export const emptyContent = () => ({
  version: 1,
  videoUrl: "",
  videoCaption: "",
  reviews: [],
  terms: emptyTerms(),
});
export function safePublicUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {}
  throw new HttpError(400, "Укажите HTTPS-ссылку без логина и пароля.");
}
export function validateContent(body, previousTerms = emptyTerms()) {
  if (!body || !Number.isInteger(body.version) || body.version < 1)
    throw new HttpError(400, "Обновите материалы перед сохранением.");
  if (!Array.isArray(body.reviews) || body.reviews.length > 12)
    throw new HttpError(400, "Допустимо до 12 отзывов.");
  // Preserve conditions when an older editor omits them. The content version
  // still protects the complete document from concurrent overwrites.
  const terms = Object.hasOwn(body, "terms")
    ? object(body.terms)
    : previousTerms;
  if (typeof terms.published !== "boolean")
    throw new HttpError(400, "Проверьте статус условий.");
  const validatedTerms = {
    published: terms.published,
    ...Object.fromEntries(
      termFields.map(([key, label]) => [
        key,
        text(terms[key], label, 600, { optional: !terms.published }),
      ]),
    ),
  };
  return {
    terms: validatedTerms,
    version: body.version,
    videoUrl: safePublicUrl(
      text(body.videoUrl, "Ссылка на видео", 1500, { optional: true }),
    ),
    videoCaption: text(body.videoCaption, "Подпись видео", 240, {
      optional: true,
    }),
    reviews: body.reviews.map((r) => {
      if (!r || typeof r.published !== "boolean")
        throw new HttpError(400, "Проверьте статус отзыва.");
      return {
        name: text(r.name, "Автор отзыва", 100),
        event: text(r.event, "Мероприятие", 120, { optional: true }),
        quote: text(r.quote, "Текст отзыва", 2000),
        source: safePublicUrl(
          text(r.source, "Источник", 1500, { optional: true }),
        ),
        published: r.published,
      };
    }),
  };
}
export function publicContent(content, includeDrafts = false) {
  const c = content || emptyContent();
  const { terms, ...materials } = c;
  return {
    ...materials,
    ...(terms && (includeDrafts || terms.published) ? { terms } : {}),
    reviews: c.reviews.filter((r) => includeDrafts || r.published),
  };
}
