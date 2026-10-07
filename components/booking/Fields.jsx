"use client";
import { useBooking, eventTypes } from "./BookingProvider";
import { useState, useEffect } from "react";
import { localToday } from "../../public/availability-store";
export function EventFields({ compact = false }) {
  const b = useBooking();
  return (
    <div className={compact ? "hero-event-label" : "event-fields"}>
      <label>
        Ваш повод
        <select
          id={compact ? "hero-event-type" : undefined}
          name={compact ? undefined : "eventType"}
          value={b.eventType}
          onChange={(e) => b.change({ eventType: e.target.value })}
        >
          {Object.entries(eventTypes).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!compact && (
        <label>
          Дата, если уже известна
          <input
            type="date"
            name="eventDate"
            min={localToday()}
            value={b.eventDate}
            onChange={(e) => b.change({ eventDate: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
export function Meetings({ compact = false }) {
  const b = useBooking(),
    service = b.catalog?.services.find(
      (s) => s.id === "consultation" && s.active,
    );
  const [draft, setDraft] = useState(String(b.extraMeetings));
  useEffect(() => setDraft(String(b.extraMeetings)), [b.extraMeetings]);
  return (
    <label
      className={compact ? "hero-meetings" : "extra-meetings"}
      id={compact ? "hero-meetings-row" : "extra-meetings-row"}
      hidden={!service}
    >
      Дополнительные встречи{" "}
      <span id={compact ? "hero-meetings-rate" : "meeting-price"}>
        {service
          ? new Intl.NumberFormat("ru-RU").format(service.price) +
            " ₽ / встреча"
          : ""}
      </span>
      <input
        id={compact ? "hero-extra-meetings" : "extra-meetings"}
        type="number"
        min="0"
        max="20"
        step="1"
        value={draft}
        aria-label={
          compact
            ? "Дополнительные встречи в быстром расчёте"
            : "Количество дополнительных консультаций"
        }
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value && e.target.validity.valid)
            b.change({ extraMeetings: Number(e.target.value) });
        }}
        onBlur={() => setDraft(String(b.extraMeetings))}
      />
    </label>
  );
}
export function Retry({ compact = false }) {
  const b = useBooking();
  return (
    <>
      <p
        className="estimate-note"
        id={compact ? undefined : "connection-note"}
        hidden={b.online || b.loading}
      >
        Онлайн-заявка сейчас недоступна. Позвоните Ольге:{" "}
        <a href="tel:+79114449071">8 911 444-90-71</a>.
      </p>
      <button
        className="builder-contact"
        type="button"
        data-retry-catalog=""
        hidden={b.online}
        disabled={b.loading}
        aria-busy={b.loading}
        onClick={b.retry}
      >
        Повторить загрузку услуг ↻
      </button>
    </>
  );
}
