/**
 * Templates Index
 *
 * All growth templates for procedural content generation.
 */

import { GrowthTemplate } from '../types/engine';

// Re-export all template categories
export * from './npc';
export * from './faction';
export * from './rules';
export * from './abilities';
export * from './location';

// Import for aggregation
import { npcTemplates } from './npc';
import { factionTemplates } from './faction';
import { rulesTemplates } from './rules';
import { abilitiesTemplates } from './abilities';
import { locationTemplates } from './location';

/**
 * All growth templates combined
 */
export const allTemplates: GrowthTemplate[] = [
  ...npcTemplates,
  ...factionTemplates,
  ...rulesTemplates,
  ...abilitiesTemplates,
  ...locationTemplates
];
