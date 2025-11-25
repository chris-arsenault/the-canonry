import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  MetaDomainV2,
  CultureConfig,
  EntityConfig,
  WorldSchema,
  loadWorldSchema,
  createEmptyCulture,
} from './worldSchemaLoader.js';

/**
 * Culture storage layer for new hierarchical file structure
 *
 * New structure:
 * data/
 *   {metaDomain}/
 *     schema.json
 *     {cultureId}/
 *       {entityKind}/
 *         domain.json
 *         lexemes.json
 *         templates.json
 *         profile.json
 */

const DATA_ROOT = './data';

/**
 * Get path to meta-domain directory
 */
function getMetaDomainPath(metaDomain: string): string {
  return join(DATA_ROOT, metaDomain);
}

/**
 * Get path to culture directory
 */
function getCulturePath(metaDomain: string, cultureId: string): string {
  return join(getMetaDomainPath(metaDomain), cultureId);
}

/**
 * Get path to entity config directory
 */
function getEntityPath(metaDomain: string, cultureId: string, entityKind: string): string {
  return join(getCulturePath(metaDomain, cultureId), entityKind);
}

/**
 * Ensure directory exists, create if not
 */
function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Load MetaDomainV2 configuration
 */
export function loadMetaDomain(metaDomain: string): MetaDomainV2 | null {
  const metaPath = getMetaDomainPath(metaDomain);
  const schemaPath = join(metaPath, 'schema.json');

  if (!existsSync(metaPath)) {
    console.log(`Meta-domain '${metaDomain}' does not exist`);
    return null;
  }

  // Load world schema
  let worldSchema: WorldSchema;
  if (existsSync(schemaPath)) {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    worldSchema = JSON.parse(schemaContent);
  } else {
    // Fall back to loading from world-gen project
    worldSchema = loadWorldSchema();
  }

  // Load all cultures
  const cultures: { [cultureId: string]: CultureConfig } = {};
  const entries = existsSync(metaPath) ? readdirSync(metaPath, { withFileTypes: true }) : [];

  // Skip legacy v1 directories that aren't cultures
  const legacyDirs = ['lexemes', 'domains', 'grammars', 'profiles', 'templates', 'specs'];

  for (const entry of entries) {
    if (entry.isDirectory() && !legacyDirs.includes(entry.name)) {
      const culture = loadCulture(metaDomain, entry.name, worldSchema);
      if (culture) {
        cultures[culture.id] = culture;
      }
    }
  }

  return {
    version: '2.0',
    schemaVersion: '1.0',
    worldSchema,
    cultures,
  };
}

/**
 * Load a single culture configuration
 */
export function loadCulture(
  metaDomain: string,
  cultureId: string,
  worldSchema?: WorldSchema
): CultureConfig | null {
  const culturePath = getCulturePath(metaDomain, cultureId);

  if (!existsSync(culturePath)) {
    console.log(`Culture '${cultureId}' does not exist in meta-domain '${metaDomain}'`);
    return null;
  }

  // Load schema if not provided
  let schema: WorldSchema;
  if (!worldSchema) {
    const schemaPath = join(getMetaDomainPath(metaDomain), 'schema.json');
    if (existsSync(schemaPath)) {
      schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    } else {
      schema = loadWorldSchema();
    }
  } else {
    schema = worldSchema;
  }

  // Initialize culture with empty configs
  const culture = createEmptyCulture(cultureId, schema);

  // Load entity configs
  const entityDirs = readdirSync(culturePath, { withFileTypes: true });

  for (const entry of entityDirs) {
    if (entry.isDirectory()) {
      const entityKind = entry.name;
      const entityConfig = loadEntityConfig(metaDomain, cultureId, entityKind);

      if (entityConfig) {
        culture.entityConfigs[entityKind] = entityConfig;
      }
    }
  }

  return culture;
}

/**
 * Load entity configuration from files
 */
