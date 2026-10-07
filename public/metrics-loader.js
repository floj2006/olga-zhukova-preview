// Native Vercel script/queue API, loaded only when the owner enables it.
// Reference: vercel/analytics and vercel/speed-insights, packages/web/src/generic.ts.
import { conversionActions as actions } from "./metric-actions.js";
export function initializeMetrics({
  web = false,
  speed = false,
  conversions = false,
  beforeSend,
}) {
  if (
    ![
      "/",
      "/about",
      "/events",
      "/events/wedding",
      "/events/corporate",
      "/events/anniversary",
      "/events/graduation",
      "/portfolio",
      "/services",
      "/contacts",
    ].includes(location.pathname) ||
    navigator.doNotTrack === "1" ||
    window.doNotTrack === "1"
  )
    return () => {};
  function attach(api, queue, path, attributes = {}) {
    if (!window[api])
      window[api] = (...args) => {
        const pending = (window[queue] ||= []);
        if (pending.length < 50) pending.push(args);
      };
    window[api]("beforeSend", beforeSend);
    if (document.querySelector('script[src="' + path + '"]')) return;
    const script = document.createElement("script");
    script.src = path;
    script.defer = true;
    Object.assign(script.dataset, attributes);
    script.onerror = () => {
      window[api]("beforeSend", () => null);
      document.dispatchEvent(
        new CustomEvent("olga:analytics-unavailable", {
          detail: { service: api },
        }),
      );
    };
    document.head.append(script);
  }
  if (web) {
    window.vam = "production";
    attach("va", "vaq", "/_vercel/insights/script.js", { debug: "false" });
  }
  if (speed)
    attach("si", "siq", "/_vercel/speed-insights/script.js", {
      sampleRate: "0.1",
      route: location.pathname,
      debug: "false",
    });
  const handle = (event) => {
    const name =
      event.detail?.name === "conversion" ? event.detail.value?.action : null;
    if (web && conversions && actions.has(name)) window.va?.("event", { name });
  };
  document.addEventListener("olga:metric", handle);
  return () => {
    document.removeEventListener("olga:metric", handle);
    // Strict Mode can mount again; keep the loaded scripts and replace the
    // middleware on re-entry. Events after unmount must not be collected.
    if (web) window.va?.("beforeSend", () => null);
    if (speed) window.si?.("beforeSend", () => null);
  };
}
