"use client";
import { useBooking } from "../booking/BookingProvider";
import { EventFields, Meetings, Retry } from "../booking/Fields";
import ServicePicker from "./ServicePicker";
import QuoteLines from "./QuoteLines";
export default function Calculator() {
  const b = useBooking(),
    q = b.quote;
  return (
    <section
      className="calculator section"
      id="calculator"
      aria-labelledby="calculator-title"
    >
      <div className="container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              <span className="short-line" />
              УСЛУГИ И СТОИМОСТЬ
            </p>
            <h2 id="calculator-title">
              Ваш вечер.
              <br />
              <em>Ваш состав.</em>
            </h2>
          </div>
          <p className="section-aside">
            Выберите услуги и продолжительность.
            <br />
            Сумма обновится сразу.
          </p>
        </div>
        <form
          id="event-builder"
          className="service-builder"
          noValidate
          aria-labelledby="calculator-title"
          onSubmit={(e) => {
            e.preventDefault();
            b.contacts(document.activeElement);
          }}
        >
          <div className="service-main" id="booking">
            <EventFields />
            <fieldset className="service-fieldset">
              <legend>Выберите услуги</legend>
              <p className="builder-intro">
                Ведущая и DJ — по часам. Стандартная аппаратура входит в
                стоимость DJ. В расчёте предлагаются 4 часа — их можно изменить.
              </p>
              <p
                id="builder-loading"
                role="status"
                hidden={!b.loading && !b.error}
              >
                {b.error || "Загружаем услуги…"}
              </p>
              <ServicePicker>
                <button
                  type="button"
                  className="reset-services"
                  id="reset-services"
                  hidden={!q.lines.length}
                  onClick={() => b.change({ selected: {}, extraMeetings: 0 })}
                >
                  Убрать все услуги ×
                </button>
              </ServicePicker>
            </fieldset>
            <div className="consultation-block">
              <h3>
                Первая встреча — <em>бесплатно.</em>
              </h3>
              <p>
                Обсудим гостей, программу и задачи. Дополнительные встречи можно
                включить в расчёт.
              </p>
              <Meetings />
            </div>
          </div>
          <aside
            className={`estimate-panel ${q.lines.length ? "" : "price-empty"}`}
            aria-labelledby="estimate-title"
          >
            <div className="estimate-heading">
              <p className="eyebrow">ВАШ ВЫБОР</p>
              <h3 id="estimate-title">Ваш расчёт</h3>
            </div>
            <p id="selected-count" className="selected-count">
              {q.lines.length
                ? `${q.lines.length} ${q.lines.length === 1 ? "услуга" : q.lines.length < 5 ? "услуги" : "услуг"} в расчёте`
                : "Выберите услуги или начните с бесплатной встречи"}
            </p>
            <p className="price-label">Предварительная стоимость</p>
            <p className="builder-price metallic">
              <span id="price-prefix">{q.from ? "от " : ""}</span>
              <span id="result-price">
                {q.lines.length
                  ? new Intl.NumberFormat("ru-RU").format(q.total)
                  : "—"}
              </span>
              <span id="price-unit"> ₽</span>
            </p>
            <details className="estimate-details" id="estimate-details">
              <summary>
                Состав расчёта <span aria-hidden="true">+</span>
              </summary>
              <QuoteLines />
            </details>
            <p id="estimate-note" className="estimate-note">
              {q.from
                ? "В сумму входят услуги с ценой «от». Точную стоимость согласуем после обсуждения оборудования и задач."
                : "Дату, продолжительность и условия подтвердим при разговоре."}
            </p>
            <div className="estimate-actions">
              <p
                id="booking-feedback"
                className="booking-feedback"
                role="status"
              >
                {b.feedback}
              </p>
              <button
                className="button"
                id="open-request"
                type="submit"
                disabled={!b.online || b.loading || b.checking || b.sending}
              >
                {q.lines.length
                  ? "ПЕРЕЙТИ К ЗАЯВКЕ →"
                  : "БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ →"}
              </button>
              <span className="request-reassurance">
                Без оплаты и обязательств
              </span>
              <button
                className="builder-contact"
                type="button"
                data-check-date=""
              >
                Проверить дату ↗
              </button>
              <Retry />
              <p
                id="catalog-retry-status"
                className="estimate-note"
                role="status"
              >
                {b.retryFeedback}
              </p>
              <button
                className="builder-contact"
                id="exact-quote"
                type="button"
                onClick={() =>
                  document.dispatchEvent(new Event("olga:phone-details"))
                }
              >
                Обсудить по телефону ↗
              </button>
            </div>
          </aside>
        </form>
        <noscript>
          <p className="no-script">
            Для выбора услуг включите JavaScript. Ведущая — 8 000 ₽/час, DJ со
            стандартной аппаратурой — 3 000 ₽/час. Первая консультация
            бесплатно: <a href="tel:+79114449071">8 911 444-90-71</a>.
          </p>
        </noscript>
      </div>
    </section>
  );
}
