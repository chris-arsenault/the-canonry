import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import {
  getRelated,
  hasRelationship,
  rollProbability
} from '../utils/helpers';

/**
 * Conflict Contagion System
 *
 * Spreads conflicts through alliance networks - allies of enemies become enemies.
 * Increases conflict pressure as wars spread.
 */
export const conflictContagion: SimulationSystem = {
  id: 'conflict_contagion',
  name: 'Conflict Spread',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const relationships: Relationship[] = [];
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];

    // Find existing conflicts
    const conflicts = graph.relationships.filter(r =>
      r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
    );

    conflicts.forEach(conflict => {
      const srcAllies = getRelated(graph, conflict.src, 'follower_of', 'dst')
        .concat(getRelated(graph, conflict.src, 'member_of', 'src'));
      const dstAllies = getRelated(graph, conflict.dst, 'follower_of', 'dst')
        .concat(getRelated(graph, conflict.dst, 'member_of', 'src'));

      // Conflicts spread to allies (30% base chance)
      srcAllies.forEach(ally => {
        if (rollProbability(0.3, modifier)) {
          if (!hasRelationship(graph, ally.id, conflict.dst)) {
            relationships.push({
              kind: 'enemy_of',
              src: ally.id,
              dst: conflict.dst
            });
          }
        }
      });

      dstAllies.forEach(ally => {
        if (rollProbability(0.3, modifier)) {
          if (!hasRelationship(graph, ally.id, conflict.src)) {
            relationships.push({
              kind: 'enemy_of',
              src: ally.id,
              dst: conflict.src
            });
          }
        }
      });
    });

    const pressureChange = relationships.length > 5 ? 10 : relationships.length * 2;

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges: { 'conflict': pressureChange },
      description: `Conflicts spread through alliances (${relationships.length} new enemies)`
    };
  }
};
