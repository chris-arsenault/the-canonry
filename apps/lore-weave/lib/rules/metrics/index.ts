/**
 * Unified Metric Evaluator
 *
 * Single dispatch point for all metric types.
 * Replaces multiple implementations across:
 * - evaluateSimpleCount (pressureInterpreter)
 * - evaluateFactor (pressureInterpreter)
 * - evaluateFactorWithDetails (pressureInterpreter)
 * - calculateMetric (connectionEvolution)
 * - getProminenceMultiplier (universalCatalyst, catalystHelpers)
 * - getDecayAmount (relationshipMaintenance)
 * - calculateFalloff (planeDiffusion)
 */

import type { HardState, Relationship } from '../../core/worldTypes';
import { hasTag } from '../../utils';
import { normalizeDirection, Direction, prominenceLabel } from '../types';
import type {
  Metric,
  MetricResult,
  SimpleCountMetric,
  EntityCountMetric,
  RelationshipCountMetric,
  TagCountMetric,
  TotalEntitiesMetric,
  ConstantMetric,
  ConnectionCountMetric,
  RatioMetric,
  StatusRatioMetric,
  CrossCultureRatioMetric,
  SharedRelationshipMetric,
  ProminenceMultiplierMetric,
  NeighborProminenceMetric,
  NeighborKindCountMetric,
  ComponentSizeMetric,
  DecayRateMetric,
  FalloffMetric,
} from './types';

// Re-export types
export interface MetricGraph {
  findEntities(criteria: {
    kind?: string;
    subtype?: string;
    status?: string;
    prominence?: string;
    tag?: string;
  }): HardState[];
  getEntities(): HardState[];
  getAllRelationships(): readonly Relationship[];
  getEntity(id: string): HardState | undefined;
}

export interface MetricContext {
  graph: MetricGraph;
}

export * from './types';

function describeSimpleCount(metric: SimpleCountMetric): string {
  switch (metric.type) {
    case 'entity_count': {
      const parts = [metric.kind];
      if (metric.subtype) parts.push(`:${metric.subtype}`);
      if (metric.status) parts.push(`(${metric.status})`);
      return parts.join('');
    }
    case 'relationship_count':
      return metric.relationshipKinds?.join('/') ?? 'relationships';
    case 'tag_count':
      return `tags:${metric.tags.join('/')}`;
    case 'total_entities':
      return 'total_entities';
    case 'constant':
      return 'constant';
    default:
      return 'count';
  }
}

export function describeMetric(metric: Metric): string {
  switch (metric.type) {
    case 'entity_count': {
      const parts = [metric.kind];
      if (metric.subtype) parts.push(`:${metric.subtype}`);
      if (metric.status) parts.push(`(${metric.status})`);
      return `${parts.join('')} count`;
    }
    case 'relationship_count':
      return `${metric.relationshipKinds?.join('/') ?? 'all'} relationships`;
    case 'tag_count':
      return `entities with ${metric.tags.join('/')} tags`;
    case 'total_entities':
      return 'total entities';
    case 'constant':
      return 'constant';
    case 'connection_count':
      return `${metric.relationshipKinds?.join('/') ?? 'all'} connections`;
    case 'ratio':
      return `${describeSimpleCount(metric.numerator)}/${describeSimpleCount(metric.denominator)} ratio`;
    case 'status_ratio':
      return `${metric.kind} status ratio`;
    case 'cross_culture_ratio':
      return `cross-culture ${metric.relationshipKinds.join('/')} ratio`;
    case 'shared_relationship':
      return `shared ${metric.sharedRelationshipKind} relationships`;
    case 'prominence_multiplier':
      return `prominence multiplier (${metric.mode ?? 'success_chance'})`;
    case 'neighbor_prominence':
      return `neighbor prominence (${metric.relationshipKinds?.join('/') ?? 'all'} connections)`;
    case 'neighbor_kind_count':
      return `neighbor ${metric.kind}${metric.subtype ? `:${metric.subtype}` : ''} count via ${metric.via}`;
    case 'component_size':
      return `component size via ${metric.relationshipKinds.join('/')}`;
    case 'decay_rate':
      return `decay rate ${metric.rate}`;
    case 'falloff':
      return `${metric.falloffType} falloff`;
    default:
      return (metric as { type: string }).type;
  }
}

