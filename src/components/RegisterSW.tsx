"use client";

import { useEffect } from "react";

/** Registers the PWA service worker once on load. */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA install is a nice-to-have; never block the app on it.
      });
    }
  }, []);
  return null;
}
