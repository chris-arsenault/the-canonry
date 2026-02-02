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

      const relationshipsAdded: Array<Relationship & { actionContext?: { source: 'action'; sourceId: string; success?: boolean } }> = [];
      const relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number; actionContext?: { source: 'action'; sourceId: string; success?: boolean } }> = [];
      const relationshipsToArchive: Array<{ kind: string; src: string; dst: string; actionContext?: { source: 'action'; sourceId: string; success?: boolean } }> = [];
      const entitiesModified: Array<{ id: string; changes: Partial<HardState>; actionContext?: { source: 'action'; sourceId: string; success?: boolean } }> = [];
      const pressureChanges: Record<string, number> = {};
      // Collect narrations per action for narrative event generation
      const actionNarrations: Map<string, string> = new Map();
      let actionsAttempted = 0;
      let actionsSucceeded = 0;

      // Get emitter from graphView config if available
      const emitter = graphView.config.emitter;

      allAgents.forEach(agent => {
        if (!agent.catalyst?.canAct) return;

        // Calculate action attempt chance
        const baseAttemptChance = calculateAttemptChance(agent, actionAttemptRate);

        // Apply pressure multiplier based on available actions for this agent
        const availableActions = getAvailableActions(agent, actions, graphView);
        const relevantPressures = getRelevantPressuresFromActions(graphView, availableActions);
        const prominenceBonus = relevantPressures * (pressureMultiplier - 1.0);
        const finalAttemptChance = Math.min(1.0, (baseAttemptChance + prominenceBonus) * modifier);

        if (Math.random() > finalAttemptChance) return;

        actionsAttempted++;

        // Select action from available actions with context
        const { action: selectedAction, context: selectionContext } = selectActionWithContext(
          agent,
          availableActions,
          graphView,
          finalAttemptChance,
          prominenceBonus
        );
        if (!selectedAction) return;

        // Attempt to execute action with extended outcome
        const outcome = executeActionWithContext(agent, selectedAction, graphView);

        // Store action context for narrative attribution
        // WorldEngine will use this to enter/exit contexts when applying modifications
        // Include agent.id to make each action invocation a separate narrative event
        // Include success flag so failed actions can be filtered in narrative views
        const actionContext = {
          source: 'action' as const,
          sourceId: `${selectedAction.type}:${agent.id}`,
          success: outcome.success,
        };

        // Track prominence changes for instrumentation
        const prominenceChanges: Array<{ entityId: string; entityName: string; direction: 'up' | 'down' }> = [];

        if (outcome.success) {
          actionsSucceeded++;

          // Collect narration for this action (keyed by action context sourceId)
          if (outcome.narration) {
            actionNarrations.set(actionContext.sourceId, outcome.narration);
          }

          if (outcome.entitiesModified && outcome.entitiesModified.length > 0) {
            // Add action context to entity modifications for proper narrative attribution
            for (const mod of outcome.entitiesModified) {
              entitiesModified.push({ ...mod, actionContext });
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

      // Convert action narrations to keyed object for proper per-action attribution
      // Key format matches the action context sourceId (e.g., "action_id:agent_id")
      const narrationsByGroup: Record<string, string> = {};
      for (const [key, narration] of actionNarrations) {
        narrationsByGroup[key] = narration;
      }

      return {
        relationshipsAdded,
        relationshipsAdjusted,
        relationshipsToArchive,
        entitiesModified,
        pressureChanges,
        description: actionsSucceeded > 0
          ? `Agents shape the world (${actionsSucceeded}/${actionsAttempted} actions succeeded)`
          : actionsAttempted > 0
          ? `Agents attempt to act (all ${actionsAttempted} failed)`
          : 'Agents dormant this cycle',
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
  // Calculate success chance based on prominence
  const baseChance = action.baseSuccessChance || 0.5;
  const prominenceMultiplier = getProminenceMultiplierValue(agent.prominence, 'success_chance');
  const successChance = Math.min(0.95, baseChance * prominenceMultiplier);

  // Action handler is created from declarative config
  if (!action.handler) {
    return {
      status: 'failed_roll',
      success: false,
      relationships: [],
      description: 'Action has no handler',
      entitiesCreated: [],
      entitiesModified: [],
      successChance,
      prominenceMultiplier
    };
  }

  const success = Math.random() < successChance;

  if (success) {
    // Execute declarative handler
    const handlerResult = action.handler(graphView, agent);

    // Determine status based on handler result
    let status: ActionOutcomeStatus = 'success';
    if (!handlerResult.success) {
      switch (handlerResult.failureReason) {
        case 'no_target':
          status = 'failed_no_target';
          break;
        case 'no_instigator':
          status = 'failed_no_instigator';
          break;
        default:
          status = 'failed_roll';
          break;
      }
    }

    // Look up instigator name if present
    let instigatorName: string | undefined;
    if (handlerResult.instigatorId) {
      const instigator = graphView.getEntity(handlerResult.instigatorId);
      instigatorName = instigator?.name;
    }

    // Extract target info (prefer explicit IDs from handler result)
    let targetId: string | undefined = handlerResult.targetId;
    let targetName: string | undefined;
    let targetKind: string | undefined;
    let target2Id: string | undefined = handlerResult.target2Id;
    let target2Name: string | undefined;

    if (targetId) {
      const target = graphView.getEntity(targetId);
      if (target) {
        targetName = target.name;
        targetKind = target.kind;
      }
    }

    if (target2Id) {
      const target2 = graphView.getEntity(target2Id);
      if (target2) {
        target2Name = target2.name;
      }
    }

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
      targetId,
      targetName,
      targetKind,
      target2Id,
      target2Name,
      successChance,
      prominenceMultiplier
    };
  } else {
    return {
      status: 'failed_roll',
      success: false,
      relationships: [],
      description: `failed to ${action.type}`,
      entitiesCreated: [],
      entitiesModified: [],
      successChance,
      prominenceMultiplier
    };
  }
}
