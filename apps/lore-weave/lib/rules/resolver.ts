/**
 * Entity Resolution
 *
 * Provides a unified interface for resolving entity references (like $actor, $target)
 * that works across different contexts (templates, actions, systems).
 */

import { HardState } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';

/**
 * Interface for resolving entity references in selection filters.
 */
export interface EntityResolver {
  /** Resolve a reference like "$actor", "$target", "$varName" to an entity */
  resolveEntity(ref: string): HardState | undefined;

  /** Get the graph view for relationship queries */
  getGraphView(): WorldRuntime;

  /** Store intermediate path results (for graph_path filter) */
  setPathSet(name: string, ids: Set<string>): void;

  /** Get stored path results */
  getPathSet(name: string): Set<string> | undefined;
}

/**
 * Entity resolver for action context.
 * Resolves action bindings like $actor, $instigator, $target.
 */
export class ActionEntityResolver implements EntityResolver {
  private pathSets: Map<string, Set<string>> = new Map();

  constructor(
    private graphView: WorldRuntime,
    private bindings: Record<string, HardState | undefined>
  ) {}

  resolveEntity(ref: string): HardState | undefined {
    if (!ref.startsWith('$')) {
      // Literal entity ID
      return this.graphView.getEntity(ref);
    }

    const varName = ref.slice(1); // Remove $

    if (varName === 'self') {
      // In action context, $self is handled by callers (filters/conditions)
      return undefined;
    }

    return this.bindings[varName];
  }

  getGraphView(): WorldRuntime {
    return this.graphView;
  }

  setPathSet(name: string, ids: Set<string>): void {
    this.pathSets.set(name, ids);
  }

  getPathSet(name: string): Set<string> | undefined {
    return this.pathSets.get(name);
  }
}

/**
 * Simple entity resolver that only handles literal IDs.
 * Useful for system context where there are no variable references.
 */
export class SimpleEntityResolver implements EntityResolver {
  private pathSets: Map<string, Set<string>> = new Map();

  constructor(private graphView: WorldRuntime) {}

  resolveEntity(ref: string): HardState | undefined {
    if (ref.startsWith('$')) {
      return undefined;
    }
    return this.graphView.getEntity(ref);
  }

  getGraphView(): WorldRuntime {
    return this.graphView;
  }

  setPathSet(name: string, ids: Set<string>): void {
    this.pathSets.set(name, ids);
  }

  getPathSet(name: string): Set<string> | undefined {
    return this.pathSets.get(name);
  }
}
