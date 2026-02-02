/**
 * Mutation Tracker
 *
 * Central tracking for ALL mutations during simulation ticks.
 * Part of the unified lineage system - see LINEAGE.md.
 *
 * ## Core Purpose
 *
 * This tracker is the foundation of context-based event deduplication:
 * 1. ALL mutations (entity creation, relationship creation, tag changes, etc.) are recorded here
 * 2. Each mutation is tagged with its execution context (template, system, action, etc.)
 * 3. At flush time, mutations are grouped by context
 * 4. ONE rich event is generated per context instead of many small events
 *
 * ## Mutation Types Tracked
 *
 * - entity_created: New entity added to the graph
 * - relationship_created: New relationship formed
 * - relationship_archived: Relationship dissolved/ended
 * - tag_added: Tag added to entity
 * - tag_removed: Tag removed from entity
 * - field_changed: Entity field changed (status, prominence, etc.)
 *
 * ## Context Stack
 *
 * Execution contexts form a natural hierarchy:
 * - system:framework-growth → template:hero_emergence → (entities created here)
 * - system:agent-actions → action:declare_war → (relationships created here)
 *
 * We use a stack to track nested contexts. The innermost (most specific) context
 * is what gets recorded with each mutation.
 */

import type { ExecutionContext, ExecutionSource, Polarity } from '@canonry/world-schema';

/**
 * All mutation types tracked by the system
 */
export type MutationType =
  | 'entity_created'
  | 'relationship_created'
  | 'relationship_archived'
  | 'tag_added'
  | 'tag_removed'
  | 'field_changed';

/**
 * Data specific to entity creation
 */
export interface EntityCreatedData {
  entityId: string;
  kind: string;
  subtype: string;
  name: string;
  culture: string;
  prominence: string;
  status: string;
  tags: Record<string, string | boolean>;
}

/**
 * Data specific to relationship creation
 */
export interface RelationshipCreatedData {
  srcId: string;
  dstId: string;
  kind: string;
  strength?: number;
  polarity?: Polarity;
}

/**
 * Data specific to relationship archival
 */
export interface RelationshipArchivedData {
  srcId: string;
  dstId: string;
  kind: string;
  polarity?: Polarity;
  /** How long the relationship existed */
  age: number;
  /** Why it was archived (entity_ended, system_action, etc.) */
  reason?: string;
}

/**
 * Data specific to tag changes
 */
export interface TagChangeData {
  entityId: string;
  tag: string;
  value?: string | boolean;
}

/**
 * Data specific to field changes
 */
export interface FieldChangeData {
  entityId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * A tracked mutation with its execution context
 */
export interface TrackedMutation {
  /** What kind of mutation */
  type: MutationType;
  /** When it happened */
  tick: number;
  /** Who caused it (template, system, etc.) */
  context: ExecutionContext;
  /** Type-specific data */
  data: EntityCreatedData | RelationshipCreatedData | RelationshipArchivedData | TagChangeData | FieldChangeData;
}

/**
 * Helper type guards for mutation data
 */
export function isEntityCreated(m: TrackedMutation): m is TrackedMutation & { data: EntityCreatedData } {
  return m.type === 'entity_created';
}

export function isRelationshipCreated(m: TrackedMutation): m is TrackedMutation & { data: RelationshipCreatedData } {
  return m.type === 'relationship_created';
}

export function isRelationshipArchived(m: TrackedMutation): m is TrackedMutation & { data: RelationshipArchivedData } {
  return m.type === 'relationship_archived';
}

export function isTagChange(m: TrackedMutation): m is TrackedMutation & { data: TagChangeData } {
  return m.type === 'tag_added' || m.type === 'tag_removed';
}

export function isFieldChange(m: TrackedMutation): m is TrackedMutation & { data: FieldChangeData } {
  return m.type === 'field_changed';
}

/**
 * Key for grouping mutations by context
 */
export function contextKey(context: ExecutionContext): string {
  return `${context.source}:${context.sourceId}:${context.tick}`;
}

/**
 * Grouped mutations for a single execution context
 */
export interface ContextMutationGroup {
  context: ExecutionContext;
  key: string;
  mutations: TrackedMutation[];

  // Convenience accessors (computed on demand)
  entitiesCreated: EntityCreatedData[];
  relationshipsCreated: RelationshipCreatedData[];
  relationshipsArchived: RelationshipArchivedData[];
  tagsAdded: TagChangeData[];
  tagsRemoved: TagChangeData[];
  fieldsChanged: FieldChangeData[];
}

/**
 * MutationTracker is the central hub for all mutation tracking.
 *
 * Singleton pattern: WorldEngine creates one instance and shares it with systems.
 */
export class MutationTracker {
  /** All mutations recorded this tick */
  private mutations: TrackedMutation[] = [];

  /**
   * Context stack for nested execution.
   * The top of the stack (last element) is the current innermost context.
   */
  private contextStack: ExecutionContext[] = [];

  /** Current tick */
  private currentTick: number = 0;

  // ===========================================================================
  // CONTEXT MANAGEMENT
  // ===========================================================================

  /**
   * Set the current tick. Called at start of each tick.
   */
  setTick(tick: number): void {
    this.currentTick = tick;
  }

  /**
   * Get the current tick.
   */
  getTick(): number {
    return this.currentTick;
  }

  /**
   * Enter an execution context. Pushes onto the context stack.
   * @param source - The execution source type
   * @param sourceId - The source identifier
   * @param success - For actions: whether the action succeeded
   * @param narration - Optional in-world narrative description
   */
  enterContext(source: ExecutionSource, sourceId: string, success?: boolean, narration?: string): void {
    this.contextStack.push({
      tick: this.currentTick,
      source,
      sourceId,
      success,
      narration,
    });
  }

