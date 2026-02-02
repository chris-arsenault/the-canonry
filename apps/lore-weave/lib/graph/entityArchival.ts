/**
 * Entity Archival Utilities
 *
 * Domain-agnostic utilities for archiving entities and relationships,
 * and transferring relationships between entities. Used by SimulationSystems
 * that need to consolidate or supersede entities.
 */

import { Graph } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { FRAMEWORK_STATUS, FRAMEWORK_RELATIONSHIP_KINDS } from '@canonry/world-schema';
import { archiveRelationship, addRelationship } from '../utils';

/**
 * Options for archiving an entity
 */
export interface ArchiveEntityOptions {
  /** Archive all relationships involving this entity (default: true) */
  archiveRelationships?: boolean;

  /** Relationship kinds to exclude from archival */
  excludeRelationshipKinds?: string[];

  /** Custom status to set (default: 'historical') */
  status?: string;
}

/**
 * Options for transferring relationships
 */
export interface TransferRelationshipsOptions {
  /** Relationship kinds to exclude from transfer */
  excludeKinds?: string[];

  /** Only transfer relationships where entity is source */
  sourceOnly?: boolean;

  /** Only transfer relationships where entity is destination */
  destinationOnly?: boolean;

  /** Archive original relationships after transfer (default: true) */
  archiveOriginals?: boolean;
}

/**
 * Mark an entity as historical and optionally archive its relationships.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity to archive
 * @param options - Archival options
 */
export function archiveEntity(
  graph: Graph,
  entityId: string,
  options: ArchiveEntityOptions = {}
): void {
  const entity = graph.getEntity(entityId);
  if (!entity) return;

  const {
    archiveRelationships: shouldArchiveRels = true,
    excludeRelationshipKinds = [],
    status = FRAMEWORK_STATUS.HISTORICAL
  } = options;

  // Mark entity as historical (use updateEntity to trigger mutation tracking)
  graph.updateEntity(entityId, { status });

  // Archive relationships if requested
  if (shouldArchiveRels) {
    const entityRelationships = graph.getRelationships().filter(r =>
      (r.src === entityId || r.dst === entityId) &&
      r.status !== FRAMEWORK_STATUS.HISTORICAL &&
      !excludeRelationshipKinds.includes(r.kind)
    );

    entityRelationships.forEach(rel => {
      archiveRelationship(graph, rel.src, rel.dst, rel.kind);
    });
  }
}

/**
 * Archive multiple entities at once.
 *
 * @param graph - The world graph
 * @param entityIds - IDs of entities to archive
 * @param options - Archival options
 */
export function archiveEntities(
  graph: Graph,
  entityIds: string[],
  options: ArchiveEntityOptions = {}
): void {
  entityIds.forEach(id => archiveEntity(graph, id, options));
}

/**
 * Transfer relationships from source entities to a target entity.
 * Creates new relationships with the target and optionally archives originals.
 *
 * @param graph - The world graph
 * @param sourceIds - IDs of entities to transfer relationships from
 * @param targetId - ID of entity to transfer relationships to
 * @param options - Transfer options
 * @returns Number of relationships transferred
 */
export function transferRelationships(
  graph: Graph,
  sourceIds: string[],
  targetId: string,
  options: TransferRelationshipsOptions = {}
): number {
  const {
    excludeKinds = [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF],
    sourceOnly = false,
    destinationOnly = false,
    archiveOriginals = true
  } = options;

  const sourceIdSet = new Set(sourceIds);
  const transferred = new Set<string>();

  // Find all relationships involving source entities
  const toTransfer = graph.getRelationships().filter(r =>
    (sourceIdSet.has(r.src) || sourceIdSet.has(r.dst)) &&
    r.status !== FRAMEWORK_STATUS.HISTORICAL &&
    !excludeKinds.includes(r.kind)
  );

  toTransfer.forEach(rel => {
    let newSrc = rel.src;
    let newDst = rel.dst;

    // Determine new endpoints
    if (sourceIdSet.has(rel.src) && !destinationOnly) {
      newSrc = targetId;
    }
    if (sourceIdSet.has(rel.dst) && !sourceOnly) {
      newDst = targetId;
    }

    // Skip if no change (shouldn't happen with proper source filtering)
    if (newSrc === rel.src && newDst === rel.dst) return;

    // Handle self-loops (both endpoints are being transferred to same target)
    // Don't create self-referential relationship, but DO archive the original
    if (newSrc === newDst) {
      if (archiveOriginals) {
        archiveRelationship(graph, rel.src, rel.dst, rel.kind);
      }
      return;
    }

    // Avoid duplicates
    const key = `${newSrc}:${newDst}:${rel.kind}`;
    if (transferred.has(key)) return;

    // Create new relationship
    addRelationship(graph, rel.kind, newSrc, newDst);
    transferred.add(key);

    // Archive original if requested
    if (archiveOriginals) {
      archiveRelationship(graph, rel.src, rel.dst, rel.kind);
    }
  });

  return transferred.size;
}

