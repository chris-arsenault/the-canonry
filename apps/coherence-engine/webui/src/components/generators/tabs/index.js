/**
 * Tab components for GeneratorModal
 *
 * Each tab is defined in its own file for maintainability.
 * This file provides a single import point for all tabs.
 */

export { OverviewTab } from './OverviewTab';
export { TargetTab } from './TargetTab';
export { VariablesTab } from './VariablesTab';
export { CreationTab } from './CreationTab';
export { RelationshipsTab } from './RelationshipsTab';
export { EffectsTab } from './EffectsTab';

// Re-export ApplicabilityTab from applicability module
// (will be moved here when applicability/ is refactored)
export { ApplicabilityTab } from '../applicability';
