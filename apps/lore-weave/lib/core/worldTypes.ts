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

// Rate limiting for template-based entity creation
export interface RateLimitState {
  currentThreshold: number;     // Difficulty threshold for next creation
  lastCreationTick: number;     // Last tick a rate-limited creation occurred
  creationsThisEpoch: number;   // Count for current epoch
}
