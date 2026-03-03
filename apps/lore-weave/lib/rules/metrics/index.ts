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
import type { EntityCriteria } from '../../engine/types';
import type {
  Metric,
  MetricResult,
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

// Sub-module evaluators
import {
  evaluateEntityCount,
  evaluateRelationshipCount,
  evaluateTagCount,
  evaluateTotalEntities,
  evaluateConstant,
  evaluateConnectionCount,
} from './countEvaluators';
import {
  evaluateRatio,
  evaluateStatusRatio,
  evaluateCrossCultureRatio,
} from './ratioEvaluators';
import { evaluateSharedRelationship } from './evolutionEvaluators';
import {
  evaluateProminenceMultiplier,
  evaluateNeighborProminence,
} from './prominenceEvaluators';
import { evaluateNeighborKindCount } from './neighborEvaluators';
import { evaluateComponentSize } from './topologyEvaluators';
import { evaluateDecayRate, evaluateFalloff } from './decayEvaluators';


// Re-export types
export interface MetricGraph {
  findEntities(criteria: EntityCriteria): HardState[];
  getEntities(options?: { includeHistorical?: boolean }): HardState[];
  getAllRelationships(options?: { includeHistorical?: boolean }): readonly Relationship[];
  getEntity(id: string): HardState | undefined;
}

export interface MetricContext {
  graph: MetricGraph;
}

export * from './types';

// Re-export sub-module functions
export { describeMetric } from './describe';
export { evaluateSimpleCount } from './countEvaluators';
export { getProminenceMultiplierValue } from './prominenceEvaluators';

/**
 * Evaluate a metric against the current context.
 *
 * @param metric - The metric to evaluate
 * @param ctx - The rule context
 * @param entity - Optional entity for per-entity metrics
 * @returns MetricResult with value and diagnostic info
 */
type MetricHandler = (metric: Metric, ctx: MetricContext, entity: HardState) => MetricResult;

const METRIC_DISPATCH: Record<Metric['type'], MetricHandler> = {
  entity_count: (metric, ctx) => evaluateEntityCount(metric as EntityCountMetric, ctx),
  relationship_count: (metric, ctx, entity) => evaluateRelationshipCount(metric as RelationshipCountMetric, ctx, entity),
  tag_count: (metric, ctx) => evaluateTagCount(metric as TagCountMetric, ctx),
  total_entities: (metric, ctx) => evaluateTotalEntities(metric as TotalEntitiesMetric, ctx),
  constant: (metric) => evaluateConstant(metric as ConstantMetric),
  connection_count: (metric, ctx, entity) => evaluateConnectionCount(metric as ConnectionCountMetric, ctx, entity),
  ratio: (metric, ctx) => evaluateRatio(metric as RatioMetric, ctx),
  status_ratio: (metric, ctx) => evaluateStatusRatio(metric as StatusRatioMetric, ctx),
  cross_culture_ratio: (metric, ctx) => evaluateCrossCultureRatio(metric as CrossCultureRatioMetric, ctx),
  shared_relationship: (metric, ctx, entity) => evaluateSharedRelationship(metric as SharedRelationshipMetric, ctx, entity),
  prominence_multiplier: (metric, _ctx, entity) => evaluateProminenceMultiplier(metric as ProminenceMultiplierMetric, entity),
  neighbor_prominence: (metric, ctx, entity) => evaluateNeighborProminence(metric as NeighborProminenceMetric, ctx, entity),
  neighbor_kind_count: (metric, ctx, entity) => evaluateNeighborKindCount(metric as NeighborKindCountMetric, ctx, entity),
  component_size: (metric, ctx, entity) => evaluateComponentSize(metric as ComponentSizeMetric, ctx, entity),
  decay_rate: (metric) => evaluateDecayRate(metric as DecayRateMetric),
  falloff: (metric) => evaluateFalloff(metric as FalloffMetric),
};

export function evaluateMetric(
  metric: Metric,
  ctx: MetricContext,
  entity: HardState = {} as HardState
): MetricResult {
  return METRIC_DISPATCH[metric.type](metric, ctx, entity);
}
