import { SimulationSystem, SystemResult } from '../engine/types';
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
// APPLY HELPERS
// =============================================================================

type ModArray = Array<EntityModification & { narrativeGroupId?: string }>;
type RelArray = Array<Relationship & { narrativeGroupId?: string }>;
type AdjArray = Array<{ kind: string; src: string; dst: string; delta: number; narrativeGroupId?: string }>;

interface ApplyAccumulators {
  modifications: ModArray;
  relationships: RelArray;
  relationshipsAdjusted: AdjArray;
  pressureChanges: Record<string, number>;
  narrationsByGroup: Record<string, string>;
}

function createThrottledResult(configName: string): SystemResult {
  return {
    relationshipsAdded: [],
    entitiesModified: [],
    pressureChanges: {},
    description: `${configName}: throttled`
  };
}

function applySubtypeBonus(
  metricValue: number,
  entity: HardState,
  subtypeBonuses: SubtypeBonus[] | undefined
): number {
  if (!subtypeBonuses || !entity.subtype) return metricValue;
  const bonus = subtypeBonuses.find(b => b.subtype === entity.subtype);
  return bonus ? metricValue + bonus.bonus : metricValue;
}

function evaluateEntityRules(
  entity: HardState,
  metricValue: number,
  config: ConnectionEvolutionConfig,
  ruleCtx: ReturnType<typeof createSystemContext>,
  modifier: number,
  matchingByRule: Map<number, HardState[]>,
  acc: ApplyAccumulators
): void {
  for (let ruleIdx = 0; ruleIdx < config.rules.length; ruleIdx++) {
    const rule = config.rules[ruleIdx];
    const threshold = resolveThreshold(
      rule.condition.threshold,
      entity,
      rule.condition.multiplier
    );

    if (!evaluateCondition(metricValue, rule.condition.operator, threshold)) continue;
    if (!rollProbability(rule.probability, modifier)) continue;

    if (rule.action.type === 'create_relationship' && rule.betweenMatching) {
      if (!matchingByRule.has(ruleIdx)) matchingByRule.set(ruleIdx, []);
      matchingByRule.get(ruleIdx)!.push(entity);
    } else {
      applyIndividualAction(entity, rule, ruleCtx, acc);
    }
  }
}

function applyIndividualAction(
  entity: HardState,
  rule: EvolutionRule,
  ruleCtx: ReturnType<typeof createSystemContext>,
  acc: ApplyAccumulators
): void {
  const entityCtx = { ...ruleCtx, self: entity };
  const result = prepareMutation(rule.action as Mutation, entityCtx);
  mergeMutationResult(result, acc.modifications, acc.relationships, acc.relationshipsAdjusted, acc.pressureChanges, entity.id);

  if (rule.narrationTemplate && result.applied) {
    const narrationCtx = createSystemRuleContext({ self: entity });
    const narrationResult = interpolate(rule.narrationTemplate, narrationCtx);
    if (narrationResult.complete) {
      acc.narrationsByGroup[entity.id] = narrationResult.text;
    }
  }
}

function buildAdjacencyMap(
  graphView: WorldRuntime,
  sizeLimit: ConnectionEvolutionConfig['pairComponentSizeLimit']
): Map<string, Set<string>> | undefined {
  if (!sizeLimit) return undefined;

  const adjacency = new Map<string, Set<string>>();
  const rels = graphView.getAllRelationships();
  for (const rel of rels) {
    if (!sizeLimit.relationshipKinds.includes(rel.kind)) continue;
    if (!adjacency.has(rel.src)) adjacency.set(rel.src, new Set());
    if (!adjacency.has(rel.dst)) adjacency.set(rel.dst, new Set());
    adjacency.get(rel.src)!.add(rel.dst);
    adjacency.get(rel.dst)!.add(rel.src);
  }
  return adjacency;
}

function getComponentFromNode(nodeId: string, adjacency: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>([nodeId]);
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        stack.push(neighborId);
      }
    }
  }
  return visited;
}

function getCombinedComponentSize(
  srcId: string,
  dstId: string,
  adjacency: Map<string, Set<string>> | undefined
): number {
  if (!adjacency) return 2;
  const srcComponent = getComponentFromNode(srcId, adjacency);
  if (srcComponent.has(dstId)) return srcComponent.size;

  // Add dst's component
  const dstStack = [dstId];
  srcComponent.add(dstId);
  while (dstStack.length > 0) {
    const current = dstStack.pop()!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const neighborId of neighbors) {
      if (!srcComponent.has(neighborId)) {
        srcComponent.add(neighborId);
        dstStack.push(neighborId);
      }
    }
  }
  return srcComponent.size;
}

