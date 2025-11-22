import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

export const succession: GrowthTemplate = {
  id: 'succession',
  name: 'Leadership Succession',
  
  canApply: (graph: Graph) => {
    const mayors = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
    return mayors.some(m => m.status === 'dead' || graph.tick > 50);
  },
  
  findTargets: (graph: Graph) => {
    const mayors = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
    return mayors.filter(m => m.status === 'dead' || (graph.tick - m.createdAt) > 40);
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const oldLeader = target || pickRandom(findEntities(graph, { kind: 'npc', subtype: 'mayor' }));
    
    const colony = graph.entities.get(
      oldLeader.links.find(l => l.kind === 'leader_of')?.dst || ''
    );
    
    const newLeader: Partial<HardState> = {
      kind: 'npc',
      subtype: 'mayor',
      name: generateName('mayor'),
      description: `Successor to ${oldLeader.name} in ${colony?.name}`,
      status: 'alive',
      prominence: 'recognized',
      tags: ['successor', colony?.name.toLowerCase() || '']
    };

    const relationships: Relationship[] = [];

    if (colony) {
      relationships.push({
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: colony.id
      });
    }

    const faction = oldLeader.links.find(l => l.kind === 'leader_of' &&
      graph.entities.get(l.dst)?.kind === 'faction');
    if (faction) {
      relationships.push({
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: faction.dst
      });
    }
    
    return {
      entities: [newLeader],
      relationships,
      description: `${newLeader.name} succeeds ${oldLeader.name}`
    };
  }
};
