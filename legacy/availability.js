import {
  getAvailability,
  localToday,
  formatEventDate,
} from "./availability-store.js";
const calendar = document.querySelector("#hero-calendar");
calendar.innerHTML = `<div class="calendar-navigation"><button type="button" id="calendar-prev" aria-label="Предыдущий месяц">←</button><h3 id="calendar-month" aria-live="polite"></h3><button type="button" id="calendar-next" aria-label="Следующий месяц">→</button></div><div class="calendar-weekdays" aria-hidden="true"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="calendar-days" id="calendar-days" role="group" aria-labelledby="calendar-month"></div><div class="calendar-legend"><span><i></i>Свободно</span><span><i class="busy"></i>Занято</span></div><div class="calendar-feedback"><p id="calendar-status" role="status" aria-live="polite"></p><button id="calendar-retry" class="text-link" type="button" hidden>Повторить проверку</button><button id="calendar-services" type="button" hidden>Выбрать услуги <span aria-hidden="true">→</span></button></div>`;
const $ = (id) => document.querySelector(`#${id}`);
// Read the current field as well as listening for later updates: modules can load in either order.
let chosen = document.querySelector("#event-builder [name=eventDate]").value;
let month = chosen ? chosen.slice(0, 7) : localToday().slice(0, 7),
  available = false,
  busyDates = new Set(),
  controller;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function animateEntry(node, direction = 0) {
  node.getAnimations().forEach((animation) => animation.cancel());
  if (reducedMotion.matches) return;
  node.animate(
    [
      {
        opacity: 0.25,
        transform: `translate(${direction * 12}px, ${direction ? 0 : 5}px)`,
      },
      { opacity: 1, transform: "translate(0, 0)" },
    ],
    { duration: 340, easing: "cubic-bezier(.22,.61,.36,1)" },
  );
}
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches)
    document
      .querySelector("#hero-booking")
      .getAnimations({ subtree: true })
      .forEach((animation) => animation.cancel());
});
let hasServices = document.querySelector("#hero-services-count").textContent !== "";
function updateContinueLabel() {
  $("hero-request").textContent = !$("booking-date-panel").hidden
    ? (chosen ? "ВЫБРАТЬ УСЛУГИ →" : "ДАТУ ВЫБЕРЕМ ПОЗЖЕ →")
    : hasServices ? "ПЕРЕЙТИ К ЗАЯВКЕ ↗" : "БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ ↗";
}
document.addEventListener("olga:quote-updated", (event) => {
  hasServices = event.detail.hasServices;
  updateContinueLabel();
});
function showTab(tab, focus = false) {
  const changed = $(`booking-${tab}-panel`).hidden;
  for (const item of ["date", "services"]) {
    $(`booking-${item}-panel`).hidden = item !== tab;
    $(`booking-${item}-tab`).setAttribute(
      "aria-selected",
      String(item === tab),
    );
    $(`booking-${item}-tab`).tabIndex = item === tab ? 0 : -1;
  }
  document.querySelector(".booking-tabs").dataset.active = tab;
  updateContinueLabel();
  if (changed) animateEntry($("booking-" + tab + "-panel"));
  if (changed && $("booking-dialog").open) {
    document.dispatchEvent(new CustomEvent("olga:booking-step", { detail: { step: tab } }));
  }
  if (changed && tab === "date" && !available) loadMonth();
  if (focus) $(`booking-${tab}-tab`).focus({ preventScroll: true });
}
for (const tab of ["date", "services"]) {
  $(`booking-${tab}-tab`).addEventListener("click", () => showTab(tab));
  $(`booking-${tab}-tab`).addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      showTab(
        event.key === "Home"
          ? "date"
          : event.key === "End"
            ? "services"
            : tab === "date"
              ? "services"
              : "date",
        true,
      );
    }
  });
}
$("hero-date-label").addEventListener("click", () => showTab("date", true));
$("calendar-services").addEventListener("click", () =>
  showTab("services", true),
);
function renderDays() {
  const start = new Date(`${month}-01T12:00:00`),
    today = localToday();
  $("calendar-month").textContent = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(start);
  $("calendar-prev").disabled = month <= today.slice(0, 7);
  $("calendar-next").disabled = month >= "2099-12";
  const days = $("calendar-days");
  days.replaceChildren();
  for (let n = 0; n < (start.getDay() + 6) % 7; n++) {
    const empty = document.createElement("span");
    empty.setAttribute("aria-hidden", "true");
    days.append(empty);
  }
  const count = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  for (let n = 1; n <= count; n++) {
    const date = `${month}-${String(n).padStart(2, "0")}`,
      button = document.createElement("button");
    button.type = "button";
    button.textContent = String(n);
    button.dataset.date = date;
    button.dataset.busy = String(busyDates.has(date));
    button.dataset.past = String(date < today);
    button.disabled = !available || date < today;
    button.setAttribute(
      "aria-label",
      `${formatEventDate(date)}, ${date < today ? "прошедшая дата" : available ? (busyDates.has(date) ? "занято" : "свободно") : "доступность не проверена"}`,
    );
    button.setAttribute("aria-pressed", String(date === chosen));
    if (date === today) button.setAttribute("aria-current", "date");
    button.addEventListener("click", () => {
      chosen = date;
      renderDays();
      selectionMessage();
      document.dispatchEvent(
        new CustomEvent("olga:date-selected", { detail: { date } }),
      );
      const selectedDay = days.querySelector(`[data-date="${date}"]`);
      selectedDay?.focus({ preventScroll: true });
      if (selectedDay && !reducedMotion.matches)
        selectedDay.animate(
          [{ transform: "scale(.94)" }, { transform: "scale(1)" }],
          { duration: 260, easing: "ease-out" },
        );
    });
    days.append(button);
  }
  $("calendar-services").hidden =
    !chosen || !available || busyDates.has(chosen) || !chosen.startsWith(month);
}
function selectionMessage() {
  updateContinueLabel();
  $("calendar-status").textContent =
    chosen && chosen.startsWith(month)
      ? busyDates.has(chosen)
        ? "Эта дата уже занята. Выберите другую или свяжитесь с Ольгой."
        : `${formatEventDate(chosen)} — дата свободна.`
      : "Выберите дату или сразу перейдите к услугам.";
}
async function loadMonth(direction = 0) {
  controller?.abort();
  controller = new AbortController();
  const current = controller,
    requested = month;
  available = false;
  busyDates = new Set();
  renderDays();
  $("calendar-days").setAttribute("aria-busy", "true");
  $("calendar-status").textContent = "Проверяем даты…";
  $("calendar-retry").hidden = true;
  animateEntry(
    $("calendar-days"),
    typeof direction === "number" ? direction : 0,
  );
  animateEntry(
    $("calendar-month"),
    typeof direction === "number" ? direction : 0,
  );
  try {
    const result = await getAvailability(requested, current.signal);
    if (current !== controller) return;
    busyDates = result;
    available = true;
    renderDays();
    selectionMessage();
  } catch {
    if (current !== controller || current.signal.aborted) return;
    $("calendar-status").textContent =
      "Не удалось проверить даты. Повторите попытку или позвоните Ольге.";
    $("calendar-retry").hidden = false;
  } finally {
    if (current === controller) {
      $("calendar-days").setAttribute("aria-busy", "false");
      $("hero-booking").dataset.calendarState = available ? "ready" : "offline";
      document.dispatchEvent(
        new CustomEvent("olga:calendar-ready", {
          detail: { online: available },
        }),
      );
    }
  }
}
for (const [id, step] of [
  ["calendar-prev", -1],
  ["calendar-next", 1],
])
  $(id).addEventListener("click", () => {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + step);
    month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    loadMonth(step);
  });
$("calendar-retry").addEventListener("click", loadMonth);
$("calendar-days").addEventListener("keydown", (event) => {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
    event.key
  ];
  if (!step || !event.target.dataset.date) return;
  event.preventDefault();
  const buttons = [...$("calendar-days").querySelectorAll("button")],
    next = buttons[buttons.indexOf(event.target) + step];
  if (next && !next.disabled) next.focus();
});
document.addEventListener("olga:booking-date", (event) => {
  const date = event.detail?.date || "";
  if (date === chosen) return;
  chosen = date;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.slice(0, 7) !== month) {
    month = date.slice(0, 7);
    loadMonth();
  } else {
    renderDays();
    if (available) selectionMessage();
  }
});
document.addEventListener("olga:date-recheck", () => loadMonth());
document
  .querySelector(".hero-calendar-link")
  .addEventListener("click", () => showTab("date"));
if (document.querySelector("#booking-dialog").open) loadMonth();
updateContinueLabel();
