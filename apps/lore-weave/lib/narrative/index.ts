/**
 * Narrative Module
 *
 * Tools for capturing and building narrative events during simulation.
 */

export { NarrativeEventBuilder } from './narrativeEventBuilder.js';
export type { NarrativeContext } from './narrativeEventBuilder.js';

export { calculateSignificance, getProminenceValue } from './significanceCalculator.js';
export type { SignificanceContext } from './significanceCalculator.js';

export { generateNarrativeTags } from './narrativeTagGenerator.js';
export type { TagContext } from './narrativeTagGenerator.js';

export { StateChangeTracker, createDefaultNarrativeConfig } from './stateChangeTracker.js';
export type { NarrativeSchemaSlice } from './stateChangeTracker.js';
