/**
 * Tag Diffusion System Factory
 *
 * Creates configurable systems that propagate or diverge tags based on entity connectivity.
 * This pattern models cultural drift, influence spread, and isolation effects.
 *
 * Two modes:
 * - Convergence: Connected entities gain shared tags (cultural unification)
 * - Divergence: Isolated entities gain unique tags (cultural drift)
 *
 * The factory creates a SimulationSystem from a TagDiffusionConfig.
 */

import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { rollProbability, pickRandom, hasTag } from '../utils';
import { createSystemContext, selectEntities } from '../rules';
import type { SelectionRule } from '../rules';
import { interpolate, createSystemRuleContext } from '../narrative/narrationTemplate';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Convergence configuration: tags added when entities are connected
 */
export interface ConvergenceConfig {
  /** Tags that can be added to connected entities */
  tags: string[];
  /** Minimum connections required to trigger convergence */
  minConnections: number;
  /** Probability of adding a convergence tag per tick (0-1) */
  probability: number;
  /** Maximum shared tags before stopping convergence */
  maxSharedTags?: number;
  /**
   * Narration template for convergence events.
   * - {$self.name} - The entity gaining the tag
   * - {$tag} - The tag being added
   * Example: "{$self.name} adopted new cultural practices."
   */
  narrationTemplate?: string;
}

/**
 * Divergence configuration: tags added when entities are isolated
 */
export interface DivergenceConfig {
  /** Tags that can be added to isolated entities */
  tags: string[];
  /** Maximum connections to count as "isolated" (default: 0) */
  maxConnections: number;
  /** Probability of adding a divergence tag per tick (0-1) */
  probability: number;
  /**
   * Narration template for divergence events.
   * - {$self.name} - The entity gaining the tag
   * - {$tag} - The tag being added
   * Example: "{$self.name} developed unique traditions in isolation."
   */
  narrationTemplate?: string;
}

/**
 * Full tag diffusion configuration
 */