/**
 * Create part_of relationships from members to a container entity.
 *
 * @param graph - The world graph
 * @param memberIds - IDs of member entities
 * @param containerId - ID of container entity
 * @returns Number of relationships created
 */
export function createPartOfRelationships(
  graph: Graph,
  memberIds: string[],
  containerId: string
): number {
  let created = 0;

  memberIds.forEach(memberId => {
    // Check if relationship already exists
    const exists = graph.getRelationships().some(r =>
      r.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF &&
      r.src === memberId &&
      r.dst === containerId &&
      r.status !== FRAMEWORK_STATUS.HISTORICAL
    );

    if (!exists) {
      addRelationship(graph, FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, memberId, containerId);
      created++;
    }
  });

  return created;
}

/**
 * Get all active relationships for an entity.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity
 * @param direction - Filter by direction ('src', 'dst', or 'both')
 * @returns Active relationships
 */
export function getActiveRelationships(
  graph: Graph,
  entityId: string,
  direction: 'src' | 'dst' | 'both' = 'both'
): Relationship[] {
  return graph.getRelationships().filter(r => {
    if (r.status === FRAMEWORK_STATUS.HISTORICAL) return false;

    switch (direction) {
      case 'src':
        return r.src === entityId;
      case 'dst':
        return r.dst === entityId;
      case 'both':
        return r.src === entityId || r.dst === entityId;
    }
  });
}

/**
 * Get all historical relationships for an entity.
 *
 * @param graph - The world graph
 * @param entityId - ID of entity
 * @returns Historical relationships
 */
export function getHistoricalRelationships(
  graph: Graph,
  entityId: string
): Relationship[] {
  return graph.getRelationships().filter(r =>
    r.status === FRAMEWORK_STATUS.HISTORICAL &&
    (r.src === entityId || r.dst === entityId)
  );
}

/**
 * Check if an entity is historical.
 *
 * @param entity - Entity to check
 * @returns True if entity is historical
 */
export function isHistoricalEntity(entity: HardState): boolean {
  return entity.status === FRAMEWORK_STATUS.HISTORICAL;
}

/**
 * Get all entities that are part of a container entity.
 *
 * @param graph - The world graph
 * @param containerId - ID of container entity
 * @returns Member entities
 */
export function getPartOfMembers(
  graph: Graph,
  containerId: string
): HardState[] {
  const memberIds = graph.getRelationships()
    .filter(r =>
      r.kind === FRAMEWORK_RELATIONSHIP_KINDS.PART_OF &&
      r.dst === containerId &&
      r.status !== FRAMEWORK_STATUS.HISTORICAL
    )
    .map(r => r.src);

  return memberIds
    .map(id => graph.getEntity(id))
    .filter((e): e is HardState => e !== undefined);
}

/**
 * Options for superseding an entity
 */
export interface SupersedeEntityOptions extends TransferRelationshipsOptions {
  /** Archive the superseded entity (default: true) */
  archiveSuperseded?: boolean;

  /** Create supersedes relationship (default: true) */
  createSupersedes?: boolean;
}

/**
 * Supersede one entity with another.
 * Creates supersedes relationship, transfers relationships, and archives original.
 *
 * @param graph - The world graph
 * @param oldEntityId - ID of entity being superseded
 * @param newEntityId - ID of new entity
 * @param options - Supersede options
 */
export function supersedeEntity(
  graph: Graph,
  oldEntityId: string,
  newEntityId: string,
  options: SupersedeEntityOptions = {}
): void {
  const {
    archiveSuperseded = true,
    createSupersedes = true,
    ...transferOptions
  } = options;

  // Create supersedes relationship (new supersedes old)
  if (createSupersedes) {
    addRelationship(
      graph,
      FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
      newEntityId,
      oldEntityId
    );
  }

  // Transfer relationships from old to new
  transferRelationships(
    graph,
    [oldEntityId],
    newEntityId,
    {
      ...transferOptions,
      excludeKinds: [
        ...(transferOptions.excludeKinds || []),
        FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
        FRAMEWORK_RELATIONSHIP_KINDS.PART_OF
      ]
    }
  );

  // Archive old entity
  if (archiveSuperseded) {
    archiveEntity(graph, oldEntityId, {
      archiveRelationships: false, // Already handled by transfer
      excludeRelationshipKinds: [
        FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
        FRAMEWORK_RELATIONSHIP_KINDS.PART_OF
      ]
    });
  }
}
