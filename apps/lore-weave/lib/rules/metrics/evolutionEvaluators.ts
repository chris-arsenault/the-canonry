/**
 * Evolution Metric Evaluators
 *
 * Evaluator for shared_relationship metric, including multi-hop via traversal.
 */

import type { HardState, Relationship } from '../../core/worldTypes';
import type {
  MetricResult,
  SharedRelationshipMetric,
} from './types';
import type { MetricContext } from './index';

/** Collect entity targets via a single-hop shared relationship pattern. */
function collectSingleHopTargets(
  entity: HardState,
  kinds: string[],
  direction: 'src' | 'dst',
  minStrength: number,
  rels: readonly Relationship[]
): Set<string> {
  const targets = new Set<string>();
  for (const link of rels) {
    if (!kinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;
    if (direction === 'src' && link.src === entity.id) targets.add(link.dst);
    if (direction === 'dst' && link.dst === entity.id) targets.add(link.src);
  }
  return targets;
}

/** Count other entities that share targets via the same relationship pattern. */
function countSharedEntities(
  entity: HardState,
  myTargets: Set<string>,
  kinds: string[],
  direction: 'src' | 'dst',
  minStrength: number,
  rels: readonly Relationship[]
): Set<string> {
  const sharedCount = new Set<string>();
  for (const link of rels) {
    if (!kinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    let otherId: string | null = null;
    let targetId: string | null = null;

    if (direction === 'src' && link.src !== entity.id) {
      otherId = link.src;
      targetId = link.dst;
    } else if (direction === 'dst' && link.dst !== entity.id) {
      otherId = link.dst;
      targetId = link.src;
    }

    if (otherId && targetId && myTargets.has(targetId)) {
      sharedCount.add(otherId);
    }
  }
  return sharedCount;
}

/** Build an index mapping source IDs to sets of target IDs from relationship list. */
function buildRelIndex(
  rels: readonly Relationship[],
  kinds: string[],
  direction: 'src' | 'dst',
  minStrength: number,
  kindFilter?: { ctx: MetricContext; intermediateKind: string }
): { forward: Map<string, Set<string>>; reverse: Map<string, Set<string>> } {
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  for (const link of rels) {
    if (!kinds.includes(link.kind)) continue;
    if ((link.strength ?? 0) < minStrength) continue;

    const sourceId = direction === 'src' ? link.src : link.dst;
    const targetId = direction === 'src' ? link.dst : link.src;

    if (kindFilter) {
      const target = kindFilter.ctx.graph.getEntity(targetId);
      if (!target || target.kind !== kindFilter.intermediateKind) continue;
    }

    if (!forward.has(sourceId)) forward.set(sourceId, new Set());
    forward.get(sourceId)!.add(targetId);

    if (!reverse.has(targetId)) reverse.set(targetId, new Set());
    reverse.get(targetId)!.add(sourceId);
  }

  return { forward, reverse };
}

/** Collect all targets reachable from a set of intermediates via the shared relationship index. */
function collectReachableTargets(
  intermediates: Set<string>,
  sharedIndex: Map<string, Set<string>>
): Set<string> {
  const targets = new Set<string>();
  for (const intermediateId of intermediates) {
    const reachable = sharedIndex.get(intermediateId);
    if (reachable) {
      for (const targetId of reachable) {
        targets.add(targetId);
      }
    }
  }
  return targets;
}

/** Find entities that share targets via intermediates (multi-hop pattern). */
function findSharedViaEntities(
  entity: HardState,
  myTargets: Set<string>,
  myIntermediates: Set<string>,
  reverseSharedIndex: Map<string, Set<string>>,
  reverseViaIndex: Map<string, Set<string>>
): Set<string> {
  const sharedEntities = new Set<string>();
  for (const targetId of myTargets) {
    const otherIntermediates = reverseSharedIndex.get(targetId);
    if (!otherIntermediates) continue;

    for (const otherIntermediateId of otherIntermediates) {
      if (myIntermediates.has(otherIntermediateId)) continue;

      const owners = reverseViaIndex.get(otherIntermediateId);
      if (!owners) continue;
      for (const ownerId of owners) {
        if (ownerId !== entity.id) {
          sharedEntities.add(ownerId);
        }
      }
    }
  }
  return sharedEntities;
}

/**
 * Multi-hop shared relationship evaluation.
 * Pattern: Entity -> via -> Intermediate -> sharedRelKind -> Target <- sharedRelKind <- OtherIntermediate <- via <- OtherEntity
 */
function evaluateSharedRelationshipVia(
  entity: HardState,
  metric: SharedRelationshipMetric,
  sharedKinds: string[],
  sharedDirection: 'src' | 'dst',
  minStrength: number,
  rels: readonly Relationship[],
  ctx: MetricContext
): MetricResult {
  const via = metric.via!;
  const viaKind = via.relationshipKind;
  const viaDirection = via.direction ?? 'src';

  const kindFilter = via.intermediateKind
    ? { ctx, intermediateKind: via.intermediateKind }
    : undefined;

  const viaIndexes = buildRelIndex(rels, [viaKind], viaDirection, 0, kindFilter);

  const myIntermediates = viaIndexes.forward.get(entity.id) ?? new Set<string>();
  if (myIntermediates.size === 0) {
    return {
      value: 0,
      diagnostic: `shared via ${viaKind}->${sharedKinds.join('/')}: no intermediates`,
      details: { via: viaKind, sharedRelationshipKind: sharedKinds, intermediateCount: 0 },
    };
  }

  const sharedIndexes = buildRelIndex(rels, sharedKinds, sharedDirection, minStrength);
  const myTargets = collectReachableTargets(myIntermediates, sharedIndexes.forward);

  if (myTargets.size === 0) {
    return {
      value: 0,
      diagnostic: `shared via ${viaKind}->${sharedKinds.join('/')}: no targets`,
      details: {
        via: viaKind,
        sharedRelationshipKind: sharedKinds,
        intermediateCount: myIntermediates.size,
        targetCount: 0,
      },
    };
  }

  const sharedEntities = findSharedViaEntities(
    entity, myTargets, myIntermediates,
    sharedIndexes.reverse, viaIndexes.reverse
  );

  let value = sharedEntities.size * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `shared via ${viaKind}->${sharedKinds.join('/')}=${sharedEntities.size}`,
    details: {
      via: viaKind,
      viaDirection,
      intermediateKind: via.intermediateKind,
      sharedRelationshipKind: sharedKinds,
      sharedDirection,
      intermediateCount: myIntermediates.size,
      targetCount: myTargets.size,
      sharedCount: sharedEntities.size,
      minStrength,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

export function evaluateSharedRelationship(
  metric: SharedRelationshipMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for shared relationship', details: {} };
  }

  const kinds = Array.isArray(metric.sharedRelationshipKind)
    ? metric.sharedRelationshipKind
    : [metric.sharedRelationshipKind];

  const direction = metric.sharedDirection ?? 'src';
  const minStrength = metric.minStrength ?? 0;
  const rels = ctx.graph.getAllRelationships();

  if (metric.via) {
    return evaluateSharedRelationshipVia(entity, metric, kinds, direction, minStrength, rels, ctx);
  }

  const myTargets = collectSingleHopTargets(entity, kinds, direction, minStrength, rels);
  const sharedCount = countSharedEntities(entity, myTargets, kinds, direction, minStrength, rels);

  let value = sharedCount.size * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `shared ${kinds.join('/')}=${sharedCount.size}`,
    details: {
      sharedRelationshipKind: kinds,
      sharedDirection: direction,
      myTargetCount: myTargets.size,
      sharedCount: sharedCount.size,
      minStrength,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}
