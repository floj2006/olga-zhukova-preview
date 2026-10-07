"use client";
import { useEffect, useRef } from "react";
import { useBooking } from "../booking/BookingProvider";
import Calendar from "../booking/Calendar";
import RequestForm from "../booking/RequestForm";
import { EventFields, Meetings, Retry } from "../booking/Fields";
import ServicePicker from "./ServicePicker";
import { formatEventDate } from "../../public/availability-store";
export default function BookingDialog() {
  const b = useBooking(),
    dialog = useRef(null);
  useEffect(() => {
    const d = dialog.current;
    if (b.open && !d.open) d.showModal();
    if (!b.open && d.open) {
      d.close();
      b.opener.current?.focus({ preventScroll: true });
    }
    document.body.classList.toggle("dialog-open", b.open);
    return () => {
      document.body.classList.remove("dialog-open");
    };
  }, [b.open]);
  useEffect(() => {
    if (b.open) dialog.current.scrollTop = 0;
    if (b.open && b.step !== "contact")
      document
        .getElementById(`booking-${b.step}-tab`)
        ?.focus({ preventScroll: true });
  }, [b.step, b.open]);
  const tabs = ["date", "services", "contact"];
  return (
    <dialog
      ref={dialog}
      id="booking-dialog"
      className="booking-dialog booking-flow"
      aria-labelledby="hero-booking-title"
      onCancel={(e) => {
        e.preventDefault();
        if (b.sending) return;
        if (b.step === "contact" && !b.success) b.stepTo("services");
        else b.close();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          b.close();
      }}
    >
      <div
        id="hero-booking"
        className="hero-booking"
        data-catalog-state={
          b.loading
            ? "loading"
            : b.online
              ? "ready"
              : b.error
                ? "error"
                : "offline"
        }
      >
        <div className="booking-flow-header">
          <header className="hero-booking-heading">
            <div>
              <p className="eyebrow">ВАШЕ СОБЫТИЕ · ВАШ ВЫБОР</p>
              <h2 id="hero-booking-title">
                Ваше <em>событие.</em>
              </h2>
            </div>
            <button
              id="booking-close"
              className="booking-close"
              type="button"
              aria-label="Закрыть бронирование"
              disabled={b.sending}
              onClick={b.close}
            >
              ×
            </button>
          </header>
          <div
            className="booking-tabs"
            role="tablist"
            aria-label="Планирование мероприятия"
            data-active={b.step}
          >
            {tabs.map((tab, i) => (
              <button
                key={tab}
                id={`booking-${tab}-tab`}
                type="button"
                role="tab"
                aria-selected={b.step === tab}
                aria-controls={
                  tab === "contact" ? "request-dialog" : `booking-${tab}-panel`
                }
                tabIndex={b.step === tab ? 0 : -1}
                disabled={
                  b.sending || (tab === "contact" && (!b.online || b.checking))
                }
                onClick={() =>
                  tab === "contact" ? b.contacts() : b.stepTo(tab)
                }
                onKeyDown={(e) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? 2
                        : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                  next === 2 ? b.contacts() : b.stepTo(tabs[next]);
                }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>{" "}
                {["Дата", "Услуги", "Контакты"][i]}
                {tab === "services" && (
                  <span id="hero-services-count">
                    {b.quote.lines.length || ""}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="booking-content">
          <div
            id="booking-date-panel"
            role="tabpanel"
            aria-labelledby="booking-date-tab"
            hidden={b.step !== "date"}
          >
            <Calendar />
          </div>
          <div
            id="booking-services-panel"
            role="tabpanel"
            aria-labelledby="booking-services-tab"
            hidden={b.step !== "services"}
          >
            <EventFields compact />
            <ServicePicker compact />
            <Meetings compact />
          </div>
          <RequestForm />
        </div>
        <footer className="hero-booking-footer" hidden={b.step === "contact"}>
          <div className="hero-chosen-date">
            <button
              id="hero-date-label"
              type="button"
              onClick={() => b.stepTo("date")}
            >
              {b.eventDate
                ? formatEventDate(b.eventDate)
                : "Дату можно выбрать позже"}
            </button>
            <button
              id="hero-clear-date"
              type="button"
              hidden={!b.eventDate}
              aria-label="Убрать выбранную дату"
              onClick={() => b.change({ eventDate: "" })}
            >
              ×
            </button>
          </div>
          <div className="hero-total" aria-live="polite" aria-atomic="true">
            <span id="hero-price-label">
              {b.quote.lines.length
                ? "Предварительный расчёт"
                : "Первая консультация"}
            </span>
            <strong id="hero-price">
              {b.quote.lines.length
                ? `${b.quote.from ? "от " : ""}${new Intl.NumberFormat("ru-RU").format(b.quote.total)} ₽`
                : "Бесплатно"}
            </strong>
          </div>
          <button
            id="hero-request"
            type="button"
            className="button"
            disabled={!b.online || b.checking || b.loading}
            onClick={() =>
              b.step === "date" ? b.stepTo("services") : b.contacts()
            }
          >
            {b.step === "date"
              ? b.eventDate
                ? "ВЫБРАТЬ УСЛУГИ →"
                : "ДАТУ ВЫБЕРЕМ ПОЗЖЕ →"
              : b.quote.lines.length
                ? "ПЕРЕЙТИ К ЗАЯВКЕ →"
                : "БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ →"}
          </button>
          <p
            id="hero-booking-feedback"
            className="booking-feedback"
            role="status"
          >
            {b.feedback ||
              (!b.online && !b.loading
                ? "Онлайн-заявка недоступна. Повторите загрузку услуг или позвоните Ольге."
                : "")}
          </p>
          <Retry compact />
          <p className="hero-booking-note">
            Без оплаты на сайте. Дату и детали подтвердим лично.
          </p>
        </footer>
      </div>
    </dialog>
  );
}
