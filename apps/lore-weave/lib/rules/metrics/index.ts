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
  evaluateSimpleCount,
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
  getProminenceMultiplierValue,
} from './prominenceEvaluators';
import { evaluateNeighborKindCount } from './neighborEvaluators';
import { evaluateComponentSize } from './topologyEvaluators';
import { evaluateDecayRate, evaluateFalloff } from './decayEvaluators';
import { describeMetric } from './describe';

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
export function evaluateMetric(
  metric: Metric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  switch (metric.type) {
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
    case 'ratio':
      return evaluateRatio(metric, ctx);
    case 'status_ratio':
      return evaluateStatusRatio(metric, ctx);
    case 'cross_culture_ratio':
      return evaluateCrossCultureRatio(metric, ctx);
    case 'shared_relationship':
      return evaluateSharedRelationship(metric, ctx, entity);
    case 'prominence_multiplier':
      return evaluateProminenceMultiplier(metric, entity);
    case 'neighbor_prominence':
      return evaluateNeighborProminence(metric, ctx, entity);
    case 'neighbor_kind_count':
      return evaluateNeighborKindCount(metric, ctx, entity);
    case 'component_size':
      return evaluateComponentSize(metric, ctx, entity);
    case 'decay_rate':
      return evaluateDecayRate(metric);
    case 'falloff':
      return evaluateFalloff(metric);
    default:
      return {
        value: 0,
        diagnostic: `unknown metric type: ${(metric as { type: string }).type}`,
        details: { metric },
      };
  }
}
