"use client";
import { useEffect } from "react";

export default function PublicMotion() {
  useEffect(() => {
    const root = document.querySelector(".public-site main");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet();
    const animations = new Set();
    let observer;

    function reveal(node) {
      if (seen.has(node)) return;
      seen.add(node);
      if (reduced.matches || typeof node.animate !== "function") return;
      // Opacity only: text, grids and their descendants never change position.
      const animation = node.animate([{ opacity: 0.72 }, { opacity: 1 }], {
        duration: 420,
        easing: "cubic-bezier(.22,1,.36,1)",
      });
      animations.add(animation);
      animation.finished
        .catch(() => {})
        .finally(() => animations.delete(animation));
    }
    function setup() {
      const nodes = root.querySelectorAll(".reveal,[data-editorial-reveal]");
      // Never hide content that the visitor already saw, including hash landings.
      for (const node of nodes)
        if (node.getBoundingClientRect().top <= innerHeight + 80)
          seen.add(node);
      if (reduced.matches || !("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        },
        { threshold: 0, rootMargin: "0px 0px 80px 0px" },
      );
      for (const node of nodes) if (!seen.has(node)) observer.observe(node);
    }
    function stop() {
      observer?.disconnect();
      for (const animation of animations) animation.cancel();
      animations.clear();
    }
    function change() {
      stop();
      setup();
    }
    function anchor(event) {
      const link = event.target.closest?.('a[href^="#"]');
      if (
        !link ||
        link.hasAttribute("data-discuss") ||
        link.hasAttribute("data-check-date")
      )
        return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target || target.hidden) return;
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
    setup();
    reduced.addEventListener("change", change);
    root.addEventListener("click", anchor);
    return () => {
      stop();
      reduced.removeEventListener("change", change);
      root.removeEventListener("click", anchor);
    };
  }, []);
  return null;
}
