/**
 * Narrative Style Types and Defaults
 *
 * Defines story-based narrative styles for chronicle generation.
 *
 * Design principle: Each style has a DISTINCT STRUCTURE, not just different adjectives.
 * Structure, roles, and prose instructions must reinforce each other.
 */

import { NARRATIVE_STYLES_CLASSIC } from './narrativeStyleDefaultsClassic.js';
import { NARRATIVE_STYLES_EXPERIMENTAL } from './narrativeStyleDefaultsExperimental.js';
import { NARRATIVE_STYLES_GENRE } from './narrativeStyleDefaultsGenre.js';
import { NARRATIVE_STYLES_INTIMATE } from './narrativeStyleDefaultsIntimate.js';
import { NARRATIVE_STYLES_CLIMACTIC } from './narrativeStyleDefaultsClimatic.js';

/**
 * Role definition for entity casting
 */
export interface RoleDefinition {
  /** Role identifier (e.g., 'protagonist', 'love-interest', 'schemer') */
  role: string;
  /** How many entities can fill this role */
  count: { min: number; max: number };
  /** Description of this role for the LLM */
  description: string;
  /** Selection criteria hint (used by document styles) */
  selectionCriteria: string;
}

/**
 * Pacing configuration - simple numeric ranges
 */
export interface PacingConfig {
  /** Target total word count */
  totalWordCount: { min: number; max: number };
  /** Number of scenes */
  sceneCount: { min: number; max: number };
}

/**
 * Narrative format type - distinguishes stories from documents
 */
export type NarrativeFormat = 'story' | 'document';

/**
 * Era narrative weight — determines how a chronicle using this style
 * is weighted in era narrative prompt assembly.
 *
 * - 'structural': Defines the era's trajectory. These chronicles ARE the major events.
 * - 'contextual': Provides institutional, political, or personal framing.
 * - 'flavor': World texture. Color and atmosphere, not arc-defining.
 */
export type EraNarrativeWeight = 'structural' | 'contextual' | 'flavor';

/**
 * Story narrative style - simplified structure with freeform text blocks
 *
 * Instead of dozens of structured fields that get fragmented in prompts,
 * we use a few rich text blocks that flow naturally into generation prompts.
 */
export interface StoryNarrativeStyle {
  format: 'story';

  // === Metadata ===
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Tags for categorization */
  tags: string[];
  /** How this style weights in era narrative assembly */
  eraNarrativeWeight: EraNarrativeWeight;

  // === Freeform Text Blocks (injected directly into prompts) ===

  /**
   * Narrative structure instructions - how to build the story.
   * Includes: plot structure, scene progression, emotional arcs, beats.
   * This is the primary guidance for story construction.
   */
  narrativeInstructions: string;

  /**
   * Prose style instructions - how to write the story.
   * Includes: tone, dialogue style, description approach, pacing notes, what to avoid.
   */
  proseInstructions: string;

  /**
   * Event usage instructions - how to incorporate world events.
   */
  eventInstructions: string;

  /**
   * Craft posture - how the author should relate to the material.
   * Controls density, withholding, elaboration mode, emotional signaling.
   * Orthogonal to prose instructions (which say what the writing should feel like)
   * and word count (which controls quantity). This controls density within
   * whatever word count is specified.
   */
  craftPosture: string;

  /**
   * Title guidance - how titles for this style should feel.
   * Freeform description of the title's shape, register, and energy.
   * Injected into the title generation prompt as the primary style constraint.
   */
  titleGuidance: string;

  // === Structured Data (genuinely useful as structured) ===

  /** Cast roles - what positions exist in this narrative */
  roles: RoleDefinition[];

  /** Pacing - word count and scene count ranges */
  pacing: PacingConfig;

}

export const DEFAULT_NARRATIVE_STYLES: StoryNarrativeStyle[] = [
  ...NARRATIVE_STYLES_CLASSIC,
  ...NARRATIVE_STYLES_EXPERIMENTAL,
  ...NARRATIVE_STYLES_GENRE,
  ...NARRATIVE_STYLES_INTIMATE,
  ...NARRATIVE_STYLES_CLIMACTIC,
];
