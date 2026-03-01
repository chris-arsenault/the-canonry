import type {
  EntityTags,
  ProminenceLabel,
  WorldEntity,
  WorldRelationship
} from '@canonry/world-schema';

export type { EntityTags, ProminenceLabel };

export type HardState = WorldEntity;

export type Relationship = WorldRelationship;

export type CatalystProperties = NonNullable<WorldEntity['catalyst']>;

/** Value stored in template/narration variable maps — single entity, array, or unresolved. */
export type VariableValue = HardState | HardState[] | undefined;

// Rate limiting for template-based entity creation
export interface RateLimitState {
  currentThreshold: number;     // Difficulty threshold for next creation
  lastCreationTick: number;     // Last tick a rate-limited creation occurred
  creationsThisEpoch: number;   // Count for current epoch
}