// =============================================================================
// PROMINENCE MULTIPLIER TABLES (consolidated from 2 duplicates)
// =============================================================================

// Multiplier arrays indexed by prominence level (0=forgotten, 4=mythic)
const SUCCESS_MULTIPLIERS = [0.6, 0.8, 1.0, 1.2, 1.5];   // forgotten->mythic
const ACTION_MULTIPLIERS = [0.3, 0.6, 1.0, 1.5, 2.0];    // forgotten->mythic

/**
 * Get prominence multiplier with interpolation for numeric values.
 * Values between levels are linearly interpolated.
 */
export function getProminenceMultiplierValue(
  prominence: number,
  mode: ProminenceMultiplierMetric['mode'] = 'success_chance'
): number {
  const multipliers = mode === 'action_rate' ? ACTION_MULTIPLIERS : SUCCESS_MULTIPLIERS;

  // Clamp to valid range
  const clamped = Math.max(0, Math.min(5, prominence));
  const level = Math.min(4, Math.floor(clamped));
  const fraction = clamped - level;

  const current = multipliers[level];
  const next = multipliers[Math.min(level + 1, 4)];

  return current + (next - current) * fraction;
}

// =============================================================================
// DECAY RATE TABLE (consolidated from relationshipMaintenance)
// =============================================================================

const DECAY_RATES: Record<string, number> = {
  none: 0,
  slow: 0.01,
  medium: 0.03,
  fast: 0.06,
};

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

/**
 * Evaluate a metric against the current context.
 *
 * @param metric - The metric to evaluate
 * @param ctx - The rule context
 * @param entity - Optional entity for per-entity metrics
 * @returns MetricResult with value and diagnostic info
 */
export function evaluateMetric(
  metric: Metric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  switch (metric.type) {
    // =========================================================================
    // COUNT METRICS
    // =========================================================================

    case 'entity_count':
      return evaluateEntityCount(metric, ctx);

    case 'relationship_count':
      return evaluateRelationshipCount(metric, ctx, entity);

    case 'tag_count':
      return evaluateTagCount(metric, ctx);

    case 'total_entities':
      return evaluateTotalEntities(metric, ctx);

    case 'constant':
      return evaluateConstant(metric);

    case 'connection_count':
      return evaluateConnectionCount(metric, ctx, entity);

    // =========================================================================
    // RATIO METRICS
    // =========================================================================

    case 'ratio':
      return evaluateRatio(metric, ctx);

    case 'status_ratio':
      return evaluateStatusRatio(metric, ctx);

    case 'cross_culture_ratio':
      return evaluateCrossCultureRatio(metric, ctx);

    // =========================================================================
    // EVOLUTION METRICS
    // =========================================================================

    case 'shared_relationship':
      return evaluateSharedRelationship(metric, ctx, entity);

    // =========================================================================
    // PROMINENCE METRICS
    // =========================================================================

    case 'prominence_multiplier':
      return evaluateProminenceMultiplier(metric, entity);

    case 'neighbor_prominence':
      return evaluateNeighborProminence(metric, ctx, entity);

    // =========================================================================
    // NEIGHBOR METRICS
    // =========================================================================

    case 'neighbor_kind_count':
      return evaluateNeighborKindCount(metric, ctx, entity);

    // =========================================================================
    // GRAPH TOPOLOGY METRICS
    // =========================================================================

    case 'component_size':
      return evaluateComponentSize(metric, ctx, entity);

    // =========================================================================
    // DECAY/FALLOFF METRICS
    // =========================================================================

    case 'decay_rate':
      return evaluateDecayRate(metric);

    case 'falloff':
      return evaluateFalloff(metric);

    default:
      return {
        value: 0,
        diagnostic: `unknown metric type: ${(metric as Metric).type}`,
        details: { metric },
      };
  }
}

