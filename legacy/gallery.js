import { loadCatalog } from "./catalog-store.js";
const node = (tag, cls, text) => {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
};
try {
  const { catalog } = await loadCatalog();
  const photos = (catalog.gallery || []).filter((photo) => {
    if (photo.published === false) return false;
    try {
      return ["https:", "http:"].includes(
        new URL(photo.url, location.origin).protocol,
      );
    } catch {
      return false;
    }
  });
  const section = document.querySelector("#gallery"),
    list = document.querySelector("#gallery-grid");
  if (photos.length) {
    const dialog = node("dialog", "gallery-lightbox");
    dialog.id = "gallery-lightbox";
    dialog.setAttribute("aria-label", "Просмотр фотографий мероприятий");
    const top = node("div", "lightbox-top");
    const counter = node("p", "lightbox-counter");
    counter.id = "lightbox-counter";
    counter.setAttribute("aria-live", "polite");
    const close = node("button", "lightbox-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть фотографию");
    top.append(counter, close);
    const stage = node("div", "lightbox-stage");
    const image = node("img", "lightbox-image");
    image.decoding = "async";
    const caption = node("p", "lightbox-caption");
    caption.id = "lightbox-caption";
    const previous = node("button", "lightbox-prev", "←");
    previous.type = "button";
    previous.setAttribute("aria-label", "Предыдущая фотография");
    const next = node("button", "lightbox-next", "→");
    next.type = "button";
    next.setAttribute("aria-label", "Следующая фотография");
    const feedback = node("p", "lightbox-feedback");
    feedback.setAttribute("role", "status");
    stage.append(image, feedback);
    dialog.append(top, stage, previous, next, caption);
    document.body.append(dialog);
    let current = 0,
      opener,
      touch;
    function show(index) {
      current = (index + photos.length) % photos.length;
      const photo = photos[current];
      image.hidden = false;
      image.alt = photo.alt || photo.caption || "Мероприятие с Ольгой Жуковой";
      image.src = photo.url;
      caption.textContent = photo.caption || "";
      counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
      previous.hidden = next.hidden = photos.length < 2;
      feedback.textContent = "";
    }
    image.addEventListener("error", () => {
      image.hidden = true;
      feedback.textContent =
        "Фото не загрузилось. Перейдите к следующему кадру или попробуйте позже.";
    });
    image.addEventListener("load", () => { image.hidden = false; });
    previous.addEventListener("click", () => show(current - 1));
    next.addEventListener("click", () => show(current + 1));
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        show(current - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        show(current + 1);
      }
    });
    dialog.addEventListener("close", () => {
      if (!document.querySelector("dialog[open]"))
        document.body.classList.remove("dialog-open");
      opener?.focus({ preventScroll: true });
      image.removeAttribute("src");
    });
    stage.addEventListener("click", (event) => {
      if (event.target === stage) dialog.close();
    });
    stage.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length === 1)
          touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        else touch = null;
      },
      { passive: true },
    );
    stage.addEventListener(
      "touchend",
      (event) => {
        if (!touch || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - touch.x,
          dy = event.changedTouches[0].clientY - touch.y;
        touch = null;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5)
          show(current + (dx < 0 ? 1 : -1));
      },
      { passive: true },
    );
    stage.addEventListener(
      "touchcancel",
      () => {
        touch = null;
      },
      { passive: true },
    );
    const hasFeatured = photos.some((photo) => photo.featured);
    const observer =
      "IntersectionObserver" in window &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries)
                if (entry.isIntersecting) {
                  entry.target.classList.add("is-visible");
                  observer.unobserve(entry.target);
                }
            },
            { threshold: 0.04 },
          )
        : null;
    for (const [index, photo] of photos.entries()) {
      const figure = node("figure", "gallery-item");
      figure.dataset.featured = String(
        photo.featured || (!hasFeatured && index === 0),
      );
      figure.dataset.photoId = photo.id;
      const button = node("button", "gallery-open");
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Открыть фотографию ${index + 1}: ${photo.alt || photo.caption || "Момент мероприятия"}`,
      );
      button.setAttribute("aria-haspopup", "dialog");
      const img = node("img");
      img.src = photo.url;
      img.alt = photo.alt || "Мероприятие с Ольгой Жуковой";
      img.loading = "lazy";
      img.decoding = "async";
      img.width = photo.width || 1200;
      img.height = photo.height || 900;
      const hint = node("span", "gallery-open-hint", "Смотреть кадр ↗");
      img.addEventListener("error", () => {
        button.dataset.imageError = "true";
        hint.textContent = "Фото не загрузилось · открыть ещё раз ↗";
      });
      img.addEventListener("load", () => {
        delete button.dataset.imageError;
        hint.textContent = "Смотреть кадр ↗";
      });
      hint.setAttribute("aria-hidden", "true");
      button.append(img, hint);
      const description = node("figcaption");
      description.append(
        node("span", "gallery-index", String(index + 1).padStart(2, "0")),
        node("span", "", photo.caption || ""),
      );
      figure.append(button, description);
      list.append(figure);
      if (observer) {
        figure.classList.add("gallery-reveal");
        observer.observe(figure);
      }
      button.addEventListener("click", () => {
        opener = button;
        show(index);
        dialog.showModal();
        document.body.classList.add("dialog-open");
        close.focus();
      });
    }
    section.hidden = false;
    for (const link of document.querySelectorAll("[data-gallery-link]"))
      link.hidden = false;
  }
} catch {
  /* Empty or unavailable galleries never impersonate a portfolio. */
}
