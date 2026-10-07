"use client";
import { useBooking } from "../booking/BookingProvider";
const money = new Intl.NumberFormat("ru-RU");
const units = { hour: "ч.", item: "шт.", meeting: "встр." };

export default function QuoteLines({ compact = false }) {
  const b = useBooking();
  const snapshot = {
    lines: b.quote.lines,
    onRemove: (id) => {
      b.remove(id);
      document.querySelector("#open-request")?.focus({ preventScroll: true });
    },
  };

  return (
    <dl
      id={compact ? "request-summary" : "result-summary"}
      className={compact ? undefined : "builder-summary"}
    >
      {snapshot.lines.map((line) => (
        <div key={line.id}>
          <dt>
            {line.title}
            <small>
              {!compact && `${money.format(line.unitPrice)} ₽ × `}
              {line.quantity} {units[line.unit]}
            </small>
          </dt>
          <dd>
            {line.from ? "от " : ""}
            {money.format(line.total)} ₽
            {!compact && (
              <button
                type="button"
                className="remove-service"
                aria-label={`Убрать из расчёта: ${line.title}`}
                onClick={() => snapshot.onRemove(line.id)}
              >
                ×
              </button>
            )}
          </dd>
        </div>
      ))}
      {!compact && !snapshot.lines.length && (
        <div className="summary-empty">
          <dt>
            Выберите услуги или оставьте заявку на первую бесплатную
            консультацию.
          </dt>
          <dd></dd>
        </div>
      )}
    </dl>
  );
}
