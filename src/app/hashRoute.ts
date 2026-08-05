import { useSyncExternalStore } from "react";

const defaultRoute = "/cases/organisation";

export function getHashRoute() {
  if (typeof window === "undefined") {
    return defaultRoute;
  }

  const value = window.location.hash.replace(/^#/, "");
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

export function pushHashRoute(path: string) {
  if (getHashRoute() === path) {
    return;
  }

  window.history.pushState(null, "", `#${path}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

