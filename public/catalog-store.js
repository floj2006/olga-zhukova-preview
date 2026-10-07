let pending;
export function loadCatalog(force = false) {
  if (force) pending = null;
  return (pending ||= fetch("/api/catalog", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Catalog unavailable");
      return { catalog: await response.json(), online: true };
    })
    .catch(async () => {
      const response = await fetch("/catalog.json", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok)
        throw new Error(
          "Не удалось загрузить услуги. Позвоните Ольге: 8 911 444-90-71.",
        );
      return { catalog: await response.json(), online: false };
    }));
}
export const money = (value) => new Intl.NumberFormat("ru-RU").format(value);
export function estimate(catalog, selections, extraMeetings = 0) {
  const lines = [];
  for (const service of catalog.services) {
    const quantity = selections[service.id];
    if (!service.active || !quantity || service.id === "consultation") continue;
    lines.push({
      id: service.id,
      title: service.title,
      quantity,
      unit: service.unit,
      unitPrice: service.price,
      total: service.price * quantity,
      from: !!service.from,
    });
  }
  const consultation = catalog.services.find(
    (s) => s.id === "consultation" && s.active,
  );
  if (consultation && extraMeetings > 0)
    lines.push({
      id: consultation.id,
      title: "Дополнительные консультации",
      quantity: extraMeetings,
      unit: "meeting",
      unitPrice: consultation.price,
      total: consultation.price * extraMeetings,
      from: !!consultation.from,
    });
  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.total, 0),
    from: lines.some((line) => line.from),
    version: catalog.version,
  };
}