function isPairExcluded(
  srcId: string,
  dstId: string,
  excludeKinds: string[] | undefined,
  graphView: WorldRuntime
): boolean {
  if (!excludeKinds?.length) return false;
  for (const excludeKind of excludeKinds) {
    if (graphView.hasRelationship(srcId, dstId, excludeKind) ||
        // eslint-disable-next-line sonarjs/arguments-order -- intentionally checking reverse direction
        graphView.hasRelationship(dstId, srcId, excludeKind)) {
      return true;
    }
  }
  return false;
}

function collectValidPairs(
  matchingEntities: HardState[],
  rule: EvolutionRule,
  config: ConnectionEvolutionConfig,
  graphView: WorldRuntime,
  adjacency: Map<string, Set<string>> | undefined
): { validPairs: Array<{ src: HardState; dst: HardState }>; pairGraph: Map<string, Set<string>> } {
  const validPairs: Array<{ src: HardState; dst: HardState }> = [];
  const pairGraph = new Map<string, Set<string>>();

  if (rule.action.type !== 'create_relationship') return { validPairs, pairGraph };

  for (let i = 0; i < matchingEntities.length; i++) {
    for (let j = i + 1; j < matchingEntities.length; j++) {
      const src = matchingEntities[i];
      const dst = matchingEntities[j];

      if (graphView.hasRelationship(src.id, dst.id, rule.action.kind)) continue;
      if (isPairExcluded(src.id, dst.id, config.pairExcludeRelationships, graphView)) continue;

      if (config.pairComponentSizeLimit && adjacency) {
        const combinedSize = getCombinedComponentSize(src.id, dst.id, adjacency);
        if (combinedSize > config.pairComponentSizeLimit.max) continue;
        if (!adjacency.has(src.id)) adjacency.set(src.id, new Set());
        if (!adjacency.has(dst.id)) adjacency.set(dst.id, new Set());
        adjacency.get(src.id)!.add(dst.id);
        adjacency.get(dst.id)!.add(src.id);
      }

      validPairs.push({ src, dst });
      if (!pairGraph.has(src.id)) pairGraph.set(src.id, new Set());
      if (!pairGraph.has(dst.id)) pairGraph.set(dst.id, new Set());
      pairGraph.get(src.id)!.add(dst.id);
      pairGraph.get(dst.id)!.add(src.id);
    }
  }

  return { validPairs, pairGraph };
}

function findComponentsAndCliques(
  pairGraph: Map<string, Set<string>>,
  validPairs: Array<{ src: HardState; dst: HardState }>,
  matchingEntities: HardState[]
): { cliques: HardState[][]; nonCliquePairs: Array<{ src: HardState; dst: HardState }> } {
  const processedEntities = new Set<string>();
  const cliques: HardState[][] = [];
  const nonCliquePairs: Array<{ src: HardState; dst: HardState }> = [];

  for (const entityId of pairGraph.keys()) {
    if (processedEntities.has(entityId)) continue;

    const component = bfsComponent(entityId, pairGraph, processedEntities);

    if (isClique(component, pairGraph)) {
      const cliqueEntities = component.map(id => matchingEntities.find(e => e.id === id)!);
      cliques.push(cliqueEntities);
    } else {
      for (const pair of validPairs) {
        if (component.includes(pair.src.id) && component.includes(pair.dst.id)) {
          nonCliquePairs.push(pair);
        }
      }
    }
  }

  return { cliques, nonCliquePairs };
}

function bfsComponent(
  startId: string,
  pairGraph: Map<string, Set<string>>,
  processedEntities: Set<string>
): string[] {
  const component: string[] = [];
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (processedEntities.has(current)) continue;
    processedEntities.add(current);
    component.push(current);
    const neighbors = pairGraph.get(current);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (!processedEntities.has(neighbor)) queue.push(neighbor);
    }
  }
  return component;
}

function isClique(component: string[], pairGraph: Map<string, Set<string>>): boolean {
  const n = component.length;
  if (n < 3) return false;
  const expectedEdges = (n * (n - 1)) / 2;
  let actualEdges = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (pairGraph.get(component[i])?.has(component[j])) actualEdges++;
    }
  }
  return actualEdges === expectedEdges;
}

function processCliques(
  cliques: HardState[][],
  rule: EvolutionRule,
  ruleCtx: ReturnType<typeof createSystemContext>,
  acc: ApplyAccumulators
): void {
  for (const clique of cliques) {
    const cliqueId = clique.map(e => e.id).sort((a, b) => a.localeCompare(b)).join(':');

    for (let i = 0; i < clique.length; i++) {
      for (let j = i + 1; j < clique.length; j++) {
        const pairCtx = {
          ...ruleCtx,
          entities: { ...(ruleCtx.entities ?? {}), member: clique[i], member2: clique[j] },
        };
        const result = prepareMutation(rule.action as Mutation, pairCtx);
        mergeMutationResult(result, acc.modifications, acc.relationships, acc.relationshipsAdjusted, acc.pressureChanges, cliqueId);
      }
    }

    generateCliqueNarration(clique, cliqueId, rule, acc.narrationsByGroup);
  }
}

