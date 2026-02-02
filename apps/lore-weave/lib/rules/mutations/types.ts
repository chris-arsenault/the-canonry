/**
 * Unified Mutation Types
 *
 * Consolidates mutation/action types from:
 * - StateUpdateRule (templateInterpreter)
 * - TriggerAction (thresholdTrigger)
 * - ActionType (connectionEvolution)
 *
 * All mutations use `type` as the discriminant field.
 */

import type { Direction } from '../types';
import type { Condition } from '../conditions/types';

/**
 * Unified Mutation type.
 * All mutations modify graph state.
 */
export type Mutation =
  // Tag mutations
  | SetTagMutation
  | RemoveTagMutation

  // Relationship mutations
  | CreateRelationshipMutation
  | ArchiveRelationshipMutation
  | ArchiveAllRelationshipsMutation
  | AdjustRelationshipStrengthMutation
  | TransferRelationshipMutation

  // Entity mutations
  | ChangeStatusMutation
  | AdjustProminenceMutation

  // Pressure mutations
  | ModifyPressureMutation

  // Rate limit mutations
  | UpdateRateLimitMutation

  // Compound actions (contain nested actions)
  | ForEachRelatedAction
  | ConditionalAction;

// =============================================================================
// TAG MUTATIONS
// =============================================================================

/**
 * Set a tag on an entity.
 * Replaces: set_tag, add_tag
 */
export interface SetTagMutation {
  type: 'set_tag';
  /** Entity reference ($target, $actor, literal ID) */
  entity: string;
  /** Tag name */
  tag: string;
  /** Tag value (default: true) */
  value?: string | boolean;
  /** Optional value source key from RuleContext.values */
  valueFrom?: string;
}

/**
 * Remove a tag from an entity.
 */
export interface RemoveTagMutation {
  type: 'remove_tag';
  /** Entity reference */
  entity: string;
  /** Tag name */
  tag: string;
}

// =============================================================================
// RELATIONSHIP MUTATIONS
// =============================================================================

/**
 * Create a relationship between two entities.
 */
export interface CreateRelationshipMutation {
  type: 'create_relationship';
  /** Source entity reference */
  src: string;
  /** Destination entity reference */
  dst: string;
  /** Relationship kind */
  kind: string;
  /** Relationship strength (default: 1.0) */
  strength?: number;
  /** Create bidirectional relationship */
  bidirectional?: boolean;
  /** Optional category for the relationship */
  category?: string;
}

/**
 * Archive a relationship (mark as historical).
 * Replaces: archive_relationship
 */
export interface ArchiveRelationshipMutation {
  type: 'archive_relationship';
  /** Entity reference */
  entity: string;
  /** Relationship kind to archive */
  relationshipKind: string;
  /** Other entity reference (optional - if not provided, archives all of this kind) */
  with?: string;
  /** Direction: 'src', 'dst', or 'both' (default: 'both') */
  direction?: Direction;
}

/**
 * Archive all relationships of a kind involving an entity.
 * Convenience alias for archive_relationship without 'with'.
 */
export interface ArchiveAllRelationshipsMutation {
  type: 'archive_all_relationships';
  /** Entity reference */
  entity: string;
  /** Relationship kind to archive */
  relationshipKind: string;
  /** Direction: 'src', 'dst', or 'both' (default: 'both') */
  direction?: Direction;
}

/**
 * Adjust relationship strength between two entities.
 */
export interface AdjustRelationshipStrengthMutation {
  type: 'adjust_relationship_strength';
  /** Source entity reference */
  src: string;
  /** Destination entity reference */
  dst: string;
  /** Relationship kind */
  kind: string;
  /** Delta to apply (positive or negative) */
  delta: number;
  /** If true, apply adjustment in both directions */
  bidirectional?: boolean;
}

/**
 * Transfer a relationship from one entity to another.
 * Archives the relationship with 'from' and creates a new one with 'to'.
 */
