import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import {
  findEntities,
  getRelated,
  getLocation,
  getFactionMembers,
  hasRelationship,
  pickRandom,
  getProminenceValue,
  adjustProminence,
  rollProbability
} from '../utils/helpers';

// Relationship Formation System
export const relationshipFormation: SimulationSystem = {
  id: 'relationship_formation',
  name: 'Social Dynamics',
  
  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    const relationships: Relationship[] = [];
    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    
    // Form relationships based on proximity and shared attributes
    npcs.forEach(npc => {
      const location = getLocation(graph, npc.id);
      if (!location) return;
      
      // Find other NPCs in same location
      const neighbors = npcs.filter(other => 
        other.id !== npc.id &&
        getLocation(graph, other.id)?.id === location.id
      );
      
      neighbors.forEach(neighbor => {
        // Shared faction → friendship/rivalry
        const npcFactions = getRelated(graph, npc.id, 'member_of', 'src');
        const neighborFactions = getRelated(graph, neighbor.id, 'member_of', 'src');

        const sharedFaction = npcFactions.some(f =>
          neighborFactions.some(nf => nf.id === f.id)
        );

        // Shared faction → friendship/rivalry (30% base chance)
        if (sharedFaction && rollProbability(0.3, modifier)) {
          if (!hasRelationship(graph, npc.id, neighbor.id)) {
            relationships.push({
              kind: Math.random() > 0.3 ? 'follower_of' : 'rival_of',
              src: npc.id,
              dst: neighbor.id
            });
          }
        }

        // Different factions → conflict (40% base chance)
        if (!sharedFaction && npcFactions.length > 0 && neighborFactions.length > 0
            && rollProbability(0.4, modifier)) {
          if (!hasRelationship(graph, npc.id, neighbor.id, 'enemy_of')) {
            relationships.push({
              kind: 'enemy_of',
              src: npc.id,
              dst: neighbor.id
            });
          }
        }

        // Romance (rare - 10% base chance)
        if (rollProbability(0.1, modifier) && !hasRelationship(graph, npc.id, neighbor.id)) {
          relationships.push({
            kind: 'lover_of',
            src: npc.id,
            dst: neighbor.id
          });
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

// Conflict Contagion System
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

// Resource Flow System
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

// Cultural Drift System
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

// Prominence Evolution System
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

// Alliance Formation System
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

// Collect all systems
export const allSystems: SimulationSystem[] = [
  relationshipFormation,
  conflictContagion,
  resourceFlow,
  culturalDrift,
  prominenceEvolution,
  allianceFormation
];
