/**
 * Ratio Metric Evaluators
 *
 * Evaluators for ratio, status_ratio, and cross_culture_ratio metrics.
 */

import type { HardState } from '../../core/worldTypes';
import type {
  MetricResult,
  RatioMetric,
  StatusRatioMetric,
  CrossCultureRatioMetric,
} from './types';
import type { MetricContext } from './index';
import { evaluateSimpleCount } from './countEvaluators';

export function evaluateRatio(
  metric: RatioMetric,
  ctx: MetricContext
): MetricResult {
  const numValue = evaluateSimpleCount(metric.numerator, ctx);
  const denValue = evaluateSimpleCount(metric.denominator, ctx);

  const ratio = denValue === 0
    ? (metric.fallbackValue ?? 0)
    : numValue / denValue;

  let value = ratio * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `ratio=${numValue}/${denValue}=${ratio.toFixed(2)}`,
    details: {
      numerator: numValue,
      denominator: denValue,
      ratio,
      fallbackValue: metric.fallbackValue,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

export function evaluateStatusRatio(
  metric: StatusRatioMetric,
  ctx: MetricContext
): MetricResult {
  let entities: HardState[] = ctx.graph.findEntities({ kind: metric.kind });
  if (metric.subtype) {
    entities = entities.filter((e) => e.subtype === metric.subtype);
  }

  const total = entities.length;
  if (total === 0) {
    return {
      value: metric.coefficient ?? 1,
      diagnostic: `status ratio: no ${metric.kind} entities`,
      details: { total: 0, alive: 0 },
    };
  }

  const alive = entities.filter((e) => e.status === metric.aliveStatus).length;
  const ratio = alive / total;

  let value = ratio * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `status ratio=${alive}/${total}=${ratio.toFixed(2)}`,
    details: {
      kind: metric.kind,
      subtype: metric.subtype,
      aliveStatus: metric.aliveStatus,
      alive,
      total,
      ratio,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}

export function evaluateCrossCultureRatio(
  metric: CrossCultureRatioMetric,
  ctx: MetricContext
): MetricResult {
  const rels = ctx.graph
    .getAllRelationships()
    .filter((r) => metric.relationshipKinds.includes(r.kind));

  const total = rels.length;
  if (total === 0) {
    return {
      value: 0,
      diagnostic: 'cross-culture ratio: no matching relationships',
      details: { total: 0, crossCulture: 0 },
    };
  }

  let crossCulture = 0;
  for (const rel of rels) {
    const src = ctx.graph.getEntity(rel.src);
    const dst = ctx.graph.getEntity(rel.dst);
    if (src && dst && src.culture !== dst.culture) {
      crossCulture++;
    }
  }

  const ratio = crossCulture / total;
  let value = ratio * (metric.coefficient ?? 1);
  if (metric.cap !== undefined) {
    value = Math.min(value, metric.cap);
  }

  return {
    value,
    diagnostic: `cross-culture=${crossCulture}/${total}=${ratio.toFixed(2)}`,
    details: {
      relationshipKinds: metric.relationshipKinds,
      crossCulture,
      total,
      ratio,
      coefficient: metric.coefficient,
      cap: metric.cap,
    },
  };
}
