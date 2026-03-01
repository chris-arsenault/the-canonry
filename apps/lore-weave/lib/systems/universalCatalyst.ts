/* eslint-disable sonarjs/pseudo-random -- simulation probability rolls throughout, not security */
import { SimulationSystem, SystemResult } from '../engine/types';
import { FRAMEWORK_TAGS } from '@canonry/world-schema';
import { HardState, Relationship } from '../core/worldTypes';
import { calculateAttemptChance } from '../systems/catalystHelpers';
import { WorldRuntime } from '../runtime/worldRuntime';
import type { UniversalCatalystConfig } from '../engine/systemInterpreter';
import type { ExecutableAction } from '../engine/actionInterpreter';
import { matchesActorConfig, getProminenceMultiplierValue, clampProminence, prominenceLabel } from '../rules';
import { hasTag } from '../utils';
import type { ActionApplicationPayload } from '../observer/types';

// =============================================================================
// INSTRUMENTATION TYPES
// =============================================================================

interface PressureInfluence {
  pressureId: string;
  value: number;
  multiplier: number;
  contribution: number;
}

interface ActionWeightBreakdown {
  weight: number;
  pressureInfluences: PressureInfluence[];
}

interface SelectionContext {
  availableActionCount: number;
  selectedWeight: number;
  totalWeight: number;
  pressureInfluences: PressureInfluence[];
  attemptChance: number;
  prominenceBonus: number;
}

interface ActionSelectionResult {
  action: ExecutableAction | null;
  context: SelectionContext;
}

type ActionOutcomeStatus = 'success' | 'failed_roll' | 'failed_no_target' | 'failed_no_instigator';

interface ExtendedActionOutcome {
  status: ActionOutcomeStatus;
  success: boolean;
  relationships: Relationship[];
  relationshipsAdjusted?: Array<{ kind: string; src: string; dst: string; delta: number }>;
  /** Relationships to archive (deferred until worldEngine applies with proper context) */
  relationshipsToArchive?: Array<{ kind: string; src: string; dst: string }>;
  description: string;
  /** Domain-controlled narration from narrationTemplate */
  narration?: string;
  entitiesCreated?: string[];
  entitiesModified?: Array<{ id: string; changes: Partial<HardState> }>;
  pressureChanges?: Record<string, number>;
  instigatorId?: string;
  instigatorName?: string;
  targetId?: string;
  targetName?: string;
  targetKind?: string;
  target2Id?: string;
  target2Name?: string;
  successChance: number;
  prominenceMultiplier: number;
}

/**
 * Universal Catalyst System
 *
 * Framework-level system that enables agents to perform actions.
 * This is domain-agnostic - all domain-specific logic lives in action handlers.
 *
 * Flow:
 * 1. Find all entities that can act (catalyst.canAct = true)
 * 2. For each agent, roll for action attempt based on prominence
 * 3. Select action from available actions, weighted by pressures
 * 4. Execute action via declarative handler (success chance based on prominence)
 * 5. Record catalyzedBy attribution
 */

/**
 * Create a Universal Catalyst system with the given configuration.
 */

// =============================================================================
// CATALYST ACCUMULATOR TYPES
// =============================================================================

interface AgentActionContext {
  source: 'action';
  sourceId: string;
  success: boolean;
}

type EntityMod = { id: string; changes: Partial<HardState>; actionContext?: AgentActionContext };
type RelAdded = Relationship & { actionContext?: AgentActionContext };
type RelAdjusted = { kind: string; src: string; dst: string; delta: number; actionContext?: AgentActionContext };
type RelArchive = { kind: string; src: string; dst: string; actionContext?: AgentActionContext };
type ProminenceChange = { entityId: string; entityName: string; direction: 'up' | 'down' };

interface CatalystAccumulator {
  relationshipsAdded: RelAdded[];
  relationshipsAdjusted: RelAdjusted[];
  relationshipsToArchive: RelArchive[];
  entitiesModified: EntityMod[];
  pressureChanges: Record<string, number>;
  actionNarrations: Map<string, string>;
}

interface AgentCounters { actionsAttempted: number; actionsSucceeded: number; }

// =============================================================================
// CATALYST HELPERS
// =============================================================================

