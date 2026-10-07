"use client";
import { useEffect } from "react";
import { initializeMetrics } from "../public/metrics-loader";
import { redactAnalytics } from "../lib/analytics";
export default function VercelMetrics() {
  useEffect(
    () =>
      initializeMetrics({
        web: process.env.NEXT_PUBLIC_WEB_ANALYTICS === "true",
        speed: process.env.NEXT_PUBLIC_SPEED_INSIGHTS === "true",
        conversions: process.env.NEXT_PUBLIC_CONVERSION_ANALYTICS === "true",
        beforeSend: redactAnalytics,
      }),
    [],
  );
  return null;
}
