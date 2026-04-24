/**
 * useViewerPreferences — Viewer-level display preferences stored in localStorage.
 *
 * These take precedence over per-page layout overrides from Illuminator.
 * Precedence: viewer preference > chronicle override > engine default.
 *
 * "default" means no viewer override — fall through to the next level.
 */

import { useState, useCallback } from "react";
import type { AnnotationDisplay, AnnotationPosition, ImageLayout } from "../types/world.ts";

const STORAGE_KEY = "chronicler-viewer-preferences";

export interface ViewerPreferences {
  annotationDisplay: AnnotationDisplay | "default";
  annotationPosition: AnnotationPosition | "default";
  imageLayout: ImageLayout | "default";
}

const DEFAULTS: ViewerPreferences = {
  annotationDisplay: "default",
  annotationPosition: "default",
  imageLayout: "default",
};

function load(): ViewerPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ViewerPreferences>;
    return {
      annotationDisplay: parsed.annotationDisplay ?? "default",
      annotationPosition: parsed.annotationPosition ?? "default",
      imageLayout: parsed.imageLayout ?? "default",
    };
  } catch {
    return DEFAULTS;
  }
}

function save(prefs: ViewerPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function useViewerPreferences() {
  const [prefs, setPrefs] = useState<ViewerPreferences>(load);

  const update = useCallback(<K extends keyof ViewerPreferences>(
    field: K,
    value: ViewerPreferences[K],
  ) => {
    setPrefs((prev) => {
      const next = { ...prev, [field]: value };
      save(next);
      return next;
    });
  }, []);

  return { prefs, update };
}
