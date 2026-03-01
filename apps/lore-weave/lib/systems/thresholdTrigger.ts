import { SimulationSystem, SystemResult } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { rollProbability, hasTag, generateId } from '../utils';
import {
  selectEntities,
  prepareMutation,
  evaluateCondition as rulesEvaluateCondition,
  createSystemContext,
  withSelf,
  resolveVariablesForEntity,
} from '../rules';
import { interpolate, createSystemRuleContext } from '../narrative/narrationTemplate';
import type {
  SelectionRule,
  Mutation,
  MutationResult,
  Condition,
  EntityModification,
  VariableSelectionRule,
} from '../rules';

/**
 * Threshold Trigger System Factory
 *
 * Creates configurable systems that detect graph conditions and set tags/pressures
 * to trigger generation templates. This separates condition detection (systems)
 * from entity creation (templates).
 *
 * Design philosophy:
 * - Systems observe and label reality with tags describing current state
 * - Tags use state-descriptive names (e.g., "power_vacuum", "war_brewing")
 * - Templates react to these tags and create entities
 * - After creation, templates transition tags (e.g., "war_brewing" → "at_war")
 *
 * Tag patterns:
 * - Boolean tag for single-entity conditions: { power_vacuum: true }
 * - Cluster ID tag for multi-entity conditions: { war_brewing: "cluster_xyz" }
 *
 * The factory creates a SimulationSystem from a ThresholdTriggerConfig.
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

// TriggerCondition is now an alias for Condition from rules/
// The canonical condition types are defined in rules/conditions/types.ts
export type TriggerCondition = Condition;

export type TriggerAction = Mutation & {
  /** If true, create relationships between all matching entities */
  betweenMatching?: boolean;
};

export interface ThresholdTriggerConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Selection rule for entities to evaluate */
  selection: SelectionRule;

  /** Conditions that must ALL be true for an entity to match */
  conditions: TriggerCondition[];

  /** Actions to take on matching entities */
  actions: TriggerAction[];

  /**
   * For cluster actions: how to group matching entities
   * 'individual' - each entity gets its own trigger
   * 'all_matching' - all matching entities share one cluster ID
   * 'by_relationship' - group by shared relationship targets
   */
  clusterMode?: 'individual' | 'all_matching' | 'by_relationship';

  /** For by_relationship clustering: the relationship to group by */
  clusterRelationshipKind?: string;

  /** Minimum entities needed to trigger (for cluster modes) */
  minClusterSize?: number;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /** Cooldown tag: if this tag exists on entity, skip it */
  cooldownTag?: string;

  /** Ticks to check for cooldown */
  cooldownTicks?: number;

  /** Pressure changes when trigger fires */
  pressureChanges?: Record<string, number>;

  /**
   * Template for in-world narration when this system triggers.
   * Supports {$self.name}, {$variable.field}, etc.
   */
  narrationTemplate?: string;

  /**
   * Variables to resolve before applying actions.
   * Each variable has a selection rule that finds an entity from the graph.
   * Variables can reference $self (the matched entity) or other previously resolved variables.
   * If a required variable cannot be resolved, the entity is skipped.
   */
  variables?: Record<string, {
    select: VariableSelectionRule;
    required?: boolean;
  }>;
}


// =============================================================================
// CONDITION EVALUATION
// =============================================================================

function evaluateCondition(
  entity: HardState,
  condition: TriggerCondition,
  graphView: WorldRuntime
): boolean {
  // Create RuleContext with entity as self
  const baseCtx = createSystemContext(graphView);
  const ctx = withSelf(baseCtx, entity);

  // Evaluate using rules library (TriggerCondition is now Condition)
  const result = rulesEvaluateCondition(condition, ctx, entity);
  return result.passed;
}

function evaluateAllConditions(
  entity: HardState,
  conditions: TriggerCondition[],
  graphView: WorldRuntime
): boolean {
  return conditions.every(condition => evaluateCondition(entity, condition, graphView));
}

// =============================================================================
// CLUSTERING
// =============================================================================

