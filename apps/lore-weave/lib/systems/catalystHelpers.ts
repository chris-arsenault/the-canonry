/**
 * Catalyst Helper Utilities
 *
 * Framework-level helpers for working with the catalyst system.
 * These are domain-agnostic and work with any entity type.
 */

import { HardState, Relationship } from '../core/worldTypes';
import { Graph } from '../engine/types';
import { FRAMEWORK_ENTITY_KINDS } from '@canonry/world-schema';
import { getProminenceMultiplierValue } from '../rules';

/**
 * Get all entities that can act (have catalyst.canAct = true)
 * @param graph - The world graph
 * @param category - Filter by agent category
 * @returns Array of agent entities
 */
export function getAgentsByCategory(
  graph: Graph,
  category: 'first-order' | 'second-order' | 'all' = 'all'
): HardState[] {
  const agents = graph.getEntities()
    .filter(e => e.catalyst?.canAct === true);

  if (category === 'all') {
    return agents;
  }

  // First-order agents: npc, faction, ability, location (rare)
  // Second-order agents: occurrence
  if (category === 'first-order') {
    return agents.filter(e => e.kind !== FRAMEWORK_ENTITY_KINDS.OCCURRENCE);
  } else {
    return agents.filter(e => e.kind === FRAMEWORK_ENTITY_KINDS.OCCURRENCE);
  }
}

/**
 * Check if an entity can perform actions
 * @param entity - The entity to check
 * @returns True if entity can act
 */
export function canPerformAction(entity: HardState): boolean {
  return entity.catalyst?.canAct === true;
}

/**
 * Record catalyst attribution on a relationship
 * @param relationship - The relationship to attribute
 * @param catalystId - ID of the agent that caused this
 * @returns The relationship with attribution added
 */
export function recordCatalyst(
  relationship: Relationship,
  catalystId: string
): Relationship {
  return {
    ...relationship,
    catalyzedBy: catalystId
  };
}

/**
 * Get all events (relationships/entities) catalyzed by an entity
 * @param graph - The world graph
 * @param entityId - ID of the catalyst entity
 * @returns Array of relationships and entities caused by this catalyst
 */
export function getCatalyzedEvents(
  graph: Graph,
  entityId: string
): (Relationship | HardState)[] {
  const results: (Relationship | HardState)[] = [];

  // Find relationships catalyzed by this entity
  graph.getRelationships().forEach(rel => {
    if (rel.catalyzedBy === entityId) {
      results.push(rel);
    }
  });

  // Find entities catalyzed by this entity (e.g., occurrences triggered by NPCs)
  graph.forEachEntity(entity => {
    const triggeredByRel = graph.getEntityRelationships(entity.id, 'src')
      .find(rel => rel.kind === 'triggered_by' && rel.dst === entityId);
    if (triggeredByRel) {
      results.push(entity);
    }
  });

  return results;
}

/**
 * Check if entity has a specific relationship
 * @param entity - The entity to check
 * @param relationshipKind - The relationship kind to look for
 * @param direction - Check as 'src' or 'dst' or 'both'
 * @returns True if relationship exists
 */
export function hasRelationship(
  graph: Graph,
  entityId: string,
  relationshipKind: string,
  direction: 'src' | 'dst' | 'both' = 'both'
): boolean {
  return graph.getEntityRelationships(entityId, direction).some(link => link.kind === relationshipKind);
}

/**
 * Calculate action attempt chance based on entity prominence
 * @param entity - The entity attempting action
 * @param baseRate - Base action attempt rate (from system parameters)
 * @returns Probability of action attempt this tick
 */
export function calculateAttemptChance(
  entity: HardState,
  baseRate: number
): number {
  if (!entity.catalyst?.canAct) {
    return 0;
  }

  const multiplier = getProminenceMultiplierValue(entity.prominence, 'action_rate');
  const chance = baseRate * multiplier;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, chance));
}

/**
 * Initialize or update catalyst properties for an entity
 * This is a helper for domain code to set up catalyst properties
 * @param entity - The entity to initialize
 * @param canAct - Can this entity perform actions?
 */
export function initializeCatalyst(
  entity: HardState,
  canAct: boolean
): void {
  entity.catalyst = {
    canAct
  };
}

/**
 * Initialize catalyst properties for entities of actor kinds.
 * All entities of eligible kinds can act - prominence affects action
 * success chance and attempt rate, not eligibility.
 *
 * @param entity - The entity to initialize
 */
export function initializeCatalystSmart(entity: HardState): void {
  // Entity kinds that can act
  const actorKinds = ['npc', 'faction', 'ability', 'occurrence', 'location', 'artifact', 'rule'];
  if (!actorKinds.includes(entity.kind)) {
    return;
  }

  entity.catalyst = {
    canAct: true
  };
}
