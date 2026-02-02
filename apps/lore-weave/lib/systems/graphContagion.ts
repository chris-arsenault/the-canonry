import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { rollProbability, hasTag } from '../utils';
import { FRAMEWORK_TAG_VALUES } from '@canonry/world-schema';
import {
  createSystemContext,
  selectEntities,
  prepareMutation,
  applyTagPatch,
  buildTagPatch,
} from '../rules';
import { interpolate, createSystemRuleContext } from '../narrative/narrationTemplate';
import type {
  SelectionRule,
  MutationResult,
  SetTagMutation,
  CreateRelationshipMutation,
  EntityModification,
} from '../rules';

/**
 * Graph Contagion System Factory
 *
 * Creates configurable systems that spread state through relationship networks
 * using an SIR (Susceptible-Infected-Recovered) epidemic model.
 *
 * This pattern can implement:
 * - Belief contagion (ideological spread through social networks)
 * - Conflict contagion (wars spreading through alliance networks)
 * - Disease spread, cultural drift, influence propagation
 *
 * The factory creates a SimulationSystem from a GraphContagionConfig.
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export type MarkerType = 'relationship' | 'tag';

export interface ContagionMarker {
  type: MarkerType;
  /** For relationship type: the relationship kind (e.g., 'believer_of', 'enemy_of') */
  relationshipKind?: string;
  /** For tag type: the tag key pattern (e.g., 'infected', 'believes_in') */
  tagPattern?: string;
  /** For relationship type: the target entity to check relationship against (optional) */
  /** If not specified, any relationship of this kind counts as infected */
  targetEntityId?: string;
}

export interface TransmissionVector {
  /** Relationship kind that enables transmission */
  relationshipKind: string;
  /** Direction to check for contacts */
  direction: 'src' | 'dst' | 'both';
  /** Minimum relationship strength to count as contact */
  minStrength?: number;
}

export interface TransmissionConfig {
  /** Base transmission probability per tick (0-1) */
  baseRate: number;
  /** Multiplier applied per infected contact (stacks additively) */
  contactMultiplier: number;
  /** Maximum transmission probability (capped before rolling) */
  maxProbability?: number;
}

export interface RecoveryConfig {
  /** Base recovery probability per tick (0-1) */
  baseRate: number;
  /** Tag to add when entity recovers (grants immunity) */
  immunityTag?: string;
  /** Trait tags that increase recovery probability */
  recoveryBonusTraits?: Array<{ tag: string; bonus: number }>;
}

export type ContagionAction = SetTagMutation | CreateRelationshipMutation;

export interface PhaseTransition {
  /** Selection rule for entities that can transition */
  selection: SelectionRule;
  /** New status after transition */
  toStatus: string;
  /** Adoption threshold (0-1, proportion of entities that must be infected) */
  adoptionThreshold: number;
  /** Optional: also update description */
  descriptionSuffix?: string;
}

/**
 * Multi-source contagion configuration.
 * When enabled, the system tracks multiple independent contagion sources
 * (e.g., multiple ideologies that can spread independently).
 */
export interface MultiSourceConfig {
  /** Selection rule for contagion sources (e.g., proposed rules) */
  sourceSelection: SelectionRule;
  /** Immunity tag prefix - will be suffixed with source ID (e.g., 'immune' → 'immune:{sourceId}') */
  immunityTagPrefix?: string;
  /** Narration template for immunity gains. Variables: {$self.name}, {$source.name} */
  immunityNarrationTemplate?: string;
  /** Low adoption threshold - sources below this are marked forgotten */
  lowAdoptionThreshold?: number;
  /** Low adoption status - what to set when below threshold */
  lowAdoptionStatus?: string;
}

