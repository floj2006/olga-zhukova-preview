import { openBooking } from "./booking-dialog.js";
import { loadCatalog, estimate, money } from "./catalog-store.js";
import { maximumQuantity, validPhone } from "./booking-rules.js";
import {
  verifyEventDate,
  formatEventDate,
  localToday,
} from "./availability-store.js";

const form = document.querySelector("#event-builder");
const status = document.querySelector("#request-status");
const send = document.querySelector("#send-request");
let catalog;
let online = false;
let busy = false;
let selected = {};
let extraMeetings = 0;
let requestId = crypto.randomUUID();
let quote;
let opening = false,
  requestOpener;
const units = { hour: "час", item: "услуга", meeting: "встреча" };
const storageKey = "olga-service-builder-v2";
function save() {
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        selected,
        extraMeetings,
        eventType: form.elements.eventType.value,
        eventDate: form.elements.eventDate.value,
      }),
    );
  } catch {
    /* Optional; no personal data are stored. */
  }
}
function changed() {
  requestId = crypto.randomUUID();
  status.textContent = "";
  if (online)
    for (const id of ["hero-booking-feedback", "booking-feedback"])
      document.getElementById(id).textContent = "";
  updateQuote();
  save();
}
// The controller remains the single source of selected services and quote data.
// React owns both lists; it receives a snapshot and sends validated selection changes.
function publishServices(error = "") {
  if (!catalog && !error) return;
  const snapshot = {
    services: catalog?.services.filter(service => service.active && service.id !== "consultation") || [],
    selected: { ...selected },
    error,
    onChange: selectService,
  };
  for (const picker of document.querySelectorAll("[data-service-picker]")) picker.updateServices?.(snapshot);
}
function selectService(id, quantity) {
  const service = catalog?.services.find(service => service.id === id && service.active && id !== "consultation");
  if (!service || busy || !Number.isInteger(quantity) || quantity < 0 || quantity > maximumQuantity(service.unit)) return;
  if (quantity) selected[id] = quantity;
  else delete selected[id];
  changed();
}
document.addEventListener("olga:service-picker-ready", () => publishServices());
function renderServices() {
  const consultation = catalog.services.find(
    (service) => service.active && service.id === "consultation",
  );
  document.querySelector("#extra-meetings-row").hidden = !consultation;
  if (!consultation) extraMeetings = 0;
  document.querySelector("#meeting-price").textContent = consultation
    ? `${money(consultation.price)} ₽ / встреча`
    : "";
  document.querySelector("#extra-meetings").value = String(extraMeetings);
  document.querySelector("#hero-meetings-row").hidden = !consultation;
  document.querySelector("#hero-meetings-rate").textContent = consultation
    ? `${money(consultation.price)} ₽ / встреча`
    : "";
}
function syncControls() {
  publishServices();
  for (const id of ["extra-meetings", "hero-extra-meetings"])
    if (document.activeElement !== document.getElementById(id))
      document.getElementById(id).value = String(extraMeetings);
}
function removeService(id) {
  if (busy) return;
  if (id === "consultation") extraMeetings = 0;
  else delete selected[id];
  changed();
  document.querySelector("#open-request").focus({ preventScroll: true });
}
function publishQuoteLines() {
  if (!quote) return;
  for (const summary of document.querySelectorAll("#result-summary, #request-summary")) {
    summary.updateQuoteLines?.({ lines: quote.lines, onRemove: removeService });
  }
}
document.addEventListener("olga:quote-lines-ready", publishQuoteLines);
function renderRequestSummary() {
  const date = form.elements.eventDate.value;
  document.querySelector("#request-date").textContent =
    form.elements.eventType.selectedOptions[0].textContent + " · " +
    (date ? formatEventDate(date) : "Дату обсудим");
  publishQuoteLines();
  document.querySelector("#request-total").textContent = quote.lines.length
    ? (quote.from ? "от " : "") + money(quote.total) + " ₽"
    : "Бесплатно";
  document.querySelector("#request-quote-label").textContent = quote.lines.length
    ? "Предварительная стоимость" : "Первая консультация";
  document.querySelector("#request-quote-note").textContent = quote.lines.length
    ? "Услуги и расчёт передадим Ольге вместе с вашими контактами. Итоговые условия и дату подтвердим лично."
    : "Услуги пока не выбраны. На первой бесплатной встрече обсудим задачи и подберём программу.";
}
function updateQuote() {
  if (!catalog) return;
  quote = estimate(catalog, selected, extraMeetings);
  syncControls();
  renderRequestSummary();
  document.querySelector("#open-request").textContent = quote.lines.length
    ? "ПЕРЕЙТИ К ЗАЯВКЕ ↗" : "БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ ↗";
  document.dispatchEvent(new CustomEvent("olga:quote-updated", { detail: { hasServices: !!quote.lines.length } }));
  document.querySelector("#hero-price-label").textContent = quote.lines.length
    ? "Предварительный расчёт"
    : "Первая консультация";
  document.querySelector("#hero-price").textContent = quote.lines.length
    ? `${quote.from ? "от " : ""}${money(quote.total)} ₽`
    : "Бесплатно";
  document.querySelector("#hero-services-count").textContent = quote.lines
    .length
    ? String(quote.lines.length)
    : "";
  document.querySelector("#hero-event-type").value =
    form.elements.eventType.value;
  const date = form.elements.eventDate.value;
  document.querySelector("#hero-date-label").textContent = date
    ? formatEventDate(date)
    : "Дату можно выбрать позже";
  document.querySelector("#hero-clear-date").hidden = !date;
  document.querySelector("#reset-services").hidden = !quote.lines.length;
  document.dispatchEvent(
    new CustomEvent("olga:booking-date", { detail: { date } }),
  );
  document.querySelector("#result-price").textContent = quote.lines.length
    ? money(quote.total)
    : "—";
  document
    .querySelector(".estimate-panel")
    .classList.toggle("price-empty", !quote.lines.length);
  document.querySelector("#price-prefix").textContent = quote.from ? "от " : "";
  document.querySelector("#selected-count").textContent = quote.lines.length
    ? `${quote.lines.length} ${quote.lines.length === 1 ? "услуга" : quote.lines.length < 5 ? "услуги" : "услуг"} в расчёте`
    : "Выберите услуги или начните с бесплатной встречи";
  document.querySelector("#estimate-note").textContent = quote.from
    ? "В сумму входят услуги с ценой «от». Точную стоимость согласуем после обсуждения оборудования и задач."
    : "Расчёт по выбранным услугам. Дату, продолжительность и условия подтвердим при разговоре.";
  send.disabled = busy || !online;
  document.querySelector("#request-edit").disabled = busy;
  document.querySelector("#open-request").disabled = !online || busy || opening;
  document.querySelector("#hero-request").disabled = !online || busy || opening;
  if (!online)
    document.querySelector("#hero-booking-feedback").textContent =
      "Онлайн-заявка недоступна. Позвоните: 8 911 444-90-71.";
}
function detailsText() {
  return [
    "Здравствуйте, Ольга! Хочу обсудить мероприятие.",
    `Повод: ${form.elements.eventType.selectedOptions[0].textContent}`,
    form.elements.eventDate.value
      ? `Дата: ${form.elements.eventDate.value}`
      : "Дату обсудим",
    ...quote.lines.map(
      (line) =>
        `${line.title}: ${line.quantity} ${units[line.unit]}, ${line.from ? "от " : ""}${money(line.total)} ₽`,
    ),
    "Первая консультация — бесплатно.",
    `Предварительно: ${quote.from ? "от " : ""}${money(quote.total)} ₽.`,
  ].join("\n");
}
async function initialise(force = false) {
  try {
    const loaded = await loadCatalog(force);
    catalog = loaded.catalog;
    online = loaded.online;
    const valid = {};
    for (const service of catalog.services) {
      const quantity = selected[service.id];
      if (
        service.active &&
        Number.isInteger(quantity) &&
        quantity >= 1 &&
        quantity <= maximumQuantity(service.unit)
      )
        valid[service.id] = quantity;
    }
    selected = valid;
    renderServices();
    updateQuote();
    document.querySelector("#builder-loading").hidden = true;
    document.querySelector("#connection-note").hidden = online;
    document.querySelector("#hero-booking").dataset.catalogState = online
      ? "ready"
      : "offline";
    document.dispatchEvent(
      new CustomEvent("olga:catalog-ready", { detail: { online } }),
    );
  } catch (error) {
    online = false;
    document.querySelector("#builder-loading").hidden = false;
    document.querySelector("#builder-loading").textContent = error.message;
    publishServices(error.message);
    document.querySelector("#hero-booking").dataset.catalogState = "error";
    document.dispatchEvent(
      new CustomEvent("olga:catalog-ready", {
        detail: { online: false, failed: true },
      }),
    );
    document.querySelector("#connection-note").hidden = false;
    document.querySelector("#hero-request").disabled = true;
    document.querySelector("#open-request").disabled = true;
    send.disabled = true;
  } finally {
    document.querySelectorAll("[data-retry-catalog]").forEach((button) => {
      button.hidden = online;
    });
  }
}
let retryingCatalog = false;
for (const button of document.querySelectorAll("[data-retry-catalog]")) {
  button.addEventListener("click", async () => {
    if (retryingCatalog || busy || opening) return;
    retryingCatalog = true;
    const buttons = [...document.querySelectorAll("[data-retry-catalog]")];
    const messages = [
      document.querySelector("#catalog-retry-status"),
      document.querySelector("#hero-booking-feedback"),
    ];
    buttons.forEach((item) => {
      item.disabled = true;
      item.setAttribute("aria-busy", "true");
    });
    messages.forEach((item) => {
      item.textContent = "Обновляем услуги и цены…";
    });
    try {
      await initialise(true);
      save();
      messages.forEach((item) => {
        item.textContent = online
          ? "Услуги обновлены. Проверьте расчёт — теперь можно отправить заявку."
          : "Связь пока не восстановилась. Повторите позже или позвоните Ольге.";
      });
      if (
        online &&
        (document.activeElement === button ||
          document.activeElement === document.body)
      )
        document
          .querySelector(
            button.closest("#booking-dialog")
              ? "#hero-request"
              : "#open-request",
          )
          .focus({ preventScroll: true });
    } finally {
      retryingCatalog = false;
      buttons.forEach((item) => {
        item.disabled = false;
        item.removeAttribute("aria-busy");
      });
    }
  });
}
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey));
  if (saved && typeof saved.selected === "object" && saved.selected)
    selected = saved.selected;
  if (
    Number.isInteger(saved?.extraMeetings) &&
    saved.extraMeetings >= 0 &&
    saved.extraMeetings <= 20
  )
    extraMeetings = saved.extraMeetings;
  if (
    saved?.eventType &&
    [...form.elements.eventType.options].some(
      (option) => option.value === saved.eventType,
    )
  )
    form.elements.eventType.value = saved.eventType;
  if (
    typeof saved?.eventDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(saved.eventDate) &&
    saved.eventDate >= localToday()
  )
    form.elements.eventDate.value = saved.eventDate;
} catch {
  /* Optional persistence. */
}
form.elements.eventType.addEventListener("change", changed);
form.elements.eventDate.addEventListener("change", changed);
form.elements.eventDate.min = localToday();
for (const id of ["extra-meetings", "hero-extra-meetings"]) {
  const input = document.getElementById(id);
  input.addEventListener("input", (event) => {
    if (event.target.value && event.target.validity.valid) {
      extraMeetings = Number(event.target.value);
      changed();
    }
  });
  input.addEventListener("change", () => {
    if (!input.value || !input.validity.valid)
      input.value = String(extraMeetings);
  });
}
document
  .querySelector("#hero-event-type")
  .addEventListener("change", (event) => {
    form.elements.eventType.value = event.target.value;
    changed();
  });
