/**
 * Selection logic for the Chronicle Wizard.
 *
 * Provides role suggestion, validation, and entity/event filtering
 * for the interactive wizard flow.
 */

import type {
  ChronicleRoleAssignment,
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
  EraTemporalInfo,
  ChronicleTemporalContext,
  TemporalScope,
} from '../chronicleTypes';
import type {
  NarrativeStyle,
  RoleDefinition,
  EntityCategory,
  EntityKindDefinition,
} from '@canonry/world-schema';

// =============================================================================
// Category Resolution
// =============================================================================

/**
 * Build a mapping from entity kind to its category.
 * Used to resolve domain-agnostic categories to domain-specific kinds at runtime.
 */
export function buildKindToCategoryMap(
  entityKinds: EntityKindDefinition[]
): Map<string, EntityCategory> {
  const map = new Map<string, EntityCategory>();
  for (const kind of entityKinds) {
    if (kind.category) {
      map.set(kind.kind, kind.category);
    }
  }
  return map;
}

/**
 * Check if an entity's kind is in one of the target categories.
 */
function kindMatchesCategories(
  entityKind: string,
  targetCategories: EntityCategory[] | undefined,
  kindToCategory: Map<string, EntityCategory>
): boolean {
  if (!targetCategories || targetCategories.length === 0) return false;
  const entityCategory = kindToCategory.get(entityKind);
  if (!entityCategory) return false;
  return targetCategories.includes(entityCategory);
}

function resolveEntityEraId(entity: EntityContext | undefined): string | undefined {
  if (!entity) return undefined;
  if (typeof entity.eraId === 'string' && entity.eraId) return entity.eraId;
  return undefined;
}

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface WizardSelectionContext {
  entryPoint: EntityContext;
  candidates: EntityContext[];
  candidateRelationships: RelationshipContext[];
  candidateEvents: NarrativeEventContext[];
  /** Distance map from entry point (preserves paths through non-candidate entities like eras) */
  distances: Map<string, number>;
}

// =============================================================================
// Entity Selection Metrics
// =============================================================================

/**
 * Metrics for an entity candidate used for display and scoring.
 */
export interface EntitySelectionMetrics {
  entityId: string;
  /** Distance from entry point: 0 = entry point, 1 = direct neighbor, 2 = 2-hop */
  distance: number;
  /** Average relationship strength to entry point (0-1, normalized) */
  avgStrength: number;
  /** Number of times this entity has been used in chronicles */
  usageCount: number;
  /** Whether entity is active in the same era as entry point */
  eraAligned: boolean;
  /** Number of new categories this entity would add to current cast */
  addsNewCategory: boolean;
  /** Number of new relationship types this entity brings */
  newRelTypes: number;
}

// =============================================================================
// Neighbor Graph Building
// =============================================================================

interface NeighborGraph {
  ids: Set<string>;
  distances: Map<string, number>;
}

/**
 * Build a graph of entities reachable within maxDepth hops from entrypoint.
 */
export function buildNeighborGraph(
  relationships: RelationshipContext[],
  entrypointId: string,
  maxDepth: number = 2
): NeighborGraph {
  const adjacency = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (!adjacency.has(rel.src)) adjacency.set(rel.src, new Set());
    if (!adjacency.has(rel.dst)) adjacency.set(rel.dst, new Set());
    adjacency.get(rel.src)!.add(rel.dst);
    adjacency.get(rel.dst)!.add(rel.src);
  }

  const distances = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: entrypointId, depth: 0 }];
  distances.set(entrypointId, 0);

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const neighbors = adjacency.get(id);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, depth + 1);
      queue.push({ id: neighbor, depth: depth + 1 });
    }
  }

  return { ids: new Set(distances.keys()), distances };
}

// =============================================================================
// Entity Selection Metrics Computation
// =============================================================================

export interface MetricsContext {
  entryPointId: string;
  relationships: RelationshipContext[];
  distances: Map<string, number>;
  usageStats: Map<string, { usageCount: number }>;
  entryPointEras: Set<string>;
  currentCastCategories: Set<EntityCategory>;
  currentCastRelTypes: Set<string>;
  kindToCategory: Map<string, EntityCategory>;
}