export interface TransferRelationshipMutation {
  type: 'transfer_relationship';
  /** The entity whose relationship is being transferred (e.g., an artifact) */
  entity: string;
  /** Relationship kind to transfer */
  relationshipKind: string;
  /** Entity to transfer from */
  from: string;
  /** Entity to transfer to */
  to: string;
  /** Optional condition for the transfer */
  condition?: Condition;
}

// =============================================================================
// COMPOUND ACTIONS
// =============================================================================

/**
 * Iterate over related entities and execute actions for each.
 * Sets $related to each matching entity in turn.
 */
export interface ForEachRelatedAction {
  type: 'for_each_related';
  /** Relationship kind to traverse */
  relationship: string;
  /** Direction to traverse */
  direction: Direction;
  /** Filter to target kind (optional) */
  targetKind?: string;
  /** Filter to target subtype (optional) */
  targetSubtype?: string;
  /** Actions to execute for each related entity */
  actions: Mutation[];
}

/**
 * Conditionally execute actions based on a condition.
 */
export interface ConditionalAction {
  type: 'conditional';
  /** Condition to evaluate */
  condition: Condition;
  /** Actions to execute if condition is true */
  thenActions: Mutation[];
  /** Actions to execute if condition is false (optional) */
  elseActions?: Mutation[];
}

// =============================================================================
// ENTITY MUTATIONS
// =============================================================================

/**
 * Change an entity's status.
 * Replaces: update_entity_status, change_status
 */
export interface ChangeStatusMutation {
  type: 'change_status';
  /** Entity reference */
  entity: string;
  /** New status value */
  newStatus: string;
}

/**
 * Adjust an entity's prominence level.
 */
export interface AdjustProminenceMutation {
  type: 'adjust_prominence';
  /** Entity reference */
  entity: string;
  /** Delta to apply (positive = increase, negative = decrease) */
  delta: number;
}

// =============================================================================
// PRESSURE MUTATIONS
// =============================================================================

/**
 * Modify a pressure value.
 */
export interface ModifyPressureMutation {
  type: 'modify_pressure';
  /** Pressure ID */
  pressureId: string;
  /** Delta to add (can be negative) */
  delta: number;
}

// =============================================================================
// RATE LIMIT MUTATIONS
// =============================================================================

/**
 * Update rate limit state.
 * Used by templates to track creation rate limiting.
 */
export interface UpdateRateLimitMutation {
  type: 'update_rate_limit';
}

// =============================================================================
// RESULT TYPE
// =============================================================================

/**
 * Result of mutation application.
 * Contains all changes to be applied to the graph.
 */
export interface MutationResult {
  /** Whether the mutation was successfully prepared */
  applied: boolean;

  /** Human-readable explanation */
  diagnostic: string;

  /** Entity modifications to apply */
  entityModifications: EntityModification[];

  /** Relationships to create */
  relationshipsCreated: RelationshipToCreate[];

  /** Relationships to adjust */
  relationshipsAdjusted: RelationshipStrengthChange[];

  /** Relationships to archive (mark as historical) */
  relationshipsToArchive: RelationshipToArchive[];

  /** Pressure changes to apply */
  pressureChanges: Record<string, number>;

  /** Rate limit updates */
  rateLimitUpdated: boolean;
}

/**
 * An entity modification to apply.
 */
export interface EntityModification {
  /** Entity ID */
  id: string;
  /** Changes to apply */
  changes: {
    status?: string;
    prominence?: number;
    // Tag patch: set values; use undefined to remove.
    tags?: Record<string, string | boolean | undefined>;
  };
}

/**
 * A relationship to create.
 */
export interface RelationshipToCreate {
  kind: string;
  src: string;
  dst: string;
  strength: number;
  category?: string;
}

/**
 * A relationship strength adjustment to apply.
 */
export interface RelationshipStrengthChange {
  kind: string;
  src: string;
  dst: string;
  delta: number;
}

/**
 * A relationship to archive (mark as historical).
 */
export interface RelationshipToArchive {
  kind: string;
  src: string;
  dst: string;
}