document.querySelector("#hero-clear-date").addEventListener("click", () => {
  form.elements.eventDate.value = "";
  changed();
});
document.querySelector("#reset-services").addEventListener("click", () => {
  selected = {};
  extraMeetings = 0;
  changed();
});
document.addEventListener("olga:date-selected", (event) => {
  const date = event.detail?.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  form.elements.eventDate.value = date;
  if (catalog) changed();
});
for (const link of document.querySelectorAll("[data-event]")) {
  link.addEventListener("click", () => {
    form.elements.eventType.value = link.dataset.event;
    changed();
  });
}
form.elements.phone.addEventListener("input", () => {
  form.elements.phone.setCustomValidity(
    validPhone(form.elements.phone.value.trim())
      ? ""
      : "Введите телефон: от 10 до 15 цифр.",
  );
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requestDialog.open) {
    if (online && !busy) openRequest();
    return;
  }
  form.elements.phone.setCustomValidity(
    validPhone(form.elements.phone.value.trim())
      ? ""
      : "Введите телефон: от 10 до 15 цифр.",
  );
  if (busy || !online || !form.reportValidity()) return;
  busy = true;
  document.querySelector("#request-edit").disabled = true;
  send.disabled = true;
  send.textContent = "ОТПРАВЛЯЕМ…";
  status.textContent = "";
  try {
    await verifyEventDate(form.elements.eventDate.value);
    const payload = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      eventType: form.elements.eventType.value,
      eventDate: form.elements.eventDate.value,
      comment: form.elements.comment.value.trim(),
      consent: form.elements.consent.checked,
      website: form.elements.website.value,
      requestId,
      catalogVersion: catalog.version,
      items: Object.entries(selected).map(([id, quantity]) => ({
        id,
        quantity,
      })),
      extraMeetings,
    };
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    const result = await response.json().catch(() => ({}));
    if (result.code === "date_busy" || result.code === "date_past") {
      document.dispatchEvent(new Event("olga:date-recheck"));
      throw new Error(result.error || "Выберите другую дату.");
    }
    if (result.code === "request_conflict") {
      requestId = crypto.randomUUID();
      throw new Error(
        "Данные заявки изменились. Проверьте их и отправьте ещё раз.",
      );
    }
    if (
      result.code === "catalog_changed" ||
      result.code === "service_unavailable"
    ) {
      requestId = crypto.randomUUID();
      await initialise(true);
      throw new Error(
        "Данные расчёта обновились. Проверьте сумму и отправьте заявку ещё раз.",
      );
    }
    if (!response.ok)
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : result.message ||
              "Заявка не отправлена. Попробуйте ещё раз или позвоните Ольге.",
      );
    status.textContent =
      "Заявка сохранена. Ольга свяжется с вами, чтобы обсудить дату и детали.";
    status.dataset.success = "true";
    document.dispatchEvent(new Event("olga:lead-saved"));
    requestDialog.querySelector(".request-fields").hidden = true;
    document.querySelector("#request-success").hidden = false;
    document.querySelector("#request-success-title").focus();
    form.elements.name.value = "";
    form.elements.phone.value = "";
    form.elements.comment.value = "";
    form.elements.consent.checked = false;
    requestId = crypto.randomUUID();
  } catch (error) {
    status.dataset.success = "false";
    status.textContent = ["TimeoutError", "AbortError"].includes(error.name)
      ? "Сервер не успел ответить. Повторите отправку: повторная заявка не будет создана."
      : error.message;
  } finally {
    busy = false;
    updateQuote();
    send.textContent = "ОТПРАВИТЬ ЗАЯВКУ";
  }
});
const requestDialog = document.querySelector("#request-dialog");
async function openRequest(event) {
  if (!online || busy || opening || requestDialog.open) return;
  requestOpener =
    event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : document.activeElement;
  const invalid = [
    ...form.querySelectorAll(".service-main input, .service-main select"),
  ].find((input) => !input.checkValidity());
  if (invalid) {
    invalid.reportValidity();
    return;
  }
  const date = form.elements.eventDate.value;
  opening = true;
  document.querySelector("#hero-request").disabled = true;
  document.querySelector("#open-request").disabled = true;
  for (const id of ["hero-booking-feedback", "booking-feedback"])
    document.getElementById(id).textContent = date
      ? "Проверяем выбранную дату…"
      : "";
  try {
    await verifyEventDate(date);
    if (date !== form.elements.eventDate.value) return;
    for (const id of ["hero-booking-feedback", "booking-feedback"])
      document.getElementById(id).textContent = "";
    renderRequestSummary();
    requestDialog.querySelector(".request-fields").hidden = false;
    document.querySelector("#request-success").hidden = true;
    requestDialog.showModal();
    document.dispatchEvent(new Event("olga:request-opened"));
    document.body.classList.add("dialog-open");
    form.elements.name.focus();
  } catch (error) {
    for (const id of ["hero-booking-feedback", "booking-feedback"])
      document.getElementById(id).textContent = error.message;
    document.dispatchEvent(new Event("olga:date-recheck"));
  } finally {
    opening = false;
    document.querySelector("#hero-request").disabled = !online;
    document.querySelector("#open-request").disabled = !online;
  }
}
document.querySelector("#hero-request").addEventListener("click", (event) => {
  if (!document.querySelector("#booking-date-panel").hidden) {
    document.querySelector("#booking-services-tab").click();
    document.querySelector("#booking-services-tab").focus({ preventScroll: true });
    return;
  }
  openRequest(event);
});
document.querySelector("#open-request").addEventListener("click", openRequest);
for (const link of document.querySelectorAll("[data-discuss]")) {
  link.addEventListener("click", (event) => {
    if (!online) return; // The anchor still reaches prices and the offline contact option.
    event.preventDefault();
    openBooking(event.currentTarget);
  });
}

