export default function PageHero({
  eyebrow,
  title,
  accent,
  description,
  image,
  imageAlt,
  number,
  primaryHref = "/services#calculator",
  primaryLabel = "Узнать стоимость",
  primaryEvent,
  primaryDiscuss = true,
  primaryBooking,
  secondaryHref,
  secondaryLabel,
  note,
  variant = "",
  imageWidth,
  imageHeight,
  imageCaption,
}) {
  const portrait = image?.includes("olga-");
  const width =
    imageWidth || (portrait ? 1024 : image?.includes("1536") ? 1536 : 1000);
  const height = imageHeight || (portrait ? 1536 : Math.round((width * 2) / 3));
  const srcSet = portrait
    ? "/images/olga-480.webp 480w, /images/olga-768.webp 768w, /images/olga-1024.webp 1024w"
    : image?.includes("1536")
      ? image.replace("1536", "768") + " 768w, " + image + " 1536w"
      : undefined;
  return (
    <section
      className={"inner-hero " + (variant ? "inner-hero--" + variant : "")}
      id="top"
      aria-labelledby="inner-hero-title"
    >
      <div className="inner-hero-grid container">
        <div className="inner-hero-copy">
          <p className="eyebrow inner-hero-eyebrow">
            <span className="short-line" />
            {eyebrow}
          </p>
          <span className="inner-hero-index" aria-hidden="true">
            {number}
          </span>
          <h1 id="inner-hero-title" data-editorial-entrance>
            {title}
            {accent ? (
              <>
                <br />
                <em>{accent}</em>
              </>
            ) : null}
          </h1>
          <p className="inner-hero-description">{description}</p>
          <div className="inner-hero-actions">
            <a
              className="button"
              href={primaryHref}
              {...((primaryBooking ?? primaryDiscuss)
                ? { "data-discuss": "" }
                : {})}
              {...(primaryEvent ? { "data-event": primaryEvent } : {})}
            >
              {primaryLabel}
              <svg className="icon" aria-hidden="true">
                <use href="#arrow" />
              </svg>
            </a>
            {secondaryHref && secondaryLabel ? (
              <a className="text-link" href={secondaryHref}>
                {secondaryLabel}
                <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
          {note ? <p className="inner-hero-note">{note}</p> : null}
        </div>
        <figure
          className={
            "inner-hero-media" + (portrait ? " inner-hero-media--portrait" : "")
          }
        >
          <img
            src={image}
            srcSet={srcSet}
            sizes="(max-width: 700px) 100vw, (max-width: 1200px) 48vw, 620px"
            alt={imageAlt}
            width={width}
            height={height}
            fetchPriority="high"
          />
          <figcaption>
            <span>{number}</span>
            <span>
              {imageCaption ||
                (portrait
                  ? "ОЛЬГА ЖУКОВА · ВЕДУЩАЯ"
                  : "ЛЮДИ · НАСТРОЕНИЕ · ДЕТАЛИ")}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
