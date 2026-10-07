// Event dates follow Vologda time, independently of the visitor's time zone.
export function eventToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function validPhone(value) {
  return /^[+\d\s()-]+$/.test(value) && /^\d{10,15}$/.test(value.replace(/\D/g, ""));
}

export const maximumQuantity = (unit) => ({ hour: 24, meeting: 20, item: 10 })[unit] ?? 10;
