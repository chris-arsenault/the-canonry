/**
 * State Change Tracker
 *
 * Captures entity state changes during simulation ticks and generates
 * NarrativeEvents for story generation. Integrates with the NarrativeEventBuilder
 * to create meaningful narrative hooks from simulation data.
 *
 * Tracks:
 * - Entity state changes (status, prominence, culture)
 * - Relationship dissolutions (when relationships are archived)
 * - Succession events (when container entities with part_of relationships end)
 * - Coalescence events (when multiple entities join under one container)
 * - Polarity-based events (betrayal, reconciliation, rivalry, alliance, downfall, triumph, power_vacuum)
 *
 * ## Lineage Integration (see LINEAGE.md)
 *
 * This tracker integrates with the lineage system via MutationTracker:
 * - Entities and relationships have createdBy stamped by the Graph
 * - Tag/field changes are tracked transiently by MutationTracker
 * - Event generation uses lineage to avoid duplicates (e.g., template-created
 *   relationships don't also emit separate relationship_formed events)
 */

import type { NarrativeEvent, Polarity, RelationshipKindDefinition, EntityKindDefinition, TagDefinition, ExecutionContext, NarrativeEntityRef, ParticipantEffect } from '@canonry/world-schema';
import { FRAMEWORK_RELATIONSHIP_KINDS, FRAMEWORK_TAGS } from '@canonry/world-schema';
import type { HardState } from '../core/worldTypes.js';
import type { Graph, NarrativeConfig } from '../engine/types.js';
import { NarrativeEventBuilder, type NarrativeContext } from './narrativeEventBuilder.js';
import { SemanticEnricher, type EnrichmentContext } from './semanticEnricher.js';
import type { MutationTracker, ContextMutationGroup, EntityCreatedData, RelationshipCreatedData, RelationshipArchivedData, FieldChangeData, TagChangeData } from './mutationTracker.js';
import { contextKey } from './mutationTracker.js';
import { getProminenceValue } from './significanceCalculator.js';

/**
 * Pending state change accumulated during a tick
 */
interface PendingStateChange {
  entityId: string;
  field: string;
  previousValue: unknown;
  newValue: unknown;
  catalyst?: { entityId: string; actionType: string; success?: boolean };
}

/**
 * Snapshot of a relationship for comparison
 */
interface RelationshipSnapshot {
  kind: string;
  src: string;
  dst: string;
  createdAt: number;
  polarity?: Polarity;
}

/**
 * Snapshot of part_of relationships for an entity
 */
interface PartOfSnapshot {
  /** Entity IDs that are part_of this container */
  memberIds: Set<string>;
}

/**
 * Pending tag change accumulated during a tick
 */
interface PendingTagChange {
  entityId: string;
  tag: string;
  changeType: 'added' | 'removed';
  value?: string | boolean;
  catalyst?: { entityId: string; actionType: string; success?: boolean };
}

/**
 * Relationship summary for creation batch events
 */
export interface RelationshipSummary {
  kind: string;
  count: number;
}

/**
 * Pending creation batch from template execution
 */
interface PendingCreationBatch {
  templateId: string;
  templateName: string;
  entityIds: string[];
  relationships: RelationshipSummary[];
  description?: string;
  /** Domain-controlled narration from narrationTemplate */
  narration?: string;
}

/**
 * Schema slice needed for polarity lookups
 */
export interface NarrativeSchemaSlice {
  relationshipKinds: RelationshipKindDefinition[];
  entityKinds: EntityKindDefinition[];
  tagRegistry?: TagDefinition[];
}

/**
 * Tracks state changes during simulation and generates narrative events
 */
export class StateChangeTracker {
  // Debug flag for tracing prominence changes - mirrors Graph.DEBUG_PROMINENCE
  static DEBUG_PROMINENCE = false;

  private config: NarrativeConfig;
  private eventBuilder: NarrativeEventBuilder | null = null;
  private pendingChanges: Map<string, PendingStateChange[]> = new Map();
  private graph: Graph | null = null;
  private schema: NarrativeSchemaSlice | null = null;

  // Relationship tracking
  private relationshipSnapshotAtTickStart: Map<string, RelationshipSnapshot> = new Map();
  private partOfSnapshotAtTickStart: Map<string, PartOfSnapshot> = new Map();
  private authorityConnectionsAtTickStart: Map<string, Set<string>> = new Map();
  private currentTick: number = 0;

  // Polarity lookup caches
  private relationshipPolarityCache: Map<string, Polarity | undefined> = new Map();
  private statusPolarityCache: Map<string, Polarity | undefined> = new Map();
  private authoritySubtypeCache: Set<string> = new Set();

  // Tag tracking
  private pendingTagChanges: Map<string, PendingTagChange[]> = new Map();
  private tagRegistry: Map<string, TagDefinition> = new Map();
  private frameworkTagSet: Set<string> = new Set(Object.values(FRAMEWORK_TAGS));

  // Creation batch tracking
  private pendingCreationBatches: PendingCreationBatch[] = [];

  // Narration tracking per execution context
  // Key is context key (e.g., "action:seize_control:42"), value is narration text
  private pendingNarrations: Map<string, string> = new Map();

  /**
   * Mutation tracker for lineage information (see LINEAGE.md).
   * Used to determine execution context for deduplication.
   */
  private mutationTracker: MutationTracker | null = null;

