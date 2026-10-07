export { eventToday as localToday } from "./booking-rules.js";
import { eventToday as localToday } from "./booking-rules.js";
export const formatEventDate = (date) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
export async function getAvailability(month, signal) {
  const response = await fetch(`/api/availability?month=${month}`, {
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      "Не удалось проверить дату. Повторите попытку или свяжитесь с Ольгой.",
    );
  const data = await response.json();
  if (
    data.month !== month ||
    !Array.isArray(data.busyDates) ||
    data.busyDates.some(
      (date) => typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date),
    )
  )
    throw new Error("Не удалось проверить дату. Повторите попытку.");
  return new Set(data.busyDates);
}
export async function verifyEventDate(date) {
  if (!date) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < localToday())
    throw new Error("Выберите сегодняшнюю или будущую дату.");
  const busy = await getAvailability(date.slice(0, 7));
  if (busy.has(date))
    throw new Error(
      "Эта дата уже занята. Выберите другую дату или свяжитесь с Ольгой.",
    );
}
