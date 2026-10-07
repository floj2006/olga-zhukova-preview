"use client";
import { useBooking } from "../booking/BookingProvider";
import { formatEventDate } from "../../public/availability-store";
export default function AvailabilityInvite() {
  const b = useBooking();
  return (
    <section
      className="availability-invite section"
      id="availability"
      aria-labelledby="availability-title"
    >
      <div className="container availability-invite-grid">
        <p className="eyebrow">ДАТА ВАШЕГО СОБЫТИЯ</p>
        <div>
          <h2 id="availability-title">
            Есть повод.
            <br />
            <em>Осталось выбрать день.</em>
          </h2>
          <p>
            В календаре видны свободные и занятые даты. Выбор дня и отправка
            заявки не бронируют его автоматически — условия подтвердим лично.
          </p>
        </div>
        <div className="availability-invite-action">
          <span className="availability-date">
            {b.eventDate ? formatEventDate(b.eventDate) : "Когда встречаемся?"}
          </span>
          <button className="button" type="button" data-check-date="">
            Проверить дату <span aria-hidden="true">↗</span>
          </button>
          <span>Выбранные услуги сохранятся в расчёте.</span>
        </div>
      </div>
    </section>
  );
}
