"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
function Photo({ photo }) {
  const [state, setState] = useState("loading");
  return <>
    <img className="lightbox-image" src={photo.url} alt={photo.alt || photo.caption || "Мероприятие с Ольгой Жуковой"}
      decoding="async" hidden={state === "error"} onLoad={() => setState("ready")} onError={() => setState("error")} />
    <p className="lightbox-feedback" role="status">{state === "error" ? "Фото не загрузилось. Перейдите к следующему кадру или попробуйте позже." : state === "loading" ? "Загружаем фотографию…" : ""}</p>
  </>;
}
export default function GalleryLightbox({ photos, initialIndex, opener, onClose }) {
  const dialog = useRef(null), close = useRef(null), touch = useRef(null);
  const [current, setCurrent] = useState(initialIndex);
  const photo = photos[current];
  const move = step => setCurrent(index => (index + step + photos.length) % photos.length);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    document.body.classList.add("dialog-open");
    close.current.focus();
    return () => {
      element.close();
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);
  return createPortal(
    <dialog ref={dialog} id="gallery-lightbox" className="gallery-lightbox" aria-label="Просмотр фотографий мероприятий"
      onClose={() => { if (!dialog.current?.open) onClose(); }} onKeyDown={event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
      }}>
      <div className="lightbox-top">
        <p className="lightbox-counter" id="lightbox-counter" aria-live="polite">{String(current + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}</p>
        <button ref={close} type="button" className="lightbox-close" aria-label="Закрыть фотографию" onClick={() => dialog.current.close()}>×</button>
      </div>
      <div className="lightbox-stage" onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}
        onTouchStart={event => { touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
        onTouchCancel={() => { touch.current = null; }} onTouchEnd={event => {
          const start = touch.current; touch.current = null;
          if (!start || !event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
        }}>
        <Photo key={photo.id} photo={photo} />
      </div>
      <button type="button" className="lightbox-prev" aria-label="Предыдущая фотография" hidden={photos.length < 2} onClick={() => move(-1)}>←</button>
      <button type="button" className="lightbox-next" aria-label="Следующая фотография" hidden={photos.length < 2} onClick={() => move(1)}>→</button>
      <p className="lightbox-caption" id="lightbox-caption">{photo.caption || ""}</p>
    </dialog>, document.body);
}
