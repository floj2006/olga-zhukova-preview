"use client";
import { useEffect, useRef, useState } from "react";
import useContentEditor, { draftText } from "./useContentEditor";
import ContentPreview from "./ContentPreview";
import { termFields, termsComplete } from "../../lib/terms";

export default function ContentEditor() {
  const editor = useContentEditor();
  const {
    host,
    value,
    busy,
    loaded,
    message,
    conflict,
    dirty,
    update,
    load,
    save,
    discard,
    report,
  } = editor;
  const [preview, setPreview] = useState(false),
    [copy, setCopy] = useState("");
  const copyGeneration = useRef(0),
    copyArea = useRef(null),
    focusReview = useRef(null),
    addButton = useRef(null);
  useEffect(() => {
    if (copy) {
      copyArea.current?.focus();
      copyArea.current?.select();
    }
  }, [copy]);
  useEffect(() => {
    if (!loaded) {
      copyGeneration.current++;
      setCopy("");
      setPreview(false);
    }
  }, [loaded]);
  useEffect(() => {
    if (focusReview.current) {
      document
        .getElementById("review-" + focusReview.current + "-name")
        ?.focus();
      focusReview.current = null;
    }
  }, [value.reviews]);
  const field = (key, next) => update((v) => ({ ...v, [key]: next }));
  const reviewField = (key, field, next) =>
    update((v) => ({
      ...v,
      reviews: v.reviews.map((r) =>
        r.key === key ? { ...r, [field]: next } : r,
      ),
    }));
  function addReview() {
    if (value.reviews.length >= 12) return;
    const key = crypto.randomUUID();
    focusReview.current = key;
    update((v) => ({
      ...v,
      reviews: [
        ...v.reviews,
        { key, name: "", event: "", quote: "", source: "", published: false },
      ],
    }));
  }
  function removeReview(key) {
    if (
      !confirm(
        "Убрать отзыв из списка? На сайте он исчезнет только после сохранения.",
      )
    )
      return;
    update((v) => ({ ...v, reviews: v.reviews.filter((r) => r.key !== key) }));
    addButton.current?.focus();
  }
  async function copyDraft() {
    const generation = copyGeneration.current;
    const text = draftText(value);
    try {
      await navigator.clipboard.writeText(text);
      if (generation !== copyGeneration.current) return;
      setCopy("");
      report(
        "Тексты скопированы. Сохраните их перед обновлением страницы.",
        "success",
      );
    } catch {
      if (generation !== copyGeneration.current) return;
      setCopy(text);
    }
  }
  const published = value.reviews.filter((r) => r.published).length;
  return (
    <div ref={host}>
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">РЕАЛЬНЫЕ МАТЕРИАЛЫ</p>
          <h1>Материалы и условия</h1>
          <p className="admin-muted">
            Публикуйте материалы с разрешением авторов. Пустые блоки на сайте
            скрыты.
          </p>
        </div>
        <button
          id="content-refresh"
          type="button"
          className="admin-button secondary"
          disabled={busy}
          onClick={() => load(true)}
        >
          {loaded ? "Обновить" : "Загрузить материалы"}
        </button>
      </div>
      <div className="content-toolbar" hidden={!loaded}>
        <p id="content-state" role="status">
          {busy
            ? "Идёт запрос…"
            : conflict
              ? "Конфликт версий"
              : dirty
                ? "Есть несохранённые изменения"
                : "Все изменения сохранены"}
        </p>
        <button
          type="button"
          className="admin-button secondary"
          aria-expanded={preview}
          aria-controls="content-preview"
          onClick={() => setPreview(!preview)}
        >
          Предпросмотр
        </button>
      </div>
      <form
        id="content-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <fieldset
          id="content-fields"
          className="content-editor"
          disabled={busy || !loaded}
        >
          <legend>Материалы сайта</legend>
          <label className="admin-field">
            Ссылка на видео
            <input
              id="content-video"
              type="url"
              maxLength={1500}
              placeholder="https://..."
              value={value.videoUrl}
              onChange={(e) => field("videoUrl", e.target.value)}
            />
            <small>
              Ссылка на ролик в ВК или другом видеосервисе. Откроется по
              нажатию.
            </small>
          </label>
          <label className="admin-field">
            Подпись к видео
            <input
              id="content-caption"
              maxLength={240}
              value={value.videoCaption}
              onChange={(e) => field("videoCaption", e.target.value)}
            />
          </label>
          <fieldset className="content-review content-terms">
            <legend>
              Условия бронирования ·{" "}
              {value.terms.published ? "На сайте после сохранения" : "Черновик"}
            </legend>
            <p className="admin-muted" id="content-terms-help">
              Укажите согласованные условия своими словами. Черновик доступен
              только в админке.
            </p>
            {termFields.map(([key, label]) => (
              <label
                className="admin-field"
                key={key}
                htmlFor={"content-term-" + key}
              >
                {label}
                <textarea
                  id={"content-term-" + key}
                  rows={3}
                  maxLength={600}
                  required={value.terms.published}
                  value={value.terms[key]}
                  onChange={(e) =>
                    update((v) => ({
                      ...v,
                      terms: { ...v.terms, [key]: e.target.value },
                    }))
                  }
                />
              </label>
            ))}
            <label className="admin-check">
              <input
                id="content-terms-published"
                type="checkbox"
                checked={value.terms.published}
                disabled={!value.terms.published && !termsComplete(value.terms)}
                aria-describedby="content-terms-help"
                onChange={(e) =>
                  update((v) => ({
                    ...v,
                    terms: { ...v.terms, published: e.target.checked },
                  }))
                }
              />
              Условия подтверждены, показывать в FAQ
            </label>
          </fieldset>
          <div className="content-review-heading">
            <h2>Отзывы</h2>
            <p id="content-review-count" className="admin-muted">
              {value.reviews.length} из 12 · На сайте: {published} · Черновики:{" "}
              {value.reviews.length - published}
            </p>
          </div>
          {!value.reviews.length && (
            <p className="admin-muted" id="content-empty">
              Отзывов пока нет. Добавьте первый — он сохранится как черновик,
              пока вы не включите публикацию.
            </p>
          )}
          <div id="content-reviews">
            {value.reviews.map((r, index) => (
              <fieldset className="content-review" key={r.key}>
                <legend>
                  Отзыв {index + 1} ·{" "}
                  {r.published ? "На сайте после сохранения" : "Черновик"}
                </legend>
                {["name", "event", "quote", "source"].map((key) => {
                  const id = "review-" + r.key + "-" + key,
                    labels = {
                      name: "Автор",
                      event: "Мероприятие",
                      quote: "Текст отзыва",
                      source: "Ссылка на источник",
                    },
                    limits = {
                      name: 100,
                      event: 120,
                      quote: 2000,
                      source: 1500,
                    };
                  const props = {
                    id,
                    "data-key": key,
                    value: r[key],
                    maxLength: limits[key],
                    required: key === "name" || key === "quote",
                    onChange: (e) => reviewField(r.key, key, e.target.value),
                  };
                  return (
                    <label className="admin-field" key={key} htmlFor={id}>
                      {labels[key]}
                      {key === "quote" ? (
                        <textarea {...props} rows={4} />
                      ) : (
                        <input
                          {...props}
                          type={key === "source" ? "url" : "text"}
                        />
                      )}
                    </label>
                  );
                })}
                <label className="admin-check">
                  <input
                    type="checkbox"
                    data-key="published"
                    checked={r.published}
                    onChange={(e) =>
                      reviewField(r.key, "published", e.target.checked)
                    }
                  />
                  Показывать отзыв на сайте
                </label>
                <button
                  type="button"
                  className="admin-button secondary"
                  onClick={() => removeReview(r.key)}
                >
                  Убрать отзыв {index + 1}
                </button>
              </fieldset>
            ))}
          </div>
          <button
            ref={addButton}
            id="content-add-review"
            type="button"
            className="admin-button secondary"
            disabled={value.reviews.length >= 12}
            aria-describedby="content-review-count"
            onClick={addReview}
          >
            {value.reviews.length >= 12
              ? "Добавлено 12 отзывов"
              : "Добавить отзыв"}
          </button>
          <div className="admin-actions">
            <button
              id="content-save"
              className="admin-button"
              type="submit"
              disabled={!dirty || conflict}
            >
              Сохранить материалы
            </button>
            <button
              id="content-discard"
              type="button"
              className="admin-button secondary"
              disabled={!dirty || conflict}
              onClick={discard}
            >
              Отменить правки
            </button>
          </div>
        </fieldset>
      </form>
      <p
        id="content-message"
        className="admin-message"
        role="status"
        data-kind={message.kind}
      >
        {message.text}
      </p>
      {loaded && dirty && (
        <button
          id="content-copy"
          type="button"
          className="admin-button secondary"
          onClick={copyDraft}
        >
          Скопировать тексты
        </button>
      )}
      {copy && (
        <label className="admin-field content-copy">
          Скопируйте тексты вручную
          <textarea
            ref={copyArea}
            id="content-copy-fallback"
            readOnly
            value={copy}
            rows={8}
          />
        </label>
      )}
      {loaded && preview && <ContentPreview value={value} />}
    </div>
  );
}
