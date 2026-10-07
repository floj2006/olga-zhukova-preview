import { eventToday } from "../booking-rules.js";

const dateLabel = date => new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow",
}).format(new Date(`${date}T12:00:00Z`));

export function calendarList(entries, period, query, today = eventToday()) {
  const term = query.trim().toLocaleLowerCase("ru-RU");
  return entries.filter(entry => {
    if (period === "upcoming" && entry.date < today) return false;
    if (period === "past" && entry.date >= today) return false;
    const numeric = entry.date.split("-").reverse().join(".");
    return `${entry.date} ${numeric} ${dateLabel(entry.date)} ${entry.note || ""}`
      .toLocaleLowerCase("ru-RU").includes(term);
  }).sort((a, b) => period === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
}

export function nextBusyDate(entries, today = eventToday()) {
  return entries.filter(entry => entry.date >= today).map(entry => entry.date).sort()[0] || "";
}