export interface GraphContagionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Selection rule for the population */
  selection: SelectionRule;

  /** What marks an entity as "infected" (the contagion marker) */
  contagion: ContagionMarker;

  /** Relationship types that enable transmission */
  vectors: TransmissionVector[];

  /** Transmission parameters */
  transmission: TransmissionConfig;

  /** What action to take when infection occurs */
  infectionAction: ContagionAction;

  /** Optional recovery mechanics */
  recovery?: RecoveryConfig;

  /** Optional phase transitions when adoption thresholds are met */
  phaseTransitions?: PhaseTransition[];

  /** Traits that modify susceptibility */
  susceptibilityModifiers?: Array<{
    tag: string;
    modifier: number; // negative = more susceptible, positive = more resistant
  }>;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /** Cooldown: ticks before same entity can be infected again */
  cooldown?: number;

  /** Pressure changes when contagion spreads */
  pressureChanges?: Record<string, number>;

  /**
   * Template for in-world narration when infection occurs.
   * Supports {$self.name}, {$source.name}, {$contagion_source.name}, etc.
   */
  narrationTemplate?: string;

  /**
   * Exclude infections where the entity and source have these relationship kinds.
   * Prevents spreading conflict between allies, etc.
   */
  excludeRelationships?: string[];

  /**
   * Multi-source mode: when configured, the system tracks multiple independent
   * contagion sources. Each source entity spreads independently through the
   * same population using the configured vectors and transmission settings.
   *
   * Example: Multiple ideologies (rules with status='proposed') spreading
   * through NPCs via social networks. Each NPC can believe in some ideologies
   * but not others.
   */
  multiSource?: MultiSourceConfig;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isInfected(
  entity: HardState,
  config: ContagionMarker,
  graphView: WorldRuntime
): boolean {
  if (config.type === 'tag') {
    return hasTag(entity.tags, config.tagPattern || '');
  }

  if (config.type === 'relationship' && config.relationshipKind) {
    const relationships = graphView.getAllRelationships();
    return relationships.some(r => {
      if (r.kind !== config.relationshipKind) return false;
      if (r.src !== entity.id) return false;
      if (config.targetEntityId && r.dst !== config.targetEntityId) return false;
      return true;
    });
  }

  return false;
}

function isInfectedWith(
  entity: HardState,
  config: ContagionMarker,
  targetId: string,
  graphView: WorldRuntime
): boolean {
  if (config.type === 'tag') {
    // For tag-based contagion with specific target
    return hasTag(entity.tags, `${config.tagPattern}:${targetId}`);
  }

  if (config.type === 'relationship' && config.relationshipKind) {
    return graphView.hasRelationship(entity.id, targetId, config.relationshipKind);
  }

  return false;
}

function isImmune(entity: HardState, immunityTag: string, targetId?: string): boolean {
  if (targetId) {
    return hasTag(entity.tags, `${immunityTag}:${targetId}`);
  }
  return hasTag(entity.tags, immunityTag);
}

function getContacts(
  entity: HardState,
  vectors: TransmissionVector[],
  graphView: WorldRuntime
): HardState[] {
  const contactIds = new Set<string>();

  for (const vector of vectors) {
    const minStrength = vector.minStrength ?? 0;

    if (vector.direction === 'src' || vector.direction === 'both') {
      const related = graphView.getRelated(entity.id, vector.relationshipKind, 'src', { minStrength });
      related.forEach(e => contactIds.add(e.id));
    }

    if (vector.direction === 'dst' || vector.direction === 'both') {
      const related = graphView.getRelated(entity.id, vector.relationshipKind, 'dst', { minStrength });
      related.forEach(e => contactIds.add(e.id));
    }
  }

  // Convert IDs to entities
  const contacts: HardState[] = [];
  contactIds.forEach(id => {
    const entity = graphView.getEntity(id);
    if (entity) contacts.push(entity);
  });

  return contacts;
}

function calculateSusceptibility(
  entity: HardState,
  modifiers: Array<{ tag: string; modifier: number }> | undefined
): number {
  if (!modifiers) return 0;

  let totalModifier = 0;
  for (const mod of modifiers) {
    if (hasTag(entity.tags, mod.tag)) {
      totalModifier += mod.modifier;
    }
  }
  return totalModifier;
}