  /**
   * Semantic enricher for pattern detection (war, coalescence, etc.)
   */
  private semanticEnricher: SemanticEnricher | null = null;

  /**
   * System ID to display name mapping for narrative descriptions.
   */
  private systemNames: Map<string, string> = new Map();

  constructor(config: NarrativeConfig, mutationTracker?: MutationTracker) {
    this.config = config;
    this.mutationTracker = mutationTracker ?? null;
  }

  /**
   * Set system display names for narrative descriptions.
   * Maps system IDs (e.g., "corruption_harm") to display names (e.g., "Corruption Harm").
   */
  setSystemNames(systems: Array<{ id: string; name: string }>): void {
    this.systemNames.clear();
    for (const sys of systems) {
      this.systemNames.set(sys.id, sys.name);
    }
  }

  /**
   * Get display name for a system ID, falling back to ID if not found.
   * Handles entity-specific suffixes like "prominence_evolution:entity_id"
   * by stripping the suffix and looking up the base system ID.
   */
  private getSystemDisplayName(sourceId: string): string {
    // Try exact match first
    const exact = this.systemNames.get(sourceId);
    if (exact) return exact;

    // Strip entity-specific suffix (e.g., "prominence_evolution:entity_id" -> "prominence_evolution")
    const colonIndex = sourceId.indexOf(':');
    if (colonIndex > 0) {
      const baseId = sourceId.substring(0, colonIndex);
      const baseName = this.systemNames.get(baseId);
      if (baseName) return baseName;
    }

    // No match - return raw ID to surface misconfiguration
    return sourceId;
  }

  /**
   * Set schema for polarity lookups
   * Call once at engine initialization
   */
  setSchema(schema: NarrativeSchemaSlice): void {
    this.schema = schema;

    // Build lookup caches
    this.relationshipPolarityCache.clear();
    for (const rel of schema.relationshipKinds) {
      if (rel.polarity) {
        this.relationshipPolarityCache.set(rel.kind, rel.polarity);
      }
    }

    this.statusPolarityCache.clear();
    this.authoritySubtypeCache.clear();
    for (const entityKind of schema.entityKinds) {
      // Cache status polarities as "entityKind:statusId" -> polarity
      for (const status of entityKind.statuses) {
        if (status.polarity) {
          this.statusPolarityCache.set(`${entityKind.kind}:${status.id}`, status.polarity);
        }
      }
      // Cache authority subtypes
      for (const subtype of entityKind.subtypes) {
        if (subtype.isAuthority) {
          this.authoritySubtypeCache.add(`${entityKind.kind}:${subtype.id}`);
        }
      }
    }

    // Build tag registry cache
    this.tagRegistry.clear();
    if (schema.tagRegistry) {
      for (const tag of schema.tagRegistry) {
        this.tagRegistry.set(tag.tag, tag);
      }
    }
  }

  /**
   * Get relationship polarity from cache
   */
  private getRelationshipPolarity(kind: string): Polarity | undefined {
    return this.relationshipPolarityCache.get(kind);
  }

  /**
   * Get status polarity from cache
   */
  private getStatusPolarity(entityKind: string, statusId: string): Polarity | undefined {
    return this.statusPolarityCache.get(`${entityKind}:${statusId}`);
  }

  /**
   * Check if subtype is an authority position
   */
  private isAuthoritySubtype(entityKind: string, subtype: string): boolean {
    return this.authoritySubtypeCache.has(`${entityKind}:${subtype}`);
  }

  /**
   * Create a unique key for a relationship
   */
  private relationshipKey(src: string, dst: string, kind: string): string {
    return `${src}|${dst}|${kind}`;
  }

