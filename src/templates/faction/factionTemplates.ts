import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, FactionSubtype } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

// Faction Growth Templates

export const factionSplinter: GrowthTemplate = {
  id: 'faction_splinter',
  name: 'Faction Schism',
  
  canApply: (graph: Graph) => {
    // Need factions with multiple members
    const factions = findEntities(graph, { kind: 'faction' });
    return factions.some(f => {
      const members = findEntities(graph, { kind: 'npc' })
        .filter(npc => npc.links.some(l => l.kind === 'member_of' && l.dst === f.id));
      return members.length >= 3;
    });
  },
  
  findTargets: (graph: Graph) => {
    const factions = findEntities(graph, { kind: 'faction' });
    return factions.filter(f => {
      const members = findEntities(graph, { kind: 'npc' })
        .filter(npc => npc.links.some(l => l.kind === 'member_of' && l.dst === f.id));
      return members.length >= 3;
    });
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const parentFaction = target || pickRandom(
      findEntities(graph, { kind: 'faction' })
    );
    
    // Determine splinter type based on parent and era
    const splinterType = determineSplinterType(parentFaction.subtype as FactionSubtype);
    
    const splinter: Partial<HardState> = {
      kind: 'faction',
      subtype: splinterType,
      name: `${parentFaction.name} ${pickRandom(['Reformists', 'Radicals', 'Purists'])}`,
      description: `A splinter group that broke away from ${parentFaction.name}`,
      status: 'waning',
      prominence: 'marginal',
      tags: ['splinter', ...parentFaction.tags.slice(0, 2)]
    };
    
    // Create a leader for the splinter
    const leader: Partial<HardState> = {
      kind: 'npc',
      subtype: Math.random() > 0.5 ? 'hero' : 'outlaw',
      name: generateName('leader'),
      description: `Charismatic leader of the ${splinter.name}`,
      status: 'alive',
      prominence: 'recognized',
      tags: ['rebel', 'charismatic']
    };
    
    // Find location for splinter (same as parent initially)
    const parentLocation = graph.entities.get(
      parentFaction.links.find(l => l.kind === 'controls' || l.kind === 'occupies')?.dst || ''
    );
    
    const relationships = [
      { kind: 'splinter_of', src: 'will-be-assigned-0', dst: parentFaction.id },
      { kind: 'leader_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' },
      { kind: 'at_war_with', src: 'will-be-assigned-0', dst: parentFaction.id }
    ];
    
    if (parentLocation) {
      relationships.push({
        kind: 'occupies',
        src: 'will-be-assigned-0',
        dst: parentLocation.id
      });
    }
    
    return {
      entities: [splinter, leader],
      relationships,
      description: `${parentFaction.name} splinters into rival factions`
    };
  }
};

export const guildEstablishment: GrowthTemplate = {
  id: 'guild_establishment',
  name: 'Guild Formation',
  
  canApply: (graph: Graph) => {
    // Need merchants and a colony
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
    
    // Create 2-3 merchant members
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
    
    const relationships = [
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

export const cultFormation: GrowthTemplate = {
  id: 'cult_formation',
  name: 'Cult Awakening',
  
  canApply: (graph: Graph) => {
    // Need anomalies or magic
    const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
    const magic = findEntities(graph, { kind: 'abilities', subtype: 'magic' });
    return anomalies.length > 0 || magic.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    // Target anomalies or locations near anomalies
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
    const location = target || pickRandom(
      findEntities(graph, { kind: 'location' })
    );
    
    const cult: Partial<HardState> = {
      kind: 'faction',
      subtype: 'cult',
      name: `${pickRandom(['Order', 'Covenant', 'Circle'])} of the ${pickRandom(['Fissure', 'Depths', 'Ice'])}`,
      description: `A mystical cult drawn to the power near ${location.name}`,
      status: 'illegal',
      prominence: 'marginal',
      tags: ['mystical', 'secretive', 'cult']
    };
    
    // Create cult leader (prophet)
    const prophet: Partial<HardState> = {
      kind: 'npc',
      subtype: 'hero', // Cults see their leaders as heroes
      name: generateName('mystic'),
      description: `The enigmatic prophet of ${cult.name}`,
      status: 'alive',
      prominence: 'recognized',
      tags: ['prophet', 'mystic']
    };
    
    // Create 2-3 cultists
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
    
    const relationships = [
      { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id },
      { kind: 'leader_of', src: 'will-be-assigned-1', dst: 'will-be-assigned-0' }
    ];
    
    // Connect cultists
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
    
    // Connect to magic if present
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

// Helper function
function determineSplinterType(parentType: FactionSubtype): FactionSubtype {
  const transitions: Record<FactionSubtype, FactionSubtype[]> = {
    'company': ['company', 'criminal'], // Merchants might turn to crime
    'political': ['political', 'cult'],  // Politics might turn mystical
    'criminal': ['criminal', 'political'], // Criminals might seek legitimacy
    'cult': ['cult', 'political'] // Cults might seek power
  };
  
  return pickRandom(transitions[parentType] || [parentType]);
}

// Collect all faction templates
export const factionTemplates: GrowthTemplate[] = [
  factionSplinter,
  guildEstablishment,
  cultFormation
];
