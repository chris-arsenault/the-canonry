#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  compileCanonProject,
  compileCanonStaticPages,
} from '../packages/canonry-dsl-v2/dist/compile.js';
import {
  serializeCanonProject,
  serializeCanonStaticPages,
} from '../packages/canonry-dsl-v2/dist/serialize.js';
import { computeUsageMap } from '../packages/shared-components/src/utils/schemaUsageMap.js';

const JSON_FILE_MAP = {
  entityKinds: 'entityKinds.json',
  relationshipKinds: 'relationshipKinds.json',
  cultures: 'cultures.json',
  tagRegistry: 'tagRegistry.json',
  axisDefinitions: 'axisDefinitions.json',
  uiConfig: 'uiConfig.json',
  illuminatorConfig: 'illuminatorConfig.json',
  eras: 'eras.json',
  pressures: 'pressures.json',
  generators: 'generators.json',
  systems: 'systems.json',
  actions: 'actions.json',
  seedEntities: 'seedEntities.json',
  seedRelationships: 'seedRelationships.json',
  distributionTargets: 'distributionTargets.json',
};

const PROJECT_DEFAULTS = {
  entityKinds: [],
  relationshipKinds: [],
  cultures: [],
  tagRegistry: [],
  axisDefinitions: [],
  uiConfig: null,
  illuminatorConfig: null,
  eras: [],
  pressures: [],
  generators: [],
  systems: [],
  actions: [],
  seedEntities: [],
  seedRelationships: [],
  distributionTargets: null,
};

const ROOT_KEYS = new Set(Object.keys(JSON_FILE_MAP));
const REGISTRY_EXPORT_FILENAME = 'canon-registry.json';

function printUsage() {
  console.log(`Usage:
  node scripts/conduit.js --dir <path> --to <canon|json> [--out-dir <path>]
  node scripts/conduit.js --dir <path> --lint
  node scripts/conduit.js --dir <path> --overview
  node scripts/conduit.js --dir <path> --registry
  node scripts/conduit.js --dir <path> --registry-export

Options:
  --dir, -d   Project directory (default: cwd)
  --out-dir, -o Output directory (default: --dir)
  --to        Output format: canon or json
  --canon     Alias for --to canon
  --json      Alias for --to json
  --lint      Validate syntax and references without converting
  --overview  Print a summary of project contents
  --registry  Print the resource registry
  --registry-export Write the resource registry to ${REGISTRY_EXPORT_FILENAME}
  --help      Show this help
`);
}

function parseArgs(argv) {
  const options = { dir: process.cwd(), dirProvided: false, outDir: null, to: null, lint: false, overview: false, registry: false, registryExport: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dir' || arg === '-d') {
      options.dir = argv[i + 1];
      options.dirProvided = true;
      i += 1;
      continue;
    }
    if (arg === '--out-dir' || arg === '-o') {
      options.outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--to') {
      options.to = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--canon') {
      options.to = 'canon';
      continue;
    }
    if (arg === '--json') {
      options.to = 'json';
      continue;
    }
    if (arg === '--lint') {
      options.lint = true;
      continue;
    }
    if (arg === '--overview' || arg === '--summary') {
      options.overview = true;
      continue;
    }
    if (arg === '--registry') {
      options.registry = true;
      continue;
    }
    if (arg === '--registry-export') {
      options.registryExport = true;
      continue;
    }
  }
  return options;
}

function formatCanonDiagnostics(diagnostics = []) {
  return diagnostics
    .map((diag) => {
      if (!diag) return null;
      const location = diag.span?.start
        ? ` (${diag.span.file}:${diag.span.start.line}:${diag.span.start.column})`
        : '';
      return `${diag.message}${location}`;
    })
    .filter(Boolean)
    .join('\n');
}