  /**
   * Initialize tracker for a new tick
   */
  startTick(graph: Graph, tick: number, eraId: string): void {
    if (!this.config.enabled) return;

    this.graph = graph;
    this.currentTick = tick;
    this.pendingChanges.clear();
    this.pendingTagChanges.clear();
    this.pendingCreationBatches = [];
    this.pendingNarrations.clear();

    // Snapshot active relationships at tick start (for dissolution detection)
    this.relationshipSnapshotAtTickStart.clear();
    for (const rel of graph.getRelationships({ includeHistorical: false })) {
      const key = this.relationshipKey(rel.src, rel.dst, rel.kind);
      this.relationshipSnapshotAtTickStart.set(key, {
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
        createdAt: rel.createdAt ?? 0,
        polarity: this.getRelationshipPolarity(rel.kind),
      });
    }

    // Snapshot part_of relationships at tick start (for coalescence/succession detection)
    this.partOfSnapshotAtTickStart.clear();
    for (const rel of graph.getRelationships({ includeHistorical: false })) {
      if (rel.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF) {
        const containerId = rel.dst;
        let snapshot = this.partOfSnapshotAtTickStart.get(containerId);
        if (!snapshot) {
          snapshot = { memberIds: new Set() };
          this.partOfSnapshotAtTickStart.set(containerId, snapshot);
        }
        snapshot.memberIds.add(rel.src);
      }
    }

    // Snapshot authority connections at tick start (for first-authority detection)
    this.authorityConnectionsAtTickStart.clear();
    const addAuthorityConnection = (targetId: string, authorityId: string) => {
      let authorities = this.authorityConnectionsAtTickStart.get(targetId);
      if (!authorities) {
        authorities = new Set<string>();
        this.authorityConnectionsAtTickStart.set(targetId, authorities);
      }
      authorities.add(authorityId);
    };
    for (const rel of graph.getRelationships({ includeHistorical: false })) {
      const srcEntity = graph.getEntity(rel.src);
      const dstEntity = graph.getEntity(rel.dst);
      if (!srcEntity || !dstEntity) continue;
      const srcIsAuthority = this.isAuthoritySubtype(srcEntity.kind, srcEntity.subtype);
      const dstIsAuthority = this.isAuthoritySubtype(dstEntity.kind, dstEntity.subtype);
      if (srcIsAuthority) addAuthorityConnection(rel.dst, rel.src);
      if (dstIsAuthority) addAuthorityConnection(rel.src, rel.dst);
    }

    // Create or update the event builder context with polarity lookups
    const context: NarrativeContext = {
      tick,
      eraId,
      getEntity: (id: string) => graph.getEntity(id),
      getEntityRelationships: (id: string) => {
        return graph.getEntityRelationships(id).map(r => ({
          kind: r.kind,
          src: r.src,
          dst: r.dst,
        }));
      },
      getRelationshipPolarity: (kind: string) => this.getRelationshipPolarity(kind),
      getStatusPolarity: (entityKind: string, status: string) => this.getStatusPolarity(entityKind, status),
      getRelationshipVerb: (kind: string, action: 'formed' | 'ended' | 'inverseFormed' | 'inverseEnded') => {
        // Look up verb from schema if available
        const relDef = this.schema?.relationshipKinds.find(r => r.kind === kind);
        return relDef?.verbs?.[action as keyof typeof relDef.verbs];
      },
    };

    if (!this.eventBuilder) {
      this.eventBuilder = new NarrativeEventBuilder(context);
    } else {
      this.eventBuilder.updateContext(context);
    }

    // Create or update the semantic enricher context
    const enrichmentContext: EnrichmentContext = {
      getEntity: (id: string) => graph.getEntity(id),
      getEntityRelationships: (id: string) => graph.getEntityRelationships(id).map(r => ({
        kind: r.kind,
        src: r.src,
        dst: r.dst,
      })),
      isNegativeRelationship: (kind: string) => this.getRelationshipPolarity(kind) === 'negative',
      isAuthoritySubtype: (subtype: string) => {
        // Check all entity kinds for this subtype being an authority
        for (const [key] of this.authoritySubtypeCache) {
          if (key.endsWith(`:${subtype}`)) return true;
        }
        return false;
      },
      getPartOfMembers: (entityId: string) => {
        const members: string[] = [];
        for (const rel of graph.getRelationships({ includeHistorical: false })) {
          if (rel.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF && rel.dst === entityId) {
            members.push(rel.src);
          }
        }
        return members;
      },
    };

    if (!this.semanticEnricher) {
      this.semanticEnricher = new SemanticEnricher(enrichmentContext);
    } else {
      this.semanticEnricher.updateContext(enrichmentContext);
    }
  }

  /**
   * Record an entity state change
   * Call this BEFORE applying the change to capture the previous value
   */
  recordChange(
    entityId: string,
    field: string,
    previousValue: unknown,
    newValue: unknown,
    catalyst?: { entityId: string; actionType: string }
  ): void {
    if (!this.config.enabled) return;

    // Debug logging for prominence tracking
    if (StateChangeTracker.DEBUG_PROMINENCE && field === 'prominence') {
      console.log(`[PROMINENCE-TRACK] entityId=${entityId} prev=${previousValue} new=${newValue} catalyst=${catalyst?.actionType}`);
      if (previousValue === newValue) {
        console.log(`  SKIPPED: previousValue === newValue`);
      }
    }

    if (previousValue === newValue) return; // No actual change

    // Only track narratively significant fields
    const significantFields = ['status', 'prominence', 'culture'];
    if (!significantFields.includes(field)) return;

    const pending: PendingStateChange = {
      entityId,
      field,
      previousValue,
      newValue,
      catalyst,
    };

    const existing = this.pendingChanges.get(entityId) || [];
    existing.push(pending);
    this.pendingChanges.set(entityId, existing);

    // Debug: confirm recording
    if (StateChangeTracker.DEBUG_PROMINENCE && field === 'prominence') {
      console.log(`  RECORDED: ${previousValue} -> ${newValue}`);
    }
  }

  /**
   * Record entity state change by providing entity and changes object
   * Convenience method that extracts individual field changes
   */
  recordEntityChange(
    entity: HardState,
    changes: Partial<HardState>,
    catalyst?: { entityId: string; actionType: string; success?: boolean }
  ): void {
    if (!this.config.enabled) return;

    for (const [field, newValue] of Object.entries(changes)) {
      const previousValue = (entity as unknown as Record<string, unknown>)[field];
      this.recordChange(entity.id, field, previousValue, newValue, catalyst);
    }
  }

  /**
   * Record a tag change for narrative event generation.
   * Call this when a tag is added or removed during simulation.
   *
   * @param entityId - The entity whose tag changed
   * @param tag - The tag that was added or removed
   * @param changeType - Whether the tag was 'added' or 'removed'
   * @param value - The tag value (for added tags)
   * @param catalyst - What caused the change (system/action)
   */
  recordTagChange(
    entityId: string,
    tag: string,
    changeType: 'added' | 'removed',
    value: string | boolean | undefined,
    catalyst?: { entityId: string; actionType: string; success?: boolean }
  ): void {
    if (!this.config.enabled) return;

    // Skip framework tags (internal machinery, not narratively interesting)
    if (this.frameworkTagSet.has(tag)) return;

    // Skip system tags (prefixed with sys_)
    if (tag.startsWith('sys_')) return;

    const pending: PendingTagChange = {
      entityId,
      tag,
      changeType,
      value,
      catalyst,
    };

    const existing = this.pendingTagChanges.get(entityId) || [];
    existing.push(pending);
    this.pendingTagChanges.set(entityId, existing);
  }

