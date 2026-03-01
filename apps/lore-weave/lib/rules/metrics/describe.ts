/**
 * Metric Description Utilities
 *
 * Human-readable descriptions for all metric types.
 */

import type {
  Metric,
  SimpleCountMetric,
} from './types';

function describeSimpleCount(metric: SimpleCountMetric): string {
  switch (metric.type) {
    case 'entity_count': {
      const parts = [metric.kind];
      if (metric.subtype) parts.push(`:${metric.subtype}`);
      if (metric.status) parts.push(`(${metric.status})`);
      return parts.join('');
    }
    case 'relationship_count':
      return metric.relationshipKinds?.join('/') ?? 'relationships';
    case 'tag_count':
      return `tags:${metric.tags.join('/')}`;
    case 'total_entities':
      return 'total_entities';
    case 'constant':
      return 'constant';
    default:
      return 'count';
  }
}

function describeCountMetric(metric: Metric): string | undefined {
  switch (metric.type) {
    case 'entity_count': {
      const parts = [metric.kind];
      if (metric.subtype) parts.push(`:${metric.subtype}`);
      if (metric.status) parts.push(`(${metric.status})`);
      return `${parts.join('')} count`;
    }
    case 'relationship_count':
      return `${metric.relationshipKinds?.join('/') ?? 'all'} relationships`;
    case 'tag_count':
      return `entities with ${metric.tags.join('/')} tags`;
    case 'total_entities':
      return 'total entities';
    case 'constant':
      return 'constant';
    case 'connection_count':
      return `${metric.relationshipKinds?.join('/') ?? 'all'} connections`;
    default:
      return undefined;
  }
}

function describeRatioMetric(metric: Metric): string | undefined {
  switch (metric.type) {
    case 'ratio':
      return `${describeSimpleCount(metric.numerator)}/${describeSimpleCount(metric.denominator)} ratio`;
    case 'status_ratio':
      return `${metric.kind} status ratio`;
    case 'cross_culture_ratio':
      return `cross-culture ${metric.relationshipKinds.join('/')} ratio`;
    default:
      return undefined;
  }
}

function describeEvolutionMetric(metric: Metric): string | undefined {
  if (metric.type !== 'shared_relationship') return undefined;
  const kindStr = Array.isArray(metric.sharedRelationshipKind)
    ? metric.sharedRelationshipKind.join('/')
    : metric.sharedRelationshipKind;
  return `shared ${kindStr} relationships`;
}

function describeProminenceMetric(metric: Metric): string | undefined {
  switch (metric.type) {
    case 'prominence_multiplier':
      return `prominence multiplier (${metric.mode ?? 'success_chance'})`;
    case 'neighbor_prominence':
      return `neighbor prominence (${metric.relationshipKinds?.join('/') ?? 'all'} connections)`;
    default:
      return undefined;
  }
}

function describeNeighborMetric(metric: Metric): string | undefined {
  if (metric.type !== 'neighbor_kind_count') return undefined;
  const neighborKindSpec = metric.subtype ? `${metric.kind}:${metric.subtype}` : metric.kind;
  const viaStr = Array.isArray(metric.via) ? metric.via.join('/') : metric.via;
  return `neighbor ${neighborKindSpec} count via ${viaStr}`;
}

function describeTopologyMetric(metric: Metric): string | undefined {
  if (metric.type !== 'component_size') return undefined;
  return `component size via ${metric.relationshipKinds.join('/')}`;
}

function describeDecayMetric(metric: Metric): string | undefined {
  switch (metric.type) {
    case 'decay_rate':
      return `decay rate ${metric.rate}`;
    case 'falloff':
      return `${metric.falloffType} falloff`;
    default:
      return undefined;
  }
}

export function describeMetric(metric: Metric): string {
  return describeCountMetric(metric)
    ?? describeRatioMetric(metric)
    ?? describeEvolutionMetric(metric)
    ?? describeProminenceMetric(metric)
    ?? describeNeighborMetric(metric)
    ?? describeTopologyMetric(metric)
    ?? describeDecayMetric(metric)
    ?? (metric as { type: string }).type;
}