function clusterEntities(
  entities: HardState[],
  config: ThresholdTriggerConfig,
  graphView: WorldRuntime
): Map<string, HardState[]> {
  const clusters = new Map<string, HardState[]>();

  switch (config.clusterMode) {
    case 'individual':
      // Each entity is its own cluster
      entities.forEach(e => {
        clusters.set(e.id, [e]);
      });
      break;

    case 'all_matching':
      // All entities share one cluster
      if (entities.length > 0) {
        const clusterId = generateId('cluster');
        clusters.set(clusterId, entities);
      }
      break;

    case 'by_relationship': {
      // Group by shared relationship targets
      if (!config.clusterRelationshipKind) {
        // Fallback to individual
        entities.forEach(e => clusters.set(e.id, [e]));
        break;
      }

      // Find shared targets
      const entityTargets = new Map<string, Set<string>>();
      entities.forEach(e => {
        const targets = new Set<string>();
        graphView.getAllRelationships().forEach(r => {
          if (r.kind !== config.clusterRelationshipKind) return;
          if (r.src === e.id) targets.add(r.dst);
          if (r.dst === e.id) targets.add(r.src);
        });
        entityTargets.set(e.id, targets);
      });

      // Group entities that share at least one target
      const visited = new Set<string>();
      entities.forEach(e => {
        if (visited.has(e.id)) return;

        const cluster: HardState[] = [e];
        visited.add(e.id);
        const myTargets = entityTargets.get(e.id) || new Set();

        entities.forEach(other => {
          if (visited.has(other.id)) return;
          const otherTargets = entityTargets.get(other.id) || new Set();

          // Check for shared targets
          const hasShared = Array.from(myTargets).some(t => otherTargets.has(t));
          if (hasShared) {
            cluster.push(other);
            visited.add(other.id);
          }
        });

        const clusterId = generateId('cluster');
        clusters.set(clusterId, cluster);
      });
      break;
    }

    default:
      // Default to individual
      entities.forEach(e => clusters.set(e.id, [e]));
  }

  // Filter by minimum cluster size
  if (config.minClusterSize && config.minClusterSize > 1) {
    for (const [id, members] of clusters) {
      if (members.length < config.minClusterSize) {
        clusters.delete(id);
      }
    }
  }

  return clusters;
}

// =============================================================================
// ACTION APPLICATION
// =============================================================================

/** Bundled mutable results accumulated during action application */
interface ActionResults {
  modifications: Array<EntityModification & { narrativeGroupId?: string }>;
  relationships: Array<Relationship & { narrativeGroupId?: string }>;
  relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number; narrativeGroupId?: string }>;
  relationshipsToArchive: Array<{ kind: string; src: string; dst: string; narrativeGroupId?: string }>;
  pressureChanges: Record<string, number>;
  narrationsByGroup: Record<string, string>;
  skippedMembers: number;
}

function pushWithNarrativeGroup<T extends object>(
  items: T[],
  dest: Array<T & { narrativeGroupId?: string }>,
  narrativeGroupId?: string
): void {
  for (const item of items) {
    dest.push(narrativeGroupId ? { ...item, narrativeGroupId } : item as T & { narrativeGroupId?: string });
  }
}

function mergeRelationshipsCreated(
  created: MutationResult['relationshipsCreated'],
  dest: Array<Relationship & { narrativeGroupId?: string }>,
  narrativeGroupId?: string
): void {
  for (const rel of created) {
    dest.push({
      kind: rel.kind,
      src: rel.src,
      dst: rel.dst,
      strength: rel.strength,
      category: rel.category,
      ...(narrativeGroupId ? { narrativeGroupId } : {}),
    });
  }
}

function mergePressureChanges(from: Record<string, number>, into: Record<string, number>): void {
  for (const [pressureId, delta] of Object.entries(from)) {
    into[pressureId] = (into[pressureId] || 0) + delta;
  }
}

function mergeMutationResult(
  result: MutationResult,
  out: ActionResults,
  narrativeGroupId?: string
): void {
  if (!result.applied) return;
  pushWithNarrativeGroup(result.entityModifications, out.modifications, narrativeGroupId);
  mergeRelationshipsCreated(result.relationshipsCreated, out.relationships, narrativeGroupId);
  pushWithNarrativeGroup(result.relationshipsAdjusted, out.relationshipsAdjusted, narrativeGroupId);
  pushWithNarrativeGroup(result.relationshipsToArchive, out.relationshipsToArchive, narrativeGroupId);
  mergePressureChanges(result.pressureChanges, out.pressureChanges);
}

function applyBetweenMatchingPairs(
  actionKind: string,
  members: HardState[],
  clusterCtx: ReturnType<typeof createSystemContext>,
  action: Mutation,
  out: ActionResults,
  narrativeGroupId: string | undefined,
  graphView: WorldRuntime
): void {
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const src = members[i];
      const dst = members[j];
      if (graphView.hasRelationship(src.id, dst.id, actionKind)) continue;
      const pairCtx = {
        ...clusterCtx,
        entities: { ...(clusterCtx.entities ?? {}), member: src, member2: dst },
      };
      const result = prepareMutation(action, pairCtx);
      mergeMutationResult(result, out, narrativeGroupId);
    }
  }
}

function applyClusterActions(
  actions: TriggerAction[],
  members: HardState[],
  clusterCtx: ReturnType<typeof createSystemContext>,
  out: ActionResults,
  narrativeGroupId: string | undefined,
  graphView: WorldRuntime
): void {
  for (const action of actions) {
    if (action.type === 'modify_pressure') {
      const result = prepareMutation(action, clusterCtx);
      mergeMutationResult(result, out, narrativeGroupId);
    }
    if (action.type === 'create_relationship' && action.betweenMatching && members.length >= 2) {
      applyBetweenMatchingPairs((action as { kind: string }).kind, members, clusterCtx, action, out, narrativeGroupId, graphView);
    }
  }
}