  /**
   * Record a creation batch from template execution.
   * Call this after a template successfully creates entities/relationships.
   *
   * @param templateId - The template's ID
   * @param templateName - The template's display name
   * @param entityIds - IDs of all entities created by this template
   * @param relationships - Summary of relationship kinds created
   * @param description - Optional description from the template's first creation item
   * @param narration - Optional domain-controlled narration from narrationTemplate
   */
  recordCreationBatch(
    templateId: string,
    templateName: string,
    entityIds: string[],
    relationships: RelationshipSummary[],
    description?: string,
    narration?: string
  ): void {
    if (!this.config.enabled) return;

    this.pendingCreationBatches.push({
      templateId,
      templateName,
      entityIds,
      relationships,
      description,
      narration,
    });
  }

  /**
   * Record a domain-controlled narration for an execution context.
   * The narration will be used as the event description when generating
   * the narrative event for this context.
   *
   * @param source - The source type ('action', 'system', etc.)
   * @param sourceId - The source identifier (action ID, system ID)
   * @param narration - The domain-controlled narration text
   */
  recordNarration(source: string, sourceId: string, narration: string): void {
    if (!this.config.enabled) return;

    const key = `${source}:${sourceId}:${this.currentTick}`;
    this.pendingNarrations.set(key, narration);
  }

  /**
   * Record narrations from a system result.
   * Each narration is recorded with the system context.
   *
   * @param systemId - The system identifier
   * @param narrations - Array of narration texts from the system
   * @deprecated Use recordNarrationsByGroup for proper per-entity attribution
   */
  recordSystemNarrations(systemId: string, narrations: string[]): void {
    if (!this.config.enabled || narrations.length === 0) return;

    // Join multiple narrations into one (or use the first one)
    const combinedNarration = narrations.join(' ');
    this.recordNarration('system', systemId, combinedNarration);
  }

  /**
   * Record narrations keyed by narrative group ID.
   * This ensures proper attribution when a system/action affects multiple entities.
   *
   * @param source - 'system' or 'action'
   * @param baseSourceId - The base system/action ID (e.g., 'corruption_harm' or 'universal_catalyst')
   * @param narrationsByGroup - Map of narrativeGroupId to narration text
   */
  recordNarrationsByGroup(
    source: 'system' | 'action',
    baseSourceId: string,
    narrationsByGroup: Record<string, string>
  ): void {
    if (!this.config.enabled) return;

    for (const [groupId, narration] of Object.entries(narrationsByGroup)) {
      // Key format: "system:corruption_harm:entity-123:tick" or "action:master_ability:entity-456:tick"
      const sourceId = `${baseSourceId}:${groupId}`;
      this.recordNarration(source, sourceId, narration);
    }
  }

  /**
   * Flush pending changes and generate narrative events
   * Call this at the end of each tick
   * @returns Array of generated narrative events above the significance threshold
   *
   * ## Context-Based Event Generation (LINEAGE system)
   *
   * This method now uses context-based deduplication:
   * 1. All mutations are tracked in MutationTracker with their execution context
   * 2. Mutations are grouped by context (template:X, system:Y, action:Z)
   * 3. ONE rich event is generated per context instead of many small events
   *
   * This eliminates duplicate events where the same logical action (e.g., template
   * creating a hero with 5 relationships) would previously generate many events.
   */
  flush(): NarrativeEvent[] {
    if (!this.config.enabled || !this.eventBuilder || !this.graph) {
      this.pendingChanges.clear();
      this.pendingTagChanges.clear();
      this.pendingCreationBatches = [];
      this.pendingNarrations.clear();
      return [];
    }

    // Generate context-based events (one per execution context)
    // This is the unified approach - all events come from mutation tracking
    const events = this.generateContextBasedEvents();

    // Post-process with semantic enricher to detect patterns
    // (war, coalescence, power vacuum, succession, etc.)
    const enrichedEvents = this.semanticEnricher
      ? this.semanticEnricher.enrichEvents(events)
      : events;

    this.pendingChanges.clear();
    this.pendingTagChanges.clear();
    this.pendingCreationBatches = [];
    this.pendingNarrations.clear();
    return enrichedEvents;
  }

  // ===========================================================================
  // CONTEXT-BASED EVENT GENERATION (new unified approach)
  // ===========================================================================

