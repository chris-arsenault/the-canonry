import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { rollProbability } from '../utils';
import {
  createSystemContext,
  evaluateMetric,
  prepareMutation,
  applyOperator,
  selectEntities,
} from '../rules';
import type {
  ComparisonOperator,
  SelectionRule,
  Metric,
  Mutation,
  MutationResult,
  EntityModification,
} from '../rules';
import { interpolate, createSystemRuleContext } from '../narrative/narrationTemplate';

/**
 * Connection Evolution System Factory
 *
 * Creates configurable systems that modify entity/relationship state
 * based on connection metrics. This is a domain-agnostic pattern that
 * can implement:
 * - Prominence evolution (fame/obscurity based on connections)
 * - Alliance formation (create relationships between entities with shared relationships)
 * - Status transitions based on graph topology
 *
 * The factory creates a SimulationSystem from a ConnectionEvolutionConfig.
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export type ConditionOperator = ComparisonOperator;

export type ThresholdValue =
  | number
  | 'prominence_scaled';    // (prominenceLevel + 1) * multiplier

export type ActionType = Extract<
  Mutation,
  | { type: 'adjust_prominence' }
  | { type: 'create_relationship' }
  | { type: 'change_status' }
  | { type: 'set_tag' }
>;

export type MetricConfig = Metric;

export interface EvolutionRule {
  /** Condition to check */
  condition: {
    operator: ConditionOperator;
    threshold: ThresholdValue;
    /** Multiplier for prominence_scaled threshold (default: 6) */
    multiplier?: number;
  };
  /** Probability of applying action when condition is met (0-1) */
  probability: number;
  /** Action to take */
  action: ActionType;
  /**
   * For create_relationship: create between matching entities that satisfy condition.
   * If true, pairs entities that both pass the condition.
   * If false/undefined, action applies to entity directly.
   */
  betweenMatching?: boolean;
  /**
   * Narration template for narrative-quality text when this rule triggers.
   * Uses the full template syntax:
   * - {self.field} or {$self.field} - The entity being evaluated
   * - {member.field} or {$member.field} - First entity in pair (for betweenMatching)
   * - {member2.field} or {$member2.field} - Second entity in pair (for betweenMatching)
   * - {field|fallback} - Use fallback if field is null/undefined
   *
   * Example: "{$member.name} and {$member2.name}, united by shared interests, forged an alliance."
   */
  narrationTemplate?: string;
  /**
   * Narration template for multi-party relationships (3+ entities forming a clique).
   * Used when betweenMatching creates relationships among 3+ entities that all connect.
   * Uses:
   * - {names} - Comma-separated list of all party names
   * - {count} - Number of parties
   *
   * Example: "{names} formed a mutual alliance."
   * If not provided, falls back to generating separate pair narrations.
   */
  multiPartyNarrationTemplate?: string;
}

export interface SubtypeBonus {
  subtype: string;
  bonus: number;
}

export interface ConnectionEvolutionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Selection rule for entities to evaluate */
  selection: SelectionRule;

  /** How to calculate the metric for each entity */
  metric: MetricConfig;

  /** Rules to apply based on metric value */
  rules: EvolutionRule[];

  /** Subtype bonuses added to metric value */
  subtypeBonuses?: SubtypeBonus[];

  /** Pressure changes when system runs and modifies entities */
  pressureChanges?: Record<string, number>;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /**
   * For betweenMatching rules: exclude pairs that already have these relationship kinds.
   * Prevents creating alliances between factions that are at war, etc.
   */
  pairExcludeRelationships?: string[];

  /**
   * For betweenMatching rules: limit the combined component size when creating relationships.
   * If connecting two entities would create a component larger than this limit, skip the pair.
   */
  pairComponentSizeLimit?: {
    /** Relationship kind(s) to calculate component size */
    relationshipKinds: string[];
    /** Maximum allowed component size after connecting the pair */
    max: number;
  };
}

// =============================================================================
// METRIC CALCULATION
// =============================================================================

function calculateMetric(
  entity: HardState,
  config: MetricConfig,
  ctx: ReturnType<typeof createSystemContext>
): number {
  const result = evaluateMetric(config, ctx, entity);
  return result.value;
}

function resolveThreshold(
  threshold: ThresholdValue,
  entity: HardState,
  multiplier: number = 6
): number {
  if (typeof threshold === 'number') {
    return threshold;
  }
  // prominence_scaled: (prominenceLevel + 1) * multiplier
  // entity.prominence is now numeric (0-5), use floor to get level index
  const level = Math.floor(entity.prominence);
  return (level + 1) * multiplier;
}

