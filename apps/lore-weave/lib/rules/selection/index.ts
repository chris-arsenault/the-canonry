/**
 * Unified Selection Helpers
 *
 * Shared selection logic for templates, actions, and systems.
 */

import { HardState } from '../../core/worldTypes';
import { hasTag, pickRandom } from '../../utils';
import type { RuleContext } from '../context';
import { applySelectionFilters } from '../filters';
import { normalizeDirection, prominenceIndex, prominenceThreshold, ProminenceLabel } from '../types';
import type {
  EntitySelectionCriteria,
  SelectionRule,
  VariableSelectionRule,
  SaturationLimit,
  PathBasedSpec,
  PathTraversalStep,
} from './types';
import type { SelectionFilter } from '../filters/types';

export interface SelectionTraceStep {
  description: string;
  remaining: number;
}

export interface SelectionTrace {
  steps: SelectionTraceStep[];
}

function pushTrace(trace: SelectionTrace | undefined, description: string, remaining: number): void {
  if (!trace) return;
  trace.steps.push({ description, remaining });
}

export function describeSelectionFilter(filter: SelectionFilter): string {
  switch (filter.type) {
    case 'exclude':
      return `exclude [${filter.entities.join(', ')}]`;
    case 'has_relationship':
      return `has_relationship '${filter.kind}'${filter.with ? ` with ${filter.with}` : ''}`;
    case 'lacks_relationship':
      return `lacks_relationship '${filter.kind}'${filter.with ? ` with ${filter.with}` : ''}`;
    case 'has_tag':
      return `has_tag '${filter.tag}'${filter.value !== undefined ? ` = ${filter.value}` : ''}`;
    case 'has_tags':
      return `has_tags [${filter.tags.join(', ')}]`;
    case 'has_any_tag':
      return `has_any_tag [${filter.tags.join(', ')}]`;
    case 'lacks_tag':
      return `lacks_tag '${filter.tag}'${filter.value !== undefined ? ` = ${filter.value}` : ''}`;
    case 'lacks_any_tag':
      return `lacks_any_tag [${filter.tags.join(', ')}]`;
    case 'has_culture':
      return `has_culture '${filter.culture}'`;
    case 'matches_culture':
      return `matches_culture with ${filter.with}`;
    case 'not_matches_culture':
      return `not_matches_culture with ${filter.with}`;
    case 'has_status':
      return `has_status '${filter.status}'`;
    case 'has_prominence':
      return `has_prominence >= ${filter.minProminence}`;
    case 'shares_related':
      return `shares_related '${filter.relationshipKind}' with ${filter.with}`;
    case 'graph_path':
      return `graph_path ${filter.assert.check}`;
    default:
      return 'unknown filter';
  }
}

/**
 * Apply base selection criteria to a set of entities.
 */
export function applyEntityCriteria(
  entities: HardState[],
  criteria: EntitySelectionCriteria
): HardState[] {
  let result = entities;

  if (criteria.kind) {
    result = result.filter((e) => e.kind === criteria.kind);
  }

  if (criteria.kinds && criteria.kinds.length > 0) {
    result = result.filter((e) => criteria.kinds!.includes(e.kind));
  }

  if (criteria.subtypes && criteria.subtypes.length > 0) {
    result = result.filter((e) => criteria.subtypes!.includes(e.subtype));
  }

  if (criteria.excludeSubtypes && criteria.excludeSubtypes.length > 0) {
    result = result.filter((e) => !criteria.excludeSubtypes!.includes(e.subtype));
  }

  if (criteria.status) {
    result = result.filter((e) => e.status === criteria.status);
  }

  if (criteria.statuses && criteria.statuses.length > 0) {
    result = result.filter((e) => criteria.statuses!.includes(e.status));
  }

  if (criteria.notStatus) {
    result = result.filter((e) => e.status !== criteria.notStatus);
  }

  if (criteria.hasTag) {
    result = result.filter((e) => hasTag(e.tags, criteria.hasTag!));
  }

  if (criteria.notHasTag) {
    result = result.filter((e) => !hasTag(e.tags, criteria.notHasTag!));
  }

  return result;
}

/**
 * Apply prefer filters to an entity list, falling back to the original list.
 */
