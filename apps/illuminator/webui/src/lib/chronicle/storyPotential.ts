/**
 * Story Potential utilities for Entry Point selection
 *
 * Computes multi-dimensional "story potential" metrics for entities,
 * helping users identify which entities make good narrative entry points.
 */

import type { EntityContext, RelationshipContext, NarrativeEventContext } from '../chronicleTypes';

/**
 * Story potential across 5 dimensions (each 0-1 normalized)
 */
export interface StoryPotential {
  /** Total relationship count (normalized) */
  connections: number;
  /** Number of eras with activity */
  temporalSpan: number;
  /** Variety of entity kinds connected to */
  roleDiversity: number;
  /** Number of events featuring this entity */
  eventInvolvement: number;
  /** Entity prominence level */
  prominence: number;
  /** Composite score (weighted average) */
  overallScore: number;
}

/**
 * Entity with computed story potential
 */
export interface EntityWithPotential extends EntityContext {
  potential: StoryPotential;
  connectionCount: number;
  eventCount: number;
  connectedKinds: string[];
  eraIds: string[];
}

/**
 * Connected entity info for constellation
 */
export interface ConnectedEntity {
  id: string;
  name: string;
  kind: string;
  relationshipKind: string;
  strength?: number;
}

// Weights for composite score
const WEIGHTS = {
  connections: 0.25,
  temporalSpan: 0.15,
  roleDiversity: 0.20,
  eventInvolvement: 0.25,
  prominence: 0.15,
};

/**
 * Convert numeric prominence (0-5) to normalized value (0-1) for scoring.
 * Prominence scale: 0=forgotten, 1=marginal, 2=recognized, 3=renowned, 4-5=mythic
 */
function normalizeProminence(prominence: number): number {
  return Math.min(prominence / 5, 1);
}

/**
 * Compute story potential for a single entity
 */
export function computeStoryPotential(
  entityId: string,
  entities: EntityContext[],
  relationships: RelationshipContext[],
  events: NarrativeEventContext[],
  maxValues: {
    maxConnections: number;
    maxEvents: number;
    maxKinds: number;
    maxEras: number;
  }
): StoryPotential {
  const entity = entities.find(e => e.id === entityId);
  if (!entity) {
    return {
      connections: 0,
      temporalSpan: 0,
      roleDiversity: 0,
      eventInvolvement: 0,
      prominence: 0,
      overallScore: 0,
    };
  }

  // Count connections
  const entityRels = relationships.filter(r => r.src === entityId || r.dst === entityId);
  const connectionCount = entityRels.length;

  // Get connected entity kinds
  const connectedIds = new Set<string>();
  for (const rel of entityRels) {
    connectedIds.add(rel.src === entityId ? rel.dst : rel.src);
  }
  const connectedKinds = new Set<string>();
  for (const id of connectedIds) {
    const connected = entities.find(e => e.id === id);
    if (connected) connectedKinds.add(connected.kind);
  }

  // Count events and get eras
  const entityEvents = events.filter(e =>
    e.subjectId === entityId ||
    e.objectId === entityId ||
    e.participants?.some(p => p.id === entityId)
  );
  const eventCount = entityEvents.length;
  const eraIds = new Set(entityEvents.map(e => e.era));

  // Normalize values
  const connections = maxValues.maxConnections > 0
    ? Math.min(connectionCount / maxValues.maxConnections, 1)
    : 0;

  const temporalSpan = maxValues.maxEras > 0
    ? Math.min(eraIds.size / maxValues.maxEras, 1)
    : 0;

  const roleDiversity = maxValues.maxKinds > 0
    ? Math.min(connectedKinds.size / maxValues.maxKinds, 1)
    : 0;

  const eventInvolvement = maxValues.maxEvents > 0
    ? Math.min(eventCount / maxValues.maxEvents, 1)
    : 0;

  const prominence = normalizeProminence(entity.prominence);

  // Compute weighted score
  const overallScore =
    WEIGHTS.connections * connections +
    WEIGHTS.temporalSpan * temporalSpan +
    WEIGHTS.roleDiversity * roleDiversity +
    WEIGHTS.eventInvolvement * eventInvolvement +
    WEIGHTS.prominence * prominence;

  return {
    connections,
    temporalSpan,
    roleDiversity,
    eventInvolvement,
    prominence,
    overallScore,
  };
}

