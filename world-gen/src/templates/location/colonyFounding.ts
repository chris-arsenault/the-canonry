import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, findEntities } from '../../utils/helpers';

/**
 * Colony Founding Template
 *
 * New colonies are established on icebergs as population expands.
 * Limited to 5 colonies maximum to prevent overcrowding.
 */
export const colonyFounding: GrowthTemplate = {
  id: 'colony_founding',
  name: 'Colony Foundation',
  
  canApply: (graph: Graph) => {
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    return colonies.length < 5 && graph.entities.size > 20;
  },
  
  findTargets: (graph: Graph) => findEntities(graph, { kind: 'location', subtype: 'iceberg' }),
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const iceberg = target || pickRandom(findEntities(graph, { kind: 'location', subtype: 'iceberg' }));
    
    return {
      entities: [{
        kind: 'location',
        subtype: 'colony',
        name: `${pickRandom(['North', 'South', 'East', 'West'])} ${pickRandom(['Haven', 'Roost', 'Perch'])}`,
        description: `New colony established on ${iceberg.name}`,
        status: 'thriving',
        prominence: 'marginal',
        tags: ['new', 'colony']
      }],
      relationships: [
        { kind: 'contained_by', src: 'will-be-assigned-0', dst: iceberg.id }
      ],
      description: `New colony founded on ${iceberg.name}`
    };
  }
};
