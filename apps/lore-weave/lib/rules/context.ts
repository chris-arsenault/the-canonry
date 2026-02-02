/**
 * RuleContext - Unified context for all rule handlers.
 *
 * Provides a consistent interface for conditions, metrics, mutations,
 * filters, and selections to access graph state and resolve entities.
 */

import { HardState } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import {
  EntityResolver,
  SimpleEntityResolver,
  ActionEntityResolver,
} from './resolver';

/**
 * Unified context for all rule evaluation.
 *
 * This replaces the need for separate context objects in different
 * interpreters (ExecutionContext, ActionEntityResolver, etc.).
 */
export interface RuleContext {
  /** Graph access for all queries and mutations */
  readonly graph: WorldRuntime;

  /** Current simulation tick */
  readonly tick: number;

  /** Entity resolver for references like $actor, $target */
  readonly resolver: EntityResolver;

  /** Current entity being evaluated (for per-entity conditions) */
  readonly self?: HardState;

  /** Named entity bindings for context-specific references (e.g., $source) */
  readonly entities?: Record<string, HardState | undefined>;

  /** Named values for context-specific lookups (e.g., tag value sources) */
  readonly values?: Record<string, string | number | boolean>;

  /** Path sets for graph traversal (used by graph_path filter) */
  readonly pathSets: Map<string, Set<string>>;
}

/**
 * Create a RuleContext from a WorldRuntime and EntityResolver.
 *
 * @param graph - Graph view
 * @param resolver - Entity resolver
 * @param self - Optional current entity
 */
export function createRuleContext(
  graph: WorldRuntime,
  resolver: EntityResolver,
  self?: HardState
): RuleContext {
  return {
    graph,
    tick: graph.tick,
    resolver,
    self,
    entities: {},
    values: {},
    pathSets: new Map(),
  };
}

/**
 * Create a RuleContext for system execution (no variable resolution).
 *
 * @param graph - Graph view
 */
export function createSystemContext(graph: WorldRuntime): RuleContext {
  const resolver = new SimpleEntityResolver(graph);

  return {
    graph,
    tick: graph.tick,
    resolver,
    self: undefined,
    entities: {},
    values: {},
    pathSets: new Map(),
  };
}

/**
 * Create a RuleContext for action execution.
 *
 * @param graph - Graph view
 * @param actor - The acting entity
 * @param self - Optional current entity being evaluated
 */
export function createActionContext(
  graph: WorldRuntime,
  bindings: Record<string, HardState | undefined>,
  self?: HardState,
  values?: Record<string, string | number | boolean>
): RuleContext {
  const resolver = new ActionEntityResolver(graph, bindings);

  return {
    graph,
    tick: graph.tick,
    resolver,
    self,
    entities: bindings,
    values: values ?? {},
    pathSets: new Map(),
  };
}

/**
 * Create a RuleContext with a specific entity as self.
 *
 * @param ctx - Base context
 * @param self - Entity to set as self
 */
export function withSelf(ctx: RuleContext, self: HardState): RuleContext {
  return {
    ...ctx,
    self,
  };
}
