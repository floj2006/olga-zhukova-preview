"use client";
import { useBooking } from "../booking/BookingProvider";
import { safePublicLink } from "../../lib/public-link";
export default function Materials() {
  const { catalog } = useBooking();
  const content = catalog?.content;
  const video = safePublicLink(content?.videoUrl);
  return (
    <>
      <section
        id="showreel"
        className="section"
        aria-labelledby="showreel-title"
        hidden={!video}
      >
        <div className="container">
          <p className="eyebrow">В РИТМЕ СОБЫТИЯ</p>
          <h2 id="showreel-title">
            Посмотрите,
            <br />
            <em>как это бывает.</em>
          </h2>
          <p id="showreel-caption" className="body-copy">
            {content?.videoCaption || ""}
          </p>
          <a
            id="showreel-link"
            href={video || undefined}
            className="button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Смотреть видео ↗
          </a>
        </div>
      </section>
    </>
  );
}
