"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useBooking } from "../booking/BookingProvider";
const links = [
  ["/events", "Мероприятия"],
  ["/portfolio", "Портфолио"],
  ["/about", "Обо мне"],
  ["/services", "Услуги и цены"],
  ["/contacts", "Контакты"],
];
export default function Header({ home = false }) {
  const booking = useBooking();
  const path = usePathname(),
    menu = useRef(null),
    toggle = useRef(null);
  const [open, setOpen] = useState(false),
    [scrolled, setScrolled] = useState(false),
    [section, setSection] = useState("");
  const navLinks = home
    ? [
        ["/events", "Мероприятия"],
        ["/portfolio", "Портфолио"],
        ["#about", "Обо мне"],
        ["#program", "Программа"],
        ["#calculator", "Услуги и цены"],
        ["#contact", "Контакты"],
      ]
    : links;
  const active = (route) =>
    route.startsWith("#")
      ? section === route
      : path === route || (route === "/events" && path?.startsWith("/events/"));
  function focusAnchor(event) {
    const hash = event.currentTarget.hash;
    if (!home || !hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target)
      requestAnimationFrame(() => {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      });
  }
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 40);
      if (home) {
        let current = "";
        for (const node of document.querySelectorAll("main > section[id]")) {
          if (
            !node.hidden &&
            node.getBoundingClientRect().top <=
              (document.querySelector(".header-inner")?.offsetHeight || 90) +
                110
          )
            current = "#" + node.id;
        }
        setSection(current === "#top" ? "" : current);
      }
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const wide = matchMedia("(min-width: 1201px)");
    const resize = () => {
      if (wide.matches) setOpen(false);
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    wide.addEventListener("change", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      wide.removeEventListener("change", resize);
    };
  }, [home]);
  useEffect(() => {
    if (!open) return;
    const saved = [
      ...document.querySelectorAll(
        ".public-site main,.public-site footer,.header .brand,.header-actions",
      ),
    ].map((node) => [node, node.inert]);
    for (const [node] of saved) node.inert = true;
    document.body.classList.add("menu-open");
    menu.current.querySelector("a")?.focus();
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        toggle.current?.focus();
      }
      if (event.key !== "Tab") return;
      const items = [
        ...menu.current.querySelectorAll("a,button:not(:disabled)"),
      ];
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!items.includes(document.activeElement)) {
        event.preventDefault();
        items[1]?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.classList.remove("menu-open");
      for (const [node, prior] of saved) node.inert = prior;
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <header className={"header" + (scrolled ? " scrolled" : "")} id="header">
      <div className="header-inner">
        <a className="brand" href="/" aria-label="Ольга Жукова — на главную">
          <span className="monogram" aria-hidden="true">
            О<span>Ж</span>
          </span>
          <span className="brand-copy">
            <strong>ОЛЬГА ЖУКОВА</strong>
            <small>ВЕДУЩАЯ МЕРОПРИЯТИЙ</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navLinks.map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={focusAnchor}
              aria-current={
                active(href)
                  ? href.startsWith("#")
                    ? "location"
                    : "page"
                  : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a
            className="header-booking"
            href="/services#calculator"
            data-discuss=""
          >
            Узнать стоимость <span aria-hidden="true">↗</span>
          </a>
        </div>
        <button
          className="menu-toggle"
          ref={toggle}
          id="menu-toggle"
          type="button"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>
      <div
        className="mobile-menu"
        id="mobile-menu"
        ref={menu}
        role="dialog"
        aria-modal="true"
        aria-label="Меню сайта"
        hidden={!open}
      >
        <p className="eyebrow">ОЛЬГА ЖУКОВА · ВАШ ВЕЧЕР</p>
        <button
          type="button"
          className="mobile-menu-close"
          onClick={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        >
          Закрыть ×
        </button>
        <nav aria-label="Мобильная навигация">
          {navLinks.map(([href, label], index) => (
            <a
              key={href}
              href={href}
              onClick={(event) => {
                setOpen(false);
                focusAnchor(event);
              }}
              aria-current={
                active(href)
                  ? href.startsWith("#")
                    ? "location"
                    : "page"
                  : undefined
              }
            >
              <span aria-hidden="true">0{index + 1}</span>
              {label}
              <i aria-hidden="true">↗</i>
            </a>
          ))}
        </nav>
        <a
          className="button"
          href="/services#calculator"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            booking.openBooking("date", toggle.current);
          }}
        >
          Узнать стоимость <span aria-hidden="true">→</span>
        </a>
        <a
          className="menu-phone"
          href="tel:+79114449071"
          onClick={() => setOpen(false)}
        >
          8 911 444-90-71
        </a>
        <span className="menu-location">Вологда и выездные мероприятия</span>
      </div>
    </header>
  );
}
