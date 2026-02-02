import type { EntityContext, RelationshipContext } from '../chronicleTypes';

export interface SharedNeighborLink {
  neighborId: string;
  linksFromA: RelationshipContext[];
  linksFromB: RelationshipContext[];
}

export interface RelationshipPairSummary {
  entityAId: string;
  entityBId: string;
  direct: RelationshipContext[];
  sharedNeighbors: SharedNeighborLink[];
}

export function buildEntityLookup(
  entities: EntityContext[],
  relationships: RelationshipContext[]
): Map<string, { name: string; kind?: string }> {
  const lookup = new Map<string, { name: string; kind?: string }>();

  for (const entity of entities) {
    lookup.set(entity.id, { name: entity.name, kind: entity.kind });
  }

  for (const rel of relationships) {
    if (!lookup.has(rel.src)) {
      lookup.set(rel.src, { name: rel.sourceName, kind: rel.sourceKind });
    }
    if (!lookup.has(rel.dst)) {
      lookup.set(rel.dst, { name: rel.targetName, kind: rel.targetKind });
    }
  }

  return lookup;
}

function buildAdjacency(
  relationships: RelationshipContext[]
): Map<string, RelationshipContext[]> {
  const adjacency = new Map<string, RelationshipContext[]>();

  for (const rel of relationships) {
    if (!adjacency.has(rel.src)) adjacency.set(rel.src, []);
    if (!adjacency.has(rel.dst)) adjacency.set(rel.dst, []);
    adjacency.get(rel.src)!.push(rel);
    adjacency.get(rel.dst)!.push(rel);
  }

  return adjacency;
}

function collectNeighborLinks(
  adjacency: Map<string, RelationshipContext[]>,
  entityId: string
): Map<string, RelationshipContext[]> {
  const neighbors = new Map<string, RelationshipContext[]>();
  const links = adjacency.get(entityId) || [];

  for (const rel of links) {
    const neighborId = rel.src === entityId ? rel.dst : rel.src;
    if (!neighborId || neighborId === entityId) continue;
    if (!neighbors.has(neighborId)) neighbors.set(neighborId, []);
    neighbors.get(neighborId)!.push(rel);
  }

  return neighbors;
}

export function buildRelationshipPairSummaries(
  entityIds: string[],
  relationships: RelationshipContext[]
): RelationshipPairSummary[] {
  const uniqueIds = Array.from(new Set(entityIds));
  const adjacency = buildAdjacency(relationships);
  const summaries: RelationshipPairSummary[] = [];

  for (let i = 0; i < uniqueIds.length; i += 1) {
    const entityAId = uniqueIds[i];
    const neighborsA = collectNeighborLinks(adjacency, entityAId);

    for (let j = i + 1; j < uniqueIds.length; j += 1) {
      const entityBId = uniqueIds[j];
      const neighborsB = collectNeighborLinks(adjacency, entityBId);

      const direct = (adjacency.get(entityAId) || []).filter(
        (rel) => rel.src === entityBId || rel.dst === entityBId
      );

      const sharedNeighbors: SharedNeighborLink[] = [];
      for (const [neighborId, linksFromA] of neighborsA.entries()) {
        const linksFromB = neighborsB.get(neighborId);
        if (!linksFromB) continue;
        sharedNeighbors.push({ neighborId, linksFromA, linksFromB });
      }

      sharedNeighbors.sort((a, b) => a.neighborId.localeCompare(b.neighborId));

      summaries.push({
        entityAId,
        entityBId,
        direct,
        sharedNeighbors,
      });
    }
  }

  return summaries;
}
