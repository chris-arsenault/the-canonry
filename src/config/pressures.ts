import { Pressure } from '../types/engine';
import { findEntities, getRelated } from '../utils/helpers';

export const pressures: Pressure[] = [
  {
    id: 'resource_scarcity',
    name: 'Resource Scarcity',
    value: 20,
    decay: 2,
    growth: (graph) => {
      // Calculate resource strain
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      const resources = findEntities(graph, { kind: 'location' })
        .filter(loc => loc.tags.includes('resource'));
      
      let totalStrain = 0;
      colonies.forEach(colony => {
        const residents = getRelated(graph, colony.id, 'resident_of', 'dst');
        const nearbyResources = resources.filter(r => 
          graph.relationships.some(rel => 
            rel.kind === 'adjacent_to' && 
            ((rel.src === colony.id && rel.dst === r.id) || 
             (rel.dst === colony.id && rel.src === r.id))
          )
        );
        
        const localStrain = residents.length / Math.max(1, nearbyResources.length);
        totalStrain += localStrain > 2 ? 5 : 0;
      });
      
      return totalStrain;
    }
  },
  
  {
    id: 'conflict',
    name: 'Conflict Tension',
    value: 15,
    decay: 3,
    growth: (graph) => {
      // Count hostile relationships
      const hostileRelations = graph.relationships.filter(r => 
        r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
      );
      
      const factionWars = graph.relationships.filter(r => r.kind === 'at_war_with');
      
      return hostileRelations.length * 0.5 + factionWars.length * 3;
    }
  },
  
  {
    id: 'magical_instability',
    name: 'Magical Instability',
    value: 10,
    decay: 1,
    growth: (graph) => {
      // Magic use and anomalies increase instability
      const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
      const magicAbilities = findEntities(graph, { kind: 'abilities', subtype: 'magic' });
      const practitioners = graph.relationships.filter(r => r.kind === 'practitioner_of');
      
      return anomalies.length * 3 + magicAbilities.length * 2 + practitioners.length * 0.5;
    }
  },
  
  {
    id: 'cultural_tension',
    name: 'Cultural Divergence',
    value: 5,
    decay: 1,
    growth: (graph) => {
      // Isolated colonies and splinter factions increase tension
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      const isolatedColonies = colonies.filter(c => 
        c.tags.includes('isolated') || c.tags.includes('divergent')
      );
      
      const splinterFactions = graph.relationships.filter(r => r.kind === 'splinter_of');
      
      return isolatedColonies.length * 4 + splinterFactions.length * 2;
    }
  },
  
  {
    id: 'stability',
    name: 'Political Stability',
    value: 50,
    decay: 2,
    growth: (graph) => {
      // Alliances and trade increase stability
      const alliances = graph.relationships.filter(r => r.kind === 'allied_with');
      const tradeGuilds = findEntities(graph, { kind: 'faction', subtype: 'company' })
        .filter(f => f.status === 'state_sanctioned');
      
      // Dead leaders decrease stability
      const deadLeaders = findEntities(graph, { kind: 'npc', subtype: 'mayor' })
        .filter(n => n.status === 'dead');
      
      return alliances.length * 2 + tradeGuilds.length * 3 - deadLeaders.length * 5;
    }
  },
  
  {
    id: 'external_threat',
    name: 'External Danger',
    value: 0,
    decay: 2,
    growth: (graph) => {
      // Increases during invasion era or when entities marked as external appear
      const externalTags = Array.from(graph.entities.values())
        .filter(e => e.tags.includes('external') || e.tags.includes('invader'));

      return externalTags.length * 10;
    }
  }
];
