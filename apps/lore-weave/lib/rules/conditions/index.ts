/**
 * Unified Condition Evaluator
 *
 * Single dispatch point for all condition types.
 * Replaces multiple implementations across:
 * - evaluateApplicabilityRule (templateInterpreter)
 * - evaluateVariantCondition (templateInterpreter)
 * - evaluateCondition (thresholdTrigger)
 * - checkTransitionConditions (eraTransition)
 */

import { HardState } from '../../core/worldTypes';
import { hasTag, getTagValue } from '../../utils';
import { evaluateGraphPath } from '../graphPath';
import { applySelectionFilters } from '../filters';
import type { RuleContext } from '../context';
import {
  applyOperator,
  normalizeDirection,
  normalizeOperator,
  prominenceThreshold,
  prominenceLabel,
} from '../types';
import type {
  Condition,
  ConditionResult,
  PressureCondition,
  PressureCompareCondition,
  PressureAnyAboveCondition,
  EntityCountCondition,
  RelationshipCountCondition,
  RelationshipExistsCondition,
  TagExistsCondition,
  LacksTagCondition,
  StatusCondition,
  ProminenceCondition,
  TimeElapsedCondition,
  CooldownElapsedCondition,
  CreationsPerEpochCondition,
  GrowthPhasesCompleteCondition,
  EraMatchCondition,
  RandomChanceCondition,
  GraphPathCondition,
  ComponentSizeCondition,
  EntityExistsCondition,
  EntityHasRelationshipCondition,
  AndCondition,
  OrCondition,
} from './types';

// Re-export types
export * from './types';

/**
 * Evaluate a condition against the current context.
 *
 * @param condition - The condition to evaluate
 * @param ctx - The rule context
 * @param entity - Optional entity for per-entity conditions (uses ctx.self if not provided)
 * @returns ConditionResult with passed status and diagnostic info
 */
type ConditionHandler = (condition: Condition, ctx: RuleContext, self?: HardState) => ConditionResult;

const CONDITION_HANDLERS: Record<string, ConditionHandler> = {
  pressure: (c, ctx) => evaluatePressure(c as PressureCondition, ctx),
  pressure_compare: (c, ctx) => evaluatePressureCompare(c as PressureCompareCondition, ctx),
  pressure_any_above: (c, ctx) => evaluatePressureAnyAbove(c as PressureAnyAboveCondition, ctx),
  entity_count: (c, ctx) => evaluateEntityCount(c as EntityCountCondition, ctx),
  relationship_count: (c, ctx, self) => evaluateRelationshipCount(c as RelationshipCountCondition, ctx, self),
  relationship_exists: (c, ctx, self) => evaluateRelationshipExists(c as RelationshipExistsCondition, ctx, self),
  tag_exists: (c, ctx, self) => evaluateTagExists(c as TagExistsCondition, ctx, self),
  lacks_tag: (c, ctx, self) => evaluateLacksTag(c as LacksTagCondition, ctx, self),
  status: (c, _ctx, self) => evaluateStatus(c as StatusCondition, self),
  prominence: (c, _ctx, self) => evaluateProminence(c as ProminenceCondition, self),
  time_elapsed: (c, ctx, self) => evaluateTimeElapsed(c as TimeElapsedCondition, ctx, self),
  cooldown_elapsed: (c, ctx) => evaluateCooldownElapsed(c as CooldownElapsedCondition, ctx),
  creations_per_epoch: (c, ctx) => evaluateCreationsPerEpoch(c as CreationsPerEpochCondition, ctx),
  growth_phases_complete: (c, ctx) => evaluateGrowthPhasesComplete(c as GrowthPhasesCompleteCondition, ctx),
  era_match: (c, ctx) => evaluateEraMatch(c as EraMatchCondition, ctx),
  random_chance: (c) => evaluateRandomChance(c as RandomChanceCondition),
  graph_path: (c, ctx, self) => evaluateGraphPathCondition(c as GraphPathCondition, ctx, self),
  component_size: (c, ctx, self) => evaluateComponentSize(c as ComponentSizeCondition, ctx, self),
  entity_exists: (c, ctx) => evaluateEntityExists(c as EntityExistsCondition, ctx),
  entity_has_relationship: (c, ctx) => evaluateEntityHasRelationship(c as EntityHasRelationshipCondition, ctx),
  and: (c, ctx, self) => evaluateAnd(c as AndCondition, ctx, self),
  or: (c, ctx, self) => evaluateOr(c as OrCondition, ctx, self),
  always: () => ({ passed: true, diagnostic: 'always', details: {} }),
};

