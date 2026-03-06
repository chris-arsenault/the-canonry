import type { ProminenceLabel } from './world.js';

export const PROMINENCE_LABELS: ProminenceLabel[] = [
  'forgotten',
  'marginal',
  'recognized',
  'renowned',
  'mythic',
];

export const DEFAULT_PROMINENCE_DISTRIBUTION = [10, 20, 25, 25, 20];

export interface ProminenceScale {
  labels: ProminenceLabel[];
  distribution: number[];
  thresholds: number[];
  min: number;
  max: number;
}

export interface BuildProminenceScaleOptions {
  labels: ProminenceLabel[];
  distribution: number[];
  min: number;
  max: number;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function defaultThresholds(min: number, max: number, count: number): number[] {
  const step = (max - min) / count;
  return Array.from({ length: count - 1 }, (_, index) => min + step * (index + 1));
}

function normalizeDistribution(values: number[], count: number): number[] {
  if (values.length !== count) {
    return Array.from({ length: count }, () => 1 / count);
  }

  const cleaned = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const sum = cleaned.reduce((total, value) => total + value, 0);
  if (sum <= 0) {
    return Array.from({ length: count }, () => 1 / count);
  }

  return cleaned.map((value) => value / sum);
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];

  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

export const DEFAULT_BUILD_OPTIONS: BuildProminenceScaleOptions = {
  labels: PROMINENCE_LABELS,
  distribution: DEFAULT_PROMINENCE_DISTRIBUTION,
  min: DEFAULT_MIN,
  max: DEFAULT_MAX,
};

export function buildProminenceScale(
  values: number[],
  overrides: Partial<BuildProminenceScaleOptions> = {}
): ProminenceScale {
  const options = { ...DEFAULT_BUILD_OPTIONS, ...overrides };
  const { labels, min, max } = options;
  const distribution = normalizeDistribution(options.distribution, labels.length);

  const numericValues = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);

  if (numericValues.length === 0) {
    return {
      labels,
      distribution,
      thresholds: defaultThresholds(min, max, labels.length),
      min,
      max,
    };
  }

  const thresholds: number[] = [];
  let cumulative = 0;
  for (let i = 0; i < labels.length - 1; i += 1) {
    cumulative += distribution[i];
    thresholds.push(clamp(quantile(numericValues, cumulative), min, max));
  }

  return {
    labels,
    distribution,
    thresholds,
    min,
    max,
  };
}

export function prominenceLabelFromScale(
  value: number | ProminenceLabel,
  scale: ProminenceScale
): ProminenceLabel {
  if (typeof value === 'string' && scale.labels.includes(value)) {
    return value;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return scale.labels[0];
  }

  for (let i = 0; i < scale.thresholds.length; i += 1) {
    if (value < scale.thresholds[i]) {
      return scale.labels[i];
    }
  }

  return scale.labels[scale.labels.length - 1];
}

export function prominenceThresholdFromScale(label: ProminenceLabel, scale: ProminenceScale): number {
  const index = scale.labels.indexOf(label);
  if (index <= 0) return scale.min;
  return scale.thresholds[index - 1] ?? scale.max;
}

export function prominenceIndexFromScale(
  value: number | ProminenceLabel,
  scale: ProminenceScale
): number {
  const label = prominenceLabelFromScale(value, scale);
  const index = scale.labels.indexOf(label);
  return index >= 0 ? index : 0;
}