/**
 * Compute selection metrics for a single entity.
 */
export function computeEntityMetrics(
  entity: EntityContext,
  ctx: MetricsContext
): EntitySelectionMetrics {
  const { entryPointId, relationships, distances, usageStats, entryPointEras, currentCastCategories, currentCastRelTypes, kindToCategory } = ctx;

  // Distance
  const distance = distances.get(entity.id) ?? 99;

  // Average relationship strength to entry point
  const relsToEntry = relationships.filter(
    r => (r.src === entity.id && r.dst === entryPointId) ||
         (r.dst === entity.id && r.src === entryPointId)
  );
  const avgStrength = relsToEntry.length > 0
    ? relsToEntry.reduce((sum, r) => sum + (r.strength ?? 0.5), 0) / relsToEntry.length
    : 0;

  // Usage count
  const usage = usageStats.get(entity.id);
  const usageCount = usage?.usageCount ?? 0;

  // Era alignment - check if entity shares any era with entry point
  const entityEraId = resolveEntityEraId(entity);
  const eraAligned = entryPointEras.size === 0 ||
    (entityEraId !== undefined && entryPointEras.has(entityEraId));

  // Category novelty
  const entityCategory = kindToCategory.get(entity.kind);
  const addsNewCategory = entityCategory !== undefined && !currentCastCategories.has(entityCategory);

  // Relationship type diversity
  const entityRelTypes = new Set(
    relationships
      .filter(r => r.src === entity.id || r.dst === entity.id)
      .map(r => r.kind)
  );
  const newRelTypes = [...entityRelTypes].filter(t => !currentCastRelTypes.has(t)).length;

  return {
    entityId: entity.id,
    distance,
    avgStrength,
    usageCount,
    eraAligned,
    addsNewCategory,
    newRelTypes,
  };
}

/**
 * Compute metrics for all candidate entities.
 */
export function computeAllEntityMetrics(
  candidates: EntityContext[],
  entryPointId: string,
  relationships: RelationshipContext[],
  distances: Map<string, number>,
  usageStats: Map<string, { usageCount: number }>,
  currentAssignments: ChronicleRoleAssignment[],
  kindToCategory: Map<string, EntityCategory>
): Map<string, EntitySelectionMetrics> {
  const entryPointEraId = resolveEntityEraId(
    candidates.find(e => e.id === entryPointId)
  );
  const entryPointEras = new Set(entryPointEraId ? [entryPointEraId] : []);

  // Get current cast's categories and relationship types
  const assignedIds = new Set(currentAssignments.map(a => a.entityId));
  const currentCastCategories = new Set<EntityCategory>();
  const currentCastRelTypes = new Set<string>();

  for (const assignment of currentAssignments) {
    const entity = candidates.find(e => e.id === assignment.entityId);
    if (entity) {
      const cat = kindToCategory.get(entity.kind);
      if (cat) currentCastCategories.add(cat);
    }
  }

  for (const rel of relationships) {
    if (assignedIds.has(rel.src) || assignedIds.has(rel.dst)) {
      currentCastRelTypes.add(rel.kind);
    }
  }

  const ctx: MetricsContext = {
    entryPointId,
    relationships,
    distances,
    usageStats,
    entryPointEras,
    currentCastCategories,
    currentCastRelTypes,
    kindToCategory,
  };

  const metricsMap = new Map<string, EntitySelectionMetrics>();
  for (const entity of candidates) {
    metricsMap.set(entity.id, computeEntityMetrics(entity, ctx));
  }

  return metricsMap;
}

// =============================================================================
// Temporal Utilities
// =============================================================================

/**
 * Compute temporal scope from tick range.
 */
export function computeTemporalScope(tickRange: [number, number], isMultiEra: boolean): TemporalScope {
  const duration = tickRange[1] - tickRange[0];

  if (isMultiEra) return 'saga';
  if (duration >= 50) return 'saga';
  if (duration >= 20) return 'arc';
  if (duration >= 5) return 'episode';
  return 'moment';
}