export function evaluateCondition(
  condition: Condition,
  ctx: RuleContext,
  entity?: HardState
): ConditionResult {
  const self = entity ?? ctx.self;
  const handler = CONDITION_HANDLERS[condition.type];
  if (handler) return handler(condition, ctx, self);

  return {
    passed: false,
    diagnostic: `unknown condition type: ${condition.type}`,
    details: { condition },
  };
}

// =============================================================================
// PRESSURE EVALUATORS
// =============================================================================

function evaluatePressure(
  condition: PressureCondition,
  ctx: RuleContext
): ConditionResult {
  const value = ctx.graph.getPressure(condition.pressureId);
  const minOk = condition.min === undefined || value >= condition.min;
  const maxOk = condition.max === undefined || value <= condition.max;
  const passed = minOk && maxOk;

  const range = `${condition.min ?? '-∞'} to ${condition.max ?? '∞'}`;
  return {
    passed,
    diagnostic: `pressure ${condition.pressureId}=${value.toFixed(1)} (${range})`,
    details: {
      pressureId: condition.pressureId,
      value,
      min: condition.min,
      max: condition.max,
    },
  };
}

function evaluatePressureCompare(
  condition: PressureCompareCondition,
  ctx: RuleContext
): ConditionResult {
  const valueA = ctx.graph.getPressure(condition.pressureA);
  const valueB = ctx.graph.getPressure(condition.pressureB);
  const op = normalizeOperator(condition.operator);
  const passed = applyOperator(valueA, op, valueB);

  return {
    passed,
    diagnostic: `${condition.pressureA}(${valueA.toFixed(1)}) ${op} ${condition.pressureB}(${valueB.toFixed(1)})`,
    details: {
      pressureA: condition.pressureA,
      pressureB: condition.pressureB,
      valueA,
      valueB,
      operator: op,
    },
  };
}

function evaluatePressureAnyAbove(
  condition: PressureAnyAboveCondition,
  ctx: RuleContext
): ConditionResult {
  const values: Record<string, number> = {};
  let passed = false;

  for (const id of condition.pressureIds) {
    const value = ctx.graph.getPressure(id);
    values[id] = value;
    if (value > condition.threshold) {
      passed = true;
    }
  }

  return {
    passed,
    diagnostic: `any pressure > ${condition.threshold}: ${passed}`,
    details: { pressureIds: condition.pressureIds, values, threshold: condition.threshold },
  };
}

// =============================================================================
// ENTITY COUNT EVALUATORS
// =============================================================================

function evaluateEntityCount(
  condition: EntityCountCondition,
  ctx: RuleContext
): ConditionResult {
  let entities = ctx.graph.findEntities({ kind: condition.kind });
  if (condition.subtype) {
    entities = entities.filter((e) => e.subtype === condition.subtype);
  }
  if (condition.status) {
    entities = entities.filter((e) => e.status === condition.status);
  }

  const count = entities.length;
  const minOk = condition.min === undefined || count >= condition.min;

  // Apply overshoot factor for max check
  const effectiveMax =
    condition.max !== undefined
      ? Math.floor(condition.max * (condition.overshootFactor ?? 1.5))
      : undefined;
  const maxOk = effectiveMax === undefined || count < effectiveMax;

  const passed = minOk && maxOk;

  const desc = `${condition.kind}${condition.subtype ? ':' + condition.subtype : ''}`;
  return {
    passed,
    diagnostic: `${desc} count=${count} (${condition.min ?? 0} to ${effectiveMax ?? '∞'})`,
    details: {
      kind: condition.kind,
      subtype: condition.subtype,
      status: condition.status,
      count,
      min: condition.min,
      max: condition.max,
      effectiveMax,
    },
  };
}

// =============================================================================
// RELATIONSHIP EVALUATORS
// =============================================================================

function evaluateRelationshipCount(
  condition: RelationshipCountCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for relationship count', details: {} };
  }

  const direction = normalizeDirection(condition.direction);
  let count = 0;

  // Use graph relationships as the single source of truth
  const allRelationships = ctx.graph.getAllRelationships();
  for (const link of allRelationships) {
    if (condition.relationshipKind && link.kind !== condition.relationshipKind) {
      continue;
    }

    // Check if entity is involved in this relationship
    let entityInvolved = false;
    if (direction === 'both') {
      entityInvolved = link.src === self.id || link.dst === self.id;
    } else if (direction === 'src') {
      entityInvolved = link.src === self.id;
    } else {
      entityInvolved = link.dst === self.id;
    }

    if (entityInvolved) {
      count++;
    }
  }

  const minOk = condition.min === undefined || count >= condition.min;
  const maxOk = condition.max === undefined || count <= condition.max;
  const passed = minOk && maxOk;

  return {
    passed,
    diagnostic: `relationship count=${count} (${condition.min ?? 0} to ${condition.max ?? '∞'})`,
    details: {
      relationshipKind: condition.relationshipKind,
      direction,
      count,
      min: condition.min,
      max: condition.max,
    },
  };
}