export function applyPreferFilters(
  entities: HardState[],
  filters: SelectionFilter[] | undefined,
  ctx: RuleContext,
  trace?: SelectionTrace
): HardState[] {
  if (!filters || filters.length === 0) return entities;

  let preferred = entities;
  for (const filter of filters) {
    preferred = applySelectionFilters(preferred, [filter], ctx.resolver);
  }

  if (preferred.length > 0) {
    pushTrace(trace, 'prefer filters matched', preferred.length);
    return preferred;
  }

  pushTrace(trace, 'prefer filters (no match, using all)', entities.length);
  return entities;
}

/**
 * Apply pick strategy to an entity list.
 * Always returns an array (possibly length 0 or 1).
 */
function sampleRandom(entities: HardState[], count: number): HardState[] {
  if (count <= 0 || entities.length === 0) return [];
  const pool = entities.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function getProminenceWeight(entity: HardState): number {
  const weight = prominenceIndex(entity.prominence) + 1;
  return weight > 0 ? weight : 1;
}

function pickWeighted(entities: HardState[]): HardState | undefined {
  if (entities.length === 0) return undefined;
  const weights = entities.map(getProminenceWeight);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < entities.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return entities[i];
  }
  return entities[entities.length - 1];
}

function sampleWeighted(entities: HardState[], count: number): HardState[] {
  if (count <= 0 || entities.length === 0) return [];
  const pool = entities.slice();
  const picks: HardState[] = [];
  const limit = Math.min(count, pool.length);
  for (let i = 0; i < limit; i++) {
    const picked = pickWeighted(pool);
    if (!picked) break;
    picks.push(picked);
    const idx = pool.indexOf(picked);
    if (idx >= 0) pool.splice(idx, 1);
  }
  return picks;
}

const CULTURE_MATCH_BOOST = 2.0;
const CULTURE_MISMATCH_PENALTY = 0.5;
const HUB_PENALTY_THRESHOLD = 5;
const HUB_PENALTY_EXPONENT = 0.5;

function resolveCultureAnchor(ctx: RuleContext): HardState | undefined {
  return ctx.self
    ?? ctx.resolver.resolveEntity('$actor')
    ?? ctx.resolver.resolveEntity('$target')
    ?? ctx.resolver.resolveEntity('$instigator')
    ?? ctx.resolver.resolveEntity('$source');
}

function calculateHubPenalty(entity: HardState, ctx: RuleContext): number {
  const totalLinks = ctx.graph.getEntityRelationships(entity.id, 'both').length;
  if (totalLinks <= HUB_PENALTY_THRESHOLD) return 1.0;
  const over = totalLinks - HUB_PENALTY_THRESHOLD;
  return 1 / (1 + Math.pow(over, HUB_PENALTY_EXPONENT));
}

function computeBiasedWeight(
  entity: HardState,
  ctx: RuleContext,
  baseWeight: number,
  anchorCulture?: string
): number {
  let weight = baseWeight * calculateHubPenalty(entity, ctx);
  if (anchorCulture) {
    weight *= entity.culture === anchorCulture ? CULTURE_MATCH_BOOST : CULTURE_MISMATCH_PENALTY;
  }
  return weight;
}

function sampleWeightedByScore(
  entities: HardState[],
  weights: number[],
  count: number
): HardState[] {
  if (count <= 0 || entities.length === 0) return [];
  const pool = entities.map((entity, index) => ({
    entity,
    weight: Math.max(0, weights[index] || 0)
  }));
  const picks: HardState[] = [];
  const limit = Math.min(count, pool.length);

  for (let i = 0; i < limit; i++) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) {
      const remaining = pool.map(item => item.entity);
      return picks.concat(sampleRandom(remaining, limit - picks.length));
    }
    let roll = Math.random() * total;
    let pickedIndex = -1;
    for (let idx = 0; idx < pool.length; idx++) {
      roll -= pool[idx].weight;
      if (roll <= 0) {
        pickedIndex = idx;
        break;
      }
    }
    if (pickedIndex < 0) {
      pickedIndex = pool.length - 1;
    }
    const picked = pool.splice(pickedIndex, 1)[0];
    picks.push(picked.entity);
  }

  return picks;
}

