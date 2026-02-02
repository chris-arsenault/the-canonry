/**
 * Pressure Interpreter
 *
 * Converts declarative pressure definitions into runtime Pressure objects
 * with executable growth functions.
 */

import { Pressure, Graph } from './types';
import {
  DeclarativePressure,
  FeedbackFactor,
  PressuresFile
} from './declarativePressureTypes';
import { describeMetric, evaluateMetric } from '../rules/metrics';
import type { MetricContext, MetricResult } from '../rules/metrics';
import type { FeedbackContribution } from '../observer/types';

// =============================================================================
// FACTOR EVALUATION (rules/metrics)
// =============================================================================

function createMetricContext(graph: Graph): MetricContext {
  return { graph };
}

function extractRawValue(factor: FeedbackFactor, result: MetricResult): number {
  const details = result.details as Record<string, unknown>;

  if (typeof details.rawCount === 'number') return details.rawCount;
  if (typeof details.ratio === 'number') return details.ratio;
  if (typeof details.value === 'number') return details.value;

  if (typeof details.numerator === 'number' && typeof details.denominator === 'number') {
    if (details.denominator === 0) {
      return typeof (factor as any).fallbackValue === 'number' ? (factor as any).fallbackValue : 0;
    }
    return details.numerator / details.denominator;
  }

  if (typeof details.total === 'number' && typeof details.alive === 'number') {
    return details.total === 0 ? 1 : details.alive / details.total;
  }

  if (typeof details.total === 'number' && typeof details.crossCulture === 'number') {
    return details.total === 0 ? 0 : details.crossCulture / details.total;
  }

  return result.value;
}

function evaluateFactor(factor: FeedbackFactor, ctx: MetricContext): number {
  return evaluateMetric(factor, ctx).value;
}

function evaluateFactorWithDetails(factor: FeedbackFactor, ctx: MetricContext): FeedbackContribution {
  const result = evaluateMetric(factor, ctx);
  const rawValue = extractRawValue(factor, result);
  const coefficient = typeof (factor as any).coefficient === 'number' ? (factor as any).coefficient : 1;

  return {
    label: describeMetric(factor),
    type: factor.type,
    rawValue,
    coefficient,
    contribution: result.value
  };
}

/**
 * Evaluate all factors for a pressure and return detailed breakdown
 */
export function evaluatePressureGrowthWithBreakdown(
  definition: DeclarativePressure,
  graph: Graph
): {
  positiveFeedback: FeedbackContribution[];
  negativeFeedback: FeedbackContribution[];
  feedbackTotal: number;
} {
  const config = definition.growth;

  const positiveFeedback: FeedbackContribution[] = [];
  const negativeFeedback: FeedbackContribution[] = [];
  const metricCtx = createMetricContext(graph);

  let total = 0;

  for (const factor of config.positiveFeedback) {
    const details = evaluateFactorWithDetails(factor, metricCtx);
    positiveFeedback.push(details);
    total += details.contribution;
  }

  for (const factor of config.negativeFeedback) {
    const details = evaluateFactorWithDetails(factor, metricCtx);
    negativeFeedback.push(details);
    total -= details.contribution;
  }

  return {
    positiveFeedback,
    negativeFeedback,
    feedbackTotal: total
  };
}

// =============================================================================
// PRESSURE INTERPRETER
// =============================================================================

/**
 * Convert a declarative pressure to a runtime Pressure object
 */
export function createPressureFromDeclarative(definition: DeclarativePressure): Pressure {
  return {
    id: definition.id,
    name: definition.name,
    value: definition.initialValue,
    homeostasis: definition.homeostasis,
    contract: definition.contract,

    growth: (graph: Graph): number => {
      const config = definition.growth;
      const metricCtx = createMetricContext(graph);

      let total = 0;

      // Add positive feedback
      for (const factor of config.positiveFeedback) {
        total += evaluateFactor(factor, metricCtx);
      }

      // Subtract negative feedback
      for (const factor of config.negativeFeedback) {
        total -= evaluateFactor(factor, metricCtx);
      }

      return total;
    }
  };
}

/**
 * Load all pressures from a PressuresFile
 */
export function loadPressures(file: PressuresFile): Pressure[] {
  return file.pressures.map(createPressureFromDeclarative);
}

/**
 * Load a single pressure from a declarative definition
 */
export function loadPressure(definition: DeclarativePressure): Pressure {
  return createPressureFromDeclarative(definition);
}