function matchesDirection(link: { src: string; dst: string }, selfId: string, direction: string): boolean {
  if (direction === 'both') return link.src === selfId || link.dst === selfId;
  if (direction === 'src') return link.src === selfId;
  return link.dst === selfId;
}

function matchesTargetCriteria(
  otherId: string,
  condition: RelationshipExistsCondition,
  ctx: RuleContext
): boolean {
  if (!condition.targetKind && !condition.targetSubtype && !condition.targetStatus) return true;
  const other = ctx.graph.getEntity(otherId);
  if (!other) return false;
  if (condition.targetKind && other.kind !== condition.targetKind) return false;
  if (condition.targetSubtype && other.subtype !== condition.targetSubtype) return false;
  if (condition.targetStatus && other.status !== condition.targetStatus) return false;
  return true;
}

function evaluateRelationshipExists(
  condition: RelationshipExistsCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for relationship exists', details: {} };
  }

  const direction = normalizeDirection(condition.direction);
  const withEntityId = condition.with ? resolveEntityRef(condition.with, ctx, self)?.id : undefined;

  const allRelationships = ctx.graph.getAllRelationships();
  const passed = allRelationships.some((link) => {
    if (link.kind !== condition.relationshipKind) return false;
    if (!matchesDirection(link, self.id, direction)) return false;

    if (withEntityId) {
      const otherId = link.src === self.id ? link.dst : link.src;
      if (otherId !== withEntityId) return false;
    }

    const otherId = link.src === self.id ? link.dst : link.src;
    return matchesTargetCriteria(otherId, condition, ctx);
  });

  return {
    passed,
    diagnostic: `relationship ${condition.relationshipKind} exists: ${passed}`,
    details: { relationshipKind: condition.relationshipKind, direction, with: condition.with, withEntityId },
  };
}

// =============================================================================
// TAG EVALUATORS
// =============================================================================

function evaluateTagExists(
  condition: TagExistsCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx, self);

  if (!entity) {
    return {
      passed: false,
      diagnostic: 'no entity for tag check',
      details: { entityRef: condition.entity },
    };
  }

  const has = hasTag(entity.tags, condition.tag);
  let passed = has;

  if (has && condition.value !== undefined) {
    const actualValue = getTagValue(entity.tags, condition.tag);
    passed = actualValue === condition.value;
  }

  return {
    passed,
    diagnostic: `tag '${condition.tag}' ${passed ? 'exists' : 'missing'}${condition.value !== undefined ? ' (value=' + condition.value + ')' : ''}`,
    details: {
      tag: condition.tag,
      value: condition.value,
      hasTag: has,
      entityRef: condition.entity,
      entityId: entity.id,
    },
  };
}

function resolveEntityRef(
  ref: string | undefined,
  ctx: RuleContext,
  self?: HardState
): HardState | undefined {
  if (!ref) return self;

  if (ref === '$self') {
    return self;
  }

  if (ref.startsWith('$')) {
    const name = ref.slice(1);
    const bound = ctx.entities?.[name];
    if (bound) return bound;
  }

  return ctx.resolver.resolveEntity(ref);
}

function evaluateLacksTag(
  condition: LacksTagCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx, self);

  if (!entity) {
    return {
      passed: true,
      diagnostic: 'no entity (lacks_tag trivially true)',
      details: { entityRef: condition.entity },
    };
  }

  const has = hasTag(entity.tags, condition.tag);
  const passed = !has;

  return {
    passed,
    diagnostic: `tag '${condition.tag}' ${passed ? 'absent' : 'present'}`,
    details: { tag: condition.tag, hasTag: has, entityRef: condition.entity, entityId: entity.id },
  };
}

// =============================================================================
// STATUS/PROMINENCE EVALUATORS
// =============================================================================

function evaluateStatus(
  condition: StatusCondition,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for status check', details: {} };
  }

  const matches = self.status === condition.status;
  const passed = condition.not ? !matches : matches;

  return {
    passed,
    diagnostic: `status ${condition.not ? '!=' : '=='} ${condition.status}: ${passed}`,
    details: { expectedStatus: condition.status, actualStatus: self.status, not: condition.not },
  };
}

