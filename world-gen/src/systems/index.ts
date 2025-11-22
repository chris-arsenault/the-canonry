/**
 * Simulation Systems Index
 *
 * All simulation systems that govern world dynamics.
 * Each system runs every tick and modifies the world state.
 */

import { SimulationSystem } from '../types/engine';

// Import all systems
export { relationshipFormation } from './relationshipFormation';
export { conflictContagion } from './conflictContagion';
export { resourceFlow } from './resourceFlow';
export { culturalDrift } from './culturalDrift';
export { prominenceEvolution } from './prominenceEvolution';
export { allianceFormation } from './allianceFormation';

// Import for aggregation
import { relationshipFormation } from './relationshipFormation';
import { conflictContagion } from './conflictContagion';
import { resourceFlow } from './resourceFlow';
import { culturalDrift } from './culturalDrift';
import { prominenceEvolution } from './prominenceEvolution';
import { allianceFormation } from './allianceFormation';

/**
 * All simulation systems
 *
 * Order matters - systems execute in this sequence each tick.
 */
export const allSystems: SimulationSystem[] = [
  relationshipFormation,
  conflictContagion,
  resourceFlow,
  culturalDrift,
  prominenceEvolution,
  allianceFormation
];