function mergeMutationResult(
  result: MutationResult,
  modifications: Array<EntityModification & { narrativeGroupId?: string }>,
  relationships: Array<Relationship & { narrativeGroupId?: string }>,
  relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number; narrativeGroupId?: string }>,
  pressureChanges: Record<string, number>,
  narrativeGroupId?: string
): void {
  if (!result.applied) return;

  if (result.entityModifications.length > 0) {
    for (const mod of result.entityModifications) {
      modifications.push(narrativeGroupId ? { ...mod, narrativeGroupId } : mod);
    }
  }

  if (result.relationshipsCreated.length > 0) {
    for (const rel of result.relationshipsCreated) {
      const relWithGroup = {
        kind: rel.kind,
        src: rel.src,
        dst: rel.dst,
        strength: rel.strength,
        category: rel.category,
        ...(narrativeGroupId ? { narrativeGroupId } : {}),
      };
      relationships.push(relWithGroup);
    }
  }

  if (result.relationshipsAdjusted.length > 0) {
    for (const adj of result.relationshipsAdjusted) {
      relationshipsAdjusted.push(narrativeGroupId ? { ...adj, narrativeGroupId } : adj);
    }
  }

  for (const [pressureId, delta] of Object.entries(result.pressureChanges)) {
    pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
  }
}