function mergeMutationResult(
  result: MutationResult,
  modifications: EntityModification[],
  relationships: Relationship[],
  relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number }>,
  pressureChanges: Record<string, number>,
  catalyzedBy?: string
): void {
  if (!result.applied) return;

  if (result.entityModifications.length > 0) {
    modifications.push(...result.entityModifications);
  }

  if (result.relationshipsCreated.length > 0) {
    for (const rel of result.relationshipsCreated) {
      relationships.push({
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
        strength: rel.strength,
        category: rel.category,
        catalyzedBy,
      });
    }
  }

  if (result.relationshipsAdjusted.length > 0) {
    relationshipsAdjusted.push(...result.relationshipsAdjusted);
  }

  for (const [pressureId, delta] of Object.entries(result.pressureChanges)) {
    pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
  }
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a GraphContagionConfig
 */
export function createGraphContagionSystem(
  config: GraphContagionConfig
): SimulationSystem {
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

      // Use multi-source mode if configured, otherwise single-source mode
      if (config.multiSource) {
        return applyMultiSourceContagion(config, graphView, modifier);
      } else {
        return applySingleSourceContagion(config, graphView, modifier);
      }
    }
  };
}

/**
 * Single-source contagion: original behavior where one marker indicates infection
 */
function applySingleSourceContagion(
  config: GraphContagionConfig,
  graphView: WorldRuntime,
  modifier: number
): SystemResult {
  const modifications: EntityModification[] = [];
  const relationships: Relationship[] = [];
  const relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number }> = [];
  const newInfections: string[] = []; // Track newly infected entities for visualization
  const pressureChanges: Record<string, number> = {};
  const narrationsByGroup: Record<string, string> = {};
  const baseCtx = createSystemContext(graphView);
  const contagionSource =
    config.contagion.type === 'relationship' && config.contagion.targetEntityId
      ? graphView.getEntity(config.contagion.targetEntityId)
      : undefined;

  // Find entities to evaluate
  const entities = selectEntities(config.selection, baseCtx);

  // Categorize entities: infected, susceptible, immune
  const infected: HardState[] = [];
  const susceptible: HardState[] = [];
  const immune: HardState[] = [];

  for (const entity of entities) {
    if (isInfected(entity, config.contagion, graphView)) {
      infected.push(entity);
    } else if (config.recovery?.immunityTag && isImmune(entity, config.recovery.immunityTag)) {
      immune.push(entity);
    } else {
      susceptible.push(entity);
    }
  }

  // If no infected entities, nothing to spread
  if (infected.length === 0) {
    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: `${config.name}: no carriers`
    };
  }

  // === TRANSMISSION PHASE ===
  for (const entity of susceptible) {
    const contacts = getContacts(entity, config.vectors, graphView);
    const infectedContacts = contacts.filter(c => isInfected(c, config.contagion, graphView));

    if (infectedContacts.length === 0) continue;

    // Calculate susceptibility modifier
    const susceptibilityMod = calculateSusceptibility(entity, config.susceptibilityModifiers);

    // Calculate infection probability
    const baseProb = config.transmission.baseRate +
      (infectedContacts.length * config.transmission.contactMultiplier);
    const modifiedProb = baseProb * (1 - susceptibilityMod);
    const maxProb = config.transmission.maxProbability ?? 0.95;
    const infectionProb = Math.min(maxProb, Math.max(0, modifiedProb));

    if (rollProbability(infectionProb, modifier)) {
      if (config.infectionAction.type === 'create_relationship' && config.cooldown) {
        if (!graphView.canFormRelationship(entity.id, config.infectionAction.kind, config.cooldown)) {
          continue;
        }
      }

      const source = infectedContacts[Math.floor(Math.random() * infectedContacts.length)];

      // Check excluded relationships (e.g., don't spread war between allies)
      if (config.excludeRelationships?.length) {
        let excluded = false;
        for (const excludeKind of config.excludeRelationships) {
          if (graphView.hasRelationship(entity.id, source.id, excludeKind) ||
              graphView.hasRelationship(source.id, entity.id, excludeKind)) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
      }

      const infectionCtx = {
        ...baseCtx,
        self: entity,
        entities: {
          ...(baseCtx.entities ?? {}),
          source,
          contagion_source: contagionSource,
        },
      };

      const action = config.infectionAction;
      const result = prepareMutation(action, infectionCtx);
      mergeMutationResult(
        result,
        modifications,
        relationships,
        relationshipsAdjusted,
        pressureChanges,
        action.type === 'create_relationship' ? source.id : undefined
      );

      if (action.type === 'create_relationship' && result.applied && result.relationshipsCreated.length > 0) {
        graphView.recordRelationshipFormation(entity.id, action.kind);
      }

      if (result.applied) {
        newInfections.push(entity.id);
        // Generate narration if template provided, keyed by entity.id
        if (config.narrationTemplate) {
          const narrationCtx = createSystemRuleContext({
            self: entity,
            variables: { source, contagion_source: contagionSource },
          });
          const narrationResult = interpolate(config.narrationTemplate, narrationCtx);
          if (narrationResult.complete) {
            narrationsByGroup[entity.id] = narrationResult.text;
          }
        }
      }
    }
  }

  // === RECOVERY PHASE ===
  if (config.recovery) {
    for (const entity of infected) {
      // Calculate recovery probability with trait bonuses
      let recoveryProb = config.recovery.baseRate;
      if (config.recovery.recoveryBonusTraits) {
        for (const trait of config.recovery.recoveryBonusTraits) {
          if (hasTag(entity.tags, trait.tag)) {
            recoveryProb += trait.bonus;
          }
        }
      }
      recoveryProb = Math.min(0.95, Math.max(0, recoveryProb));

      if (rollProbability(recoveryProb, modifier)) {
        // Add immunity tag if configured
        if (config.recovery.immunityTag) {
          const newTags = { ...entity.tags };
          newTags[config.recovery.immunityTag] = true;

          // Remove infection tag if using tag-based contagion
          if (config.contagion.type === 'tag' && config.contagion.tagPattern) {
            delete newTags[config.contagion.tagPattern];
          }

          modifications.push({
            id: entity.id,
            changes: { tags: buildTagPatch(entity.tags, newTags) }
          });
        }
      }
    }
  }

  // === PHASE TRANSITIONS ===
  if (config.phaseTransitions) {
    const adoptionRate = infected.length / entities.length;

    for (const transition of config.phaseTransitions) {
      if (adoptionRate >= transition.adoptionThreshold) {
        const candidates = selectEntities(transition.selection, baseCtx);

        for (const candidate of candidates) {
          const changes: Partial<HardState> = { status: transition.toStatus };
          if (transition.descriptionSuffix) {
            const baseNarrative = candidate.narrativeHint ?? candidate.summary ?? candidate.description ?? '';
            changes.narrativeHint = `${baseNarrative} ${transition.descriptionSuffix}`;
          }
          modifications.push({
            id: candidate.id,
            changes
          });
        }
      }
    }
  }

  const hadChanges =
    relationships.length > 0 || modifications.length > 0 || Object.keys(pressureChanges).length > 0;

  if (hadChanges && config.pressureChanges) {
    for (const [pressureId, delta] of Object.entries(config.pressureChanges)) {
      pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
    }
  }

  // Collect vector edges for visualization (relationships that enable transmission)
  const entityIds = new Set(entities.map(e => e.id));
  const allRelationships = graphView.getAllRelationships();
  const vectorEdges: Array<{ source: string; target: string; kind: string; strength: number }> = [];

  for (const vector of config.vectors) {
    for (const rel of allRelationships) {
      if (rel.kind !== vector.relationshipKind) continue;
      const minStrength = vector.minStrength ?? 0;
      const strength = rel.strength ?? 0;
      if (strength < minStrength) continue;

      // Only include edges between entities in our population
      if (entityIds.has(rel.src) && entityIds.has(rel.dst)) {
        vectorEdges.push({
          source: rel.src,
          target: rel.dst,
          kind: rel.kind,
          strength,
        });
      }
    }
  }

  // Build visualization snapshot for trace viewer
  const visualizationSnapshot = {
    // Nodes with SIR state and coordinates
    nodes: entities.map(e => ({
      id: e.id,
      name: e.name,
      x: e.coordinates?.x ?? Math.random() * 100,
      y: e.coordinates?.y ?? Math.random() * 100,
      state: infected.some(i => i.id === e.id) ? 'infected' :
             immune.some(i => i.id === e.id) ? 'recovered' : 'susceptible',
      prominence: e.prominence,
    })),
    // Edges (transmission vectors)
    edges: vectorEdges,
    // New infections this tick
    newInfections,
    // Summary counts
    counts: {
      susceptible: susceptible.length,
      infected: infected.length,
      recovered: immune.length,
      total: entities.length,
    },
    // Adoption rate
    adoptionRate: entities.length > 0 ? infected.length / entities.length : 0,
  };

  return {
    relationshipsAdded: relationships,
    relationshipsAdjusted,
    entitiesModified: modifications as SystemResult['entitiesModified'],
    pressureChanges,
    description: `${config.name}: ${relationships.length} new infections, ${modifications.length} modifications`,
    details: {
      contagionSnapshot: visualizationSnapshot,
    },
    narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined,
  };
}

