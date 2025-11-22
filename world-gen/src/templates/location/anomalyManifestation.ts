import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState } from '../../types/worldTypes';
import { pickRandom, findEntities } from '../../utils/helpers';

/**
 * Anomaly Manifestation Template
 *
 * Strange magical phenomena appear, triggered by high magical instability.
 * Creates mysterious locations that attract cults and magic users.
 */
export const anomalyManifestation: GrowthTemplate = {
  id: 'anomaly_manifestation',
  name: 'Anomaly Appears',
  
  canApply: (graph: Graph) => {
    const magic = graph.pressures.get('magical_instability') || 0;
    return magic > 30 || Math.random() > 0.8;
  },
  
  findTargets: (graph: Graph) => findEntities(graph, { kind: 'location' }),
  
  expand: (graph: Graph): TemplateResult => {
    return {
      entities: [{
        kind: 'location',
        subtype: 'anomaly',
        name: `${pickRandom(['Shimmering', 'Frozen', 'Dark'])} ${pickRandom(['Rift', 'Vortex', 'Echo'])}`,
        description: 'A mysterious phenomenon appears',
        status: 'unspoiled',
        prominence: 'recognized',
        tags: ['anomaly', 'mysterious']
      }],
      relationships: [],
      description: 'Strange anomaly manifests'
    };
  }
};