function diagnosticsToMessages(diagnostics = []) {
  const errors = [];
  const warnings = [];
  for (const diag of diagnostics) {
    if (!diag) continue;
    const location = diag.span?.start
      ? ` (${diag.span.file}:${diag.span.start.line}:${diag.span.start.column})`
      : '';
    const message = `${diag.message}${location}`;
    if (diag.severity === 'warning') {
      warnings.push(message);
    } else {
      errors.push(message);
    }
  }
  return { errors, warnings };
}

async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function readJsonFileWithDiagnostics(filePath, errors, warnings) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      warnings.push(`Missing ${path.basename(filePath)}`);
      return undefined;
    }
    errors.push(`Invalid JSON in ${path.basename(filePath)}: ${error?.message || error}`);
    return undefined;
  }
}

async function writeJsonFile(filePath, data) {
  const contents = JSON.stringify(data, null, 2);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${contents}\n`, 'utf8');
}

async function listFiles(dir, extension) {
  const matches = [];
  const ignoreDirs = new Set(['node_modules', '.git', 'dist']);

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        await walk(path.join(current, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(extension)) {
        const absPath = path.join(current, entry.name);
        const relPath = path.relative(dir, absPath).split(path.sep).join('/');
        matches.push({ absPath, relPath });
      }
    }
  }

  await walk(dir);
  return matches;
}

async function resolveCanonRoot(dir) {
  const candidates = [
    path.join(dir, 'conduit', 'canon'),
    path.join(dir, 'canon'),
  ];

  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);
      if (!stats.isDirectory()) continue;
      const canonFiles = await listFiles(candidate, '.canon');
      if (canonFiles.length > 0) {
        return candidate;
      }
    } catch (error) {
      // ignore missing candidate
    }
  }

  const canonFiles = await listFiles(dir, '.canon');
  return canonFiles.length > 0 ? dir : dir;
}

async function ensureDirectory(dir) {
  const stats = await stat(dir);
  if (!stats.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }
}

async function resolveRegistryDir(dir, dirProvided) {
  if (dirProvided) return dir;
  const candidate = path.join(dir, 'apps', 'canonry', 'webui', 'public', 'default-project');
  try {
    const stats = await stat(candidate);
    if (stats.isDirectory()) {
      return candidate;
    }
  } catch (error) {
    // ignore
  }
  return dir;
}

async function ensureOutputDirectory(dir) {
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${dir}`);
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      await mkdir(dir, { recursive: true });
      return;
    }
    throw error;
  }
}

async function writeOutputFile(baseDir, file) {
  const outputPath = path.join(baseDir, file.path);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, file.content, 'utf8');
}

async function loadCanonProject(dir, canonRoot = null) {
  const errors = [];
  const warnings = [];
  const rootDir = canonRoot || (await resolveCanonRoot(dir));
  const canonFiles = await listFiles(rootDir, '.canon');
  if (canonFiles.length === 0) {
    errors.push(`No .canon files found in ${rootDir}`);
    return { config: null, errors, warnings, source: 'canon' };
  }

  const sources = await Promise.all(
    canonFiles.map(async (file) => ({
      path: file.relPath,
      content: await readFile(file.absPath, 'utf8'),
    }))
  );

  const { config, diagnostics } = compileCanonProject(sources);
  const diagnosticMessages = diagnosticsToMessages(diagnostics);
  errors.push(...diagnosticMessages.errors);
  warnings.push(...diagnosticMessages.warnings);

  const mdFiles = await listFiles(rootDir, '.md');
  const staticSources = await Promise.all(
    [...canonFiles, ...mdFiles].map(async (file) => ({
      path: file.relPath,
      content: await readFile(file.absPath, 'utf8'),
    }))
  );
  const { diagnostics: pageDiagnostics } = compileCanonStaticPages(staticSources);
  const pageMessages = diagnosticsToMessages(pageDiagnostics);
  errors.push(...pageMessages.errors);
  warnings.push(...pageMessages.warnings);

  return { config, errors, warnings, source: 'canon' };
}

