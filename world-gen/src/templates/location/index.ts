/**
 * Location Growth Templates
 *
 * Templates for creating new locations (colonies, anomalies, etc).
 */

import { GrowthTemplate } from '../../types/engine';

export { colonyFounding } from './colonyFounding';
export { anomalyManifestation } from './anomalyManifestation';

import { colonyFounding } from './colonyFounding';
import { anomalyManifestation } from './anomalyManifestation';

export const locationTemplates: GrowthTemplate[] = [
  colonyFounding,
  anomalyManifestation
];