/**
 * Find era for an event - by direct ID match.
 */
export function findEraForEvent(
  event: { tick: number; era?: string },
  eras: EraTemporalInfo[]
): EraTemporalInfo | undefined {
  // Direct ID match (event.era should match era.id)
  if (event.era) {
    const byId = eras.find(e => e.id === event.era);
    if (byId) return byId;
  }
  return undefined;
}

/**
 * Compute the focal era from a set of events.
 * Returns the era that contains the most events.
 */
export function computeFocalEra(
  events: NarrativeEventContext[],
  eras: EraTemporalInfo[]
): EraTemporalInfo | undefined {
  if (events.length === 0 || eras.length === 0) {
    return eras[0]; // Default to first era
  }

  // Count events per era
  const eraCounts = new Map<string, number>();
  for (const event of events) {
    const era = findEraForEvent(event, eras);
    if (era) {
      eraCounts.set(era.id, (eraCounts.get(era.id) || 0) + 1);
    }
  }

  // Find era with most events
  let maxCount = 0;
  let focalEraId: string | undefined;
  for (const [eraId, count] of eraCounts) {
    if (count > maxCount) {
      maxCount = count;
      focalEraId = eraId;
    }
  }

  return eras.find(e => e.id === focalEraId) || eras[0];
}

/**
 * Compute the complete temporal context for a chronicle.
 */
export function computeTemporalContext(
  events: NarrativeEventContext[],
  eras: EraTemporalInfo[],
  entryPoint?: EntityContext,
  focalEraOverrideId?: string | null
): ChronicleTemporalContext {
  // Compute tick range from events
  let minTick = Infinity;
  let maxTick = -Infinity;

  for (const event of events) {
    minTick = Math.min(minTick, event.tick);
    maxTick = Math.max(maxTick, event.tick);
  }

  // Include entry point creation tick if available
  if (entryPoint) {
    minTick = Math.min(minTick, entryPoint.createdAt);
  }

  // Handle edge case of no events
  if (minTick === Infinity) {
    minTick = entryPoint?.createdAt ?? 0;
    maxTick = minTick;
  }

  const chronicleTickRange: [number, number] = [minTick, maxTick];

  // Find touched eras by event era IDs
  const touchedEraIds = new Set<string>();
  for (const event of events) {
    const era = findEraForEvent(event, eras);
    if (era) touchedEraIds.add(era.id);
  }

  const isMultiEra = touchedEraIds.size > 1;
  const temporalScope = computeTemporalScope(chronicleTickRange, isMultiEra);

  // Compute focal era (use override if provided)
  const overrideEra = focalEraOverrideId
    ? eras.find(e => e.id === focalEraOverrideId)
    : undefined;
  const focalEra = overrideEra || computeFocalEra(events, eras) || eras[0];

  // Build temporal description
  const temporalDescription = buildTemporalDescription(
    focalEra,
    chronicleTickRange,
    temporalScope,
    isMultiEra,
    touchedEraIds.size
  );

  return {
    focalEra,
    allEras: eras,
    chronicleTickRange,
    temporalScope,
    isMultiEra,
    touchedEraIds: Array.from(touchedEraIds),
    temporalDescription,
  };
}

/**
 * Build a human-readable temporal description.
 */
function buildTemporalDescription(
  focalEra: EraTemporalInfo,
  tickRange: [number, number],
  scope: TemporalScope,
  isMultiEra: boolean,
  eraCount: number
): string {
  const duration = tickRange[1] - tickRange[0];

  const scopeDescriptions: Record<TemporalScope, string> = {
    moment: 'a brief moment',
    episode: 'a short episode',
    arc: 'an extended arc',
    saga: 'an epic saga',
  };

  if (isMultiEra) {
    return `${scopeDescriptions[scope]} spanning ${eraCount} eras, centered on the ${focalEra.name}`;
  }

  if (duration === 0) {
    return `a single moment during the ${focalEra.name}`;
  }

  return `${scopeDescriptions[scope]} during the ${focalEra.name} (${duration} ticks)`;
}