async function loadJsonProject(dir) {
  const errors = [];
  const warnings = [];

  const manifest = await readJsonFileWithDiagnostics(path.join(dir, 'manifest.json'), errors, warnings);
  if (!manifest) {
    errors.push(`Missing manifest.json in ${dir}`);
    return { config: null, errors, warnings, source: 'json' };
  }

  const project = { ...manifest };
  for (const [key, filename] of Object.entries(JSON_FILE_MAP)) {
    const value = await readJsonFileWithDiagnostics(path.join(dir, filename), errors, warnings);
    if (value !== undefined) {
      project[key] = value;
    }
  }

  for (const [key, fallback] of Object.entries(PROJECT_DEFAULTS)) {
    if (project[key] === undefined) {
      project[key] = fallback;
    }
  }

  await readJsonFileWithDiagnostics(path.join(dir, 'staticPages.json'), errors, warnings);

  return { config: project, errors, warnings, source: 'json' };
}

async function loadProjectForLint(dir) {
  const canonRoot = await resolveCanonRoot(dir);
  const canonFiles = await listFiles(canonRoot, '.canon');
  if (canonFiles.length > 0) {
    return loadCanonProject(dir, canonRoot);
  }
  return loadJsonProject(dir);
}

function extractTagKeys(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.filter((tag) => typeof tag === 'string');
  }
  if (typeof tags === 'object') {
    return Object.keys(tags);
  }
  return [];
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectRegistry(config) {
  const registry = new Map();
  const add = (type, id) => {
    if (!id || typeof id !== 'string') return;
    if (!registry.has(type)) registry.set(type, new Set());
    registry.get(type).add(id);
  };

  const collectList = (items, type, idKey) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item) continue;
      if (typeof idKey === 'function') {
        add(type, idKey(item));
        continue;
      }
      if (typeof idKey === 'string' && isRecord(item)) {
        add(type, item[idKey]);
      }
    }
  };

  collectList(config.entityKinds, 'entity_kind', 'kind');
  collectList(config.relationshipKinds, 'relationship_kind', 'kind');
  collectList(config.cultures, 'culture', 'id');
  collectList(config.eras, 'era', 'id');
  collectList(config.pressures, 'pressure', 'id');
  collectList(config.axisDefinitions, 'axis', 'id');

  if (Array.isArray(config.tagRegistry)) {
    config.tagRegistry.forEach((entry) => {
      if (typeof entry === 'string') {
        add('tag', entry);
      } else if (isRecord(entry)) {
        add('tag', entry.tag);
      }
    });
  }

  if (Array.isArray(config.cultures)) {
    config.cultures.forEach((culture) => {
      if (!isRecord(culture)) return;
      const naming = culture.naming;
      if (!isRecord(naming)) return;

      collectList(naming.domains, 'domain', 'id');
      collectList(naming.grammars, 'grammar', 'id');
      collectList(naming.profiles, 'profile', 'id');
      collectList(naming.lexemeSpecs, 'lexeme_spec', 'id');

      const lexemeLists = naming.lexemeLists;
      if (isRecord(lexemeLists)) {
        Object.keys(lexemeLists).forEach((id) => add('lexeme_list', id));
      }
      if (Array.isArray(lexemeLists)) {
        lexemeLists.forEach((entry) => {
          if (isRecord(entry)) add('lexeme_list', entry.id);
        });
      }
    });
  }

  const output = {};
  for (const [type, ids] of registry.entries()) {
    output[type] = Array.from(ids).sort((a, b) => a.localeCompare(b));
  }
  return output;
}


function collectSubtypesFromSpec(value, output) {
  if (!value) return;
  if (typeof value === 'string') {
    if (value.startsWith('$')) return;
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSubtypesFromSpec(entry, output));
    return;
  }
  if (isRecord(value)) {
    if (typeof value.inherit === 'string' && !value.inherit.startsWith('$')) output.add(value.inherit);
    if (Array.isArray(value.random)) {
      value.random.forEach((entry) => {
        if (typeof entry === 'string' && !entry.startsWith('$')) output.add(entry);
      });
    }
    if (isRecord(value.fromPressure)) {
      Object.values(value.fromPressure).forEach((entry) => {
        if (typeof entry === 'string' && !entry.startsWith('$')) output.add(entry);
      });
    }
  }
}

