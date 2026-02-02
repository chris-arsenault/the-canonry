/**
 * Shared types for the rules library.
 *
 * This module contains common types used across all rule categories
 * (conditions, metrics, mutations, filters, selections).
 */

/**
 * Canonical comparison operators.
 * Replaces 'above'/'below' with standard symbols.
 */
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/**
 * Canonical direction types.
 * Replaces 'out'/'in'/'any' with 'src'/'dst'/'both'.
 */
export type Direction = 'src' | 'dst' | 'both';

/**
 * Normalize direction aliases to canonical form.
 *
 * @param dir - Direction in any supported format
 * @returns Canonical direction
 */
export function normalizeDirection(
  dir: 'out' | 'in' | 'any' | 'src' | 'dst' | 'both' | undefined
): Direction {
  switch (dir) {
    case 'out':
      return 'src';
    case 'in':
      return 'dst';
    case 'any':
      return 'both';
    case 'src':
    case 'dst':
    case 'both':
      return dir;
    default:
      return 'both';
  }
}

/**
 * Normalize comparison operator aliases to canonical form.
 *
 * @param op - Operator in any supported format
 * @returns Canonical operator
 */
export function normalizeOperator(
  op: 'above' | 'below' | '>' | '<' | '>=' | '<=' | '==' | '!=' | undefined
): ComparisonOperator {
  switch (op) {
    case 'above':
      return '>';
    case 'below':
      return '<';
    case '>':
    case '<':
    case '>=':
    case '<=':
    case '==':
    case '!=':
      return op;
    default:
      return '>=';
  }
}

/**
 * Apply a comparison operator.
 *
 * @param a - Left operand
 * @param op - Comparison operator
 * @param b - Right operand
 * @returns Result of comparison
 */
export function applyOperator(a: number, op: ComparisonOperator, b: number): boolean {
  switch (op) {
    case '>':
      return a > b;
    case '<':
      return a < b;
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    case '==':
      return a === b;
    case '!=':
      return a !== b;
  }
}

/**
 * Prominence labels for display (derived from numeric value).
 */
export const PROMINENCE_LABELS = [
  'forgotten',
  'marginal',
  'recognized',
  'renowned',
  'mythic',
] as const;

/** @deprecated Use prominenceThreshold() for numeric comparisons */
export const PROMINENCE_ORDER = PROMINENCE_LABELS;

export type ProminenceLabel = (typeof PROMINENCE_LABELS)[number];

// Numeric constants
export const PROMINENCE_MIN = 0.0;
export const PROMINENCE_MAX = 5.0;
export const PROMINENCE_DEFAULT = 2.0; // recognized

/**
 * Convert numeric prominence value to display label.
 *
 * Ranges:
 * - 0.0-0.99: forgotten
 * - 1.0-1.99: marginal
 * - 2.0-2.99: recognized
 * - 3.0-3.99: renowned
 * - 4.0-5.0: mythic
 */
export function prominenceLabel(value: number): ProminenceLabel {
  if (value < 1) return 'forgotten';
  if (value < 2) return 'marginal';
  if (value < 3) return 'recognized';
  if (value < 4) return 'renowned';
  return 'mythic';
}

/**
 * Convert label to numeric threshold (lower bound of range).
 */
export function prominenceThreshold(label: ProminenceLabel): number {
  switch (label) {
    case 'forgotten': return 0;
    case 'marginal': return 1;
    case 'recognized': return 2;
    case 'renowned': return 3;
    case 'mythic': return 4;
  }
}

/**
 * Get prominence index (0-4) from numeric value.
 */
export function prominenceIndex(value: number): number {
  return Math.min(4, Math.max(0, Math.floor(value)));
}

/**
 * Clamp prominence value to valid range [0, 5].
 */
export function clampProminence(value: number): number {
  return Math.max(PROMINENCE_MIN, Math.min(PROMINENCE_MAX, value));
}

/**
 * Compare two prominence values.
 *
 * @returns negative if a < b, 0 if equal, positive if a > b
 */
export function compareProminence(a: number, b: number): number {
  return a - b;
}
