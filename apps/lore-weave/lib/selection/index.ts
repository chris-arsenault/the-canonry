/**
 * Selection module - entity selection strategies.
 *
 * Note: Filter evaluation, graph path, entity resolver, and actor matching
 * have been moved to ../rules/. Import from there directly.
 * This module now only contains higher-level selection strategies.
 */

// Higher-level selectors remain here (not moved to rules/)
export { TargetSelector } from './targetSelector';
export type { SelectionBias, SelectionResult } from './targetSelector';
export { DynamicWeightCalculator } from './dynamicWeightCalculator';
