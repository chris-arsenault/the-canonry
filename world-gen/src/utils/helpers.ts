import { Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';

// Name generation
const penguinFirstNames = [
  'Frost', 'Ice', 'Snow', 'Crystal', 'Aurora', 'Storm', 'Tide', 'Wave',
  'Glacier', 'Floe', 'Drift', 'Chill', 'Blizzard', 'Shimmer', 'Glint'
];

const penguinLastNames = [
  'beak', 'wing', 'diver', 'slider', 'walker', 'swimmer', 'fisher',
  'hunter', 'watcher', 'keeper', 'breaker', 'caller', 'singer'
];

const titles = {
  hero: ['Brave', 'Bold', 'Swift', 'Mighty'],
  mayor: ['Elder', 'Wise', 'High', 'Chief'],
  merchant: ['Trader', 'Dealer', 'Master', 'Guild'],
  outlaw: ['Shadow', 'Silent', 'Quick', 'Sly'],
  leader: ['Lord', 'Commander', 'Captain', 'Chief'],
  mystic: ['Seer', 'Oracle', 'Prophet', 'Mystic']
};

export function generateName(type: string = 'default'): string {
  const first = pickRandom(penguinFirstNames);
  const last = pickRandom(penguinLastNames);
  
  if (type in titles) {
    const title = pickRandom(titles[type as keyof typeof titles]);
    return `${title} ${first}${last}`;
  }
  
  return `${first}${last}`;
}

// ID generation
let idCounter = 1000;
export function generateId(prefix: string): string {
  return `${prefix}_${idCounter++}`;
}

// Random selection
export function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function pickMultiple<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

// Entity finding
export function findEntities(
  graph: Graph,
  criteria: Partial<HardState>
): HardState[] {
  const results: HardState[] = [];
  
  graph.entities.forEach(entity => {
    let matches = true;
    
    for (const [key, value] of Object.entries(criteria)) {
      if (entity[key as keyof HardState] !== value) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      results.push(entity);
    }
  });
  
  return results;
}

// Relationship helpers
export function getRelated(
  graph: Graph,
  entityId: string,
  relationshipKind?: string,
  direction: 'src' | 'dst' | 'both' = 'both'
): HardState[] {
  const related: HardState[] = [];
  
  graph.relationships.forEach(rel => {
    if (relationshipKind && rel.kind !== relationshipKind) return;
    
    if ((direction === 'src' || direction === 'both') && rel.src === entityId) {
      const entity = graph.entities.get(rel.dst);
      if (entity) related.push(entity);
    }
    
    if ((direction === 'dst' || direction === 'both') && rel.dst === entityId) {
      const entity = graph.entities.get(rel.src);
      if (entity) related.push(entity);
    }
  });
  
  return related;
}

export function hasRelationship(
  graph: Graph,
  srcId: string,
  dstId: string,
  kind?: string
): boolean {
  return graph.relationships.some(rel =>
    rel.src === srcId && 
    rel.dst === dstId && 
    (!kind || rel.kind === kind)
  );
}

// Location helpers
export function getResidents(graph: Graph, locationId: string): HardState[] {
  return getRelated(graph, locationId, 'resident_of', 'dst');
}

export function getLocation(graph: Graph, npcId: string): HardState | undefined {
  const locations = getRelated(graph, npcId, 'resident_of', 'src');
  return locations[0];
}

// Faction helpers
export function getFactionMembers(graph: Graph, factionId: string): HardState[] {
  return getRelated(graph, factionId, 'member_of', 'dst');
}

export function getFactionLeader(graph: Graph, factionId: string): HardState | undefined {
  const leaders = getRelated(graph, factionId, 'leader_of', 'dst');
  return leaders[0];
}

// Prominence helpers
export function getProminenceValue(prominence: HardState['prominence']): number {
  const values = {
    'forgotten': 0,
    'marginal': 1,
    'recognized': 2,
    'renowned': 3,
    'mythic': 4
  };
  return values[prominence] || 0;
}

export function adjustProminence(
  current: HardState['prominence'],
  delta: number
): HardState['prominence'] {
  const order: HardState['prominence'][] = [
    'forgotten', 'marginal', 'recognized', 'renowned', 'mythic'
  ];
  
  const currentIndex = order.indexOf(current);
  const newIndex = Math.max(0, Math.min(order.length - 1, currentIndex + delta));
  
  return order[newIndex];
}

// Initial state normalization
export function normalizeInitialState(entities: any[]): HardState[] {
  return entities.map(entity => ({
    id: entity.id || entity.name || generateId(entity.kind || 'unknown'),
    kind: entity.kind as HardState['kind'] || 'npc',
    subtype: entity.subtype || 'merchant',
    name: entity.name || generateName(),
    description: entity.description || '',
    status: entity.status || 'alive',
    prominence: entity.prominence as HardState['prominence'] || 'marginal',
    tags: entity.tags || [],
    links: entity.links || [],
    createdAt: 0,  // Initial entities created at tick 0
    updatedAt: 0
  }));
}

// Graph modification helpers
export function addEntity(graph: Graph, entity: Partial<HardState>): string {
  const id = generateId(entity.kind || 'unknown');

  const fullEntity: HardState = {
    id,
    kind: entity.kind || 'npc',
    subtype: entity.subtype || 'merchant',
    name: entity.name || generateName(),
    description: entity.description || '',
    status: entity.status || 'alive',
    prominence: entity.prominence || 'marginal',
    tags: entity.tags || [],
    links: entity.links || [],
    createdAt: entity.createdAt || graph.tick,
    updatedAt: entity.updatedAt || graph.tick
  };

  graph.entities.set(id, fullEntity);
  return id;
}

export function addRelationship(
  graph: Graph,
  kind: string,
  srcId: string,
  dstId: string
): void {
  // Check if relationship already exists
  if (hasRelationship(graph, srcId, dstId, kind)) {
    return;
  }

  // Check relationship limit per type
  const srcEntity = graph.entities.get(srcId);
  if (srcEntity && graph.config) {
    const existingOfType = srcEntity.links.filter(link => link.kind === kind).length;

    if (existingOfType >= graph.config.maxRelationshipsPerType) {
      console.warn(
        `⚠️  RELATIONSHIP LIMIT EXCEEDED:\n` +
        `   Entity: ${srcEntity.name} (${srcEntity.id})\n` +
        `   Type: ${kind}\n` +
        `   Current count: ${existingOfType}\n` +
        `   Limit: ${graph.config.maxRelationshipsPerType}\n` +
        `   Target: ${graph.entities.get(dstId)?.name || dstId}\n` +
        `   Tick: ${graph.tick}\n` +
        `   Era: ${graph.currentEra.name}`
      );
      return;
    }
  }

  // Add relationship
  graph.relationships.push({ kind, src: srcId, dst: dstId });

  // Update entity links
  const dstEntity = graph.entities.get(dstId);

  if (srcEntity) {
    srcEntity.links.push({ kind, src: srcId, dst: dstId });
    srcEntity.updatedAt = graph.tick;
  }

  if (dstEntity) {
    dstEntity.updatedAt = graph.tick;
  }
}

export function updateEntity(
  graph: Graph,
  entityId: string,
  changes: Partial<HardState>
): void {
  const entity = graph.entities.get(entityId);
  if (entity) {
    Object.assign(entity, changes, { updatedAt: graph.tick });
  }
}

// Validation helpers
export function validateRelationship(
  schema: any,
  srcKind: string,
  dstKind: string,
  relKind: string
): boolean {
  const allowedRelations = schema.relationships[srcKind]?.[dstKind];
  return allowedRelations?.includes(relKind) || false;
}

// Weighted random selection
export function weightedRandom<T>(
  items: T[],
  weights: number[]
): T | undefined {
  if (items.length === 0 || items.length !== weights.length) return undefined;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * Check if a probabilistic event should occur, scaled by an era modifier.
 *
 * @param baseProbability - Base chance of the event occurring (0.0 to 1.0)
 *                         e.g., 0.3 = 30% chance
 * @param eraModifier - Era-based multiplier for the probability
 *                      > 1 increases likelihood, < 1 decreases it
 * @returns true if the event should occur
 *
 * @example
 * // 30% base chance, doubled in conflict era (modifier = 2)
 * if (rollProbability(0.3, eraModifier)) {
 *   createConflict();
 * }
 */
export function rollProbability(baseProbability: number, eraModifier: number = 1.0): boolean {
  return Math.random() < Math.min(1, baseProbability * eraModifier);
}
