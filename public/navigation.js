// One scheduled update per frame, including layout changes after gallery loading.
const links = [...document.querySelectorAll('.desktop-nav a[href^="#"], .mobile-menu a[href^="#"], .footer nav a[href^="#"]')];
const sections = [...document.querySelectorAll("main > section[id]")];
const header = document.querySelector(".header-inner");
let frame = 0;
function update() {
  frame = 0;
  const boundary = header.getBoundingClientRect().height + 110;
  let current = "";
  for (const section of sections) {
    if (!section.hidden && section.getBoundingClientRect().top <= boundary) current = `#${section.id}`;
  }
  for (const link of links) {
    if (!link.hidden && link.hash === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
function schedule() { if (!frame) frame = requestAnimationFrame(update); }
window.addEventListener("scroll", schedule, { passive: true });
window.addEventListener("resize", schedule, { passive: true });
window.addEventListener("pageshow", schedule);
if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(document.querySelector("main"));
// Preserve native anchors and URL history while moving keyboard focus to the destination.
for (const link of links) link.addEventListener("click", () => {
  const target = document.getElementById(link.hash.slice(1));
  if (!target || target.hidden) return;
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
});
schedule();
