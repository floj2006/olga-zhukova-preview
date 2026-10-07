"use client";
import { lazy, Suspense, useEffect, useState } from "react";
const VercelMetrics = lazy(() => import("./VercelMetrics"));
const enabled =
  process.env.NEXT_PUBLIC_WEB_ANALYTICS === "true" ||
  process.env.NEXT_PUBLIC_SPEED_INSIGHTS === "true";
import { useReportWebVitals } from "next/web-vitals";
function emit(name, value) {
  document.dispatchEvent(
    new CustomEvent("olga:metric", { detail: { name, value } }),
  );
}
function vitals(metric) {
  emit("web_vital", {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
  });
}
export default function Telemetry() {
  useReportWebVitals(vitals);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    setAllowed(
      enabled && navigator.doNotTrack !== "1" && window.doNotTrack !== "1",
    );
  }, []);
  useEffect(() => {
    // Count completed UI transitions, not clicks that may fail validation.
    // Only fixed action names are emitted; contacts, dates and prices stay local.
    const action = (name) => emit("conversion", { action: name });
    const click = (event) => {
      if (event.target.closest?.('a[href^="tel:"]')) action("phone_click");
    };
    const step = (event) => {
      if (event.detail?.step === "date") action("calendar_open");
      if (event.detail?.step === "services") action("services_view");
    };
    const opened = (event) => {
      action("booking_open");
      step(event);
    };
    const request = () => action("request_open");
    const sent = () => action("lead_saved");
    const listeners = [
      ["click", click],
      ["olga:booking-opened", opened],
      ["olga:booking-step", step],
      ["olga:request-opened", request],
      ["olga:lead-saved", sent],
    ];
    for (const [name, handler] of listeners)
      document.addEventListener(name, handler);
    return () => {
      for (const [name, handler] of listeners)
        document.removeEventListener(name, handler);
    };
  }, []);
  return allowed ? (
    <Suspense fallback={null}>
      <VercelMetrics />
    </Suspense>
  ) : null;
}
