import type { HardState, Prominence, WorldState, Filters } from '../types/world.ts';

export function prominenceToNumber(prominence: Prominence): number {
  const map: Record<Prominence, number> = {
    forgotten: 0,
    marginal: 1,
    recognized: 2,
    renowned: 3,
    mythic: 4
  };
  return map[prominence] || 0;
}

export function getKindColor(kind: string): string {
  const colors: Record<string, string> = {
    npc: '#6FB1FC',
    faction: '#FC6B6B',
    location: '#6BFC9C',
    rules: '#FCA86B',
    abilities: '#C76BFC'
  };
  return colors[kind] || '#999';
}

export function transformWorldData(worldState: WorldState) {
  const nodes = worldState.hardState.map(entity => ({
    data: {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      subtype: entity.subtype,
      prominence: prominenceToNumber(entity.prominence),
      prominenceLabel: entity.prominence,
      status: entity.status,
      tags: entity.tags,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    },
    classes: `${entity.kind} ${entity.subtype} ${entity.prominence}`
  }));

  const edges = worldState.relationships.map((rel) => ({
    data: {
      id: `edge-${rel.src}-${rel.dst}-${rel.kind}`,
      source: rel.src,
      target: rel.dst,
      kind: rel.kind,
      label: rel.kind.replace(/_/g, ' ')
    },
    classes: rel.kind.replace(/_/g, '-')
  }));

  return [...nodes, ...edges];
}

export function applyFilters(worldState: WorldState, filters: Filters): WorldState {
  const prominenceOrder: Prominence[] = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
  const minProminenceIndex = prominenceOrder.indexOf(filters.minProminence);

  let filtered = worldState.hardState.filter(entity => {
    // Filter by kind
    if (!filters.kinds.includes(entity.kind)) return false;

    // Filter by prominence
    const entityProminenceIndex = prominenceOrder.indexOf(entity.prominence);
    if (entityProminenceIndex < minProminenceIndex) return false;

    // Filter by time range
    if (entity.createdAt < filters.timeRange[0] || entity.createdAt > filters.timeRange[1]) {
      return false;
    }

    // Filter by tags
    if (filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(tag => entity.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matches =
        entity.name.toLowerCase().includes(query) ||
        entity.description.toLowerCase().includes(query) ||
        entity.tags.some(tag => tag.toLowerCase().includes(query));
      if (!matches) return false;
    }

    return true;
  });

  // Get IDs of filtered entities
  const filteredIds = new Set(filtered.map(e => e.id));

  // Get all unique relationship types for comparison
  const allRelTypes = new Set(worldState.relationships.map(r => r.kind));

  // Filter relationships to only include those between filtered entities
  // Also filter by relationship type if specified
  const filteredRelationships = worldState.relationships.filter(rel => {
    // Must be between visible entities
    if (!filteredIds.has(rel.src) || !filteredIds.has(rel.dst)) return false;

    // If relationship type filter has ALL types selected, show none (special "clear all" case)
    if (filters.relationshipTypes.length === allRelTypes.size &&
        filters.relationshipTypes.length > 0) {
      return false;
    }

    // If relationship type filter is active and not empty, check if this type is included
    if (filters.relationshipTypes.length > 0) {
      return filters.relationshipTypes.includes(rel.kind);
    }

    // Empty array means show all
    return true;
  });

  return {
    ...worldState,
    hardState: filtered,
    relationships: filteredRelationships,
    metadata: {
      ...worldState.metadata,
      entityCount: filtered.length,
      relationshipCount: filteredRelationships.length
    }
  };
}

export function getAllTags(worldState: WorldState): string[] {
  const tagSet = new Set<string>();
  worldState.hardState.forEach(entity => {
    entity.tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

export function getAllRelationshipTypes(worldState: WorldState): string[] {
  const typeSet = new Set<string>();
  worldState.relationships.forEach(rel => {
    typeSet.add(rel.kind);
  });
  return Array.from(typeSet).sort();
}

export function getRelationshipTypeCounts(worldState: WorldState): Record<string, number> {
  const counts: Record<string, number> = {};
  worldState.relationships.forEach(rel => {
    counts[rel.kind] = (counts[rel.kind] || 0) + 1;
  });
  return counts;
}

export function getEntityById(worldState: WorldState, id: string): HardState | undefined {
  return worldState.hardState.find(e => e.id === id);
}

export function getRelatedEntities(
  worldState: WorldState,
  entityId: string
): HardState[] {
  const relatedIds = new Set<string>();

  worldState.relationships.forEach(rel => {
    if (rel.src === entityId) {
      relatedIds.add(rel.dst);
    }
    if (rel.dst === entityId) {
      relatedIds.add(rel.src);
    }
  });

  return worldState.hardState.filter(e => relatedIds.has(e.id));
}

export function getRelationships(
  worldState: WorldState,
  entityId: string
) {
  return worldState.relationships.filter(
    rel => rel.src === entityId || rel.dst === entityId
  );
}

export function applyTemporalFilter(worldState: WorldState, maxTick: number): WorldState {
  // Filter entities created at or before maxTick
  const filteredEntities = worldState.hardState.filter(entity => entity.createdAt <= maxTick);

  // Filter relationships where both source and destination entities exist at maxTick
  const filteredRelationships = worldState.relationships.filter(rel => {
    const srcEntity = worldState.hardState.find(e => e.id === rel.src);
    const dstEntity = worldState.hardState.find(e => e.id === rel.dst);
    return srcEntity && dstEntity &&
           srcEntity.createdAt <= maxTick &&
           dstEntity.createdAt <= maxTick;
  });

  // Filter history to only include events up to maxTick
  const filteredHistory = worldState.history.filter(event => event.tick <= maxTick);

  return {
    ...worldState,
    hardState: filteredEntities,
    relationships: filteredRelationships,
    history: filteredHistory,
    metadata: {
      ...worldState.metadata,
      tick: maxTick,
      entityCount: filteredEntities.length,
      relationshipCount: filteredRelationships.length
    }
  };
}
