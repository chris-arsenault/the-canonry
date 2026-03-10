/**
 * useCatalog — Loads image catalog with inline-first strategy.
 *
 * 1. Reads inline catalog from <script id="initial-catalog"> (injected at deploy time)
 *    — provides first 50 images + all facets with zero network latency.
 * 2. Background-fetches the full catalog.json from CDN.
 * 3. When full catalog arrives, replaces the inline subset seamlessly.
 *
 * In dev mode (no inline data), falls back to fetch-only with no loading spinner.
 */

import { useState, useEffect } from "react";
import type { ImageCatalog } from "./types";

const CATALOG_URL =
  import.meta.env.VITE_CATALOG_URL || "/catalog.json";

/** Parse the inline catalog script tag (runs once at module load). */
function readInlineCatalog(): ImageCatalog | null {
  try {
    const el = document.getElementById("initial-catalog");
    if (!el?.textContent) return null;
    return JSON.parse(el.textContent) as ImageCatalog;
  } catch {
    return null;
  }
}

const INLINE_CATALOG = readInlineCatalog();

export function useCatalog() {
  const [catalog, setCatalog] = useState<ImageCatalog | null>(INLINE_CATALOG);
  const [loading, setLoading] = useState(!INLINE_CATALOG);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(CATALOG_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ImageCatalog;
        if (!cancelled) {
          setCatalog(data);
          setError(null);
        }
      } catch (e) {
        // Only surface the error if we have no inline data to fall back on
        if (!cancelled && !INLINE_CATALOG) {
          setError(e instanceof Error ? e.message : "Failed to load catalog");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error };
}