/**
 * Evaluate a simple count metric (for use in ratios).
 */
export function evaluateSimpleCount(
  metric: SimpleCountMetric,
  ctx: MetricContext
): number {
  switch (metric.type) {
    case 'entity_count': {
      let entities = ctx.graph.findEntities({ kind: metric.kind });
      if (metric.subtype) {
        entities = entities.filter((e) => e.subtype === metric.subtype);
      }
      if (metric.status) {
        entities = entities.filter((e) => e.status === metric.status);
      }
      return entities.length;
    }

    case 'relationship_count': {
      const rels = ctx.graph.getAllRelationships();
      if (!metric.relationshipKinds || metric.relationshipKinds.length === 0) {
        return rels.length;
      }
      return rels.filter((r) => metric.relationshipKinds!.includes(r.kind)).length;
    }

    case 'tag_count': {
      const entities = ctx.graph.getEntities();
      return entities.filter((e) =>
        metric.tags.some((tag) => hasTag(e.tags, tag))
      ).length;
    }

    case 'total_entities':
      return ctx.graph.getEntities().length;

    case 'constant':
      return metric.value;

    default:
      return 0;
  }
}

// =============================================================================
// COUNT EVALUATORS
// =============================================================================

function evaluateEntityCount(
  metric: EntityCountMetric,
  ctx: MetricContext
): MetricResult {
  let entities = ctx.graph.findEntities({ kind: metric.kind });
  if (metric.subtype) {
    entities = entities.filter((e) => e.subtype === metric.subtype);
  }
  if (metric.status) {
    entities = entities.filter((e) => e.status === metric.status);
  }

  const rawCount = entities.length;
  let value = rawCount * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  const desc = `${metric.kind}${metric.subtype ? ':' + metric.subtype : ''}`;
  return {
    value,
    diagnostic: `${desc} count=${rawCount}${metric.coefficient ? ` * ${metric.coefficient}` : ''}`,
    details: {
      kind: metric.kind,
      subtype: metric.subtype,
      status: metric.status,
      rawCount,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

function evaluateRelationshipCount(
  metric: RelationshipCountMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  const direction = normalizeDirection(metric.direction);
  const rels = ctx.graph.getAllRelationships();
  const count = rels.filter((r) => {
    if (metric.relationshipKinds?.length && !metric.relationshipKinds.includes(r.kind)) {
      return false;
    }
    if (metric.minStrength !== undefined && (r.strength ?? 0) < metric.minStrength) {
      return false;
    }

    if (!entity) {
      return true;
    }

    if (direction === 'both') {
      return r.src === entity.id || r.dst === entity.id;
    }
    if (direction === 'src') {
      return r.src === entity.id;
    }
    return r.dst === entity.id;
  }).length;

  let value = count * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `relationship count=${count}`,
    details: {
      relationshipKinds: metric.relationshipKinds,
      direction: metric.direction,
      minStrength: metric.minStrength,
      rawCount: count,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

function evaluateTagCount(
  metric: TagCountMetric,
  ctx: MetricContext
): MetricResult {
  const entities = ctx.graph.getEntities();
  const count = entities.filter((e) =>
    metric.tags.some((tag) => hasTag(e.tags, tag))
  ).length;

  let value = count * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `tag count (${metric.tags.join(', ')})=${count}`,
    details: {
      tags: metric.tags,
      rawCount: count,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

function evaluateTotalEntities(
  metric: TotalEntitiesMetric,
  ctx: MetricContext
): MetricResult {
  const count = ctx.graph.getEntities().length;

  let value = count * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `total entities=${count}`,
    details: { rawCount: count, coefficient: metric.coefficient, cap: metric.cap },
  };
}

function evaluateConstant(metric: ConstantMetric): MetricResult {
  const value = metric.value * (metric.coefficient ?? 1);

  return {
    value,
    diagnostic: `constant=${metric.value}`,
    details: { value: metric.value, coefficient: metric.coefficient },
  };
}

function evaluateConnectionCount(
  metric: ConnectionCountMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for connection count', details: {} };
  }

  const direction = normalizeDirection(metric.direction);
  const rels = ctx.graph.getAllRelationships();
  const count = rels.filter((link) => {
    const involvesEntity = link.src === entity.id || link.dst === entity.id;
    if (!involvesEntity) return false;

    if (metric.relationshipKinds?.length && !metric.relationshipKinds.includes(link.kind)) {
      return false;
    }
    if (metric.minStrength !== undefined && (link.strength ?? 0) < metric.minStrength) {
      return false;
    }

    const dirOk =
      direction === 'both' ||
      (direction === 'src' && link.src === entity.id) ||
      (direction === 'dst' && link.dst === entity.id);

    return dirOk;
  }).length;

  let value = count * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `connections=${count}`,
    details: {
      entityId: entity.id,
      relationshipKinds: metric.relationshipKinds,
      rawCount: count,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

// =============================================================================
// RATIO EVALUATORS
// =============================================================================

function evaluateRatio(
  metric: RatioMetric,
  ctx: MetricContext
): MetricResult {
  const numValue = evaluateSimpleCount(metric.numerator, ctx);
  const denValue = evaluateSimpleCount(metric.denominator, ctx);

  let ratio: number;
  if (denValue === 0) {
    ratio = metric.fallbackValue ?? 0;
  } else {
    ratio = numValue / denValue;
  }

  let value = ratio * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `ratio=${numValue}/${denValue}=${ratio.toFixed(2)}`,
    details: {
      numerator: numValue,
      denominator: denValue,
      ratio,
      fallbackValue: metric.fallbackValue,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

function evaluateStatusRatio(
  metric: StatusRatioMetric,
  ctx: MetricContext
): MetricResult {
  let entities = ctx.graph.findEntities({ kind: metric.kind });
  if (metric.subtype) {
    entities = entities.filter((e) => e.subtype === metric.subtype);
  }

  const total = entities.length;
  if (total === 0) {
    return {
      value: metric.coefficient ?? 1, // Default to 1 if no entities
      diagnostic: `status ratio: no ${metric.kind} entities`,
      details: { total: 0, alive: 0 },
    };
  }

  const alive = entities.filter((e) => e.status === metric.aliveStatus).length;
  let ratio = alive / total;

  let value = ratio * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `status ratio=${alive}/${total}=${ratio.toFixed(2)}`,
    details: {
      kind: metric.kind,
      subtype: metric.subtype,
      aliveStatus: metric.aliveStatus,
      alive,
      total,
      ratio,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

function evaluateCrossCultureRatio(
  metric: CrossCultureRatioMetric,
  ctx: MetricContext
): MetricResult {
  const rels = ctx.graph
    .getAllRelationships()
    .filter((r) => metric.relationshipKinds.includes(r.kind));

  const total = rels.length;
  if (total === 0) {
    return {
      value: 0,
      diagnostic: 'cross-culture ratio: no matching relationships',
      details: { total: 0, crossCulture: 0 },
    };
  }

  let crossCulture = 0;
  for (const rel of rels) {
    const src = ctx.graph.getEntity(rel.src);
    const dst = ctx.graph.getEntity(rel.dst);
    if (src && dst && src.culture !== dst.culture) {
      crossCulture++;
    }
  }

  let ratio = crossCulture / total;

  let value = ratio * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `cross-culture=${crossCulture}/${total}=${ratio.toFixed(2)}`,
    details: {
      relationshipKinds: metric.relationshipKinds,
      crossCulture,
      total,
      ratio,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

// =============================================================================
// EVOLUTION EVALUATORS
// =============================================================================

function evaluateSharedRelationship(
  metric: SharedRelationshipMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for shared relationship', details: {} };
  }

  // Normalize to array for uniform handling
  const kinds = Array.isArray(metric.sharedRelationshipKind)
    ? metric.sharedRelationshipKind
    : [metric.sharedRelationshipKind];

  const direction = metric.sharedDirection ?? 'src';
  const minStrength = metric.minStrength ?? 0;
  const rels = ctx.graph.getAllRelationships();

  // If via is specified, use multi-hop traversal
  if (metric.via) {
    return evaluateSharedRelationshipVia(entity, metric, kinds, direction, minStrength, rels, ctx);
  }

  // Standard single-hop: Entity → sharedRelationshipKind → Target ← sharedRelationshipKind ← OtherEntity
  const myTargets = new Set<string>();

  for (const link of rels) {
    if (!kinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    if (direction === 'src' && link.src === entity.id) {
      myTargets.add(link.dst);
    }
    if (direction === 'dst' && link.dst === entity.id) {
      myTargets.add(link.src);
    }
  }

  // Count how many other entities share these targets
  const sharedCount = new Set<string>();
  for (const link of rels) {
    if (!kinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    let otherId: string | null = null;
    let targetId: string | null = null;

    if (direction === 'src' && link.src !== entity.id) {
      otherId = link.src;
      targetId = link.dst;
    } else if (direction === 'dst' && link.dst !== entity.id) {
      otherId = link.dst;
      targetId = link.src;
    }

    if (otherId && targetId && myTargets.has(targetId)) {
      sharedCount.add(otherId);
    }
  }

  let value = sharedCount.size * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `shared ${kinds.join('/')}=${sharedCount.size}`,
    details: {
      sharedRelationshipKind: kinds,
      sharedDirection: direction,
      myTargetCount: myTargets.size,
      sharedCount: sharedCount.size,
      minStrength,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

/**
 * Multi-hop shared relationship evaluation.
 * Pattern: Entity → via → Intermediate → sharedRelKind → Target ← sharedRelKind ← OtherIntermediate ← via ← OtherEntity
 *
 * Example: Trade alliance detection
 * Faction A → controls → Location X → trades_with → Location Y ← controls ← Faction B
 */
function evaluateSharedRelationshipVia(
  entity: HardState,
  metric: SharedRelationshipMetric,
  sharedKinds: string[],
  sharedDirection: 'src' | 'dst',
  minStrength: number,
  rels: readonly Relationship[],
  ctx: MetricContext
): MetricResult {
  const via = metric.via!;
  const viaKind = via.relationshipKind;
  const viaDirection = via.direction ?? 'src';

  // Build indexes for efficient lookup
  // viaIndex: entity → Set of intermediates reachable via the 'via' relationship
  const viaIndex = new Map<string, Set<string>>();
  // reverseViaIndex: intermediate → Set of entities that reach it via 'via'
  const reverseViaIndex = new Map<string, Set<string>>();

  for (const link of rels) {
    if (link.kind !== viaKind) continue;

    const sourceId = viaDirection === 'src' ? link.src : link.dst;
    const intermediateId = viaDirection === 'src' ? link.dst : link.src;

    // Apply intermediate kind filter if specified
    if (via.intermediateKind) {
      const intermediate = ctx.graph.getEntity(intermediateId);
      if (!intermediate || intermediate.kind !== via.intermediateKind) continue;
    }

    if (!viaIndex.has(sourceId)) viaIndex.set(sourceId, new Set());
    viaIndex.get(sourceId)!.add(intermediateId);

    if (!reverseViaIndex.has(intermediateId)) reverseViaIndex.set(intermediateId, new Set());
    reverseViaIndex.get(intermediateId)!.add(sourceId);
  }

  // Find my intermediates
  const myIntermediates = viaIndex.get(entity.id) ?? new Set<string>();
  if (myIntermediates.size === 0) {
    return {
      value: 0,
      diagnostic: `shared via ${viaKind}→${sharedKinds.join('/')}: no intermediates`,
      details: { via: viaKind, sharedRelationshipKind: sharedKinds, intermediateCount: 0 },
    };
  }

  // Build shared relationship index: intermediate → Set of targets
  const sharedIndex = new Map<string, Set<string>>();
  // reverseSharedIndex: target → Set of intermediates
  const reverseSharedIndex = new Map<string, Set<string>>();

  for (const link of rels) {
    if (!sharedKinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    const intermediateId = sharedDirection === 'src' ? link.src : link.dst;
    const targetId = sharedDirection === 'src' ? link.dst : link.src;

    if (!sharedIndex.has(intermediateId)) sharedIndex.set(intermediateId, new Set());
    sharedIndex.get(intermediateId)!.add(targetId);

    if (!reverseSharedIndex.has(targetId)) reverseSharedIndex.set(targetId, new Set());
    reverseSharedIndex.get(targetId)!.add(intermediateId);
  }

  // Find targets reachable from my intermediates
  const myTargets = new Set<string>();
  for (const intermediateId of myIntermediates) {
    const targets = sharedIndex.get(intermediateId);
    if (targets) {
      for (const targetId of targets) {
        myTargets.add(targetId);
      }
    }
  }

  if (myTargets.size === 0) {
    return {
      value: 0,
      diagnostic: `shared via ${viaKind}→${sharedKinds.join('/')}: no targets`,
      details: {
        via: viaKind,
        sharedRelationshipKind: sharedKinds,
        intermediateCount: myIntermediates.size,
        targetCount: 0,
      },
    };
  }

  // Find other entities whose intermediates also connect to my targets
  const sharedEntities = new Set<string>();
  for (const targetId of myTargets) {
    const otherIntermediates = reverseSharedIndex.get(targetId);
    if (!otherIntermediates) continue;

    for (const otherIntermediateId of otherIntermediates) {
      // Skip my own intermediates
      if (myIntermediates.has(otherIntermediateId)) continue;

      // Find entities that own these intermediates
      const owners = reverseViaIndex.get(otherIntermediateId);
      if (owners) {
        for (const ownerId of owners) {
          if (ownerId !== entity.id) {
            sharedEntities.add(ownerId);
          }
        }
      }
    }
  }

  let value = sharedEntities.size * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `shared via ${viaKind}→${sharedKinds.join('/')}=${sharedEntities.size}`,
    details: {
      via: viaKind,
      viaDirection,
      intermediateKind: via.intermediateKind,
      sharedRelationshipKind: sharedKinds,
      sharedDirection,
      intermediateCount: myIntermediates.size,
      targetCount: myTargets.size,
      sharedCount: sharedEntities.size,
      minStrength,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

// =============================================================================
// PROMINENCE EVALUATORS
// =============================================================================

function evaluateProminenceMultiplier(
  metric: ProminenceMultiplierMetric,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 1.0, diagnostic: 'no entity (default multiplier=1)', details: {} };
  }

  const value = getProminenceMultiplierValue(entity.prominence, metric.mode);
  const label = prominenceLabel(entity.prominence);

  return {
    value,
    diagnostic: `prominence ${label} (${entity.prominence.toFixed(2)}) = ${value.toFixed(2)}x`,
    details: {
      prominence: entity.prominence,
      prominenceLabel: label,
      mode: metric.mode ?? 'success_chance',
      multiplier: value,
    },
  };
}

/**
 * Calculate average prominence of connected entities.
 * Implements "Reflected Glory" - entities connected to high-prominence
 * entities can benefit from their fame.
 */
function evaluateNeighborProminence(
  metric: NeighborProminenceMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for neighbor prominence', details: {} };
  }

  const direction = normalizeDirection(metric.direction);
  const minStrength = metric.minStrength ?? 0;
  const rels = ctx.graph.getAllRelationships();

  // Find all neighbors connected to this entity
  const neighborIds = new Set<string>();
  for (const link of rels) {
    // Check relationship kind filter
    if (metric.relationshipKinds?.length && !metric.relationshipKinds.includes(link.kind)) {
      continue;
    }
    // Check strength filter
    if ((link.strength ?? 0) < minStrength) {
      continue;
    }

    // Check direction and collect neighbor IDs
    if (direction === 'both') {
      if (link.src === entity.id) neighborIds.add(link.dst);
      if (link.dst === entity.id) neighborIds.add(link.src);
    } else if (direction === 'src' && link.src === entity.id) {
      neighborIds.add(link.dst);
    } else if (direction === 'dst' && link.dst === entity.id) {
      neighborIds.add(link.src);
    }
  }

  if (neighborIds.size === 0) {
    return {
      value: 0,
      diagnostic: `no neighbors found for ${entity.name}`,
      details: { entityId: entity.id, neighborCount: 0 },
    };
  }

  // Calculate average prominence of neighbors
  let totalProminence = 0;
  let validNeighbors = 0;
  for (const neighborId of neighborIds) {
    const neighbor = ctx.graph.getEntity(neighborId);
    if (neighbor) {
      totalProminence += neighbor.prominence;
      validNeighbors++;
    }
  }

  const avgProminence = validNeighbors > 0 ? totalProminence / validNeighbors : 0;

  let value = avgProminence * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `neighbor prominence avg=${avgProminence.toFixed(2)} (${validNeighbors} neighbors)`,
    details: {
      entityId: entity.id,
      neighborCount: validNeighbors,
      totalProminence,
      avgProminence,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

// =============================================================================
// NEIGHBOR EVALUATORS
// =============================================================================

/**
 * Count neighboring entities of a specific kind connected via relationship chain.
 *
 * Traverses from entity via first relationship, then optionally via second relationship,
 * and counts entities matching the kind/subtype/status criteria.
 *
 * Example: Count NPCs at adjacent locations:
 * - via: 'adjacent_to' (from location to neighboring locations)
 * - then: 'resident_of' (from locations to NPCs that reside there)
 * - kind: 'npc'
 */
function evaluateNeighborKindCount(
  metric: NeighborKindCountMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for neighbor kind count', details: {} };
  }

  const viaDirection = normalizeDirection(metric.viaDirection);
  const minStrength = metric.minStrength ?? 0;
  const rels = ctx.graph.getAllRelationships();

  // Support both single relationship kind and array of kinds
  const viaKinds = Array.isArray(metric.via) ? metric.via : [metric.via];

  // Step 1: Find entities connected via the first relationship(s)
  const viaEntityIds = new Set<string>();
  for (const link of rels) {
    if (!viaKinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    if (viaDirection === 'both') {
      if (link.src === entity.id) viaEntityIds.add(link.dst);
      if (link.dst === entity.id) viaEntityIds.add(link.src);
    } else if (viaDirection === 'src' && link.src === entity.id) {
      viaEntityIds.add(link.dst);
    } else if (viaDirection === 'dst' && link.dst === entity.id) {
      viaEntityIds.add(link.src);
    }
  }

  // Step 2: If 'then' is specified, traverse another hop
  let targetEntityIds: Set<string>;
  if (metric.then) {
    const thenDirection = normalizeDirection(metric.thenDirection);
    targetEntityIds = new Set<string>();

    for (const viaId of viaEntityIds) {
      for (const link of rels) {
        if (link.kind !== metric.then) continue;

        if (thenDirection === 'both') {
          if (link.src === viaId) targetEntityIds.add(link.dst);
          if (link.dst === viaId) targetEntityIds.add(link.src);
        } else if (thenDirection === 'src' && link.src === viaId) {
          targetEntityIds.add(link.dst);
        } else if (thenDirection === 'dst' && link.dst === viaId) {
          targetEntityIds.add(link.src);
        }
      }
    }
  } else {
    targetEntityIds = viaEntityIds;
  }

  // Step 3: Filter by kind/subtype/status/tag
  let count = 0;
  for (const targetId of targetEntityIds) {
    const target = ctx.graph.getEntity(targetId);
    if (!target) continue;

    if (target.kind !== metric.kind) continue;
    if (metric.subtype && target.subtype !== metric.subtype) continue;
    if (metric.status && target.status !== metric.status) continue;
    if (metric.hasTag && !hasTag(target.tags, metric.hasTag)) continue;

    count++;
  }

  let value = count * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `neighbor ${metric.kind} count=${count} via ${metric.via}${metric.then ? `->${metric.then}` : ''}`,
    details: {
      entityId: entity.id,
      via: metric.via,
      then: metric.then,
      viaCount: viaEntityIds.size,
      matchingCount: count,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

// =============================================================================
// GRAPH TOPOLOGY EVALUATORS
// =============================================================================

/**
 * Calculate the size of the connected component containing an entity.
 *
 * Uses DFS to find all entities transitively reachable via the specified
 * relationship kind(s), treating the subgraph as undirected (both src and dst
 * directions are followed).
 *
 * Example: Find size of alliance bloc:
 * { type: 'component_size', relationshipKinds: ['allied_with'] }
 */
function evaluateComponentSize(
  metric: ComponentSizeMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for component size', details: {} };
  }

  const minStrength = metric.minStrength ?? 0;
  const rels = ctx.graph.getAllRelationships();

  // Build adjacency index for faster traversal
  // Maps entityId -> Set of connected entityIds via the specified relationships
  const adjacency = new Map<string, Set<string>>();

  for (const link of rels) {
    // Filter by relationship kind
    if (!metric.relationshipKinds.includes(link.kind)) continue;
    // Filter by minimum strength
    if ((link.strength ?? 0) < minStrength) continue;

    // Add bidirectional edges (treat as undirected graph)
    if (!adjacency.has(link.src)) adjacency.set(link.src, new Set());
    if (!adjacency.has(link.dst)) adjacency.set(link.dst, new Set());
    adjacency.get(link.src)!.add(link.dst);
    adjacency.get(link.dst)!.add(link.src);
  }

  // DFS to find all reachable entities
  const visited = new Set<string>([entity.id]);
  const stack = [entity.id];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          stack.push(neighborId);
        }
      }
    }
  }

  const componentSize = visited.size;

  let value = componentSize * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `component size via ${metric.relationshipKinds.join('/')} = ${componentSize}`,
    details: {
      entityId: entity.id,
      relationshipKinds: metric.relationshipKinds,
      minStrength,
      componentSize,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

// =============================================================================
// DECAY/FALLOFF EVALUATORS
// =============================================================================

function evaluateDecayRate(metric: DecayRateMetric): MetricResult {
  const value = DECAY_RATES[metric.rate] ?? 0.03;

  return {
    value,
    diagnostic: `decay rate ${metric.rate}=${value}`,
    details: { rate: metric.rate, value },
  };
}

function evaluateFalloff(metric: FalloffMetric): MetricResult {
  const maxDist = metric.maxDistance ?? 100;
  const distance = metric.distance;
  const normalizedDist = maxDist > 0 ? distance / maxDist : 0;

  if (distance <= 0) {
    return {
      value: 1,
      diagnostic: `${metric.falloffType} falloff at d=0 = 1.00`,
      details: {
        falloffType: metric.falloffType,
        distance,
        maxDistance: maxDist,
        normalizedDistance: 0,
        value: 1,
      },
    };
  }

  if (distance >= maxDist) {
    return {
      value: 0,
      diagnostic: `${metric.falloffType} falloff at d=${distance.toFixed(1)} = 0.00`,
      details: {
        falloffType: metric.falloffType,
        distance,
        maxDistance: maxDist,
        normalizedDistance: 1,
        value: 0,
      },
    };
  }

  let value: number;
  switch (metric.falloffType) {
    case 'none':
      value = 1;
      break;
    case 'absolute':
      value = 1 - normalizedDist;
      break;
    case 'linear':
      value = 1 - normalizedDist;
      break;
    case 'inverse_square':
      value = 1 / (1 + (distance * distance) / (maxDist * 0.5));
      break;
    case 'sqrt':
      value = 1 - Math.sqrt(normalizedDist);
      break;
    case 'exponential':
      value = Math.exp(-3 * normalizedDist);
      break;
    default:
      value = 1 - normalizedDist;
  }

  return {
    value,
    diagnostic: `${metric.falloffType} falloff at d=${metric.distance.toFixed(1)} = ${value.toFixed(2)}`,
    details: {
      falloffType: metric.falloffType,
      distance: metric.distance,
      maxDistance: maxDist,
      normalizedDistance: normalizedDist,
      value,
    },
  };
}
