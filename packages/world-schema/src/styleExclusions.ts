/**
 * Style Exclusion Rules for Random Selection
 *
 * Defines pairs of artistic styles × composition styles that produce
 * visually incoherent results when randomly combined. These rules only
 * gate what "random" can produce — manual selection is never restricted.
 *
 * Rules use category-level patterns (prefixed with "cat:") expanded at
 * runtime against the style/composition libraries.
 */

import type { ArtisticStyle, ArtisticStyleCategory } from './artisticStyles.js';
import type { CompositionStyle, CompositionCategory } from './compositionStyles.js';

/**
 * A rule that excludes certain style+composition pairings from random selection.
 *
 * When styles/compositions arrays contain "cat:<category>" strings, ALL members
 * of that category are included. Specific IDs can also be listed directly.
 *
 * The "allow" array overrides exclusions for specific [styleId, compositionId] pairs.
 */
export interface RandomExclusionRule {
  /** Human-readable description of why this exclusion exists */
  reason: string;
  /** Style IDs or "cat:<category>" patterns to exclude */
  styles: string[];
  /** Composition IDs or "cat:<category>" patterns to exclude from */
  compositions: string[];
  /** Specific [styleId, compositionId] pairs that override this exclusion */
  allow?: [string, string][];
}

export const DEFAULT_RANDOM_EXCLUSIONS: RandomExclusionRule[] = [
  {
    reason: 'Document/archival styles clash with non-artifact subjects',
    styles: ['cat:document'],
    compositions: [
      'cat:character', 'cat:pair', 'cat:pose', 'cat:place', 'cat:landscape', 'cat:concept',
      'group-scene', 'action-battle', 'formation', 'council-chamber',
      'chronicle-panorama', 'chronicle-overview', 'chronicle-intimate',
      'chronicle-symbolic', 'chronicle-tableau', 'chronicle-folk',
    ],
    allow: [],
  },
  {
    reason: 'Logo/badge compositions need clean graphic styles',
    styles: ['cat:painting', 'cat:camera', 'cat:experimental'],
    compositions: ['logo-mark', 'badge-crest'],
    allow: [],
  },
  {
    reason: 'Tilt-shift miniature effect needs scenes with spatial depth',
    styles: ['tilt-shift'],
    compositions: ['cat:character', 'cat:pair', 'cat:pose', 'cat:object', 'cat:concept'],
    allow: [],
  },
  {
    reason: 'Technical compositions need precise rendering styles',
    styles: [
      'cat:painting', 'cat:experimental',
      'hdr-nature-photography', 'cinematic-still', 'daguerreotype', 'double-exposure',
    ],
    compositions: ['scientific-drawing', 'schematic', 'artifact-diagram'],
    allow: [],
  },
  {
    reason: 'Eldritch biomechanical clashes with clean/precise compositions',
    styles: ['eldritch-biomechanical'],
    compositions: ['logo-mark', 'badge-crest', 'scientific-drawing', 'schematic', 'display-case', 'field-study'],
    allow: [],
  },
];

// =============================================================================
// Resolution Functions
// =============================================================================

/**
 * Expand a list of IDs and "cat:<category>" patterns into concrete IDs.
 */
function expandPatterns<T extends { id: string }>(
  patterns: string[],
  items: T[],
  getCategoryFn: (item: T) => string | undefined,
): Set<string> {
  const ids = new Set<string>();
  for (const pattern of patterns) {
    if (pattern.startsWith('cat:')) {
      const cat = pattern.slice(4);
      for (const item of items) {
        if (getCategoryFn(item) === cat) {
          ids.add(item.id);
        }
      }
    } else {
      ids.add(pattern);
    }
  }
  return ids;
}

/**
 * Check if a specific style+composition pair is excluded by the given rules.
 */
export function isExcludedPair(
  styleId: string,
  compositionId: string,
  rules: RandomExclusionRule[],
  artisticStyles: ArtisticStyle[],
  compositionStyles: CompositionStyle[],
): boolean {
  for (const rule of rules) {
    const excludedStyles = expandPatterns(
      rule.styles,
      artisticStyles,
      (s) => s.category,
    );
    const excludedCompositions = expandPatterns(
      rule.compositions,
      compositionStyles,
      (c) => c.targetCategory,
    );

    if (excludedStyles.has(styleId) && excludedCompositions.has(compositionId)) {
      // Check allow overrides
      if (rule.allow?.some(([s, c]) => s === styleId && c === compositionId)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Filter artistic styles to exclude bad pairings with a fixed composition.
 */
export function filterStylesForComposition(
  artisticStyles: ArtisticStyle[],
  compositionId: string,
  rules: RandomExclusionRule[],
  compositionStyles: CompositionStyle[],
): ArtisticStyle[] {
  return artisticStyles.filter(
    (s) => !isExcludedPair(s.id, compositionId, rules, artisticStyles, compositionStyles),
  );
}

/**
 * Filter composition styles to exclude bad pairings with a fixed artistic style.
 */
export function filterCompositionsForStyle(
  compositionStyles: CompositionStyle[],
  styleId: string,
  rules: RandomExclusionRule[],
  artisticStyles: ArtisticStyle[],
): CompositionStyle[] {
  return compositionStyles.filter(
    (c) => !isExcludedPair(styleId, c.id, rules, artisticStyles, compositionStyles),
  );
}