function collectStrings(value, output) {
  if (!value) return;
  if (typeof value === 'string') {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === 'string') output.add(entry);
    });
  }
}

function scanForSubtypeStatus(value, subtypeSet, statusSet) {
  const subtypeKeys = new Set([
    'subtype',
    'subtypes',
    'excludeSubtypes',
    'governanceFactionSubtype',
    'targetSubtype',
    'fixedSubtype',
    'subtypePreferences',
  ]);
  const statusKeys = new Set([
    'status',
    'statusFilter',
    'statuses',
    'notStatus',
    'toStatus',
    'newStatus',
    'targetStatus',
    'aliveStatus',
    'lowAdoptionStatus',
  ]);

  function walk(node) {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;

    for (const [key, entry] of Object.entries(node)) {
      if (key === 'subtypePreferences' && isRecord(entry)) {
        Object.keys(entry).forEach((subtype) => subtypeSet.add(subtype));
      }
      if (subtypeKeys.has(key)) {
        collectSubtypesFromSpec(entry, subtypeSet);
      }
      if (statusKeys.has(key)) {
        collectStrings(entry, statusSet);
      }
      walk(entry);
    }
  }

  walk(value);
}

function validateReferentialIntegrity(config, errors, warnings) {
  const entityKinds = Array.isArray(config.entityKinds) ? config.entityKinds : [];
  const relationshipKinds = Array.isArray(config.relationshipKinds) ? config.relationshipKinds : [];
  const tagRegistry = Array.isArray(config.tagRegistry) ? config.tagRegistry : [];
  const pressures = Array.isArray(config.pressures) ? config.pressures : [];
  const generators = Array.isArray(config.generators) ? config.generators : [];
  const systems = Array.isArray(config.systems) ? config.systems : [];
  const actions = Array.isArray(config.actions) ? config.actions : [];
  const eras = Array.isArray(config.eras) ? config.eras : [];
  const seedEntities = Array.isArray(config.seedEntities) ? config.seedEntities : [];
  const seedRelationships = Array.isArray(config.seedRelationships) ? config.seedRelationships : [];

  const kindSet = new Set(entityKinds.map((kind) => kind?.kind).filter(Boolean));
  const relationshipSet = new Set(relationshipKinds.map((kind) => kind?.kind).filter(Boolean));
  const tagSet = new Set(
    tagRegistry
      .map((tag) => (typeof tag === 'string' ? tag : tag?.tag))
      .filter(Boolean)
  );

  const subtypeByKind = new Map();
  const statusByKind = new Map();
  const allSubtypes = new Set();
  const allStatuses = new Set();

  entityKinds.forEach((kind) => {
    if (!kind || typeof kind.kind !== 'string') return;
    const subtypes = new Set(
      (kind.subtypes || [])
        .map((subtype) => (typeof subtype === 'string' ? subtype : subtype?.id))
        .filter(Boolean)
    );
    const statuses = new Set(
      (kind.statuses || [])
        .map((status) => (typeof status === 'string' ? status : status?.id))
        .filter(Boolean)
    );
    subtypeByKind.set(kind.kind, subtypes);
    statusByKind.set(kind.kind, statuses);
    subtypes.forEach((subtype) => allSubtypes.add(subtype));
    statuses.forEach((status) => allStatuses.add(status));
  });

  relationshipKinds.forEach((rel) => {
    if (!rel || typeof rel.kind !== 'string') return;
    const srcKinds = Array.isArray(rel.srcKinds) ? rel.srcKinds : [];
    const dstKinds = Array.isArray(rel.dstKinds) ? rel.dstKinds : [];
    srcKinds.forEach((kind) => {
      if (!kindSet.has(kind)) {
        errors.push(`relationship_kind "${rel.kind}": srcKind ${kind} is not a valid entity kind`);
      }
    });
    dstKinds.forEach((kind) => {
      if (!kindSet.has(kind)) {
        errors.push(`relationship_kind "${rel.kind}": dstKind ${kind} is not a valid entity kind`);
      }
    });
  });

  const seedEntityKinds = new Map();
  seedEntities.forEach((entity) => {
    if (!entity || typeof entity.id !== 'string') return;
    if (typeof entity.kind === 'string') {
      seedEntityKinds.set(entity.id, entity.kind);
    }
  });

  seedEntities.forEach((entity) => {
    if (!entity || typeof entity.id !== 'string') return;
    const kind = entity.kind;
    if (typeof kind !== 'string' || !kindSet.has(kind)) {
      errors.push(`seed_entity "${entity.id}": kind ${kind} is not a valid entity kind`);
      return;
    }
    const subtype = entity.subtype;
    if (typeof subtype === 'string') {
      const allowed = subtypeByKind.get(kind);
      if (!allowed || !allowed.has(subtype)) {
        errors.push(`seed_entity "${entity.id}": subtype ${subtype} is not a valid ${kind} subtype`);
      }
    }
    const status = entity.status;
    if (typeof status === 'string') {
      const allowed = statusByKind.get(kind);
      if (!allowed || !allowed.has(status)) {
        errors.push(`seed_entity "${entity.id}": status ${status} is not a valid ${kind} status`);
      }
    }
    const tags = extractTagKeys(entity.tags);
    tags.forEach((tag) => {
      if (!tagSet.has(tag)) {
        errors.push(`seed_entity "${entity.id}": tag ${tag} is not a valid tag`);
      }
    });
  });

  seedRelationships.forEach((rel, idx) => {
    if (!rel) return;
    const kind = rel.kind;
    if (typeof kind !== 'string' || !relationshipSet.has(kind)) {
      errors.push(`seed_relationship[${idx}]: kind ${kind} is not a valid relationship kind`);
    }
    const src = rel.src;
    const dst = rel.dst;
    if (typeof src === 'string' && !seedEntityKinds.has(src)) {
      errors.push(`seed_relationship[${idx}]: src ${src} is not a valid seed_entity id`);
    }
    if (typeof dst === 'string' && !seedEntityKinds.has(dst)) {
      errors.push(`seed_relationship[${idx}]: dst ${dst} is not a valid seed_entity id`);
    }
    const relDef = relationshipKinds.find((entry) => entry?.kind === kind);
    if (relDef && typeof src === 'string' && typeof dst === 'string') {
      const srcKind = seedEntityKinds.get(src);
      const dstKind = seedEntityKinds.get(dst);
      if (Array.isArray(relDef.srcKinds) && relDef.srcKinds.length > 0 && srcKind) {
        if (!relDef.srcKinds.includes(srcKind)) {
          errors.push(`seed_relationship[${idx}]: srcKind ${srcKind} is not valid for relationship_kind "${kind}"`);
        }
      }
      if (Array.isArray(relDef.dstKinds) && relDef.dstKinds.length > 0 && dstKind) {
        if (!relDef.dstKinds.includes(dstKind)) {
          errors.push(`seed_relationship[${idx}]: dstKind ${dstKind} is not valid for relationship_kind "${kind}"`);
        }
      }
    }
  });

  const schema = { entityKinds, relationshipKinds, tagRegistry };
  const safeSystems = systems.filter((sys) => isRecord(sys?.config));
  let usageMap;
  try {
    usageMap = computeUsageMap(schema, pressures, eras, generators, safeSystems, actions);
  } catch (error) {
    errors.push(`Failed to compute usage map: ${error?.message || error}`);
    return;
  }

  usageMap.validation.invalidRefs.forEach((ref) => {
    const location = ref.location ? `${ref.location}: ` : '';
    errors.push(`${location}${ref.type} "${ref.id}": ${ref.field} ${ref.refId} is not a valid ${ref.refType}`);
  });

  const usedTags = Object.entries(usageMap.tags || {})
    .filter(([, usage]) => {
      const total =
        (usage.generators?.length || 0) +
        (usage.systems?.length || 0) +
        (usage.actions?.length || 0) +
        (usage.pressures?.length || 0);
      return total > 0;
    })
    .map(([tag]) => tag);

  usedTags.forEach((tag) => {
    if (!tagSet.has(tag)) {
      errors.push(`tag ${tag} is not a valid tag`);
    }
  });

  usageMap.validation.compatibility.forEach((issue) => {
    warnings.push(`Compatibility: ${issue.type} ${issue.id} ${issue.field} ${issue.issue}`);
  });

  usageMap.validation.orphans.forEach((orphan) => {
    warnings.push(`Orphan ${orphan.type} "${orphan.id}": ${orphan.reason}`);
  });

  const subtypeRefs = new Set();
  const statusRefs = new Set();
  scanForSubtypeStatus(generators, subtypeRefs, statusRefs);
  scanForSubtypeStatus(systems, subtypeRefs, statusRefs);
  scanForSubtypeStatus(actions, subtypeRefs, statusRefs);
  scanForSubtypeStatus(eras, subtypeRefs, statusRefs);
  scanForSubtypeStatus(pressures, subtypeRefs, statusRefs);

  subtypeRefs.forEach((subtype) => {
    if (subtype === 'any') return;
    if (!allSubtypes.has(subtype)) {
      errors.push(`subtype ${subtype} is not a valid entity subtype`);
    }
  });
  statusRefs.forEach((status) => {
    if (status === 'any') return;
    if (!allStatuses.has(status)) {
      errors.push(`status ${status} is not a valid entity status`);
    }
  });
}

