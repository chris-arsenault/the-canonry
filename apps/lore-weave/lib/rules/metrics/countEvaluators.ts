/**
 * Count Metric Evaluators
 *
 * Evaluators for entity_count, relationship_count, tag_count,
 * total_entities, constant, and connection_count metrics.
 */

import type { HardState, Relationship } from '../../core/worldTypes';
import { hasTag } from '../../utils';
import { normalizeDirection } from '../types';
import type {
  MetricResult,
  SimpleCountMetric,
  EntityCountMetric,
  RelationshipCountMetric,
  TagCountMetric,
  TotalEntitiesMetric,
  ConstantMetric,
  ConnectionCountMetric,
} from './types';
import type { MetricContext } from './index';

/**
 * Evaluate a simple count metric (for use in ratios).
 */
export function evaluateSimpleCount(
  metric: SimpleCountMetric,
  ctx: MetricContext
): number {
  switch (metric.type) {
    case 'entity_count': {
      let entities = ctx.graph.findEntities({ kind: metric.kind });
      if (metric.subtype) {
        entities = entities.filter((e) => e.subtype === metric.subtype);
      }
      if (metric.status) {
        entities = entities.filter((e) => e.status === metric.status);
      }
      return entities.length;
    }

    case 'relationship_count': {
      const rels = ctx.graph.getAllRelationships();
      if (!metric.relationshipKinds || metric.relationshipKinds.length === 0) {
        return rels.length;
      }
      return rels.filter((r) => metric.relationshipKinds!.includes(r.kind)).length;
    }

    case 'tag_count': {
      const entities = ctx.graph.getEntities();
      return entities.filter((e) =>
        metric.tags.some((tag) => hasTag(e.tags, tag))
      ).length;
    }

    case 'total_entities':
      return ctx.graph.getEntities().length;

    case 'constant':
      return metric.value;

    default:
      return 0;
  }
}

/** Apply coefficient and cap to a raw count. */
function applyCoeffAndCap(raw: number, coefficient: number | undefined, cap: number | undefined): number {
  let value = raw * (coefficient ?? 1);
  if (cap !== undefined) {
    value = Math.min(value, cap);
  }
  return value;
}

export function evaluateEntityCount(
  metric: EntityCountMetric,
  ctx: MetricContext
): MetricResult {
  let entities = ctx.graph.findEntities({ kind: metric.kind });
  if (metric.subtype) {
    entities = entities.filter((e) => e.subtype === metric.subtype);
  }
  if (metric.status) {
    entities = entities.filter((e) => e.status === metric.status);
  }

  const rawCount = entities.length;
  const value = applyCoeffAndCap(rawCount, metric.coefficient, metric.cap);
  const desc = `${metric.kind}${metric.subtype ? ':' + metric.subtype : ''}`;

  return {
    value,
    diagnostic: `${desc} count=${rawCount}${metric.coefficient ? ' * ' + metric.coefficient : ''}`,
    details: {
      kind: metric.kind,
      subtype: metric.subtype,
      status: metric.status,
      rawCount,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

function matchesRelFilter(
  r: Readonly<Relationship>,
  metric: RelationshipCountMetric,
  entity: HardState | undefined,
  direction: 'src' | 'dst' | 'both'
): boolean {
  if (metric.relationshipKinds?.length && !metric.relationshipKinds.includes(r.kind)) {
    return false;
  }
  if (metric.minStrength !== undefined && (r.strength ?? 0) < metric.minStrength) {
    return false;
  }
  if (!entity) return true;
  if (direction === 'both') return r.src === entity.id || r.dst === entity.id;
  if (direction === 'src') return r.src === entity.id;
  return r.dst === entity.id;
}

export function evaluateRelationshipCount(
  metric: RelationshipCountMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  const direction = normalizeDirection(metric.direction);
  const rels = ctx.graph.getAllRelationships();
  const count = rels.filter((r) => matchesRelFilter(r, metric, entity, direction)).length;
  const value = applyCoeffAndCap(count, metric.coefficient, metric.cap);

  return {
    value,
    diagnostic: `relationship count=${count}`,
    details: {
      relationshipKinds: metric.relationshipKinds,
      direction: metric.direction,
      minStrength: metric.minStrength,
      rawCount: count,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

export function evaluateTagCount(
  metric: TagCountMetric,
  ctx: MetricContext
): MetricResult {
  const entities = ctx.graph.getEntities();
  const count = entities.filter((e) =>
    metric.tags.some((tag) => hasTag(e.tags, tag))
  ).length;

  const value = applyCoeffAndCap(count, metric.coefficient, metric.cap);

  return {
    value,
    diagnostic: `tag count (${metric.tags.join(', ')})=${count}`,
    details: {
      tags: metric.tags,
      rawCount: count,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

export function evaluateTotalEntities(
  metric: TotalEntitiesMetric,
  ctx: MetricContext
): MetricResult {
  const count = ctx.graph.getEntities().length;
  const value = applyCoeffAndCap(count, metric.coefficient, metric.cap);

  return {
    value,
    diagnostic: `total entities=${count}`,
    details: { rawCount: count, coefficient: metric.coefficient, cap: metric.cap },
  };
}

export function evaluateConstant(metric: ConstantMetric): MetricResult {
  const value = metric.value * (metric.coefficient ?? 1);

  return {
    value,
    diagnostic: `constant=${metric.value}`,
    details: { value: metric.value, coefficient: metric.coefficient },
  };
}

function matchesConnectionFilter(
  link: Readonly<Relationship>,
  entity: HardState,
  metric: ConnectionCountMetric,
  direction: 'src' | 'dst' | 'both'
): boolean {
  const involvesEntity = link.src === entity.id || link.dst === entity.id;
  if (!involvesEntity) return false;
  if (metric.relationshipKinds?.length && !metric.relationshipKinds.includes(link.kind)) {
    return false;
  }
  if (metric.minStrength !== undefined && (link.strength ?? 0) < metric.minStrength) {
    return false;
  }
  return direction === 'both'
    || (direction === 'src' && link.src === entity.id)
    || (direction === 'dst' && link.dst === entity.id);
}

export function evaluateConnectionCount(
  metric: ConnectionCountMetric,
  ctx: MetricContext,
  entity?: HardState
): MetricResult {
  if (!entity) {
    return { value: 0, diagnostic: 'no entity for connection count', details: {} };
  }

  const direction = normalizeDirection(metric.direction);
  const rels = ctx.graph.getAllRelationships();
  const count = rels.filter((link) => matchesConnectionFilter(link, entity, metric, direction)).length;
  const value = applyCoeffAndCap(count, metric.coefficient, metric.cap);

  return {
    value,
    diagnostic: `connections=${count}`,
    details: {
      entityId: entity.id,
      relationshipKinds: metric.relationshipKinds,
      rawCount: count,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}
