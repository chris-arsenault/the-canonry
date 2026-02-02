/**
 * Entity Query Utilities
 *
 * Functions for finding and querying entities in the graph.
 */

import { Graph } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';

/**
 * Find entities matching criteria
 */
export function findEntities(
  graph: Graph,
  criteria: Partial<HardState>
): HardState[] {
  const results: HardState[] = [];

  graph.forEachEntity(entity => {
    let matches = true;

    for (const [key, value] of Object.entries(criteria)) {
      if (entity[key as keyof HardState] !== value) {
        matches = false;
        break;
      }
    }

    if (matches) {
      results.push(entity);
    }
  });

  return results;
}

/**
 * Relationship query options
 */
export interface RelationshipQueryOptions {
  minStrength?: number;      // Filter by minimum strength
  maxStrength?: number;      // Filter by maximum strength
  sortByStrength?: boolean;  // Sort by strength descending
}

/**
 * Get related entities via relationships
 */
export function getRelated(
  graph: Graph,
  entityId: string,
  relationshipKind?: string,
  direction: 'src' | 'dst' | 'both' = 'both',
  options?: RelationshipQueryOptions
): HardState[] {
  const related: Array<{ entity: HardState; strength: number }> = [];
  const opts = options || {};

  graph.getRelationships().forEach(rel => {
    if (relationshipKind && rel.kind !== relationshipKind) return;

    // Strength filtering
    const strength = rel.strength ?? 0.5;
    if (opts.minStrength !== undefined && strength < opts.minStrength) return;
    if (opts.maxStrength !== undefined && strength > opts.maxStrength) return;

    if ((direction === 'src' || direction === 'both') && rel.src === entityId) {
      const entity = graph.getEntity(rel.dst);
      if (entity) related.push({ entity, strength });
    }

    if ((direction === 'dst' || direction === 'both') && rel.dst === entityId) {
      const entity = graph.getEntity(rel.src);
      if (entity) related.push({ entity, strength });
    }
  });

  // Sort by strength if requested
  if (opts.sortByStrength) {
    related.sort((a, b) => b.strength - a.strength);
  }

  return related.map(r => r.entity);
}

export function hasRelationship(
  graph: Graph,
  srcId: string,
  dstId: string,
  kind?: string
): boolean {
  return graph.getRelationships().some(rel =>
    rel.src === srcId &&
    rel.dst === dstId &&
    (!kind || rel.kind === kind)
  );
}

/**
 * Calculate relationship formation weight based on existing connection count.
 * Favors underconnected entities to balance network density and prevent hubs.
 */
export function getConnectionWeight(graph: Graph, entity: HardState): number {
  const connectionCount = graph.getEntityRelationships(entity.id, 'both').length;

  // Boost isolated/underconnected entities
  if (connectionCount === 0) return 3.0;    // Strongly boost isolated
  if (connectionCount <= 2) return 2.0;     // Boost underconnected (below median)
  if (connectionCount <= 5) return 1.0;     // Normal
  if (connectionCount <= 10) return 0.5;    // Reduce well-connected
  return 0.2;                               // Heavily reduce hubs (15+)
}

/**
 * Determine the relationship between two sets of factions.
 */
export function getFactionRelationship(
  factions1: HardState[],
  factions2: HardState[],
  graph: Graph
): 'allied' | 'enemy' | 'neutral' {
  // Check for warfare/enmity
  const atWar = factions1.some(f1 =>
    factions2.some(f2 =>
      hasRelationship(graph, f1.id, f2.id, 'at_war_with') ||
      hasRelationship(graph, f1.id, f2.id, 'enemy_of')
    )
  );
  if (atWar) return 'enemy';

  // Check for alliances
  const allied = factions1.some(f1 =>
    factions2.some(f2 => hasRelationship(graph, f1.id, f2.id, 'allied_with'))
  );
  if (allied) return 'allied';

  return 'neutral';
}
