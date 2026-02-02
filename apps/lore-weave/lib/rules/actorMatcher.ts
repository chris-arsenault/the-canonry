/**
 * Actor matching - checks if an entity can perform an action based on actor config.
 *
 * Uses the shared selection/condition modules from rules/ to avoid drift.
 */

import { HardState } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { ActionActorConfig } from '../engine/actionInterpreter';
import { applyPickStrategy, selectEntities, selectVariableEntities } from './selection';
import { createActionContext } from './context';
import { evaluateCondition } from './conditions';
import type { RuleContext } from './context';
import type { VariableSelectionRule } from './selection/types';

function resolveSingleEntity(select: VariableSelectionRule, ctx: RuleContext): HardState | undefined {
  const candidates = selectVariableEntities(select, ctx);

  if (candidates.length === 0) {
    return undefined;
  }

  const pickStrategy = select.pickStrategy ?? 'random';
  const picked = applyPickStrategy(candidates, pickStrategy, select.maxResults);
  return picked.length > 0 ? picked[0] : undefined;
}

/**
 * Check if an entity matches the actor configuration for an action.
 */
export function matchesActorConfig(
  entity: HardState,
  actorConfig: ActionActorConfig,
  graphView: WorldRuntime
): boolean {
  const bindings: Record<string, HardState | undefined> = { actor: entity };
  const ctx = createActionContext(graphView, bindings, entity);

  // Eligibility: actor must appear in selection results (no random picking).
  const selectionRule = {
    ...actorConfig.selection,
    pickStrategy: 'all' as const,
    maxResults: undefined,
  };

  const candidates = selectEntities(selectionRule, ctx);
  if (!candidates.some((candidate) => candidate.id === entity.id)) {
    return false;
  }

  // Resolve optional instigator
  if (actorConfig.instigator) {
    const instigator = resolveSingleEntity(actorConfig.instigator, ctx);
    if (!instigator && actorConfig.instigator.required) {
      return false;
    }
    bindings.instigator = instigator;
  }

  // Evaluate conditions
  if (actorConfig.conditions && actorConfig.conditions.length > 0) {
    for (const condition of actorConfig.conditions) {
      const result = evaluateCondition(condition, ctx, entity);
      if (!result.passed) {
        return false;
      }
    }
  }

  return true;
}