/**
 * Compute story potential for all entities
 */
export function computeAllStoryPotentials(
  entities: EntityContext[],
  relationships: RelationshipContext[],
  events: NarrativeEventContext[]
): Map<string, EntityWithPotential> {
  // First pass: compute raw values for normalization
  const rawStats = new Map<string, {
    connectionCount: number;
    eventCount: number;
    connectedKinds: string[];
    eraIds: string[];
  }>();

  let maxConnections = 0;
  let maxEvents = 0;
  let maxKinds = 0;
  let maxEras = 0;

  for (const entity of entities) {
    // Skip era entities
    if (entity.kind === 'era') continue;

    // Count connections
    const entityRels = relationships.filter(r => r.src === entity.id || r.dst === entity.id);
    const connectionCount = entityRels.length;

    // Get connected entity kinds
    const connectedIds = new Set<string>();
    for (const rel of entityRels) {
      connectedIds.add(rel.src === entity.id ? rel.dst : rel.src);
    }
    const connectedKinds: string[] = [];
    for (const id of connectedIds) {
      const connected = entities.find(e => e.id === id);
      if (connected && !connectedKinds.includes(connected.kind)) {
        connectedKinds.push(connected.kind);
      }
    }

    // Count events and eras
    const entityEvents = events.filter(e =>
      e.subjectId === entity.id ||
      e.objectId === entity.id ||
      e.participants?.some(p => p.id === entity.id)
    );
    const eventCount = entityEvents.length;
    const eraIds = [...new Set(entityEvents.map(e => e.era))];

    rawStats.set(entity.id, {
      connectionCount,
      eventCount,
      connectedKinds,
      eraIds,
    });

    // Update max values
    maxConnections = Math.max(maxConnections, connectionCount);
    maxEvents = Math.max(maxEvents, eventCount);
    maxKinds = Math.max(maxKinds, connectedKinds.length);
    maxEras = Math.max(maxEras, eraIds.length);
  }

  // Second pass: compute normalized potentials
  const result = new Map<string, EntityWithPotential>();
  const maxValues = { maxConnections, maxEvents, maxKinds, maxEras };

  for (const entity of entities) {
    if (entity.kind === 'era') continue;

    const stats = rawStats.get(entity.id);
    if (!stats) continue;

    const potential = computeStoryPotential(
      entity.id,
      entities,
      relationships,
      events,
      maxValues
    );

    result.set(entity.id, {
      ...entity,
      potential,
      connectionCount: stats.connectionCount,
      eventCount: stats.eventCount,
      connectedKinds: stats.connectedKinds,
      eraIds: stats.eraIds,
    });
  }

  return result;
}

/**
 * Get 1-hop connected entities for mini constellation
 */
export function getConnectedEntities(
  entityId: string,
  entities: EntityContext[],
  relationships: RelationshipContext[]
): ConnectedEntity[] {
  const entityMap = new Map(entities.map(e => [e.id, e]));
  const connected: ConnectedEntity[] = [];

  for (const rel of relationships) {
    let connectedId: string | null = null;

    if (rel.src === entityId) {
      connectedId = rel.dst;
    } else if (rel.dst === entityId) {
      connectedId = rel.src;
    }

    if (connectedId) {
      const entity = entityMap.get(connectedId);
      if (entity && entity.kind !== 'era') {
        // Avoid duplicates but track all relationship kinds
        const existing = connected.find(c => c.id === connectedId);
        if (!existing) {
          connected.push({
            id: connectedId,
            name: entity.name,
            kind: entity.kind,
            relationshipKind: rel.kind,
            strength: rel.strength,
          });
        }
      }
    }
  }

  return connected;
}

/**
 * Get unique entity kinds from a list
 */
export function getUniqueKinds(entities: EntityContext[]): string[] {
  const kinds = new Set<string>();
  for (const entity of entities) {
    if (entity.kind !== 'era') {
      kinds.add(entity.kind);
    }
  }
  return [...kinds].sort();
}

/**
 * Convert story score to visual rating (1-5 dots)
 */
export function scoreToRating(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score * 5)));
}
