/**
 * Style Library Repository — Dexie-backed style library storage
 */

import { db } from './illuminatorDb';
import type { StyleLibraryRecord } from './illuminatorDb';
import { createDefaultStyleLibrary } from '@canonry/world-schema';
import type { StyleLibrary, ArtisticStyle, CompositionStyle } from '@canonry/world-schema';

export type { StyleLibrary, ArtisticStyle, CompositionStyle };

const LIBRARY_KEY = 'current';

export async function loadStyleLibrary(): Promise<StyleLibrary | null> {
  const result = await db.styleLibrary.get(LIBRARY_KEY);
  return result?.library ?? null;
}

export async function saveStyleLibrary(library: StyleLibrary): Promise<void> {
  const record: StyleLibraryRecord = {
    id: LIBRARY_KEY,
    library,
    savedAt: Date.now(),
  };
  await db.styleLibrary.put(record);
}

export async function resetStyleLibrary(): Promise<void> {
  await db.styleLibrary.delete(LIBRARY_KEY);
}

export async function getStyleLibrary(): Promise<StyleLibrary> {
  const stored = await loadStyleLibrary();
  if (stored) return stored;
  return createDefaultStyleLibrary();
}

export async function hasCustomStyleLibrary(): Promise<boolean> {
  const stored = await loadStyleLibrary();
  return stored !== null;
}