async function lintProject(dir) {
  const { config, errors, warnings } = await loadProjectForLint(dir);
  const allErrors = [...errors];
  const allWarnings = [...warnings];

  if (config && allErrors.length === 0) {
    validateReferentialIntegrity(config, allErrors, allWarnings);
  }

  if (allErrors.length > 0) {
    console.error(`Found ${allErrors.length} error(s):`);
    allErrors.forEach((message) => console.error(`- ${message}`));
  } else {
    console.log('No lint errors found.');
  }

  if (allWarnings.length > 0) {
    console.warn(`Found ${allWarnings.length} warning(s):`);
    allWarnings.forEach((message) => console.warn(`- ${message}`));
  }

  return allErrors.length === 0;
}

async function convertJsonToCanon(dir, outDir) {
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = await readJsonFile(manifestPath);
  if (!manifest) {
    throw new Error(`Missing manifest.json in ${dir}`);
  }

  const project = { ...manifest };
  for (const [key, filename] of Object.entries(JSON_FILE_MAP)) {
    const value = await readJsonFile(path.join(dir, filename));
    if (value !== undefined) {
      project[key] = value;
    }
  }

  const canonFiles = serializeCanonProject(project, { includeEmpty: true });
  await Promise.all(
    canonFiles.map((file) => writeOutputFile(outDir, file))
  );

  const staticPages = await readJsonFile(path.join(dir, 'staticPages.json'));
  if (staticPages !== undefined) {
    if (!Array.isArray(staticPages)) {
      throw new Error('staticPages.json must contain an array');
    }
    const staticFiles = serializeCanonStaticPages(staticPages, { includeEmpty: true });
    await Promise.all(
      staticFiles.map((file) => writeOutputFile(outDir, file))
    );
  }

  console.log(`Wrote ${canonFiles.length} .canon files to ${outDir}`);
}

