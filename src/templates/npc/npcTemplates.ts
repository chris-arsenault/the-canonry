import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, NPCSubtype, Relationship } from '../../types/worldTypes';
import { generateName, pickRandom, findEntities } from '../../utils/helpers';

// NPC Growth Templates

export const familyExpansion: GrowthTemplate = {
  id: 'family_expansion',
  name: 'Family Growth',
  
  canApply: (graph: Graph) => {
    // Need at least 2 NPCs in same location
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    return npcs.length >= 2;
  },
  
  findTargets: (graph: Graph) => {
    // Find pairs of NPCs in same colony
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    
    const validTargets: HardState[] = [];
    for (const colony of colonies) {
      const colonyNpcs = npcs.filter(npc => 
        npc.links.some(l => l.kind === 'resident_of' && l.dst === colony.id)
      );
      if (colonyNpcs.length >= 2) {
        validTargets.push(colonyNpcs[0]); // Use first as target
      }
    }
    return validTargets;
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    if (!target) throw new Error('Family expansion requires a target NPC');
    
    // Find partner in same location
    const colony = graph.entities.get(
      target.links.find(l => l.kind === 'resident_of')?.dst || ''
    );
    
    // Generate 1-3 children
    const numChildren = Math.floor(Math.random() * 3) + 1;
    const children: Partial<HardState>[] = [];
    
    // Inherit subtype from parents with variation
    const subtypes: NPCSubtype[] = ['merchant', 'hero', 'mayor', 'outlaw'];
    const parentSubtype = target.subtype as NPCSubtype;
    
    for (let i = 0; i < numChildren; i++) {
      const childSubtype = Math.random() > 0.7 
        ? pickRandom(subtypes) 
        : parentSubtype;
      
      children.push({
        kind: 'npc',
        subtype: childSubtype,
        name: generateName(),
        description: `Child of ${target.name}, raised in ${colony?.name}`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['second_generation', colony?.name.toLowerCase() || '']
      });
    }
    
    return {
      entities: children,
      relationships: children.map((child, i) => ({
        kind: 'mentor_of',
        src: target.id,
        dst: `will-be-assigned-${i}` // Will be resolved when entities get IDs
      })),
      description: `${target.name} raises a family in ${colony?.name}`
    };
  }
};

export const heroEmergence: GrowthTemplate = {
  id: 'hero_emergence',
  name: 'Hero Rises',
  
  canApply: (graph: Graph) => {
    // Triggers when pressure is high or conflict exists
    const conflictPressure = graph.pressures.get('conflict') || 0;
    return conflictPressure > 30 || graph.entities.size > 20;
  },
  
  findTargets: (graph: Graph) => {
    // Target colonies under stress
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
    
    // Heroes often discover or practice abilities
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

export const outlawRecruitment: GrowthTemplate = {
  id: 'outlaw_recruitment',
  name: 'Criminal Recruitment',
  
  canApply: (graph: Graph) => {
    // Need criminal factions
    const criminalFactions = findEntities(graph, { 
      kind: 'faction', 
      subtype: 'criminal' 
    });
    return criminalFactions.length > 0;
  },
  
  findTargets: (graph: Graph) => {
    return findEntities(graph, { kind: 'faction', subtype: 'criminal' });
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(
      findEntities(graph, { kind: 'faction', subtype: 'criminal' })
    );
    
    // Create 2-4 outlaws
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
    
    // Connect to faction and its stronghold
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

export const succession: GrowthTemplate = {
  id: 'succession',
  name: 'Leadership Succession',
  
  canApply: (graph: Graph) => {
    // Check for aging leaders or dead mayors
    const mayors = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
    return mayors.some(m => m.status === 'dead' || graph.tick > 50);
  },
  
  findTargets: (graph: Graph) => {
    const mayors = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
    return mayors.filter(m => m.status === 'dead' || 
      (graph.tick - m.createdAt) > 40);
  },
  
  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const oldLeader = target || pickRandom(
      findEntities(graph, { kind: 'npc', subtype: 'mayor' })
    );
    
    // Find their colony
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

    // Transfer leadership
    if (colony) {
      relationships.push({
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: colony.id
      });
    }

    // Inherit faction leadership if applicable
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

// Collect all NPC templates
export const npcTemplates: GrowthTemplate[] = [
  familyExpansion,
  heroEmergence,
  outlawRecruitment,
  succession
];
