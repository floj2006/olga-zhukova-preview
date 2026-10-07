// Progressive enhancement: all four formats remain available without JavaScript.
const gallery = document.querySelector(".editorial-formats");
const cards = [...gallery.querySelectorAll(".event-card")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const tabs = document.createElement("div");
tabs.className = "format-tabs";
tabs.setAttribute("role", "tablist");
tabs.setAttribute("aria-label", "Формат мероприятия");
const panels = cards.map((card, index) => {
  const panel = document.createElement("div");
  panel.id = `format-panel-${index}`;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `format-tab-${index}`);
  card.classList.remove("reveal");
  card.classList.add("visible");
  card.before(panel);
  panel.append(card);
  const tab = document.createElement("button");
  tab.id = `format-tab-${index}`;
  tab.type = "button";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", panel.id);
  tab.textContent = card.querySelector("h3").firstChild.textContent.trim();
  tab.addEventListener("click", () => select(index));
  tab.addEventListener("keydown", event => {
    const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: cards.length - 1 - index };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = (index + offsets[event.key] + cards.length) % cards.length;
    select(next);
    tabs.children[next].focus({ preventScroll: true });
  });
  tabs.append(tab);
  return panel;
});
function select(index) {
  panels.forEach((panel, i) => {
    panel.getAnimations().forEach(animation => animation.cancel());
    panel.hidden = i !== index;
    tabs.children[i].setAttribute("aria-selected", String(i === index));
    tabs.children[i].tabIndex = i === index ? 0 : -1;
  });
  if (!reduced.matches) panels[index].animate(
    [{ opacity: .35, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 350, easing: "cubic-bezier(.22,1,.36,1)" },
  );
}
reduced.addEventListener("change", () => {
  if (reduced.matches) panels.forEach(panel => panel.getAnimations().forEach(animation => animation.cancel()));
});
gallery.before(tabs);
gallery.classList.add("formats-ready");
select(0);