function applyActionsToMember(
  member: HardState,
  config: ThresholdTriggerConfig,
  clusterCtx: ReturnType<typeof createSystemContext>,
  out: ActionResults,
  narrativeGroupId: string | undefined
): boolean {
  const resolvedVars = config.variables
    ? resolveVariablesForEntity(config.variables, clusterCtx, member)
    : {};
  if (resolvedVars === null) return false;

  const memberCtx = {
    ...clusterCtx,
    self: member,
    entities: { ...(clusterCtx.entities ?? {}), self: member, ...resolvedVars },
  };

  if (config.narrationTemplate && narrativeGroupId) {
    const narrationCtx = createSystemRuleContext({
      self: member,
      variables: resolvedVars as Record<string, HardState | undefined>,
    });
    const narration = interpolate(config.narrationTemplate, narrationCtx);
    if (narration.complete) {
      out.narrationsByGroup[narrativeGroupId] = narration.text;
    }
  }

  for (const action of config.actions) {
    if (action.type === 'modify_pressure') continue;
    if (action.type === 'create_relationship' && action.betweenMatching) continue;
    const mutation: Mutation = action;
    const result = prepareMutation(mutation, memberCtx);
    mergeMutationResult(result, out, narrativeGroupId);
  }
  return true;
}

function applyActions(
  clusters: Map<string, HardState[]>,
  config: ThresholdTriggerConfig,
  graphView: WorldRuntime
): {
  modifications: Array<EntityModification & { narrativeGroupId?: string }>;
  relationships: Array<Relationship & { narrativeGroupId?: string }>;
  relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number; narrativeGroupId?: string }>;
  relationshipsToArchive: Array<{ kind: string; src: string; dst: string; narrativeGroupId?: string }>;
  pressureChanges: Record<string, number>;
  skippedMembers: number;
  narrationsByGroup: Record<string, string>;
} {
  const out: ActionResults = {
    modifications: [],
    relationships: [],
    relationshipsAdjusted: [],
    relationshipsToArchive: [],
    pressureChanges: {},
    narrationsByGroup: {},
    skippedMembers: 0,
  };
  const baseCtx = createSystemContext(graphView);
  const usePerClusterNarrative = config.clusterMode === 'individual';

  for (const [clusterId, members] of clusters) {
    const clusterCtx = {
      ...baseCtx,
      values: { ...(baseCtx.values ?? {}), cluster_id: clusterId },
    };
    const narrativeGroupId = usePerClusterNarrative ? clusterId : undefined;

    applyClusterActions(config.actions, members, clusterCtx, out, narrativeGroupId, graphView);

    for (const member of members) {
      if (!applyActionsToMember(member, config, clusterCtx, out, narrativeGroupId)) {
        out.skippedMembers++;
      }
    }
  }

  if (clusters.size > 0 && config.pressureChanges) {
    mergePressureChanges(config.pressureChanges, out.pressureChanges);
  }

  return {
    modifications: out.modifications,
    relationships: out.relationships,
    relationshipsAdjusted: out.relationshipsAdjusted,
    relationshipsToArchive: out.relationshipsToArchive,
    pressureChanges: out.pressureChanges,
    skippedMembers: out.skippedMembers,
    narrationsByGroup: out.narrationsByGroup,
  };
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a ThresholdTriggerConfig
 */
export function createThresholdTriggerSystem(
  config: ThresholdTriggerConfig
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

      // Find entities matching selection
      const selectionCtx = createSystemContext(graphView);
      let entities = selectEntities(config.selection, selectionCtx);

      // Apply cooldown filter
      if (config.cooldownTag) {
        entities = entities.filter(e => !hasTag(e.tags, config.cooldownTag!));
      }

      // Evaluate conditions on each entity
      const matchingEntities = entities.filter(entity =>
        evaluateAllConditions(entity, config.conditions, graphView)
      );

      if (matchingEntities.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: no matches`
        };
      }

      // Cluster matching entities
      const clusters = clusterEntities(matchingEntities, config, graphView);

      if (clusters.size === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: clusters too small`
        };
      }

      // Apply actions
      const { modifications, relationships, relationshipsAdjusted, relationshipsToArchive, pressureChanges, skippedMembers, narrationsByGroup } =
        applyActions(clusters, config, graphView);

      const skippedInfo = skippedMembers > 0 ? `, ${skippedMembers} skipped (missing vars)` : '';
      return {
        relationshipsAdded: relationships,
        relationshipsAdjusted,
        relationshipsToArchive,
        entitiesModified: modifications as SystemResult['entitiesModified'],
        pressureChanges,
        description: `${config.name}: ${clusters.size} trigger(s), ${modifications.length} entities tagged${skippedInfo}`,
        narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined,
      };
    }
  };
}
