import {
  SimulationSystem,
  SystemResult,
  Era,
  TransitionCondition,
  ActionContext,
  entityCriteria } from '../engine/types';
import { HardState } from '../core/worldTypes';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_STATUS,
  FRAMEWORK_RELATIONSHIP_KINDS,
  FRAMEWORK_TAGS
} from '@canonry/world-schema';
import { WorldRuntime } from '../runtime/worldRuntime';
import type { EraTransitionConfig } from '../engine/systemInterpreter';
import { createEraEntity } from './eraSpawner';
import { createSystemContext, evaluateCondition, prepareMutation } from '../rules';
import type { ConditionResult } from '../rules';
import { prominenceThreshold, ProminenceLabel } from '../rules/types';
import { hasTag } from '../utils';

/**
 * Era Transition System
 *
 * Framework-level system that handles era transitions based on exit/entry conditions.
 *
 * TRANSITION MODEL:
 * - exitConditions: Criteria for current era to END (all must be met)
 * - entryConditions: Criteria for next era to START (all must be met)
 * - nextEra: Optional explicit next era ID (supports divergent paths)
 * - exitEffects: Applied when transitioning OUT of current era
 * - entryEffects: Applied when transitioning INTO next era
 *
 * LAZY SPAWNING:
 * - Era entities are created on-demand when transitioned into
 * - Only the first era is spawned at init (by eraSpawner)
 *
 * Transition Logic:
 * 1. Check exitConditions for current era
 * 2. If met, find next era:
 *    a. If nextEra is set, use that specific era
 *    b. Otherwise, find first era whose entryConditions are met
 * 3. Spawn the next era entity (lazy spawning)
 * 4. Apply exitEffects, then entryEffects
 * 5. Update current era status to 'historical', new era to 'current'
 */

/**
 * Create an Era Transition system with the given configuration.
 */
class EraTransitionSystem implements SimulationSystem {
  readonly id: string;
  readonly name: string;
  state: unknown = null;
  private readonly config: EraTransitionConfig;

  constructor(config: EraTransitionConfig) {
    this.id = config.id || 'era_transition';
    this.name = config.name || 'Era Progression';
    this.config = config;
  }

  initialize(): void { /* no-op */ }

  apply(graphView: WorldRuntime, _modifier: number = 1.0): SystemResult {
    const currentEra = this.findCurrentEra(graphView);
    if (!currentEra) return this.noResult('No current era');

    const currentConfig = graphView.config.eras.find(e => e.id === currentEra.subtype);
    if (!currentConfig) {
      graphView.log('warn', `[EraTransition] No config for "${currentEra.name}"`, { availableEras: graphView.config.eras.map(e => e.id) });
      return this.noResult(`${currentEra.name} persists (config not found)`);
    }

    const timeSinceStart = graphView.tick - currentEra.temporal.startTick;
    const { shouldTransition, conditionResults } = checkTransitionConditions(currentEra, graphView, currentConfig.exitConditions);

    if (!shouldTransition) {
      this.logConditionStatus(graphView, currentEra, timeSinceStart, conditionResults, false);
      return this.noResult(`${currentEra.name} persists`);
    }

    const nextConfig = findNextEra(currentConfig, currentEra, graphView);
    if (!nextConfig) {
      graphView.debug('eras', `${currentEra.name}: final era or no valid next era`);
      return this.noResult(`${currentEra.name} endures (final era)`);
    }

    this.logConditionStatus(graphView, currentEra, timeSinceStart, conditionResults, true);
    return this.executeTransition(graphView, currentEra, currentConfig, nextConfig, timeSinceStart, conditionResults);
  }

  // --- Private helpers ---

  private findCurrentEra(graphView: WorldRuntime): HardState | undefined {
    const eras = graphView.findEntities(entityCriteria({ kind: FRAMEWORK_ENTITY_KINDS.ERA, status: FRAMEWORK_STATUS.CURRENT }));
    if (eras.length === 0) graphView.debug('eras', 'No current era found');
    return eras[0];
  }

  private logConditionStatus(
    graphView: WorldRuntime, era: HardState, age: number,
    results: TransitionConditionResult[], met: boolean
  ): void {
    const summary = results.map(r => `${r.passed ? '✓' : '✗'} ${r.type}: ${r.diagnostic}`).join(' | ');
    graphView.debug('eras', `${era.name}: exit conditions ${met ? 'MET' : 'not met'} (age=${age}) [${summary}]`, { eraAge: age, conditionResults: results });
  }

