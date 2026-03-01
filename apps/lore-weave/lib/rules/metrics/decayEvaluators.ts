/**
 * Decay/Falloff Metric Evaluators
 *
 * Evaluators for decay_rate and falloff metrics.
 */

import type {
  MetricResult,
  DecayRateMetric,
  FalloffMetric,
} from './types';

const DECAY_RATES: Record<string, number> = {
  none: 0,
  slow: 0.01,
  medium: 0.03,
  fast: 0.06,
};

export function evaluateDecayRate(metric: DecayRateMetric): MetricResult {
  const value = DECAY_RATES[metric.rate] ?? 0.03;

  return {
    value,
    diagnostic: `decay rate ${metric.rate}=${value}`,
    details: { rate: metric.rate, value },
  };
}

function computeFalloffValue(falloffType: FalloffMetric['falloffType'], normalizedDist: number, distance: number, maxDist: number): number {
  switch (falloffType) {
    case 'none':
      return 1;
    case 'absolute':
    case 'linear':
      return 1 - normalizedDist;
    case 'inverse_square':
      return 1 / (1 + (distance * distance) / (maxDist * 0.5));
    case 'sqrt':
      return 1 - Math.sqrt(normalizedDist);
    case 'exponential':
      return Math.exp(-3 * normalizedDist);
    default:
      return 1 - normalizedDist;
  }
}

export function evaluateFalloff(metric: FalloffMetric): MetricResult {
  const maxDist = metric.maxDistance ?? 100;
  const distance = metric.distance;
  const normalizedDist = maxDist > 0 ? distance / maxDist : 0;

  if (distance <= 0) {
    return {
      value: 1,
      diagnostic: `${metric.falloffType} falloff at d=0 = 1.00`,
      details: { falloffType: metric.falloffType, distance, maxDistance: maxDist, normalizedDistance: 0, value: 1 },
    };
  }

  if (distance >= maxDist) {
    return {
      value: 0,
      diagnostic: `${metric.falloffType} falloff at d=${distance.toFixed(1)} = 0.00`,
      details: { falloffType: metric.falloffType, distance, maxDistance: maxDist, normalizedDistance: 1, value: 0 },
    };
  }

  const value = computeFalloffValue(metric.falloffType, normalizedDist, distance, maxDist);

  return {
    value,
    diagnostic: `${metric.falloffType} falloff at d=${metric.distance.toFixed(1)} = ${value.toFixed(2)}`,
    details: {
      falloffType: metric.falloffType,
      distance: metric.distance,
      maxDistance: maxDist,
      normalizedDistance: normalizedDist,
      value,
    },
  };
}
