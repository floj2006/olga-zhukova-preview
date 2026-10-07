"use client";
import { useEffect, useRef, useState } from "react";
import { emptyTerms, termFields } from "../../lib/terms";

const empty = () => ({
  version: 1,
  videoUrl: "",
  videoCaption: "",
  reviews: [],
  terms: emptyTerms(),
});
const payload = (value) => ({
  ...value,
  videoUrl: value.videoUrl.trim(),
  videoCaption: value.videoCaption.trim(),
  terms: {
    published: value.terms.published,
    ...Object.fromEntries(
      termFields.map(([key]) => [key, value.terms[key].trim()]),
    ),
  },
  reviews: value.reviews.map(({ key, ...r }) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        typeof v === "string" ? v.trim() : v,
      ]),
    ),
  ),
});
const editable = (value) => ({
  ...value,
  terms: { ...emptyTerms(), ...value.terms },
  reviews: value.reviews.map((r) => ({ ...r, key: crypto.randomUUID() })),
});
export function draftText(value) {
  return [
    "Видео: " + value.videoUrl,
    value.videoCaption,
    "",
    "Условия · " + (value.terms.published ? "На сайте" : "Черновик"),
    ...termFields.map(([key, label]) => label + ": " + value.terms[key]),
    ...value.reviews.map((r, i) =>
      [
        "",
        `Отзыв ${i + 1} · ${r.published ? "На сайте" : "Черновик"}`,
        r.name,
        r.event,
        r.quote,
        r.source,
      ].join("\n"),
    ),
  ].join("\n");
}

export default function useContentEditor() {
  const host = useRef(null),
    apiRef = useRef(null),
    operation = useRef(0),
    busyRef = useRef(false),
    current = useRef(null),
    baseline = useRef(null);
  const [value, setValue] = useState(empty),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState({ text: "", kind: "" }),
    [conflict, setConflict] = useState(false);
  const report = (text, kind = "") => setMessage({ text, kind });
  const dirty = () =>
    Boolean(
      current.current &&
      baseline.current &&
      JSON.stringify(payload(current.current)) !==
        JSON.stringify(baseline.current),
    );
  const install = (data) => {
    const next = editable(data);
    current.current = next;
    baseline.current = payload(next);
    setValue(next);
    setLoaded(true);
    setConflict(false);
  };
  const update = (fn) => {
    if (busyRef.current || !current.current) return;
    const next = fn(current.current);
    current.current = next;
    setValue(next);
    if (!conflict) report("Есть несохранённые изменения.");
  };
  const start = () => {
    busyRef.current = true;
    setBusy(true);
    return ++operation.current;
  };
  const finish = (id) => {
    if (id === operation.current) {
      busyRef.current = false;
      setBusy(false);
    }
  };
  async function load(force = false) {
    if (busyRef.current || (current.current && !force) || !apiRef.current)
      return;
    if (
      force &&
      dirty() &&
      !confirm("Обновить материалы и отменить несохранённые правки?")
    )
      return;
    const id = start();
    report("Загружаем материалы…");
    try {
      const result = await apiRef.current("/api/admin/content");
      if (id !== operation.current) return;
      install(result);
      report("");
    } catch (e) {
      if (id === operation.current) report(e.message, "error");
    } finally {
      finish(id);
    }
  }
  async function save() {
    if (busyRef.current || !current.current || !dirty() || conflict) return;
    const body = payload(current.current),
      id = start();
    report("Сохраняем…");
    try {
      const result = await apiRef.current("/api/admin/content", {
        method: "PUT",
        body,
      });
      if (id !== operation.current) return;
      install(result);
      report(
        "Материалы сохранены. Видео, опубликованные отзывы и подтверждённые условия доступны на сайте.",
        "success",
      );
    } catch (e) {
      if (id !== operation.current) return;
      if (e.status === 409) {
        setConflict(true);
        report(
          "Материалы изменены в другой вкладке. Скопируйте свои правки, затем загрузите свежую версию.",
          "error",
        );
      } else report(e.message, "error");
    } finally {
      finish(id);
    }
  }
  function reset() {
    operation.current++;
    busyRef.current = false;
    current.current = null;
    baseline.current = null;
    setBusy(false);
    setLoaded(false);
    setConflict(false);
    setValue(empty());
    report("");
  }
  function discard() {
    if (
      busyRef.current ||
      !dirty() ||
      !confirm(
        "Отменить правки и вернуть последнюю загруженную версию материалов?",
      )
    )
      return;
    install(baseline.current);
    report("Правки отменены.");
  }
  const methods = useRef(null);
  methods.current = { load, reset, dirty };
  useEffect(() => {
    const panel = host.current.closest("#panel-content");
    const controller = {
      load(api, force = false) {
        apiRef.current = api;
        return methods.current.load(force);
      },
      dirty: () => methods.current.dirty(),
      reset: () => methods.current.reset(),
    };
    panel.contentEditor = controller;
    panel.dispatchEvent(new Event("olga:content-ready"));
    return () => {
      operation.current++;
      if (panel.contentEditor === controller) delete panel.contentEditor;
    };
  }, []);
  return {
    host,
    value,
    busy,
    loaded,
    message,
    conflict,
    dirty: dirty(),
    update,
    load,
    save,
    discard,
    report,
  };
}
