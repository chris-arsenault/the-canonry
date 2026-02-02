/**
 * Action Interpreter
 *
 * Converts declarative action configurations (JSON) into executable action handlers.
 * Actions are defined as data and executed by the universal catalyst system.
 */

import { HardState, Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import type { Condition, RuleContext } from '../rules';
import type { Mutation } from '../rules';
import type { SelectionRule, VariableSelectionRule, VariableDefinitionForResolution } from '../rules';
import {
  applyPickStrategy,
  createActionContext,
  evaluateCondition,
  prepareMutation,
  selectEntities,
  selectVariableEntities,
  resolveVariablesForEntity,
  createSystemContext,
} from '../rules';
import { interpolate, createNarrationContext } from '../narrative/narrationTemplate';

// =============================================================================
// DECLARATIVE ACTION TYPES
// =============================================================================

/**
 * Instigator selection - optional entity that triggers the action on behalf of the actor.
 */
export interface InstigatorSelectionRule extends VariableSelectionRule {
  /** If true, action is unavailable when no instigator is found. */
  required?: boolean;
}

/**
 * Actor configuration - who can attempt this action.
 */
export interface ActionActorConfig {
  /** How to select eligible actors. */
  selection: SelectionRule;
  /** Optional conditions that must pass for this actor. */
  conditions?: Condition[];
  /** Optional instigator selection. */
  instigator?: InstigatorSelectionRule;
}

/**
 * Action outcome configuration.
 */
export interface ActionOutcomeConfig {
  /** Mutations to apply on success. */
  mutations?: Mutation[];
  /** Description template (supports {actor.name}, {target.name}, etc.). */
  descriptionTemplate: string;
  /**
   * Narration template for narrative-quality text.
   * Uses the full template syntax:
   * - {entity.field} - Access entity fields (name, kind, subtype, culture)
   * - {$variable.field} - Access resolved variables
   * - {field|fallback} - Use fallback if field is null/undefined
   *
   * Example: "The {actor.subtype} {actor.name} seized {target.name}, wresting it from {$previousOwner.name|the realm's grasp}."
   */
  narrationTemplate?: string;
  /**
   * Delta to apply to actor prominence on success/failure.
   * Example: { onSuccess: 1.0, onFailure: -0.5 }
   */
  actorProminenceDelta?: {
    onSuccess?: number;
    onFailure?: number;
  };
  /**
   * Delta to apply to target prominence on success/failure.
   * Example: { onSuccess: 0.5, onFailure: -0.2 }
   */
  targetProminenceDelta?: {
    onSuccess?: number;
    onFailure?: number;
  };
}

/**
 * Pressure modifier - how a pressure affects action weight and attempt chance.
 */
export interface PressureModifier {
  /** Pressure ID */
  pressure: string;
  /** Multiplier for how pressure affects weight/attempt chance. */
  multiplier: number;
}

/**
 * Action probability configuration.
 */
export interface ActionProbabilityConfig {
  /** Base success chance (0-1) */
  baseSuccessChance: number;
  /** Selection weight for weighted random */
  baseWeight: number;
  /** Pressure modifiers that affect this action's weight and attempt chance */
  pressureModifiers?: PressureModifier[];
}

/**
 * Complete declarative action configuration.
 */
export interface DeclarativeAction {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this action does */
  description: string;
  /** Whether this action is enabled (default: true) */
  enabled?: boolean;

  /** Who can attempt this action (primary actor + optional instigator) */
  actor: ActionActorConfig;
  /** How to find valid targets */
  targeting: SelectionRule;
  /**
   * Optional variables to resolve before executing mutations.
   * Variables can reference $actor, $target, $instigator and each other.
   * Resolved variables are available in mutations as $varName.
   */
  variables?: Record<string, VariableDefinitionForResolution>;
  /** What happens on success */
  outcome: ActionOutcomeConfig;
  /** Probability settings */
  probability: ActionProbabilityConfig;
}

/**
 * Executable action (what universalCatalyst uses).
 */
export interface ExecutableAction {
  type: string;
  name: string;
  description: string;
  baseSuccessChance: number;
  baseWeight: number;
  /** Pressure modifiers that affect this action's weight and attempt chance */
  pressureModifiers: PressureModifier[];
  /** Actor configuration for filtering valid actors */
  actorConfig: ActionActorConfig;
  /**
   * Delta to apply to actor prominence on success/failure.
   */
  actorProminenceDelta: {
    onSuccess: number;
    onFailure: number;
  };
  /**
   * Delta to apply to target prominence on success/failure.
   */
  targetProminenceDelta: {
    onSuccess: number;
    onFailure: number;
  };
  handler: (graph: WorldRuntime, actor: HardState) => ActionResult;
}

/**
 * Action execution result.
 */
export interface ActionResult {
  success: boolean;
  relationships: Relationship[];
  relationshipsAdjusted?: Array<{ kind: string; src: string; dst: string; delta: number }>;
  /** Relationships to archive (deferred until worldEngine applies with proper context) */
  relationshipsToArchive?: Array<{ kind: string; src: string; dst: string }>;
  entitiesModified?: Array<{ id: string; changes: Partial<HardState> }>;
  pressureChanges?: Record<string, number>;
  description: string;
  /** Domain-controlled narrative text (from narrationTemplate). */
  narration?: string;
  entitiesCreated?: string[];
  instigatorId?: string;
  targetId?: string;
  target2Id?: string;
  failureReason?: 'no_instigator' | 'no_target' | 'actor_conditions' | 'mutation_failed';
}

// =============================================================================
// ACTION INTERPRETATION HELPERS
// =============================================================================

function resolveSingleEntity(select: VariableSelectionRule, ctx: RuleContext): HardState | undefined {
  const candidates = selectVariableEntities(select, ctx);

  if (candidates.length === 0) {
    return undefined;
  }

  const pickStrategy = select.pickStrategy ?? 'random';
  const picked = applyPickStrategy(candidates, pickStrategy, select.maxResults);
  return picked.length > 0 ? picked[0] : undefined;
}

function resolveInstigator(
  config: InstigatorSelectionRule | undefined,
  ctx: RuleContext
): { instigator: HardState | null; failureReason?: ActionResult['failureReason']; failureDescription?: string } {
  if (!config) {
    return { instigator: null };
  }

  const instigator = resolveSingleEntity(config, ctx);

  if (!instigator && config.required) {
    return {
      instigator: null,
      failureReason: 'no_instigator',
      failureDescription: 'no instigator available to perform the action',
    };
  }

  return { instigator: instigator ?? null };
}

function formatDescription(
  template: string,
  bindings: {
    actor: HardState;
    instigator?: HardState | null;
    target?: HardState;
    target2?: HardState;
  }
): string {
  const tokenMap: Record<string, string> = {
    'actor.name': bindings.actor?.name ?? '',
    'actor.id': bindings.actor?.id ?? '',
    'instigator.name': bindings.instigator?.name ?? '',
    'instigator.id': bindings.instigator?.id ?? '',
    'target.name': bindings.target?.name ?? '',
    'target.id': bindings.target?.id ?? '',
    'target2.name': bindings.target2?.name ?? '',
    'target2.id': bindings.target2?.id ?? '',
  };

  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    return tokenMap[key] ?? '';
  });
}