export interface TagDiffusionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Selection rule for entities to evaluate */
  selection: SelectionRule;

  /** Relationship kind that indicates "connection" between entities */
  connectionKind: string;
  /** Direction to check for connections (default: 'both') */
  connectionDirection?: 'src' | 'dst' | 'both';

  /** Convergence: tags added when entities are connected */
  convergence?: ConvergenceConfig;

  /** Divergence: tags added when entities are isolated */
  divergence?: DivergenceConfig;

  /** Maximum tags per entity (to prevent tag bloat) */
  maxTags?: number;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /** Pressure changes when diffusion occurs */
  pressureChanges?: Record<string, number>;

  /** Pressure triggered specifically by divergent entities */
  divergencePressure?: {
    /** Pressure name to modify */
    pressureName: string;
    /** Minimum divergent entities to trigger pressure */
    minDivergent: number;
    /** Pressure delta when triggered */
    delta: number;
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Count connections for an entity
 */
function countConnections(
  entity: HardState,
  connectionKind: string,
  direction: 'src' | 'dst' | 'both',
  graphView: WorldRuntime
): number {
  const connections = new Set<string>();

  if (direction === 'src' || direction === 'both') {
    const related = graphView.getRelated(entity.id, connectionKind, 'src');
    related.forEach(e => connections.add(e.id));
  }

  if (direction === 'dst' || direction === 'both') {
    const related = graphView.getRelated(entity.id, connectionKind, 'dst');
    related.forEach(e => connections.add(e.id));
  }

  return connections.size;
}

/**
 * Get connected entities
 */
function getConnectedEntities(
  entity: HardState,
  connectionKind: string,
  direction: 'src' | 'dst' | 'both',
  graphView: WorldRuntime
): HardState[] {
  const connectionIds = new Set<string>();

  if (direction === 'src' || direction === 'both') {
    const related = graphView.getRelated(entity.id, connectionKind, 'src');
    related.forEach(e => connectionIds.add(e.id));
  }

  if (direction === 'dst' || direction === 'both') {
    const related = graphView.getRelated(entity.id, connectionKind, 'dst');
    related.forEach(e => connectionIds.add(e.id));
  }

  const entities: HardState[] = [];
  connectionIds.forEach(id => {
    const e = graphView.getEntity(id);
    if (e) entities.push(e);
  });

  return entities;
}

/**
 * Count shared tags between two entities from a given set
 */
function countSharedTags(entity1: HardState, entity2: HardState, tagSet: string[]): number {
  let count = 0;
  for (const tag of tagSet) {
    if (hasTag(entity1.tags, tag) && hasTag(entity2.tags, tag)) {
      count++;
    }
  }
  return count;
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a TagDiffusionConfig
 */
export function createTagDiffusionSystem(
  config: TagDiffusionConfig
): SimulationSystem {
  const direction = config.connectionDirection ?? 'both';
  const maxTags = config.maxTags ?? 10;

  return {
    id: config.id,
    name: config.name,

    apply: (graphView: WorldRuntime, modifier: number = 1.0): SystemResult => {
      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (!rollProbability(config.throttleChance, modifier)) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: dormant`
          };
        }
      }

      const modifications: Array<{ id: string; changes: Partial<HardState>; narrativeGroupId?: string }> = [];
      const modifiedTags = new Map<string, Record<string, boolean | string>>();
      const narrationsByGroup: Record<string, string> = {};
      const entityNarrations = new Map<string, { tag: string; type: 'convergence' | 'divergence' }>();

      // Find entities to evaluate
      const selectionCtx = createSystemContext(graphView);
      let entities = selectEntities(config.selection, selectionCtx);

      if (entities.length < 2) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: not enough entities`
        };
      }

      // Track divergent entities for pressure calculation
      let divergentCount = 0;

      // === CONVERGENCE: Connected entities gain shared tags ===
      if (config.convergence) {
        const conv = config.convergence;
        const maxShared = conv.maxSharedTags ?? 2;

        // Compare pairs of entities
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          const connected = getConnectedEntities(entity, config.connectionKind, direction, graphView);

          // Filter to only entities in our evaluation set
          const connectedInSet = connected.filter(c =>
            entities.some(e => e.id === c.id)
          );

          if (connectedInSet.length >= conv.minConnections) {
            // Check shared tags with connected entities
            for (const other of connectedInSet) {
              const sharedCount = countSharedTags(entity, other, conv.tags);

              if (sharedCount < maxShared) {
                // Roll for convergence
                if (rollProbability(conv.probability, modifier)) {
                  // Pick a tag that neither has
                  const candidateTags = conv.tags.filter(t =>
                    !hasTag(entity.tags, t) && !hasTag(other.tags, t)
                  );

                  if (candidateTags.length > 0) {
                    const newTag = pickRandom(candidateTags);
                    const currentTags = modifiedTags.get(entity.id) || { ...entity.tags };

                    if (Object.keys(currentTags).length < maxTags) {
                      currentTags[newTag] = true;
                      modifiedTags.set(entity.id, currentTags);
                      // Track for narration
                      if (!entityNarrations.has(entity.id)) {
                        entityNarrations.set(entity.id, { tag: newTag, type: 'convergence' });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // === DIVERGENCE: Isolated entities gain unique tags ===
      if (config.divergence) {
        const div = config.divergence;

        for (const entity of entities) {
          const connectionCount = countConnections(entity, config.connectionKind, direction, graphView);

          if (connectionCount <= div.maxConnections) {
            // This entity is isolated
            if (rollProbability(div.probability, modifier)) {
              // Pick a divergence tag the entity doesn't have
              const candidateTags = div.tags.filter(t => !hasTag(entity.tags, t));

              if (candidateTags.length > 0) {
                const newTag = pickRandom(candidateTags);
                const currentTags = modifiedTags.get(entity.id) || { ...entity.tags };

                if (Object.keys(currentTags).length < maxTags) {
                  currentTags[newTag] = true;
                  modifiedTags.set(entity.id, currentTags);
                  // Track for narration
                  if (!entityNarrations.has(entity.id)) {
                    entityNarrations.set(entity.id, { tag: newTag, type: 'divergence' });
                  }
                }
              }
            }

            // Track for pressure calculation
            if (div.tags.some(t => hasTag(entity.tags, t))) {
              divergentCount++;
            }
          }
        }
      }

      // Convert tag modifications to entity modifications and generate narrations
      for (const [entityId, tags] of modifiedTags) {
        const entity = graphView.getEntity(entityId);
        const narrationInfo = entityNarrations.get(entityId);

        // Generate narration if template is available
        if (entity && narrationInfo) {
          const template = narrationInfo.type === 'convergence'
            ? config.convergence?.narrationTemplate
            : config.divergence?.narrationTemplate;

          if (template) {
            const narrationCtx = createSystemRuleContext({ self: entity });
            const narrationResult = interpolate(template, narrationCtx);
            if (narrationResult.complete) {
              narrationsByGroup[entityId] = narrationResult.text;
            }
          }
        }

        modifications.push({
          id: entityId,
          changes: { tags: tags as Record<string, boolean> },
          narrativeGroupId: narrationInfo ? entityId : undefined
        });
      }

      // Calculate pressure changes
      let pressureChanges: Record<string, number> = {};

      if (modifications.length > 0 && config.pressureChanges) {
        pressureChanges = { ...config.pressureChanges };
      }

      // Apply divergence-specific pressure
      if (config.divergencePressure && divergentCount >= config.divergencePressure.minDivergent) {
        pressureChanges[config.divergencePressure.pressureName] =
          (pressureChanges[config.divergencePressure.pressureName] ?? 0) +
          config.divergencePressure.delta * modifier;
      }

      return {
        relationshipsAdded: [],
        entitiesModified: modifications,
        pressureChanges,
        description: `${config.name}: ${modifications.length} entities affected`,
        narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined
      };
    }
  };
}
