/**
 * useCatalog — Loads catalog.json from CDN on mount.
 *
 * The catalog URL is derived from the page origin (same CDN) unless
 * overridden via VITE_CATALOG_URL env variable.
 */

import { useState, useEffect } from "react";
import type { ImageCatalog } from "./types";

const CATALOG_URL =
  import.meta.env.VITE_CATALOG_URL || "/canonry/catalog.json";

export function useCatalog() {
  const [catalog, setCatalog] = useState<ImageCatalog | null>(null);
  const [loading, setLoading] = useState(true);
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
        if (!cancelled) {
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
