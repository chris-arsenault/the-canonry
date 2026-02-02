/**
 * Unified Metric Types
 *
 * Consolidates metric/factor types from:
 * - FeedbackFactor (declarativePressureTypes)
 * - SimpleCountFactor (declarativePressureTypes)
 * - MetricConfig (connectionEvolution)
 *
 * All metrics use `type` as the discriminant field.
 */

import type { Direction } from '../types';

/**
 * Unified Metric type.
 * All metrics return a number.
 */
export type Metric =
  // Count metrics
  | EntityCountMetric
  | RelationshipCountMetric
  | TagCountMetric
  | TotalEntitiesMetric
  | ConstantMetric
  | ConnectionCountMetric

  // Ratio metrics
  | RatioMetric
  | StatusRatioMetric
  | CrossCultureRatioMetric

  // Evolution metrics
  | SharedRelationshipMetric

  // Prominence metrics
  | ProminenceMultiplierMetric
  | NeighborProminenceMetric

  // Neighbor metrics
  | NeighborKindCountMetric

  // Graph topology metrics
  | ComponentSizeMetric

  // Decay/falloff metrics
  | DecayRateMetric
  | FalloffMetric;

// =============================================================================
// COUNT METRICS
// =============================================================================

/**
 * Count entities matching criteria.
 */
export interface EntityCountMetric {
  type: 'entity_count';
  kind: string;
  subtype?: string;
  status?: string;
  coefficient?: number;
  cap?: number;
}

/**
 * Count relationships matching criteria.
 */
export interface RelationshipCountMetric {
  type: 'relationship_count';
  relationshipKinds?: string[];
  direction?: Direction;
  minStrength?: number;
  coefficient?: number;
  cap?: number;
}

/**
 * Count entities with specific tags.
 */
export interface TagCountMetric {
  type: 'tag_count';
  tags: string[];
  coefficient?: number;
  cap?: number;
}

/**
 * Total entity count in the graph.
 */
export interface TotalEntitiesMetric {
  type: 'total_entities';
  coefficient?: number;
  cap?: number;
}

/**
 * Constant value.
 */
export interface ConstantMetric {
  type: 'constant';
  value: number;
  coefficient?: number;
}

/**
 * Count all connections (relationships) involving an entity.
 * For per-entity metrics in connectionEvolution.
 */
export interface ConnectionCountMetric {
  type: 'connection_count';
  relationshipKinds?: string[];
  direction?: Direction;
  minStrength?: number;
  coefficient?: number;
  cap?: number;
}

// =============================================================================
// RATIO METRICS
// =============================================================================

/**
 * Simple count factor for use in ratios (no coefficient/cap).
 */
export type SimpleCountMetric =
  | { type: 'entity_count'; kind: string; subtype?: string; status?: string }
  | { type: 'relationship_count'; relationshipKinds?: string[] }
  | { type: 'tag_count'; tags: string[] }
  | { type: 'total_entities' }
  | { type: 'constant'; value: number };

/**
 * Calculate ratio of two counts.
 */
export interface RatioMetric {
  type: 'ratio';
  numerator: SimpleCountMetric;
  denominator: SimpleCountMetric;
  /** Value to use if denominator is 0 (default: 0) */
  fallbackValue?: number;
  coefficient?: number;
  cap?: number;
}

/**
 * Count entities with alive vs dead status.
 */
export interface StatusRatioMetric {
  type: 'status_ratio';
  kind: string;
  subtype?: string;
  aliveStatus: string;
  coefficient?: number;
  cap?: number;
}

/**
 * Calculate ratio of cross-culture relationships to total relationships.
 */
export interface CrossCultureRatioMetric {
  type: 'cross_culture_ratio';
  relationshipKinds: string[];
  coefficient?: number;
  cap?: number;
}

// =============================================================================
// EVOLUTION METRICS
// =============================================================================

/**
 * Count entities sharing a specific relationship.
 * (e.g., common enemies, trade partners)
 *
 * Supports multiple relationship kinds - entities matching ANY of the kinds
 * will be counted (OR semantics).
 *
 * Optional `via` enables multi-hop traversal:
 * - Without via: Entity → sharedRelationshipKind → Target ← sharedRelationshipKind ← OtherEntity
 * - With via: Entity → via → Intermediate → sharedRelationshipKind → Target ← sharedRelationshipKind ← Intermediate ← via ← OtherEntity
 *
 * Example: Trade alliance detection
 * ```
 * Faction A → controls → Location X → trades_with → Location Y ← controls ← Faction B
 * ```
 * Config: { via: { relationshipKind: 'controls', direction: 'src' }, sharedRelationshipKind: 'trades_with' }
 */