function applyPickStrategyWithBias(
  entities: HardState[],
  rule: SelectionRule,
  ctx: RuleContext
): HardState[] {
  const limit = rule.maxResults && rule.maxResults > 0
    ? Math.min(rule.maxResults, entities.length)
    : undefined;
  const pickStrategy = rule.pickStrategy;
  const shouldBias = (rule.strategy === 'by_kind' || rule.strategy === 'by_preference_order')
    && (pickStrategy === 'random' || pickStrategy === 'weighted');

  if (!shouldBias) {
    return applyPickStrategy(entities, pickStrategy, rule.maxResults);
  }

  const anchorCulture = resolveCultureAnchor(ctx)?.culture;
  const baseWeights = entities.map(entity => (
    pickStrategy === 'weighted' ? getProminenceWeight(entity) : 1
  ));
  const weights = entities.map((entity, idx) => computeBiasedWeight(entity, ctx, baseWeights[idx], anchorCulture));
  const count = limit ?? 1;
  return sampleWeightedByScore(entities, weights, count);
}

export function applyPickStrategy(
  entities: HardState[],
  pickStrategy: SelectionRule['pickStrategy'] | VariableSelectionRule['pickStrategy'] | undefined,
  maxResults?: number
): HardState[] {
  const limit = maxResults && maxResults > 0 ? Math.min(maxResults, entities.length) : undefined;

  switch (pickStrategy) {
    case 'random':
      return limit ? sampleRandom(entities, limit) : (entities.length > 0 ? [pickRandom(entities)] : []);
    case 'weighted':
      if (limit) return sampleWeighted(entities, limit);
      const picked = pickWeighted(entities);
      return picked ? [picked] : [];
    case 'first':
      return limit ? entities.slice(0, limit) : entities.slice(0, 1);
    case 'all':
      return limit ? entities.slice(0, limit) : entities;
    default:
      return limit ? entities.slice(0, limit) : entities;
  }
}

/**
 * Apply saturation limits to filter out entities that have too many relationships.
 * Counts unique connected entities, not raw relationships.
 * This handles bidirectional relationships correctly (A→B and B→A count as one connection).
 */
