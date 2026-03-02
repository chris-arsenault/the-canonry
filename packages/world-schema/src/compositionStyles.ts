/**
 * Composition Style Types and Defaults
 *
 * Defines framing and visual arrangement for image generation.
 */

import type { EntityCategory } from './entityKind.js';
import {
  CHARACTER_COMPOSITIONS,
  PAIR_COMPOSITIONS,
  POSE_COMPOSITIONS,
  COLLECTIVE_COMPOSITIONS,
  PLACE_COMPOSITIONS,
} from './compositionStyleDefaultsEntity.js';
import {
  LANDSCAPE_COMPOSITIONS,
  OBJECT_COMPOSITIONS,
  CONCEPT_COMPOSITIONS,
  EVENT_COMPOSITIONS,
} from './compositionStyleDefaultsAbstract.js';

/**
 * Categories for composition styles.
 * Extends EntityCategory with composition-specific groupings.
 */
export type CompositionCategory = EntityCategory | 'pair' | 'pose' | 'landscape';

/**
 * Composition style - defines framing and visual arrangement
 */
export interface CompositionStyle {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Prompt fragment for composition (injected into image prompt) */
  promptFragment: string;
  /**
   * Target category this composition is best suited for.
   * Used to filter/suggest compositions based on context.
   * If undefined, composition is considered universal.
   */
  targetCategory?: CompositionCategory;
}

export const DEFAULT_COMPOSITION_STYLES: CompositionStyle[] = [
  ...CHARACTER_COMPOSITIONS,
  ...PAIR_COMPOSITIONS,
  ...POSE_COMPOSITIONS,
  ...COLLECTIVE_COMPOSITIONS,
  ...PLACE_COMPOSITIONS,
  ...LANDSCAPE_COMPOSITIONS,
  ...OBJECT_COMPOSITIONS,
  ...CONCEPT_COMPOSITIONS,
  ...EVENT_COMPOSITIONS,
];
