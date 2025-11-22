import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

/**
 * Guild Establishment Template
 *
 * Merchant guilds form in colonies to control trade.
 * Creates the guild faction and 2-3 merchant members.
 */
export const guildEstablishment: GrowthTemplate = {
  id: 'guild_establishment',
  name: 'Guild Formation',
  
  canApply: (graph: Graph) => {
    const merchants = findEntities(graph, { kind: 'npc', subtype: 'merchant' });
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    return merchants.length >= 2 && colonies.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    return findEntities(graph, { kind: 'location', subtype: 'colony' })
      .filter(c => !Array.from(graph.entities.values()).some(e =>
        e.kind === 'faction' &&
        e.subtype === 'company' &&
        e.links.some(l => l.kind === 'controls' && l.dst === c.id)
      ));
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(
      findEntities(graph, { kind: 'location', subtype: 'colony' })
    );
    
    const guild: Partial<HardState> = {
      kind: 'faction',
      subtype: 'company',
      name: `${colony.name} ${pickRandom(['Traders', 'Merchants', 'Exchange'])}`,
      description: `A merchant guild controlling trade in ${colony.name}`,
      status: 'state_sanctioned',
      prominence: 'recognized',
      tags: ['trade', 'guild', colony.name.toLowerCase()]
    };
    
    const merchants: Partial<HardState>[] = [];
    const numMerchants = Math.floor(Math.random() * 2) + 2;
    
    for (let i = 0; i < numMerchants; i++) {
      merchants.push({
        kind: 'npc',
        subtype: 'merchant',
        name: generateName('merchant'),
        description: `A trader affiliated with ${guild.name}`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['trader', 'guild_member']
      });
    }
    
    const relationships: Relationship[] = [
      { kind: 'controls', src: 'will-be-assigned-0', dst: colony.id }
    ];
    
    merchants.forEach((_, i) => {
      relationships.push({
        kind: 'member_of',
        src: `will-be-assigned-${i + 1}`,
        dst: 'will-be-assigned-0'
      });
      relationships.push({
        kind: 'resident_of',
        src: `will-be-assigned-${i + 1}`,
        dst: colony.id
      });
    });
    
    return {
      entities: [guild, ...merchants],
      relationships,
      description: `Merchants organize into ${guild.name}`
    };
  }
};
