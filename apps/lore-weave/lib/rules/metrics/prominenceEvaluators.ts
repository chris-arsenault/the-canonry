/**
 * Prominence Metric Evaluators
 *
 * Evaluators for prominence_multiplier and neighbor_prominence metrics.
 */

import type { HardState, Relationship } from '../../core/worldTypes';
import { normalizeDirection, prominenceLabel } from '../types';
import type {
  MetricResult,
  ProminenceMultiplierMetric,
  NeighborProminenceMetric,
} from './types';
import type { MetricContext } from './index';

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
  const clamped = Math.max(0, Math.min(5, prominence));
  const level = Math.min(4, Math.floor(clamped));
  const fraction = clamped - level;
  const current = multipliers[level];
  const next = multipliers[Math.min(level + 1, 4)];
  return current + (next - current) * fraction;
}

export function evaluateProminenceMultiplier(
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

/** Collect neighbor IDs matching relationship and direction filters. */
function collectNeighborIds(
  entity: HardState,
  rels: readonly Relationship[],
  metric: NeighborProminenceMetric,
  direction: 'src' | 'dst' | 'both',
  minStrength: number
): Set<string> {
  const neighborIds = new Set<string>();
  for (const link of rels) {
    if (metric.relationshipKinds?.length && !metric.relationshipKinds.includes(link.kind)) {
      continue;
    }
    if ((link.strength ?? 0) < minStrength) continue;

    if (direction === 'both') {
      if (link.src === entity.id) neighborIds.add(link.dst);
      if (link.dst === entity.id) neighborIds.add(link.src);
    } else if (direction === 'src' && link.src === entity.id) {
      neighborIds.add(link.dst);
    } else if (direction === 'dst' && link.dst === entity.id) {
      neighborIds.add(link.src);
    }
  }
  return neighborIds;
}

/** Calculate average prominence for a set of neighbor IDs. */
function calcAvgProminence(
  neighborIds: Set<string>,
  ctx: MetricContext
): { avgProminence: number; validNeighbors: number; totalProminence: number } {
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
  return { avgProminence, validNeighbors, totalProminence };
}

/**
 * Calculate average prominence of connected entities.
 * Implements "Reflected Glory" - entities connected to high-prominence
 * entities can benefit from their fame.
 */
export function evaluateNeighborProminence(
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

  const neighborIds = collectNeighborIds(entity, rels, metric, direction, minStrength);

  if (neighborIds.size === 0) {
    return {
      value: 0,
      diagnostic: `no neighbors found for ${entity.name}`,
      details: { entityId: entity.id, neighborCount: 0 },
    };
  }

  const { avgProminence, validNeighbors, totalProminence } = calcAvgProminence(neighborIds, ctx);

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
