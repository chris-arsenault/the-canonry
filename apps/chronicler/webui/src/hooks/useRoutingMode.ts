/**
 * Routing mode context for WikiExplorer.
 *
 * "hash" mode uses #/page/{id} URLs (for Canonry shell embedding).
 * "path" mode uses /page/{id} URLs (for the public viewer site, enabling OG tags).
 */

import { createContext, useContext } from "react";

export type RoutingMode = "hash" | "path";

export const RoutingModeContext = createContext<RoutingMode>("hash");

export function useRoutingMode(): RoutingMode {
  return useContext(RoutingModeContext);
}

export function parsePageId(mode: RoutingMode): string | null {
  if (mode === "hash") {
    const hash = window.location.hash;
    if (!hash || hash === "#/" || hash === "#") return null;
    const match = hash.match(/^#\/page\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }
  const path = window.location.pathname;
  if (path === "/" || path === "") return null;
  const match = path.match(/^\/page\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function buildPageUrl(mode: RoutingMode, pageId: string | null): string {
  if (!pageId) return mode === "hash" ? "#/" : "/";
  const encoded = pageId.split("/").map((s) => encodeURIComponent(s)).join("/");
  return mode === "hash" ? `#/page/${encoded}` : `/page/${encoded}`;
}

export function currentLocation(mode: RoutingMode): string {
  return mode === "hash" ? window.location.hash : window.location.pathname;
}

export function navigateTo(mode: RoutingMode, url: string): void {
  if (mode === "hash") {
    window.location.hash = url;
  } else {
    window.history.pushState(null, "", url);
  }
}

/** Event name to listen for URL changes. */
export function navigationEvent(mode: RoutingMode): string {
  return mode === "hash" ? "hashchange" : "popstate";
}

/** Link prefix for detecting wiki links in rendered markdown. */
export function linkPrefix(mode: RoutingMode): string {
  return mode === "hash" ? "#/page/" : "/page/";
}
