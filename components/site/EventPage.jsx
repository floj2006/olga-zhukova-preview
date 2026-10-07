import PageHero from "./PageHero";
import Contact from "./Contact";
import { eventPages } from "../../lib/event-pages";

function EventImage({ image, className = "", portrait = false }) {
  return (
    <figure className={"event-editorial-image " + className}>
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
      />
      <figcaption>
        {portrait ? "Ольга Жукова · ведущая" : "Образ атмосферы"}
      </figcaption>
    </figure>
  );
}

function FactList({ facts }) {
  return (
    <dl className="event-editorial-facts">
      {facts.map((fact, index) => (
        <div key={fact.label}>
          <dt>
            <span className="event-editorial-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {fact.label}
          </dt>
          <dd>{fact.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function EventIntro({ event }) {
  return (
    <section
      className="event-editorial-intro section"
      aria-labelledby="event-intro-title"
    >
      <div className="container event-editorial-intro-grid">
        {event.portrait ? (
          <EventImage
            image={event.portrait}
            className="event-intro-portrait reveal"
            portrait
          />
        ) : null}
        <div className="event-editorial-intro-heading reveal">
          <p className="eyebrow">
            <span className="short-line" aria-hidden="true" />
            ПОДХОД К ВЕЧЕРУ
          </p>
          <h2 id="event-intro-title">
            {event.manifestoTitle}
            <br />
            <em>{event.manifestoAccent}</em>
          </h2>
        </div>
        <p className="event-editorial-lead reveal">{event.manifesto}</p>
        <FactList facts={event.facts} />
      </div>
    </section>
  );
}

function ChapterCopy({ chapter, index }) {
  return (
    <div className="event-editorial-chapter-copy">
      <p className="event-editorial-kicker">
        <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        {chapter.kicker}
      </p>
      <h3>{chapter.title}</h3>
      <p>{chapter.text}</p>
    </div>
  );
}

function WeddingStory({ event }) {
  return (
    <div className="event-story-wedding">
      {event.chapters.map((chapter, index) => (
        <article
          className={
            "event-wedding-chapter event-wedding-chapter-" +
            (index + 1) +
            " reveal"
          }
          key={chapter.title}
        >
          <EventImage image={chapter.image} portrait={index === 0} />
          <ChapterCopy chapter={chapter} index={index} />
        </article>
      ))}
    </div>
  );
}

function CorporateStory({ event }) {
  return (
    <div className="event-story-corporate">
      <ol className="event-corporate-agenda">
        {event.chapters.map((chapter, index) => (
          <li className="reveal" key={chapter.title}>
            <ChapterCopy chapter={chapter} index={index} />
          </li>
        ))}
      </ol>
      <EventImage
        image={event.scenarioImage}
        className="event-corporate-visual reveal"
      />
    </div>
  );
}

function AnniversaryStory({ event }) {
  return (
    <div className="event-story-anniversary">
      <div className="event-anniversary-stories">
        {event.chapters.map((chapter, index) => (
          <article className="reveal" key={chapter.title}>
            <ChapterCopy chapter={chapter} index={index} />
          </article>
        ))}
      </div>
      <EventImage
        image={event.scenarioImage}
        className="event-anniversary-visual reveal"
      />
    </div>
  );
}

function GraduationStory({ event }) {
  return (
    <div className="event-story-graduation">
      {event.chapters.map((chapter, index) => (
        <article
          className="event-graduation-chapter reveal"
          key={chapter.title}
        >
          <span className="event-graduation-number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <EventImage image={chapter.image} />
          <ChapterCopy chapter={chapter} index={index} />
        </article>
      ))}
    </div>
  );
}

const stories = {
  wedding: WeddingStory,
  corporate: CorporateStory,
  anniversary: AnniversaryStory,
  graduation: GraduationStory,
};

export default function EventPage({ event }) {
  const Story = stories[event.type];
  return (
    <div className="event-detail">
      <PageHero
        eyebrow={event.eyebrow}
        title={event.title}
        accent={event.accent}
        description={event.description}
        image={event.heroImage}
        imageAlt={event.heroAlt}
        imageWidth={event.heroWidth}
        imageHeight={event.heroHeight}
        imageCaption={event.heroCaption}
        number={event.number}
        variant={event.type}
        primaryHref="/services#calculator"
        primaryLabel="Узнать стоимость"
        primaryEvent={event.type}
        primaryDiscuss
        secondaryHref="#scenario"
        secondaryLabel="Как проходит вечер"
        note={event.note}
      />
      <nav className="event-format-nav" aria-label="Форматы мероприятий">
        <div className="container event-format-nav-inner">
          <a className="event-format-all" href="/events">
            Все форматы
          </a>
          <div className="event-format-links">
            {Object.values(eventPages).map((format) => (
              <a
                href={"/events/" + format.type}
                key={format.type}
                aria-current={format.type === event.type ? "page" : undefined}
              >
                <span aria-hidden="true">{format.number}</span>
                {format.label}
              </a>
            ))}
          </div>
        </div>
      </nav>
      <EventIntro event={event} />
      <section
        className="event-editorial-scenario section"
        id="scenario"
        aria-labelledby="event-scenario-title"
      >
        <div className="container">
          <header className="event-editorial-scenario-heading reveal">
            <div>
              <p className="eyebrow">
                <span className="short-line" aria-hidden="true" />
                КАК ПРОХОДИТ ВЕЧЕР
              </p>
              <h2 id="event-scenario-title">
                {event.scenarioTitle}
                <br />
                <em>{event.scenarioAccent}</em>
              </h2>
            </div>
            <p>{event.scenarioIntro}</p>
          </header>
          <Story event={event} />
        </div>
      </section>
      <section
        className="event-editorial-package section"
        aria-labelledby="event-preparation-title"
      >
        <div className="container event-editorial-package-grid">
          <div className="event-editorial-package-heading reveal">
            <p className="eyebrow">
              <span className="short-line" aria-hidden="true" />
              ПОДГОТОВКА И ВЕДЕНИЕ
            </p>
            <h2 id="event-preparation-title">
              {event.packageTitle}
              <br />
              <em>{event.packageAccent}</em>
            </h2>
          </div>
          <div className="event-editorial-package-body reveal">
            <ol className="event-editorial-package-list">
              {event.includes.map((item, index) => (
                <li key={item}>
                  <span aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
            <p className="event-editorial-options">{event.options}</p>
            <div className="event-editorial-package-actions">
              <p>{event.closing}</p>
              <a
                className="button"
                href="/services#calculator"
                data-discuss=""
                data-event={event.type}
              >
                Узнать стоимость
                <svg className="icon" aria-hidden="true">
                  <use href="#arrow" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
      <Contact eventType={event.type} />
    </div>
  );
}
