"use client";
import { useEffect, useRef } from "react";
import { useBooking, eventTypes } from "./BookingProvider";
import { validPhone } from "../../public/booking-rules";
import { formatEventDate } from "../../public/availability-store";
import QuoteLines from "../site/QuoteLines";
export default function RequestForm() {
  const b = useBooking(),
    form = useRef(null),
    success = useRef(null),
    status = useRef(null);
  useEffect(() => {
    if (b.step === "contact" && b.open) {
      if (b.success) success.current?.focus();
      else form.current?.elements.name.focus({ preventScroll: true });
    }
  }, [b.step, b.open, b.success]);
  useEffect(() => {
    if (b.status && !b.success && b.open)
      status.current?.scrollIntoView({ block: "nearest" });
  }, [b.status, b.success, b.open]);
  const field = (key) => ({
    disabled: b.sending,
    value: b[key],
    onChange: (e) => b.patch({ [key]: e.target.value }),
  });
  return (
    <section
      id="request-dialog"
      hidden={b.step !== "contact"}
      role="tabpanel"
      aria-labelledby="booking-contact-tab"
    >
      <form
        ref={form}
        id="request-form"
        className="service-builder request-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          b.submit(e.currentTarget);
        }}
      >
        <div className="request-fields" hidden={b.success}>
          <h3 id="request-title">
            Как с вами <em>связаться?</em>
          </h3>
          <section className="request-quote" aria-label="Состав вашей заявки">
            <p id="request-date" className="request-date">
              {eventTypes[b.eventType]} ·{" "}
              {b.eventDate ? formatEventDate(b.eventDate) : "Дату обсудим"}
            </p>
            <details className="request-quote-details">
              <summary>
                Состав расчёта
                {b.quote.lines.length ? ` · ${b.quote.lines.length}` : ""}
              </summary>
              <QuoteLines compact />
            </details>
            <div className="request-quote-total">
              <span id="request-quote-label">
                {b.quote.lines.length
                  ? "Предварительная стоимость"
                  : "Первая консультация"}
              </span>
              <strong id="request-total">
                {b.quote.lines.length
                  ? `${b.quote.from ? "от " : ""}${new Intl.NumberFormat("ru-RU").format(b.quote.total)} ₽`
                  : "Бесплатно"}
              </strong>
            </div>
            <p id="request-quote-note">
              {b.quote.lines.length
                ? "Расчёт передадим Ольге вместе с контактами. Дату и итоговые условия подтвердим лично."
                : "Услуги пока не выбраны. На первой бесплатной встрече обсудим задачи и подберём программу."}
            </p>
            <button
              className="builder-contact"
              type="button"
              id="request-edit"
              disabled={b.sending}
              onClick={() => b.stepTo("services")}
            >
              Изменить услуги или дату ↗
            </button>
          </section>
          <label>
            Как к вам обращаться
            <input
              name="name"
              autoComplete="name"
              minLength="2"
              maxLength="100"
              required
              placeholder="Ваше имя"
              {...field("name")}
            />
          </label>
          <label>
            Телефон
            <input
              disabled={b.sending}
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength="30"
              required
              placeholder="+7 ___ ___-__-__"
              value={b.phone}
              onChange={(e) => {
                e.target.setCustomValidity(
                  validPhone(e.target.value.trim())
                    ? ""
                    : "Введите телефон: от 10 до 15 цифр.",
                );
                b.patch({ phone: e.target.value });
              }}
            />
          </label>
          <label>
            Пожелания <span className="optional">необязательно</span>
            <textarea
              name="comment"
              rows="2"
              maxLength="2000"
              placeholder="Место, гости, идеи для программы"
              {...field("comment")}
            />
          </label>
          <label className="request-honeypot" aria-hidden="true">
            Ваш сайт
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              {...field("website")}
            />
          </label>
          <label className="consent">
            <input
              disabled={b.sending}
              name="consent"
              type="checkbox"
              required
              checked={b.consent}
              onChange={(e) => b.patch({ consent: e.target.checked })}
            />
            <span>
              Согласен на обработку имени и телефона для ответа на заявку.{" "}
              <a href="/privacy" target="_blank" rel="noopener">
                Условия обработки данных
              </a>
            </span>
          </label>
          <button
            className="button"
            id="send-request"
            type="submit"
            disabled={!b.online || b.sending}
          >
            {b.sending ? "ОТПРАВЛЯЕМ…" : "ОТПРАВИТЬ ЗАЯВКУ"}
          </button>
          <button
            id="request-close"
            type="button"
            className="builder-contact"
            disabled={b.sending}
            onClick={() => b.stepTo("services")}
          >
            ← Вернуться к услугам
          </button>
        </div>
        <section
          className="request-success"
          id="request-success"
          hidden={!b.success}
          aria-labelledby="request-success-title"
        >
          <h3 ref={success} id="request-success-title" tabIndex={-1}>
            Спасибо, заявка получена.
          </h3>
          <p>
            Дата пока не забронирована. Ольга свяжется с вами, чтобы обсудить
            программу и подтвердить условия.
          </p>
          <button
            type="button"
            className="button"
            id="request-done"
            onClick={b.close}
          >
            ВЕРНУТЬСЯ НА САЙТ
          </button>
        </section>
        <p
          ref={status}
          id="request-status"
          role="status"
          aria-live="polite"
          data-success={String(b.success)}
        >
          {b.status}
        </p>
      </form>
    </section>
  );
}