/**
 * Format narration using the full template system with variable support.
 */
function formatNarration(
  template: string,
  bindings: {
    actor: HardState;
    instigator?: HardState | null;
    target?: HardState;
    target2?: HardState;
    variables?: Record<string, HardState | undefined>;
  }
): string {
  const context = createNarrationContext({
    actor: bindings.actor,
    target: bindings.target,
    target2: bindings.target2,
    instigator: bindings.instigator,
    variables: bindings.variables,
  });

  const result = interpolate(template, context);
  return result.text;
}

function evaluateActorConditions(
  conditions: Condition[] | undefined,
  ctx: RuleContext
): { passed: boolean; diagnostic?: string } {
  if (!conditions || conditions.length === 0) {
    return { passed: true };
  }

  for (const condition of conditions) {
    const result = evaluateCondition(condition, ctx, ctx.self);
    if (!result.passed) {
      return { passed: false, diagnostic: result.diagnostic };
    }
  }

  return { passed: true };
}

// =============================================================================
// ACTION HANDLER
// =============================================================================

/**
 * Create an executable action handler from declarative configuration.
 */
function createActionHandler(action: DeclarativeAction): ExecutableAction['handler'] {
  return (graph: WorldRuntime, actor: HardState): ActionResult => {
    const bindings: Record<string, HardState | undefined> = { actor };
    const baseCtx = createActionContext(graph, bindings, actor);

    // Resolve optional instigator
    const instigatorResult = resolveInstigator(action.actor.instigator, baseCtx);
    if (instigatorResult.failureReason) {
      return {
        success: false,
        relationships: [],
        description: instigatorResult.failureDescription || 'no instigator available',
        failureReason: instigatorResult.failureReason,
      };
    }

    const instigator = instigatorResult.instigator;
    bindings.instigator = instigator ?? undefined;

    // Evaluate actor conditions
    const conditionsResult = evaluateActorConditions(action.actor.conditions, baseCtx);
    if (!conditionsResult.passed) {
      return {
        success: false,
        relationships: [],
        description: conditionsResult.diagnostic || 'actor conditions not met',
        failureReason: 'actor_conditions',
      };
    }

    // Select targets
    const targetingRule: SelectionRule = {
      ...action.targeting,
      pickStrategy: action.targeting.pickStrategy ?? 'random',
    };

    const targets = selectEntities(targetingRule, baseCtx);
    if (targets.length === 0) {
      return {
        success: false,
        relationships: [],
        description: 'found no valid targets',
        failureReason: 'no_target',
      };
    }

    const requiredTargets = action.targeting.maxResults && action.targeting.maxResults > 1
      ? action.targeting.maxResults
      : 1;

    if (targets.length < requiredTargets) {
      return {
        success: false,
        relationships: [],
        description: 'found insufficient targets',
        failureReason: 'no_target',
      };
    }

    const target = targets[0];
    const target2 = targets[1];
    bindings.target = target;
    bindings.target2 = target2;

    // Resolve optional variables
    if (action.variables) {
      const varCtx = createActionContext(graph, bindings, actor);
      const resolvedVars = resolveVariablesForEntity(action.variables, varCtx, actor);
      if (resolvedVars === null) {
        // A required variable couldn't be resolved
        return {
          success: false,
          relationships: [],
          description: 'required variable could not be resolved',
          failureReason: 'no_target',
        };
      }
      // Add resolved variables to bindings (with $ prefix stripped by resolveVariablesForEntity)
      for (const [varName, entity] of Object.entries(resolvedVars)) {
        bindings[varName] = entity;
      }
    }

    const mutationCtx = createActionContext(graph, bindings, actor);
    const prepared = (action.outcome.mutations ?? []).map((mutation) => prepareMutation(mutation, mutationCtx));
    const failed = prepared.filter((result) => !result.applied);

    if (failed.length > 0) {
      return {
        success: false,
        relationships: [],
        description: failed[0]?.diagnostic || 'action mutations failed',
        failureReason: 'mutation_failed',
      };
    }

    const relationships: Relationship[] = [];
    const relationshipsAdjusted: Array<{ kind: string; src: string; dst: string; delta: number }> = [];
    const relationshipsToArchive: Array<{ kind: string; src: string; dst: string }> = [];
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const pressureChanges: Record<string, number> = {};

    for (const result of prepared) {
      if (result.entityModifications.length > 0) {
        // Type assertion: EntityModification has TagPatch (with undefined for deletions)
        // but ActionResult expects Partial<HardState> - these are compatible at runtime
        modifications.push(...result.entityModifications as typeof modifications[number][]);
      }

      if (result.relationshipsCreated.length > 0) {
        for (const rel of result.relationshipsCreated) {
          relationships.push({
            kind: rel.kind,
            src: rel.src,
            dst: rel.dst,
            strength: rel.strength,
            category: rel.category,
            createdAt: graph.tick,
          });
        }
      }

      if (result.relationshipsAdjusted.length > 0) {
        relationshipsAdjusted.push(...result.relationshipsAdjusted);
      }

      if (result.relationshipsToArchive.length > 0) {
        relationshipsToArchive.push(...result.relationshipsToArchive);
      }

      for (const [pressureId, delta] of Object.entries(result.pressureChanges)) {
        pressureChanges[pressureId] = (pressureChanges[pressureId] || 0) + delta;
      }
    }

    const description = formatDescription(action.outcome.descriptionTemplate, {
      actor,
      instigator,
      target,
      target2,
    });

    // Generate narration from template if provided
    let narration: string | undefined;
    if (action.outcome.narrationTemplate) {
      // Convert bindings to variables format for narration context
      const variables: Record<string, HardState | undefined> = {};
      for (const [key, entity] of Object.entries(bindings)) {
        if (entity && key !== 'actor' && key !== 'target' && key !== 'target2' && key !== 'instigator') {
          variables[key] = entity;
        }
      }

      narration = formatNarration(action.outcome.narrationTemplate, {
        actor,
        instigator,
        target,
        target2,
        variables,
      });
    }

    return {
      success: true,
      relationships,
      relationshipsAdjusted,
      relationshipsToArchive,
      entitiesModified: modifications,
      pressureChanges,
      description,
      narration,
      instigatorId: instigator?.id,
      targetId: target?.id,
      target2Id: target2?.id,
    };
  };
}

