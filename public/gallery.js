import { loadCatalog } from "./catalog-store.js";
// Share the existing catalog request with pricing; React owns the gallery DOM.
let photos;
const publish = () => {
  if (photos) document.querySelector("#gallery")?.setGallery?.(photos);
};
document.addEventListener("olga:gallery-ready", publish);
try {
  const { catalog } = await loadCatalog();
  photos = Array.isArray(catalog.gallery) ? catalog.gallery : [];
  publish();
} catch {
  // Unavailable galleries stay hidden; no placeholder portfolio is published.
}
