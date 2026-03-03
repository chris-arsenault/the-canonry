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
import type {
  Metric,
  MetricResult,
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
  findEntities(criteria: {
    kind: string;
    subtype: string;
    status: string;
    prominence: string;
    tag: string;
  }): HardState[];
  getEntities(): HardState[];
  getAllRelationships(): readonly Relationship[];
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
  entity_count: (metric, ctx) => evaluateEntityCount(metric, ctx),
  relationship_count: (metric, ctx, entity) => evaluateRelationshipCount(metric, ctx, entity),
  tag_count: (metric, ctx) => evaluateTagCount(metric, ctx),
  total_entities: (metric, ctx) => evaluateTotalEntities(metric, ctx),
  constant: (metric) => evaluateConstant(metric),
  connection_count: (metric, ctx, entity) => evaluateConnectionCount(metric, ctx, entity),
  ratio: (metric, ctx) => evaluateRatio(metric, ctx),
  status_ratio: (metric, ctx) => evaluateStatusRatio(metric, ctx),
  cross_culture_ratio: (metric, ctx) => evaluateCrossCultureRatio(metric, ctx),
  shared_relationship: (metric, ctx, entity) => evaluateSharedRelationship(metric, ctx, entity),
  prominence_multiplier: (metric, _ctx, entity) => evaluateProminenceMultiplier(metric, entity),
  neighbor_prominence: (metric, ctx, entity) => evaluateNeighborProminence(metric, ctx, entity),
  neighbor_kind_count: (metric, ctx, entity) => evaluateNeighborKindCount(metric, ctx, entity),
  component_size: (metric, ctx, entity) => evaluateComponentSize(metric, ctx, entity),
  decay_rate: (metric) => evaluateDecayRate(metric),
  falloff: (metric) => evaluateFalloff(metric),
};

export function evaluateMetric(
  metric: Metric,
  ctx: MetricContext,
  entity: HardState
): MetricResult {
  return METRIC_DISPATCH[metric.type](metric, ctx, entity);
}