  private executeTransition(
    graphView: WorldRuntime, currentEra: HardState, currentConfig: Era,
    nextConfig: Era, timeSinceStart: number, conditionResults: TransitionConditionResult[]
  ): SystemResult {
    const ctx: ActionContext = { source: 'framework', sourceId: this.id, success: true };
    const narrativeGroupId = `era_transition:${currentConfig.id}:${nextConfig.id}`;

    // Spawn next era entity
    const { entity: nextEra } = createEraEntity(nextConfig, graphView.tick, FRAMEWORK_STATUS.CURRENT, nextConfig.id);
    graphView.loadEntity(nextEra);

    // End current era
    currentEra.status = FRAMEWORK_STATUS.HISTORICAL;
    currentEra.temporal.end = { occurred: true, tick: graphView.tick };
    currentEra.updatedAt = graphView.tick;
    graphView.setCurrentEra(nextConfig);

    graphView.debug('eras', `TRANSITIONING: ${currentEra.name} → ${nextEra.name}`, { tick: graphView.tick, fromEra: currentEra.subtype, toEra: nextEra.subtype });

    // Collect pressure effects
    const pressureChanges = this.collectPressureChanges(graphView, currentConfig, nextConfig, currentEra, nextEra);

    // Build relationships
    const relationshipsAdded = this.buildTransitionRelationships(graphView, currentEra, nextEra, ctx);

    // Prominence snapshot
    const { modifications, lockedCount } = this.snapshotProminence(graphView, currentConfig);

    return {
      relationshipsAdded,
      relationshipsAdjusted: [],
      relationshipsToArchive: [],
      entitiesModified: [
        { id: currentEra.id, changes: { status: FRAMEWORK_STATUS.HISTORICAL, temporal: currentEra.temporal }, actionContext: ctx, narrativeGroupId },
        ...modifications.map(m => ({ ...m, actionContext: ctx, narrativeGroupId })),
      ],
      pressureChanges,
      description: `Era transition: ${currentEra.name} → ${nextEra.name} (${relationshipsAdded.length - 1} entities linked, ${lockedCount} prominence locked)`,
      details: {
        eraTransition: {
          fromEra: currentEra.name, fromEraId: currentConfig.id,
          toEra: nextEra.name, toEraId: nextConfig.id,
          tickInEra: timeSinceStart,
          exitConditionsMet: conditionResults.filter(r => r.passed).map(r => ({ type: r.type, ...r.details })),
          prominentEntitiesLinked: relationshipsAdded.length - 1,
          prominenceLocked: lockedCount,
          pressureEffects: pressureChanges,
        },
      },
      narrationsByGroup: {},
    };
  }

  private collectPressureChanges(
    graphView: WorldRuntime, currentConfig: Era, nextConfig: Era,
    currentEra: HardState, nextEra: HardState
  ): Record<string, number> {
    const changes: Record<string, number> = {};
    for (const [id, delta] of Object.entries(collectEffectPressureChanges(graphView, currentConfig.exitEffects, currentEra))) {
      changes[id] = (changes[id] || 0) + delta;
    }
    for (const [id, delta] of Object.entries(collectEffectPressureChanges(graphView, nextConfig.entryEffects, nextEra))) {
      changes[id] = (changes[id] || 0) + delta;
    }
    return changes;
  }

  private buildTransitionRelationships(
    graphView: WorldRuntime, currentEra: HardState, nextEra: HardState, ctx: ActionContext
  ): SystemResult['relationshipsAdded'] {
    const narrativeGroupId = `era_transition:${currentEra.id}:${nextEra.id}`;
    const rels: SystemResult['relationshipsAdded'] = [{
      kind: FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
      src: nextEra.id, dst: currentEra.id, strength: 1.0, createdAt: graphView.tick,
      actionContext: ctx, narrativeGroupId,
    }];

    // Link prominent entities to ending era
    const prominent = graphView.getEntities().filter(e =>
      e.prominence >= 2.0 && e.kind !== FRAMEWORK_ENTITY_KINDS.ERA &&
      e.createdAt >= currentEra.temporal.startTick && e.createdAt < graphView.tick
    );
    for (const entity of prominent.slice(0, 10)) {
      rels.push({
        kind: FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING,
        src: entity.id, dst: currentEra.id, strength: 1.0, createdAt: graphView.tick,
        actionContext: ctx, narrativeGroupId,
      });
    }
    return rels;
  }

  private snapshotProminence(
    graphView: WorldRuntime, currentConfig: Era
  ): { modifications: Array<{ id: string; changes: Partial<HardState> }>; lockedCount: number } {
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const snapshot = this.config.prominenceSnapshot;
    if (!snapshot.enabled) return { modifications, lockedCount: 0 };

    const minProminence = snapshot.minProminence;
    const minThreshold = prominenceThreshold(minProminence as ProminenceLabel);
    if (minThreshold < 0) return { modifications, lockedCount: 0 };

    const toLock = graphView.getEntities().filter(e =>
      e.kind !== FRAMEWORK_ENTITY_KINDS.ERA && e.prominence >= minThreshold &&
      !hasTag(e.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)
    );
    for (const entity of toLock) {
      const newTags = { ...entity.tags, [FRAMEWORK_TAGS.PROMINENCE_LOCKED]: currentConfig.id };
      graphView.updateEntity(entity.id, { tags: newTags });
      modifications.push({ id: entity.id, changes: { tags: newTags } });
    }
    return { modifications, lockedCount: toLock.length };
  }