export function applySaturationLimits(
  entities: HardState[],
  limits: SaturationLimit[] | undefined,
  ctx: RuleContext
): HardState[] {
  if (!limits || limits.length === 0) return entities;

  return entities.filter((entity) => {
    for (const limit of limits) {
      const relationships = ctx.graph.getRelationships(entity.id, limit.relationshipKind);

      // Use a Set to count unique connected entities, not raw relationships
      // This correctly handles bidirectional relationships stored as two records
      const connectedEntities = new Set<string>();

      for (const rel of relationships) {
        const otherId = rel.src === entity.id ? rel.dst : rel.src;
        if (limit.fromKind) {
          const otherEntity = ctx.graph.getEntity(otherId);
          if (!otherEntity || otherEntity.kind !== limit.fromKind) continue;
          if (limit.fromSubtype && otherEntity.subtype !== limit.fromSubtype) continue;
        }
        connectedEntities.add(otherId);
      }

      if (connectedEntities.size >= limit.maxCount) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Select entities using a SelectionRule.
 */
export function selectEntities(
  rule: SelectionRule,
  ctx: RuleContext,
  trace?: SelectionTrace
): HardState[] {
  const graphView = ctx.graph;
  let entities: HardState[];
  const kinds = rule.kinds && rule.kinds.length > 0 ? rule.kinds : (rule.kind ? [rule.kind] : []);
  const kindLabel = kinds.length > 0 ? kinds.join('|') : 'any';

  // Include historical entities if the rule explicitly asks for them
  const needsHistorical = rule.status === 'historical' || rule.statuses?.includes('historical');

  const getCandidatesByKind = (): HardState[] => {
    if (kinds.length === 0 || kinds.includes('any')) {
      return graphView.getEntities({ includeHistorical: needsHistorical });
    }
    if (kinds.length === 1 && rule.kind && (!rule.kinds || rule.kinds.length === 0)) {
      return graphView.findEntities({ kind: rule.kind, includeHistorical: needsHistorical });
    }
    return graphView.getEntities({ includeHistorical: needsHistorical }).filter((e) => kinds.includes(e.kind));
  };

  switch (rule.strategy) {
    case 'by_kind': {
      entities = getCandidatesByKind();
      pushTrace(trace, `kind=${kindLabel}`, entities.length);
      break;
    }

    case 'by_preference_order': {
      entities = [];
      const allEntities = getCandidatesByKind();
      for (const subtype of rule.subtypePreferences || []) {
        const matches = allEntities.filter((e) => e.subtype === subtype);
        if (matches.length > 0) {
          entities = matches;
          break;
        }
      }
      if (entities.length === 0) {
        entities = allEntities;
      }
      pushTrace(trace, `preference_order=${kindLabel}`, entities.length);
      break;
    }

    case 'by_relationship': {
      const allEntities = getCandidatesByKind();
      const direction = normalizeDirection(rule.direction);
      const mustHave = rule.mustHave === true;
      entities = allEntities.filter((entity) => {
        const relationships = ctx.graph.getRelationships(entity.id, rule.relationshipKind);
        const hasRel = relationships.some((link) => {
          if (direction === 'src') return link.src === entity.id;
          if (direction === 'dst') return link.dst === entity.id;
          return link.src === entity.id || link.dst === entity.id;
        });
        return mustHave ? hasRel : !hasRel;
      });
      pushTrace(trace, `relationship=${rule.relationshipKind ?? 'any'}`, entities.length);
      break;
    }

    case 'by_proximity': {
      const refEntity = ctx.resolver.resolveEntity(rule.referenceEntity || '$target');
      if (!refEntity?.coordinates) {
        entities = [];
        pushTrace(trace, 'proximity: no reference coordinates', 0);
        break;
      }
      const maxDist = rule.maxDistance || 50;
      entities = getCandidatesByKind().filter((e) => {
        if (!e.coordinates) return false;
        const dx = e.coordinates.x - refEntity.coordinates!.x;
        const dy = e.coordinates.y - refEntity.coordinates!.y;
        const dz = e.coordinates.z - refEntity.coordinates!.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= maxDist;
      });
      pushTrace(trace, `proximity<=${maxDist}`, entities.length);
      break;
    }

    case 'by_prominence': {
      const minLabel = (rule.minProminence || 'marginal') as ProminenceLabel;
      const minThreshold = prominenceThreshold(minLabel);
      entities = getCandidatesByKind().filter((e) => {
        return e.prominence >= minThreshold;
      });
      pushTrace(trace, `prominence>=${rule.minProminence ?? 'marginal'}`, entities.length);
      break;
    }

    default:
      entities = [];
      pushTrace(trace, 'unknown strategy', 0);
  }

  if (rule.subtypes && rule.subtypes.length > 0) {
    entities = entities.filter((e) => rule.subtypes!.includes(e.subtype));
    pushTrace(trace, `subtype in [${rule.subtypes.join(', ')}]`, entities.length);
  }

  if (rule.excludeSubtypes && rule.excludeSubtypes.length > 0) {
    entities = entities.filter((e) => !rule.excludeSubtypes!.includes(e.subtype));
    pushTrace(trace, `subtype not in [${rule.excludeSubtypes.join(', ')}]`, entities.length);
  }

  if (rule.status) {
    entities = entities.filter((e) => e.status === rule.status);
    pushTrace(trace, `status=${rule.status}`, entities.length);
  }

  if (rule.statuses && rule.statuses.length > 0) {
    entities = entities.filter((e) => rule.statuses!.includes(e.status));
    pushTrace(trace, `status in [${rule.statuses.join(', ')}]`, entities.length);
  }

  if (rule.notStatus) {
    entities = entities.filter((e) => e.status !== rule.notStatus);
    pushTrace(trace, `status!=${rule.notStatus}`, entities.length);
  }

  if (rule.filters && rule.filters.length > 0) {
    for (const filter of rule.filters) {
      entities = applySelectionFilters(entities, [filter], ctx.resolver);
      pushTrace(trace, describeSelectionFilter(filter), entities.length);
    }
  }

  entities = applySaturationLimits(entities, rule.saturationLimits, ctx);

  return applyPickStrategyWithBias(entities, rule, ctx);
}

/**
 * Type guard to check if a from spec is a path-based spec.
 */
function isPathBasedSpec(from: VariableSelectionRule['from']): from is PathBasedSpec {
  return typeof from === 'object' && from !== null && 'path' in from;
}

/**
 * Traverse a multi-hop path starting from entities.
 */
function traversePath(
  startEntities: HardState[],
  steps: PathTraversalStep[],
  ctx: RuleContext,
  trace?: SelectionTrace
): HardState[] {
  const graphView = ctx.graph;
  let currentEntities = startEntities;

  for (const step of steps) {
    const nextEntities: HardState[] = [];
    const direction = normalizeDirection(step.direction);

    for (const entity of currentEntities) {
      const related = graphView.getConnectedEntities(entity.id, step.via, direction);
      for (const r of related) {
        // Apply step filters
        if (step.targetKind && step.targetKind !== 'any' && r.kind !== step.targetKind) continue;
        if (step.targetSubtype && step.targetSubtype !== 'any' && r.subtype !== step.targetSubtype) continue;
        if (step.targetStatus && step.targetStatus !== 'any' && r.status !== step.targetStatus) continue;
        nextEntities.push(r);
      }
    }

    pushTrace(trace, `via ${step.via}: ${currentEntities.length} -> ${nextEntities.length}`, nextEntities.length);
    currentEntities = nextEntities;

    if (currentEntities.length === 0) {
      return [];
    }
  }

  return currentEntities;
}

/**
 * Select candidates for a variable selection rule.
 */
export function selectVariableEntities(
  select: VariableSelectionRule,
  ctx: RuleContext,
  trace?: SelectionTrace
): HardState[] {
  const graphView = ctx.graph;
  let entities: HardState[];

  // Include historical entities if the rule explicitly asks for them
  const needsHistorical = select.status === 'historical' || select.statuses?.includes('historical');

  if (select.from && select.from !== 'graph') {
    // Check if this is a path-based traversal
    if (isPathBasedSpec(select.from)) {
      // Path-based traversal: follow multiple hops
      const steps = select.from.path;
      if (steps.length === 0) {
        pushTrace(trace, 'empty path', 0);
        return [];
      }

      // Get starting entities from first step's 'from' field
      const firstStep = steps[0];
      let startEntities: HardState[];

      if (firstStep.from) {
        const startEntity = ctx.resolver.resolveEntity(firstStep.from);
        if (!startEntity) {
          pushTrace(trace, `path start ${firstStep.from} (not found)`, 0);
          return [];
        }
        startEntities = [startEntity];
        pushTrace(trace, `path start: ${startEntity.name || startEntity.id}`, 1);
      } else {
        // No 'from' on first step - use all entities matching kind filters
        startEntities = graphView.getEntities({ includeHistorical: needsHistorical });
        pushTrace(trace, 'path start: all entities', startEntities.length);
      }

      // Traverse the path
      entities = traversePath(startEntities, steps, ctx, trace);
    } else {
      // Single-hop related entities (legacy format)
      const relatedTo = ctx.resolver.resolveEntity(select.from.relatedTo);
      if (!relatedTo) {
        pushTrace(trace, `related to ${select.from.relatedTo} (not found)`, 0);
        return [];
      }
      const direction = normalizeDirection(select.from.direction);
      entities = graphView.getConnectedEntities(
        relatedTo.id,
        select.from.relationshipKind,
        direction
      );
      pushTrace(trace, `via ${select.from.relationshipKind} from ${relatedTo.name || relatedTo.id}`, entities.length);
    }
  } else {
    if (select.kinds && select.kinds.length > 0) {
      entities = graphView.getEntities({ includeHistorical: needsHistorical }).filter((e) => select.kinds!.includes(e.kind));
      pushTrace(trace, `${select.kinds.join('|')} entities`, entities.length);
    } else if (select.kind) {
      entities = graphView.findEntities({ kind: select.kind, includeHistorical: needsHistorical });
      pushTrace(trace, `${select.kind} entities`, entities.length);
    } else {
      entities = graphView.getEntities({ includeHistorical: needsHistorical });
      pushTrace(trace, 'all entities', entities.length);
    }
  }

  if (select.kinds && select.kinds.length > 0) {
    entities = entities.filter((e) => select.kinds!.includes(e.kind));
    pushTrace(trace, `kind in [${select.kinds.join(', ')}]`, entities.length);
  } else if (select.kind) {
    entities = entities.filter((e) => e.kind === select.kind);
    pushTrace(trace, `kind=${select.kind}`, entities.length);
  }

  if (select.subtypes && select.subtypes.length > 0) {
    entities = entities.filter((e) => select.subtypes!.includes(e.subtype));
    pushTrace(trace, `subtype in [${select.subtypes.join(', ')}]`, entities.length);
  }

  if (select.status) {
    entities = entities.filter((e) => e.status === select.status);
    pushTrace(trace, `status=${select.status}`, entities.length);
  }

  if (select.statuses && select.statuses.length > 0) {
    entities = entities.filter((e) => select.statuses!.includes(e.status));
    pushTrace(trace, `status in [${select.statuses.join(', ')}]`, entities.length);
  }

  if (select.notStatus) {
    entities = entities.filter((e) => e.status !== select.notStatus);
    pushTrace(trace, `status!=${select.notStatus}`, entities.length);
  }

  if (select.filters && select.filters.length > 0) {
    for (const filter of select.filters) {
      entities = applySelectionFilters(entities, [filter], ctx.resolver);
      pushTrace(trace, describeSelectionFilter(filter), entities.length);
    }
  }

  return applyPreferFilters(entities, select.preferFilters, ctx, trace);
}

/**
 * Resolve a single variable selection.
 *
 * This is the core variable resolution function used by both templateInterpreter
 * and thresholdTrigger systems.
 *
 * @param select - Variable selection rule
 * @param ctx - Rule context with graph, resolver, and any bound entities
 * @returns Single entity, array of entities, or undefined if no matches
 */
export function resolveSingleVariable(
  select: VariableSelectionRule,
  ctx: RuleContext
): HardState | HardState[] | undefined {
  const candidates = selectVariableEntities(select, ctx);

  if (candidates.length === 0) {
    return undefined;
  }

  const pickStrategy = select.pickStrategy ?? 'random';
  const picked = applyPickStrategy(candidates, pickStrategy, select.maxResults);

  if (pickStrategy === 'all' || (select.maxResults && select.maxResults > 1)) {
    return picked;
  }
  return picked[0];
}

/**
 * Variable definition for resolution.
 */
export interface VariableDefinitionForResolution {
  select: VariableSelectionRule;
  required?: boolean;
}

/**
 * Resolve a set of variables for a given self entity.
 *
 * Variables are resolved in order, and each resolved variable becomes available
 * to subsequent variable selections (allowing $var1 to reference $var2 if $var2
 * was defined earlier).
 *
 * This is a convenience wrapper around resolveSingleVariable for systems that
 * need to resolve all variables at once.
 *
 * @param variables - Map of variable names to definitions
 * @param baseCtx - Base rule context (should have graph and resolver)
 * @param self - The entity to bind as $self
 * @returns Record of resolved variables, or null if any required variable couldn't be resolved
 */
export function resolveVariablesForEntity(
  variables: Record<string, VariableDefinitionForResolution>,
  baseCtx: RuleContext,
  self: HardState
): Record<string, HardState> | null {
  const resolved: Record<string, HardState> = {};

  // Create a resolver that can resolve $self and previously resolved variables
  const createResolvingContext = (): RuleContext => ({
    ...baseCtx,
    self,
    entities: { ...baseCtx.entities, self, ...resolved },
    resolver: {
      resolveEntity: (ref: string): HardState | undefined => {
        if (ref === '$self') return self;
        if (ref.startsWith('$')) {
          const name = ref.slice(1);
          if (resolved[name]) return resolved[name];
          if (name === 'self') return self;
        }
        return baseCtx.resolver.resolveEntity(ref);
      },
      getGraphView: () => baseCtx.resolver.getGraphView(),
      setPathSet: (name: string, ids: Set<string>) => baseCtx.resolver.setPathSet(name, ids),
      getPathSet: (name: string) => baseCtx.resolver.getPathSet(name),
    },
  });

  // Resolve variables in order
  for (const [varName, varDef] of Object.entries(variables)) {
    // Strip leading $ from variable name for storage
    const cleanName = varName.startsWith('$') ? varName.slice(1) : varName;

    const ctx = createResolvingContext();
    const result = resolveSingleVariable(varDef.select, ctx);

    if (!result || (Array.isArray(result) && result.length === 0)) {
      if (varDef.required) {
        // Required variable not found - skip this entity
        return null;
      }
      // Optional variable not found - continue without it
      continue;
    }

    // For system variables, we only support single entities
    resolved[cleanName] = Array.isArray(result) ? result[0] : result;
  }

  return resolved;
}

export * from './types';