export interface SharedRelationshipMetric {
  type: 'shared_relationship';
  /** Relationship kind(s) to check - single string or array */
  sharedRelationshipKind: string | string[];
  sharedDirection?: 'src' | 'dst';
  /**
   * Optional intermediate relationship to traverse first.
   * Enables multi-hop detection: Entity → via → Intermediate → sharedRelationshipKind → Target
   */
  via?: {
    /** Relationship kind to traverse to reach intermediate entities */
    relationshipKind: string;
    /** Direction of the via relationship from the source entity (default: 'src') */
    direction?: 'src' | 'dst';
    /** Optional kind filter for intermediate entities */
    intermediateKind?: string;
  };
  /** Minimum relationship strength to count */
  minStrength?: number;
  coefficient?: number;
  cap?: number;
}

/**
 * Prominence multiplier.
 * Returns a multiplier based on entity prominence level.
 */
export interface ProminenceMultiplierMetric {
  type: 'prominence_multiplier';
  /**
   * Multiplier mode:
   * - 'success_chance': For action success probability (0.6 - 1.5)
   * - 'action_rate': For action selection probability (0.3 - 2.0)
   */
  mode?: 'success_chance' | 'action_rate';
}

/**
 * Average prominence of connected entities.
 * Implements "Reflected Glory" - entities connected to high-prominence
 * entities can benefit from their fame.
 */
export interface NeighborProminenceMetric {
  type: 'neighbor_prominence';
  /** Relationship kinds to consider (all if not specified) */
  relationshipKinds?: string[];
  /** Direction of relationships to consider */
  direction?: Direction;
  /** Minimum relationship strength to count */
  minStrength?: number;
  /** Coefficient to multiply the result */
  coefficient?: number;
  /** Maximum value cap */
  cap?: number;
}

// =============================================================================
// NEIGHBOR METRICS
// =============================================================================

/**
 * Count neighboring entities of a specific kind/subtype.
 * Finds entities connected via a relationship chain and counts those matching criteria.
 *
 * Example: Count NPCs residing at adjacent locations:
 * {
 *   type: 'neighbor_kind_count',
 *   via: 'adjacent_to',
 *   viaDirection: 'both',
 *   then: 'resident_of',
 *   thenDirection: 'in',
 *   kind: 'npc'
 * }
 */
export interface NeighborKindCountMetric {
  type: 'neighbor_kind_count';
  /** First relationship(s) to traverse from the entity - can be single kind or array */
  via: string | string[];
  /** Direction for first relationship */
  viaDirection?: Direction;
  /** Optional second relationship to traverse */
  then?: string;
  /** Direction for second relationship */
  thenDirection?: Direction;
  /** Entity kind to count */
  kind: string;
  /** Optional subtype filter */
  subtype?: string;
  /** Optional status filter */
  status?: string;
  /** Optional tag filter - entity must have this tag */
  hasTag?: string;
  /** Minimum relationship strength for via */
  minStrength?: number;
  /** Coefficient to multiply the result */
  coefficient?: number;
  /** Maximum value cap */
  cap?: number;
}

// =============================================================================
// GRAPH TOPOLOGY METRICS
// =============================================================================

/**
 * Size of the connected component containing an entity.
 * Uses DFS to find all entities transitively reachable via the specified
 * relationship kind(s), treating the subgraph as undirected.
 *
 * Example: Find size of alliance bloc containing a faction:
 * {
 *   type: 'component_size',
 *   relationshipKinds: ['allied_with']
 * }
 */
export interface ComponentSizeMetric {
  type: 'component_size';
  /** Relationship kind(s) defining the subgraph edges */
  relationshipKinds: string[];
  /** Minimum relationship strength to follow (default: 0) */
  minStrength?: number;
  /** Coefficient to multiply the result */
  coefficient?: number;
  /** Maximum value cap */
  cap?: number;
}

// =============================================================================
// DECAY/FALLOFF METRICS
// =============================================================================

/**
 * Decay rate value.
 */
export interface DecayRateMetric {
  type: 'decay_rate';
  rate: 'none' | 'slow' | 'medium' | 'fast';
}

/**
 * Distance falloff calculation.
 */
export interface FalloffMetric {
  type: 'falloff';
  falloffType: 'absolute' | 'none' | 'linear' | 'inverse_square' | 'sqrt' | 'exponential';
  distance: number;
  maxDistance?: number;
}

// =============================================================================
// RESULT TYPE
// =============================================================================

/**
 * Result of metric evaluation.
 * Includes diagnostic information for debugging.
 */
export interface MetricResult {
  /** The computed metric value */
  value: number;

  /** Human-readable explanation */
  diagnostic: string;

  /** Machine-readable details for debugging */
  details: Record<string, unknown>;
}