// =============================================================================
// Event Selection Metrics
// =============================================================================

/**
 * Metrics for an event candidate used for display and scoring.
 */
export interface EventSelectionMetrics {
  eventId: string;
  /** Tick of the event */
  tick: number;
  /** Era ID the event belongs to */
  eraId: string;
  /** Era name for display */
  eraName: string;
  /** Whether event is in the focal era */
  inFocalEra: boolean;
  /** Absolute tick distance from entry point creation */
  tickDistance: number;
  /** Whether event involves the entry point entity */
  involvesEntryPoint: boolean;
  /** Number of assigned entities involved in this event */
  assignedEntityCount: number;
  /** Significance score (0-1) */
  significance: number;
}

/**
 * Compute selection metrics for a single event.
 */
export function computeEventMetrics(
  event: NarrativeEventContext,
  entryPointId: string,
  entryPointTick: number,
  focalEraId: string,
  eras: EraTemporalInfo[],
  assignedEntityIds: Set<string>
): EventSelectionMetrics {
  // Use event era ID and resolve name from eras when possible
  const eventEra = findEraForEvent(event, eras);
  const eraId = eventEra?.id || event.era;
  const eraName = eventEra?.name || event.era;

  // Count how many assigned entities are involved
  let assignedCount = 0;
  if (event.subjectId && assignedEntityIds.has(event.subjectId)) assignedCount++;
  if (event.objectId && assignedEntityIds.has(event.objectId)) assignedCount++;

  // Check if event involves entry point
  const involvesEntryPoint = event.subjectId === entryPointId || event.objectId === entryPointId;

  return {
    eventId: event.id,
    tick: event.tick,
    eraId,
    eraName,
    inFocalEra: eraId === focalEraId,
    tickDistance: Math.abs(event.tick - entryPointTick),
    involvesEntryPoint,
    assignedEntityCount: assignedCount,
    significance: event.significance,
  };
}

/**
 * Compute metrics for all candidate events.
 */
export function computeAllEventMetrics(
  events: NarrativeEventContext[],
  entryPointId: string,
  entryPointTick: number,
  focalEraId: string,
  eras: EraTemporalInfo[],
  assignedEntityIds: Set<string>
): Map<string, EventSelectionMetrics> {
  const metricsMap = new Map<string, EventSelectionMetrics>();

  for (const event of events) {
    metricsMap.set(event.id, computeEventMetrics(
      event,
      entryPointId,
      entryPointTick,
      focalEraId,
      eras,
      assignedEntityIds
    ));
  }

  return metricsMap;
}

/**
 * Score an event for selection based on temporal alignment and relevance.
 */
export function scoreEventForSelection(
  event: NarrativeEventContext,
  metrics: EventSelectionMetrics,
  preferFocalEra: boolean = true
): number {
  let score = 0;

  // Base score from significance
  score += metrics.significance * 30;

  // Bonus for involving entry point
  if (metrics.involvesEntryPoint) {
    score += 20;
  }

  // Bonus for involving multiple assigned entities
  score += metrics.assignedEntityCount * 10;

  // Era alignment bonus/penalty
  if (preferFocalEra) {
    if (metrics.inFocalEra) {
      score += 15;
    } else {
      score -= 10; // Soft penalty for cross-era events
    }
  }

  // Temporal proximity bonus (closer to entry point creation = more relevant)
  // Diminishing returns: 0-10 ticks = 10pts, 10-50 ticks = 5pts, 50+ ticks = 0pts
  if (metrics.tickDistance <= 10) {
    score += 10;
  } else if (metrics.tickDistance <= 50) {
    score += 5;
  }

  // Small randomization to break ties
  score += Math.random() * 3;

  return score;
}

/**
 * Auto-select events based on temporal alignment and relevance.
 * Returns event IDs sorted by score.
 */
