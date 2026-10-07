"use client";
import { useState } from "react";
import { useBooking } from "../booking/BookingProvider";
import ServiceOption from "./ServiceOption";
export default function ServicePicker({ compact = false, children }) {
  const b = useBooking(),
    [category, setCategory] = useState(null);
  const services =
    b.catalog?.services.filter((s) => s.active && s.id !== "consultation") ||
    [];
  const categories = [...new Set(services.map((s) => s.category))];
  const active =
    category === "all" || categories.includes(category)
      ? category
      : categories[0] || "all";
  const option = (s) => (
    <ServiceOption
      key={s.id}
      service={s}
      count={b.selected[s.id] || 0}
      compact={compact}
      onChange={b.select}
    />
  );
  return (
    <div data-service-picker={compact ? "compact" : "main"}>
      <div
        id={compact ? "hero-service-filters" : "service-filters"}
        className="service-filters"
        role="group"
        aria-label="Категории услуг"
      >
        {categories.length > 0 &&
          [...categories, "all"].map((c) => (
            <button
              type="button"
              key={c}
              className="service-filter"
              aria-pressed={active === c}
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "Все услуги" : c}
            </button>
          ))}
      </div>
      {children}
      <div
        id={compact ? "hero-service-options" : "service-options"}
        className={compact ? "hero-service-options" : "service-options"}
        data-category={active}
      >
        {b.error ? (
          <p className="booking-loading">{b.error}</p>
        ) : !b.catalog ? (
          <p className="booking-loading">Загружаем услуги…</p>
        ) : (
          categories
            .filter((c) => active === "all" || active === c)
            .map((c) => (
              <div key={c} className="service-group">
                {!compact && <h4 className="service-category">{c}</h4>}
                {services.filter((s) => s.category === c).map(option)}
              </div>
            ))
        )}
      </div>
    </div>
  );
}