export function loadEntityConfig(
  metaDomain: string,
  cultureId: string,
  entityKind: string
): EntityConfig | null {
  const entityPath = getEntityPath(metaDomain, cultureId, entityKind);

  if (!existsSync(entityPath)) {
    return null;
  }

  const config: EntityConfig = {
    kind: entityKind,
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

  // Load domain
  const domainPath = join(entityPath, 'domain.json');
  if (existsSync(domainPath)) {
    config.domain = JSON.parse(readFileSync(domainPath, 'utf-8'));
    config.completionStatus.domain = true;
  }

  // Load lexemes
  const lexemesPath = join(entityPath, 'lexemes.json');
  if (existsSync(lexemesPath)) {
    const lexemeData = JSON.parse(readFileSync(lexemesPath, 'utf-8'));
    config.lexemeLists = lexemeData.lexemeLists || {};
    config.completionStatus.lexemes = Object.keys(config.lexemeLists).length;
    console.log(`  📂 Loaded lexemes from ${lexemesPath}: ${Object.keys(config.lexemeLists).join(', ')}`);
  }

  // Load templates
  const templatesPath = join(entityPath, 'templates.json');
  if (existsSync(templatesPath)) {
    const templateData = JSON.parse(readFileSync(templatesPath, 'utf-8'));
    config.templates = templateData.templates || [];
    config.completionStatus.templates = config.templates.length > 0;
    console.log(`  📂 Loaded templates from ${templatesPath}: ${config.templates.length} templates`);
  }

  // Load grammars
  const grammarsPath = join(entityPath, 'grammars.json');
  if (existsSync(grammarsPath)) {
    const grammarData = JSON.parse(readFileSync(grammarsPath, 'utf-8'));
    config.grammars = grammarData.grammars || [];
    console.log(`  📂 Loaded grammars from ${grammarsPath}: ${config.grammars.length} grammars`);
  }

  // Load profile
  const profilePath = join(entityPath, 'profile.json');
  if (existsSync(profilePath)) {
    config.profile = JSON.parse(readFileSync(profilePath, 'utf-8'));
    config.completionStatus.profile = true;
    console.log(`  📂 Loaded profile from ${profilePath}: ${config.profile?.strategies?.length || 0} strategies`);
  }

  return config;
}

/**
 * Save MetaDomainV2 configuration
 */
export function saveMetaDomain(metaDomain: string, data: MetaDomainV2): void {
  const metaPath = getMetaDomainPath(metaDomain);
  ensureDir(metaPath);

  // Save schema
  const schemaPath = join(metaPath, 'schema.json');
  writeFileSync(schemaPath, JSON.stringify(data.worldSchema, null, 2));

  // Save each culture
  for (const cultureId in data.cultures) {
    saveCulture(metaDomain, data.cultures[cultureId]);
  }

  console.log(`✅ Saved meta-domain '${metaDomain}'`);
}

/**
 * Save a single culture configuration
 */
export function saveCulture(metaDomain: string, culture: CultureConfig): void {
  const culturePath = getCulturePath(metaDomain, culture.id);
  ensureDir(culturePath);

  // Save each entity config
  for (const entityKind in culture.entityConfigs) {
    saveEntityConfig(metaDomain, culture.id, culture.entityConfigs[entityKind]);
  }

  console.log(`✅ Saved culture '${culture.id}' in meta-domain '${metaDomain}'`);
}

/**
 * Save entity configuration to files
 */
export function saveEntityConfig(
  metaDomain: string,
  cultureId: string,
  config: EntityConfig
): void {
  const entityPath = getEntityPath(metaDomain, cultureId, config.kind);
  ensureDir(entityPath);

  // Save domain
  if (config.domain) {
    const domainPath = join(entityPath, 'domain.json');
    writeFileSync(domainPath, JSON.stringify(config.domain, null, 2));
  }

  // Save lexemes
  if (config.lexemeLists && Object.keys(config.lexemeLists).length > 0) {
    const lexemesPath = join(entityPath, 'lexemes.json');
    writeFileSync(
      lexemesPath,
      JSON.stringify({ lexemeLists: config.lexemeLists }, null, 2)
    );
  }

  // Save templates
  if (config.templates && config.templates.length > 0) {
    const templatesPath = join(entityPath, 'templates.json');
    writeFileSync(
      templatesPath,
      JSON.stringify({ templates: config.templates }, null, 2)
    );
  }

  // Save grammars
  if (config.grammars && config.grammars.length > 0) {
    const grammarsPath = join(entityPath, 'grammars.json');
    writeFileSync(
      grammarsPath,
      JSON.stringify({ grammars: config.grammars }, null, 2)
    );
  }

  // Save profile
  if (config.profile) {
    const profilePath = join(entityPath, 'profile.json');
    writeFileSync(profilePath, JSON.stringify(config.profile, null, 2));
  }

  console.log(`✅ Saved ${config.kind} config for culture '${cultureId}'`);
}

/**
 * Create new culture in meta-domain
 */
export function createCulture(
  metaDomain: string,
  cultureId: string,
  cultureName: string,
  worldSchema?: WorldSchema
): CultureConfig {
  // Load schema if not provided
  let schema: WorldSchema;
  if (!worldSchema) {
    const schemaPath = join(getMetaDomainPath(metaDomain), 'schema.json');
    if (existsSync(schemaPath)) {
      schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    } else {
      schema = loadWorldSchema();
    }
  } else {
    schema = worldSchema;
  }

  const culture = createEmptyCulture(cultureId, schema);
  culture.name = cultureName;

  // Save to disk
  saveCulture(metaDomain, culture);

  return culture;
}

/**
 * List all cultures in a meta-domain
 */
export function listCultures(metaDomain: string): string[] {
  const metaPath = getMetaDomainPath(metaDomain);

  if (!existsSync(metaPath)) {
    return [];
  }

  // Skip legacy v1 directories that aren't cultures
  const legacyDirs = ['lexemes', 'domains', 'grammars', 'profiles', 'templates', 'specs'];

  const entries = readdirSync(metaPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && !legacyDirs.includes(entry.name))
    .map(entry => entry.name);
}

/**
 * Delete a culture
 */
export function deleteCulture(metaDomain: string, cultureId: string): boolean {
  const culturePath = getCulturePath(metaDomain, cultureId);

  if (!existsSync(culturePath)) {
    return false;
  }

  // Delete recursively (use fs-extra or implement recursive delete)
  const { rmSync } = require('fs');
  rmSync(culturePath, { recursive: true, force: true });

  console.log(`🗑️ Deleted culture '${cultureId}' from meta-domain '${metaDomain}'`);
  return true;
}

/**
 * Migration: Convert old flat structure to new hierarchical structure
 */
export function migrateOldStructure(metaDomain: string): void {
  const oldPath = join(DATA_ROOT, metaDomain);

  if (!existsSync(oldPath)) {
    console.log(`No old data to migrate for '${metaDomain}'`);
    return;
  }

  console.log(`🔄 Migrating old structure for '${metaDomain}'...`);

  // Load world schema
  const worldSchema = loadWorldSchema();

  // Try to find old domains, grammars, profiles
  const oldDomainsPath = join(oldPath, 'domains');
  const oldGrammarsPath = join(oldPath, 'grammars');
  const oldProfilesPath = join(oldPath, 'profiles');
  const oldLexemesPath = join(oldPath, 'lexemes');

  let domains: any[] = [];
  let grammars: any[] = [];
  let profiles: any[] = [];
  let lexemes: any[] = [];

  // Load old data
  if (existsSync(oldDomainsPath)) {
    const files = readdirSync(oldDomainsPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(readFileSync(join(oldDomainsPath, file), 'utf-8'));
        if (Array.isArray(content)) {
          domains.push(...content);
        } else if (content.id) {
          domains.push(content);
        }
      }
    }
  }

  if (existsSync(oldGrammarsPath)) {
    const files = readdirSync(oldGrammarsPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(readFileSync(join(oldGrammarsPath, file), 'utf-8'));
        if (Array.isArray(content)) {
          grammars.push(...content);
        } else if (content.id) {
          grammars.push(content);
        }
      }
    }
  }

  if (existsSync(oldProfilesPath)) {
    const files = readdirSync(oldProfilesPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(readFileSync(join(oldProfilesPath, file), 'utf-8'));
        if (Array.isArray(content)) {
          profiles.push(...content);
        } else if (content.id) {
          profiles.push(content);
        }
      }
    }
  }

  if (existsSync(oldLexemesPath)) {
    const files = readdirSync(oldLexemesPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(readFileSync(join(oldLexemesPath, file), 'utf-8'));
        if (content.lexemeLists) {
          lexemes.push(...content.lexemeLists);
        }
      }
    }
  }

  // Group by culture ID (extracted from profile cultureId or domain ID)
  const cultureMap: Map<string, any> = new Map();

  // Process profiles first (they have cultureId)
  for (const profile of profiles) {
    const cultureId = profile.cultureId || 'default';

    if (!cultureMap.has(cultureId)) {
      cultureMap.set(cultureId, createEmptyCulture(cultureId, worldSchema));
    }

    const culture = cultureMap.get(cultureId)!;
    const entityKind = profile.entityType || 'npc';

    if (!culture.entityConfigs[entityKind]) {
      culture.entityConfigs[entityKind] = {
        kind: entityKind,
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

    culture.entityConfigs[entityKind].profile = profile;
    culture.entityConfigs[entityKind].completionStatus.profile = true;
  }

  // Process domains (match by ID pattern or just put in default)
  for (const domain of domains) {
    // Try to extract culture from domain ID (e.g., "elven_npc_domain" -> culture: "elven", entity: "npc")
    const parts = domain.id.split('_');
    const cultureId = parts.length > 1 ? parts[0] : 'default';
    const entityKind = parts.length > 2 ? parts[1] : 'npc';

    if (!cultureMap.has(cultureId)) {
      cultureMap.set(cultureId, createEmptyCulture(cultureId, worldSchema));
    }

    const culture = cultureMap.get(cultureId)!;

    if (!culture.entityConfigs[entityKind]) {
      culture.entityConfigs[entityKind] = {
        kind: entityKind,
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

    culture.entityConfigs[entityKind].domain = domain;
    culture.entityConfigs[entityKind].completionStatus.domain = true;
  }

  // Process grammars and lexemes similarly
  for (const grammar of grammars) {
    const parts = grammar.id.split('_');
    const cultureId = parts.length > 1 ? parts[0] : 'default';
    const entityKind = parts.length > 2 ? parts[1] : 'npc';

    if (!cultureMap.has(cultureId)) {
      cultureMap.set(cultureId, createEmptyCulture(cultureId, worldSchema));
    }

    const culture = cultureMap.get(cultureId)!;

    if (!culture.entityConfigs[entityKind]) {
      culture.entityConfigs[entityKind] = {
        kind: entityKind,
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

    culture.entityConfigs[entityKind].grammars.push(grammar);
  }

  for (const lexeme of lexemes) {
    const parts = lexeme.id.split('_');
    const cultureId = parts.length > 1 ? parts[0] : 'default';
    const entityKind = parts.length > 2 ? parts[1] : 'npc';

    if (!cultureMap.has(cultureId)) {
      cultureMap.set(cultureId, createEmptyCulture(cultureId, worldSchema));
    }

    const culture = cultureMap.get(cultureId)!;

    if (!culture.entityConfigs[entityKind]) {
      culture.entityConfigs[entityKind] = {
        kind: entityKind,
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

    const lexemeKey = parts.slice(2).join('_') || lexeme.id;
    culture.entityConfigs[entityKind].lexemeLists[lexemeKey] = lexeme;
    culture.entityConfigs[entityKind].completionStatus.lexemes++;
  }

  // Save all migrated cultures
  const metaDomainData: MetaDomainV2 = {
    version: '2.0',
    schemaVersion: '1.0',
    worldSchema,
    cultures: {},
  };

  for (const [cultureId, culture] of cultureMap.entries()) {
    metaDomainData.cultures[cultureId] = culture;
  }

  saveMetaDomain(metaDomain, metaDomainData);

  console.log(`✅ Migration complete! Created ${cultureMap.size} cultures`);
}
