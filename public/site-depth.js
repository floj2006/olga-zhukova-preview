// Small pointer-driven depth for photos; native links keep their usual behavior.
const preference = matchMedia(
  "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 901px)",
);
let enabled = preference.matches;
const surfaces = [...document.querySelectorAll("[data-depth], .event-card")].filter(
  (surface) => !surface.closest('.editorial-formats'),
);
const pending = new Map();
let frame = 0;
function flush() {
  frame = 0;
  for (const [surface, { x, y }] of pending) {
    surface.style.setProperty("--depth-x", `${-y * 3}deg`);
    surface.style.setProperty("--depth-y", `${x * 4}deg`);
    surface.style.setProperty("--depth-lift", "-5px");
  }
  pending.clear();
}
function reset(surface) {
  pending.delete(surface);
  for (const property of ["--depth-x", "--depth-y", "--depth-lift"])
    surface.style.removeProperty(property);
}
for (const surface of surfaces) {
  surface.dataset.depth = "";
  surface.addEventListener(
    "pointermove",
    (event) => {
      if (!enabled || event.pointerType === "touch") return;
      const bounds = surface.getBoundingClientRect();
      const x = Math.max(
        -1,
        Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
      );
      const y = Math.max(
        -1,
        Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
      );
      pending.set(surface, { x, y });
      if (!frame) frame = requestAnimationFrame(flush);
    },
    { passive: true },
  );
  surface.addEventListener("pointerleave", () => reset(surface), {
    passive: true,
  });
}
preference.addEventListener("change", (event) => {
  enabled = event.matches;
  if (!enabled) {
    cancelAnimationFrame(frame);
    frame = 0;
    surfaces.forEach(reset);
  }
});
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(frame);
  frame = 0;
  surfaces.forEach(reset);
});
