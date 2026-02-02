/**
 * Chronicle V2 Types
 *
 * Minimal types for the single-shot chronicle generation pipeline.
 */

import type {
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
} from '../chronicleTypes';

/**
 * Configuration for V2 selection limits.
 */
export interface V2SelectionConfig {
  /** Maximum events to include (default: 4) */
  maxEvents: number;
  /** Maximum relationships to include (default: 10) */
  maxRelationships: number;
}

/**
 * Result of V2 selection - entities/relationships/events for the prompt.
 * Extracted from the wizard's role assignments and selections.
 */
export interface V2SelectionResult {
  /** Entities from role assignments */
  entities: EntityContext[];
  /** Selected relationships */
  relationships: RelationshipContext[];
  /** Selected events */
  events: NarrativeEventContext[];
}

/**
 * V2 generation result stored in IndexedDB.
 */
export interface V2GenerationResult {
  /** Chronicle ID */
  chronicleId: string;
  /** Entity ID (graph entry point) */
  entityId: string;
  /** Generated narrative content */
  content: string;
  /** Pipeline version marker */
  pipelineVersion: 'v2';
  /** Summary of what was selected for the prompt */
  selectionSummary: {
    entityCount: number;
    eventCount: number;
    relationshipCount: number;
  };
  /** When generated */
  generatedAt: number;
  /** Model used */
  model: string;
  /** Cost tracking */
  estimatedCost: number;
  actualCost: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Default selection config.
 */
export const DEFAULT_V2_CONFIG: V2SelectionConfig = {
  maxEvents: 4,
  maxRelationships: 10,
};