function collectOutcomeResults(
  agent: HardState,
  outcome: ExtendedActionOutcome,
  actionContext: AgentActionContext,
  graphView: WorldRuntime,
  acc: CatalystAccumulator
): void {
  if (outcome.narration) acc.actionNarrations.set(actionContext.sourceId, outcome.narration);
  for (const mod of outcome.entitiesModified ?? []) acc.entitiesModified.push({ ...mod, actionContext });
  for (const adj of outcome.relationshipsAdjusted ?? []) acc.relationshipsAdjusted.push({ ...adj, actionContext });
  for (const arch of outcome.relationshipsToArchive ?? []) acc.relationshipsToArchive.push({ ...arch, actionContext });
  if (outcome.pressureChanges) {
    for (const [k, v] of Object.entries(outcome.pressureChanges)) {
      acc.pressureChanges[k] = (acc.pressureChanges[k] ?? 0) + v;
    }
  }
  for (const rel of outcome.relationships) {
    rel.catalyzedBy = agent.id;
    rel.createdAt = graphView.tick;
    acc.relationshipsAdded.push({ ...rel, actionContext });
  }
}

function applySuccessProminenceChanges(
  agent: HardState,
  selectedAction: ExecutableAction,
  outcome: ExtendedActionOutcome,
  actionContext: AgentActionContext,
  graphView: WorldRuntime,
  prominenceUpChance: number,
  acc: CatalystAccumulator
): ProminenceChange[] {
  const changes: ProminenceChange[] = [];
  const successDelta = selectedAction.actorProminenceDelta.onSuccess;
  if (successDelta > 0 && Math.random() < prominenceUpChance && !hasTag(agent.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
    acc.entitiesModified.push({ id: agent.id, changes: { prominence: clampProminence(agent.prominence + successDelta) }, actionContext });
    changes.push({ entityId: agent.id, entityName: agent.name, direction: 'up' });
  }
  const targetDelta = selectedAction.targetProminenceDelta.onSuccess;
  if (targetDelta !== 0 && outcome.targetId) {
    const target = graphView.getEntity(outcome.targetId);
    if (target && !hasTag(target.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
      acc.entitiesModified.push({ id: target.id, changes: { prominence: clampProminence(target.prominence + targetDelta) }, actionContext });
      changes.push({ entityId: target.id, entityName: target.name, direction: targetDelta > 0 ? 'up' : 'down' });
    }
  }
  return changes;
}

function updateActionTracker(
  tracker: NonNullable<WorldRuntime['config']['actionUsageTracker']>,
  payload: ActionApplicationPayload
): void {
  tracker.applications.push(payload);
  tracker.countsByActionId.set(payload.actionId, (tracker.countsByActionId.get(payload.actionId) ?? 0) + 1);
  const currentActor = tracker.countsByActorId.get(payload.actorId);
  if (currentActor) {
    tracker.countsByActorId.set(payload.actorId, { name: payload.actorName, kind: payload.actorKind, count: currentActor.count + 1 });
  } else {
    tracker.countsByActorId.set(payload.actorId, { name: payload.actorName, kind: payload.actorKind, count: 1 });
  }
}

function emitAndTrackSuccess(
  agent: HardState,
  selectedAction: ExecutableAction,
  outcome: ExtendedActionOutcome,
  actionContext: AgentActionContext,
  selectionContext: SelectionContext,
  graphView: WorldRuntime,
  prominenceChanges: ProminenceChange[]
): void {
  const ticksPerEpoch = graphView.config.ticksPerEpoch ?? 20;
  const payload: ActionApplicationPayload = {
    tick: graphView.tick,
    epoch: Math.floor(graphView.tick / ticksPerEpoch),
    actionId: selectedAction.type,
    actionName: selectedAction.name,
    actorId: agent.id,
    actorName: agent.name,
    actorKind: agent.kind,
    actorProminence: prominenceLabel(agent.prominence),
    instigatorId: outcome.instigatorId,
    instigatorName: outcome.instigatorName,
    targetId: outcome.targetId,
    targetName: outcome.targetName,
    targetKind: outcome.targetKind,
    target2Id: outcome.target2Id,
    target2Name: outcome.target2Name,
    selectionContext: {
      availableActionCount: selectionContext.availableActionCount,
      selectedWeight: selectionContext.selectedWeight,
      totalWeight: selectionContext.totalWeight,
      pressureInfluences: selectionContext.pressureInfluences,
      attemptChance: selectionContext.attemptChance,
      prominenceBonus: selectionContext.prominenceBonus
    },
    outcome: {
      status: outcome.status,
      successChance: outcome.successChance,
      prominenceMultiplier: outcome.prominenceMultiplier,
      description: outcome.description,
      narration: outcome.narration,
      relationshipsCreated: outcome.relationships.map(rel => ({
        kind: rel.kind, srcId: rel.src, dstId: rel.dst,
        srcName: graphView.getEntity(rel.src)?.name ?? rel.src,
        dstName: graphView.getEntity(rel.dst)?.name ?? rel.dst,
        strength: rel.strength
      })),
      relationshipsStrengthened: (outcome.relationshipsAdjusted ?? []).map(rel => ({
        kind: rel.kind, srcId: rel.src, dstId: rel.dst,
        srcName: graphView.getEntity(rel.src)?.name ?? rel.src,
        dstName: graphView.getEntity(rel.dst)?.name ?? rel.dst,
        delta: rel.delta
      })),
      prominenceChanges
    }
  };
  const emitter = graphView.config.emitter;
  if (emitter) emitter.actionApplication(payload);
  const tracker = graphView.config.actionUsageTracker;
  if (tracker) updateActionTracker(tracker, payload);
}

function handleSuccessfulOutcome(
  agent: HardState,
  selectedAction: ExecutableAction,
  outcome: ExtendedActionOutcome,
  actionContext: AgentActionContext,
  selectionContext: SelectionContext,
  graphView: WorldRuntime,
  prominenceUpChance: number,
  acc: CatalystAccumulator
): void {
  collectOutcomeResults(agent, outcome, actionContext, graphView, acc);
  acc.entitiesModified.push({ id: agent.id, changes: { catalyst: agent.catalyst, updatedAt: graphView.tick }, actionContext });
  const prominenceChanges = applySuccessProminenceChanges(agent, selectedAction, outcome, actionContext, graphView, prominenceUpChance, acc);
  emitAndTrackSuccess(agent, selectedAction, outcome, actionContext, selectionContext, graphView, prominenceChanges);
}

function handleFailedOutcome(
  agent: HardState,
  selectedAction: ExecutableAction,
  outcome: ExtendedActionOutcome,
  actionContext: AgentActionContext,
  graphView: WorldRuntime,
  prominenceDownChance: number,
  acc: CatalystAccumulator
): void {
  const failureDelta = selectedAction.actorProminenceDelta.onFailure;
  if (failureDelta !== 0 && Math.random() < prominenceDownChance && !hasTag(agent.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
    acc.entitiesModified.push({ id: agent.id, changes: { prominence: clampProminence(agent.prominence + failureDelta) }, actionContext });
  }
  const targetFailureDelta = selectedAction.targetProminenceDelta.onFailure;
  if (targetFailureDelta !== 0 && outcome.targetId) {
    const target = graphView.getEntity(outcome.targetId);
    if (target && !hasTag(target.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
      acc.entitiesModified.push({ id: target.id, changes: { prominence: clampProminence(target.prominence + targetFailureDelta) }, actionContext });
    }
  }
}

function processAgentTick(
  agent: HardState,
  actions: ExecutableAction[],
  actionAttemptRate: number,
  pressureMultiplier: number,
  prominenceUpChance: number,
  prominenceDownChance: number,
  modifier: number,
  graphView: WorldRuntime,
  counters: AgentCounters,
  acc: CatalystAccumulator
): void {
  if (!agent.catalyst?.canAct) return;
  const baseAttemptChance = calculateAttemptChance(agent, actionAttemptRate);
  const availableActions = getAvailableActions(agent, actions, graphView);
  const relevantPressures = getRelevantPressuresFromActions(graphView, availableActions);
  const prominenceBonus = relevantPressures * (pressureMultiplier - 1.0);
  const finalAttemptChance = Math.min(1.0, (baseAttemptChance + prominenceBonus) * modifier);
  if (Math.random() > finalAttemptChance) return;
  counters.actionsAttempted++;
  const { action: selectedAction, context: selectionContext } = selectActionWithContext(agent, availableActions, graphView, finalAttemptChance, prominenceBonus);
  if (!selectedAction) return;
  const outcome = executeActionWithContext(agent, selectedAction, graphView);
  const actionContext: AgentActionContext = { source: 'action', sourceId: `${selectedAction.type}:${agent.id}`, success: outcome.success };
  if (outcome.success) {
    counters.actionsSucceeded++;
    handleSuccessfulOutcome(agent, selectedAction, outcome, actionContext, selectionContext, graphView, prominenceUpChance, acc);
  } else {
    handleFailedOutcome(agent, selectedAction, outcome, actionContext, graphView, prominenceDownChance, acc);
  }
}

function resolveActionStatus(handlerResult: { success: boolean; failureReason?: string }): ActionOutcomeStatus {
  if (handlerResult.success) return 'success';
  switch (handlerResult.failureReason) {
    case 'no_target': return 'failed_no_target';
    case 'no_instigator': return 'failed_no_instigator';
    default: return 'failed_roll';
  }
}

function resolveTargetData(
  handlerResult: { targetId?: string; target2Id?: string },
  graphView: WorldRuntime
): { targetId?: string; targetName?: string; targetKind?: string; target2Id?: string; target2Name?: string } {
  const { targetId, target2Id } = handlerResult;
  const targetEntity = targetId ? graphView.getEntity(targetId) : undefined;
  const target2Entity = target2Id ? graphView.getEntity(target2Id) : undefined;
  return {
    targetId, targetName: targetEntity?.name, targetKind: targetEntity?.kind,
    target2Id, target2Name: target2Entity?.name,
  };
}

export function createUniversalCatalystSystem(config: UniversalCatalystConfig): SimulationSystem {
  // Extract config with defaults
  const actionAttemptRate = config.actionAttemptRate ?? 0.3;
  const pressureMultiplier = config.pressureMultiplier ?? 1.5;
  const prominenceUpChance = config.prominenceUpChanceOnSuccess ?? 0.1;
  const prominenceDownChance = config.prominenceDownChanceOnFailure ?? 0.05;

  return {
    id: config.id || 'universal_catalyst',
    name: config.name || 'Agent Actions',

    apply: (graphView: WorldRuntime, modifier: number = 1.0): SystemResult => {
      // Get executable actions from declarative config
      const actions: ExecutableAction[] = graphView.config.executableActions || [];

      if (actions.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: 'Catalyst system dormant (no actions configured in actions.json)'
        };
      }

      // Find all agents (entities that can act)
      const allAgents = graphView.getEntities().filter(e => e.catalyst?.canAct === true);

      const acc: CatalystAccumulator = {
        relationshipsAdded: [],
        relationshipsAdjusted: [],
        relationshipsToArchive: [],
        entitiesModified: [],
        pressureChanges: {},
        actionNarrations: new Map(),
      };
      const counters: AgentCounters = { actionsAttempted: 0, actionsSucceeded: 0 };

      allAgents.forEach(agent => processAgentTick(
        agent, actions, actionAttemptRate, pressureMultiplier,
        prominenceUpChance, prominenceDownChance, modifier,
        graphView, counters, acc
      ));
            }
          }

          if (outcome.relationshipsAdjusted && outcome.relationshipsAdjusted.length > 0) {
            // Add action context to relationship adjustments
            for (const adj of outcome.relationshipsAdjusted) {
              relationshipsAdjusted.push({ ...adj, actionContext });
            }
          }

          if (outcome.relationshipsToArchive && outcome.relationshipsToArchive.length > 0) {
            // Add action context to relationship archivals
            for (const arch of outcome.relationshipsToArchive) {
              relationshipsToArchive.push({ ...arch, actionContext });
            }
          }

          if (outcome.pressureChanges) {
            for (const [pressureId, delta] of Object.entries(outcome.pressureChanges)) {
              pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
            }
          }

          // Add created relationships with catalyst attribution and action context
          outcome.relationships.forEach(rel => {
            rel.catalyzedBy = agent.id;
            rel.createdAt = graphView.tick;
            relationshipsAdded.push({ ...rel, actionContext });
          });

          entitiesModified.push({
            id: agent.id,
            changes: {
              catalyst: agent.catalyst,
              updatedAt: graphView.tick
            },
            actionContext,
          });

          // Apply prominence increase on success (if action specifies a positive delta)
          // NOTE: Do NOT modify entity directly - let worldEngine apply changes
          // to ensure proper state tracking and persistence
          const successDelta = selectedAction.actorProminenceDelta.onSuccess;
          if (
            successDelta > 0 &&
            Math.random() < prominenceUpChance &&
            !hasTag(agent.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)
          ) {
            const newProminence = clampProminence(agent.prominence + successDelta);
            entitiesModified.push({
              id: agent.id,
              changes: { prominence: newProminence },
              actionContext,
            });
            prominenceChanges.push({ entityId: agent.id, entityName: agent.name, direction: 'up' });
          }

          // Apply target prominence change on success (if action specifies a delta)
          const targetSuccessDelta = selectedAction.targetProminenceDelta.onSuccess;
          if (targetSuccessDelta !== 0 && outcome.targetId) {
            const target = graphView.getEntity(outcome.targetId);
            if (target && !hasTag(target.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
              const newProminence = clampProminence(target.prominence + targetSuccessDelta);
              entitiesModified.push({
                id: target.id,
                changes: { prominence: newProminence },
                actionContext,
              });
              prominenceChanges.push({
                entityId: target.id,
                entityName: target.name,
                direction: targetSuccessDelta > 0 ? 'up' : 'down'
              });
            }
          }
        } else {
          // Apply prominence decrease on failure (if action specifies a negative delta)
          // NOTE: Do NOT modify entity directly - let worldEngine apply changes
          const failureDelta = selectedAction.actorProminenceDelta.onFailure;
          if (
            failureDelta !== 0 &&
            Math.random() < prominenceDownChance &&
            !hasTag(agent.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)
          ) {
            const newProminence = clampProminence(agent.prominence + failureDelta);
            entitiesModified.push({
              id: agent.id,
              changes: { prominence: newProminence },
              actionContext,
            });
            prominenceChanges.push({ entityId: agent.id, entityName: agent.name, direction: failureDelta < 0 ? 'down' : 'up' });
          }

          // Apply target prominence change on failure (if action specifies a delta)
          const targetFailureDelta = selectedAction.targetProminenceDelta.onFailure;
          if (targetFailureDelta !== 0 && outcome.targetId) {
            const target = graphView.getEntity(outcome.targetId);
            if (target && !hasTag(target.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
              const newProminence = clampProminence(target.prominence + targetFailureDelta);
              entitiesModified.push({
                id: target.id,
                changes: { prominence: newProminence },
                actionContext,
              });
              prominenceChanges.push({
                entityId: target.id,
                entityName: target.name,
                direction: targetFailureDelta > 0 ? 'up' : 'down'
              });
            }
          }
        }

        // NOTE: Action context is now embedded in modifications instead of using enter/exit
        // This ensures WorldEngine can apply the correct context when recording mutations

        if (outcome.success) {
          // Calculate epoch from tick (approximate)
          const ticksPerEpoch = graphView.config.ticksPerEpoch || 20;
          const epoch = Math.floor(graphView.tick / ticksPerEpoch);

          const payload: ActionApplicationPayload = {
            tick: graphView.tick,
            epoch,
            actionId: selectedAction.type,
            actionName: selectedAction.name,
            actorId: agent.id,
            actorName: agent.name,
            actorKind: agent.kind,
            actorProminence: prominenceLabel(agent.prominence),
            instigatorId: outcome.instigatorId,
            instigatorName: outcome.instigatorName,
            targetId: outcome.targetId,
            targetName: outcome.targetName,
            targetKind: outcome.targetKind,
            target2Id: outcome.target2Id,
            target2Name: outcome.target2Name,
            selectionContext: {
              availableActionCount: selectionContext.availableActionCount,
              selectedWeight: selectionContext.selectedWeight,
              totalWeight: selectionContext.totalWeight,
              pressureInfluences: selectionContext.pressureInfluences,
              attemptChance: selectionContext.attemptChance,
              prominenceBonus: selectionContext.prominenceBonus
            },
            outcome: {
              status: outcome.status,
              successChance: outcome.successChance,
              prominenceMultiplier: outcome.prominenceMultiplier,
              description: outcome.description,
              narration: outcome.narration,
              relationshipsCreated: outcome.relationships.map(rel => ({
                kind: rel.kind,
                srcId: rel.src,
                dstId: rel.dst,
                srcName: graphView.getEntity(rel.src)?.name || rel.src,
                dstName: graphView.getEntity(rel.dst)?.name || rel.dst,
                strength: rel.strength
              })),
              relationshipsStrengthened: (outcome.relationshipsAdjusted || []).map(rel => ({
                kind: rel.kind,
                srcId: rel.src,
                dstId: rel.dst,
                srcName: graphView.getEntity(rel.src)?.name || rel.src,
                dstName: graphView.getEntity(rel.dst)?.name || rel.dst,
                delta: rel.delta
              })),
              prominenceChanges
            }
          };

          if (emitter) {
            emitter.actionApplication(payload);
          }

          const tracker = graphView.config.actionUsageTracker;
          if (tracker) {
            tracker.applications.push(payload);
            tracker.countsByActionId.set(
              payload.actionId,
              (tracker.countsByActionId.get(payload.actionId) || 0) + 1
            );
            const currentActor = tracker.countsByActorId.get(payload.actorId);
            if (currentActor) {
              tracker.countsByActorId.set(payload.actorId, {
                name: payload.actorName,
                kind: payload.actorKind,
                count: currentActor.count + 1
              });
            } else {
              tracker.countsByActorId.set(payload.actorId, {
                name: payload.actorName,
                kind: payload.actorKind,
                count: 1
              });
            }
          }
        }
      });

      const { actionsAttempted, actionsSucceeded } = counters;
      const narrationsByGroup: Record<string, string> = Object.fromEntries(acc.actionNarrations);

      let description: string;
      if (actionsSucceeded > 0) description = `Agents shape the world (${actionsSucceeded}/${actionsAttempted} actions succeeded)`;
      else if (actionsAttempted > 0) description = `Agents attempt to act (all ${actionsAttempted} failed)`;
      else description = 'Agents dormant this cycle';

      return {
        relationshipsAdded: acc.relationshipsAdded,
        relationshipsAdjusted: acc.relationshipsAdjusted,
        relationshipsToArchive: acc.relationshipsToArchive,
        entitiesModified: acc.entitiesModified,
        pressureChanges: acc.pressureChanges,
        description,
        narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined,
      };
    }
  };
}

