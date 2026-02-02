/**
 * Selection Filter Types
 *
 * Canonical type definitions for all selection filters.
 * This is the single source of truth - other modules import from here.
 */

import type { ProminenceLabel } from '../types';

// =============================================================================
// GRAPH PATH TYPES (used by graph_path filter)
// =============================================================================

/**
 * Graph path assertion - used by selection filters.
 */
export interface GraphPathAssertion {
  /** Type of assertion */
  check: 'exists' | 'not_exists' | 'count_min' | 'count_max';

  /** Path to traverse (1-2 hops) */
  path: PathStep[];

  /** For count assertions */
  count?: number;

  /** Additional constraints on the final target */
  where?: PathConstraint[];
}

/**
 * A single step in a graph traversal path.
 */
export interface PathStep {
  /** Relationship(s) to traverse - can be a single kind or array of kinds */
  via: string | string[];
  /** Direction: 'out'/'in'/'any' in JSON, normalized to 'src'/'dst'/'both' internally */
  direction: 'out' | 'in' | 'any';

  /** Filter targets at this step */
  targetKind?: string;
  targetSubtype?: string;
  targetStatus?: string;

  /** Optional filters applied to entities reached at this step */
  filters?: SelectionFilter[];

  /** Store intermediate result for reference */
  as?: string;  // e.g., "$controlled", "$adjacent"
}

/**
 * Constraints on path targets.
 */
export type PathConstraint =
  | { type: 'not_in'; set: string }           // Target not in a stored set (e.g., "$controlled")
  | { type: 'in'; set: string }               // Target in a stored set
  | { type: 'lacks_relationship'; kind: string; with: string; direction?: 'out' | 'in' | 'any' }
  | { type: 'has_relationship'; kind: string; with: string; direction?: 'out' | 'in' | 'any' }
  | { type: 'not_self' }                      // Target is not the starting entity
  | { type: 'kind_equals'; kind: string }
  | { type: 'subtype_equals'; subtype: string };

// =============================================================================
// FILTER TYPES
// =============================================================================

/**
 * Union type of all selection filters.
 */
export type SelectionFilter =
  | ExcludeEntitiesFilter
  | HasRelationshipFilter
  | LacksRelationshipFilter
  | HasTagSelectionFilter
  | HasTagsSelectionFilter
  | HasAnyTagSelectionFilter
  | LacksTagSelectionFilter
  | LacksAnyTagSelectionFilter
  | HasCultureFilter
  | NotHasCultureFilter
  | MatchesCultureFilter
  | NotMatchesCultureFilter
  | HasStatusFilter
  | HasProminenceFilter
  | SharesRelatedFilter
  | GraphPathSelectionFilter
  | ComponentSizeFilter;

/**
 * Graph path selection filter - filters entities based on graph traversal.
 */
export interface GraphPathSelectionFilter {
  type: 'graph_path';
  assert: GraphPathAssertion;
}

export interface ExcludeEntitiesFilter {
  type: 'exclude';
  entities: string[];  // Variable references
}

export interface HasRelationshipFilter {
  type: 'has_relationship';
  kind: string;
  with?: string;  // Variable reference (optional)
  direction?: 'src' | 'dst' | 'both';
}

export interface LacksRelationshipFilter {
  type: 'lacks_relationship';
  kind: string;
  with?: string;  // Variable reference (optional)
}

export interface HasTagSelectionFilter {
  type: 'has_tag';
  tag: string;
  value?: string | boolean;
}

/**
 * Filter entities that have ALL specified tags (AND semantics).
 * Use has_any_tag for OR semantics.
 */
export interface HasTagsSelectionFilter {
  type: 'has_tags';
  tags: string[];
}

export interface HasAnyTagSelectionFilter {
  type: 'has_any_tag';
  tags: string[];
}

export interface LacksTagSelectionFilter {
  type: 'lacks_tag';
  tag: string;
  value?: string | boolean;  // If specified, only excludes if tag has this value
}

export interface LacksAnyTagSelectionFilter {
  type: 'lacks_any_tag';
  tags: string[];  // Excludes entities that have ANY of these tags
}

export interface HasCultureFilter {
  type: 'has_culture';
  culture: string;
}

export interface NotHasCultureFilter {
  type: 'not_has_culture';
  culture: string;
}

export interface MatchesCultureFilter {
  type: 'matches_culture';
  with: string;  // Variable reference like "$target"
}

export interface NotMatchesCultureFilter {
  type: 'not_matches_culture';
  with: string;  // Variable reference like "$actor"
}

export interface HasStatusFilter {
  type: 'has_status';
  status: string;
}

export interface HasProminenceFilter {
  type: 'has_prominence';
  minProminence: ProminenceLabel;
}

/**
 * Filter entities that share a common related entity with a reference.
 * Example: Find entities that share the same location as $target via 'resident_of' relationship.
 */
export interface SharesRelatedFilter {
  type: 'shares_related';
  relationshipKind: string;  // Relationship kind to check (e.g., 'resident_of')
  with: string;              // Reference entity (e.g., '$target')
}

/**
 * Filter entities based on connected component size.
 * Uses DFS to find all entities transitively reachable via the specified
 * relationship kind(s), treating the subgraph as undirected.
 *
 * Example: Limit alliance formation to factions in small alliance blocs:
 * { type: 'component_size', relationshipKinds: ['allied_with'], max: 6 }
 */
export interface ComponentSizeFilter {
  type: 'component_size';
  /** Relationship kind(s) defining the subgraph edges */
  relationshipKinds: string[];
  /** Minimum component size (inclusive) */
  min?: number;
  /** Maximum component size (inclusive) */
  max?: number;
  /** Minimum relationship strength to follow (default: 0) */
  minStrength?: number;
}
