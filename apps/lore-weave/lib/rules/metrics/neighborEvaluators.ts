/**
 * Neighbor Metric Evaluators
 *
 * Evaluator for neighbor_kind_count metric.
 * Counts neighboring entities of a specific kind connected via relationship chain.
 */

import type { HardState, Relationship } from '../../core/worldTypes';
import { hasTag } from '../../utils';
import { normalizeDirection } from '../types';
import type {
  MetricResult,
  NeighborKindCountMetric,
} from './types';
import type { MetricContext } from './index';

/** Collect entity IDs reachable from a source entity via specified relationship kinds. */
function collectViaEntityIds(
  entityId: string,
  rels: readonly Relationship[],
  viaKinds: string[],
  direction: 'src' | 'dst' | 'both',
  minStrength: number
): Set<string> {
  const viaEntityIds = new Set<string>();
  for (const link of rels) {
    if (!viaKinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    if (direction === 'both') {
      if (link.src === entityId) viaEntityIds.add(link.dst);
      if (link.dst === entityId) viaEntityIds.add(link.src);
    } else if (direction === 'src' && link.src === entityId) {
      viaEntityIds.add(link.dst);
    } else if (direction === 'dst' && link.dst === entityId) {
      viaEntityIds.add(link.src);
    }
  }
  return viaEntityIds;
}

/** Traverse a second hop from a set of intermediate entity IDs. */
function traverseSecondHop(
  fromIds: Set<string>,
  rels: readonly Relationship[],
  thenKind: string,
  direction: 'src' | 'dst' | 'both'
): Set<string> {
  const targetEntityIds = new Set<string>();
  for (const viaId of fromIds) {
    for (const link of rels) {
      if (link.kind !== thenKind) continue;
      if (direction === 'both') {
        if (link.src === viaId) targetEntityIds.add(link.dst);
        if (link.dst === viaId) targetEntityIds.add(link.src);
      } else if (direction === 'src' && link.src === viaId) {
        targetEntityIds.add(link.dst);
      } else if (direction === 'dst' && link.dst === viaId) {
        targetEntityIds.add(link.src);
      }
    }
  }
  return targetEntityIds;
}

/** Count entities matching kind/subtype/status/tag criteria from a set of IDs. */
function countMatchingEntities(
  targetIds: Set<string>,
  metric: NeighborKindCountMetric,
  ctx: MetricContext
): number {
  let count = 0;
  for (const targetId of targetIds) {
    const target = ctx.graph.getEntity(targetId);
    if (!target) continue;
    if (target.kind !== metric.kind) continue;
    if (metric.subtype && target.subtype !== metric.subtype) continue;
    if (metric.status && target.status !== metric.status) continue;
    if (metric.hasTag && !hasTag(target.tags, metric.hasTag)) continue;
    count++;
  }
  return count;
}

/**
 * Count neighboring entities of a specific kind connected via relationship chain.
 *
 * Traverses from entity via first relationship, then optionally via second relationship,
 * and counts entities matching the kind/subtype/status criteria.
 */
export function evaluateNeighborKindCount(
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
  const viaKinds = Array.isArray(metric.via) ? metric.via : [metric.via];

  const viaEntityIds = collectViaEntityIds(entity.id, rels, viaKinds, viaDirection, minStrength);

  const targetEntityIds = metric.then
    ? traverseSecondHop(viaEntityIds, rels, metric.then, normalizeDirection(metric.thenDirection))
    : viaEntityIds;

  const count = countMatchingEntities(targetEntityIds, metric, ctx);

  let value = count * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  const viaStr = Array.isArray(metric.via) ? metric.via.join('/') : metric.via;
  return {
    value,
    diagnostic: `neighbor ${metric.kind} count=${count} via ${viaStr}${metric.then ? '->' + metric.then : ''}`,
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