function evaluateProminence(
  condition: ProminenceCondition,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for prominence check', details: {} };
  }

  const currentValue = self.prominence;
  const currentLabel = prominenceLabel(currentValue);

  // Convert string labels to thresholds
  const minValue = condition.min ? prominenceThreshold(condition.min) : 0;
  const maxValue = condition.max ? prominenceThreshold(condition.max) + 1 : 5; // upper bound of range

  const passed = currentValue >= minValue && currentValue < maxValue;

  return {
    passed,
    diagnostic: `prominence ${currentLabel} (${currentValue.toFixed(2)}) in [${condition.min ?? 'forgotten'}, ${condition.max ?? 'mythic'}]: ${passed}`,
    details: {
      prominence: currentValue,
      prominenceLabel: currentLabel,
      min: condition.min,
      max: condition.max,
    },
  };
}

// =============================================================================
// TIME EVALUATORS
// =============================================================================

function evaluateTimeElapsed(
  condition: TimeElapsedCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for time check', details: {} };
  }

  const since = condition.since ?? 'updated';
  const timestamp = since === 'created' ? self.createdAt : self.updatedAt;
  const elapsed = ctx.tick - timestamp;
  const passed = elapsed >= condition.minTicks;

  return {
    passed,
    diagnostic: `time since ${since}=${elapsed} ticks (need ${condition.minTicks})`,
    details: { since, timestamp, elapsed, minTicks: condition.minTicks },
  };
}

function evaluateCooldownElapsed(
  condition: CooldownElapsedCondition,
  ctx: RuleContext
): ConditionResult {
  const rateLimitState = ctx.graph.rateLimitState;
  const lastTick = rateLimitState?.lastCreationTick ?? 0;
  const elapsed = ctx.tick - lastTick;
  const passed = elapsed >= condition.cooldownTicks;

  return {
    passed,
    diagnostic: `cooldown elapsed=${elapsed} ticks (need ${condition.cooldownTicks})`,
    details: { lastCreationTick: lastTick, elapsed, cooldownTicks: condition.cooldownTicks },
  };
}

function evaluateCreationsPerEpoch(
  condition: CreationsPerEpochCondition,
  ctx: RuleContext
): ConditionResult {
  const rateLimitState = ctx.graph.rateLimitState;
  const count = rateLimitState?.creationsThisEpoch ?? 0;
  const passed = count < condition.maxPerEpoch;

  return {
    passed,
    diagnostic: `creations this epoch=${count} (max ${condition.maxPerEpoch})`,
    details: { creationsThisEpoch: count, maxPerEpoch: condition.maxPerEpoch },
  };
}

function evaluateGrowthPhasesComplete(
  condition: GrowthPhasesCompleteCondition,
  ctx: RuleContext
): ConditionResult {
  const eraId = condition.eraId ?? ctx.graph.currentEra?.id ?? '';
  const history = ctx.graph.growthPhaseHistory ?? [];
  const count = history.filter(entry => entry.eraId === eraId).length;
  const passed = count >= condition.minPhases;

  return {
    passed,
    diagnostic: `growth phases complete in era ${eraId}=${count} (need ${condition.minPhases})`,
    details: { eraId, count, minPhases: condition.minPhases },
  };
}

// =============================================================================
// ERA EVALUATORS
// =============================================================================

function evaluateEraMatch(
  condition: EraMatchCondition,
  ctx: RuleContext
): ConditionResult {
  const currentEraId = ctx.graph.currentEra?.id ?? '';
  const passed = condition.eras.includes(currentEraId);

  return {
    passed,
    diagnostic: `era ${currentEraId} in [${condition.eras.join(', ')}]: ${passed}`,
    details: { currentEra: currentEraId, allowedEras: condition.eras },
  };
}

// =============================================================================
// PROBABILITY EVALUATORS
// =============================================================================

function evaluateRandomChance(condition: RandomChanceCondition): ConditionResult {
  // eslint-disable-next-line sonarjs/pseudo-random -- simulation probability roll
  const roll = Math.random();
  const passed = roll < condition.chance;

  return {
    passed,
    diagnostic: `random ${(roll * 100).toFixed(1)}% < ${(condition.chance * 100).toFixed(1)}%`,
    details: { roll, chance: condition.chance },
  };
}

// =============================================================================
// GRAPH PATH EVALUATORS
// =============================================================================

