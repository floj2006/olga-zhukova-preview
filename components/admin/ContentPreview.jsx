import { termFields, termsComplete } from "../../lib/terms";
import { safePublicLink as safeLink } from "../../lib/public-link";
export default function ContentPreview({ value }) {
  const video = safeLink(value.videoUrl),
    reviews = value.reviews.filter((r) => r.published),
    terms = value.terms?.published && termsComplete(value.terms);
  return (
    <section
      id="content-preview"
      className="content-preview"
      aria-labelledby="content-preview-title"
    >
      <h2 id="content-preview-title">Предпросмотр публикации</h2>
      <p className="admin-muted">
        Показаны текущие правки. На сайте они появятся только после сохранения.
      </p>
      {video && (
        <div className="content-preview-video">
          <h3>Видео</h3>
          <p>{value.videoCaption}</p>
          <a href={video} target="_blank" rel="noopener noreferrer">
            Открыть видео ↗
          </a>
        </div>
      )}
      {value.videoUrl && !video && (
        <p>Для видео нужна корректная HTTPS-ссылка.</p>
      )}
      {reviews.map((r) => (
        <blockquote key={r.key}>
          <p>{r.quote || "Текст отзыва ещё не заполнен."}</p>
          <footer>
            {[r.name, r.event].filter(Boolean).join(" · ")}
            {safeLink(r.source) && (
              <a
                href={safeLink(r.source)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {" "}
                · Источник ↗
              </a>
            )}
          </footer>
        </blockquote>
      ))}
      {terms && (
        <div className="content-preview-terms">
          <h3>Условия бронирования</h3>
          {termFields.map(([key, label]) => (
            <div key={key}>
              <h4>{label}</h4>
              <p>{value.terms[key]}</p>
            </div>
          ))}
        </div>
      )}
      {!video && !reviews.length && !terms && (
        <p className="admin-muted">
          Публиковать пока нечего. Пустые блоки видео и отзывов будут скрыты на
          сайте.
        </p>
      )}
    </section>
  );
}
