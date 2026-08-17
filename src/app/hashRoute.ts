import { useSyncExternalStore } from "react";

const defaultRoute = "/control-room";

export function getHashRoute() {
  if (typeof window === "undefined") {
    return defaultRoute;
  }

  const value = window.location.hash.replace(/^#/, "").split("?", 1)[0] ?? "";
  return value.startsWith("/") ? value : defaultRoute;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

export function useHashRoute() {
  return useSyncExternalStore(subscribe, getHashRoute, () => defaultRoute);
}

export function replaceHashRoute(path: string) {
  if (typeof window === "undefined" || getHashRoute() === path) {
    return;
  }

  window.history.replaceState(null, "", `#${path}`);
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

/**
 * Cross-fade a route change using the platform's own View Transitions, when the
 * browser has them and the reader has not asked for reduced motion.
 *
 * This is deliberately not the `AnimatePresence` approach the route wrapper
 * documents as unworkable. That needed `mode="wait"`, which keeps the outgoing
 * route mounted until its exit finishes — two `<main id="main-content">`
 * landmarks in the document at once, and a navigation that stalls whenever
 * animation frames are throttled, such as in a background tab. A view
 * transition snapshots the old frame instead of keeping it mounted, so neither
 * problem arises: the DOM swap is still synchronous.
 *
 * Everything here degrades to a plain swap. If the API is missing, or reduced
 * motion is set, the callback simply runs.
 */
function withViewTransition(update: () => void) {
  const doc = document as ViewTransitionDocument;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  if (typeof doc.startViewTransition !== "function" || prefersReducedMotion) {
    update();
    return;
  }

  doc.startViewTransition(update);
}

export function pushHashRoute(path: string) {
  if (getHashRoute() === path) {
    return;
  }

  withViewTransition(() => {
    window.history.pushState(null, "", `#${path}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
