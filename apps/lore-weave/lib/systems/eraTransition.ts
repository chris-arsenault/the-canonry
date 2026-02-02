import {
  SimulationSystem,
  SystemResult,
  Era,
  TransitionCondition
} from '../engine/types';
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
export function createEraTransitionSystem(config: EraTransitionConfig): SimulationSystem {
  return {
    id: config.id || 'era_transition',
    name: config.name || 'Era Progression',

    apply: (graphView: WorldRuntime, modifier: number = 1.0): SystemResult => {
      // Find current era entity
      const currentEraEntity = graphView.findEntities({
        kind: FRAMEWORK_ENTITY_KINDS.ERA,
        status: FRAMEWORK_STATUS.CURRENT
      })[0];

      if (!currentEraEntity) {
        // No current era - this shouldn't happen as eraSpawner creates the first era
        graphView.debug('eras', 'No current era found');
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: 'No current era'
        };
      }

      // Initialize temporal tracking if missing
      if (currentEraEntity.temporal?.startTick == null) {
        const startTick = currentEraEntity.createdAt ?? graphView.tick;
        currentEraEntity.temporal = {
          startTick,
          endTick: currentEraEntity.temporal?.endTick ?? null
        };
      }

      const timeSinceStart = graphView.tick - currentEraEntity.temporal.startTick;

      // Get era config for current era
      const currentEraConfig = graphView.config.eras.find(e => e.id === currentEraEntity.subtype) as Era | undefined;

      if (!currentEraConfig) {
        graphView.log('warn',
          `[EraTransition] No era config found for "${currentEraEntity.name}" (subtype="${currentEraEntity.subtype}")`,
          { availableEras: graphView.config.eras.map(e => e.id) }
        );
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEraEntity.name} persists (config not found)`
        };
      }

      const exitConditions = currentEraConfig.exitConditions || [];

      // Check exit conditions
      const { shouldTransition, conditionResults } = checkTransitionConditions(
        currentEraEntity,
        graphView,
        exitConditions
      );

      if (!shouldTransition) {
        // Build detailed condition status string
        const conditionSummary = conditionResults.map(r => {
          const status = r.passed ? '✓' : '✗';
          return `${status} ${r.type}: ${r.diagnostic}`;
        }).join(' | ');

        graphView.debug('eras',
          `${currentEraEntity.name}: exit conditions not met (age=${timeSinceStart}) [${conditionSummary}]`,
          { eraAge: timeSinceStart, conditionResults }
        );
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEraEntity.name} persists`
        };
      }

      // Exit conditions met - find next era
      const nextEraConfig = findNextEra(currentEraConfig, currentEraEntity, graphView);

      if (!nextEraConfig) {
        // No valid next era found - current era continues
        graphView.debug('eras', `${currentEraEntity.name}: final era or no valid next era`);
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${currentEraEntity.name} endures (final era)`
        };
      }

      // Log transition conditions met
      const conditionSummary = conditionResults.map(r => {
        const status = r.passed ? '✓' : '✗';
        return `${status} ${r.type}: ${r.diagnostic}`;
      }).join(' | ');

      graphView.debug('eras',
        `${currentEraEntity.name}: exit conditions MET (age=${timeSinceStart}) [${conditionSummary}]`,
        { eraAge: timeSinceStart, conditionResults }
      );

      // LAZY SPAWNING: Create new era entity
      const { entity: nextEraEntity } = createEraEntity(
        nextEraConfig,
        graphView.tick,
        FRAMEWORK_STATUS.CURRENT,
        currentEraEntity,
        nextEraConfig.id  // Use config ID directly to match history event era field
      );

      // Add new era entity to graph
      graphView.loadEntity(nextEraEntity);

      // Update current era to historical
      currentEraEntity.status = FRAMEWORK_STATUS.HISTORICAL;
      currentEraEntity.temporal!.endTick = graphView.tick;
      currentEraEntity.updatedAt = graphView.tick;

      // Update graph's currentEra reference
      graphView.setCurrentEra(nextEraConfig);

      // Log transition
      graphView.debug('eras', `TRANSITIONING: ${currentEraEntity.name} → ${nextEraEntity.name}`, {
        tick: graphView.tick,
        fromEra: currentEraEntity.subtype,
        toEra: nextEraEntity.subtype
      });

      // Collect pressure changes: exitEffects then entryEffects
      const pressureChanges: Record<string, number> = {};

      const exitPressureChanges = collectEffectPressureChanges(
        graphView,
        currentEraConfig.exitEffects,
        currentEraEntity
      );
      for (const [pressureId, delta] of Object.entries(exitPressureChanges)) {
        pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
      }

      const entryPressureChanges = collectEffectPressureChanges(
        graphView,
        nextEraConfig.entryEffects,
        nextEraEntity
      );
      for (const [pressureId, delta] of Object.entries(entryPressureChanges)) {
        pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
      }

      // Create supersedes relationship
      const relationshipsAdded: any[] = [{
        kind: FRAMEWORK_RELATIONSHIP_KINDS.SUPERSEDES,
        src: nextEraEntity.id,
        dst: currentEraEntity.id,
        strength: 1.0,
        createdAt: graphView.tick
      }];

      // Create active_during relationships for prominent entities in the ending era
      // Prominence >= 2.0 = recognized or higher
      const prominentEntities = graphView.getEntities().filter(e =>
        e.prominence >= 2.0 &&
        e.kind !== FRAMEWORK_ENTITY_KINDS.ERA &&
        e.createdAt >= currentEraEntity.temporal!.startTick &&
        e.createdAt < graphView.tick
      );

      // Link up to 10 most prominent entities to the ending era
      prominentEntities.slice(0, 10).forEach(entity => {
        relationshipsAdded.push({
          kind: FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING,
          src: entity.id,
          dst: currentEraEntity.id,
          strength: 1.0,
          createdAt: graphView.tick
        });
      });

      const snapshotConfig = config.prominenceSnapshot;
      const snapshotModifications: Array<{ id: string; changes: Partial<HardState> }> = [];
      let snapshotLockedCount = 0;

      if (snapshotConfig?.enabled) {
        const minProminence = snapshotConfig.minProminence ?? 'renowned';
        const minThreshold = prominenceThreshold(minProminence as ProminenceLabel);
        if (minThreshold >= 0) {
          const entitiesToLock = graphView.getEntities().filter(e =>
            e.kind !== FRAMEWORK_ENTITY_KINDS.ERA &&
            e.prominence >= minThreshold &&
            !hasTag(e.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)
          );

          entitiesToLock.forEach(entity => {
            const newTags = { ...(entity.tags ?? {}), [FRAMEWORK_TAGS.PROMINENCE_LOCKED]: currentEraConfig.id };
            graphView.updateEntity(entity.id, { tags: newTags });
            snapshotModifications.push({ id: entity.id, changes: { tags: newTags } });
          });
          snapshotLockedCount = entitiesToLock.length;
        }
      }

      return {
        relationshipsAdded,
        entitiesModified: [
          { id: currentEraEntity.id, changes: { status: FRAMEWORK_STATUS.HISTORICAL, temporal: currentEraEntity.temporal } },
          ...snapshotModifications
        ],
        pressureChanges,
        description: `Era transition: ${currentEraEntity.name} → ${nextEraEntity.name} (${prominentEntities.length} entities linked, ${snapshotLockedCount} prominence locked)`,
        details: {
          eraTransition: {
            fromEra: currentEraEntity.name,
            fromEraId: currentEraConfig.id,
            toEra: nextEraEntity.name,
            toEraId: nextEraConfig.id,
            tickInEra: timeSinceStart,
            exitConditionsMet: conditionResults.filter(r => r.passed).map(r => ({
              type: r.type,
              ...r.details
            })),
            prominentEntitiesLinked: prominentEntities.length,
            prominenceLocked: snapshotLockedCount,
            pressureEffects: pressureChanges
          }
        }
      };
    }
  };
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
    graphView.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA, includeHistorical: true })
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
        explicitNext.entryConditions || []
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
      candidateEra.entryConditions || []
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
  effects: Era['entryEffects'] | Era['exitEffects'],
  self: HardState
): Record<string, number> {
  const mutations = effects?.mutations || [];
  if (mutations.length === 0) return {};

  const baseCtx = createSystemContext(graphView);
  const ctx = { ...baseCtx, self, entities: { ...(baseCtx.entities ?? {}), self } };
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
