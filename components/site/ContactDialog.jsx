"use client";
import { useEffect, useRef, useState } from "react";
import { useBooking, eventTypes } from "../booking/BookingProvider";
export default function ContactDialog() {
  const b = useBooking(),
    dialog = useRef(null),
    fallback = useRef(null),
    [open, setOpen] = useState(false),
    [copied, setCopied] = useState(""),
    [manual, setManual] = useState(false);
  const text = [
    "Здравствуйте, Ольга! Хочу обсудить мероприятие.",
    `Повод: ${eventTypes[b.eventType]}`,
    b.eventDate ? `Дата: ${b.eventDate}` : "Дату обсудим",
    ...b.quote.lines.map(
      (l) =>
        `${l.title}: ${l.quantity}, ${l.from ? "от " : ""}${new Intl.NumberFormat("ru-RU").format(l.total)} ₽`,
    ),
    "Первая консультация — бесплатно.",
    `Предварительно: ${b.quote.from ? "от " : ""}${new Intl.NumberFormat("ru-RU").format(b.quote.total)} ₽.`,
  ].join("\n");
  useEffect(() => {
    const show = () => {
      setOpen(true);
      setCopied("");
      setManual(false);
    };
    document.addEventListener("olga:phone-details", show);
    return () => document.removeEventListener("olga:phone-details", show);
  }, []);
  useEffect(() => {
    if (open) {
      dialog.current.showModal();
      document.body.classList.add("dialog-open");
    } else {
      dialog.current.close();
      if (!document.querySelector("dialog[open]"))
        document.body.classList.remove("dialog-open");
    }
  }, [open]);
  useEffect(() => {
    if (manual) {
      fallback.current.focus();
      fallback.current.select();
    }
  }, [manual]);
  return (
    <dialog
      ref={dialog}
      id="contact-dialog"
      className="contact-dialog"
      aria-labelledby="dialog-title"
      onClose={() => {
        setOpen(false);
        document.getElementById("exact-quote")?.focus({ preventScroll: true });
      }}
    >
      <button
        type="button"
        className="dialog-close"
        id="dialog-close"
        aria-label="Закрыть"
        onClick={() => setOpen(false)}
      >
        ×
      </button>
      <p className="eyebrow">ДЕТАЛИ ВАШЕГО СОБЫТИЯ</p>
      <h2 id="dialog-title">
        Давайте <em>созвонимся.</em>
      </h2>
      <div className="dialog-event" id="dialog-event">
        {text}
      </div>
      <a className="dialog-phone" href="tel:+79114449071">
        8 911 444-90-71
      </a>
      <a className="button" href="tel:+79114449071">
        ПОЗВОНИТЬ ОЛЬГЕ
      </a>
      <button
        type="button"
        className="copy-button"
        id="copy-details"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied("Детали скопированы.");
          } catch {
            setManual(true);
            setCopied("Выделите и скопируйте текст ниже.");
          }
        }}
      >
        Скопировать детали мероприятия
      </button>
      <p id="copy-status" className="copy-status" role="status">
        {copied}
      </p>
      <textarea
        ref={fallback}
        className="copy-fallback"
        id="copy-fallback"
        aria-label="Детали мероприятия для копирования"
        readOnly
        hidden={!manual}
        value={text}
      />
    </dialog>
  );
}
