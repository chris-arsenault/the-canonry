/**
 * Faction Growth Templates
 *
 * Templates for creating and evolving faction entities.
 */

import { GrowthTemplate } from '../../types/engine';

export { factionSplinter } from './factionSplinter';
export { guildEstablishment } from './guildEstablishment';
export { cultFormation } from './cultFormation';

import { factionSplinter } from './factionSplinter';
import { guildEstablishment } from './guildEstablishment';
import { cultFormation } from './cultFormation';

export const factionTemplates: GrowthTemplate[] = [
  factionSplinter,
  guildEstablishment,
  cultFormation
];
