/**
 * Graph Path Evaluation
 *
 * Supports multi-hop traversals with intermediate variable storage
 * and constraint evaluation on the final entities.
 */

import { HardState } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { GraphPathAssertion, PathStep, PathConstraint } from './filters/types';
import { EntityResolver } from './resolver';

export interface GraphPathOptions {
  filterEvaluator?: (
    entities: HardState[],
    filters: PathStep['filters'],
    resolver: EntityResolver,
    options?: GraphPathOptions
  ) => HardState[];
}

/**
 * Evaluate a graph path assertion starting from an entity.
 * Returns true if the assertion passes.
 */
export function evaluateGraphPath(
  startEntity: HardState,
  assertion: GraphPathAssertion,
  resolver: EntityResolver,
  options?: GraphPathOptions
): boolean {
  const graphView = resolver.getGraphView();
  const filterEvaluator = options?.filterEvaluator;

  // Traverse the path, collecting entities at each step
  let currentEntities: HardState[] = [startEntity];

  for (const step of assertion.path) {
    const nextEntities: HardState[] = [];

    for (const entity of currentEntities) {
      const related = traverseStep(entity, step, graphView);
      nextEntities.push(...related);
    }

    let filteredEntities = nextEntities;
    if (step.filters && step.filters.length > 0 && filterEvaluator) {
      filteredEntities = filterEvaluator(nextEntities, step.filters, resolver, options);
    }

    // Store intermediate results if requested (for constraints like "not_in")
    if (step.as) {
      resolver.setPathSet(step.as, new Set(filteredEntities.map(e => e.id)));
    }
    currentEntities = filteredEntities;
  }

  // Apply constraints to filter final entities
  if (assertion.where) {
    currentEntities = currentEntities.filter(entity =>
      evaluatePathConstraints(entity, startEntity, assertion.where!, resolver)
    );
  }

  // Evaluate the assertion
  switch (assertion.check) {
    case 'exists':
      return currentEntities.length > 0;

    case 'not_exists':
      return currentEntities.length === 0;

    case 'count_min':
      return currentEntities.length >= (assertion.count ?? 1);

    case 'count_max':
      return currentEntities.length <= (assertion.count ?? 0);

    default:
      return false;
  }
}

/**
 * Traverse one step in a graph path.
 */
function traverseStep(
  entity: HardState,
  step: PathStep,
  graphView: WorldRuntime
): HardState[] {
  // Convert direction format from JSON ('out'/'in'/'any') to internal ('src'/'dst'/'both')
  const direction = step.direction === 'out' ? 'src' :
                   step.direction === 'in' ? 'dst' : 'both';

  // Support both single relationship kind and array of kinds
  const viaKinds = Array.isArray(step.via) ? step.via : [step.via];

  // Collect entities connected via any of the specified relationship kinds
  const relatedSet = new Set<string>();
  const related: HardState[] = [];

  for (const viaKind of viaKinds) {
    const entities = graphView.getConnectedEntities(entity.id, viaKind, direction);
    for (const e of entities) {
      if (!relatedSet.has(e.id)) {
        relatedSet.add(e.id);
        related.push(e);
      }
    }
  }

  // Filter by target kind/subtype/status ("any" means no filtering)
  let filtered = related;
  if (step.targetKind && step.targetKind !== 'any') {
    filtered = filtered.filter(e => e.kind === step.targetKind);
  }
  if (step.targetSubtype && step.targetSubtype !== 'any') {
    filtered = filtered.filter(e => e.subtype === step.targetSubtype);
  }
  if (step.targetStatus && step.targetStatus !== 'any') {
    filtered = filtered.filter(e => e.status === step.targetStatus);
  }

  return filtered;
}

/**
 * Evaluate constraints on a path target entity.
 */
function evaluatePathConstraints(
  entity: HardState,
  startEntity: HardState,
  constraints: PathConstraint[],
  resolver: EntityResolver
): boolean {
  const graphView = resolver.getGraphView();

  for (const constraint of constraints) {
    switch (constraint.type) {
      case 'not_in': {
        const set = resolver.getPathSet(constraint.set);
        if (set && set.has(entity.id)) {
          return false;
        }
        break;
      }

      case 'in': {
        const set = resolver.getPathSet(constraint.set);
        if (!set || !set.has(entity.id)) {
          return false;
        }
        break;
      }

      case 'not_self': {
        if (entity.id === startEntity.id) {
          return false;
        }
        break;
      }

      case 'lacks_relationship': {
        const direction = constraint.direction === 'out' ? 'src' :
                         constraint.direction === 'in' ? 'dst' : 'both';
        const withEntity = constraint.with === '$self' ? startEntity :
                          resolver.resolveEntity(constraint.with);

        if (withEntity) {
          const hasRel = graphView.hasRelationship(entity.id, withEntity.id, constraint.kind) ||
                        (direction === 'both' && graphView.hasRelationship(withEntity.id, entity.id, constraint.kind));
          if (hasRel) {
            return false;
          }
        }
        break;
      }

      case 'has_relationship': {
        const direction = constraint.direction === 'out' ? 'src' :
                         constraint.direction === 'in' ? 'dst' : 'both';
        const withEntity = constraint.with === '$self' ? startEntity :
                          resolver.resolveEntity(constraint.with);

        if (withEntity) {
          const hasRel = graphView.hasRelationship(entity.id, withEntity.id, constraint.kind) ||
                        (direction === 'both' && graphView.hasRelationship(withEntity.id, entity.id, constraint.kind));
          if (!hasRel) {
            return false;
          }
        } else {
          // No withEntity specified - just check if any such relationship exists
          const related = graphView.getConnectedEntities(entity.id, constraint.kind, 'both');
          if (related.length === 0) {
            return false;
          }
        }
        break;
      }

      case 'kind_equals': {
        if (entity.kind !== constraint.kind) {
          return false;
        }
        break;
      }

      case 'subtype_equals': {
        if (entity.subtype !== constraint.subtype) {
          return false;
        }
        break;
      }
    }
  }

  return true;
}
