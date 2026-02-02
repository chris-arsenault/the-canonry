import type { HardState, Prominence, WorldState, Filters, Schema } from '../types/world.ts';
import {
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
  type ProminenceScale,
} from '@canonry/world-schema';

const VALID_PROMINENCE_LEVELS: ReadonlySet<Prominence> = new Set([
  'forgotten',
  'marginal',
  'recognized',
  'renowned',
  'mythic',
]);

const FALLBACK_PROMINENCE_SCALE = buildProminenceScale([], {
  distribution: DEFAULT_PROMINENCE_DISTRIBUTION
});

function resolveProminenceScale(prominenceScale?: ProminenceScale): ProminenceScale {
  return prominenceScale ?? FALLBACK_PROMINENCE_SCALE;
}

// Helper to get tags as array (canonical KVP format)
export function getTagsArray(tags: Record<string, string | boolean>): string[] {
  return Object.keys(tags);
}

// Get prominence levels from schema (no fallbacks)
export function getProminenceLevels(schema?: Schema): Prominence[] {
  const levels = schema?.uiConfig?.prominenceLevels;
  if (!levels || levels.length === 0) {
    throw new Error('Archivist: schema.uiConfig.prominenceLevels is required.');
  }
  const invalidLevels = levels.filter(level => !VALID_PROMINENCE_LEVELS.has(level as Prominence));
  if (invalidLevels.length > 0) {
    throw new Error(`Archivist: unsupported prominence levels: ${invalidLevels.join(', ')}.`);
  }
  return levels as Prominence[];
}

export function getProminenceColor(prominence: Prominence, schema?: Schema): string {
  const colors = schema?.uiConfig?.prominenceColors;
  if (!colors) {
    throw new Error('Archivist: schema.uiConfig.prominenceColors is required.');
  }
  const color = colors[prominence];
  if (!color) {
    throw new Error(`Archivist: prominence color missing for "${prominence}".`);
  }
  return color;
}

export function prominenceToNumber(
  prominence: Prominence | number,
  schema?: Schema,
  prominenceScale?: ProminenceScale
): number {
  if (typeof prominence === 'number' && Number.isFinite(prominence)) {
    const scale = resolveProminenceScale(prominenceScale);
    const label = prominenceLabelFromScale(prominence, scale);
    const index = scale.labels.indexOf(label);
    return index >= 0 ? index : 0;
  }

  const levels = getProminenceLevels(schema);
  const index = levels.indexOf(prominence as Prominence);
  if (index < 0) {
    throw new Error(`Archivist: prominence "${String(prominence)}" not found in schema.uiConfig.prominenceLevels.`);
  }
  return index;
}

export function getKindColor(kind: string, schema?: Schema): string {
  const entityKind = schema?.entityKinds?.find(ek => ek.kind === kind);
  if (!entityKind) {
    throw new Error(`Archivist: entity kind "${kind}" not found in schema.`);
  }
  if (!entityKind.style?.color) {
    throw new Error(`Archivist: entity kind "${kind}" is missing style.color.`);
  }
  return entityKind.style.color;
}

export function transformWorldData(
  worldState: WorldState,
  showCatalyzedBy: boolean = false,
  prominenceScale?: ProminenceScale
) {
  const resolvedScale = resolveProminenceScale(prominenceScale);
  const nodes = worldState.hardState.map(entity => ({
    data: {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      subtype: entity.subtype,
      prominence: prominenceToNumber(entity.prominence, worldState.schema, resolvedScale),
      prominenceLabel: typeof entity.prominence === 'number'
        ? prominenceLabelFromScale(entity.prominence, resolvedScale)
        : entity.prominence,
      status: entity.status,
      tags: entity.tags,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    },
    classes: `${entity.kind} ${entity.subtype} ${entity.prominence}`
  }));

  const edges = worldState.relationships.map((rel) => {
    // Check if this relationship was catalyzed by an event or entity
    // In a full implementation, this would check for catalyzedBy metadata
    const catalyzedBy = (rel as any).catalyzedBy;
    const hasCatalyst = !!catalyzedBy;

    return {
      data: {
        id: `edge-${rel.src}-${rel.dst}-${rel.kind}`,
        source: rel.src,
        target: rel.dst,
        kind: rel.kind,
        label: rel.kind.replace(/_/g, ' '),
        strength: rel.strength ?? 0.5,
        catalyzedBy: catalyzedBy,
        hasCatalyst: hasCatalyst
      },
      classes: [
        rel.kind.replace(/_/g, '-'),
        hasCatalyst && showCatalyzedBy ? 'catalyzed' : ''
      ].filter(Boolean).join(' ')
    };
  });

  return [...nodes, ...edges];
}

export function applyFilters(
  worldState: WorldState,
  filters: Filters,
  prominenceScale?: ProminenceScale
): WorldState {
  const prominenceOrder = getProminenceLevels(worldState.schema);
  const minProminenceIndex = prominenceOrder.indexOf(filters.minProminence);
  const resolvedScale = resolveProminenceScale(prominenceScale);

  let filtered = worldState.hardState.filter(entity => {
    // Filter by kind
    if (!filters.kinds.includes(entity.kind)) return false;

    // Filter by prominence
    const entityProminenceLabel = typeof entity.prominence === 'number'
      ? prominenceLabelFromScale(entity.prominence, resolvedScale)
      : entity.prominence;
    const entityProminenceIndex = prominenceOrder.indexOf(entityProminenceLabel);
    if (entityProminenceIndex < minProminenceIndex) return false;

    // Filter by time range
    if (entity.createdAt < filters.timeRange[0] || entity.createdAt > filters.timeRange[1]) {
      return false;
    }

    // Filter by tags
    if (filters.tags.length > 0) {
      const entityTags = getTagsArray(entity.tags);
      const hasMatchingTag = filters.tags.some(tag => entityTags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const entityTags = getTagsArray(entity.tags);
      const matches =
        entity.name.toLowerCase().includes(query) ||
        entity.description.toLowerCase().includes(query) ||
        entityTags.some(tag => tag.toLowerCase().includes(query));
      if (!matches) return false;
    }

    return true;
  });

  // Get IDs of filtered entities
  const filteredIds = new Set(filtered.map(e => e.id));

  // Get all unique relationship types for comparison
  const allRelTypes = new Set(worldState.relationships.map(r => r.kind));

  // Filter relationships to only include those between filtered entities
  // Also filter by relationship type and strength if specified
  const filteredRelationships = worldState.relationships.filter(rel => {
    // Must be between visible entities
    if (!filteredIds.has(rel.src) || !filteredIds.has(rel.dst)) return false;

    // Filter by minimum strength
    const strength = rel.strength ?? 0.5;
    if (strength < filters.minStrength) return false;

    // If relationship type filter has ALL types selected, show none (special "clear all" case)
    if (filters.relationshipTypes.length === allRelTypes.size &&
        filters.relationshipTypes.length > 0) {
      return false;
    }

    // If relationship type filter is active and not empty, check if this type is included
    if (filters.relationshipTypes.length > 0) {
      return filters.relationshipTypes.includes(rel.kind);
    }

    // Filter historical relationships unless explicitly shown
    if (!filters.showHistoricalRelationships && rel.status === 'historical') {
      return false;
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
    getTagsArray(entity.tags).forEach(tag => tagSet.add(tag));
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

  return {
    ...worldState,
    hardState: filteredEntities,
    relationships: filteredRelationships,
    metadata: {
      ...worldState.metadata,
      tick: maxTick,
      entityCount: filteredEntities.length,
      relationshipCount: filteredRelationships.length
    }
  };
}