function generateCliqueNarration(
  clique: HardState[],
  cliqueId: string,
  rule: EvolutionRule,
  narrationsByGroup: Record<string, string>
): void {
  if (rule.multiPartyNarrationTemplate) {
    const names = clique.map(e => e.name).join(', ');
    narrationsByGroup[cliqueId] = rule.multiPartyNarrationTemplate
      .replace('{names}', names)
      .replace('{count}', String(clique.length));
  } else if (rule.narrationTemplate) {
    const names = clique.map(e => e.name).join(', ');
    narrationsByGroup[cliqueId] = `${names} formed mutual relationships.`;
  }
}

function processNonCliquePairs(
  nonCliquePairs: Array<{ src: HardState; dst: HardState }>,
  rule: EvolutionRule,
  ruleCtx: ReturnType<typeof createSystemContext>,
  acc: ApplyAccumulators
): void {
  for (const { src, dst } of nonCliquePairs) {
    const pairCtx = {
      ...ruleCtx,
      entities: { ...(ruleCtx.entities ?? {}), member: src, member2: dst },
    };
    const result = prepareMutation(rule.action as Mutation, pairCtx);
    mergeMutationResult(result, acc.modifications, acc.relationships, acc.relationshipsAdjusted, acc.pressureChanges, src.id);

    if (rule.narrationTemplate && result.applied) {
      const narrationCtx = createSystemRuleContext({ member: src, member2: dst });
      const narrationResult = interpolate(rule.narrationTemplate, narrationCtx);
      if (narrationResult.complete) {
        acc.narrationsByGroup[src.id] = narrationResult.text;
      }
    }
  }
}

function processBetweenMatchingRules(
  matchingByRule: Map<number, HardState[]>,
  config: ConnectionEvolutionConfig,
  graphView: WorldRuntime,
  ruleCtx: ReturnType<typeof createSystemContext>,
  acc: ApplyAccumulators
): void {
  const adjacency = buildAdjacencyMap(graphView, config.pairComponentSizeLimit);

  for (const [ruleIdx, matchingEntities] of matchingByRule.entries()) {
    const rule = config.rules[ruleIdx];
    if (rule.action.type !== 'create_relationship') continue;

    const { validPairs, pairGraph } = collectValidPairs(
      matchingEntities, rule, config, graphView, adjacency
    );

    const { cliques, nonCliquePairs } = findComponentsAndCliques(
      pairGraph, validPairs, matchingEntities
    );

    processCliques(cliques, rule, ruleCtx, acc);
    processNonCliquePairs(nonCliquePairs, rule, ruleCtx, acc);
  }
}

function applyConnectionEvolution(
  config: ConnectionEvolutionConfig,
  graphView: WorldRuntime,
  modifier: number
): SystemResult {
  if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
    // eslint-disable-next-line sonarjs/pseudo-random -- simulation throttle check
    if (Math.random() > config.throttleChance) {
      return createThrottledResult(config.name);
    }
  }

  const acc: ApplyAccumulators = {
    modifications: [],
    relationships: [],
    relationshipsAdjusted: [],
    pressureChanges: {},
    narrationsByGroup: {},
  };

  const ruleCtx = createSystemContext(graphView);
  const entities = selectEntities(config.selection, ruleCtx);
  const matchingByRule = new Map<number, HardState[]>();

  for (const entity of entities) {
    const metricValue = applySubtypeBonus(
      calculateMetric(entity, config.metric, ruleCtx),
      entity,
      config.subtypeBonuses
    );
    evaluateEntityRules(entity, metricValue, config, ruleCtx, modifier, matchingByRule, acc);
  }

  processBetweenMatchingRules(matchingByRule, config, graphView, ruleCtx, acc);

  if (acc.modifications.length > 0 || acc.relationships.length > 0 || acc.relationshipsAdjusted.length > 0) {
    for (const [pressureId, delta] of Object.entries(config.pressureChanges ?? {})) {
      acc.pressureChanges[pressureId] = (acc.pressureChanges[pressureId] || 0) + delta;
    }
  }

  return {
    relationshipsAdded: acc.relationships,
    relationshipsAdjusted: acc.relationshipsAdjusted,
    entitiesModified: acc.modifications as SystemResult['entitiesModified'],
    pressureChanges: acc.pressureChanges,
    description: `${config.name}: ${acc.modifications.length} modified, ${acc.relationships.length} relationships`,
    narrationsByGroup: Object.keys(acc.narrationsByGroup).length > 0 ? acc.narrationsByGroup : undefined,
  };
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
      return applyConnectionEvolution(config, graphView, modifier);
    }
  };
}