let editingRequest = false;
document.querySelector("#request-edit").addEventListener("click", () => {
  if (busy) return;
  editingRequest = true;
  requestDialog.close();
});

document
  .querySelector("#request-close")
  .addEventListener("click", () => requestDialog.close());
document
  .querySelector("#request-done")
  .addEventListener("click", () => requestDialog.close());
requestDialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  if (editingRequest) {
    editingRequest = false;
    openBooking(requestOpener, "services");
    return;
  }
  (requestOpener || document.querySelector("#open-request")).focus({
    preventScroll: true,
  });
});
requestDialog.addEventListener("click", (event) => {
  if (event.target !== requestDialog) return;
  const rect = requestDialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    requestDialog.close();
});

// A real telephone route remains available alongside online booking.
const dialog = document.querySelector("#contact-dialog");
document.querySelector("#exact-quote").addEventListener("click", () => {
  if (!quote) return;
  document.querySelector("#dialog-event").textContent = detailsText();
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#copy-fallback").hidden = true;
  dialog.showModal();
  document.body.classList.add("dialog-open");
});
document
  .querySelector("#dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  document.querySelector("#exact-quote").focus({ preventScroll: true });
});
document.querySelector("#copy-details").addEventListener("click", async () => {
  const text = detailsText();
  try {
    await navigator.clipboard.writeText(text);
    document.querySelector("#copy-status").textContent = "Детали скопированы.";
  } catch {
    const fallback = document.querySelector("#copy-fallback");
    fallback.value = text;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
    document.querySelector("#copy-status").textContent =
      "Выделите и скопируйте текст ниже.";
  }
});
initialise();
