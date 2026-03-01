/**
 * Graph Path Evaluation
 *
 * Supports multi-hop traversals with intermediate variable storage
 * and constraint evaluation on the final entities.
 */

import { HardState } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { GraphPathAssertion, PathStep, PathConstraint } from './filters/types';
import { Direction } from './types';
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
function collectRelatedEntities(
  entity: HardState,
  viaKinds: string[],
  direction: Direction,
  graphView: WorldRuntime
): HardState[] {
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
  return related;
}

function filterByStepCriteria(entities: HardState[], step: PathStep): HardState[] {
  let filtered = entities;
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

function traverseStep(
  entity: HardState,
  step: PathStep,
  graphView: WorldRuntime
): HardState[] {
  let direction: 'src' | 'dst' | 'both';
  if (step.direction === 'out') direction = 'src';
  else if (step.direction === 'in') direction = 'dst';
  else direction = 'both';
  const viaKinds = Array.isArray(step.via) ? step.via : [step.via];
  const related = collectRelatedEntities(entity, viaKinds, direction, graphView);
  return filterByStepCriteria(related, step);
}

function evaluateSingleConstraint(
  entity: HardState,
  startEntity: HardState,
  constraint: PathConstraint,
  resolver: EntityResolver
): boolean {
  const graphView = resolver.getGraphView();

  switch (constraint.type) {
    case 'not_in': {
      const set = resolver.getPathSet(constraint.set);
      return !(set && set.has(entity.id));
    }
    case 'in': {
      const set = resolver.getPathSet(constraint.set);
      return !!(set && set.has(entity.id));
    }
    case 'not_self':
      return entity.id !== startEntity.id;
    case 'kind_equals':
      return entity.kind === constraint.kind;
    case 'subtype_equals':
      return entity.subtype === constraint.subtype;
    case 'lacks_relationship':
      return evaluateRelConstraint(entity, startEntity, constraint, graphView, resolver, false);
    case 'has_relationship':
      return evaluateRelConstraint(entity, startEntity, constraint, graphView, resolver, true);
    default:
      return true;
  }
}

function evaluateRelConstraint(
  entity: HardState,
  startEntity: HardState,
  constraint: PathConstraint & { kind: string; with: string; direction?: string },
  graphView: WorldRuntime,
  resolver: EntityResolver,
  requireExists: boolean
): boolean {
  let direction: 'src' | 'dst' | 'both';
  if (constraint.direction === 'out') direction = 'src';
  else if (constraint.direction === 'in') direction = 'dst';
  else direction = 'both';
  const withEntity = constraint.with === '$self' ? startEntity :
                    resolver.resolveEntity(constraint.with);

  if (withEntity) {
    const hasRel = graphView.hasRelationship(entity.id, withEntity.id, constraint.kind) ||
                  (direction === 'both' && graphView.hasRelationship(withEntity.id, entity.id, constraint.kind));
    return requireExists ? hasRel : !hasRel;
  }

  if (requireExists) {
    const related = graphView.getConnectedEntities(entity.id, constraint.kind, 'both');
    return related.length > 0;
  }
  return true;
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
  return constraints.every(c => evaluateSingleConstraint(entity, startEntity, c, resolver));
}
