/**
 * useImageGenSettings - Global image generation settings hook
 *
 * Centralizes all image generation preferences (style, composition, palette,
 * size, quality, culture) in localStorage so they persist across tab navigation
 * and page refresh. Used by the ImageSettingsDrawer and consumed by
 * EntityBrowser, ChroniclePanel, and worker tasks.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ImageGenSettings {
  artisticStyleId: string;
  compositionStyleId: string;
  colorPaletteId: string;
  imageSize: string;
  imageQuality: string;
  selectedCultureId: string;
  collapsedSections: string[];
}

const STORAGE_KEY = 'illuminator:imageGenSettings';
const LEGACY_STYLE_KEY = 'illuminator:styleSelection';

const DEFAULTS: ImageGenSettings = {
  artisticStyleId: 'random',
  compositionStyleId: 'random',
  colorPaletteId: 'random',
  imageSize: 'auto',
  imageQuality: 'auto',
  selectedCultureId: '',
  collapsedSections: [],
};

function loadSettings(): ImageGenSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULTS, ...JSON.parse(saved) };
    }

    // Migrate from legacy styleSelection key
    const legacyStyle = localStorage.getItem(LEGACY_STYLE_KEY);
    if (legacyStyle) {
      const parsed = JSON.parse(legacyStyle);
      const migrated: ImageGenSettings = {
        ...DEFAULTS,
        artisticStyleId: parsed.artisticStyleId || DEFAULTS.artisticStyleId,
        compositionStyleId: parsed.compositionStyleId || DEFAULTS.compositionStyleId,
        colorPaletteId: parsed.colorPaletteId || DEFAULTS.colorPaletteId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}

  return DEFAULTS;
}

function saveSettings(settings: ImageGenSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export type ImageGenSettingsUpdater = (partial: Partial<ImageGenSettings>) => void;

/**
 * Hook providing global image generation settings backed by localStorage.
 *
 * Optional external sync: if onExternalSync is provided, changes are
 * also forwarded there (for syncing with parent shell).
 */
export function useImageGenSettings(
  onExternalSync?: (settings: ImageGenSettings) => void,
): [ImageGenSettings, ImageGenSettingsUpdater] {
  const [settings, setSettings] = useState<ImageGenSettings>(loadSettings);
  const externalSyncRef = useRef(onExternalSync);
  externalSyncRef.current = onExternalSync;

  const updateSettings = useCallback((partial: Partial<ImageGenSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  // Defer localStorage write and external sync to after render
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    saveSettings(settings);
    if (externalSyncRef.current) {
      externalSyncRef.current(settings);
    }
  }, [settings]);

  return [settings, updateSettings];
}
