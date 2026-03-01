/**
 * Graph Topology Metric Evaluators
 *
 * Evaluator for component_size metric using DFS on relationship subgraphs.
 */

import type { HardState } from '../../core/worldTypes';
import type {
  MetricResult,
  ComponentSizeMetric,
} from './types';
import type { MetricContext } from './index';

/** Build an undirected adjacency index from relationships matching the criteria. */
function buildAdjacency(
  ctx: MetricContext,
  relationshipKinds: string[],
  minStrength: number
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const rels = ctx.graph.getAllRelationships();

  for (const link of rels) {
    if (!relationshipKinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    if (!adjacency.has(link.src)) adjacency.set(link.src, new Set());
    if (!adjacency.has(link.dst)) adjacency.set(link.dst, new Set());
    adjacency.get(link.src)!.add(link.dst);
    adjacency.get(link.dst)!.add(link.src);
  }

  return adjacency;
}

/** DFS to find all reachable entities from a starting entity. */
function findComponent(
  startId: string,
  adjacency: Map<string, Set<string>>
): Set<string> {
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

  return visited;
}

/**
 * Calculate the size of the connected component containing an entity.
 *
 * Uses DFS to find all entities transitively reachable via the specified
 * relationship kind(s), treating the subgraph as undirected.
 */
export function evaluateComponentSize(
  metric: ComponentSizeMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for component size', details: {} };
  }

  const minStrength = metric.minStrength ?? 0;
  const adjacency = buildAdjacency(ctx, metric.relationshipKinds, minStrength);
  const visited = findComponent(entity.id, adjacency);
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
