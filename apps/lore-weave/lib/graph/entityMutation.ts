/**
 * Entity Mutation Utilities
 *
 * Functions for creating and modifying entities.
 */

import { Graph } from '../engine/types';
import { HardState, EntityTags } from '../core/worldTypes';
import { arrayToTags } from '../utils/tagUtils';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_RELATIONSHIP_KINDS,
  FRAMEWORK_RELATIONSHIP_PROPERTIES,
  FRAMEWORK_STATUS
} from '@canonry/world-schema';

/**
 * Slugify a name for use in IDs or other contexts
 */
export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

/**
 * Generate a stable entity ID from a name, with optional collision handling.
 */
export function generateEntityIdFromName(
  name: string,
  hasEntity?: (id: string) => boolean,
  log?: (message: string, context?: Record<string, unknown>) => void
): string {
  const baseId = slugifyName(name);
  if (!hasEntity) return baseId;
  if (!hasEntity(baseId)) return baseId;

  let suffix = 2;
  let candidate = `${baseId}-${suffix}`;
  while (hasEntity(candidate)) {
    suffix += 1;
    candidate = `${baseId}-${suffix}`;
  }

  log?.(`Entity id collision for "${name}". Using "${candidate}".`, {
    name,
    baseId,
    resolvedId: candidate
  });

  return candidate;
}

/**
 * Initial state normalization
 */
export function normalizeInitialState(entities: any[]): HardState[] {
  return entities.map((entity, index) => {
    if (!entity.id) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no id. ` +
        `Seed entities must include a stable id used by relationships.`
      );
    }
    if (!entity.name) {
      throw new Error(
        `normalizeInitialState: entity at index ${index} has no name. ` +
        `Initial state entities must have names defined in JSON.`
      );
    }
    if (!entity.coordinates) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no coordinates. ` +
        `Initial state entities must have coordinates defined in JSON.`
      );
    }
    if (!entity.kind) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no kind.`
      );
    }
    if (!entity.subtype) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no subtype.`
      );
    }
    if (!entity.status) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no status.`
      );
    }
    if (!entity.prominence) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no prominence.`
      );
    }
    if (!entity.culture) {
      throw new Error(
        `normalizeInitialState: entity "${entity.name}" at index ${index} has no culture.`
      );
    }

    // Handle both old array format and new KVP format for tags
    let tags: EntityTags;
    if (Array.isArray(entity.tags)) {
      tags = arrayToTags(entity.tags);
    } else {
      tags = entity.tags || {};
    }

    const narrativeHint = entity.narrativeHint ?? entity.summary ?? (entity.description ? entity.description : undefined);

    return {
      id: entity.id,
      kind: entity.kind as HardState['kind'],
      subtype: entity.subtype,
      name: entity.name,
      summary: entity.summary,
      narrativeHint,
      description: entity.description || '',
      status: entity.status,
      prominence: entity.prominence as HardState['prominence'],
      culture: entity.culture,
      tags,
      createdAt: 0,
      updatedAt: 0,
      coordinates: entity.coordinates
    };
  });
}

/**
 * Add entity to graph (coordinates required)
 * Note: Name generation is handled by runtime; GraphStore requires name to be set.
 * @param source - Optional source identifier for debugging (e.g., template ID)
 * @param placementStrategy - Optional placement strategy for debugging
 */
export async function addEntity(graph: Graph, entity: Partial<HardState>, source?: string, placementStrategy?: string): Promise<string> {
  // Coordinates are required - fail loudly
  // Check for valid numeric values, not just object existence
  const coords = entity.coordinates;
  if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number') {
    throw new Error(
      `addEntity: valid coordinates {x: number, y: number, z: number} are required. ` +
      `Entity kind: ${entity.kind || 'unknown'}, name: ${entity.name || 'unnamed'}. ` +
      `Received: ${JSON.stringify(coords)}. ` +
      `Provide valid coordinates explicitly.`
    );
  }
  if (!entity.kind) {
    throw new Error('addEntity: kind is required.');
  }
  if (!entity.subtype) {
    throw new Error(`addEntity: subtype is required for kind "${entity.kind}".`);
  }
  if (!entity.status) {
    throw new Error(`addEntity: status is required for kind "${entity.kind}".`);
  }
  if (!entity.prominence) {
    throw new Error(`addEntity: prominence is required for kind "${entity.kind}".`);
  }
  if (!entity.culture) {
    throw new Error(`addEntity: culture is required for kind "${entity.kind}".`);
  }

  // Normalize tags: handle both old array format and new KVP format
  // Clone to avoid mutating source object
  let tags: EntityTags;
  if (Array.isArray(entity.tags)) {
    tags = arrayToTags(entity.tags);
  } else {
    tags = { ...(entity.tags || {}) };
  }

  if (!entity.name) {
    throw new Error(
      `addEntity: name is required for GraphStore. ` +
      `Use WorldRuntime.createEntity() to generate names.`
    );
  }

  const entityId = generateEntityIdFromName(entity.name, id => graph.hasEntity(id));

  // Delegate to Graph.createEntity()
  // Use validated coords to satisfy TypeScript (already validated above)
  if (typeof coords.z !== 'number') {
    throw new Error(
      `addEntity: coordinates must include numeric z. ` +
      `Entity kind: ${entity.kind}, name: ${entity.name || 'unnamed'}. ` +
      `Received: ${JSON.stringify(coords)}.`
    );
  }
  const validCoords = { x: coords.x, y: coords.y, z: coords.z };

  const currentEraEntity = entity.kind !== FRAMEWORK_ENTITY_KINDS.ERA
    ? graph.findEntities({
        kind: FRAMEWORK_ENTITY_KINDS.ERA,
        status: FRAMEWORK_STATUS.CURRENT
      })[0]
    : undefined;
  const explicitEraId = entity.eraId;
  const resolvedEraId = typeof explicitEraId === 'string' && explicitEraId
    ? explicitEraId
    : (entity.kind === FRAMEWORK_ENTITY_KINDS.ERA ? entity.subtype : currentEraEntity?.id);

  const narrativeHint = entity.narrativeHint ?? entity.summary ?? (entity.description ? entity.description : undefined);

  const createdId = await graph.createEntity({
    id: entityId,
    kind: entity.kind,
    subtype: entity.subtype,
    coordinates: validCoords,
    tags,
    eraId: resolvedEraId,
    name: entity.name,
    description: entity.description,
    narrativeHint,
    status: entity.status,
    prominence: entity.prominence,
    culture: entity.culture,
    temporal: entity.temporal,
    source,
    placementStrategy
  });

  // Create CREATED_DURING relationship to current era (unless entity is an era itself)
  // This is a framework-level temporal relationship distinct from spatial "originated_in"
  if (entity.kind !== FRAMEWORK_ENTITY_KINDS.ERA && currentEraEntity) {
    graph.addRelationship(
      FRAMEWORK_RELATIONSHIP_KINDS.CREATED_DURING,
      entityId,
      currentEraEntity.id,
      FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.CREATED_DURING].defaultStrength
    );
  }

  return createdId;
}

/**
 * Update entity in graph
 */
export function updateEntity(
  graph: Graph,
  entityId: string,
  changes: Partial<HardState>
): void {
  // Use Graph's updateEntity method to modify the actual entity, not a clone
  graph.updateEntity(entityId, changes);
}
