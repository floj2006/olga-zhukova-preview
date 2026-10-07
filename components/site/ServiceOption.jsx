"use client";
import { useEffect, useState } from "react";
import { maximumQuantity } from "../../public/booking-rules";
const money = new Intl.NumberFormat("ru-RU");

export default function ServiceOption({ service, count, compact, onChange }) {
  const initial = count || (service.unit === "hour" ? 4 : 1);
  const [draft, setDraft] = useState(String(initial));
  const maximum = maximumQuantity(service.unit);
  useEffect(() => {
    setDraft(String(count || (service.unit === "hour" ? 4 : 1)));
  }, [count, service.unit]);
  const update = (quantity) => onChange(service.id, quantity);
  const prefix = service.from ? "от " : "";
  return (
    <div
      className={compact ? "hero-service-option" : "service-option"}
      data-service-id={service.id}
      data-selected={String(!!count)}
    >
      <label className="service-choice">
        <input
          type="checkbox"
          value={service.id}
          checked={!!count}
          aria-label={service.title}
          onChange={(event) => update(event.target.checked ? initial : 0)}
        />
        <span className="service-description">
          <strong>{service.title}</strong>
          <small>{service.description}</small>
        </span>
      </label>
      <div className="service-actions">
        <span className="service-rate">
          {prefix}
          {money.format(service.price)} ₽
          {service.unit === "hour"
            ? " / час"
            : service.unit === "meeting"
              ? " / встреча"
              : ""}
        </span>
        <div className="service-quantity">
          <button
            type="button"
            disabled={!count || count <= 1}
            aria-label={`${service.title}: уменьшить количество`}
            onClick={() => update(count - 1)}
          >
            −
          </button>
          <input
            type="number"
            min="1"
            max={maximum}
            step="1"
            value={draft}
            disabled={!count}
            aria-label={`${service.title}: ${service.unit === "hour" ? "количество часов" : "количество"}`}
            onChange={(event) => {
              const input = event.currentTarget;
              setDraft(input.value);
              if (input.value && input.validity.valid)
                update(Number(input.value));
            }}
            onBlur={() => setDraft(String(initial))}
          />
          <span className="quantity-unit">
            {service.unit === "hour"
              ? "ч"
              : service.unit === "meeting"
                ? "встр."
                : "шт."}
          </span>
          <button
            type="button"
            disabled={!count || count >= maximum}
            aria-label={`${service.title}: увеличить количество`}
            onClick={() => update(count + 1)}
          >
            +
          </button>
        </div>
        <span className="service-line-total">
          {count ? `${prefix}${money.format(service.price * count)} ₽` : ""}
        </span>
      </div>
    </div>
  );
}
