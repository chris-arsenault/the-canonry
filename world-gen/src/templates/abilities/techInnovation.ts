import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, findEntities } from '../../utils/helpers';

/**
 * Technology Innovation Template
 *
 * Merchant factions develop new technologies to improve efficiency.
 * Creates technology abilities linked to the developing faction.
 */
export const techInnovation: GrowthTemplate = {
  id: 'tech_innovation',
  name: 'Technology Development',
  
  canApply: (graph: Graph) => findEntities(graph, { kind: 'faction', subtype: 'company' }).length > 0,
  
  findTargets: (graph: Graph) => findEntities(graph, { kind: 'faction', subtype: 'company' }),
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(findEntities(graph, { kind: 'faction', subtype: 'company' }));
    
    return {
      entities: [{
        kind: 'abilities',
        subtype: 'technology',
        name: `${pickRandom(['Advanced', 'Improved', 'Enhanced'])} ${pickRandom(['Fishing', 'Ice', 'Navigation'])} Tech`,
        description: `Innovation developed by ${faction.name}`,
        status: 'discovered',
        prominence: 'marginal',
        tags: ['tech', 'innovation']
      }],
      relationships: [
        { kind: 'wields', src: faction.id, dst: 'will-be-assigned-0' }
      ],
      description: `${faction.name} develops new technology`
    };
  }
};