/**
 * Get available actions for an agent based on requirements
 */
function getAvailableActions(
  agent: HardState,
  actions: ExecutableAction[],
  graphView: WorldRuntime
): ExecutableAction[] {
  return actions.filter(action => meetsRequirements(agent, action, graphView));
}

/**
 * Calculate pressure contribution for attempt chance from available actions.
 * Uses the same multiplier-based approach as weight calculation.
 * Returns a value that can be added to the base attempt chance.
 */
function getRelevantPressuresFromActions(graphView: WorldRuntime, actions: ExecutableAction[]): number {
  if (actions.length === 0) return 0;

  // Collect all unique pressure modifiers across actions
  const pressureContributions: Map<string, number[]> = new Map();

  for (const action of actions) {
    if (!action.pressureModifiers) continue;
    for (const mod of action.pressureModifiers) {
      if (!pressureContributions.has(mod.pressure)) {
        pressureContributions.set(mod.pressure, []);
      }
      pressureContributions.get(mod.pressure)!.push(mod.multiplier);
    }
  }

  if (pressureContributions.size === 0) return 0;

  // Calculate weighted contribution: average multiplier * pressure for each unique pressure
  let totalContribution = 0;
  for (const [pressureId, multipliers] of pressureContributions) {
    const avgMultiplier = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
    const pressure = graphView.getPressure(pressureId);
    totalContribution += (pressure / 100) * avgMultiplier;
  }

  // Normalize by number of unique pressures to keep contribution reasonable
  return totalContribution / pressureContributions.size;
}

