import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { Relationship } from '../types/worldTypes';
import {
  findEntities,
  getRelated,
  hasRelationship,
  rollProbability
} from '../utils/helpers';

/**
 * Alliance Formation System
 *
 * Factions with common enemies form strategic alliances.
 * Increases stability pressure when alliances form.
 */
export const allianceFormation: SimulationSystem = {
  id: 'alliance_formation',
  name: 'Strategic Alliances',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const relationships: Relationship[] = [];
    const factions = findEntities(graph, { kind: 'faction' });

    factions.forEach((faction, i) => {
      factions.slice(i + 1).forEach(otherFaction => {
        // Check for common enemies
        const factionEnemies = getRelated(graph, faction.id, 'at_war_with', 'src');
        const otherEnemies = getRelated(graph, otherFaction.id, 'at_war_with', 'src');

        const commonEnemies = factionEnemies.filter(e =>
          otherEnemies.some(oe => oe.id === e.id)
        );

        // Common enemies drive alliances (50% base chance)
        if (commonEnemies.length > 0 && rollProbability(0.5, modifier)) {
          if (!hasRelationship(graph, faction.id, otherFaction.id, 'allied_with')) {
            relationships.push({
              kind: 'allied_with',
              src: faction.id,
              dst: otherFaction.id
            });
          }
        }
      });
    });

    return {
      relationshipsAdded: relationships,
      entitiesModified: [],
      pressureChanges: relationships.length > 0 ? { 'stability': 5 } : {},
      description: `${relationships.length} new alliances formed`
    };
  }
};