/**
 * Multi-source contagion: each source entity spreads independently
 * Example: Multiple ideologies spreading through a population
 */
function applyMultiSourceContagion(
  config: GraphContagionConfig,
  graphView: WorldRuntime,
  modifier: number
): SystemResult {
  const multiSource = config.multiSource!;
  const modifications: EntityModification[] = [];
  const relationships: Relationship[] = [];
  const relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number }> = [];
  const modifiedTags = new Map<string, Record<string, boolean | string>>();
  const pressureChanges: Record<string, number> = {};
  const narrationsByGroup: Record<string, string> = {};
  const baseCtx = createSystemContext(graphView);

  // Tracking for visualization
  const newInfections: string[] = [];
  const infectedBySource = new Map<string, Set<string>>(); // sourceId -> Set of infected entityIds

  // Find all contagion sources (e.g., proposed rules)
  const sources = selectEntities(multiSource.sourceSelection, baseCtx);

  // Natural throttling: if no sources, nothing to spread
  if (sources.length === 0) {
    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: `${config.name}: no active sources`
    };
  }

  // Find entities to evaluate (the population)
  const entities = selectEntities(config.selection, baseCtx);

  // Process each source independently
  for (const source of sources) {
    // Categorize entities for this specific source
    const infected: HardState[] = [];
    const susceptible: HardState[] = [];

    for (const entity of entities) {
      const isInfectedWithSource = isInfectedWith(entity, config.contagion, source.id, graphView);
      const isImmuneToSource = multiSource.immunityTagPrefix
        ? hasTag(entity.tags, `${multiSource.immunityTagPrefix}:${source.id}`)
        : false;

      if (isInfectedWithSource) {
        infected.push(entity);
        // Track for visualization
        if (!infectedBySource.has(source.id)) {
          infectedBySource.set(source.id, new Set());
        }
        infectedBySource.get(source.id)!.add(entity.id);
      } else if (!isImmuneToSource) {
        susceptible.push(entity);
      }
    }

    // === TRANSMISSION PHASE for this source ===
    for (const entity of susceptible) {
      const contacts = getContacts(entity, config.vectors, graphView);
      const infectedContacts = contacts.filter(c =>
        isInfectedWith(c, config.contagion, source.id, graphView)
      );

      if (infectedContacts.length === 0) continue;

      // Calculate susceptibility modifier
      const susceptibilityMod = calculateSusceptibility(entity, config.susceptibilityModifiers);

      // Calculate infection probability
      const baseProb = config.transmission.baseRate +
        (infectedContacts.length * config.transmission.contactMultiplier);
      const modifiedProb = baseProb * (1 - susceptibilityMod);
      const maxProb = config.transmission.maxProbability ?? 0.95;
      const infectionProb = Math.min(maxProb, Math.max(0, modifiedProb));

      if (rollProbability(infectionProb, modifier)) {
        const infectionCtx = {
          ...baseCtx,
          self: entity,
          entities: {
            ...(baseCtx.entities ?? {}),
            source,
            contagion_source: source,
          },
        };

        const action = config.infectionAction;
        let actionApplied = false;

        if (action.type === 'set_tag') {
          const tagAction: SetTagMutation = {
            ...action,
            tag: `${action.tag}:${source.id}`,
          };
          const result = prepareMutation(tagAction, infectionCtx);
          if (result.applied) {
            actionApplied = true;
            for (const mod of result.entityModifications) {
              let currentTags = modifiedTags.get(mod.id) || { ...entity.tags };
              if (mod.changes.tags) {
                currentTags = applyTagPatch(currentTags, mod.changes.tags);
              }
              modifiedTags.set(mod.id, currentTags);
            }
          }
        } else {
          const result = prepareMutation(action, infectionCtx);
          mergeMutationResult(result, modifications, relationships, relationshipsAdjusted, pressureChanges);
          actionApplied = result.applied;
        }

        if (actionApplied) {
          newInfections.push(entity.id);
          if (!infectedBySource.has(source.id)) {
            infectedBySource.set(source.id, new Set());
          }
          infectedBySource.get(source.id)!.add(entity.id);
          // Generate narration if template provided, keyed by entity.id
          if (config.narrationTemplate) {
            const narrationCtx = createSystemRuleContext({
              self: entity,
              variables: { source, contagion_source: source },
            });
            const narrationResult = interpolate(config.narrationTemplate, narrationCtx);
            if (narrationResult.complete) {
              narrationsByGroup[entity.id] = narrationResult.text;
            }
          }
        }
      }
    }

    // === RECOVERY PHASE for this source ===
    if (config.recovery) {
      for (const entity of infected) {
        let recoveryProb = config.recovery.baseRate;
        if (config.recovery.recoveryBonusTraits) {
          for (const trait of config.recovery.recoveryBonusTraits) {
            if (hasTag(entity.tags, trait.tag)) {
              recoveryProb += trait.bonus;
            }
          }
        }
        recoveryProb = Math.min(0.95, Math.max(0, recoveryProb));

        if (rollProbability(recoveryProb, modifier)) {
          // Add source-specific immunity tag
          if (multiSource.immunityTagPrefix) {
            const currentTags = modifiedTags.get(entity.id) || { ...entity.tags };
            currentTags[`${multiSource.immunityTagPrefix}:${source.id}`] = true;
            modifiedTags.set(entity.id, currentTags);

            // Generate immunity narration if template provided
            if (multiSource.immunityNarrationTemplate) {
              const narrationCtx = createSystemRuleContext({
                self: entity,
                variables: { source },
              });
              const narrationResult = interpolate(multiSource.immunityNarrationTemplate, narrationCtx);
              if (narrationResult.complete) {
                narrationsByGroup[`${entity.id}:immunity:${source.id}`] = narrationResult.text;
              }
            }
          }
        }
      }
    }

    // === PHASE TRANSITIONS for this source ===
    if (config.phaseTransitions && entities.length > 0) {
      const adoptionRate = infected.length / entities.length;

      for (const transition of config.phaseTransitions) {
        if (adoptionRate < transition.adoptionThreshold) continue;
        const candidates = selectEntities(transition.selection, baseCtx);
        const matchesSource = candidates.some((candidate) => candidate.id === source.id);
        if (!matchesSource) continue;

        const changes: Partial<HardState> = { status: transition.toStatus };
        if (transition.descriptionSuffix) {
          const baseNarrative = source.narrativeHint ?? source.summary ?? source.description ?? '';
          changes.narrativeHint = `${baseNarrative} ${transition.descriptionSuffix}`;
        }
        modifications.push({
          id: source.id,
          changes
        });
      }

      // Handle low adoption threshold (source fades away)
      if (multiSource.lowAdoptionThreshold !== undefined &&
          adoptionRate < multiSource.lowAdoptionThreshold) {
        modifications.push({
          id: source.id,
          changes: {
            status: multiSource.lowAdoptionStatus || 'forgotten'
          }
        });
      }
    }
  }

  // Convert tag modifications to entity modifications
  for (const [entityId, tags] of modifiedTags) {
    // Keep only the most recent tags (limit to 10), but preserve framework tags if possible
    const tagKeys = Object.keys(tags);
    if (tagKeys.length > 10) {
      const excessCount = tagKeys.length - 10;
      const frameworkTags: Set<string> = new Set(FRAMEWORK_TAG_VALUES);
      const removable = tagKeys.filter(tag => !frameworkTags.has(tag));
      const protectedTags = tagKeys.filter(tag => frameworkTags.has(tag));
      const removalOrder = removable.length >= excessCount
        ? removable
        : removable.concat(protectedTags);
      for (let i = 0; i < excessCount; i++) {
        delete tags[removalOrder[i]];
      }
    }
    modifications.push({
      id: entityId,
      changes: { tags: buildTagPatch(graphView.getEntity(entityId)?.tags, tags) }
    });
  }

  const hadChanges =
    relationships.length > 0 || modifications.length > 0 || Object.keys(pressureChanges).length > 0;

  if (hadChanges && config.pressureChanges) {
    for (const [pressureId, delta] of Object.entries(config.pressureChanges)) {
      pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
    }
  }

  // Collect vector edges for visualization
  const entityIds = new Set(entities.map(e => e.id));
  const allRelationships = graphView.getAllRelationships();
  const vectorEdges: Array<{ source: string; target: string; kind: string; strength: number }> = [];

  for (const vector of config.vectors) {
    for (const rel of allRelationships) {
      if (rel.kind !== vector.relationshipKind) continue;
      const minStrength = vector.minStrength ?? 0;
      const strength = rel.strength ?? 0;
      if (strength < minStrength) continue;

      if (entityIds.has(rel.src) && entityIds.has(rel.dst)) {
        vectorEdges.push({
          source: rel.src,
          target: rel.dst,
          kind: rel.kind,
          strength,
        });
      }
    }
  }

  // Compute aggregate SIR state for each entity
  const allInfected = new Set<string>();
  for (const [, infected] of infectedBySource) {
    infected.forEach(id => allInfected.add(id));
  }

  // Build visualization snapshot for trace viewer
  const visualizationSnapshot = {
    // Nodes with aggregate SIR state and coordinates
    nodes: entities.map(e => ({
      id: e.id,
      name: e.name,
      x: e.coordinates?.x ?? Math.random() * 100,
      y: e.coordinates?.y ?? Math.random() * 100,
      state: allInfected.has(e.id) ? 'infected' : 'susceptible',
      prominence: e.prominence,
      // Which sources this entity is infected with
      infectedWith: Array.from(infectedBySource.entries())
        .filter(([, ids]) => ids.has(e.id))
        .map(([sourceId]) => sourceId),
    })),
    // Edges (transmission vectors)
    edges: vectorEdges,
    // New infections this tick
    newInfections,
    // Per-source infection counts
    sourceStats: sources.map(s => ({
      id: s.id,
      name: s.name,
      infectedCount: infectedBySource.get(s.id)?.size ?? 0,
      adoptionRate: entities.length > 0 ? (infectedBySource.get(s.id)?.size ?? 0) / entities.length : 0,
    })),
    // Summary counts
    counts: {
      susceptible: entities.length - allInfected.size,
      infected: allInfected.size,
      total: entities.length,
      sources: sources.length,
    },
  };

  return {
    relationshipsAdded: relationships,
    relationshipsAdjusted,
    entitiesModified: modifications as SystemResult['entitiesModified'],
    pressureChanges,
    description: `${config.name}: ${relationships.length} new believers, ${modifications.length} modifications across ${sources.length} sources`,
    details: {
      contagionSnapshot: visualizationSnapshot,
    },
    narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined,
  };
}