/**
 * Select an action for the agent to attempt with full context for instrumentation
 * Weighted by pressure levels
 */
function selectActionWithContext(
  agent: HardState,
  availableActions: ExecutableAction[],
  graphView: WorldRuntime,
  attemptChance: number,
  prominenceBonus: number
): ActionSelectionResult {
  const emptyContext: SelectionContext = {
    availableActionCount: availableActions.length,
    selectedWeight: 0,
    totalWeight: 0,
    pressureInfluences: [],
    attemptChance,
    prominenceBonus
  };

  if (!agent.catalyst || availableActions.length === 0) {
    return { action: null, context: emptyContext };
  }

  // Calculate weights for each action with breakdown
  const weightedActions = availableActions.map(action => {
    const breakdown = calculateActionWeightWithBreakdown(action, graphView);
    return {
      action,
      weight: breakdown.weight,
      pressureInfluences: breakdown.pressureInfluences
    };
  });

  // Weighted random selection
  const totalWeight = weightedActions.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const wa of weightedActions) {
    random -= wa.weight;
    if (random <= 0) {
      return {
        action: wa.action,
        context: {
          availableActionCount: availableActions.length,
          selectedWeight: wa.weight,
          totalWeight,
          pressureInfluences: wa.pressureInfluences,
          attemptChance,
          prominenceBonus
        }
      };
    }
  }

  // Fallback to first action
  const fallback = weightedActions[0];
  return {
    action: fallback?.action || null,
    context: {
      availableActionCount: availableActions.length,
      selectedWeight: fallback?.weight || 0,
      totalWeight,
      pressureInfluences: fallback?.pressureInfluences || [],
      attemptChance,
      prominenceBonus
    }
  };
}

