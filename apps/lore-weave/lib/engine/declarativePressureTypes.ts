/**
 * Declarative Pressure Types
 *
 * Defines the JSON-serializable structure for pressure definitions.
 * These can be created/edited via UI and loaded dynamically.
 */

import { PressureContract } from './types';
import type { Metric, SimpleCountMetric } from '../rules/metrics/types';

// =============================================================================
// FEEDBACK FACTOR TYPES (rules/metrics single source of truth)
// =============================================================================

export type FeedbackFactor = Extract<
  Metric,
  | { type: 'entity_count' }
  | { type: 'relationship_count' }
  | { type: 'tag_count' }
  | { type: 'ratio' }
  | { type: 'status_ratio' }
  | { type: 'cross_culture_ratio' }
  | { type: 'total_entities' }
  | { type: 'constant' }
>;

export type SimpleCountFactor = SimpleCountMetric;

// =============================================================================
// DECLARATIVE PRESSURE DEFINITION
// =============================================================================

/**
 * Declarative pressure definition - JSON serializable
 */
export interface DeclarativePressure {
  id: string;
  name: string;
  /** Optional human-friendly description of the pressure and what ± values mean */
  description?: string;

  /** Initial value (-100 to 100) */
  initialValue: number;

  /**
   * Homeostatic factor pulling pressure toward equilibrium (0)
   * Applied each tick as: delta = (0 - currentValue) * homeostasis
   */
  homeostasis: number;

  /** Feedback drivers */
  growth: {
    /** Factors that increase pressure */
    positiveFeedback: FeedbackFactor[];

    /** Factors that decrease pressure */
    negativeFeedback: FeedbackFactor[];
  };

  /** Documentation contract (optional, for UI display) */
  contract?: PressureContract;
}

// =============================================================================
// PRESSURES FILE STRUCTURE
// =============================================================================

/**
 * Shape of the pressures.json file
 */
export interface PressuresFile {
  $schema?: string;
  pressures: DeclarativePressure[];
}
