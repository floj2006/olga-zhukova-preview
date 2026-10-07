"use client";
import { useEffect, useRef, useState } from "react";
const labels = {
  configured: "Настроено",
  blocked: "Требует настройки",
  optional: "Не включено",
};
export default function LaunchStatus() {
  const host = useRef(null),
    api = useRef(null),
    operation = useRef(0),
    methods = useRef(null),
    active = useRef(false);
  const [value, setValue] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cloud, setCloud] = useState(null);
  function reset() {
    operation.current++;
    active.current = false;
    api.current = null;
    setValue(null);
    setCloud(null);
    setError("");
    setBusy(false);
    if (host.current) host.current.open = false;
  }
  async function request(path, isCloud = false) {
    if (!api.current || active.current) return;
    const seq = ++operation.current;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.current(path);
      if (seq !== operation.current) return;
      if (isCloud) setCloud(result);
      else {
        setValue(result);
        setCloud(null);
      }
    } catch (e) {
      if (seq === operation.current) setError(e.message);
    } finally {
      if (seq === operation.current) {
        active.current = false;
        setBusy(false);
      }
    }
  }
  methods.current = {
    reset,
    load(adapter) {
      api.current = adapter;
      return request("/api/admin/launch-status");
    },
  };
  useEffect(() => {
    const node = host.current;
    const controller = {
      load: (adapter) => methods.current.load(adapter),
      reset: () => methods.current.reset(),
    };
    node.launchStatus = controller;
    node.dispatchEvent(new Event("olga:launch-ready"));
    return () => {
      operation.current++;
      if (node.launchStatus === controller) delete node.launchStatus;
    };
  }, []);
  return (
    <details ref={host} id="launch-status" className="launch-status">
      <summary>
        Подготовка к запуску{" "}
        <span>
          {value
            ? `Пунктов для настройки: ${value.checks.filter((c) => c.status === "blocked").length}`
            : busy
              ? "Проверяем…"
              : "Проверка настроек"}
        </span>
      </summary>
      <div className="launch-status-body">
        <p className="admin-muted">
          {value?.mode === "local" ? "Сейчас сайт работает локально. " : ""}
          Настройки не подтверждают публичный запуск. Проверка ниже читает
          настройки облака и не отправляет заявки или сообщения ВК.
        </p>
        {value && (
          <dl className="launch-status-list">
            {value.checks.map((check) => (
              <div key={check.id} data-check={check.id}>
                <dt>
                  {check.title}
                  <span data-status={check.status}>{labels[check.status]}</span>
                </dt>
                <dd>{check.detail}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="admin-actions">
          <button
            className="admin-button secondary"
            type="button"
            disabled={busy}
            onClick={() => request("/api/admin/launch-status")}
          >
            Обновить настройки
          </button>
          <button
            id="launch-cloud-check"
            className="admin-button"
            type="button"
            disabled={busy || !value?.cloudConfigured}
            onClick={() => request("/api/admin/cloud-check", true)}
          >
            Проверить облачное подключение
          </button>
        </div>
        <p className="admin-message" role="status">
          {busy ? "Проверяем…" : error}
        </p>
        {cloud && (
          <section
            aria-label="Результат проверки облака"
            className="launch-cloud-result"
          >
            <p role="status">
              {cloud.results.every((item) => item.ok)
                ? "Проверки чтения пройдены. Запись и доступ публичного клиента нужно проверить перед запуском."
                : "Подключение требует внимания. Исправьте отмеченные пункты и повторите проверку."}
            </p>
            <ul>
              {cloud.results.map((item, i) => (
                <li key={i}>
                  {item.ok ? "Проверено: " : "Не готово: "}
                  {item.label}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="admin-muted">
          Для публикации также нужны реальные фотографии, видео и отзывы,
          подтверждённые условия выезда, предоплаты и отмены.
        </p>
      </div>
    </details>
  );
}
