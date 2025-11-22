import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';
import {
  findEntities,
  hasRelationship,
  pickRandom,
  rollProbability
} from '../utils/helpers';

/**
 * Cultural Drift System
 *
 * Models cultural evolution - connected colonies become more similar,
 * isolated colonies diverge. Creates cultural tension pressure.
 */
export const culturalDrift: SimulationSystem = {
  id: 'cultural_drift',
  name: 'Cultural Evolution',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });

    // Track cultural differences between colonies
    colonies.forEach((colony, i) => {
      colonies.slice(i + 1).forEach(otherColony => {
        // Check if colonies are connected
        const connected = hasRelationship(graph, colony.id, otherColony.id, 'adjacent_to');

        if (connected) {
          // Connected colonies influence each other (reduce drift)
          const sharedTags = colony.tags.filter(t => otherColony.tags.includes(t));
          if (sharedTags.length < 2 && Math.random() < 0.3 / modifier) {
            // Add a shared cultural tag
            const newTag = pickRandom(['unified', 'trading', 'peaceful']);
            if (!colony.tags.includes(newTag) && colony.tags.length < 5) {
              modifications.push({
                id: colony.id,
                changes: { tags: [...colony.tags, newTag] }
              });
            }
          }
        } else {
          // Disconnected colonies diverge (30% base chance)
          if (rollProbability(0.3, modifier)) {
            const divergentTag = pickRandom(['isolated', 'unique', 'divergent']);
            if (!colony.tags.includes(divergentTag) && colony.tags.length < 5) {
              modifications.push({
                id: colony.id,
                changes: { tags: [...colony.tags, divergentTag] }
              });
            }
          }
        }
      });
    });

    // Factions in divergent colonies may splinter
    const divergentColonies = colonies.filter(c =>
      c.tags.includes('isolated') || c.tags.includes('divergent')
    );

    const splinterPressure = divergentColonies.length > 1 ? 10 : 0;

    return {
      relationshipsAdded: [],
      entitiesModified: modifications,
      pressureChanges: { 'cultural_tension': splinterPressure * modifier },
      description: `Cultural drift affects ${modifications.length} locations`
    };
  }
};