async function convertCanonToJson(dir, outDir) {
  const rootDir = await resolveCanonRoot(dir);
  const canonFiles = await listFiles(rootDir, '.canon');
  if (canonFiles.length === 0) {
    throw new Error(`No .canon files found in ${rootDir}`);
  }

  const sources = await Promise.all(
    canonFiles.map(async (file) => ({
      path: file.relPath,
      content: await readFile(file.absPath, 'utf8'),
    }))
  );

  const { config, diagnostics } = compileCanonProject(sources);
  if (!config || diagnostics.some((diag) => diag.severity === 'error')) {
    throw new Error(`Invalid .canon project:\n${formatCanonDiagnostics(diagnostics)}`);
  }

  const manifest = {};
  for (const [key, value] of Object.entries(config)) {
    if (ROOT_KEYS.has(key)) continue;
    if (value === undefined) continue;
    manifest[key] = value;
  }

  await writeJsonFile(path.join(outDir, 'manifest.json'), manifest);

  for (const [key, filename] of Object.entries(JSON_FILE_MAP)) {
    const value = config[key] === undefined ? PROJECT_DEFAULTS[key] : config[key];
    await writeJsonFile(path.join(outDir, filename), value);
  }

  const mdFiles = await listFiles(rootDir, '.md');
  const staticSources = await Promise.all(
    [...canonFiles, ...mdFiles].map(async (file) => ({
      path: file.relPath,
      content: await readFile(file.absPath, 'utf8'),
    }))
  );
  const { pages, diagnostics: pageDiagnostics } = compileCanonStaticPages(staticSources);
  if (pageDiagnostics.some((diag) => diag.severity === 'error')) {
    throw new Error(`Invalid static pages:\n${formatCanonDiagnostics(pageDiagnostics)}`);
  }
  const hasStaticPagesFile = canonFiles.some(
    (file) => path.basename(file.relPath) === 'static_pages.canon'
  );
  if (pages && pages.length > 0) {
    await writeJsonFile(path.join(outDir, 'staticPages.json'), pages);
  } else if (hasStaticPagesFile) {
    await writeJsonFile(path.join(outDir, 'staticPages.json'), []);
  }

  console.log(`Wrote ${Object.keys(JSON_FILE_MAP).length} JSON files to ${outDir}`);
}

