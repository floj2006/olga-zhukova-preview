"use client";
import { useEffect, useRef, useState } from "react";
export default function GalleryTile({ photo, index, featured, onOpen }) {
  const figure = useRef(null);
  const [error, setError] = useState(false);
  const [revealed, setRevealed] = useState(true);
  useEffect(() => {
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setRevealed(false);
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setRevealed(true); observer.disconnect(); }
    }, { threshold: .04 });
    observer.observe(figure.current);
    return () => observer.disconnect();
  }, []);
  return (
    <figure ref={figure} className={"gallery-item gallery-reveal" + (revealed ? " is-visible" : "")} data-photo-id={photo.id} data-featured={String(!!featured)}>
      <button type="button" className="gallery-open" data-image-error={error ? "true" : undefined} aria-haspopup="dialog"
        aria-label={`Открыть фотографию ${index + 1}: ${photo.alt || photo.caption || "Момент мероприятия"}`}
        onClick={event => onOpen(index, event.currentTarget)}>
        <img src={photo.url} alt={photo.alt || "Мероприятие с Ольгой Жуковой"} loading="lazy" decoding="async"
          width={photo.width || 1200} height={photo.height || 900} onError={() => setError(true)} onLoad={() => setError(false)} />
        <span className="gallery-open-hint" aria-hidden="true">{error ? "Фото не загрузилось · открыть ещё раз ↗" : "Смотреть кадр ↗"}</span>
      </button>
      <figcaption><span className="gallery-index">{String(index + 1).padStart(2, "0")}</span><span>{photo.caption || ""}</span></figcaption>
    </figure>
  );
}
