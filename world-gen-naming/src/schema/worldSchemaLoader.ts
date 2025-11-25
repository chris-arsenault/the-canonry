import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * World Schema Types
 */
export interface EntityKindSchema {
  kind: string;
  subtype: string[];
  status: string[];
}

export interface RelationshipSchema {
  [fromKind: string]: {
    [toKind: string]: string[];
  };
}

export interface WorldSchema {
  cultures?: Array<{
    id: string;
    name: string;
    description?: string;
    homeland?: string;
  }>;
  hardState: EntityKindSchema[];
  relationships?: RelationshipSchema;
}

/**
 * Culture-centric data model
 */
export interface EntityConfig {
  kind: string;  // npc, location, faction, rules, abilities
  domain?: any;  // PhonoDomain
  lexemeLists: {
    adjectives?: any;
    nouns?: any;
    verbs?: any;
    titles?: any;
    [key: string]: any;
  };
  grammars: any[];
  templates: any[];
  profile?: any;
  completionStatus: {
    domain: boolean;
    lexemes: number;  // count of lexeme lists
    templates: boolean;
    profile: boolean;
  };
}

export interface CultureConfig {
  id: string;
  name: string;
  description?: string;
  entityConfigs: {
    [entityKind: string]: EntityConfig;
  };
}

export interface MetaDomainV2 {
  version: string;
  schemaVersion: string;
  worldSchema: WorldSchema;
  cultures: {
    [cultureId: string]: CultureConfig;
  };
}

/**
 * Load and validate world schema
 */
export function loadWorldSchema(schemaPath?: string): WorldSchema {
  const path = schemaPath || join(__dirname, '../../worldSchema.json');

  if (!existsSync(path)) {
    // Try alternate location (parent world-gen project)
    const altPath = join(__dirname, '../../../world-gen/worldSchema.json');
    if (existsSync(altPath)) {
      const content = readFileSync(altPath, 'utf-8');
      return JSON.parse(content);
    }
    throw new Error(`World schema not found at ${path} or ${altPath}`);
  }

  const content = readFileSync(path, 'utf-8');
  const schema = JSON.parse(content);

  validateWorldSchema(schema);
  return schema;
}

/**
 * Validate world schema structure
 */
function validateWorldSchema(schema: any): asserts schema is WorldSchema {
  if (!schema.hardState || !Array.isArray(schema.hardState)) {
    throw new Error('Invalid schema: hardState must be an array');
  }

  // Validate each entity kind has required fields
  for (const entity of schema.hardState) {
    if (!entity.kind || !entity.subtype || !entity.status) {
      throw new Error(`Invalid entity schema: ${JSON.stringify(entity)}`);
    }
  }

  const cultureCount = schema.cultures?.length || 0;
  console.log(`✓ Schema validated: ${schema.hardState.length} entity kinds, ${cultureCount} cultures`);
}

/**
 * Get entity kinds from schema
 */
export function getEntityKinds(schema: WorldSchema): string[] {
  return schema.hardState.map(e => e.kind);
}

/**
 * Get subtypes for an entity kind
 */
export function getSubtypes(schema: WorldSchema, kind: string): string[] {
  const entity = schema.hardState.find(e => e.kind === kind);
  return entity?.subtype || [];
}

/**
 * Get status values for an entity kind
 */
export function getStatusValues(schema: WorldSchema, kind: string): string[] {
  const entity = schema.hardState.find(e => e.kind === kind);
  return entity?.status || [];
}

/**
 * Get valid relationships between two entity kinds
 */
export function getRelationships(
  schema: WorldSchema,
  fromKind: string,
  toKind: string
): string[] {
  return schema.relationships?.[fromKind]?.[toKind] || [];
}

/**
 * Initialize empty culture config
 */
export function createEmptyCulture(
  cultureId: string,
  schema: WorldSchema
): CultureConfig {
  const entityKinds = getEntityKinds(schema);
  const entityConfigs: { [key: string]: EntityConfig } = {};

  for (const kind of entityKinds) {
    entityConfigs[kind] = {
      kind,
      lexemeLists: {},
      grammars: [],
      templates: [],
      completionStatus: {
        domain: false,
        lexemes: 0,
        templates: false,
        profile: false,
      },
    };
  }

  return {
    id: cultureId,
    name: cultureId,
    entityConfigs,
  };
}

/**
 * Calculate completion percentage for a culture
 */
export function calculateCultureCompletion(culture: CultureConfig): number {
  const entityKinds = Object.keys(culture.entityConfigs);
  if (entityKinds.length === 0) return 0;

  let totalSteps = 0;
  let completedSteps = 0;

  for (const kind of entityKinds) {
    const config = culture.entityConfigs[kind];
    const status = config.completionStatus;

    // 4 steps per entity: domain, lexemes, templates, profile
    totalSteps += 4;

    if (status.domain) completedSteps += 1;
    if (status.lexemes > 0) completedSteps += Math.min(status.lexemes / 4, 1);
    if (status.templates) completedSteps += 1;
    if (status.profile) completedSteps += 1;
  }

  return Math.round((completedSteps / totalSteps) * 100);
}

/**
 * Calculate completion for specific entity config
 */
export function calculateEntityCompletion(config: EntityConfig): {
  total: number;
  completed: number;
  percentage: number;
} {
  let total = 4; // domain, lexemes, templates, profile
  let completed = 0;

  if (config.completionStatus.domain) completed++;
  if (config.completionStatus.lexemes > 0) {
    completed += Math.min(config.completionStatus.lexemes / 4, 1);
  }
  if (config.completionStatus.templates) completed++;
  if (config.completionStatus.profile) completed++;

  return {
    total,
    completed,
    percentage: Math.round((completed / total) * 100),
  };
}

/**
 * Auto-generate profile from entity config components
 */
export function autoGenerateProfile(
  cultureId: string,
  entityKind: string,
  config: EntityConfig
): any {
  const strategies: any[] = [];
  let totalWeight = 0;

  // Add templated strategy if templates exist
  if (config.templates && config.templates.length > 0) {
    const templateIds = config.templates.map((t: any) => t.id);
    strategies.push({
      id: `${cultureId}_${entityKind}_templated`,
      type: 'templated',
      weight: 0.5,
      templateIds,
    });
    totalWeight += 0.5;
  }

  // Add grammar strategy if grammars exist
  if (config.grammars && config.grammars.length > 0) {
    strategies.push({
      id: `${cultureId}_${entityKind}_grammar`,
      type: 'grammar',
      weight: 0.3,
      grammarId: config.grammars[0].id,
    });
    totalWeight += 0.3;
  }

  // Add phonotactic strategy if domain exists
  if (config.domain) {
    strategies.push({
      id: `${cultureId}_${entityKind}_phonotactic`,
      type: 'phonotactic',
      weight: 0.2,
      domainId: config.domain.id,
    });
    totalWeight += 0.2;
  }

  // Normalize weights
  if (totalWeight > 0) {
    for (const strategy of strategies) {
      strategy.weight = strategy.weight / totalWeight;
    }
  }

  return {
    id: `${cultureId}:${entityKind}`,
    cultureId,
    entityType: entityKind,
    strategies,
  };
}