function evaluateCondition(
  value: number,
  operator: ConditionOperator,
  threshold: number
): boolean {
  return applyOperator(value, operator, threshold);
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a ConnectionEvolutionConfig
 */
export function createConnectionEvolutionSystem(
  config: ConnectionEvolutionConfig
): SimulationSystem {
  return {
    id: config.id,
    name: config.name,

    apply: (graphView: WorldRuntime, modifier: number = 1.0): SystemResult => {
      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (Math.random() > config.throttleChance) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: throttled`
          };
        }
      }

      const modifications: Array<EntityModification & { narrativeGroupId?: string }> = [];
      const relationships: Array<Relationship & { narrativeGroupId?: string }> = [];
      const relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number; narrativeGroupId?: string }> = [];
      const pressureChanges: Record<string, number> = {};
      const narrationsByGroup: Record<string, string> = {};

      // Find entities to evaluate
      const ruleCtx = createSystemContext(graphView);
      const entities = selectEntities(config.selection, ruleCtx);

      // For create_relationship with betweenMatching, track matching entities per rule
      const matchingByRule = new Map<number, HardState[]>();

      // Evaluate each entity
      for (const entity of entities) {
        let metricValue = calculateMetric(entity, config.metric, ruleCtx);

        // Apply subtype bonuses
        if (config.subtypeBonuses && entity.subtype) {
          const bonus = config.subtypeBonuses.find(b => b.subtype === entity.subtype);
          if (bonus) {
            metricValue += bonus.bonus;
          }
        }

        // Evaluate each rule
        for (let ruleIdx = 0; ruleIdx < config.rules.length; ruleIdx++) {
          const rule = config.rules[ruleIdx];
          const threshold = resolveThreshold(
            rule.condition.threshold,
            entity,
            rule.condition.multiplier
          );

          if (!evaluateCondition(metricValue, rule.condition.operator, threshold)) {
            continue;
          }

          // Condition met - check probability
          if (!rollProbability(rule.probability, modifier)) {
            continue;
          }

          const entityCtx = { ...ruleCtx, self: entity };

          if (rule.action.type === 'create_relationship' && rule.betweenMatching) {
            // betweenMatching relationships are a unified narrative (coalition formation)
            // so we don't split by entity - they'll be grouped together
            if (!matchingByRule.has(ruleIdx)) {
              matchingByRule.set(ruleIdx, []);
            }
            matchingByRule.get(ruleIdx)!.push(entity);
          } else {
            // Individual actions (prominence, status, tags) are separate narratives per entity
            // Each entity's rise/fall is its own story
            const result = prepareMutation(rule.action as Mutation, entityCtx);
            mergeMutationResult(result, modifications, relationships, relationshipsAdjusted, pressureChanges, entity.id);

            // Generate narration if template provided and mutation applied
            // Key by entity.id for proper per-entity attribution
            if (rule.narrationTemplate && result.applied) {
              const narrationCtx = createSystemRuleContext({ self: entity });
              const narrationResult = interpolate(rule.narrationTemplate, narrationCtx);
              if (narrationResult.complete) {
                narrationsByGroup[entity.id] = narrationResult.text;
              }
            }
          }
        }
      }

      // Create relationships between matching entities (for betweenMatching rules)
      // NOTE: No narrativeGroupId here - coalition/alliance formation is ONE unified narrative
      // "Renowned figures formed alliances" not "X allied, Y allied, Z allied"

      // Build adjacency map for component size limit checks (if configured)
      // This includes both existing relationships AND new ones we decide to create this tick
      let adjacency: Map<string, Set<string>> | undefined;
      if (config.pairComponentSizeLimit) {
        adjacency = new Map<string, Set<string>>();
        const rels = graphView.getAllRelationships();
        for (const rel of rels) {
          if (!config.pairComponentSizeLimit.relationshipKinds.includes(rel.kind)) continue;
          if (!adjacency.has(rel.src)) adjacency.set(rel.src, new Set());
          if (!adjacency.has(rel.dst)) adjacency.set(rel.dst, new Set());
          adjacency.get(rel.src)!.add(rel.dst);
          adjacency.get(rel.dst)!.add(rel.src);
        }
      }

      // Helper: get component size for an entity using DFS
      const getComponentSize = (entityId: string): number => {
        if (!adjacency) return 1;
        const visited = new Set<string>([entityId]);
        const stack = [entityId];
        while (stack.length > 0) {
          const current = stack.pop()!;
          const neighbors = adjacency.get(current);
          if (neighbors) {
            for (const neighborId of neighbors) {
              if (!visited.has(neighborId)) {
                visited.add(neighborId);
                stack.push(neighborId);
              }
            }
          }
        }
        return visited.size;
      };

      // Helper: get combined component size if two entities were connected
      const getCombinedComponentSize = (srcId: string, dstId: string): number => {
        if (!adjacency) return 2;
        // Get all entities in src's component
        const visited = new Set<string>([srcId]);
        const stack = [srcId];
        while (stack.length > 0) {
          const current = stack.pop()!;
          const neighbors = adjacency.get(current);
          if (neighbors) {
            for (const neighborId of neighbors) {
              if (!visited.has(neighborId)) {
                visited.add(neighborId);
                stack.push(neighborId);
              }
            }
          }
        }
        // If dst is already in the component, return current size
        if (visited.has(dstId)) return visited.size;
        // Otherwise, add dst's component size
        const dstStack = [dstId];
        visited.add(dstId);
        while (dstStack.length > 0) {
          const current = dstStack.pop()!;
          const neighbors = adjacency.get(current);
          if (neighbors) {
            for (const neighborId of neighbors) {
              if (!visited.has(neighborId)) {
                visited.add(neighborId);
                dstStack.push(neighborId);
              }
            }
          }
        }
        return visited.size;
      };

      for (const [ruleIdx, matchingEntities] of matchingByRule.entries()) {
        const rule = config.rules[ruleIdx];
        if (rule.action.type !== 'create_relationship') continue;

        // Phase 1: Collect all valid pairs that pass checks
        const validPairs: Array<{ src: HardState; dst: HardState }> = [];
        const pairGraph = new Map<string, Set<string>>(); // For clique detection

        for (let i = 0; i < matchingEntities.length; i++) {
          for (let j = i + 1; j < matchingEntities.length; j++) {
            const src = matchingEntities[i];
            const dst = matchingEntities[j];

            // Check if relationship already exists
            if (graphView.hasRelationship(src.id, dst.id, rule.action.kind)) {
              continue;
            }

            // Check pair exclusion relationships (e.g., don't ally factions at war)
            if (config.pairExcludeRelationships?.length) {
              let excluded = false;
              for (const excludeKind of config.pairExcludeRelationships) {
                if (graphView.hasRelationship(src.id, dst.id, excludeKind) ||
                    graphView.hasRelationship(dst.id, src.id, excludeKind)) {
                  excluded = true;
                  break;
                }
              }
              if (excluded) continue;
            }

            // Check component size limit (e.g., don't create alliances that would make giant blocs)
            if (config.pairComponentSizeLimit && adjacency) {
              const combinedSize = getCombinedComponentSize(src.id, dst.id);
              if (combinedSize > config.pairComponentSizeLimit.max) {
                continue; // Skip this pair - would create too large a component
              }
              // Update adjacency for future checks in this tick
              if (!adjacency.has(src.id)) adjacency.set(src.id, new Set());
              if (!adjacency.has(dst.id)) adjacency.set(dst.id, new Set());
              adjacency.get(src.id)!.add(dst.id);
              adjacency.get(dst.id)!.add(src.id);
            }

            // This pair is valid - add to list and graph
            validPairs.push({ src, dst });
            if (!pairGraph.has(src.id)) pairGraph.set(src.id, new Set());
            if (!pairGraph.has(dst.id)) pairGraph.set(dst.id, new Set());
            pairGraph.get(src.id)!.add(dst.id);
            pairGraph.get(dst.id)!.add(src.id);
          }
        }

        // Phase 2: Find connected components and detect cliques
        const processedEntities = new Set<string>();
        const cliques: HardState[][] = [];
        const nonCliquePairs: Array<{ src: HardState; dst: HardState }> = [];

        // Find connected components
        for (const entityId of pairGraph.keys()) {
          if (processedEntities.has(entityId)) continue;

          // BFS to find component
          const component: string[] = [];
          const queue = [entityId];
          while (queue.length > 0) {
            const current = queue.shift()!;
            if (processedEntities.has(current)) continue;
            processedEntities.add(current);
            component.push(current);
            const neighbors = pairGraph.get(current);
            if (neighbors) {
              for (const neighbor of neighbors) {
                if (!processedEntities.has(neighbor)) {
                  queue.push(neighbor);
                }
              }
            }
          }

          // Check if component is a clique (all pairs connected)
          const n = component.length;
          const expectedEdges = (n * (n - 1)) / 2;
          let actualEdges = 0;
          for (let i = 0; i < component.length; i++) {
            for (let j = i + 1; j < component.length; j++) {
              if (pairGraph.get(component[i])?.has(component[j])) {
                actualEdges++;
              }
            }
          }

          if (n >= 3 && actualEdges === expectedEdges) {
            // It's a clique of 3+ entities
            const cliqueEntities = component.map(id =>
              matchingEntities.find(e => e.id === id)!
            );
            cliques.push(cliqueEntities);
          } else {
            // Not a clique - add pairs individually
            for (const pair of validPairs) {
              if (component.includes(pair.src.id) && component.includes(pair.dst.id)) {
                nonCliquePairs.push(pair);
              }
            }
          }
        }

        // Phase 3: Process cliques with unified narration
        for (const clique of cliques) {
          const cliqueId = clique.map(e => e.id).sort().join(':');

          // Create all relationships within the clique
          for (let i = 0; i < clique.length; i++) {
            for (let j = i + 1; j < clique.length; j++) {
              const src = clique[i];
              const dst = clique[j];
              const pairCtx = {
                ...ruleCtx,
                entities: { ...(ruleCtx.entities ?? {}), member: src, member2: dst },
              };
              const result = prepareMutation(rule.action as Mutation, pairCtx);
              mergeMutationResult(result, modifications, relationships, relationshipsAdjusted, pressureChanges, cliqueId);
            }
          }

          // Generate unified narration for the clique
          if (rule.multiPartyNarrationTemplate) {
            const names = clique.map(e => e.name).join(', ');
            const narrationText = rule.multiPartyNarrationTemplate
              .replace('{names}', names)
              .replace('{count}', String(clique.length));
            narrationsByGroup[cliqueId] = narrationText;
          } else if (rule.narrationTemplate) {
            // Fallback: generate a reasonable multi-party narration from pair template
            const names = clique.map(e => e.name).join(', ');
            narrationsByGroup[cliqueId] = `${names} formed mutual relationships.`;
          }
        }

        // Phase 4: Process remaining non-clique pairs individually
        for (const { src, dst } of nonCliquePairs) {
          const pairCtx = {
            ...ruleCtx,
            entities: { ...(ruleCtx.entities ?? {}), member: src, member2: dst },
          };
          const result = prepareMutation(rule.action as Mutation, pairCtx);
          mergeMutationResult(result, modifications, relationships, relationshipsAdjusted, pressureChanges, src.id);

          // Generate pair narration
          if (rule.narrationTemplate && result.applied) {
            const narrationCtx = createSystemRuleContext({ member: src, member2: dst });
            const narrationResult = interpolate(rule.narrationTemplate, narrationCtx);
            if (narrationResult.complete) {
              narrationsByGroup[src.id] = narrationResult.text;
            }
          }
        }
      }

      if (modifications.length > 0 || relationships.length > 0 || relationshipsAdjusted.length > 0) {
        for (const [pressureId, delta] of Object.entries(config.pressureChanges ?? {})) {
          pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
        }
      }

      return {
        relationshipsAdded: relationships,
        relationshipsAdjusted,
        entitiesModified: modifications as SystemResult['entitiesModified'],
        pressureChanges,
        description: `${config.name}: ${modifications.length} modified, ${relationships.length} relationships`,
        narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined,
      };
    }
  };
}

