// Use the saved quote, not today's catalogue prices. Exclude private lead fields.
export function quoteText(quote) {
  const money = new Intl.NumberFormat("ru-RU");
  const units = { hour: "ч", item: "шт.", meeting: "встреч" };
  const lines = (quote?.lines || []).map(line =>
    `${line.title} — ${line.quantity} ${units[line.unit] || ""} × ${money.format(line.unitPrice)} ₽ = ${line.from ? "от " : ""}${money.format(line.total)} ₽`,
  );
  return [
    "Ольга Жукова · Предварительный расчёт",
    "",
    ...(lines.length ? lines : ["Услуги пока не выбраны."]),
    "",
    ...(lines.length ? [`Итого: ${quote.from ? "от " : ""}${money.format(quote.total)} ₽`] : []),
    "Точная стоимость и доступность даты подтверждаются при обсуждении мероприятия.",
  ].join("\n");
}

export function addQuoteCopy(container, quote) {
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "admin-button secondary";
  copy.textContent = "Скопировать расчёт";
  const feedback = document.createElement("p");
  feedback.className = "admin-muted";
  feedback.setAttribute("role", "status");
  let manual;
  copy.addEventListener("click", async () => {
    copy.disabled = true;
    const text = quoteText(quote);
    try {
      await navigator.clipboard.writeText(text);
      manual?.remove();
      manual = null;
      feedback.textContent = "Расчёт скопирован. Можно вставить его в сообщение клиенту.";
    } catch {
      if (!manual) {
        manual = document.createElement("label");
        manual.className = "admin-field";
        manual.append("Расчёт для копирования");
        const area = document.createElement("textarea");
        area.readOnly = true;
        area.rows = 7;
        manual.append(area);
        container.append(manual);
      }
      const area = manual.querySelector("textarea");
      area.value = text;
      area.focus();
      area.select();
      feedback.textContent = "Автоматическое копирование недоступно. Скопируйте выделенный текст вручную.";
    } finally {
      copy.disabled = false;
    }
  });
  container.append(copy, feedback);
}
