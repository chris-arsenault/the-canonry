import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState } from '../types/worldTypes';
import {
  findEntities,
  getRelated,
  adjustProminence
} from '../utils/helpers';

/**
 * Resource Flow System
 *
 * Models economic dynamics based on resource availability vs consumption.
 * Colonies thrive or wane based on resource ratios, merchant factions gain prominence.
 */
export const resourceFlow: SimulationSystem = {
  id: 'resource_flow',
  name: 'Economic Dynamics',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });

    colonies.forEach(colony => {
      // Count resources and consumers
      const resources = getRelated(graph, colony.id, 'adjacent_to')
        .filter(loc => loc.tags.includes('resource'));
      const residents = getRelated(graph, colony.id, 'resident_of', 'dst');

      const ratio = resources.length / Math.max(1, residents.length);

      // Update colony status based on resource ratio
      let newStatus = colony.status;
      if (ratio < 0.3 && modifier < 1.0) {
        newStatus = 'waning';
      } else if (ratio > 0.7 && modifier > 1.0) {
        newStatus = 'thriving';
      }

      if (newStatus !== colony.status) {
        modifications.push({
          id: colony.id,
          changes: { status: newStatus }
        });
      }

      // Merchant factions gain prominence in good times
      const merchants = findEntities(graph, { kind: 'faction', subtype: 'company' })
        .filter(f => f.links.some(l => l.kind === 'controls' && l.dst === colony.id));

      merchants.forEach(merchant => {
        if (ratio > 0.5 && modifier > 1.0) {
          modifications.push({
            id: merchant.id,
            changes: { prominence: adjustProminence(merchant.prominence, 1) }
          });
        }
      });
    });

    const resourcePressure = colonies.some(c => c.status === 'waning') ? 15 : -5;

    return {
      relationshipsAdded: [],
      entitiesModified: modifications,
      pressureChanges: { 'resource_scarcity': resourcePressure },
      description: `Resource distribution affects ${modifications.length} entities`
    };
  }
};