function formatOverviewCount(label, value) {
  return `${label}: ${value}`;
}

async function printOverview(dir) {
  const { config, errors, warnings, source } = await loadProjectForLint(dir);
  if (errors.length > 0) {
    console.error(`Found ${errors.length} error(s):`);
    errors.forEach((message) => console.error(`- ${message}`));
    return false;
  }

  if (warnings.length > 0) {
    console.warn(`Found ${warnings.length} warning(s):`);
    warnings.forEach((message) => console.warn(`- ${message}`));
  }

  if (!config) {
    console.log('No project data found.');
    return false;
  }

  let staticPagesCount = null;
  if (source === 'canon') {
    const rootDir = await resolveCanonRoot(dir);
    const canonFiles = await listFiles(rootDir, '.canon');
    const mdFiles = await listFiles(rootDir, '.md');
    const sources = await Promise.all(
      [...canonFiles, ...mdFiles].map(async (file) => ({
        path: file.relPath,
        content: await readFile(file.absPath, 'utf8'),
      }))
    );
    const { pages } = compileCanonStaticPages(sources);
    staticPagesCount = Array.isArray(pages) ? pages.length : 0;
  } else {
    const staticPages = await readJsonFile(path.join(dir, 'staticPages.json'));
    if (Array.isArray(staticPages)) staticPagesCount = staticPages.length;
  }

  const lines = [
    `Project overview (${source})`,
    config.id ? formatOverviewCount('id', config.id) : null,
    config.name ? formatOverviewCount('name', config.name) : null,
    config.version ? formatOverviewCount('version', config.version) : null,
    formatOverviewCount('entityKinds', Array.isArray(config.entityKinds) ? config.entityKinds.length : 0),
    formatOverviewCount('relationshipKinds', Array.isArray(config.relationshipKinds) ? config.relationshipKinds.length : 0),
    formatOverviewCount('cultures', Array.isArray(config.cultures) ? config.cultures.length : 0),
    formatOverviewCount('tagRegistry', Array.isArray(config.tagRegistry) ? config.tagRegistry.length : 0),
    formatOverviewCount('axisDefinitions', Array.isArray(config.axisDefinitions) ? config.axisDefinitions.length : 0),
    formatOverviewCount('eras', Array.isArray(config.eras) ? config.eras.length : 0),
    formatOverviewCount('pressures', Array.isArray(config.pressures) ? config.pressures.length : 0),
    formatOverviewCount('generators', Array.isArray(config.generators) ? config.generators.length : 0),
    formatOverviewCount('systems', Array.isArray(config.systems) ? config.systems.length : 0),
    formatOverviewCount('actions', Array.isArray(config.actions) ? config.actions.length : 0),
    formatOverviewCount('seedEntities', Array.isArray(config.seedEntities) ? config.seedEntities.length : 0),
    formatOverviewCount('seedRelationships', Array.isArray(config.seedRelationships) ? config.seedRelationships.length : 0),
    formatOverviewCount('staticPages', staticPagesCount ?? 0),
    formatOverviewCount('distributionTargets', config.distributionTargets ? 'present' : 'none'),
  ].filter(Boolean);

  lines.forEach((line) => console.log(line));
  return true;
}

