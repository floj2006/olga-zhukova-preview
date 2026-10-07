export default function PageIntroGrid({ eyebrow, title, accent, text, items = [] }) {
  return (
    <section className="page-intro-grid section">
      <div className="container page-intro-grid-layout">
        <div className="reveal">
          <p className="eyebrow"><span className="short-line" />{eyebrow}</p>
          <h2>{title}<br /><em>{accent}</em></h2>
        </div>
        <div className="page-intro-grid-copy reveal">
          <p className="body-copy page-intro-lead">{text}</p>
          <div className="page-intro-cards">
            {items.map((item, index) => (
              <article key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
