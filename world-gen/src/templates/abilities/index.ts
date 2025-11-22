/**
 * Abilities Growth Templates
 *
 * Templates for creating technologies and magical abilities.
 */

import { GrowthTemplate } from '../../types/engine';

export { techInnovation } from './techInnovation';
export { magicDiscovery } from './magicDiscovery';

import { techInnovation } from './techInnovation';
import { magicDiscovery } from './magicDiscovery';

export const abilitiesTemplates: GrowthTemplate[] = [
  techInnovation,
  magicDiscovery
];
