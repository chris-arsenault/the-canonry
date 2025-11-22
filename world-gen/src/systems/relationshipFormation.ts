import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { Relationship } from '../types/worldTypes';
import {
  findEntities,
  getRelated,
  getLocation,
  hasRelationship,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation
} from '../utils/helpers';

/**
 * Relationship Formation System
 *
 * Forms social connections between NPCs based on proximity and shared attributes.
 * Handles friendships, rivalries, conflicts, and romance with proper cooldown tracking.
 */
export const relationshipFormation: SimulationSystem = {
  id: 'relationship_formation',
  name: 'Social Dynamics',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    const relationships: Relationship[] = [];
    const modifications: Array<{ id: string; changes: Partial<any> }> = [];

    // Cooldown periods (in ticks) for different relationship types
    const COOLDOWNS = {
      follower_of: 5,
      rival_of: 5,
      enemy_of: 8,
      lover_of: 15  // Romance should be rarer
    };

    // Form relationships based on proximity and shared attributes
    // Process each pair only once using ID comparison to avoid double-counting
    npcs.forEach((npc, i) => {
      const location = getLocation(graph, npc.id);
      if (!location) return;

      // Only process NPCs that come after this one to avoid double processing
      npcs.slice(i + 1).forEach(neighbor => {
        // Verify same location
        if (getLocation(graph, neighbor.id)?.id !== location.id) return;

        // Shared faction → friendship/rivalry
        const npcFactions = getRelated(graph, npc.id, 'member_of', 'src');
        const neighborFactions = getRelated(graph, neighbor.id, 'member_of', 'src');

        const sharedFaction = npcFactions.some(f =>
          neighborFactions.some(nf => nf.id === f.id)
        );

        // Shared faction → friendship/rivalry (30% base chance)
        if (sharedFaction && rollProbability(0.3, modifier)) {
          const relType = Math.random() > 0.3 ? 'follower_of' : 'rival_of';

          // Check: no existing relationship of this type, and not on cooldown
          if (!hasRelationship(graph, npc.id, neighbor.id, relType) &&
              canFormRelationship(graph, npc.id, relType, COOLDOWNS[relType])) {
            relationships.push({
              kind: relType,
              src: npc.id,
              dst: neighbor.id
            });
            recordRelationshipFormation(graph, npc.id, relType);
          }
        }

        // Different factions → conflict (40% base chance)
        if (!sharedFaction && npcFactions.length > 0 && neighborFactions.length > 0
            && rollProbability(0.4, modifier)) {
          // Check: no existing enemy_of relationship, and not on cooldown
          if (!hasRelationship(graph, npc.id, neighbor.id, 'enemy_of') &&
              canFormRelationship(graph, npc.id, 'enemy_of', COOLDOWNS.enemy_of)) {
            relationships.push({
              kind: 'enemy_of',
              src: npc.id,
              dst: neighbor.id
            });
            recordRelationshipFormation(graph, npc.id, 'enemy_of');
          }
        }

        // Romance (rare - 10% base chance)
        // Check: no existing lover_of relationship, and not on cooldown
        if (rollProbability(0.1, modifier) &&
            !hasRelationship(graph, npc.id, neighbor.id, 'lover_of') &&
            canFormRelationship(graph, npc.id, 'lover_of', COOLDOWNS.lover_of)) {
          relationships.push({
            kind: 'lover_of',
            src: npc.id,
            dst: neighbor.id
          });
          recordRelationshipFormation(graph, npc.id, 'lover_of');
        }
      });
    });

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges: {},
      description: `Social bonds form and rivalries emerge (${relationships.length} new relationships)`
    };
  }
};
