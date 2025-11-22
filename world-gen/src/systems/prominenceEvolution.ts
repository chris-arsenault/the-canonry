import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';
import {
  findEntities,
  getFactionMembers,
  getProminenceValue,
  adjustProminence
} from '../utils/helpers';

/**
 * Prominence Evolution System
 *
 * Models fame and obscurity - well-connected entities become more prominent,
 * isolated entities fade. Heroes and mayors get natural bonuses.
 */
export const prominenceEvolution: SimulationSystem = {
  id: 'prominence_evolution',
  name: 'Fame and Obscurity',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];

    // NPCs gain prominence through connections
    const npcs = findEntities(graph, { kind: 'npc' });

    npcs.forEach(npc => {
      const relationships = graph.relationships.filter(r =>
        r.src === npc.id || r.dst === npc.id
      );

      const connectionScore = relationships.length;
      const currentProminence = getProminenceValue(npc.prominence);

      // Heroes and mayors naturally gain prominence
      const roleBonus = (npc.subtype === 'hero' || npc.subtype === 'mayor') ? 1 : 0;

      // Calculate prominence change
      let prominenceDelta = 0;
      if (connectionScore + roleBonus > currentProminence * 3) {
        prominenceDelta = 1;
      } else if (connectionScore < currentProminence && Math.random() > 0.7) {
        prominenceDelta = -1;
      }

      if (prominenceDelta !== 0) {
        modifications.push({
          id: npc.id,
          changes: {
            prominence: adjustProminence(npc.prominence, prominenceDelta)
          }
        });
      }
    });

    // Factions gain prominence through membership
    const factions = findEntities(graph, { kind: 'faction' });

    factions.forEach(faction => {
      const members = getFactionMembers(graph, faction.id);
      const memberProminence = members.reduce((sum, m) =>
        sum + getProminenceValue(m.prominence), 0
      );

      if (memberProminence > getProminenceValue(faction.prominence) * members.length) {
        modifications.push({
          id: faction.id,
          changes: {
            prominence: adjustProminence(faction.prominence, 1)
          }
        });
      }
    });

    return {
      relationshipsAdded: [],
      entitiesModified: modifications,
      pressureChanges: {},
      description: `Prominence shifts for ${modifications.length} entities`
    };
  }
};