  /**
   * Exit the current execution context. Pops from the context stack.
   */
  exitContext(): void {
    if (this.contextStack.length === 0) {
      console.warn('[MutationTracker] exitContext() called with empty stack');
      return;
    }
    this.contextStack.pop();
  }

  /**
   * Get the current (innermost) execution context.
   */
  getCurrentContext(): ExecutionContext | null {
    if (this.contextStack.length === 0) {
      return null;
    }
    return this.contextStack[this.contextStack.length - 1];
  }

  /**
   * Get fallback context when no context is set
   */
  private getFallbackContext(): ExecutionContext {
    return { tick: this.currentTick, source: 'framework', sourceId: 'unknown' };
  }

  // ===========================================================================
  // MUTATION RECORDING
  // ===========================================================================

  /**
   * Record an entity creation.
   */
  recordEntityCreated(data: EntityCreatedData): void {
    this.mutations.push({
      type: 'entity_created',
      tick: this.currentTick,
      context: this.getCurrentContext() ?? this.getFallbackContext(),
      data,
    });
  }

  /**
   * Record a relationship creation.
   */
  recordRelationshipCreated(data: RelationshipCreatedData): void {
    this.mutations.push({
      type: 'relationship_created',
      tick: this.currentTick,
      context: this.getCurrentContext() ?? this.getFallbackContext(),
      data,
    });
  }

  /**
   * Record a relationship archival/dissolution.
   */
  recordRelationshipArchived(data: RelationshipArchivedData): void {
    this.mutations.push({
      type: 'relationship_archived',
      tick: this.currentTick,
      context: this.getCurrentContext() ?? this.getFallbackContext(),
      data,
    });
  }

  /**
   * Record a tag addition.
   */
  recordTagAdded(entityId: string, tag: string, value: string | boolean): void {
    this.mutations.push({
      type: 'tag_added',
      tick: this.currentTick,
      context: this.getCurrentContext() ?? this.getFallbackContext(),
      data: { entityId, tag, value },
    });
  }

  /**
   * Record a tag removal.
   */
  recordTagRemoved(entityId: string, tag: string): void {
    this.mutations.push({
      type: 'tag_removed',
      tick: this.currentTick,
      context: this.getCurrentContext() ?? this.getFallbackContext(),
      data: { entityId, tag },
    });
  }

  /**
   * Record a field change (status, prominence, etc.).
   */
  recordFieldChanged(
    entityId: string,
    field: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    this.mutations.push({
      type: 'field_changed',
      tick: this.currentTick,
      context: this.getCurrentContext() ?? this.getFallbackContext(),
      data: { entityId, field, oldValue, newValue },
    });
  }

  // ===========================================================================
  // QUERYING
  // ===========================================================================

  /**
   * Get all mutations recorded this tick.
   */
  getMutations(): TrackedMutation[] {
    return this.mutations;
  }

  /**
   * Get mutations grouped by execution context.
   * This is the primary API for event generation.
   */
  getMutationsByContext(): Map<string, ContextMutationGroup> {
    const grouped = new Map<string, ContextMutationGroup>();

    for (const mutation of this.mutations) {
      const key = contextKey(mutation.context);
      let group = grouped.get(key);

      if (!group) {
        group = {
          context: mutation.context,
          key,
          mutations: [],
          entitiesCreated: [],
          relationshipsCreated: [],
          relationshipsArchived: [],
          tagsAdded: [],
          tagsRemoved: [],
          fieldsChanged: [],
        };
        grouped.set(key, group);
      }

      group.mutations.push(mutation);

      // Populate convenience accessors
      switch (mutation.type) {
        case 'entity_created':
          group.entitiesCreated.push(mutation.data as EntityCreatedData);
          break;
        case 'relationship_created':
          group.relationshipsCreated.push(mutation.data as RelationshipCreatedData);
          break;
        case 'relationship_archived':
          group.relationshipsArchived.push(mutation.data as RelationshipArchivedData);
          break;
        case 'tag_added':
          group.tagsAdded.push(mutation.data as TagChangeData);
          break;
        case 'tag_removed':
          group.tagsRemoved.push(mutation.data as TagChangeData);
          break;
        case 'field_changed':
          group.fieldsChanged.push(mutation.data as FieldChangeData);
          break;
      }
    }

    return grouped;
  }

  /**
   * Get all entity IDs created this tick (for quick lookup).
   */
  getCreatedEntityIds(): Set<string> {
    const ids = new Set<string>();
    for (const m of this.mutations) {
      if (m.type === 'entity_created') {
        ids.add((m.data as EntityCreatedData).entityId);
      }
    }
    return ids;
  }

  /**
   * Check if an entity was created this tick.
   */
  wasEntityCreatedThisTick(entityId: string): boolean {
    return this.mutations.some(
      m => m.type === 'entity_created' && (m.data as EntityCreatedData).entityId === entityId
    );
  }

  /**
   * Get the context that created an entity (if created this tick).
   */
  getEntityCreationContext(entityId: string): ExecutionContext | null {
    const mutation = this.mutations.find(
      m => m.type === 'entity_created' && (m.data as EntityCreatedData).entityId === entityId
    );
    return mutation?.context ?? null;
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  /**
   * Clear all tracked mutations. Called at end of each tick after event generation.
   */
  clear(): void {
    this.mutations = [];
    this.contextStack = [];
  }

  /**
   * Get count of tracked mutations (for debugging/metrics).
   */
  get mutationCount(): number {
    return this.mutations.length;
  }
}