function evaluateGraphPathCondition(
  condition: GraphPathCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for graph path', details: {} };
  }

  const passed = evaluateGraphPath(self, condition.assert, ctx.resolver, {
    filterEvaluator: (entities, filters, resolver, options) =>
      applySelectionFilters(entities, filters, resolver, options)
  });

  return {
    passed,
    diagnostic: `graph path ${condition.assert.check}: ${passed}`,
    details: { assertion: condition.assert },
  };
}

// =============================================================================
// GRAPH TOPOLOGY EVALUATORS
// =============================================================================

/**
 * Check connected component size against min/max bounds.
 *
 * Uses DFS to find all entities transitively reachable via the specified
 * relationship kind(s), treating the subgraph as undirected.
 */
function buildComponentAdjacency(
  rels: Array<{ kind: string; src: string; dst: string; strength?: number }>,
  kinds: string[],
  minStrength: number
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const link of rels) {
    if (!kinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;
    if (!adjacency.has(link.src)) adjacency.set(link.src, new Set());
    if (!adjacency.has(link.dst)) adjacency.set(link.dst, new Set());
    adjacency.get(link.src)!.add(link.dst);
    adjacency.get(link.dst)!.add(link.src);
  }
  return adjacency;
}

function dfsComponentSize(startId: string, adjacency: Map<string, Set<string>>): number {
  const visited = new Set<string>([startId]);
  const stack = [startId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        stack.push(neighborId);
      }
    }
  }
  return visited.size;
}

function evaluateComponentSize(
  condition: ComponentSizeCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  if (!self) {
    return { passed: false, diagnostic: 'no entity for component size', details: {} };
  }

  const minStrength = condition.minStrength ?? 0;
  const adjacency = buildComponentAdjacency(ctx.graph.getAllRelationships(), condition.relationshipKinds, minStrength);
  const componentSize = dfsComponentSize(self.id, adjacency);

  const minOk = condition.min === undefined || componentSize >= condition.min;
  const maxOk = condition.max === undefined || componentSize <= condition.max;
  const passed = minOk && maxOk;

  return {
    passed,
    diagnostic: `component size via ${condition.relationshipKinds.join('/')} = ${componentSize} (${condition.min ?? 1} to ${condition.max ?? '∞'})`,
    details: { entityId: self.id, relationshipKinds: condition.relationshipKinds, minStrength, componentSize, min: condition.min, max: condition.max },
  };
}

// =============================================================================
// ENTITY EXISTENCE EVALUATORS
// =============================================================================

function evaluateEntityExists(
  condition: EntityExistsCondition,
  ctx: RuleContext
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx);
  const passed = entity !== undefined;

  return {
    passed,
    diagnostic: `entity ${condition.entity} exists: ${passed}`,
    details: { entityRef: condition.entity, entityId: entity?.id },
  };
}

function evaluateEntityHasRelationship(
  condition: EntityHasRelationshipCondition,
  ctx: RuleContext
): ConditionResult {
  const entity = resolveEntityRef(condition.entity, ctx);
  if (!entity) {
    return {
      passed: false,
      diagnostic: `entity ${condition.entity} not found`,
      details: { entityRef: condition.entity },
    };
  }

  const direction = normalizeDirection(condition.direction);
  const passed = ctx.graph.getAllRelationships().some((link) => {
    if (link.kind !== condition.relationshipKind) return false;
    if (direction === 'both') {
      return link.src === entity.id || link.dst === entity.id;
    }
    if (direction === 'src') {
      return link.src === entity.id;
    }
    return link.dst === entity.id;
  });

  return {
    passed,
    diagnostic: `entity ${condition.entity} has ${condition.relationshipKind}: ${passed}`,
    details: {
      entityRef: condition.entity,
      entityId: entity.id,
      relationshipKind: condition.relationshipKind,
      direction,
    },
  };
}

// =============================================================================
// COMPOSITE EVALUATORS
// =============================================================================

function evaluateAnd(
  condition: AndCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const results = condition.conditions.map((c) => evaluateCondition(c, ctx, self));
  const passed = results.every((r) => r.passed);

  return {
    passed,
    diagnostic: `and(${results.map((r) => (r.passed ? 'T' : 'F')).join(',')})`,
    details: { results },
  };
}

function evaluateOr(
  condition: OrCondition,
  ctx: RuleContext,
  self?: HardState
): ConditionResult {
  const results = condition.conditions.map((c) => evaluateCondition(c, ctx, self));
  const passed = results.some((r) => r.passed);

  return {
    passed,
    diagnostic: `or(${results.map((r) => (r.passed ? 'T' : 'F')).join(',')})`,
    details: { results },
  };
}
