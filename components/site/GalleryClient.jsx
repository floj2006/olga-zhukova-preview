"use client";
import { useEffect, useRef, useState } from "react";
import GalleryTile from "./GalleryTile";

export default function GalleryClient({ children }) {
  const root = useRef(null);
  const opener = useRef(null);
  const attempt = useRef(0);
  const [photos, setPhotos] = useState([]);
  const [Lightbox, setLightbox] = useState(null);
  const [index, setIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const section = root.current;
    section.setGallery = (items) => setPhotos(items.filter(photo => {
      if (photo.published === false) return false;
      try { return ["http:", "https:"].includes(new URL(photo.url, location.origin).protocol); }
      catch { return false; }
    }));
    document.dispatchEvent(new Event("olga:gallery-ready"));
    return () => { delete section.setGallery; attempt.current++; };
  }, []);

  useEffect(() => {
    const links = document.querySelectorAll("[data-gallery-link]");
    for (const link of links) link.hidden = photos.length === 0;
    return () => { for (const link of links) link.hidden = true; };
  }, [photos.length]);

  function cancelLoading() {
    attempt.current++;
    setLoading(false);
    setMessage("");
    opener.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!loading) return;
    const cancel = event => { if (event.key === "Escape") cancelLoading(); };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, [loading]);

  async function openPhoto(selected, button) {
    opener.current = button;
    if (Lightbox) { setIndex(selected); return; }
    const token = ++attempt.current;
    setLoading(true);
    setMessage("Открываем фотографию…");
    try {
      const module = await import("./GalleryLightbox");
      if (token !== attempt.current) return;
      setLightbox(() => module.default);
      setIndex(selected);
      setMessage("");
    } catch {
      if (token === attempt.current) setMessage("Не удалось открыть просмотр. Нажмите на фотографию ещё раз.");
    } finally {
      if (token === attempt.current) setLoading(false);
    }
  }
  const hasFeatured = photos.some(photo => photo.featured);
  return (
    <section ref={root} className="gallery section" id="gallery" aria-labelledby="gallery-title" hidden={!photos.length}>
      <div className="container">
        {children}
        <div className="gallery-grid" id="gallery-grid">
          {photos.map((photo, i) => (
            <GalleryTile key={photo.id} photo={photo} index={i} featured={photo.featured || (!hasFeatured && i === 0)} onOpen={openPhoto} />
          ))}
        </div>
        <p role="status" className="gallery-feedback">{message}</p>
        {loading && <button type="button" className="builder-contact" onClick={cancelLoading}>Отменить открытие</button>}
      </div>
      {Lightbox && index !== null && <Lightbox photos={photos} initialIndex={index} opener={opener.current} onClose={() => setIndex(null)} />}
    </section>
  );
}
