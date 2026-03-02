/**
 * Document Style Types and Defaults
 *
 * Defines document-based narrative styles for in-universe documents
 * like news articles, treaties, letters, etc.
 *
 * Design principle: Mirrors story styles - freeform text blocks over structured micro-fields.
 * The LLM works best with natural language guidance, not fragmented config.
 */

import type { RoleDefinition, EraNarrativeWeight } from './narrativeStyles.js';
import { DOCUMENT_STYLES_OFFICIAL } from './documentStyleDefaultsOfficial.js';
import { DOCUMENT_STYLES_PROFESSIONAL } from './documentStyleDefaultsProfessional.js';
import { DOCUMENT_STYLES_LITERARY } from './documentStyleDefaultsLiterary.js';

/**
 * Document narrative style - for in-universe document formats
 *
 * Simplified structure that mirrors StoryNarrativeStyle:
 * - Freeform text blocks for guidance (documentInstructions, eventInstructions)
 * - Minimal structure for genuinely useful constraints (roles, pacing)
 */
export interface DocumentNarrativeStyle {
  format: 'document';

  // === Metadata (same as story) ===
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Tags for categorization */
  tags?: string[];
  /** How this style weights in era narrative assembly */
  eraNarrativeWeight?: EraNarrativeWeight;

  // === Freeform Text Blocks (injected directly into prompts) ===

  /**
   * Document structure and style instructions - how to write the document.
   * Includes: document type, section structure, voice, tone, what to include/avoid.
   * This is the primary guidance for document generation.
   */
  documentInstructions: string;

  /**
   * Event usage instructions - how to incorporate world events.
   * Optional - only needed if events require special handling.
   */
  eventInstructions?: string;

  /**
   * Craft posture - how the author should relate to the material.
   * Controls density, withholding, elaboration mode, emotional signaling.
   * Orthogonal to document instructions and word count.
   */
  craftPosture?: string;

  /**
   * Title guidance - how titles for this style should feel.
   * Freeform description of the title's shape, register, and energy.
   * Injected into the title generation prompt as the primary style constraint.
   */
  titleGuidance?: string;

  // === Structured Data (genuinely useful as structured) ===

  /** Cast roles - what positions exist in this document */
  roles: RoleDefinition[];

  /** Pacing - word count range */
  pacing: {
    wordCount: { min: number; max: number };
  };

}

export const DEFAULT_DOCUMENT_STYLES: DocumentNarrativeStyle[] = [
  ...DOCUMENT_STYLES_OFFICIAL,
  ...DOCUMENT_STYLES_PROFESSIONAL,
  ...DOCUMENT_STYLES_LITERARY,
];