export function suggestEventSelection(
  events: NarrativeEventContext[],
  metricsMap: Map<string, EventSelectionMetrics>,
  maxEvents: number = 8,
  preferFocalEra: boolean = true
): string[] {
  const scored = events.map(event => {
    const metrics = metricsMap.get(event.id);
    if (!metrics) return { id: event.id, score: 0 };
    return {
      id: event.id,
      score: scoreEventForSelection(event, metrics, preferFocalEra),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxEvents).map(s => s.id);
}

// =============================================================================
// Entity Filtering
// =============================================================================

/**
 * Filter candidates by style's entity rules.
 * Excludes 'era' entities by default since they are not cast members.
 * @deprecated Entity selection rules removed - this now just filters eras
 */
export function filterCandidatesByStyleRules(
  candidates: EntityContext[],
  _rules?: unknown
): EntityContext[] {
  return candidates.filter((entity) => {
    // Exclude era entities - they are time periods, not cast members
    if (entity.kind === 'era') return false;
    return true;
  });
}

// =============================================================================
// Role Suggestion
// =============================================================================

/**
 * @deprecated Entity selection rules removed - always returns false
 */
export function matchesPrimarySubjectKinds(
  _entity: EntityContext,
  _rules?: unknown,
  _kindToCategory?: Map<string, EntityCategory>
): boolean {
  return false;
}

/**
 * @deprecated Entity selection rules removed - always returns false
 */
export function matchesSupportingSubjectKinds(
  _entity: EntityContext,
  _rules?: unknown,
  _kindToCategory?: Map<string, EntityCategory>
): boolean {
  return false;
}

/**
 * Score an entity for a specific role based on diversity metrics.
 */
function scoreEntityForRole(
  entity: EntityContext,
  role: string,
  relationships: RelationshipContext[],
  metrics?: EntitySelectionMetrics
): number {
  let score = 0;

  // Base score for having data
  score += 10;

  // Text enrichment bonus (summary and description are generated together)
  if (entity.summary && entity.description) {
    score += 10;
  }

  // === METRICS-BASED SCORING ===
  if (metrics) {
    // Distance bonus (closer = better narrative coherence)
    if (metrics.distance === 1) {
      score += 15; // Direct neighbor
    } else if (metrics.distance === 2) {
      score += 8; // 2-hop
    }

    // Relationship strength (stronger ties = more relevant)
    score += Math.round(metrics.avgStrength * 10); // 0-10

    // Era alignment (same era = narratively coherent)
    if (metrics.eraAligned) {
      score += 10;
    }

    // === DIVERSITY PENALTIES ===

    // Penalize overuse - only after 2+ uses (user preference)
    if (metrics.usageCount >= 2) {
      const usagePenalty = Math.min((metrics.usageCount - 1) * 10, 40);
      score -= usagePenalty; // -10 to -40
    }

    // === DIVERSITY BONUSES ===

    // Bonus for adding new category to cast
    if (metrics.addsNewCategory) {
      score += 12;
    }

    // Bonus for bringing new relationship types
    score += Math.min(metrics.newRelTypes * 3, 9); // 0-9

    // Randomization factor (breaks ties, adds variety)
    score += Math.random() * 5;
  }

  return score;
}

/**
 * Auto-suggest role assignments from candidates based on diversity metrics.
 * Entry point is assigned to first protagonist-like role.
 */
export function suggestRoleAssignments(
  candidates: EntityContext[],
  roles: RoleDefinition[],
  entryPointId: string,
  _rules: unknown, // Deprecated - entity selection rules removed
  relationships: RelationshipContext[],
  _kindToCategory: Map<string, EntityCategory>,
  metricsMap?: Map<string, EntitySelectionMetrics>
): ChronicleRoleAssignment[] {
  const assignments: ChronicleRoleAssignment[] = [];
  const usedEntityIds = new Set<string>();

  // Find entry point entity
  const entryPoint = candidates.find(e => e.id === entryPointId);

  // Build role scores for all candidates
  const roleScores = new Map<string, Array<{ entity: EntityContext; score: number }>>();
  for (const roleDef of roles) {
    const scores: Array<{ entity: EntityContext; score: number }> = [];
    for (const entity of candidates) {
      const metrics = metricsMap?.get(entity.id);
      const score = scoreEntityForRole(entity, roleDef.role, relationships, metrics);
      if (score > 0) {
        scores.push({ entity, score });
      }
    }
    scores.sort((a, b) => b.score - a.score);
    roleScores.set(roleDef.role, scores);
  }

  // Assign entry point to first protagonist-like role
  const protagonistRoles = ['protagonist', 'hero', 'doomed', 'focal-point', 'investigator', 'subject', 'player', 'consciousness'];
  if (entryPoint) {
    const firstProtagonistRole = roles.find(r => protagonistRoles.includes(r.role));
    if (firstProtagonistRole) {
      // Entry point is always primary
      assignments.push({
        role: firstProtagonistRole.role,
        entityId: entryPoint.id,
        entityName: entryPoint.name,
        entityKind: entryPoint.kind,
        isPrimary: true,
      });
      usedEntityIds.add(entryPoint.id);
    }
  }

  // Assign remaining roles greedily, respecting min counts
  for (const roleDef of roles) {
    // Skip if already assigned (e.g., protagonist role)
    const existingCount = assignments.filter(a => a.role === roleDef.role).length;
    if (existingCount >= roleDef.count.max) continue;

    const scores = roleScores.get(roleDef.role) || [];
    let assigned = existingCount;

    for (const { entity } of scores) {
      if (assigned >= roleDef.count.max) break;
      if (usedEntityIds.has(entity.id)) continue;

      assignments.push({
        role: roleDef.role,
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        isPrimary: false, // Supporting by default
      });
      usedEntityIds.add(entity.id);
      assigned += 1;
    }
  }

  return assignments;
}

// =============================================================================
// Role Assignment Validation
// =============================================================================

/**
 * Validate role assignments against style constraints.
 */
export function validateRoleAssignments(
  assignments: ChronicleRoleAssignment[],
  roles: RoleDefinition[],
  maxCastSize: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check total cast size
  if (assignments.length > maxCastSize) {
    errors.push(`Too many entities assigned (${assignments.length}/${maxCastSize} max)`);
  }

  // Check each role's min/max constraints
  for (const roleDef of roles) {
    const roleCount = assignments.filter(a => a.role === roleDef.role).length;

    if (roleCount < roleDef.count.min) {
      if (roleDef.count.min === 1) {
        errors.push(`Role "${roleDef.role}" requires at least 1 entity`);
      } else {
        errors.push(`Role "${roleDef.role}" requires at least ${roleDef.count.min} entities (has ${roleCount})`);
      }
    }

    if (roleCount > roleDef.count.max) {
      warnings.push(`Role "${roleDef.role}" has ${roleCount} entities (max ${roleDef.count.max})`);
    }
  }

  // Check for duplicate entity assignments
  const entityCounts = new Map<string, number>();
  for (const assignment of assignments) {
    const count = entityCounts.get(assignment.entityId) || 0;
    entityCounts.set(assignment.entityId, count + 1);
  }
  for (const [entityId, count] of entityCounts) {
    if (count > 1) {
      const entity = assignments.find(a => a.entityId === entityId);
      warnings.push(`Entity "${entity?.entityName}" is assigned to ${count} roles`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================================================
// Relationship & Event Selection
// =============================================================================

/**
 * Get relationships between assigned entities.
 */
export function getRelevantRelationships(
  assignments: ChronicleRoleAssignment[],
  allRelationships: RelationshipContext[]
): RelationshipContext[] {
  const assignedIds = new Set(assignments.map(a => a.entityId));
  return allRelationships.filter(
    r => assignedIds.has(r.src) && assignedIds.has(r.dst)
  );
}

/**
 * Collapsed relationship entry - may represent one or two underlying relationships.
 */
export interface CollapsedRelationship {
  /** Primary relationship (A→B) */
  primary: RelationshipContext;
  /** Reverse relationship if bidirectional (B→A) */
  reverse?: RelationshipContext;
  /** Whether this is a mutual/bidirectional relationship */
  isBidirectional: boolean;
  /** Combined relationship IDs for selection (always includes primary, may include reverse) */
  relationshipIds: string[];
  /** Display strength (average if bidirectional) */
  strength: number;
}

/**
 * Create relationship ID from components.
 */
export function makeRelationshipId(src: string, dst: string, kind: string): string {
  return `${src}:${dst}:${kind}`;
}

/**
 * Collapse bidirectional relationships into single entries.
 * A↔B shown once instead of A→B and B→A separately.
 */
export function collapseBidirectionalRelationships(
  relationships: RelationshipContext[]
): CollapsedRelationship[] {
  const result: CollapsedRelationship[] = [];
  const processed = new Set<string>();

  // Index relationships by normalized key (sorted src/dst + kind)
  const byNormalizedKey = new Map<string, RelationshipContext[]>();
  for (const rel of relationships) {
    const normalizedKey = [rel.src, rel.dst].sort().join(':') + ':' + rel.kind;
    const existing = byNormalizedKey.get(normalizedKey) || [];
    existing.push(rel);
    byNormalizedKey.set(normalizedKey, existing);
  }

  for (const rel of relationships) {
    const relId = makeRelationshipId(rel.src, rel.dst, rel.kind);
    if (processed.has(relId)) continue;
    processed.add(relId);

    // Check for reverse relationship
    const reverseId = makeRelationshipId(rel.dst, rel.src, rel.kind);
    const reverseRel = relationships.find(
      r => r.src === rel.dst && r.dst === rel.src && r.kind === rel.kind
    );

    if (reverseRel && !processed.has(reverseId)) {
      // Bidirectional - collapse into one entry
      processed.add(reverseId);
      const avgStrength = ((rel.strength ?? 0.5) + (reverseRel.strength ?? 0.5)) / 2;
      result.push({
        primary: rel,
        reverse: reverseRel,
        isBidirectional: true,
        relationshipIds: [relId, reverseId],
        strength: avgStrength,
      });
    } else {
      // Unidirectional
      result.push({
        primary: rel,
        reverse: undefined,
        isBidirectional: false,
        relationshipIds: [relId],
        strength: rel.strength ?? 0.5,
      });
    }
  }

  return result;
}

/** Maximum events allowed in final chronicle selection */
export const MAX_CHRONICLE_EVENTS = 20;

export interface GetRelevantEventsOptions {
  /** @deprecated No longer used - UI shows all events, selection is limited separately */
  skipLimit?: boolean;
}

/**
 * Get events involving assigned entities.
 * Returns ALL matching events - UI is responsible for limiting final selection.
 */
export function getRelevantEvents(
  assignments: ChronicleRoleAssignment[],
  allEvents: NarrativeEventContext[],
  _eventRules?: unknown, // Deprecated - event selection rules removed
  _options?: GetRelevantEventsOptions
): NarrativeEventContext[] {
  const assignedIds = new Set(assignments.map(a => a.entityId));

  // Return all events involving assigned entities - no artificial limit
  // Final selection is limited to MAX_CHRONICLE_EVENTS in the UI
  return allEvents.filter(e =>
    (e.subjectId && assignedIds.has(e.subjectId)) ||
    (e.objectId && assignedIds.has(e.objectId))
  );
}

// =============================================================================
// Event Quality Filtering
// =============================================================================

export interface ChronicleEventFilterOptions {
  /** Minimum significance threshold (0, 0.25, 0.50, 0.75) */
  minSignificance?: number;
  /** Whether to exclude prominence-only events (default: true) */
  excludeProminenceOnly?: boolean;
}

/**
 * Check if an event is prominence-only based on its stateChanges.
 * An event is "prominence-only" if ALL of its state changes are
 * field === 'prominence' changes. These events are typically noise
 * (gradual prominence shifts) rather than narratively interesting.
 */
export function isProminenceOnlyChronicleEvent(
  event: NarrativeEventContext,
  assignedEntityIds: Set<string>
): boolean {
  // Events with no stateChanges are NOT prominence-only (they might be actions, relationships, etc.)
  if (!event.stateChanges || event.stateChanges.length === 0) {
    return false;
  }

  // Only consider stateChanges for assigned entities
  const relevantChanges = event.stateChanges.filter(
    sc => assignedEntityIds.has(sc.entityId)
  );

  // If no relevant changes, not prominence-only
  if (relevantChanges.length === 0) {
    return false;
  }

  // Check if ALL relevant changes are prominence changes
  return relevantChanges.every(sc => sc.field === 'prominence');
}

/**
 * Filter chronicle events by quality criteria.
 * Applies significance threshold and prominence-only exclusion.
 *
 * @param events - Events to filter (typically from getRelevantEvents)
 * @param assignedEntityIds - Set of assigned entity IDs for prominence check
 * @param options - Filter options
 * @returns Filtered events
 */
export function filterChronicleEvents(
  events: NarrativeEventContext[],
  assignedEntityIds: Set<string>,
  options: ChronicleEventFilterOptions = {}
): NarrativeEventContext[] {
  const {
    minSignificance = 0,
    excludeProminenceOnly = true,
  } = options;

  return events.filter(event => {
    // Filter by significance threshold
    if (event.significance < minSignificance) {
      return false;
    }

    // Exclude prominence-only events if configured
    if (excludeProminenceOnly && isProminenceOnlyChronicleEvent(event, assignedEntityIds)) {
      return false;
    }

    return true;
  });
}

// =============================================================================
// Wizard Selection Context Builder
// =============================================================================

/** Options for building wizard selection context */
export interface SelectionContextOptions {
  /** Include era nodes in 2-hop traversal. Default false. */
  includeErasInNeighborhood?: boolean;
}

/**
 * Build the selection context for the wizard given an entry point.
 * Returns candidates within 2-hop neighborhood.
 */
export function buildWizardSelectionContext(
  entryPoint: EntityContext,
  allEntities: EntityContext[],
  allRelationships: RelationshipContext[],
  allEvents: NarrativeEventContext[],
  style: NarrativeStyle,
  options: SelectionContextOptions = {}
): WizardSelectionContext {
  const { includeErasInNeighborhood = false } = options;

  // Build set of era entity IDs for filtering
  const eraEntityIds = new Set(
    allEntities.filter(e => e.kind === 'era').map(e => e.id)
  );

  // Filter relationships for graph traversal - exclude those involving era nodes
  const graphRelationships = includeErasInNeighborhood
    ? allRelationships
    : allRelationships.filter(r => !eraEntityIds.has(r.src) && !eraEntityIds.has(r.dst));

  // Build 2-hop neighborhood
  const neighborGraph = buildNeighborGraph(graphRelationships, entryPoint.id, 2);

  // Filter entities to those in the neighborhood
  const neighborEntities = allEntities.filter(e => neighborGraph.ids.has(e.id));

  // Apply style filters (entityRules deprecated, just passes through)
  const filteredCandidates = filterCandidatesByStyleRules(
    neighborEntities,
    undefined
  );

  // Ensure entry point is included
  const candidates = filteredCandidates.some(e => e.id === entryPoint.id)
    ? filteredCandidates
    : [entryPoint, ...filteredCandidates];

  // Get relationships between candidates
  const candidateIds = new Set(candidates.map(e => e.id));
  const candidateRelationships = allRelationships.filter(
    r => candidateIds.has(r.src) && candidateIds.has(r.dst)
  );

  // Get events involving candidates
  const candidateEvents = allEvents.filter(e =>
    (e.subjectId && candidateIds.has(e.subjectId)) ||
    (e.objectId && candidateIds.has(e.objectId))
  );

  return {
    entryPoint,
    candidates,
    candidateRelationships,
    candidateEvents,
    distances: neighborGraph.distances,
  };
}
