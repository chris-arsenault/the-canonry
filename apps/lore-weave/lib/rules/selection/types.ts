/**
 * Selection Types
 *
 * Shared selection rule types used across templates, actions, and systems.
 */

import type { ProminenceLabel } from '../../core/worldTypes';
import type { Direction } from '../types';
import type { SelectionFilter } from '../filters/types';

/**
 * Saturation limit - filter targets by relationship count.
 * Useful for limiting generator creation based on existing relationships.
 */
export interface SaturationLimit {
  /** Relationship kind to count */
  relationshipKind: string;
  /** Direction: 'in' = incoming, 'out' = outgoing (default: 'in') */
  direction?: 'in' | 'out' | Direction;
  /** Optional: only count relationships from/to this entity kind */
  fromKind?: string;
  /** Optional: only count relationships from/to this entity subtype (requires fromKind) */
  fromSubtype?: string;
  /** Maximum number of relationships allowed (target is selected only if count < maxCount) */
  maxCount: number;
}

export type SelectionPickStrategy = 'random' | 'first' | 'all' | 'weighted';

/**
 * Rules that determine how to find target entities.
 */
export interface SelectionRule {
  strategy: 'by_kind' | 'by_preference_order' | 'by_relationship' | 'by_proximity' | 'by_prominence';
  kind?: string;
  kinds?: string[];

  // Common filters
  subtypes?: string[];
  excludeSubtypes?: string[];
  status?: string;
  statuses?: string[];
  notStatus?: string;

  // For by_relationship strategy
  relationshipKind?: string;
  mustHave?: boolean;
  direction?: Direction;

  // For by_preference_order strategy
  subtypePreferences?: string[];

  // For by_proximity strategy
  referenceEntity?: string;  // Variable reference like "$target"
  maxDistance?: number;

  // For by_prominence strategy
  minProminence?: ProminenceLabel;

  // Post-selection filters
  filters?: SelectionFilter[];

  // Saturation limits - filter by relationship counts
  saturationLimits?: SaturationLimit[];

  // Result handling
  pickStrategy?: SelectionPickStrategy;
  maxResults?: number;
}

export interface RelatedEntitiesSpec {
  relatedTo: string;  // Variable reference
  relationshipKind: string;  // Relationship kind
  direction: Direction | 'out' | 'in' | 'any';
}

/**
 * A step in a path traversal for variable selection.
 */
export interface PathTraversalStep {
  /** Starting entity reference (only for first step) */
  from?: string;
  /** Relationship to traverse */
  via: string;
  /** Direction: 'out'/'in'/'any' or 'src'/'dst'/'both' */
  direction: Direction | 'out' | 'in' | 'any';
  /** Filter targets at this step */
  targetKind?: string;
  targetSubtype?: string;
  targetStatus?: string;
}

/**
 * Path-based entity selection - multi-hop traversal.
 */
export interface PathBasedSpec {
  path: PathTraversalStep[];
}

/**
 * Variable selection rule (used by template variables).
 */
export interface VariableSelectionRule {
  // Select from graph, from related entities, or via path traversal
  from?: RelatedEntitiesSpec | PathBasedSpec | 'graph';

  // Entity filtering (kind used when from='graph')
  kind?: string;
  kinds?: string[];
  subtypes?: string[];
  status?: string;
  statuses?: string[];
  notStatus?: string;

  // Post-filters
  filters?: SelectionFilter[];

  // Prefer filters (try these first, fall back to all matches)
  preferFilters?: SelectionFilter[];

  // Result handling
  pickStrategy?: SelectionPickStrategy;
  maxResults?: number;
}

/**
 * Base criteria for filtering entities across contexts.
 */
export interface EntitySelectionCriteria {
  kind?: string;
  kinds?: string[];
  subtypes?: string[];
  excludeSubtypes?: string[];
  status?: string;
  statuses?: string[];
  notStatus?: string;
  hasTag?: string;
  notHasTag?: string;
}
