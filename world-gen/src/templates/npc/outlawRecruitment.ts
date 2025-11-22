import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

export const outlawRecruitment: GrowthTemplate = {
  id: 'outlaw_recruitment',
  name: 'Criminal Recruitment',
  
  canApply: (graph: Graph) => {
    const criminalFactions = findEntities(graph, { kind: 'faction', subtype: 'criminal' });
    return criminalFactions.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    return findEntities(graph, { kind: 'faction', subtype: 'criminal' });
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(findEntities(graph, { kind: 'faction', subtype: 'criminal' }));
    
    const numOutlaws = Math.floor(Math.random() * 3) + 2;
    const outlaws: Partial<HardState>[] = [];
    
    for (let i = 0; i < numOutlaws; i++) {
      outlaws.push({
        kind: 'npc',
        subtype: 'outlaw',
        name: generateName('outlaw'),
        description: `A shady character working for ${faction.name}`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['criminal', 'recruit']
      });
    }
    
    const stronghold = graph.entities.get(
      faction.links.find(l => l.kind === 'controls')?.dst || ''
    );
    
    const relationships: Relationship[] = outlaws.flatMap((_, i) => {
      const rels: Relationship[] = [{
        kind: 'member_of',
        src: `will-be-assigned-${i}`,
        dst: faction.id
      }];

      if (stronghold) {
        rels.push({
          kind: 'resident_of',
          src: `will-be-assigned-${i}`,
          dst: stronghold.id
        });
      }

      return rels;
    });
    
    return {
      entities: outlaws,
      relationships,
      description: `${faction.name} recruits new members`
    };
  }
};
