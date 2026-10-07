const formats = { wedding: "Свадьба", corporate: "Корпоратив", anniversary: "Юбилей", graduation: "Выпускной", other: "Другое событие" };
export function matchesLead(lead, query = "", status = "") {
  if (status && lead.status !== status) return false;
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const text = [lead.name, lead.phone, lead.eventType, formats[lead.eventType], lead.eventDate, lead.comment, lead.note].join(" ").toLowerCase();
  const digits = term.replace(/\D/g, "");
  return text.includes(term) || (/^[+\d\s()-]+$/.test(term) && digits.length > 0 && (lead.phone || "").replace(/\D/g, "").includes(digits));
}
