"use client";
import { useEffect } from "react";
// The admin controller stays unchanged. Public navigation, focus and motion are
// React-owned; GalleryDataBridge uses the provider catalogue without a second fetch.
export default function PageScripts({ admin = false }) {
  useEffect(() => {
    const files = admin ? ["/admin/admin.js"] : [];
    const owned = [];
    for (const src of files) {
      if (document.querySelector('script[data-controller="' + src + '"]'))
        continue;
      const script = document.createElement("script");
      script.type = "module";
      script.src = src;
      script.async = false;
      script.dataset.controller = src;
      document.body.append(script);
      owned.push(script);
    }
    return () => {
      for (const script of owned) script.remove();
    };
  }, [admin]);
  return null;
}
