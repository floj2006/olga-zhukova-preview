(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Content remains visible if JavaScript is disabled or observers are unavailable.
  if ("IntersectionObserver" in window) {
    document.documentElement.classList.add("js");
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 },
    );
    document
      .querySelectorAll(".reveal")
      .forEach((element) => reveal.observe(element));
  }

  const header = $("header");
  const updateHeader = () =>
    header.classList.toggle("scrolled", window.scrollY > 90);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
  $("year").textContent = new Date().getFullYear();

  const menuButton = $("menu-toggle");
  const menu = $("mobile-menu");
  function setMenu(open, restoreFocus = false) {
    menu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute(
      "aria-label",
      open ? "Закрыть меню" : "Открыть меню",
    );
    document.body.classList.toggle("menu-open", open);
    if (open) menu.querySelector("a").focus();
    else if (restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    setMenu(false);
    if (link.hash) {
      const target = document.querySelector(link.hash);
      if (target) {
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (menu.hidden) return;
    if (event.key === "Escape") setMenu(false, true);
    if (event.key === "Tab") {
      const last = menu.querySelector("a:last-child");
      if (event.shiftKey && document.activeElement === menuButton) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        menuButton.focus();
      }
    }
  });
  window
    .matchMedia("(min-width: 901px)")
    .addEventListener("change", (event) => {
      if (event.matches) setMenu(false);
    });

  // A single open chapter keeps the programme easy to scan.
  const chapters = document.querySelectorAll(".program details");
  chapters.forEach((chapter) =>
    chapter.addEventListener("toggle", () => {
      if (chapter.open)
        chapters.forEach((other) => {
          if (other !== chapter) other.open = false;
        });
    }),
  );
})();
