import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

/**
 * Cult Formation Template
 *
 * Mystical cults emerge near anomalies or where magic is present.
 * Creates cult faction, prophet leader, and 3 cultist followers.
 */
export const cultFormation: GrowthTemplate = {
  id: 'cult_formation',
  name: 'Cult Awakening',
  
  canApply: (graph: Graph) => {
    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
    const magic = findEntities(graph, { kind: 'abilities', subtype: 'magic' });
    return anomalies.length > 0 || magic.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
    const nearbyLocations: HardState[] = [];
    
    anomalies.forEach(anomaly => {
      anomaly.links
        .filter(l => l.kind === 'adjacent_to')
        .forEach(l => {
          const adjacent = graph.entities.get(l.dst);
          if (adjacent) nearbyLocations.push(adjacent);
        });
    });
    
    return [...anomalies, ...nearbyLocations];
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const location = target || pickRandom(findEntities(graph, { kind: 'location' }));
    
    const cult: Partial<HardState> = {
      kind: 'faction',
      subtype: 'cult',
      name: `${pickRandom(['Order', 'Covenant', 'Circle'])} of the ${pickRandom(['Fissure', 'Depths', 'Ice'])}`,
      description: `A mystical cult drawn to the power near ${location.name}`,
      status: 'illegal',
      prominence: 'marginal',
      tags: ['mystical', 'secretive', 'cult']
    };
    
    const prophet: Partial<HardState> = {
      kind: 'npc',
      subtype: 'hero',
      name: generateName('mystic'),
      description: `The enigmatic prophet of ${cult.name}`,
      status: 'alive',
      prominence: 'recognized',
      tags: ['prophet', 'mystic']
    };
    
    const cultists: Partial<HardState>[] = [];
    for (let i = 0; i < 3; i++) {
      cultists.push({
        kind: 'npc',
        subtype: pickRandom(['merchant', 'outlaw']),
        name: generateName(),
        description: `A devoted follower of ${cult.name}`,
        status: 'alive',
        prominence: 'forgotten',
        tags: ['cultist', 'devoted']
      });
    }
    
    const relationships: Relationship[] = [
      { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id },
      { kind: 'leader_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' }
    ];
    
    cultists.forEach((_, i) => {
      relationships.push({
        kind: 'member_of',
        src: `will-be-assigned-${i + 2}`,
        dst: 'will-be-assigned-0'
      });
      relationships.push({
        kind: 'follower_of',
        src: `will-be-assigned-${i + 2}`,
        dst: 'will-be-assigned-1'
      });
    });
    
    const magic = findEntities(graph, { kind: 'abilities', subtype: 'magic' })[0];
    if (magic) {
      relationships.push({
        kind: 'seeks',
        src: 'will-be-assigned-0',
        dst: magic.id
      });
      relationships.push({
        kind: 'practitioner_of',
        src: 'will-be-assigned-1',
        dst: magic.id
      });
    }
    
    return {
      entities: [cult, prophet, ...cultists],
      relationships,
      description: `${cult.name} forms around mystical beliefs`
    };
  }
};