  /**
   * Generate events grouped by execution context.
   * This is the new unified approach - ONE event per context.
   *
   * For each execution context (template, system, action, etc.), we generate
   * a single rich event that captures everything that happened in that context.
   */
  private generateContextBasedEvents(): NarrativeEvent[] {
    if (!this.eventBuilder || !this.graph || !this.mutationTracker) {
      return [];
    }

    const events: NarrativeEvent[] = [];
    const contextGroups = this.mutationTracker.getMutationsByContext();

    for (const [key, group] of contextGroups) {
      const event = this.buildEventForContext(group);
      if (event && event.significance >= this.config.minSignificance) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Build a single rich event for a context mutation group.
   * The event type and structure depends on what happened in the context.
   */
  private buildEventForContext(group: ContextMutationGroup): NarrativeEvent | null {
    if (!this.eventBuilder || !this.graph) return null;

    const { context, entitiesCreated, relationshipsCreated, relationshipsArchived, tagsAdded, tagsRemoved, fieldsChanged } = group;

    // Determine the primary event type based on what happened
    const hasEntities = entitiesCreated.length > 0;
    const hasRelationships = relationshipsCreated.length > 0;
    const hasArchivals = relationshipsArchived.length > 0;
    const hasTagChanges = tagsAdded.length > 0 || tagsRemoved.length > 0;
    const hasFieldChanges = fieldsChanged.length > 0;

    // Template contexts with entity creation → creation_batch
    if (context.source === 'template' && hasEntities) {
      return this.buildTemplateEvent(group);
    }

    // System contexts with any changes → system_action
    if (context.source === 'system') {
      return this.buildSystemEvent(group);
    }

    // Action contexts → action_executed
    if (context.source === 'action') {
      return this.buildActionEvent(group);
    }

    // Framework/fallback contexts - generate individual events for significant changes
    // These are outside normal execution flow
    if (hasFieldChanges) {
      return this.buildFrameworkEvent(group);
    }

    return null;
  }

  /**
   * Build an event for template execution.
   * Templates typically create entities and their initial relationships/tags.
   * Uses participantEffects to show what happened to each entity.
   */
  private buildTemplateEvent(group: ContextMutationGroup): NarrativeEvent | null {
    if (!this.eventBuilder || !this.graph) return null;

    const { context, entitiesCreated, relationshipsCreated, tagsAdded, tagsRemoved, fieldsChanged } = group;

    // If nothing happened, skip
    if (entitiesCreated.length === 0 && relationshipsCreated.length === 0) return null;

    // Build participant effects using the event builder
    const participantEffects = this.eventBuilder.buildParticipantEffects(
      entitiesCreated,
      relationshipsCreated,
      [], // templates don't typically archive relationships
      tagsAdded,
      tagsRemoved,
      fieldsChanged
    );

    if (participantEffects.length === 0) return null;

    // Primary entity is the first created entity, or first affected if none created
    const primaryEntity = entitiesCreated.length > 0
      ? participantEffects.find(p => p.effects.some(e => e.type === 'created'))?.entity
      : participantEffects[0]?.entity;

    if (!primaryEntity) return null;

    // Check for domain-controlled narration from the pending creation batch
    const creationBatch = this.pendingCreationBatches.find(b => b.templateId === context.sourceId);
    const narration = creationBatch?.narration;

    // Debug: log narration lookup
    if (!narration) {
      const matchingBatch = this.pendingCreationBatches.find(b => b.templateId === context.sourceId);
      if (!matchingBatch && this.pendingCreationBatches.length > 0) {
        console.warn(`[StateChangeTracker] No batch found for template "${context.sourceId}". Available: [${this.pendingCreationBatches.map(b => b.templateId).join(', ')}]`);
      } else if (matchingBatch && !matchingBatch.narration) {
        console.debug(`[StateChangeTracker] Batch "${context.sourceId}" has no narration (template lacks narrationTemplate)`);
      }
    } else {
      console.debug(`[StateChangeTracker] Using narration for "${context.sourceId}": ${narration.slice(0, 60)}...`);
    }

    // Use narration if available, otherwise build description summarizing what happened
    const description = narration || this.buildTemplateDescription(
      entitiesCreated,
      relationshipsCreated,
      participantEffects,
      context.sourceId
    );

    // Calculate significance
    const significance = Math.min(1.0,
      (entitiesCreated.length * 0.3) +
      (relationshipsCreated.length * 0.1) +
      0.2 // base significance for template execution
    );

    // Build narrative tags
    const entityKinds = new Set(participantEffects.map(p => p.entity.kind));
    const narrativeTags = ['creation', ...entityKinds];
    if (participantEffects.some(p => p.effects.every(e => e.type !== 'created'))) {
      narrativeTags.push('recruitment');
    }

    return {
      id: `tpl-${context.sourceId}-${context.tick}`,
      tick: context.tick,
      era: this.graph.currentEra?.id || 'unknown',
      eventKind: 'creation_batch',
      significance,
      subject: primaryEntity,
      action: 'created',
      participantEffects,
      description,
      causedBy: {
        entityId: context.sourceId,
        actionType: context.sourceId,
      },
      narrativeTags,
    };
  }

  /**
   * Build description for template events.
   */
  private buildTemplateDescription(
    entitiesCreated: EntityCreatedData[],
    relationshipsCreated: RelationshipCreatedData[],
    participantEffects: ParticipantEffect[],
    templateId: string
  ): string {
    const parts: string[] = [];

    // Count created entities by kind
    const kindCounts = new Map<string, number>();
    for (const e of entitiesCreated) {
      kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
    }

    if (kindCounts.size > 0) {
      const entityParts: string[] = [];
      for (const [kind, count] of kindCounts) {
        entityParts.push(`${count} ${kind}${count > 1 ? 's' : ''}`);
      }
      parts.push(`${entityParts.join(', ')} created`);
    }

    // Count recruited (existing entities that got effects but weren't created)
    const createdIds = new Set(entitiesCreated.map(e => e.entityId));
    const recruited = participantEffects.filter(p => !createdIds.has(p.entity.id));
    if (recruited.length > 0) {
      if (recruited.length === 1) {
        parts.push(`${recruited[0].entity.name} recruited`);
      } else if (recruited.length <= 3) {
        parts.push(`${recruited.map(r => r.entity.name).join(', ')} recruited`);
      } else {
        parts.push(`${recruited.length} existing entities recruited`);
      }
    }

    // Relationship summary
    if (relationshipsCreated.length > 0) {
      parts.push(`${relationshipsCreated.length} relationship${relationshipsCreated.length > 1 ? 's' : ''} formed`);
    }

    const templateName = this.getSystemDisplayName(templateId);
    return parts.length > 0
      ? `${parts.join(', ')}, due to ${templateName}.`
      : `Template ${templateName} executed.`;
  }

  /**
   * Build an event for system execution.
   * Systems create relationships, modify entities, etc.
   * Uses participantEffects to show what happened to each entity.
   */
  private buildSystemEvent(group: ContextMutationGroup): NarrativeEvent | null {
    if (!this.eventBuilder || !this.graph) return null;

    const { context, entitiesCreated, relationshipsCreated, relationshipsArchived, tagsAdded, tagsRemoved, fieldsChanged } = group;

    // If nothing significant happened, skip
    if (entitiesCreated.length === 0 &&
        relationshipsCreated.length === 0 &&
        relationshipsArchived.length === 0 &&
        tagsAdded.length === 0 &&
        tagsRemoved.length === 0 &&
        fieldsChanged.length === 0) {
      return null;
    }

    // Build participant effects using the event builder
    const participantEffects = this.eventBuilder.buildParticipantEffects(
      entitiesCreated,
      relationshipsCreated,
      relationshipsArchived,
      tagsAdded,
      tagsRemoved,
      fieldsChanged
    );

    if (participantEffects.length === 0) return null;

    // Primary entity is the first participant
    const primaryEntity = participantEffects[0].entity;

    // Use context-attached narration first, then fall back to key lookup for legacy support
    const narration = context.narration || this.pendingNarrations.get(
      `${context.source}:${context.sourceId}:${context.tick}`
    );

    // Use narration if available, otherwise build description
    const description = narration || this.buildSystemDescription(
      entitiesCreated,
      relationshipsCreated,
      relationshipsArchived,
      tagsAdded,
      tagsRemoved,
      fieldsChanged,
      participantEffects,
      context.sourceId
    );

    // Calculate significance based on impact
    const significance = Math.min(1.0,
      (entitiesCreated.length * 0.3) +
      (relationshipsCreated.length * 0.15) +
      (relationshipsArchived.length * 0.1) +
      (fieldsChanged.length * 0.2) +
      (tagsAdded.length * 0.05) +
      (tagsRemoved.length * 0.05)
    );

    // Collect entity kinds for narrative tags
    const entityKinds = new Set(participantEffects.map(p => p.entity.kind));
    const narrativeTags = ['system', context.sourceId, ...entityKinds];

    return {
      id: `sys-${context.sourceId}-${context.tick}`,
      tick: context.tick,
      era: this.graph.currentEra?.id || 'unknown',
      eventKind: 'state_change',
      significance,
      subject: primaryEntity,
      action: context.sourceId,
      participantEffects,
      description,
      causedBy: {
        actionType: `system:${context.sourceId}`,
      },
      narrativeTags,
    };
  }

  /**
   * Build an event for action execution.
   * Actions are agent-initiated behaviors with clear causation.
   * Uses participantEffects to show what happened to each entity.
   */
  private buildActionEvent(group: ContextMutationGroup): NarrativeEvent | null {
    if (!this.eventBuilder || !this.graph) return null;

    const { context, entitiesCreated, relationshipsCreated, relationshipsArchived, tagsAdded, tagsRemoved, fieldsChanged } = group;

    // If nothing significant happened, skip
    if (entitiesCreated.length === 0 &&
        relationshipsCreated.length === 0 &&
        relationshipsArchived.length === 0 &&
        tagsAdded.length === 0 &&
        tagsRemoved.length === 0 &&
        fieldsChanged.length === 0) {
      return null;
    }

    // Build participant effects using the event builder
    const participantEffects = this.eventBuilder.buildParticipantEffects(
      entitiesCreated,
      relationshipsCreated,
      relationshipsArchived,
      tagsAdded,
      tagsRemoved,
      fieldsChanged
    );

    if (participantEffects.length === 0) return null;

    // Primary entity is the first participant
    const primaryEntity = participantEffects[0].entity;

    // Use context-attached narration first, then fall back to key lookup for legacy support
    const narration = context.narration || this.pendingNarrations.get(
      `${context.source}:${context.sourceId}:${context.tick}`
    );

    // Use narration if available, otherwise build description
    const description = narration || this.buildActionDescription(
      entitiesCreated,
      relationshipsCreated,
      relationshipsArchived,
      tagsAdded,
      tagsRemoved,
      fieldsChanged,
      participantEffects,
      context.sourceId
    );

    // Calculate significance based on impact
    const significance = Math.min(1.0,
      (entitiesCreated.length * 0.3) +
      (relationshipsCreated.length * 0.15) +
      (relationshipsArchived.length * 0.15) +
      (fieldsChanged.length * 0.2) +
      (tagsAdded.length * 0.05) +
      (tagsRemoved.length * 0.05)
    );

    // Collect entity kinds for narrative tags
    const entityKinds = new Set(participantEffects.map(p => p.entity.kind));
    const narrativeTags = ['action', context.sourceId, ...entityKinds];

    return {
      id: `act-${context.sourceId}-${context.tick}`,
      tick: context.tick,
      era: this.graph.currentEra?.id || 'unknown',
      eventKind: 'state_change',
      significance,
      subject: primaryEntity,
      action: context.sourceId,
      participantEffects,
      description,
      causedBy: {
        actionType: `action:${context.sourceId}`,
        success: context.success,
      },
      narrativeTags,
    };
  }

  /**
   * Build an event for framework/unknown context.
   * These are typically initialization or cleanup operations.
   * Uses participantEffects to show what happened to each entity.
   */
  private buildFrameworkEvent(group: ContextMutationGroup): NarrativeEvent | null {
    // For framework events, only generate if there are significant field changes
    if (!this.eventBuilder || !this.graph) return null;

    const { context, fieldsChanged, tagsAdded, tagsRemoved } = group;
    if (fieldsChanged.length === 0 && tagsAdded.length === 0 && tagsRemoved.length === 0) return null;

    // Build participant effects using the event builder
    const participantEffects = this.eventBuilder.buildParticipantEffects(
      [], // no entities created in framework events
      [], // no relationships created
      [], // no relationships archived
      tagsAdded,
      tagsRemoved,
      fieldsChanged
    );

    if (participantEffects.length === 0) return null;

    // Primary entity is the first participant
    const primaryEntity = participantEffects[0].entity;

    // Build description summarizing what happened
    const description = this.buildFrameworkDescription(
      fieldsChanged,
      tagsAdded,
      tagsRemoved,
      participantEffects,
      context.sourceId
    );

    const sourceLabel = context.sourceId !== 'unknown' ? context.sourceId : 'framework';
    const entityKinds = new Set(participantEffects.map(p => p.entity.kind));
    const narrativeTags = sourceLabel === 'framework'
      ? ['framework', ...entityKinds]
      : ['framework', sourceLabel, ...entityKinds];

    return {
      id: `fw-${context.tick}-${Math.random().toString(36).substr(2, 9)}`,
      tick: context.tick,
      era: this.graph.currentEra?.id || 'unknown',
      eventKind: 'state_change',
      significance: 0.3,
      subject: primaryEntity,
      action: 'framework_update',
      participantEffects,
      description,
      narrativeTags,
    };
  }

  // ===========================================================================
  // UNIFIED DESCRIPTION BUILDERS
  // ===========================================================================

  /**
   * Build description for system events.
   * Uses participantEffects to summarize what happened.
   */
  private buildSystemDescription(
    entitiesCreated: EntityCreatedData[],
    relationshipsCreated: RelationshipCreatedData[],
    relationshipsArchived: RelationshipArchivedData[],
    tagsAdded: TagChangeData[],
    tagsRemoved: TagChangeData[],
    fieldsChanged: FieldChangeData[],
    participantEffects: ParticipantEffect[],
    sourceId: string
  ): string {
    return this.buildUnifiedDescription(
      entitiesCreated,
      relationshipsCreated,
      relationshipsArchived,
      tagsAdded,
      tagsRemoved,
      fieldsChanged,
      participantEffects,
      sourceId,
      'system'
    );
  }

  /**
   * Build description for action events.
   * Uses participantEffects to summarize what happened.
   */
  private buildActionDescription(
    entitiesCreated: EntityCreatedData[],
    relationshipsCreated: RelationshipCreatedData[],
    relationshipsArchived: RelationshipArchivedData[],
    tagsAdded: TagChangeData[],
    tagsRemoved: TagChangeData[],
    fieldsChanged: FieldChangeData[],
    participantEffects: ParticipantEffect[],
    sourceId: string
  ): string {
    return this.buildUnifiedDescription(
      entitiesCreated,
      relationshipsCreated,
      relationshipsArchived,
      tagsAdded,
      tagsRemoved,
      fieldsChanged,
      participantEffects,
      sourceId,
      'action'
    );
  }

  /**
   * Build description for framework events.
   * Uses participantEffects to summarize what happened.
   */
  private buildFrameworkDescription(
    fieldsChanged: FieldChangeData[],
    tagsAdded: TagChangeData[],
    tagsRemoved: TagChangeData[],
    participantEffects: ParticipantEffect[],
    sourceId: string
  ): string {
    return this.buildUnifiedDescription(
      [],
      [],
      [],
      tagsAdded,
      tagsRemoved,
      fieldsChanged,
      participantEffects,
      sourceId,
      'framework'
    );
  }

  /**
   * Build unified description for all event types.
   * Summarizes participantEffects into natural language.
   */
  private buildUnifiedDescription(
    entitiesCreated: EntityCreatedData[],
    relationshipsCreated: RelationshipCreatedData[],
    relationshipsArchived: RelationshipArchivedData[],
    tagsAdded: TagChangeData[],
    tagsRemoved: TagChangeData[],
    fieldsChanged: FieldChangeData[],
    participantEffects: ParticipantEffect[],
    sourceId: string,
    sourceType: 'system' | 'action' | 'framework'
  ): string {
    const parts: string[] = [];

    // Count effects by type across all participants
    let createdCount = 0;
    let relationshipFormedCount = 0;
    let relationshipEndedCount = 0;
    let tagGainedCount = 0;
    let tagLostCount = 0;
    let fieldChangedCount = 0;
    let endedCount = 0;

    for (const p of participantEffects) {
      for (const e of p.effects) {
        switch (e.type) {
          case 'created': createdCount++; break;
          case 'relationship_formed': relationshipFormedCount++; break;
          case 'relationship_ended': relationshipEndedCount++; break;
          case 'tag_gained': tagGainedCount++; break;
          case 'tag_lost': tagLostCount++; break;
          case 'field_changed': fieldChangedCount++; break;
          case 'ended': endedCount++; break;
        }
      }
    }

    // Build summary parts
    if (createdCount > 0) {
      const kindCounts = new Map<string, number>();
      for (const e of entitiesCreated) {
        kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
      }
      const kindParts: string[] = [];
      for (const [kind, count] of kindCounts) {
        kindParts.push(`${count} ${kind}${count > 1 ? 's' : ''}`);
      }
      parts.push(`${kindParts.join(', ')} created`);
    }

    if (relationshipFormedCount > 0) {
      const kindCounts = new Map<string, number>();
      for (const r of relationshipsCreated) {
        kindCounts.set(r.kind, (kindCounts.get(r.kind) || 0) + 1);
      }
      if (kindCounts.size === 1) {
        const [kind, count] = [...kindCounts.entries()][0];
        // Format relationship kind: replace underscores with spaces for readability
        const formattedKind = kind.replace(/_/g, ' ');
        parts.push(`${count} ${formattedKind} relationship${count > 1 ? 's' : ''} formed`);
      } else {
        parts.push(`${relationshipFormedCount} relationships formed`);
      }
    }

    if (relationshipEndedCount > 0) {
      parts.push(`${relationshipEndedCount} relationship${relationshipEndedCount > 1 ? 's' : ''} ended`);
    }

    if (tagGainedCount > 0) {
      const uniqueTags = [...new Set(tagsAdded.map(t => t.tag))];
      if (uniqueTags.length <= 2) {
        // Format tag names: replace underscores with spaces for readability
        const formatted = uniqueTags.map(t => t.replace(/_/g, ' '));
        parts.push(`gained ${formatted.join(', ')}`);
      } else {
        parts.push(`gained ${tagGainedCount} tags`);
      }
    }

    if (tagLostCount > 0) {
      const uniqueTags = [...new Set(tagsRemoved.map(t => t.tag))];
      if (uniqueTags.length <= 2) {
        // Format tag names: replace underscores with spaces for readability
        const formatted = uniqueTags.map(t => t.replace(/_/g, ' '));
        parts.push(`lost ${formatted.join(', ')}`);
      } else {
        parts.push(`lost ${tagLostCount} tags`);
      }
    }

    if (fieldChangedCount > 0 || endedCount > 0) {
      const prominenceChanges = fieldsChanged.filter(f => f.field === 'prominence');
      const statusChanges = fieldsChanged.filter(f => f.field === 'status');

      if (prominenceChanges.length > 0) {
        const rising = prominenceChanges.filter(f => this.isProminenceIncrease(f.oldValue, f.newValue));
        const falling = prominenceChanges.filter(f => !this.isProminenceIncrease(f.oldValue, f.newValue));
        if (rising.length > 0) parts.push(`${rising.length} gained prominence`);
        if (falling.length > 0) parts.push(`${falling.length} lost prominence`);
      }

      if (endedCount > 0) {
        parts.push(`${endedCount} passed into history`);
      }
    }

    // Format participants summary
    const participantNames = participantEffects.slice(0, 3).map(p => p.entity.name);
    const moreCount = participantEffects.length > 3 ? ` +${participantEffects.length - 3} others` : '';
    const whoSummary = participantNames.length > 0
      ? `${participantNames.join(', ')}${moreCount}`
      : 'entities';

    // Build final description
    const sourceName = this.getSystemDisplayName(sourceId);

    if (parts.length === 0) {
      // Framework events with no specific effects - use generic description
      if (sourceType === 'framework') {
        return `${whoSummary} changed.`;
      }
      return `${sourceName} affected ${whoSummary}.`;
    }

    // Framework events don't need "due to Framework" - it's mechanical
    if (sourceType === 'framework') {
      return `${whoSummary}: ${parts.join(', ')}.`;
    }

    return `${whoSummary}: ${parts.join(', ')}, due to ${sourceName}.`;
  }

  /**
   * Get number of pending changes (for diagnostics)
   */
  getPendingCount(): number {
    let count = 0;
    for (const changes of this.pendingChanges.values()) {
      count += changes.length;
    }
    return count;
  }

  /**
   * Check if tracking is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if prominence changed upward
   */
  private isProminenceIncrease(oldValue: unknown, newValue: unknown): boolean {
    // Handle numeric values directly, or convert from string/label
    const oldNum = typeof oldValue === 'number' ? oldValue : getProminenceValue(String(oldValue));
    const newNum = typeof newValue === 'number' ? newValue : getProminenceValue(String(newValue));
    return newNum > oldNum;
  }

}

/**
 * Create a default narrative config (enabled)
 */
export function createDefaultNarrativeConfig(): NarrativeConfig {
  return {
    enabled: true,
    minSignificance: 0,
  };
}
