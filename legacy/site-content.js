import { loadCatalog } from "./catalog-store.js";
const safe = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
  } catch {
    return "";
  }
};
try {
  const { catalog } = await loadCatalog();
  const c = catalog.content;
  if (c?.videoUrl && safe(c.videoUrl)) {
    document.querySelector("#showreel-link").href = safe(c.videoUrl);
    document.querySelector("#showreel-caption").textContent =
      c.videoCaption || "";
    document.querySelector("#showreel").hidden = false;
  }
  const reviews = (c?.reviews || []).filter((r) => r.published);
  for (const review of reviews) {
    const block = document.createElement("blockquote"),
      quote = document.createElement("p"),
      footer = document.createElement("footer");
    quote.textContent = review.quote;
    footer.textContent = [review.name, review.event]
      .filter(Boolean)
      .join(" · ");
    if (safe(review.source)) {
      const a = document.createElement("a");
      a.href = safe(review.source);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = " · Источник ↗";
      footer.append(a);
    }
    block.append(quote, footer);
    document.querySelector("#review-list").append(block);
  }
  document.querySelector("#reviews").hidden = !reviews.length;
} catch {
  /* Unpublished or unavailable proof must not be replaced with fabricated content. */
}
