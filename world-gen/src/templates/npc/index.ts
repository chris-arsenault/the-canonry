/**
 * NPC Growth Templates
 *
 * Templates for creating and evolving NPC entities.
 */

import { GrowthTemplate } from '../../types/engine';

export { familyExpansion } from './familyExpansion';
export { heroEmergence } from './heroEmergence';
export { outlawRecruitment } from './outlawRecruitment';
export { succession } from './succession';

import { familyExpansion } from './familyExpansion';
import { heroEmergence } from './heroEmergence';
import { outlawRecruitment } from './outlawRecruitment';
import { succession } from './succession';

export const npcTemplates: GrowthTemplate[] = [
  familyExpansion,
  heroEmergence,
  outlawRecruitment,
  succession
];