// =============================================================================
// ACTION FACTORY
// =============================================================================

/**
 * Convert a declarative action to an executable action.
 */
export function createExecutableAction(action: DeclarativeAction): ExecutableAction {
  return {
    type: action.id,
    name: action.name,
    description: action.description,
    baseSuccessChance: action.probability.baseSuccessChance,
    baseWeight: action.probability.baseWeight,
    pressureModifiers: action.probability.pressureModifiers || [],
    actorConfig: action.actor,
    actorProminenceDelta: {
      onSuccess: action.outcome.actorProminenceDelta?.onSuccess ?? 0,
      onFailure: action.outcome.actorProminenceDelta?.onFailure ?? 0,
    },
    targetProminenceDelta: {
      onSuccess: action.outcome.targetProminenceDelta?.onSuccess ?? 0,
      onFailure: action.outcome.targetProminenceDelta?.onFailure ?? 0,
    },
    handler: createActionHandler(action)
  };
}

/**
 * Load declarative actions and convert them to executable actions.
 */
export function loadActions(actions: DeclarativeAction[]): ExecutableAction[] {
  if (!Array.isArray(actions)) {
    console.warn('loadActions: expected array, got', typeof actions);
    return [];
  }

  const executableActions: ExecutableAction[] = [];

  for (const action of actions) {
    if (!action || !action.id) {
      console.warn('loadActions: skipping invalid action', action);
      continue;
    }

    // Skip disabled actions (default to enabled if not specified)
    if (action.enabled === false) {
      continue;
    }

    try {
      const executable = createExecutableAction(action);
      executableActions.push(executable);
    } catch (error) {
      console.error(`Failed to create action ${action.id}:`, error);
    }
  }

  return executableActions;
}