/**
 * Check if agent meets action requirements.
 * Delegates to matchesActorConfig for consistent actor filtering.
 */
function meetsRequirements(agent: HardState, action: ExecutableAction, graphView: WorldRuntime): boolean {
  return matchesActorConfig(agent, action.actorConfig, graphView);
}

/**
 * Calculate action weight based on pressures with full breakdown for instrumentation.
 * Uses multiplier-based calculation supporting both positive and negative (inverse) relationships.
 *
 * Formula: weight = baseWeight * (1 + sum of (pressure/100 * multiplier))
 *
 * Examples with pressure at 80:
 *   multiplier 1.0  → contribution = 0.8, weight *= 1.8
 *   multiplier -1.0 → contribution = -0.8, weight *= 0.2 (inverse)
 *   multiplier 0.5  → contribution = 0.4, weight *= 1.4
 */
function calculateActionWeightWithBreakdown(action: ExecutableAction, graphView: WorldRuntime): ActionWeightBreakdown {
  const baseWeight = action.baseWeight || 1.0;
  const pressureInfluences: PressureInfluence[] = [];

  if (!action.pressureModifiers || action.pressureModifiers.length === 0) {
    return { weight: baseWeight, pressureInfluences };
  }

  // Calculate total pressure contribution with breakdown
  let pressureContribution = 0;
  for (const mod of action.pressureModifiers) {
    const pressure = graphView.getPressure(mod.pressure);
    const contribution = (pressure / 100) * mod.multiplier;
    pressureContribution += contribution;

    pressureInfluences.push({
      pressureId: mod.pressure,
      value: pressure,
      multiplier: mod.multiplier,
      contribution
    });
  }

  // Apply contribution to base weight
  const weight = Math.max(0.1, baseWeight * (1 + pressureContribution));

  return { weight, pressureInfluences };
}