async function printRegistry(dir, exportFile) {
  const { config, errors, warnings } = await loadProjectForLint(dir);
  if (errors.length > 0) {
    console.error(`Found ${errors.length} error(s):`);
    errors.forEach((message) => console.error(`- ${message}`));
    return false;
  }

  if (warnings.length > 0) {
    console.warn(`Found ${warnings.length} warning(s):`);
    warnings.forEach((message) => console.warn(`- ${message}`));
  }

  if (!config) {
    console.error('No project data found.');
    return false;
  }

  const registry = collectRegistry(config);
  const output = `${JSON.stringify(registry, null, 2)}\n`;
  if (exportFile) {
    await writeFile(exportFile, output, 'utf8');
    console.log(`Wrote registry to ${exportFile}`);
  } else {
    process.stdout.write(output);
  }
  return true;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || (!options.to && !options.lint && !options.overview && !options.registry && !options.registryExport)) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }
  if (!options.dir) {
    throw new Error('Missing --dir value');
  }

  const wantsRegistry = options.registry || options.registryExport;
  if (wantsRegistry) {
    if (options.to || options.lint || options.overview || options.outDir) {
      throw new Error('Registry command does not accept additional flags. Use only --dir with --registry or --registry-export.');
    }
    const registryDir = await resolveRegistryDir(path.resolve(options.dir), options.dirProvided);
    await ensureDirectory(registryDir);
    const exportPath = options.registryExport ? path.join(registryDir, REGISTRY_EXPORT_FILENAME) : null;
    const ok = await printRegistry(registryDir, exportPath);
    if (!ok) {
      process.exit(1);
    }
    return;
  }

  const targetDir = path.resolve(options.dir);
  await ensureDirectory(targetDir);

  const outDir = options.outDir ? path.resolve(options.outDir) : targetDir;
  if (options.to && outDir !== targetDir) {
    await ensureOutputDirectory(outDir);
  }

  if (options.lint) {
    const ok = await lintProject(targetDir);
    if (!ok) {
      process.exit(1);
    }
  }

  if (options.overview) {
    const ok = await printOverview(targetDir);
    if (!ok) {
      process.exit(1);
    }
  }

  if (options.to) {
    const mode = String(options.to).toLowerCase();
    if (mode === 'canon') {
      await convertJsonToCanon(targetDir, outDir);
      return;
    }
    if (mode === 'json') {
      await convertCanonToJson(targetDir, outDir);
      return;
    }
    throw new Error(`Unsupported --to "${options.to}". Use "canon" or "json".`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
