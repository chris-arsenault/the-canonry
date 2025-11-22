import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

export const heroEmergence: GrowthTemplate = {
  id: 'hero_emergence',
  name: 'Hero Rises',
  
  canApply: (graph: Graph) => {
    const conflictPressure = graph.pressures.get('conflict') || 0;
    return conflictPressure > 30 || graph.entities.size > 20;
  },
  
  findTargets: (graph: Graph) => {
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    return colonies.filter(c => c.status === 'thriving' || c.status === 'waning');
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      findEntities(graph, { kind: 'location', subtype: 'colony' })
    );
    
    const hero: Partial<HardState> = {
      kind: 'npc',
      subtype: 'hero',
      name: generateName('hero'),
      description: `A brave penguin who emerged during troubled times in ${colony.name}`,
      status: 'alive',
      prominence: 'recognized',
      tags: ['brave', 'emergent', colony.name.toLowerCase()]
    };
    
    const abilities = findEntities(graph, { kind: 'abilities' });
    const relationships: Relationship[] = [];

    if (abilities.length > 0) {
      relationships.push({
        kind: 'practitioner_of',
        src: 'will-be-assigned-0',
        dst: pickRandom(abilities).id
      });
    }

    relationships.push({
      kind: 'resident_of',
      src: 'will-be-assigned-0',
      dst: colony.id
    });
    
    return {
      entities: [hero],
      relationships,
      description: `A new hero emerges in ${colony.name}`
    };
  }
};