/**
 * Execute an action via declarative handler with extended outcome for instrumentation
 */
function executeActionWithContext(
  agent: HardState,
  action: ExecutableAction,
  graphView: WorldRuntime
): ExtendedActionOutcome {
  const baseChance = action.baseSuccessChance || 0.5;
  const prominenceMultiplier = getProminenceMultiplierValue(agent.prominence, 'success_chance');
  const successChance = Math.min(0.95, baseChance * prominenceMultiplier);

  if (!action.handler) {
    return { status: 'failed_roll', success: false, relationships: [], description: 'Action has no handler', entitiesCreated: [], entitiesModified: [], successChance, prominenceMultiplier };
  }

  if (!(Math.random() < successChance)) {
    return { status: 'failed_roll', success: false, relationships: [], description: `failed to ${action.type}`, entitiesCreated: [], entitiesModified: [], successChance, prominenceMultiplier };
  }

  const handlerResult = action.handler(graphView, agent);
  const status = resolveActionStatus(handlerResult);
  const instigatorName = handlerResult.instigatorId ? graphView.getEntity(handlerResult.instigatorId)?.name : undefined;
  const { targetId, targetName, targetKind, target2Id, target2Name } = resolveTargetData(handlerResult, graphView);

  return {
    status,
    success: handlerResult.success,
    relationships: handlerResult.relationships,
    relationshipsAdjusted: handlerResult.relationshipsAdjusted,
    relationshipsToArchive: handlerResult.relationshipsToArchive,
    description: handlerResult.description,
    narration: handlerResult.narration,
    entitiesCreated: handlerResult.entitiesCreated,
    entitiesModified: handlerResult.entitiesModified,
    pressureChanges: handlerResult.pressureChanges,
    instigatorId: handlerResult.instigatorId,
    instigatorName,
    targetId, targetName, targetKind, target2Id, target2Name,
    successChance,
    prominenceMultiplier,
  };
}
