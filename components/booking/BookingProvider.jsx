"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { estimate } from "../../public/catalog-store";
import { maximumQuantity, validPhone } from "../../public/booking-rules";
import { localToday, verifyEventDate } from "../../public/availability-store";
export const eventTypes = {
  wedding: "Свадьба",
  corporate: "Корпоратив",
  anniversary: "Юбилей",
  graduation: "Выпускной",
  other: "Другое событие",
};
const Context = createContext(null);
const storageKey = "olga-service-builder-v2";
function restoredDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < localToday()
  )
    return "";
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : "";
}
const initial = {
  catalog: null,
  online: false,
  loading: true,
  error: "",
  selected: {},
  extraMeetings: 0,
  eventType: "wedding",
  eventDate: "",
  open: false,
  step: "date",
  checking: false,
  sending: false,
  feedback: "",
  retryFeedback: "",
  status: "",
  success: false,
  refresh: 0,
  name: "",
  phone: "",
  comment: "",
  consent: false,
  website: "",
};
export const metricEvent = (name, detail) =>
  document.dispatchEvent(new CustomEvent(name, { detail }));
export function useBooking() {
  return useContext(Context);
}
export default function BookingProvider({ children }) {
  const [state, setState] = useState(initial);
  const current = useRef(state),
    mounted = useRef(false),
    generation = useRef(0),
    contactCheck = useRef(0),
    requestId = useRef(null),
    opener = useRef(null),
    signature = useRef(null);
  const patch = (values) => {
    current.current = { ...current.current, ...values };
    if (mounted.current) setState(current.current);
  };
  const persist = () => {
    const s = current.current;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          selected: s.selected,
          extraMeetings: s.extraMeetings,
          eventDate: s.eventDate,
          eventType: s.eventType,
        }),
      );
    } catch {}
  };
  function change(values) {
    if (current.current.sending) return;
    requestId.current = crypto.randomUUID();
    signature.current = null;
    patch({ ...values, feedback: "", status: "", success: false });
    persist();
  }
  async function load(force = false) {
    const seq = ++generation.current;
    patch({ loading: true, error: "" });
    try {
      const url = "/catalog-store.js";
      const store = await import(/* webpackIgnore: true */ url);
      const loaded = await store.loadCatalog(force);
      if (!mounted.current || seq !== generation.current) return;
      const selected = {};
      for (const service of loaded.catalog.services) {
        const n = current.current.selected[service.id];
        if (
          service.active &&
          service.id !== "consultation" &&
          Number.isInteger(n) &&
          n >= 1 &&
          n <= maximumQuantity(service.unit)
        )
          selected[service.id] = n;
      }
      const extraMeetings = loaded.catalog.services.some(
        (s) => s.active && s.id === "consultation",
      )
        ? current.current.extraMeetings
        : 0;
      patch({
        catalog: loaded.catalog,
        online: loaded.online,
        selected,
        extraMeetings,
        loading: false,
      });
      persist();
      metricEvent("olga:catalog-ready", { online: loaded.online });
    } catch (error) {
      if (!mounted.current || seq !== generation.current) return;
      patch({ loading: false, online: false, error: error.message });
      metricEvent("olga:catalog-ready", { online: false, failed: true });
    }
  }
  useEffect(() => {
    mounted.current = true;
    requestId.current = crypto.randomUUID();
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (saved) {
        patch({
          selected:
            saved.selected && typeof saved.selected === "object"
              ? saved.selected
              : {},
          extraMeetings:
            Number.isInteger(saved.extraMeetings) &&
            saved.extraMeetings >= 0 &&
            saved.extraMeetings <= 20
              ? saved.extraMeetings
              : 0,
          eventType: Object.hasOwn(eventTypes, saved.eventType)
            ? saved.eventType
            : "wedding",
          eventDate: restoredDate(saved.eventDate),
        });
      }
    } catch {}
    load();
    const click = (e) => {
      const trigger = e.target.closest?.(
        "[data-discuss],[data-check-date],[data-event]",
      );
      if (!trigger) return;
      if (trigger.dataset.event) {
        change({ eventType: trigger.dataset.event });
        if (!trigger.hasAttribute("data-discuss") && !trigger.hasAttribute("data-check-date")) return;
      }
      e.preventDefault();
      open("date", trigger);
    };
    const recheck = () => patch({ refresh: current.current.refresh + 1 });
    document.addEventListener("click", click);
    document.addEventListener("olga:date-recheck", recheck);
    return () => {
      mounted.current = false;
      generation.current++;
      document.removeEventListener("click", click);
      document.removeEventListener("olga:date-recheck", recheck);
    };
  }, []);
  function open(step = "date", trigger = document.activeElement) {
    contactCheck.current++;
    opener.current = trigger;
    patch({
      open: true,
      checking: false,
      step,
      success: false,
      status: "",
      feedback: "",
      refresh: current.current.refresh + 1,
    });
    metricEvent("olga:booking-opened", { step });
  }
  function close() {
    if (current.current.sending) return;
    contactCheck.current++;
    patch({ open: false, checking: false });
  }
  function step(next) {
    if (current.current.sending) return;
    contactCheck.current++;
    patch({ step: next, feedback: "", checking: false });
    metricEvent("olga:booking-step", { step: next });
  }
  async function contacts(trigger) {
    const s = current.current;
    if (
      !s.online ||
      s.loading ||
      s.sending ||
      s.checking ||
      (s.open && s.step === "contact")
    )
      return;
    if (!s.open) opener.current = trigger || document.activeElement;
    const seq = ++contactCheck.current;
    const date = s.eventDate;
    patch({
      checking: true,
      feedback: date ? "Проверяем выбранную дату…" : "",
    });
    try {
      await verifyEventDate(date);
      if (
        !mounted.current ||
        seq !== contactCheck.current ||
        date !== current.current.eventDate
      )
        return;
      // Closing the booking during a request must not reopen it later.
      if (s.open && !current.current.open) return;
      patch({
        open: true,
        step: "contact",
        success: false,
        status: "",
        feedback: "",
      });
      metricEvent("olga:request-opened");
    } catch (error) {
      if (seq === contactCheck.current)
        patch({
          feedback: error.message,
          refresh: current.current.refresh + 1,
        });
    } finally {
      if (seq === contactCheck.current) patch({ checking: false });
    }
  }
  async function submit(form) {
    const s = current.current;
    form.elements.phone.setCustomValidity(
      validPhone(s.phone.trim()) ? "" : "Введите телефон: от 10 до 15 цифр.",
    );
    if (s.sending || !s.online || !form.reportValidity()) return;
    const data = {
      name: s.name.trim(),
      phone: s.phone.trim(),
      eventType: s.eventType,
      eventDate: s.eventDate,
      comment: s.comment.trim(),
      consent: s.consent,
      website: s.website,
      catalogVersion: s.catalog.version,
      items: Object.entries(s.selected).map(([id, quantity]) => ({
        id,
        quantity,
      })),
      extraMeetings: s.extraMeetings,
    };
    const nextSignature = JSON.stringify(data);
    if (signature.current && signature.current !== nextSignature)
      requestId.current = crypto.randomUUID();
    signature.current = nextSignature;
    const payload = { ...data, requestId: requestId.current };
    patch({ sending: true, status: "" });
    try {
      await verifyEventDate(data.eventDate);
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json().catch(() => ({}));
      if (!mounted.current) return;
      if (["date_busy", "date_past"].includes(result.code)) {
        patch({ refresh: current.current.refresh + 1 });
        throw Error(result.error || "Выберите другую дату.");
      }
      if (result.code === "request_conflict") {
        requestId.current = crypto.randomUUID();
        throw Error(
          "Данные заявки изменились. Проверьте их и отправьте ещё раз.",
        );
      }
      if (["catalog_changed", "service_unavailable"].includes(result.code)) {
        requestId.current = crypto.randomUUID();
        await load(true);
        throw Error(
          "Данные расчёта обновились. Проверьте сумму и отправьте заявку ещё раз.",
        );
      }
      if (!response.ok)
        throw Error(
          result.error ||
            result.message ||
            "Заявка не отправлена. Попробуйте ещё раз или позвоните Ольге.",
        );
      patch({
        success: true,
        status:
          "Заявка сохранена. Ольга свяжется с вами, чтобы обсудить дату и детали.",
        name: "",
        phone: "",
        comment: "",
        consent: false,
      });
      requestId.current = crypto.randomUUID();
      signature.current = null;
      metricEvent("olga:lead-saved");
    } catch (error) {
      patch({
        status: ["TimeoutError", "AbortError"].includes(error.name)
          ? "Сервер не успел ответить. Повторите отправку: повторная заявка не будет создана."
          : error.message,
      });
    } finally {
      patch({ sending: false });
    }
  }
  const quote = state.catalog
    ? estimate(state.catalog, state.selected, state.extraMeetings)
    : { lines: [], total: 0, from: false };
  const select = (id, n) => {
    const service = current.current.catalog?.services.find(
      (s) => s.id === id && s.active && id !== "consultation",
    );
    if (
      !service ||
      !Number.isInteger(n) ||
      n < 0 ||
      n > maximumQuantity(service.unit)
    )
      return;
    const selected = { ...current.current.selected };
    if (n) selected[id] = n;
    else delete selected[id];
    change({ selected });
  };
  const remove = (id) => {
    if (id === "consultation") change({ extraMeetings: 0 });
    else select(id, 0);
  };
  async function retry() {
    if (current.current.loading || current.current.sending) return;
    await load(true);
    patch({
      retryFeedback: current.current.online
        ? "Услуги обновлены. Проверьте расчёт — теперь можно отправить заявку."
        : "Связь пока не восстановилась. Повторите позже или позвоните Ольге.",
    });
  }
  return (
    <Context.Provider
      value={{
        ...state,
        quote,
        change,
        patch,
        select,
        remove,
        openBooking: open,
        close,
        stepTo: step,
        contacts,
        submit,
        retry,
        opener,
      }}
    >
      {children}
    </Context.Provider>
  );
}
