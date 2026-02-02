/**
 * useStyleLibrary Hook
 *
 * Manages loading and saving the style library from IndexedDB.
 * Loads defaults from world-schema if no custom library exists.
 */

import { useState, useEffect, useCallback } from 'react';
import { createDefaultStyleLibrary } from '@canonry/world-schema';
import type { StyleLibrary, ArtisticStyle, CompositionStyle, NarrativeStyle } from '@canonry/world-schema';
import {
  loadStyleLibrary,
  saveStyleLibrary,
  resetStyleLibrary,
} from '../lib/db/styleRepository';

export interface UseStyleLibraryReturn {
  /** Current style library */
  styleLibrary: StyleLibrary;
  /** Whether the library is still loading */
  loading: boolean;
  /** Whether using custom (saved) library vs defaults */
  isCustom: boolean;
  /** Save the entire library */
  save: (library: StyleLibrary) => Promise<void>;
  /** Reset to defaults (deletes custom library) */
  reset: () => Promise<void>;
  /** Add a new artistic style */
  addArtisticStyle: (style: ArtisticStyle) => Promise<void>;
  /** Update an artistic style */
  updateArtisticStyle: (id: string, updates: Partial<ArtisticStyle>) => Promise<void>;
  /** Delete an artistic style */
  deleteArtisticStyle: (id: string) => Promise<void>;
  /** Add a new composition style */
  addCompositionStyle: (style: CompositionStyle) => Promise<void>;
  /** Update a composition style */
  updateCompositionStyle: (id: string, updates: Partial<CompositionStyle>) => Promise<void>;
  /** Delete a composition style */
  deleteCompositionStyle: (id: string) => Promise<void>;
  /** Add a new narrative style */
  addNarrativeStyle: (style: NarrativeStyle) => Promise<void>;
  /** Update a narrative style */
  updateNarrativeStyle: (id: string, updates: Partial<NarrativeStyle>) => Promise<void>;
  /** Delete a narrative style */
  deleteNarrativeStyle: (id: string) => Promise<void>;
}

export function useStyleLibrary(): UseStyleLibraryReturn {
  const [styleLibrary, setStyleLibrary] = useState<StyleLibrary>(() => createDefaultStyleLibrary());
  const [loading, setLoading] = useState(true);
  const [isCustom, setIsCustom] = useState(false);

  // Load style library on mount
  useEffect(() => {
    async function load() {
      try {
        const stored = await loadStyleLibrary();
        if (stored) {
          setStyleLibrary(stored);
          setIsCustom(true);
        } else {
          setStyleLibrary(createDefaultStyleLibrary());
          setIsCustom(false);
        }
      } catch (err) {
        console.error('[useStyleLibrary] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Save entire library
  const save = useCallback(async (library: StyleLibrary) => {
    await saveStyleLibrary(library);
    setStyleLibrary(library);
    setIsCustom(true);
  }, []);

  // Reset to defaults
  const reset = useCallback(async () => {
    await resetStyleLibrary();
    setStyleLibrary(createDefaultStyleLibrary());
    setIsCustom(false);
  }, []);

  // Add artistic style
  const addArtisticStyle = useCallback(async (style: ArtisticStyle) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      artisticStyles: [...styleLibrary.artisticStyles, style],
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Update artistic style
  const updateArtisticStyle = useCallback(async (id: string, updates: Partial<ArtisticStyle>) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      artisticStyles: styleLibrary.artisticStyles.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Delete artistic style
  const deleteArtisticStyle = useCallback(async (id: string) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      artisticStyles: styleLibrary.artisticStyles.filter((s) => s.id !== id),
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Add composition style
  const addCompositionStyle = useCallback(async (style: CompositionStyle) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      compositionStyles: [...styleLibrary.compositionStyles, style],
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Update composition style
  const updateCompositionStyle = useCallback(async (id: string, updates: Partial<CompositionStyle>) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      compositionStyles: styleLibrary.compositionStyles.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Delete composition style
  const deleteCompositionStyle = useCallback(async (id: string) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      compositionStyles: styleLibrary.compositionStyles.filter((s) => s.id !== id),
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Add narrative style
  const addNarrativeStyle = useCallback(async (style: NarrativeStyle) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      narrativeStyles: [...styleLibrary.narrativeStyles, style],
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Update narrative style
  const updateNarrativeStyle = useCallback(async (id: string, updates: Partial<NarrativeStyle>) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      narrativeStyles: styleLibrary.narrativeStyles.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    };
    await save(updated);
  }, [styleLibrary, save]);

  // Delete narrative style
  const deleteNarrativeStyle = useCallback(async (id: string) => {
    const updated: StyleLibrary = {
      ...styleLibrary,
      narrativeStyles: styleLibrary.narrativeStyles.filter((s) => s.id !== id),
    };
    await save(updated);
  }, [styleLibrary, save]);

  return {
    styleLibrary,
    loading,
    isCustom,
    save,
    reset,
    addArtisticStyle,
    updateArtisticStyle,
    deleteArtisticStyle,
    addCompositionStyle,
    updateCompositionStyle,
    deleteCompositionStyle,
    addNarrativeStyle,
    updateNarrativeStyle,
    deleteNarrativeStyle,
  };
}