  private noResult(description: string): SystemResult {
    return { relationshipsAdded: [], relationshipsAdjusted: [], relationshipsToArchive: [], entitiesModified: [], pressureChanges: {}, description, details: {}, narrationsByGroup: {} };
  }
}

export function createEraTransitionSystem(config: EraTransitionConfig): SimulationSystem {
  return new EraTransitionSystem(config);
}

/**
 * Find the next era to transition to.
 *
 * Logic:
 * 1. If currentEra.nextEra is set, use that specific era (if entry conditions met)
 * 2. Otherwise, search all eras for one whose entryConditions are met
 * 3. Skip eras that already have entities in the graph
 */
function findNextEra(
  currentEraConfig: Era,
  currentEraEntity: HardState,
  graphView: WorldRuntime
): Era | null {
  const allEras = graphView.config.eras;

  // Get set of era IDs that already have entities (including current)
  const existingEraIds = new Set(
    graphView.findEntities(entityCriteria({ kind: FRAMEWORK_ENTITY_KINDS.ERA, includeHistorical: true }))
      .map(e => e.subtype)
  );

  // If explicit nextEra is set, try that first
  if (currentEraConfig.nextEra) {
    const explicitNext = allEras.find(e => e.id === currentEraConfig.nextEra);
    if (explicitNext && !existingEraIds.has(explicitNext.id)) {
      // Check entry conditions
      const { shouldTransition } = checkTransitionConditions(
        currentEraEntity,
        graphView,
        explicitNext.entryConditions
      );
      if (shouldTransition) {
        return explicitNext;
      }
      // Entry conditions not met for explicit next era - log but don't fall through
      graphView.debug('eras',
        `Explicit nextEra "${explicitNext.id}" entry conditions not met`,
        { currentEra: currentEraConfig.id }
      );
    }
  }

  // Search for first candidate era whose entry conditions are met
  for (const candidateEra of allEras) {
    // Skip current era and any era that already has an entity
    if (existingEraIds.has(candidateEra.id)) {
      continue;
    }

    // Check entry conditions (empty = always allow)
    const { shouldTransition } = checkTransitionConditions(
      currentEraEntity,
      graphView,
      candidateEra.entryConditions
    );

    if (shouldTransition) {
      return candidateEra;
    }
  }

  // No valid next era found
  return null;
}

export interface TransitionConditionResult {
  type: string;
  passed: boolean;
  diagnostic: string;
  details: Record<string, unknown>;
}

export interface TransitionCheckResult {
  shouldTransition: boolean;
  conditionResults: TransitionConditionResult[];
}

function collectEffectPressureChanges(
  graphView: WorldRuntime,
  effects: Era['entryEffects']  ,
  self: HardState
): Record<string, number> {
  const mutations = effects.mutations;
  if (mutations.length === 0) return {};

  const baseCtx = createSystemContext(graphView);
  const ctx = { ...baseCtx, self, entities: { ...(baseCtx.entities), self } };
  const pressureChanges: Record<string, number> = {};

  for (const mutation of mutations) {
    const result = prepareMutation(mutation, ctx);
    for (const [pressureId, delta] of Object.entries(result.pressureChanges)) {
      pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
    }
  }

  return pressureChanges;
}

/**
 * Check if conditions are met for era transition.
 * ALL conditions must pass for the check to succeed.
 */
export function checkTransitionConditions(
  currentEra: HardState,
  graphView: WorldRuntime,
  conditions: TransitionCondition[]
): TransitionCheckResult {
  // Empty conditions array = allow immediate transition
  if (conditions.length === 0) {
    return {
      shouldTransition: true,
      conditionResults: [{
        type: 'none',
        passed: true,
        diagnostic: 'empty conditions array - immediate transition',
        details: { reason: 'empty conditions array - immediate transition' }
      }]
    };
  }

  const baseCtx = createSystemContext(graphView);
  const ctx = { ...baseCtx, self: currentEra };

  const conditionResults: TransitionConditionResult[] = conditions.map((condition) => {
    const result: ConditionResult = evaluateCondition(condition, ctx, currentEra);
    return {
      type: condition.type,
      passed: result.passed,
      diagnostic: result.diagnostic,
      details: result.details,
    };
  });

  return {
    shouldTransition: conditionResults.every(r => r.passed),
    conditionResults
  };
}
