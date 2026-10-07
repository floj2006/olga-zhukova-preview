"use client";
import { useBooking } from "../booking/BookingProvider";
import { safePublicLink } from "../../lib/public-link";
export default function Reviews() {
  const { catalog } = useBooking();
  const reviews = (catalog?.content?.reviews || []).filter((r) => r.published);
  return (
    <section
      id="reviews"
      className="section"
      aria-labelledby="reviews-title"
      hidden={!reviews.length}
    >
      <div className="container">
        <p className="eyebrow">ПОСЛЕ ПРАЗДНИКА</p>
        <h2 id="reviews-title">
          Слова, которые
          <br />
          <em>остаются.</em>
        </h2>
        <div id="review-list" className="review-list">
          {reviews.map((r, i) => (
            <blockquote key={i}>
              <p>{r.quote}</p>
              <footer>
                {[r.name, r.event].filter(Boolean).join(" · ")}
                {safePublicLink(r.source) && (
                  <a
                    href={safePublicLink(r.source)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {" "}
                    · Источник ↗
                  </a>
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
