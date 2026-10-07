"use client";
import { useEffect, useState } from "react";
import { useBooking, metricEvent } from "./BookingProvider";
import {
  getAvailability,
  localToday,
  formatEventDate,
} from "../../public/availability-store";
export default function Calendar() {
  const b = useBooking();
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const [dates, setDates] = useState(new Set());
  const [state, setState] = useState("idle");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (b.open && b.eventDate) setMonth(b.eventDate.slice(0, 7));
  }, [b.open, b.eventDate]);
  useEffect(() => {
    if (!month || !b.open) return;
    const controller = new AbortController();
    setState("loading");
    getAvailability(month, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setDates(result);
          setState("ready");
          metricEvent("olga:calendar-ready", { online: true });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState("error");
          metricEvent("olga:calendar-ready", { online: false });
        }
      });
    return () => controller.abort();
  }, [month, b.open, b.refresh, retry]);
  const today = localToday(),
    start = new Date(`${month || today.slice(0, 7)}-01T12:00:00`);
  const count = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  const chosen = b.eventDate,
    ready = state === "ready",
    busy = dates.has(chosen);
  const shift = (n) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div id="hero-calendar" data-state={state}>
      <div className="calendar-navigation">
        <button
          type="button"
          id="calendar-prev"
          disabled={month <= today.slice(0, 7)}
          aria-label="Предыдущий месяц"
          onClick={() => shift(-1)}
        >
          ←
        </button>
        <h3 id="calendar-month" aria-live="polite">
          {month
            ? new Intl.DateTimeFormat("ru-RU", {
                month: "long",
                year: "numeric",
              }).format(start)
            : "Календарь"}
        </h3>
        <button
          type="button"
          id="calendar-next"
          disabled={month >= "2099-12"}
          aria-label="Следующий месяц"
          onClick={() => shift(1)}
        >
          →
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className="calendar-days"
        id="calendar-days"
        role="group"
        aria-labelledby="calendar-month"
        aria-busy={state === "loading"}
        key={month}
        onKeyDown={(e) => {
          const offset = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -7,
            ArrowDown: 7,
          }[e.key];
          if (!offset) return;
          e.preventDefault();
          const list = [...e.currentTarget.querySelectorAll("button")],
            next = list[list.indexOf(e.target) + offset];
          if (next && !next.disabled) next.focus();
        }}
      >
        {Array.from({ length: (start.getDay() + 6) % 7 }, (_, i) => (
          <span key={`space-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`,
            past = date < today,
            isBusy = dates.has(date);
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              data-busy={String(isBusy)}
              data-past={String(past)}
              disabled={!ready || past}
              aria-label={`${formatEventDate(date)}, ${past ? "прошедшая дата" : isBusy ? "занято" : "свободно"}`}
              aria-pressed={chosen === date}
              aria-current={date === today ? "date" : undefined}
              onClick={() => b.change({ eventDate: date })}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i />
          Свободно
        </span>
        <span>
          <i className="busy" />
          Занято
        </span>
      </div>
      <div className="calendar-feedback">
        <p id="calendar-status" role="status">
          {state === "loading"
            ? "Проверяем даты…"
            : state === "error"
              ? "Не удалось проверить даты. Повторите попытку или позвоните Ольге."
              : chosen && chosen.startsWith(month)
                ? busy
                  ? "Эта дата уже занята. Выберите другую или свяжитесь с Ольгой."
                  : `${formatEventDate(chosen)} — дата свободна.`
                : "Выберите дату. Если ещё не определились, её можно уточнить позже."}
        </p>
        <button
          type="button"
          id="calendar-retry"
          className="builder-contact"
          hidden={state !== "error"}
          onClick={() => setRetry((n) => n + 1)}
        >
          Повторить проверку
        </button>
        <button
          type="button"
          id="calendar-services"
          hidden={!chosen || !ready || busy || !chosen.startsWith(month)}
          onClick={() => b.stepTo("services")}
        >
          Выбрать услуги →
        </button>
      </div>
    </div>
  );
}
