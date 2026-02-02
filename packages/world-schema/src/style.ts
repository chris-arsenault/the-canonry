/**
 * Style Library Types
 *
 * Defines artistic styles, composition styles for image generation,
 * and narrative styles for chronicle generation.
 * Styles are stored in project config and referenced by cultures for defaults.
 *
 * This file re-exports from the split style modules and provides
 * the StyleLibrary interface and helper functions.
 */

// =============================================================================
// Re-export from split modules
// =============================================================================

// Artistic Styles (image rendering approaches)
export type { ArtisticStyle, ArtisticStyleCategory } from './artisticStyles.js';
export { DEFAULT_ARTISTIC_STYLES } from './artisticStyles.js';

// Composition Styles (framing and visual arrangement)
export type { CompositionStyle, CompositionCategory } from './compositionStyles.js';
export { DEFAULT_COMPOSITION_STYLES } from './compositionStyles.js';

// Style Exclusions (random selection filtering)
export type { RandomExclusionRule } from './styleExclusions.js';
export {
  DEFAULT_RANDOM_EXCLUSIONS,
  isExcludedPair,
  filterStylesForComposition,
  filterCompositionsForStyle,
} from './styleExclusions.js';

// Color Palettes
export type { ColorPalette } from './colorPalettes.js';
export { DEFAULT_COLOR_PALETTES } from './colorPalettes.js';

// Narrative Styles (story-based chronicles)
export type {
  RoleDefinition,
  PacingConfig,
  NarrativeFormat,
  StoryNarrativeStyle,
} from './narrativeStyles.js';
export { DEFAULT_NARRATIVE_STYLES } from './narrativeStyles.js';

// Document Styles (in-universe documents)
export type { DocumentNarrativeStyle } from './documentStyles.js';
export { DEFAULT_DOCUMENT_STYLES } from './documentStyles.js';

// =============================================================================
// Combined Types
// =============================================================================

import type { ArtisticStyle } from './artisticStyles.js';
import type { CompositionStyle } from './compositionStyles.js';
import type { ColorPalette } from './colorPalettes.js';
import type { StoryNarrativeStyle } from './narrativeStyles.js';
import type { DocumentNarrativeStyle } from './documentStyles.js';

import { DEFAULT_ARTISTIC_STYLES } from './artisticStyles.js';
import { DEFAULT_COMPOSITION_STYLES } from './compositionStyles.js';
import { DEFAULT_COLOR_PALETTES } from './colorPalettes.js';
import { DEFAULT_NARRATIVE_STYLES } from './narrativeStyles.js';
import { DEFAULT_DOCUMENT_STYLES } from './documentStyles.js';

/**
 * Combined narrative style type (story or document)
 */
export type NarrativeStyle = StoryNarrativeStyle | DocumentNarrativeStyle;

/**
 * Style library - collection of available styles
 */
export interface StyleLibrary {
  artisticStyles: ArtisticStyle[];
  compositionStyles: CompositionStyle[];
  colorPalettes: ColorPalette[];
  narrativeStyles: NarrativeStyle[];
}

/**
 * Style selection for image generation
 */
export interface StyleSelection {
  /** Selected artistic style ID, 'random' for random selection, or 'culture-default' to use culture's default */
  artisticStyleId?: string;
  /** Selected composition style ID, 'random' for random selection, or 'culture-default' to use culture's default */
  compositionStyleId?: string;
  /** Selected color palette ID, or 'random' for random selection */
  colorPaletteId?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a default style library
 */
export function createDefaultStyleLibrary(): StyleLibrary {
  return {
    artisticStyles: [...DEFAULT_ARTISTIC_STYLES],
    compositionStyles: [...DEFAULT_COMPOSITION_STYLES],
    colorPalettes: [...DEFAULT_COLOR_PALETTES],
    narrativeStyles: [...DEFAULT_NARRATIVE_STYLES, ...DEFAULT_DOCUMENT_STYLES],
  };
}

/**
 * Find an artistic style by ID
 */
export function findArtisticStyle(library: StyleLibrary, id: string): ArtisticStyle | undefined {
  return library.artisticStyles.find(s => s.id === id);
}

/**
 * Find a color palette by ID
 */
export function findColorPalette(library: StyleLibrary, id: string): ColorPalette | undefined {
  return library.colorPalettes.find(s => s.id === id);
}

/**
 * Find a composition style by ID
 */
export function findCompositionStyle(library: StyleLibrary, id: string): CompositionStyle | undefined {
  return library.compositionStyles.find(s => s.id === id);
}

/**
 * Find a narrative style by ID
 */
export function findNarrativeStyle(library: StyleLibrary, id: string): NarrativeStyle | undefined {
  return library.narrativeStyles.find(s => s.id === id);
}
