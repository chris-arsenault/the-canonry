const INDENT = '  ';
const KEYWORDS = new Set(['do', 'end', 'true', 'false', 'null']);
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const QUALIFIED_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const KIND_SUBTYPE_RE = /^[A-Za-z_][A-Za-z0-9_-]*:[A-Za-z_][A-Za-z0-9_-]*$/;
const VARIABLE_RE = /^\$[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
const REF_KEYS = new Set([
  'entityRef',
  'src',
  'dst',
  'entity',
  'with',
  'relatedTo',
  'referenceEntity',
  'catalyzedBy',
  'inherit',
  'ref'
]);
const REF_LIST_KEYS = new Set(['entities']);
const SET_FIELD_KEYS = new Set([
  'tags',
  'links',
  'kinds',
  'entityKinds',
  'subtypes',
  'statuses',
  'excludeSubtypes',
  'excludeStatuses',
  'related',
  'relatedTags',
  'conflicts',
  'conflictingTags',
  'exclusive',
  'mutuallyExclusiveWith',
  'templates',
  'relationshipKinds',
  'excludeRelationships',
  'pairExcludeRelationships',
  'via',
  'srcKinds',
  'dstKinds',
  'culture_id',
  'cultureId'
]);

export interface CanonFile {
  path: string;
  content: string;
}

export interface StaticPageRecord {
  title?: string;
  slug?: string;
  summary?: string;
  status?: string;
  seedId?: string;
  content?: string;
  [key: string]: unknown;
}

interface CollectionDef {
  key: string;
  block: string;
  file: string;
  idKey?: string;
  nameKey?: string;
  sortKey?: (item: Record<string, unknown>) => string;
}

interface SingletonDef {
  key: string;
  block: string;
  file: string;
}

interface SerializeOptions {
  includeEmpty?: boolean;
}

interface StaticPageSerializeOptions extends SerializeOptions {
  pageDir?: string;
}

interface NamingResourceBuckets {
  domains: Record<string, unknown>[];
  grammars: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  lexemeSpecs: Record<string, unknown>[];
  lexemeLists: Record<string, unknown>[];
}

const COLLECTIONS: CollectionDef[] = [
  { key: 'entityKinds', block: 'entity_kind', file: 'entity_kinds.canon', idKey: 'kind' },
  { key: 'relationshipKinds', block: 'relationship_kind', file: 'relationship_kinds.canon', idKey: 'kind' },
  { key: 'cultures', block: 'culture', file: 'cultures.canon', idKey: 'id' },
  { key: 'tagRegistry', block: 'tag', file: 'tag_registry.canon', idKey: 'tag' },
  { key: 'axisDefinitions', block: 'axis', file: 'axis_definitions.canon', idKey: 'id' },
  { key: 'eras', block: 'era', file: 'eras.canon', idKey: 'id', nameKey: 'name' },
  { key: 'pressures', block: 'pressure', file: 'pressures.canon', idKey: 'id', nameKey: 'name' },
  { key: 'generators', block: 'generator', file: 'generators.canon', idKey: 'id', nameKey: 'name' },
  {
    key: 'systems',
    block: 'system',
    file: 'systems.canon',
    sortKey: (item) => {
      const config = item.config;
      if (isRecord(config) && typeof config.id === 'string') {
        return config.id;
      }
      return '';
    }
  },
  { key: 'actions', block: 'action', file: 'actions.canon', idKey: 'id', nameKey: 'name' },
  { key: 'seedEntities', block: 'seed_entity', file: 'seed_entities.canon', idKey: 'id' },
  { key: 'seedRelationships', block: 'seed_relationship', file: 'seed_relationships.canon' }
];

const SINGLETONS: SingletonDef[] = [
  { key: 'uiConfig', block: 'ui', file: 'ui_config.canon' },
  { key: 'distributionTargets', block: 'distribution_targets', file: 'distribution_targets.canon' }
];

const PROJECT_FILE = 'project.canon';

const ROOT_KEYS = new Set([
  ...COLLECTIONS.map(def => def.key),
  ...SINGLETONS.map(def => def.key)
]);

function collectNamingResourcesFromCultures(cultures: Record<string, unknown>[]): NamingResourceBuckets {
  const resources: NamingResourceBuckets = {
    domains: [],
    grammars: [],
    profiles: [],
    lexemeSpecs: [],
    lexemeLists: []
  };

  for (const culture of cultures) {
    if (!isRecord(culture) || typeof culture.id !== 'string') continue;
    const cultureId = culture.id;
    const naming = culture.naming;
    if (!isRecord(naming)) continue;

    const domains = Array.isArray(naming.domains) ? naming.domains : [];
    for (const domain of domains) {
      if (!isRecord(domain)) continue;
      resources.domains.push({ ...domain, cultureId });
    }

    const grammars = Array.isArray(naming.grammars) ? naming.grammars : [];
    for (const grammar of grammars) {
      if (!isRecord(grammar)) continue;
      resources.grammars.push({ ...grammar, cultureId });
    }

    const profiles = Array.isArray(naming.profiles) ? naming.profiles : [];
    for (const profile of profiles) {
      if (!isRecord(profile)) continue;
      resources.profiles.push({ ...profile, cultureId });
    }

    const specs = Array.isArray(naming.lexemeSpecs) ? naming.lexemeSpecs : [];
    for (const spec of specs) {
      if (!isRecord(spec)) continue;
      resources.lexemeSpecs.push({ ...spec, cultureId });
    }

    const lexemeLists = naming.lexemeLists;
    if (isRecord(lexemeLists)) {
      for (const [id, list] of Object.entries(lexemeLists)) {
        if (!isRecord(list)) continue;
        resources.lexemeLists.push({ id, ...list, cultureId });
      }
    } else if (Array.isArray(lexemeLists)) {
      for (const list of lexemeLists) {
        if (!isRecord(list)) continue;
        resources.lexemeLists.push({ ...list, cultureId });
      }
    }
  }

  resources.domains = mergeNamingResourceEntries(resources.domains);
  resources.grammars = mergeNamingResourceEntries(resources.grammars);
  resources.profiles = mergeNamingResourceEntries(resources.profiles);
  resources.lexemeSpecs = mergeNamingResourceEntries(resources.lexemeSpecs);
  resources.lexemeLists = mergeNamingResourceEntries(resources.lexemeLists);

  return resources;
}

function normalizeForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForSignature(entry));
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      result[key] = normalizeForSignature(value[key]);
    }
    return result;
  }
  return value;
}

function signatureForNamingResource(item: Record<string, unknown>): string {
  const payload = { ...item };
  delete payload.cultureId;
  return JSON.stringify(normalizeForSignature(payload));
}

function mergeNamingResourceEntries(entries: Record<string, unknown>[]): Record<string, unknown>[] {
  const grouped = new Map<string, Map<string, { item: Record<string, unknown>; cultures: Set<string> }>>();

  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const id = entry.id;
    if (typeof id !== 'string') continue;
    const signature = signatureForNamingResource(entry);
    const bySignature = grouped.get(id) ?? new Map();
    const existing = bySignature.get(signature);
    const cultureValues = entry.cultureId;
    const cultureIds: string[] = [];
    if (typeof cultureValues === 'string') {
      cultureIds.push(cultureValues);
    } else if (Array.isArray(cultureValues)) {
      cultureValues.forEach((value) => {
        if (typeof value === 'string') cultureIds.push(value);
      });
    }
    if (existing) {
      cultureIds.forEach((value) => existing.cultures.add(value));
    } else {
      const cultures = new Set<string>(cultureIds);
      bySignature.set(signature, { item: entry, cultures });
    }
    grouped.set(id, bySignature);
  }

  const merged: Record<string, unknown>[] = [];
  for (const [, bySignature] of grouped.entries()) {
    for (const { item, cultures } of bySignature.values()) {
      const cultureId = Array.from(cultures).sort((a, b) => a.localeCompare(b));
      const mergedItem = { ...item };
      mergedItem.cultureId = cultureId.length === 1 ? cultureId[0] : cultureId;
      merged.push(mergedItem);
    }
  }

  return merged;
}

function formatNamingResourceBlocks(resources: NamingResourceBuckets): string[] {
  const blocks: string[] = [];

  const sortById = (items: Record<string, unknown>[]) =>
    items.sort((a, b) => {
      const aId = typeof a.id === 'string' ? a.id : '';
      const bId = typeof b.id === 'string' ? b.id : '';
      return aId.localeCompare(bId);
    });

  for (const domain of sortById(resources.domains)) {
    if (!isRecord(domain)) continue;
    const lines = formatNamingDomainBlock(domain, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const grammar of sortById(resources.grammars)) {
    if (!isRecord(grammar)) continue;
    const lines = formatGrammarBlock(grammar, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const profile of sortById(resources.profiles)) {
    if (!isRecord(profile)) continue;
    const lines = formatProfileBlock(profile, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const spec of sortById(resources.lexemeSpecs)) {
    if (!isRecord(spec)) continue;
    const lines = formatLexemeSpecBlock(spec, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const list of sortById(resources.lexemeLists)) {
    if (!isRecord(list)) continue;
    const id = list.id;
    if (typeof id !== 'string') continue;
    const payload = { ...list };
    delete payload.id;
    const lines = formatLexemeListBlock(id, payload, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  return blocks;
}

function formatDistributionTargetsBlock(value: Record<string, unknown>): string | null {
  const lines = ['distribution_targets do'];
  const remaining = cloneAndStripRefs(value) as Record<string, unknown>;
  const perEraValue = remaining.perEra;
  delete remaining.perEra;

  const bodyLines = formatAttributeLines(remaining, 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }

  if (isRecord(perEraValue)) {
    const entries = Object.entries(perEraValue).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, entry] of entries) {
      if (!isRecord(entry)) continue;
      const blockLines = formatBlockBody(`per_era ${formatLabel(name)}`, entry, 1);
      if (blockLines) {
        lines.push(...blockLines);
      }
    }
  } else if (perEraValue !== undefined) {
    pushAttributeLine(lines, 'perEra', perEraValue, 1);
  }

  lines.push('end');
  return lines.join('\n');
}

export function serializeCanonProject(
  project: Record<string, unknown>,
  options: SerializeOptions = {}
): CanonFile[] {
  const includeEmpty = options.includeEmpty ?? true;
  const files: CanonFile[] = [];

  const projectFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(project)) {
    if (ROOT_KEYS.has(key)) continue;
    if (value === undefined) continue;
    projectFields[key] = value;
  }

  files.push({
    path: PROJECT_FILE,
    content: formatBlock('project', [], projectFields)
  });

  for (const def of SINGLETONS) {
    const value = project[def.key];
    if (value === undefined || value === null) {
      if (includeEmpty) {
        files.push({ path: def.file, content: '' });
      }
      continue;
    }
    const body = isRecord(value) ? value : { value };
    if (def.block === 'distribution_targets') {
      const content = isRecord(body) ? formatDistributionTargetsBlock(body) : null;
      files.push({ path: def.file, content: content ?? '' });
      continue;
    }
    files.push({ path: def.file, content: formatBlock(def.block, [], body) });
  }

  for (const def of COLLECTIONS) {
    const raw = project[def.key];
    const items = Array.isArray(raw) ? raw.slice() : [];
    if (items.length === 0) {
      if (includeEmpty) {
        files.push({ path: def.file, content: '' });
      }
      continue;
    }

    if (def.block === 'seed_relationship') {
      const blocks = formatSeedRelationshipGroups(items.filter(isRecord) as Record<string, unknown>[]);
      files.push({
        path: def.file,
        content: blocks.join('\n\n')
      });
      continue;
    }

    items.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (def.sortKey) return def.sortKey(a).localeCompare(def.sortKey(b));
      if (!def.idKey) return 0;
      const aValue = a[def.idKey];
      const bValue = b[def.idKey];
      if (typeof aValue !== 'string' || typeof bValue !== 'string') return 0;
      return aValue.localeCompare(bValue);
    });

    const blocks: string[] = [];
    const namingBlocks =
      def.block === 'culture'
        ? formatNamingResourceBlocks(collectNamingResourcesFromCultures(items.filter(isRecord) as Record<string, unknown>[]))
        : null;
    for (const item of items) {
      if (!isRecord(item)) continue;
      if (def.block === 'system') {
        const block = formatSystemBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'axis') {
        const line = formatAxisLine(item);
        if (line) blocks.push(line);
        continue;
      }
      if (def.block === 'relationship_kind') {
        const line = formatRelationshipKindLine(item);
        if (line) blocks.push(line);
        continue;
      }
      if (def.block === 'tag') {
        const line = formatTagLine(item);
        if (line) blocks.push(line);
        continue;
      }
      if (def.block === 'seed_relationship') {
        const block = formatSeedRelationshipBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'seed_entity') {
        const block = formatSeedEntityBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'entity_kind') {
        const block = formatEntityKindBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'era') {
        const block = formatEraBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'culture') {
        const block = formatCultureBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'action') {
        const block = formatActionBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'pressure') {
        const block = formatPressureBlock(item);
        if (block) blocks.push(block);
        continue;
      }

      const body = { ...item };
      const labels: string[] = [];
      if (def.idKey && typeof body[def.idKey] === 'string') {
        labels.push(body[def.idKey] as string);
        delete body[def.idKey];
      }
      if (def.nameKey && typeof body[def.nameKey] === 'string') {
        labels.push(body[def.nameKey] as string);
        delete body[def.nameKey];
      }

      blocks.push(formatBlock(def.block, labels, body));
    }

    if (namingBlocks && namingBlocks.length > 0) {
      blocks.push(...namingBlocks);
    }

    files.push({
      path: def.file,
      content: blocks.join('\n\n')
    });
  }

  return files;
}

export function serializeCanonStaticPages(
  pages: StaticPageRecord[],
  options: StaticPageSerializeOptions = {}
): CanonFile[] {
  const includeEmpty = options.includeEmpty ?? true;
  const pageDir = normalizeStaticPageDir(options.pageDir ?? 'page');
  const pagePrefix = pageDir ? `${pageDir}/` : '';
  const files: CanonFile[] = [];
  const blocks: string[] = [];
  const usedNames = new Set<string>();

  for (const page of pages || []) {
    if (!isRecord(page)) continue;
    const title = typeof page.title === 'string' && page.title.length > 0 ? page.title : 'Untitled';
    const inferredSlug = generateStaticPageSlug(title);
    const slug = typeof page.slug === 'string' && page.slug.length > 0 ? page.slug : inferredSlug;
    const filename = resolveStaticPageFilename(slug, usedNames);
    const outputPath = `${pagePrefix}${filename}`;

    const blockLines: string[] = [];
    blockLines.push(`static_page ${formatLabel(title)} do`);

    const remaining: Record<string, unknown> = { ...page };
    delete remaining.title;
    delete remaining.slug;
    delete remaining.content;

    if (page.seedId !== undefined) {
      pushAttributeLine(blockLines, 'seedId', page.seedId, 1);
      delete remaining.seedId;
    } else if ((remaining as Record<string, unknown>).seed_id !== undefined) {
      pushAttributeLine(blockLines, 'seedId', (remaining as Record<string, unknown>).seed_id, 1);
      delete (remaining as Record<string, unknown>).seed_id;
    }

    if (page.summary !== undefined) {
      pushAttributeLine(blockLines, 'summary', page.summary, 1);
      delete remaining.summary;
    }

    if (page.status !== undefined) {
      pushAttributeLine(blockLines, 'status', page.status, 1);
      delete remaining.status;
    }

    if (page.slug !== undefined && page.slug !== inferredSlug) {
      pushAttributeLine(blockLines, 'slug', page.slug, 1);
    }

    const extraLines = formatAttributeLines(remaining, 1);
    if (extraLines.length > 0) {
      blockLines.push(...extraLines);
    }

    blockLines.push(`${indent(1)}content read(${quoteString(outputPath)})`);
    blockLines.push('end');
    blocks.push(blockLines.join('\n'));

    files.push({
      path: outputPath,
      content: typeof page.content === 'string' ? page.content : ''
    });
  }

  if (blocks.length > 0 || includeEmpty) {
    files.unshift({
      path: 'static_pages.canon',
      content: blocks.join('\n\n')
    });
  }

  return files;
}

function formatSystemBlock(item: Record<string, unknown>): string | null {
  const systemType = item.systemType;
  if (typeof systemType !== 'string') return null;

  const configValue = item.config;
  const config = isRecord(configValue) ? { ...configValue } : {};
  const idLabel = typeof config.id === 'string' ? config.id : null;
  const nameLabel = typeof config.name === 'string' ? config.name : null;
  if (idLabel) delete config.id;
  if (nameLabel) delete config.name;

  const labels = [systemType];
  if (idLabel) labels.push(idLabel);
  if (nameLabel) labels.push(nameLabel);

  const lines = [`system ${labels.map(formatLabel).join(' ')} do`];
  if (item.enabled !== undefined) {
    pushInlinePairLine(lines, 'enabled', item.enabled, 1);
  }

  const systemLines = formatSystemConfigLines(systemType, config, 1);
  if (!systemLines) return null;
  if (systemLines.length > 0) {
    lines.push(...systemLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatSystemConfigLines(
  systemType: string,
  config: Record<string, unknown>,
  indentLevel: number
): string[] | null {
  switch (systemType) {
    case 'thresholdTrigger':
      return formatThresholdTriggerSystem(config, indentLevel);
    case 'connectionEvolution':
      return formatConnectionEvolutionSystem(config, indentLevel);
    case 'clusterFormation':
      return formatClusterFormationSystem(config, indentLevel);
    case 'graphContagion':
      return formatGraphContagionSystem(config, indentLevel);
    case 'planeDiffusion':
      return formatPlaneDiffusionSystem(config, indentLevel);
    case 'tagDiffusion':
      return formatTagDiffusionSystem(config, indentLevel);
    case 'eraSpawner':
      return formatEraSpawnerSystem(config, indentLevel);
    case 'eraTransition':
      return formatEraTransitionSystem(config, indentLevel);
    case 'universalCatalyst':
      return formatUniversalCatalystSystem(config, indentLevel);
    case 'relationshipMaintenance':
      return formatRelationshipMaintenanceSystem(config, indentLevel);
    default:
      return null;
  }
}

function formatOperatorKeyword(operator: string): string | null {
  if (operator === '>=') return 'gte';
  if (operator === '>') return 'gt';
  if (operator === '<=') return 'lte';
  if (operator === '<') return 'lt';
  if (operator === '==') return 'eq';
  return null;
}

function formatPressureChangeLines(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value)
    .filter(([, entry]) => typeof entry === 'number')
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  if (entries.length === 0) return [];
  return entries.map(([key, entry]) =>
    `${indent(indentLevel)}pressure ${formatLabel(String(key))} ${entry}`
  );
}

function formatSystemSelectionBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const selection = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines = [`${indent(indentLevel)}selection do`];
  const innerIndent = indentLevel + 1;

  if (selection.strategy !== undefined) {
    if (selection.strategy !== 'by_kind') {
      pushInlinePairLine(lines, 'strategy', selection.strategy, innerIndent);
    }
    delete selection.strategy;
  }

  const pickStrategy = selection.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete selection.pickStrategy;

  if (selection.kind !== undefined) {
    pushInlinePairLine(lines, 'kind', selection.kind, innerIndent);
    delete selection.kind;
  }
  if (selection.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', selection.kinds, innerIndent);
    delete selection.kinds;
  }

  if (Array.isArray(selection.subtypes) && selection.subtypes.length > 0) {
    if (selection.subtypes.length > 1) {
      const inline = formatSetInlineValue(selection.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'subtypes', selection.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', selection.subtypes[0], innerIndent);
    }
    delete selection.subtypes;
  }

  if (Array.isArray(selection.statuses) && selection.statuses.length > 0) {
    if (selection.statuses.length > 1) {
      const inline = formatSetInlineValue(selection.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'statuses', selection.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', selection.statuses[0], innerIndent);
    }
    delete selection.statuses;
  }

  if (selection.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', selection.statusFilter, innerIndent);
    delete selection.statusFilter;
  }

  if (selection.status !== undefined) {
    pushInlinePairLine(lines, 'status', selection.status, innerIndent);
    delete selection.status;
  }

  if (selection.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', selection.maxResults, innerIndent);
    delete selection.maxResults;
  }

  if (Array.isArray(selection.saturationLimits) && selection.saturationLimits.length > 0) {
    const saturationLines = formatSaturationLines(selection.saturationLimits, innerIndent);
    if (saturationLines) {
      lines.push(...saturationLines);
      delete selection.saturationLimits;
    }
  }

  if (selection.referenceEntity !== undefined) {
    pushInlinePairLine(lines, 'referenceEntity', selection.referenceEntity, innerIndent);
    delete selection.referenceEntity;
  }

  if (selection.relationshipKind !== undefined) {
    pushInlinePairLine(lines, 'relationshipKind', selection.relationshipKind, innerIndent);
    delete selection.relationshipKind;
  }

  if (selection.direction !== undefined) {
    pushInlinePairLine(lines, 'direction', selection.direction, innerIndent);
    delete selection.direction;
  }

  if (selection.mustHave !== undefined) {
    pushInlinePairLine(lines, 'mustHave', selection.mustHave, innerIndent);
    delete selection.mustHave;
  }

  if (selection.excludeSubtypes !== undefined) {
    pushInlinePairLine(lines, 'excludeSubtypes', selection.excludeSubtypes, innerIndent);
    delete selection.excludeSubtypes;
  }

  if (selection.notStatus !== undefined) {
    pushInlinePairLine(lines, 'notStatus', selection.notStatus, innerIndent);
    delete selection.notStatus;
  }

  if (selection.subtypePreferences !== undefined) {
    pushInlinePairLine(lines, 'subtypePreferences', selection.subtypePreferences, innerIndent);
    delete selection.subtypePreferences;
  }

  if (selection.maxDistance !== undefined) {
    pushInlinePairLine(lines, 'maxDistance', selection.maxDistance, innerIndent);
    delete selection.maxDistance;
  }

  if (selection.minProminence !== undefined) {
    pushInlinePairLine(lines, 'minProminence', selection.minProminence, innerIndent);
    delete selection.minProminence;
  }

  if (selection.filters !== undefined) {
    const filterLines = formatFilterLines(selection.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', selection.filters, innerIndent);
    }
    delete selection.filters;
  }

  if (selection.preferFilters !== undefined) {
    const preferLines = formatFilterLines(selection.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', selection.preferFilters, innerIndent);
    }
    delete selection.preferFilters;
  }

  for (const [key, entry] of Object.entries(selection)) {
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatSystemConditionLines(value: unknown, indentLevel: number): string[] | null {
  if (Array.isArray(value)) {
    const lines: string[] = [];
    for (const condition of value) {
      const conditionLines = formatSystemConditionLine(condition, indentLevel);
      if (!conditionLines) return null;
      lines.push(...conditionLines);
    }
    return lines;
  }
  if (isRecord(value)) {
    return formatSystemConditionLine(value, indentLevel);
  }
  return null;
}

function formatSystemConditionLine(condition: unknown, indentLevel: number): string[] | null {
  if (!isRecord(condition)) {
    const inline = formatInlineValue(condition);
    if (!inline) return null;
    return [`${indent(indentLevel)}condition ${inline}`];
  }
  const cleaned = cloneAndStripRefs(condition) as Record<string, unknown>;
  const type = cleaned.type;
  if (typeof type !== 'string') return null;

  if ((type === 'and' || type === 'or') && Array.isArray(cleaned.conditions)) {
    const mode = type === 'or' ? 'any' : 'all';
    const lines = [`${indent(indentLevel)}when ${mode} do`];
    for (const entry of cleaned.conditions) {
      const entryLines = formatSystemConditionLine(entry, indentLevel + 1);
      if (!entryLines) return null;
      lines.push(...entryLines);
    }
    lines.push(`${indent(indentLevel)}end`);
    return lines;
  }

  if (type === 'graph_path' && isRecord(cleaned.assert)) {
    return formatGraphPathLines(cleaned.assert, indentLevel, 'path');
  }

  if (type === 'tag_exists' && typeof cleaned.tag === 'string') {
    return [`${indent(indentLevel)}condition tag_exists ${formatLabel(cleaned.tag)}`];
  }

  if (type === 'lacks_tag' && typeof cleaned.tag === 'string') {
    if (typeof cleaned.entity === 'string') {
      return [
        `${indent(indentLevel)}condition lacks_tag ${formatLabel(stripBinding(cleaned.entity))} ${formatLabel(cleaned.tag)}`
      ];
    }
    return [`${indent(indentLevel)}condition lacks_tag ${formatLabel(cleaned.tag)}`];
  }

  if (type === 'relationship_exists' && typeof cleaned.relationshipKind === 'string') {
    const parts = [
      `${indent(indentLevel)}condition`,
      'relationship_exists',
      formatLabel(cleaned.relationshipKind)
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push(cleaned.direction);
    }
    if (typeof cleaned.targetKind === 'string') {
      parts.push('target_kind', formatLabel(cleaned.targetKind));
    }
    if (typeof cleaned.targetStatus === 'string') {
      parts.push('target_status', formatLabel(cleaned.targetStatus));
    }
    return [parts.join(' ')];
  }

  if (type === 'relationship_count' && typeof cleaned.relationshipKind === 'string') {
    const parts = [
      `${indent(indentLevel)}condition`,
      'relationship_count',
      formatLabel(cleaned.relationshipKind)
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push(cleaned.direction);
    }
    const min = cleaned.min;
    const max = cleaned.max;
    if (typeof min === 'number' && typeof max === 'number' && min !== max) {
      parts.push('between', String(min), String(max));
    } else if (typeof min === 'number' && typeof max === 'number' && min === max) {
      parts.push('eq', String(min));
    } else if (typeof min === 'number') {
      parts.push('gte', String(min));
    } else if (typeof max === 'number') {
      parts.push('lte', String(max));
    } else {
      return null;
    }
    return [parts.join(' ')];
  }

  if (type === 'random_chance' && typeof cleaned.chance === 'number') {
    return [`${indent(indentLevel)}condition random_chance ${cleaned.chance}`];
  }

  if (type === 'time_elapsed' && typeof cleaned.minTicks === 'number') {
    const parts = [`${indent(indentLevel)}condition time_elapsed`, String(cleaned.minTicks)];
    if (typeof cleaned.since === 'string') {
      parts.push('since', cleaned.since);
    }
    return [parts.join(' ')];
  }

  if (type === 'prominence') {
    if (typeof cleaned.min === 'string') {
      return [`${indent(indentLevel)}condition prominence min ${formatLabel(cleaned.min)}`];
    }
    if (typeof cleaned.max === 'string') {
      return [`${indent(indentLevel)}condition prominence max ${formatLabel(cleaned.max)}`];
    }
  }

  if (type === 'entity_exists' && typeof cleaned.entity === 'string') {
    return [`${indent(indentLevel)}condition entity_exists ${formatLabel(stripBinding(cleaned.entity))}`];
  }

  if (type === 'not_self') {
    return [`${indent(indentLevel)}condition not_self`];
  }

  return formatEntryLineOrBlock('condition', [], cleaned, indentLevel);
}

function formatSystemConditionInlineTokens(condition: unknown): string[] | null {
  if (!isRecord(condition)) return null;
  const cleaned = cloneAndStripRefs(condition) as Record<string, unknown>;
  const type = cleaned.type;
  if (type === 'entity_exists' && typeof cleaned.entity === 'string') {
    return ['entity_exists', formatLabel(stripBinding(cleaned.entity))];
  }
  if (type === 'tag_exists' && typeof cleaned.tag === 'string') {
    return ['tag_exists', formatLabel(cleaned.tag)];
  }
  if (type === 'lacks_tag' && typeof cleaned.tag === 'string') {
    if (typeof cleaned.entity === 'string') {
      return ['lacks_tag', formatLabel(stripBinding(cleaned.entity)), formatLabel(cleaned.tag)];
    }
    return ['lacks_tag', formatLabel(cleaned.tag)];
  }
  return null;
}

function formatActionListBlock(
  name: string,
  actions: unknown[],
  indentLevel: number
): string[] | null {
  if (!Array.isArray(actions)) return null;
  const lines: string[] = [`${indent(indentLevel)}${name} do`];
  for (const action of actions) {
    const actionLines = formatActionMutationLine(action, indentLevel + 1);
    if (!actionLines) return null;
    lines.push(...actionLines);
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatMetricBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const metric = cloneAndStripRefs(value) as Record<string, unknown>;
  const type = metric.type;
  if (typeof type !== 'string') return null;
  const lines: string[] = [`${indent(indentLevel)}metric ${formatLabel(type)} do`];
  const innerIndent = indentLevel + 1;
  const remaining = { ...metric };
  delete remaining.type;

  if (type === 'shared_relationship') {
    if (remaining.sharedRelationshipKind !== undefined) {
      pushInlinePairLine(lines, 'relationship', remaining.sharedRelationshipKind, innerIndent);
      delete remaining.sharedRelationshipKind;
    }
    if (remaining.sharedDirection !== undefined) {
      pushInlinePairLine(lines, 'direction', remaining.sharedDirection, innerIndent);
      delete remaining.sharedDirection;
    }
  } else if (type === 'connection_count') {
    if (remaining.relationshipKinds !== undefined) {
      pushInlinePairLine(lines, 'relationships', remaining.relationshipKinds, innerIndent);
      delete remaining.relationshipKinds;
    }
    if (remaining.direction !== undefined) {
      pushInlinePairLine(lines, 'direction', remaining.direction, innerIndent);
      delete remaining.direction;
    }
    if (remaining.minStrength !== undefined) {
      pushInlinePairLine(lines, 'min_strength', remaining.minStrength, innerIndent);
      delete remaining.minStrength;
    }
  } else if (type === 'neighbor_prominence') {
    if (remaining.direction !== undefined) {
      pushInlinePairLine(lines, 'direction', remaining.direction, innerIndent);
      delete remaining.direction;
    }
    if (remaining.minStrength !== undefined) {
      pushInlinePairLine(lines, 'min_strength', remaining.minStrength, innerIndent);
      delete remaining.minStrength;
    }
  } else if (type === 'neighbor_kind_count') {
    if (remaining.kind !== undefined) {
      pushInlinePairLine(lines, 'kind', remaining.kind, innerIndent);
      delete remaining.kind;
    }
    if (remaining.via !== undefined) {
      const inline = formatInlineList(remaining.via as unknown[]);
      if (inline) {
        lines.push(`${indent(innerIndent)}via ${inline}`);
      } else {
        pushInlinePairLine(lines, 'via', remaining.via, innerIndent);
      }
      delete remaining.via;
    }
    if (remaining.viaDirection !== undefined) {
      pushInlinePairLine(lines, 'via_direction', remaining.viaDirection, innerIndent);
      delete remaining.viaDirection;
    }
    if (remaining.then !== undefined) {
      pushInlinePairLine(lines, 'then', remaining.then, innerIndent);
      delete remaining.then;
    }
    if (remaining.thenDirection !== undefined) {
      pushInlinePairLine(lines, 'then_direction', remaining.thenDirection, innerIndent);
      delete remaining.thenDirection;
    }
  }

  const extraLines = formatAttributeLines(remaining, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatRuleBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const rule = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines: string[] = [`${indent(indentLevel)}rule do`];
  const innerIndent = indentLevel + 1;

  const condition = rule.condition;
  const probability = rule.probability;
  const betweenMatching = rule.betweenMatching;
  const action = rule.action;
  delete rule.condition;
  delete rule.probability;
  delete rule.betweenMatching;
  delete rule.action;

  if (isRecord(condition) && typeof condition.operator === 'string' && typeof condition.threshold === 'number') {
    const keyword = formatOperatorKeyword(condition.operator);
    if (!keyword) return null;
    lines.push(`${indent(innerIndent)}threshold ${keyword} ${condition.threshold}`);
  } else if (condition !== undefined) {
    pushInlinePairLine(lines, 'condition', condition, innerIndent);
  }

  if (probability !== undefined) {
    pushInlinePairLine(lines, 'probability', probability, innerIndent);
  }
  if (betweenMatching !== undefined) {
    pushInlinePairLine(lines, 'between_matching', betweenMatching, innerIndent);
  }

  if (action !== undefined) {
    const actionLines = formatActionMutationLine(action, innerIndent);
    if (!actionLines) return null;
    lines.push(...actionLines);
  }

  const extraLines = formatAttributeLines(rule, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatCriterionLine(value: unknown, indentLevel: number): string | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const type = cleaned.type;
  const weight = cleaned.weight;
  if (typeof type !== 'string' || typeof weight !== 'number') return null;

  if (type === 'shared_relationship') {
    const relationshipKind = cleaned.relationshipKind;
    const direction = cleaned.direction;
    if (typeof relationshipKind !== 'string' || typeof direction !== 'string') return null;
    return `${indent(indentLevel)}criterion ${formatLabel(type)} ${weight} ${formatLabel(relationshipKind)} ${direction}`;
  }

  if (type === 'shared_tags' || type === 'temporal_proximity') {
    const threshold = cleaned.threshold;
    if (typeof threshold !== 'number') return null;
    return `${indent(indentLevel)}criterion ${formatLabel(type)} ${weight} ${threshold}`;
  }

  if (type === 'same_culture') {
    return `${indent(indentLevel)}criterion ${formatLabel(type)} ${weight}`;
  }

  return null;
}

function formatClusteringBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const clustering = cloneAndStripRefs(value) as Record<string, unknown>;
  const criteria = clustering.criteria;
  delete clustering.criteria;

  const lines: string[] = [`${indent(indentLevel)}clustering do`];
  const innerIndent = indentLevel + 1;

  if (clustering.minSize !== undefined) {
    pushInlinePairLine(lines, 'min_size', clustering.minSize, innerIndent);
    delete clustering.minSize;
  }
  if (clustering.maxSize !== undefined) {
    pushInlinePairLine(lines, 'max_size', clustering.maxSize, innerIndent);
    delete clustering.maxSize;
  }
  if (clustering.minimumScore !== undefined) {
    pushInlinePairLine(lines, 'minimum_score', clustering.minimumScore, innerIndent);
    delete clustering.minimumScore;
  }

  if (Array.isArray(criteria)) {
    for (const criterion of criteria) {
      const line = formatCriterionLine(criterion, innerIndent);
      if (!line) return null;
      lines.push(line);
    }
  } else if (criteria !== undefined) {
    return null;
  }

  const extraLines = formatAttributeLines(clustering, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatMetaEntityBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const meta = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines: string[] = [`${indent(indentLevel)}meta_entity do`];
  const innerIndent = indentLevel + 1;

  if (meta.kind !== undefined) {
    pushInlinePairLine(lines, 'kind', meta.kind, innerIndent);
    delete meta.kind;
  }
  if (meta.subtypeFromMajority !== undefined) {
    pushInlinePairLine(lines, 'subtype_from_majority', meta.subtypeFromMajority, innerIndent);
    delete meta.subtypeFromMajority;
  }
  if (meta.status !== undefined) {
    pushInlinePairLine(lines, 'status', meta.status, innerIndent);
    delete meta.status;
  }
  if (meta.prominenceFromSize !== undefined && isRecord(meta.prominenceFromSize)) {
    const entries = Object.entries(meta.prominenceFromSize)
      .map(([key, entry]) => `${formatLabel(key)} ${entry}`);
    if (entries.length > 0) {
      lines.push(`${indent(innerIndent)}prominence_from_size ${entries.join(' ')}`);
    }
    delete meta.prominenceFromSize;
  }
  if (Array.isArray(meta.additionalTags) && meta.additionalTags.length > 0) {
    const inline = formatInlineList(meta.additionalTags);
    if (inline) {
      lines.push(`${indent(innerIndent)}additional_tags ${inline}`);
    } else {
      pushInlinePairLine(lines, 'additional_tags', meta.additionalTags, innerIndent);
    }
    delete meta.additionalTags;
  } else if (meta.additionalTags !== undefined) {
    delete meta.additionalTags;
  }
  if (meta.descriptionTemplate !== undefined) {
    pushInlinePairLine(lines, 'description_template', meta.descriptionTemplate, innerIndent);
    delete meta.descriptionTemplate;
  }

  const extraLines = formatAttributeLines(meta, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPickerBlock(
  name: string,
  value: unknown,
  indentLevel: number
): string[] | null {
  if (!isRecord(value)) return null;
  const picker = cloneAndStripRefs(value) as Record<string, unknown>;
  const filters = picker.filters;
  const preferFilters = picker.preferFilters;
  const pickStrategy = picker.pickStrategy ?? 'random';
  const maxResults = picker.maxResults;
  delete picker.filters;
  delete picker.preferFilters;
  delete picker.pickStrategy;
  delete picker.maxResults;

  const lines = [`${indent(indentLevel)}${name} do`];
  const innerIndent = indentLevel + 1;

  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  if (maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', maxResults, innerIndent);
  }

  if (filters !== undefined) {
    const filterLines = formatFilterLines(filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', filters, innerIndent);
    }
  }

  if (preferFilters !== undefined) {
    const preferLines = formatFilterLines(preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', preferFilters, innerIndent);
    }
  }

  const extraLines = formatAttributeLines(picker, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPostProcessBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const post = cloneAndStripRefs(value) as Record<string, unknown>;
  const pressureChanges = post.pressureChanges;
  delete post.pressureChanges;

  const lines = [`${indent(indentLevel)}post_process do`];
  const innerIndent = indentLevel + 1;

  if (post.createGovernanceFaction !== undefined) {
    pushInlinePairLine(lines, 'create_governance_faction', post.createGovernanceFaction, innerIndent);
    delete post.createGovernanceFaction;
  }
  if (post.governanceFactionSubtype !== undefined) {
    pushInlinePairLine(lines, 'governance_faction_subtype', post.governanceFactionSubtype, innerIndent);
    delete post.governanceFactionSubtype;
  }
  if (post.governanceRelationship !== undefined) {
    pushInlinePairLine(lines, 'governance_relationship', post.governanceRelationship, innerIndent);
    delete post.governanceRelationship;
  }

  if (pressureChanges !== undefined) {
    const pressureLines = formatPressureChangeLines(pressureChanges, innerIndent);
    if (pressureLines) {
      lines.push(...pressureLines);
    } else {
      pushInlinePairLine(lines, 'pressureChanges', pressureChanges, innerIndent);
    }
  }

  const extraLines = formatAttributeLines(post, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPhaseTransitionBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const transition = cloneAndStripRefs(value) as Record<string, unknown>;
  const toStatus = transition.toStatus;
  if (typeof toStatus !== 'string') return null;
  delete transition.toStatus;

  const lines: string[] = [`${indent(indentLevel)}phase_transition ${formatLabel(toStatus)} do`];
  const innerIndent = indentLevel + 1;

  if (transition.adoptionThreshold !== undefined) {
    pushInlinePairLine(lines, 'adoption_threshold', transition.adoptionThreshold, innerIndent);
    delete transition.adoptionThreshold;
  }
  if (transition.descriptionSuffix !== undefined) {
    pushInlinePairLine(lines, 'description_suffix', transition.descriptionSuffix, innerIndent);
    delete transition.descriptionSuffix;
  }

  const selectionLines = formatSystemSelectionBlock(transition.selection, innerIndent);
  if (selectionLines) {
    lines.push(...selectionLines);
    delete transition.selection;
  } else if (transition.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', transition.selection, innerIndent);
    delete transition.selection;
  }

  const extraLines = formatAttributeLines(transition, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatMultiSourceBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const multi = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines: string[] = [`${indent(indentLevel)}multi_source do`];
  const innerIndent = indentLevel + 1;

  if (multi.immunityTagPrefix !== undefined) {
    pushInlinePairLine(lines, 'immunity_tag_prefix', multi.immunityTagPrefix, innerIndent);
    delete multi.immunityTagPrefix;
  }
  if (multi.lowAdoptionThreshold !== undefined) {
    pushInlinePairLine(lines, 'low_adoption_threshold', multi.lowAdoptionThreshold, innerIndent);
    delete multi.lowAdoptionThreshold;
  }
  if (multi.lowAdoptionStatus !== undefined) {
    pushInlinePairLine(lines, 'low_adoption_status', multi.lowAdoptionStatus, innerIndent);
    delete multi.lowAdoptionStatus;
  }

  const selectionLines = formatSystemSelectionBlock(multi.sourceSelection, innerIndent);
  if (selectionLines) {
    lines.push(...selectionLines.map((line, index) => (index === 0 ? `${indent(innerIndent)}source_selection do` : line)));
    if (selectionLines.length > 0) {
      lines[lines.length - 1] = `${indent(innerIndent)}end`;
    }
    delete multi.sourceSelection;
  } else if (multi.sourceSelection !== undefined) {
    pushInlinePairLine(lines, 'sourceSelection', multi.sourceSelection, innerIndent);
    delete multi.sourceSelection;
  }

  const extraLines = formatAttributeLines(multi, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatTagDiffusionGroupLine(
  name: string,
  value: unknown,
  indentLevel: number
): string | null {
  if (!isRecord(value) || !Array.isArray(value.tags)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const tags = cleaned.tags;
  if (!Array.isArray(tags)) return null;
  const tagsInline = formatInlineList(tags);
  if (!tagsInline) return null;
  const parts = [`${indent(indentLevel)}${name}`, 'tags', tagsInline];
  if (typeof cleaned.minConnections === 'number') {
    parts.push('min_connections', String(cleaned.minConnections));
  }
  if (typeof cleaned.maxConnections === 'number') {
    parts.push('max_connections', String(cleaned.maxConnections));
  }
  if (typeof cleaned.probability === 'number') {
    parts.push('probability', String(cleaned.probability));
  }
  if (typeof cleaned.maxSharedTags === 'number') {
    parts.push('max_shared_tags', String(cleaned.maxSharedTags));
  }
  return parts.join(' ');
}

function formatProminenceSnapshotLine(value: unknown, indentLevel: number): string | null {
  if (!isRecord(value)) return null;
  const snapshot = cloneAndStripRefs(value) as Record<string, unknown>;
  const parts = [`${indent(indentLevel)}prominence_snapshot`];
  if (snapshot.enabled !== undefined) {
    parts.push('enabled', String(snapshot.enabled));
  }
  if (snapshot.minProminence !== undefined) {
    parts.push('min_prominence', formatLabel(String(snapshot.minProminence)));
  }
  return parts.join(' ');
}

function formatThresholdTriggerSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }

  const selectionLines = formatSystemSelectionBlock(remaining.selection, indentLevel);
  if (selectionLines) {
    lines.push(...selectionLines);
    delete remaining.selection;
  } else if (remaining.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', remaining.selection, indentLevel);
    delete remaining.selection;
  }

  const conditionLines = formatSystemConditionLines(remaining.conditions, indentLevel);
  if (conditionLines) {
    lines.push(...conditionLines);
    delete remaining.conditions;
  } else if (remaining.conditions !== undefined) {
    pushInlinePairLine(lines, 'conditions', remaining.conditions, indentLevel);
    delete remaining.conditions;
  }

  const variableLines = formatVariableEntries(remaining.variables as Record<string, unknown> | undefined, indentLevel);
  if (variableLines) {
    lines.push(...variableLines);
    delete remaining.variables;
  } else if (remaining.variables !== undefined) {
    pushInlinePairLine(lines, 'variables', remaining.variables, indentLevel);
    delete remaining.variables;
  }

  if (Array.isArray(remaining.actions)) {
    const actionLines = formatActionListBlock('actions', remaining.actions, indentLevel);
    if (!actionLines) return null;
    lines.push(...actionLines);
    delete remaining.actions;
  } else if (remaining.actions !== undefined) {
    pushInlinePairLine(lines, 'actions', remaining.actions, indentLevel);
    delete remaining.actions;
  }

  if (remaining.clusterMode !== undefined) {
    pushInlinePairLine(lines, 'cluster_mode', remaining.clusterMode, indentLevel);
    delete remaining.clusterMode;
  }

  if (remaining.throttleChance !== undefined) {
    pushInlinePairLine(lines, 'throttle', remaining.throttleChance, indentLevel);
    delete remaining.throttleChance;
  }

  if (remaining.pressureChanges !== undefined) {
    const pressureLines = formatPressureChangeLines(remaining.pressureChanges, indentLevel);
    if (pressureLines) {
      lines.push(...pressureLines);
    } else {
      pushInlinePairLine(lines, 'pressureChanges', remaining.pressureChanges, indentLevel);
    }
    delete remaining.pressureChanges;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  return lines;
}

function formatConnectionEvolutionSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }

  const selectionLines = formatSystemSelectionBlock(remaining.selection, indentLevel);
  if (selectionLines) {
    lines.push(...selectionLines);
    delete remaining.selection;
  } else if (remaining.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', remaining.selection, indentLevel);
    delete remaining.selection;
  }

  const metricLines = formatMetricBlock(remaining.metric, indentLevel);
  if (metricLines) {
    lines.push(...metricLines);
    delete remaining.metric;
  } else if (remaining.metric !== undefined) {
    pushInlinePairLine(lines, 'metric', remaining.metric, indentLevel);
    delete remaining.metric;
  }

  if (Array.isArray(remaining.rules)) {
    for (const rule of remaining.rules) {
      const ruleLines = formatRuleBlock(rule, indentLevel);
      if (!ruleLines) return null;
      lines.push(...ruleLines);
    }
    delete remaining.rules;
  } else if (remaining.rules !== undefined) {
    pushInlinePairLine(lines, 'rules', remaining.rules, indentLevel);
    delete remaining.rules;
  }

  if (Array.isArray(remaining.pairExcludeRelationships)) {
    const inline = formatInlineList(remaining.pairExcludeRelationships);
    if (inline) {
      lines.push(`${indent(indentLevel)}pair_exclude ${inline}`);
    } else {
      pushInlinePairLine(lines, 'pair_exclude', remaining.pairExcludeRelationships, indentLevel);
    }
    delete remaining.pairExcludeRelationships;
  }

  if (isRecord(remaining.pairComponentSizeLimit)) {
    const limit = remaining.pairComponentSizeLimit as Record<string, unknown>;
    const kinds = Array.isArray(limit.relationshipKinds) ? limit.relationshipKinds : null;
    const max = limit.max;
    if (kinds && typeof max === 'number') {
      const inline = formatInlineList(kinds);
      if (inline) {
        lines.push(`${indent(indentLevel)}pair_component_limit ${inline} max ${max}`);
      } else {
        pushInlinePairLine(lines, 'pair_component_limit', remaining.pairComponentSizeLimit, indentLevel);
      }
    } else {
      pushInlinePairLine(lines, 'pair_component_limit', remaining.pairComponentSizeLimit, indentLevel);
    }
    delete remaining.pairComponentSizeLimit;
  }

  if (remaining.throttleChance !== undefined) {
    pushInlinePairLine(lines, 'throttle', remaining.throttleChance, indentLevel);
    delete remaining.throttleChance;
  }

  if (remaining.pressureChanges !== undefined) {
    const pressureLines = formatPressureChangeLines(remaining.pressureChanges, indentLevel);
    if (pressureLines) {
      lines.push(...pressureLines);
    } else {
      pushInlinePairLine(lines, 'pressureChanges', remaining.pressureChanges, indentLevel);
    }
    delete remaining.pressureChanges;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  return lines;
}

function formatClusterFormationSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }

  if (remaining.runAtEpochEnd !== undefined) {
    pushInlinePairLine(lines, 'run_at_epoch_end', remaining.runAtEpochEnd, indentLevel);
    delete remaining.runAtEpochEnd;
  }

  const selectionLines = formatSystemSelectionBlock(remaining.selection, indentLevel);
  if (selectionLines) {
    lines.push(...selectionLines);
    delete remaining.selection;
  } else if (remaining.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', remaining.selection, indentLevel);
    delete remaining.selection;
  }

  const clusteringLines = formatClusteringBlock(remaining.clustering, indentLevel);
  if (clusteringLines) {
    lines.push(...clusteringLines);
    delete remaining.clustering;
  } else if (remaining.clustering !== undefined) {
    pushInlinePairLine(lines, 'clustering', remaining.clustering, indentLevel);
    delete remaining.clustering;
  }

  const metaLines = formatMetaEntityBlock(remaining.metaEntity, indentLevel);
  if (metaLines) {
    lines.push(...metaLines);
    delete remaining.metaEntity;
  } else if (remaining.metaEntity !== undefined) {
    pushInlinePairLine(lines, 'metaEntity', remaining.metaEntity, indentLevel);
    delete remaining.metaEntity;
  }

  const masterLines = formatPickerBlock('master_selection', remaining.masterSelection, indentLevel);
  if (masterLines) {
    lines.push(...masterLines);
    delete remaining.masterSelection;
  } else if (remaining.masterSelection !== undefined) {
    pushInlinePairLine(lines, 'masterSelection', remaining.masterSelection, indentLevel);
    delete remaining.masterSelection;
  }

  if (Array.isArray(remaining.memberUpdates)) {
    const updateLines = formatActionListBlock('member_updates', remaining.memberUpdates, indentLevel);
    if (!updateLines) return null;
    lines.push(...updateLines);
    delete remaining.memberUpdates;
  } else if (remaining.memberUpdates !== undefined) {
    pushInlinePairLine(lines, 'memberUpdates', remaining.memberUpdates, indentLevel);
    delete remaining.memberUpdates;
  }

  const postLines = formatPostProcessBlock(remaining.postProcess, indentLevel);
  if (postLines) {
    lines.push(...postLines);
    delete remaining.postProcess;
  } else if (remaining.postProcess !== undefined) {
    pushInlinePairLine(lines, 'postProcess', remaining.postProcess, indentLevel);
    delete remaining.postProcess;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  return lines;
}

function formatGraphContagionSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }

  const selectionLines = formatSystemSelectionBlock(remaining.selection, indentLevel);
  if (selectionLines) {
    lines.push(...selectionLines);
    delete remaining.selection;
  } else if (remaining.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', remaining.selection, indentLevel);
    delete remaining.selection;
  }

  if (isRecord(remaining.contagion)) {
    const contagion = remaining.contagion as Record<string, unknown>;
    if (contagion.type === 'tag' && typeof contagion.tag === 'string') {
      lines.push(`${indent(indentLevel)}contagion tag ${formatLabel(contagion.tag)}`);
      delete remaining.contagion;
    } else if (contagion.type === 'relationship' && typeof contagion.relationshipKind === 'string') {
      lines.push(`${indent(indentLevel)}contagion relationship ${formatLabel(contagion.relationshipKind)}`);
      delete remaining.contagion;
    }
  }

  if (Array.isArray(remaining.vectors)) {
    for (const vector of remaining.vectors) {
      if (!isRecord(vector)) return null;
      const relationshipKind = vector.relationshipKind;
      const direction = vector.direction;
      const minStrength = vector.minStrength;
      if (typeof relationshipKind !== 'string' || typeof direction !== 'string' || typeof minStrength !== 'number') return null;
      lines.push(`${indent(indentLevel)}vector ${formatLabel(relationshipKind)} ${direction} ${minStrength}`);
    }
    delete remaining.vectors;
  } else if (remaining.vectors !== undefined) {
    pushInlinePairLine(lines, 'vectors', remaining.vectors, indentLevel);
    delete remaining.vectors;
  }

  if (isRecord(remaining.transmission)) {
    const transmission = remaining.transmission as Record<string, unknown>;
    if (typeof transmission.baseRate === 'number'
      && typeof transmission.contactMultiplier === 'number'
      && typeof transmission.maxProbability === 'number'
    ) {
      lines.push(
        `${indent(indentLevel)}transmission ${transmission.baseRate} ${transmission.contactMultiplier} ${transmission.maxProbability}`
      );
      delete remaining.transmission;
    }
  }

  if (isRecord(remaining.infectionAction)) {
    const infectionLines = formatActionListBlock('infection_action', [remaining.infectionAction], indentLevel);
    if (!infectionLines) return null;
    lines.push(...infectionLines);
    delete remaining.infectionAction;
  }

  if (isRecord(remaining.recovery)) {
    const recovery = remaining.recovery as Record<string, unknown>;
    const recoveryLines: string[] = [`${indent(indentLevel)}recovery do`];
    const innerIndent = indentLevel + 1;
    if (recovery.baseRate !== undefined) {
      pushInlinePairLine(recoveryLines, 'base_rate', recovery.baseRate, innerIndent);
    }
    if (Array.isArray(recovery.recoveryBonusTraits)) {
      for (const entry of recovery.recoveryBonusTraits) {
        if (!isRecord(entry)) return null;
        const tag = entry.tag;
        const bonus = entry.bonus;
        if (typeof tag !== 'string' || typeof bonus !== 'number') return null;
        recoveryLines.push(`${indent(innerIndent)}bonus ${formatLabel(tag)} ${bonus}`);
      }
    }
    recoveryLines.push(`${indent(indentLevel)}end`);
    lines.push(...recoveryLines);
    delete remaining.recovery;
  }

  if (Array.isArray(remaining.susceptibilityModifiers)) {
    for (const entry of remaining.susceptibilityModifiers) {
      if (!isRecord(entry)) return null;
      const tag = entry.tag;
      const modifier = entry.modifier;
      if (typeof tag !== 'string' || typeof modifier !== 'number') return null;
      lines.push(`${indent(indentLevel)}susceptibility ${formatLabel(tag)} ${modifier}`);
    }
    delete remaining.susceptibilityModifiers;
  } else if (remaining.susceptibilityModifiers !== undefined) {
    pushInlinePairLine(lines, 'susceptibilityModifiers', remaining.susceptibilityModifiers, indentLevel);
    delete remaining.susceptibilityModifiers;
  }

  if (Array.isArray(remaining.phaseTransitions)) {
    for (const entry of remaining.phaseTransitions) {
      const transitionLines = formatPhaseTransitionBlock(entry, indentLevel);
      if (!transitionLines) return null;
      lines.push(...transitionLines);
    }
    delete remaining.phaseTransitions;
  } else if (remaining.phaseTransitions !== undefined) {
    pushInlinePairLine(lines, 'phaseTransitions', remaining.phaseTransitions, indentLevel);
    delete remaining.phaseTransitions;
  }

  const multiLines = formatMultiSourceBlock(remaining.multiSource, indentLevel);
  if (multiLines) {
    lines.push(...multiLines);
    delete remaining.multiSource;
  } else if (remaining.multiSource !== undefined) {
    pushInlinePairLine(lines, 'multiSource', remaining.multiSource, indentLevel);
    delete remaining.multiSource;
  }

  if (Array.isArray(remaining.excludeRelationships)) {
    const inline = formatInlineList(remaining.excludeRelationships);
    if (inline) {
      lines.push(`${indent(indentLevel)}exclude_relationships ${inline}`);
    } else {
      pushInlinePairLine(lines, 'exclude_relationships', remaining.excludeRelationships, indentLevel);
    }
    delete remaining.excludeRelationships;
  }

  if (remaining.throttleChance !== undefined) {
    pushInlinePairLine(lines, 'throttle', remaining.throttleChance, indentLevel);
    delete remaining.throttleChance;
  }
  if (remaining.cooldown !== undefined) {
    pushInlinePairLine(lines, 'cooldown', remaining.cooldown, indentLevel);
    delete remaining.cooldown;
  }

  if (remaining.pressureChanges !== undefined) {
    const pressureLines = formatPressureChangeLines(remaining.pressureChanges, indentLevel);
    if (pressureLines) {
      lines.push(...pressureLines);
    } else {
      pushInlinePairLine(lines, 'pressureChanges', remaining.pressureChanges, indentLevel);
    }
    delete remaining.pressureChanges;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  return lines;
}

function formatPlaneDiffusionSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }

  const selectionLines = formatSystemSelectionBlock(remaining.selection, indentLevel);
  if (selectionLines) {
    lines.push(...selectionLines);
    delete remaining.selection;
  } else if (remaining.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', remaining.selection, indentLevel);
    delete remaining.selection;
  }

  if (isRecord(remaining.sources)) {
    const sources = remaining.sources as Record<string, unknown>;
    if (typeof sources.tagFilter === 'string' && typeof sources.defaultStrength === 'number') {
      lines.push(`${indent(indentLevel)}sources ${formatLabel(sources.tagFilter)} ${sources.defaultStrength}`);
      delete remaining.sources;
    }
  }
  if (isRecord(remaining.sinks)) {
    const sinks = remaining.sinks as Record<string, unknown>;
    if (typeof sinks.tagFilter === 'string' && typeof sinks.defaultStrength === 'number') {
      lines.push(`${indent(indentLevel)}sinks ${formatLabel(sinks.tagFilter)} ${sinks.defaultStrength}`);
      delete remaining.sinks;
    }
  }

  if (isRecord(remaining.diffusion)) {
    const diffusion = remaining.diffusion as Record<string, unknown>;
    if (typeof diffusion.rate === 'number'
      && typeof diffusion.decayRate === 'number'
      && typeof diffusion.sourceRadius === 'number'
      && typeof diffusion.falloffType === 'string'
      && typeof diffusion.iterationsPerTick === 'number'
    ) {
      lines.push(
        `${indent(indentLevel)}diffusion ${diffusion.rate} ${diffusion.decayRate} ${diffusion.sourceRadius} ${diffusion.falloffType} ${diffusion.iterationsPerTick}`
      );
      delete remaining.diffusion;
    }
  }

  if (Array.isArray(remaining.outputTags)) {
    for (const entry of remaining.outputTags) {
      if (!isRecord(entry) || typeof entry.tag !== 'string') return null;
      const parts = [`${indent(indentLevel)}output_tag`, formatLabel(entry.tag)];
      if (typeof entry.minValue === 'number') {
        parts.push('min', String(entry.minValue));
      }
      if (typeof entry.maxValue === 'number') {
        parts.push('max', String(entry.maxValue));
      }
      lines.push(parts.join(' '));
    }
    delete remaining.outputTags;
  } else if (remaining.outputTags !== undefined) {
    pushInlinePairLine(lines, 'outputTags', remaining.outputTags, indentLevel);
    delete remaining.outputTags;
  }

  if (remaining.valueTag !== undefined) {
    pushInlinePairLine(lines, 'value_tag', remaining.valueTag, indentLevel);
    delete remaining.valueTag;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  return lines;
}

function formatTagDiffusionSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }

  const selectionLines = formatSystemSelectionBlock(remaining.selection, indentLevel);
  if (selectionLines) {
    lines.push(...selectionLines);
    delete remaining.selection;
  } else if (remaining.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', remaining.selection, indentLevel);
    delete remaining.selection;
  }

  if (remaining.connectionKind !== undefined && remaining.connectionDirection !== undefined) {
    lines.push(
      `${indent(indentLevel)}connection ${formatLabel(String(remaining.connectionKind))} ${String(remaining.connectionDirection)}`
    );
    delete remaining.connectionKind;
    delete remaining.connectionDirection;
  }

  const convergenceLine = formatTagDiffusionGroupLine('convergence', remaining.convergence, indentLevel);
  if (convergenceLine) {
    lines.push(convergenceLine);
    delete remaining.convergence;
  } else if (remaining.convergence !== undefined) {
    pushInlinePairLine(lines, 'convergence', remaining.convergence, indentLevel);
    delete remaining.convergence;
  }

  const divergenceLine = formatTagDiffusionGroupLine('divergence', remaining.divergence, indentLevel);
  if (divergenceLine) {
    lines.push(divergenceLine);
    delete remaining.divergence;
  } else if (remaining.divergence !== undefined) {
    pushInlinePairLine(lines, 'divergence', remaining.divergence, indentLevel);
    delete remaining.divergence;
  }

  if (remaining.maxTags !== undefined) {
    pushInlinePairLine(lines, 'max_tags', remaining.maxTags, indentLevel);
    delete remaining.maxTags;
  }

  if (isRecord(remaining.divergencePressure)) {
    const pressure = remaining.divergencePressure as Record<string, unknown>;
    if (typeof pressure.pressureName === 'string'
      && typeof pressure.minDivergent === 'number'
      && typeof pressure.delta === 'number'
    ) {
      lines.push(
        `${indent(indentLevel)}divergence_pressure ${formatLabel(pressure.pressureName)} ${pressure.minDivergent} ${pressure.delta}`
      );
      delete remaining.divergencePressure;
    }
  } else if (remaining.divergencePressure !== undefined) {
    pushInlinePairLine(lines, 'divergencePressure', remaining.divergencePressure, indentLevel);
    delete remaining.divergencePressure;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  return lines;
}

function formatEraSpawnerSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) lines.push(...extraLines);
  return lines;
}

function formatEraTransitionSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }
  if (remaining.prominenceSnapshot !== undefined) {
    const snapshotLine = formatProminenceSnapshotLine(remaining.prominenceSnapshot, indentLevel);
    if (!snapshotLine) return null;
    lines.push(snapshotLine);
    delete remaining.prominenceSnapshot;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) lines.push(...extraLines);
  return lines;
}

function formatUniversalCatalystSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }
  if (remaining.actionAttemptRate !== undefined) {
    pushInlinePairLine(lines, 'action_attempt_rate', remaining.actionAttemptRate, indentLevel);
    delete remaining.actionAttemptRate;
  }
  if (remaining.pressureMultiplier !== undefined) {
    pushInlinePairLine(lines, 'pressure_multiplier', remaining.pressureMultiplier, indentLevel);
    delete remaining.pressureMultiplier;
  }
  if (remaining.prominenceUpChanceOnSuccess !== undefined) {
    pushInlinePairLine(lines, 'prominence_up_chance', remaining.prominenceUpChanceOnSuccess, indentLevel);
    delete remaining.prominenceUpChanceOnSuccess;
  }
  if (remaining.prominenceDownChanceOnFailure !== undefined) {
    pushInlinePairLine(lines, 'prominence_down_chance', remaining.prominenceDownChanceOnFailure, indentLevel);
    delete remaining.prominenceDownChanceOnFailure;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) lines.push(...extraLines);
  return lines;
}

function formatRelationshipMaintenanceSystem(config: Record<string, unknown>, indentLevel: number): string[] | null {
  const remaining = cloneAndStripRefs(config) as Record<string, unknown>;
  const lines: string[] = [];

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel);
    delete remaining.description;
  }
  if (remaining.maintenanceFrequency !== undefined) {
    pushInlinePairLine(lines, 'maintenance_frequency', remaining.maintenanceFrequency, indentLevel);
    delete remaining.maintenanceFrequency;
  }
  if (remaining.cullThreshold !== undefined) {
    pushInlinePairLine(lines, 'cull_threshold', remaining.cullThreshold, indentLevel);
    delete remaining.cullThreshold;
  }
  if (remaining.gracePeriod !== undefined) {
    pushInlinePairLine(lines, 'grace_period', remaining.gracePeriod, indentLevel);
    delete remaining.gracePeriod;
  }
  if (remaining.reinforcementBonus !== undefined) {
    pushInlinePairLine(lines, 'reinforcement_bonus', remaining.reinforcementBonus, indentLevel);
    delete remaining.reinforcementBonus;
  }
  if (remaining.maxStrength !== undefined) {
    pushInlinePairLine(lines, 'max_strength', remaining.maxStrength, indentLevel);
    delete remaining.maxStrength;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel);
  if (extraLines.length > 0) lines.push(...extraLines);
  return lines;
}

function formatVariantApplyBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const apply = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines: string[] = [`${indent(indentLevel)}apply do`];
  const innerIndent = indentLevel + 1;

  const tags = apply.tags;
  delete apply.tags;
  if (isRecord(tags)) {
    const entries = Object.entries(tags).sort(([a], [b]) => a.localeCompare(b));
    for (const [entity, map] of entries) {
      if (!isRecord(map)) continue;
      const tagEntries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
      for (const [tag, enabled] of tagEntries) {
        if (typeof enabled !== 'boolean') continue;
        lines.push(
          `${indent(innerIndent)}tag_assign ${formatLabel(entity)} ${formatLabel(tag)} ${enabled}`
        );
      }
    }
  } else if (tags !== undefined) {
    pushAttributeLine(lines, 'tags', tags, innerIndent);
  }

  const subtype = apply.subtype;
  delete apply.subtype;
  if (isRecord(subtype)) {
    const entries = Object.entries(subtype).sort(([a], [b]) => a.localeCompare(b));
    for (const [entity, value] of entries) {
      if (typeof value !== 'string') continue;
      lines.push(`${indent(innerIndent)}subtype ${formatLabel(entity)} ${formatLabel(value)}`);
    }
  } else if (subtype !== undefined) {
    pushAttributeLine(lines, 'subtype', subtype, innerIndent);
  }

  if (apply.stateUpdates !== undefined) {
    pushAttributeLine(lines, 'stateUpdates', apply.stateUpdates, innerIndent);
    delete apply.stateUpdates;
  }

  const extraLines = formatAttributeLines(apply, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatVariantOptionBlock(option: Record<string, unknown>, indentLevel: number): string[] | null {
  const lines: string[] = [`${indent(indentLevel)}options do`];
  const innerIndent = indentLevel + 1;
  const remaining = cloneAndStripRefs(option) as Record<string, unknown>;

  if (remaining.name !== undefined) {
    pushInlinePairLine(lines, 'name', remaining.name, innerIndent);
    delete remaining.name;
  }

  if (remaining.when !== undefined) {
    if (isRecord(remaining.when)) {
      const blockLines = formatBlockBody('when', remaining.when as Record<string, unknown>, innerIndent);
      if (blockLines) {
        lines.push(...blockLines);
      }
    } else {
      pushAttributeLine(lines, 'when', remaining.when, innerIndent);
    }
    delete remaining.when;
  }

  if (remaining.apply !== undefined) {
    const applyLines = formatVariantApplyBlock(remaining.apply, innerIndent);
    if (applyLines) {
      lines.push(...applyLines);
    } else {
      pushAttributeLine(lines, 'apply', remaining.apply, innerIndent);
    }
    delete remaining.apply;
  }

  const extraLines = formatAttributeLines(remaining, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatVariantsBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const variants = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines: string[] = [`${indent(indentLevel)}variants do`];
  const innerIndent = indentLevel + 1;

  if (variants.selection !== undefined) {
    pushInlinePairLine(lines, 'selection', variants.selection, innerIndent);
    delete variants.selection;
  }

  const options = Array.isArray(variants.options) ? variants.options : null;
  delete variants.options;
  if (options) {
    for (const option of options) {
      if (!isRecord(option)) continue;
      const optionLines = formatVariantOptionBlock(option, innerIndent);
      if (optionLines) {
        lines.push(...optionLines);
      }
    }
  }

  const extraLines = formatAttributeLines(variants, innerIndent);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatGeneratorBlock(labels: string[], body: Record<string, unknown>): string {
  const header = `generator${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const remaining = { ...body };

  const applicabilityLines = formatApplicabilityBlock(remaining.applicability, 1);
  if (applicabilityLines) {
    delete remaining.applicability;
    lines.push(...applicabilityLines);
  } else if (remaining.applicability !== undefined) {
    const value = cloneAndStripRefs(remaining.applicability);
    delete remaining.applicability;
    pushAttributeLine(lines, 'applicability', value, 1);
  }

  const selectionLines = formatSelectionBlock(remaining.selection, 1);
  if (selectionLines) {
    delete remaining.selection;
    lines.push(...selectionLines);
  } else if (remaining.selection !== undefined) {
    const value = cloneAndStripRefs(remaining.selection);
    delete remaining.selection;
    pushAttributeLine(lines, 'selection', value, 1);
  }

  const variableLines = formatVariableEntries(remaining.variables as Record<string, unknown> | undefined, 1);
  if (variableLines) {
    delete remaining.variables;
    lines.push(...variableLines);
  } else if (remaining.variables !== undefined) {
    const value = cloneAndStripRefs(remaining.variables);
    delete remaining.variables;
    pushAttributeLine(lines, 'variables', value, 1);
  }

  if (Array.isArray(remaining.creation)) {
    const creationValue = remaining.creation;
    const creationLines = formatCreationEntries(creationValue, 1);
    delete remaining.creation;
    if (creationLines && creationLines.length > 0) {
      lines.push(...creationLines);
    } else {
      pushAttributeLine(lines, 'creation', cloneAndStripRefs(creationValue), 1);
    }
  } else if (remaining.creation !== undefined) {
    const value = cloneAndStripRefs(remaining.creation);
    delete remaining.creation;
    pushAttributeLine(lines, 'creation', value, 1);
  }

  if (Array.isArray(remaining.relationships)) {
    const relationshipValue = remaining.relationships;
    const relationshipLines = formatRelationshipEntries(relationshipValue, 1);
    delete remaining.relationships;
    if (relationshipLines && relationshipLines.length > 0) {
      lines.push(...relationshipLines);
    } else {
      pushAttributeLine(lines, 'relationships', cloneAndStripRefs(relationshipValue), 1);
    }
  } else if (remaining.relationships !== undefined) {
    const value = cloneAndStripRefs(remaining.relationships);
    delete remaining.relationships;
    pushAttributeLine(lines, 'relationships', value, 1);
  }

  if (Array.isArray(remaining.stateUpdates)) {
    const stateValue = remaining.stateUpdates;
    const mutationLines = formatMutationEntries(stateValue, 1);
    delete remaining.stateUpdates;
    if (mutationLines && mutationLines.length > 0) {
      lines.push(...mutationLines);
    } else {
      pushAttributeLine(lines, 'stateUpdates', cloneAndStripRefs(stateValue), 1);
    }
  } else if (remaining.stateUpdates !== undefined) {
    const value = cloneAndStripRefs(remaining.stateUpdates);
    delete remaining.stateUpdates;
    pushAttributeLine(lines, 'stateUpdates', value, 1);
  }

  if (remaining.variants !== undefined) {
    const variantsLines = formatVariantsBlock(remaining.variants, 1);
    delete remaining.variants;
    if (variantsLines && variantsLines.length > 0) {
      lines.push(...variantsLines);
    } else {
      const value = cloneAndStripRefs(remaining.variants);
      pushAttributeLine(lines, 'variants', value, 1);
    }
  }

  if (remaining.enabled !== undefined) {
    const value = cloneAndStripRefs(remaining.enabled);
    delete remaining.enabled;
    pushAttributeLine(lines, 'enabled', value, 1);
  }

  const extraLines = formatAttributeLines(cloneAndStripRefs(remaining) as Record<string, unknown>, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatActionBlock(item: Record<string, unknown>): string | null {
  const body = { ...item };
  const labels: string[] = [];
  if (typeof body.id === 'string') {
    labels.push(body.id);
    delete body.id;
  }
  if (typeof body.name === 'string') {
    labels.push(body.name);
    delete body.name;
  }

  const header = `action${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];

  if (body.description !== undefined) {
    pushInlinePairLine(lines, 'description', body.description, 1);
    delete body.description;
  }

  const actorLines = formatActionActorLines(body.actor, 1);
  if (actorLines) {
    lines.push(...actorLines);
  } else if (body.actor !== undefined) {
    pushAttributeLine(lines, 'actor', body.actor, 1);
  }
  delete body.actor;

  const targetLines = formatActionTargetLines(body.targeting, 1);
  if (targetLines) {
    lines.push(...targetLines);
  } else if (body.targeting !== undefined) {
    pushAttributeLine(lines, 'targeting', body.targeting, 1);
  }
  delete body.targeting;

  const variableLines = formatVariableEntries(body.variables as Record<string, unknown> | undefined, 1);
  if (variableLines) {
    delete body.variables;
    lines.push(...variableLines);
  } else if (body.variables !== undefined) {
    pushAttributeLine(lines, 'variables', body.variables, 1);
    delete body.variables;
  }

  const outcomeLines = formatActionOutcomeLines(body.outcome, 1);
  if (outcomeLines) {
    lines.push(...outcomeLines);
  } else if (body.outcome !== undefined) {
    pushAttributeLine(lines, 'outcome', body.outcome, 1);
  }
  delete body.outcome;

  const probabilityLines = formatActionProbabilityLines(body.probability, 1);
  if (probabilityLines) {
    lines.push(...probabilityLines);
  } else if (body.probability !== undefined) {
    pushAttributeLine(lines, 'probability', body.probability, 1);
  }
  delete body.probability;

  if (body.enabled !== undefined) {
    if (body.enabled !== true) {
      pushInlinePairLine(lines, 'enabled', body.enabled, 1);
    }
    delete body.enabled;
  }

  const extraLines = formatAttributeLines(cloneAndStripRefs(body) as Record<string, unknown>, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatActionActorLines(actorValue: unknown, indentLevel: number): string[] | null {
  if (!isRecord(actorValue)) return null;
  const actor = cloneAndStripRefs(actorValue) as Record<string, unknown>;
  const selection = actor.selection;
  const conditions = actor.conditions;
  const instigator = actor.instigator;
  delete actor.selection;
  delete actor.conditions;
  delete actor.instigator;

  const hasExtras = Object.values(actor).some((value) => value !== undefined);
  if (hasExtras) return null;

  const lines: string[] = [];
  if (selection !== undefined) {
    const selectionLines = formatActionSelectionBlock('actor', selection, indentLevel);
    if (!selectionLines) return null;
    lines.push(...selectionLines);
  }
  if (conditions !== undefined) {
    const conditionLines = formatActionConditionsBlock('actor', conditions, indentLevel);
    if (!conditionLines) return null;
    lines.push(...conditionLines);
  }
  if (instigator !== undefined) {
    const instigatorLines = formatActionInstigatorBlock(instigator, indentLevel);
    if (!instigatorLines) return null;
    lines.push(...instigatorLines);
  }

  return lines.length > 0 ? lines : null;
}

function formatActionTargetLines(targetValue: unknown, indentLevel: number): string[] | null {
  if (!isRecord(targetValue)) return null;
  const selectionLines = formatActionSelectionBlock('target', targetValue, indentLevel);
  return selectionLines;
}

function formatActionSelectionBlock(
  label: string,
  value: unknown,
  indentLevel: number
): string[] | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const selection = { ...cleaned };
  const kind = typeof selection.kind === 'string' ? selection.kind : null;
  if (kind) delete selection.kind;

  const header = `${indent(indentLevel)}${label} choose${kind ? ' ' + formatLabel(kind) : ''} do`;
  const lines = [header];
  const innerIndent = indentLevel + 1;

  if (selection.strategy !== undefined) {
    if (selection.strategy !== 'by_kind') {
      pushInlinePairLine(lines, 'strategy', selection.strategy, innerIndent);
    }
    delete selection.strategy;
  }

  const pickStrategy = selection.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete selection.pickStrategy;

  if (selection.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', selection.kinds, innerIndent);
    delete selection.kinds;
  }

  if (Array.isArray(selection.subtypes) && selection.subtypes.length > 0) {
    if (selection.subtypes.length > 1) {
      const inline = formatSetInlineValue(selection.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'subtypes', selection.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', selection.subtypes[0], innerIndent);
    }
    delete selection.subtypes;
  }

  if (Array.isArray(selection.statuses) && selection.statuses.length > 0) {
    if (selection.statuses.length > 1) {
      const inline = formatSetInlineValue(selection.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'statuses', selection.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', selection.statuses[0], innerIndent);
    }
    delete selection.statuses;
  }

  if (selection.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', selection.statusFilter, innerIndent);
    delete selection.statusFilter;
  }

  if (selection.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', selection.maxResults, innerIndent);
    delete selection.maxResults;
  }

  if (Array.isArray(selection.saturationLimits) && selection.saturationLimits.length > 0) {
    const saturationLines = formatSaturationLines(selection.saturationLimits, innerIndent);
    if (saturationLines) {
      lines.push(...saturationLines);
      delete selection.saturationLimits;
    }
  }

  if (selection.referenceEntity !== undefined) {
    pushInlinePairLine(lines, 'referenceEntity', selection.referenceEntity, innerIndent);
    delete selection.referenceEntity;
  }

  if (selection.relationshipKind !== undefined) {
    pushInlinePairLine(lines, 'relationshipKind', selection.relationshipKind, innerIndent);
    delete selection.relationshipKind;
  }

  if (selection.direction !== undefined) {
    pushInlinePairLine(lines, 'direction', selection.direction, innerIndent);
    delete selection.direction;
  }

  if (selection.mustHave !== undefined) {
    pushInlinePairLine(lines, 'mustHave', selection.mustHave, innerIndent);
    delete selection.mustHave;
  }

  if (selection.excludeSubtypes !== undefined) {
    pushInlinePairLine(lines, 'excludeSubtypes', selection.excludeSubtypes, innerIndent);
    delete selection.excludeSubtypes;
  }

  if (selection.notStatus !== undefined) {
    pushInlinePairLine(lines, 'notStatus', selection.notStatus, innerIndent);
    delete selection.notStatus;
  }

  if (selection.subtypePreferences !== undefined) {
    pushInlinePairLine(lines, 'subtypePreferences', selection.subtypePreferences, innerIndent);
    delete selection.subtypePreferences;
  }

  if (selection.maxDistance !== undefined) {
    pushInlinePairLine(lines, 'maxDistance', selection.maxDistance, innerIndent);
    delete selection.maxDistance;
  }

  if (selection.minProminence !== undefined) {
    pushInlinePairLine(lines, 'minProminence', selection.minProminence, innerIndent);
    delete selection.minProminence;
  }

  if (selection.filters !== undefined) {
    const filterLines = formatFilterLines(selection.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', selection.filters, innerIndent);
    }
    delete selection.filters;
  }

  if (selection.preferFilters !== undefined) {
    const preferLines = formatFilterLines(selection.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', selection.preferFilters, innerIndent);
    }
    delete selection.preferFilters;
  }

  for (const [key, entry] of Object.entries(selection)) {
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatActionConditionsBlock(
  label: string,
  value: unknown,
  indentLevel: number
): string[] | null {
  let conditions: unknown[] | null = null;
  let mode: string | undefined;

  if (Array.isArray(value)) {
    conditions = value;
  } else if (isRecord(value) && (value.type === 'and' || value.type === 'or') && Array.isArray(value.conditions)) {
    conditions = value.conditions as unknown[];
    mode = value.type === 'or' ? 'any' : 'all';
  } else {
    return null;
  }

  if (conditions.length === 0) return null;

  const header = `${indent(indentLevel)}${label} when${mode ? ' ' + mode : ''} do`;
  const lines = [header];
  for (const condition of conditions) {
    lines.push(...formatConditionLines(condition, indentLevel + 1));
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatActionInstigatorBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const instigator = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines: string[] = [];
  const header = `${indent(indentLevel)}actor instigator do`;
  lines.push(header);
  const innerIndent = indentLevel + 1;

  if (instigator.from !== undefined) {
    if (instigator.from === 'graph') {
      lines.push(`${indent(innerIndent)}from graph`);
      delete instigator.from;
    } else if (isRecord(instigator.from)) {
      const relatedTo = instigator.from.relatedTo;
      const relationship = instigator.from.relationshipKind ?? instigator.from.relationship;
      const direction = instigator.from.direction;
      if (typeof relatedTo === 'string' && typeof relationship === 'string' && typeof direction === 'string') {
        lines.push(
          `${indent(innerIndent)}from ${formatLabel(stripBinding(relatedTo))} via ${relationship} ${direction}`
        );
        delete instigator.from;
      }
    }
  }

  if (instigator.kind !== undefined) {
    pushInlinePairLine(lines, 'kind', instigator.kind, innerIndent);
    delete instigator.kind;
  }

  if (instigator.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', instigator.kinds, innerIndent);
    delete instigator.kinds;
  }

  if (Array.isArray(instigator.subtypes) && instigator.subtypes.length > 0) {
    if (instigator.subtypes.length > 1) {
      const inline = formatSetInlineValue(instigator.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'subtypes', instigator.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', instigator.subtypes[0], innerIndent);
    }
    delete instigator.subtypes;
  }

  if (Array.isArray(instigator.statuses) && instigator.statuses.length > 0) {
    if (instigator.statuses.length > 1) {
      const inline = formatSetInlineValue(instigator.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'statuses', instigator.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', instigator.statuses[0], innerIndent);
    }
    delete instigator.statuses;
  }

  if (instigator.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', instigator.statusFilter, innerIndent);
    delete instigator.statusFilter;
  }

  const pickStrategy = instigator.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete instigator.pickStrategy;

  if (instigator.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', instigator.maxResults, innerIndent);
    delete instigator.maxResults;
  }

  if (instigator.filters !== undefined) {
    const filterLines = formatFilterLines(instigator.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', instigator.filters, innerIndent);
    }
    delete instigator.filters;
  }

  if (instigator.preferFilters !== undefined) {
    const preferLines = formatFilterLines(instigator.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', instigator.preferFilters, innerIndent);
    }
    delete instigator.preferFilters;
  }

  if (instigator.required !== undefined) {
    pushInlinePairLine(lines, 'required', instigator.required, innerIndent);
    delete instigator.required;
  }

  for (const [key, entry] of Object.entries(instigator)) {
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatActionOutcomeLines(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const outcome = cloneAndStripRefs(value) as Record<string, unknown>;
  const mutations = outcome.mutations;
  const narrative = outcome.descriptionTemplate;
  const actorDelta = outcome.actorProminenceDelta;
  const targetDelta = outcome.targetProminenceDelta;
  delete outcome.mutations;
  delete outcome.descriptionTemplate;
  delete outcome.actorProminenceDelta;
  delete outcome.targetProminenceDelta;

  const hasExtras = Object.values(outcome).some((entry) => entry !== undefined);
  if (hasExtras) return null;

  const lines: string[] = [];

  if (Array.isArray(mutations)) {
    const mutationLines = formatActionMutationLines(mutations, indentLevel + 1);
    if (!mutationLines) return null;
    if (mutationLines.length > 0) {
      lines.push(`${indent(indentLevel)}on success do`);
      lines.push(...mutationLines);
      lines.push(`${indent(indentLevel)}end`);
    }
  } else if (mutations !== undefined) {
    return null;
  }

  if (narrative !== undefined) {
    pushInlinePairLine(lines, 'narrative', narrative, indentLevel);
  }

  const actorLine = formatActionProminenceLine('actor', actorDelta, indentLevel);
  if (actorLine) lines.push(actorLine);
  const targetLine = formatActionProminenceLine('target', targetDelta, indentLevel);
  if (targetLine) lines.push(targetLine);

  return lines.length > 0 ? lines : null;
}

function formatActionProbabilityLines(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const probability = cloneAndStripRefs(value) as Record<string, unknown>;
  const successChance = probability.baseSuccessChance;
  const weight = probability.baseWeight;
  const modifiers = probability.pressureModifiers;
  delete probability.baseSuccessChance;
  delete probability.baseWeight;
  delete probability.pressureModifiers;

  const hasExtras = Object.values(probability).some((entry) => entry !== undefined);
  if (hasExtras) return null;

  const lines: string[] = [];
  if (successChance !== undefined) {
    pushInlinePairLine(lines, 'success_chance', successChance, indentLevel);
  }
  if (weight !== undefined) {
    pushInlinePairLine(lines, 'weight', weight, indentLevel);
  }
  if (Array.isArray(modifiers)) {
    for (const modifier of modifiers) {
      if (!isRecord(modifier)) return null;
      const pressure = modifier.pressure;
      const multiplier = modifier.multiplier;
      if (typeof pressure !== 'string' || typeof multiplier !== 'number') return null;
      lines.push(`${indent(indentLevel)}pressure_modifier ${formatLabel(pressure)} ${multiplier}`);
    }
  } else if (modifiers !== undefined) {
    return null;
  }

  return lines.length > 0 ? lines : null;
}

function formatActionMutationLines(items: unknown[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    const entryLines = formatActionMutationLine(item, indentLevel);
    if (!entryLines) return null;
    lines.push(...entryLines);
  }
  return lines;
}

function formatActionMutationLine(item: unknown, indentLevel: number): string[] | null {
  if (!isRecord(item)) return null;
  const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
  const type = cleaned.type;
  if (typeof type !== 'string') return null;

  if (type === 'create_relationship' || type === 'adjust_relationship_strength') {
    const kind = cleaned.kind;
    const src = cleaned.src;
    const dst = cleaned.dst;
    if (typeof kind !== 'string' || typeof src !== 'string' || typeof dst !== 'string') return null;
    const body = { ...cleaned };
    delete body.type;
    delete body.kind;
    delete body.src;
    delete body.dst;
    const pairs = formatInlinePairs(body);
    const formattedSrc = stripBinding(src);
    const formattedDst = stripBinding(dst);
    const prefix = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} -> ${formatLabel(formattedDst)}`;
    if (pairs !== null) {
      return [pairs ? `${prefix} ${pairs}` : prefix];
    }
    const header = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} ${formatLabel(formattedDst)} do`;
    const lines = [header];
    const bodyLines = formatAttributeLines(body, indentLevel + 1);
    if (bodyLines.length > 0) lines.push(...bodyLines);
    lines.push(`${indent(indentLevel)}end`);
    return lines;
  }

  if (type === 'modify_pressure') {
    const pressureId = cleaned.pressureId;
    const delta = cleaned.delta;
    if (typeof pressureId !== 'string' || typeof delta !== 'number') return null;
    const operator = delta < 0 ? '-=' : '+=';
    const value = Math.abs(delta);
    return [`${indent(indentLevel)}mutate pressure ${formatLabel(pressureId)} ${operator} ${value}`];
  }

  if (type === 'change_status') {
    const entity = cleaned.entity;
    const status = cleaned.newStatus;
    if (typeof entity !== 'string' || typeof status !== 'string') return null;
    return [
      `${indent(indentLevel)}change_status ${formatLabel(stripBinding(entity))} ${formatLabel(status)}`
    ];
  }

  if (type === 'set_tag') {
    const entity = cleaned.entity;
    const tag = cleaned.tag;
    if (typeof entity !== 'string' || typeof tag !== 'string') return null;
    const parts = [
      `${indent(indentLevel)}set_tag`,
      formatLabel(stripBinding(entity)),
      formatLabel(tag)
    ];
    if (cleaned.valueFrom !== undefined && typeof cleaned.valueFrom === 'string') {
      parts.push('from', formatLabel(stripBinding(cleaned.valueFrom)));
    } else if (cleaned.value !== undefined) {
      const valueText = formatInlineValue(cleaned.value);
      if (!valueText) return null;
      parts.push(valueText);
    }
    return [parts.join(' ')];
  }

  if (type === 'remove_tag') {
    const entity = cleaned.entity;
    const tag = cleaned.tag;
    if (typeof entity !== 'string' || typeof tag !== 'string') return null;
    return [
      `${indent(indentLevel)}remove_tag ${formatLabel(stripBinding(entity))} ${formatLabel(tag)}`
    ];
  }

  if (type === 'adjust_prominence') {
    const entity = cleaned.entity;
    const delta = cleaned.delta;
    if (typeof entity !== 'string' || typeof delta !== 'number') return null;
    return [
      `${indent(indentLevel)}adjust_prominence ${formatLabel(stripBinding(entity))} ${delta}`
    ];
  }

  if (type === 'archive_relationship') {
    const entity = cleaned.entity;
    const kind = cleaned.relationshipKind;
    const withEntity = cleaned.with;
    if (typeof entity !== 'string' || typeof kind !== 'string' || typeof withEntity !== 'string') return null;
    const parts = [
      `${indent(indentLevel)}archive_relationship`,
      formatLabel(stripBinding(entity)),
      formatLabel(kind),
      formatLabel(stripBinding(withEntity))
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return [parts.join(' ')];
  }

  if (type === 'archive_all_relationships') {
    const entity = cleaned.entity;
    const kind = cleaned.relationshipKind;
    if (typeof entity !== 'string' || typeof kind !== 'string') return null;
    const parts = [
      `${indent(indentLevel)}archive_all_relationships`,
      formatLabel(stripBinding(entity)),
      formatLabel(kind)
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return [parts.join(' ')];
  }

  if (type === 'transfer_relationship') {
    const entity = cleaned.entity;
    const relationshipKind = cleaned.relationshipKind;
    const from = cleaned.from;
    const to = cleaned.to;
    if (typeof entity !== 'string' || typeof relationshipKind !== 'string'
      || typeof from !== 'string' || typeof to !== 'string') {
      return null;
    }
    const parts = [
      `${indent(indentLevel)}transfer_relationship`,
      formatLabel(stripBinding(entity)),
      formatLabel(relationshipKind),
      'from',
      formatLabel(stripBinding(from)),
      'to',
      formatLabel(stripBinding(to))
    ];
    if (cleaned.condition !== undefined) {
      const inline = formatSystemConditionInlineTokens(cleaned.condition);
      if (inline) {
        parts.push('if', ...inline);
        return [parts.join(' ')];
      }
      const lines = [`${parts.join(' ')} do`];
      const conditionLines = formatSystemConditionLine(cleaned.condition, indentLevel + 1);
      if (!conditionLines) return null;
      lines.push(...conditionLines);
      lines.push(`${indent(indentLevel)}end`);
      return lines;
    }
    return [parts.join(' ')];
  }

  if (type === 'for_each_related') {
    const relationship = cleaned.relationship ?? cleaned.relationshipKind;
    const direction = cleaned.direction;
    const targetKind = cleaned.targetKind;
    const actions = cleaned.actions;
    if (typeof relationship !== 'string' || typeof direction !== 'string' || typeof targetKind !== 'string') return null;
    if (!Array.isArray(actions)) return null;
    const header = `${indent(indentLevel)}for_each_related ${formatLabel(relationship)} ${direction} ${formatLabel(targetKind)} do`;
    const lines = [header];
    for (const action of actions) {
      const actionLines = formatActionMutationLine(action, indentLevel + 1);
      if (!actionLines) return null;
      lines.push(...actionLines);
    }
    lines.push(`${indent(indentLevel)}end`);
    return lines;
  }

  if (type === 'conditional') {
    const condition = cleaned.condition;
    const thenActions = cleaned.thenActions;
    const elseActions = cleaned.elseActions;
    if (!Array.isArray(thenActions)) return null;
    const lines = [`${indent(indentLevel)}conditional do`];
    const conditionLines = formatSystemConditionLine(condition, indentLevel + 1);
    if (!conditionLines) return null;
    lines.push(...conditionLines);
    const thenLines = formatActionListBlock('then', thenActions, indentLevel + 1);
    if (!thenLines) return null;
    lines.push(...thenLines);
    if (Array.isArray(elseActions) && elseActions.length > 0) {
      const elseLines = formatActionListBlock('else', elseActions, indentLevel + 1);
      if (!elseLines) return null;
      lines.push(...elseLines);
    }
    lines.push(`${indent(indentLevel)}end`);
    return lines;
  }

  if (type === 'update_rate_limit') {
    return [`${indent(indentLevel)}update_rate_limit true`];
  }

  return null;
}

function formatActionProminenceLine(
  target: 'actor' | 'target',
  value: unknown,
  indentLevel: number
): string | null {
  if (!isRecord(value)) return null;
  const onSuccess = value.onSuccess;
  const onFailure = value.onFailure;
  if (onSuccess === undefined && onFailure === undefined) return null;
  const parts = [`${indent(indentLevel)}prominence`, target];
  if (typeof onSuccess === 'number') {
    parts.push('success', String(onSuccess));
  }
  if (typeof onFailure === 'number') {
    parts.push('failure', String(onFailure));
  }
  return parts.join(' ');
}

function formatBlock(name: string, labels: string[], body: Record<string, unknown>): string {
  if (name === 'generator') {
    return formatGeneratorBlock(labels, body);
  }
  const header = `${name}${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const bodyLines = formatAttributeLines(body, 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }
  lines.push('end');
  return lines.join('\n');
}

function formatInlineItemBlock(
  name: string,
  item: Record<string, unknown>,
  idKey: string,
  rename: Record<string, string> = {}
): string | null {
  const body = { ...item };
  const labels: string[] = [];
  const idValue = body[idKey];
  if (typeof idValue === 'string') {
    labels.push(idValue);
    delete body[idKey];
  }

  for (const [outputKey, inputKey] of Object.entries(rename)) {
    if (body[outputKey] === undefined && body[inputKey] !== undefined) {
      body[outputKey] = body[inputKey];
      delete body[inputKey];
    }
  }

  if (!isInlineFriendlyObject(body)) {
    return formatBlock(name, labels, body);
  }

  return formatEntryLineOrBlock(name, labels, body, 0).join('\n');
}

function formatAxisLine(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;

  const name = typeof item.name === 'string' ? item.name : null;
  const lowTag = typeof item.lowTag === 'string'
    ? item.lowTag
    : (typeof item.low === 'string' ? item.low : null);
  const highTag = typeof item.highTag === 'string'
    ? item.highTag
    : (typeof item.high === 'string' ? item.high : null);
  const description = typeof item.description === 'string' ? item.description : null;

  const remaining = { ...item };
  delete remaining.id;
  delete remaining.name;
  delete remaining.low;
  delete remaining.high;
  delete remaining.lowTag;
  delete remaining.highTag;
  delete remaining.description;

  if (!lowTag || !highTag || Object.keys(remaining).length > 0) {
    const labels = [id];
    if (name) labels.push(name);
    const body = { ...item };
    delete body.id;
    if (name) delete body.name;
    return formatBlock('axis', labels, body);
  }

  let line = `axis ${formatLabel(id)}`;
  if (name) line += ` ${quoteString(name)}`;
  line += ` ${formatLabel(lowTag)} -> ${formatLabel(highTag)}`;
  if (description) line += ` ${quoteString(description)}`;
  return line;
}

function formatTagLine(item: Record<string, unknown>): string | null {
  const tag = item.tag;
  const category = item.category;
  const rarity = item.rarity;
  if (typeof tag !== 'string' || typeof category !== 'string' || typeof rarity !== 'string') {
    return formatBlock('tag', [], { ...item });
  }

  const description = typeof item.description === 'string' ? item.description : null;
  const entityKinds = item.entityKinds;
  const relatedTags = item.relatedTags;
  const conflictingTags = item.conflictingTags;
  const mutuallyExclusiveWith = item.mutuallyExclusiveWith;
  const templates = item.templates;
  const minUsage = item.minUsage;
  const maxUsage = item.maxUsage;
  const usageCount = item.usageCount;
  const isAxis = item.isAxis;
  const isFramework = item.isFramework;

  const remaining = { ...item };
  delete remaining.tag;
  delete remaining.category;
  delete remaining.rarity;
  delete remaining.description;
  delete remaining.entityKinds;
  delete remaining.relatedTags;
  delete remaining.conflictingTags;
  delete remaining.mutuallyExclusiveWith;
  delete remaining.templates;
  delete remaining.minUsage;
  delete remaining.maxUsage;
  delete remaining.usageCount;
  delete remaining.isAxis;
  delete remaining.isFramework;

  if (Object.keys(remaining).length > 0) {
    const body = { ...item };
    delete body.tag;
    return formatBlock('tag', [tag], body);
  }

  let line = `tag ${formatLabel(tag)} ${formatLabel(category)} ${formatLabel(rarity)}`;
  if (description !== null) line += ` ${quoteString(description)}`;

  const kindsValue = formatSetInlineValue(entityKinds);
  if (kindsValue) line += ` kinds ${kindsValue}`;

  const relatedValue = formatSetInlineValue(relatedTags);
  if (relatedValue) line += ` related ${relatedValue}`;

  const conflictsValue = formatSetInlineValue(conflictingTags);
  if (conflictsValue) line += ` conflicts ${conflictsValue}`;

  const exclusiveValue = formatSetInlineValue(mutuallyExclusiveWith);
  if (exclusiveValue) line += ` exclusive ${exclusiveValue}`;

  const templatesValue = formatSetInlineValue(templates);
  if (templatesValue) line += ` templates ${templatesValue}`;

  if (typeof minUsage === 'number' && typeof maxUsage === 'number') {
    line += ` usage ${minUsage} ${maxUsage}`;
  } else if (minUsage !== undefined || maxUsage !== undefined) {
    const body = { ...item };
    delete body.tag;
    return formatBlock('tag', [tag], body);
  }

  if (typeof usageCount === 'number') {
    line += ` count ${usageCount}`;
  }

  if (isAxis === true) line += ' axis';
  if (isFramework === true) line += ' framework';

  return line;
}

function formatRelationshipKindLine(item: Record<string, unknown>): string | null {
  const kind = item.kind;
  if (typeof kind !== 'string') return null;

  const description = typeof item.description === 'string' ? item.description : null;
  const polarity = typeof item.polarity === 'string' ? item.polarity : null;
  const decayRate = typeof item.decayRate === 'string' ? item.decayRate : null;
  const cullable = typeof item.cullable === 'boolean' ? item.cullable : null;
  const srcKinds = item.srcKinds ?? item.src;
  const dstKinds = item.dstKinds ?? item.dst;
  const verbs = isRecord(item.verbs) ? item.verbs : null;
  const category = item.category;
  const symmetric = item.symmetric;
  const isFramework = item.isFramework;
  const name = item.name;

  const remaining = { ...item };
  delete remaining.kind;
  delete remaining.description;
  delete remaining.polarity;
  delete remaining.decayRate;
  delete remaining.cullable;
  delete remaining.srcKinds;
  delete remaining.dstKinds;
  delete remaining.src;
  delete remaining.dst;
  delete remaining.verbs;
  delete remaining.category;
  delete remaining.symmetric;
  delete remaining.isFramework;
  delete remaining.name;

  if (!polarity || !decayRate || cullable === null || Object.keys(remaining).length > 0) {
    const body = { ...item };
    delete body.kind;
    return formatBlock('relationship_kind', [kind], body);
  }

  const srcValue = formatSetInlineValue(srcKinds);
  const dstValue = formatSetInlineValue(dstKinds);
  if (!srcValue || !dstValue) {
    const body = { ...item };
    delete body.kind;
    return formatBlock('relationship_kind', [kind], body);
  }

  let line = `relationship_kind ${formatLabel(kind)}`;
  if (description !== null) line += ` ${quoteString(description)}`;
  line += ` ${formatLabel(polarity)} ${formatLabel(decayRate)} ${cullable ? 'cullable' : 'fixed'}`;
  line += ` src ${srcValue} dst ${dstValue}`;

  if (verbs && typeof verbs.formed === 'string' && typeof verbs.ended === 'string') {
    line += ` verbs ${quoteString(verbs.formed)} ${quoteString(verbs.ended)}`;
  } else if (verbs) {
    const body = { ...item };
    delete body.kind;
    return formatBlock('relationship_kind', [kind], body);
  }

  if (category !== undefined) {
    const categoryValue = formatInlineValue(category);
    if (!categoryValue) {
      const body = { ...item };
      delete body.kind;
      return formatBlock('relationship_kind', [kind], body);
    }
    line += ` category ${categoryValue}`;
  }
  if (name !== undefined) {
    const nameValue = formatInlineValue(name);
    if (!nameValue) {
      const body = { ...item };
      delete body.kind;
      return formatBlock('relationship_kind', [kind], body);
    }
    line += ` name ${nameValue}`;
  }
  if (symmetric === true) line += ' symmetric';
  if (isFramework === true) line += ' framework';

  return line;
}

function formatSimpleCountFactor(value: Record<string, unknown>): string | null {
  const type = value.type;
  if (typeof type !== 'string') return null;

  if (type === 'entity_count') {
    const kind = value.kind;
    if (typeof kind !== 'string') return null;
    const parts = ['entity_count', 'kind', formatLabel(kind)];
    if (typeof value.subtype === 'string') parts.push('subtype', formatLabel(value.subtype));
    if (typeof value.status === 'string') parts.push('status', formatLabel(value.status));
    return parts.join(' ');
  }
  if (type === 'relationship_count') {
    const kinds = value.relationshipKinds;
    const list = formatSetInlineValue(kinds);
    if (!list || list === 'none') return null;
    return `relationship_count ${list}`;
  }
  if (type === 'tag_count') {
    const tags = value.tags;
    const list = formatSetInlineValue(tags);
    if (!list || list === 'none') return null;
    return `tag_count ${list}`;
  }
  if (type === 'total_entities') {
    return 'total_entities';
  }
  if (type === 'constant') {
    const val = value.value;
    if (typeof val !== 'number') return null;
    return `constant ${val}`;
  }
  return null;
}

function formatPressureFactorLine(value: Record<string, unknown>, indentLevel: number): string | null {
  const type = value.type;
  if (typeof type !== 'string') return null;

  if (type === 'entity_count') {
    const kind = value.kind;
    if (typeof kind !== 'string') return null;
    const parts = ['entity_count', 'kind', formatLabel(kind)];
    if (typeof value.subtype === 'string') parts.push('subtype', formatLabel(value.subtype));
    if (typeof value.status === 'string') parts.push('status', formatLabel(value.status));
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    if (typeof value.cap === 'number') parts.push('cap', String(value.cap));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  if (type === 'relationship_count') {
    const list = formatSetInlineValue(value.relationshipKinds);
    if (!list || list === 'none') return null;
    const parts = ['relationship_count', list];
    if (typeof value.direction === 'string') parts.push('direction', formatLabel(value.direction));
    if (typeof value.minStrength === 'number') parts.push('min_strength', String(value.minStrength));
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    if (typeof value.cap === 'number') parts.push('cap', String(value.cap));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  if (type === 'tag_count') {
    const list = formatSetInlineValue(value.tags);
    if (!list || list === 'none') return null;
    const parts = ['tag_count', list];
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    if (typeof value.cap === 'number') parts.push('cap', String(value.cap));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  if (type === 'total_entities') {
    const parts = ['total_entities'];
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    if (typeof value.cap === 'number') parts.push('cap', String(value.cap));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  if (type === 'constant') {
    const val = value.value;
    if (typeof val !== 'number') return null;
    const parts = ['constant', String(val)];
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  if (type === 'ratio') {
    const numerator = isRecord(value.numerator) ? formatSimpleCountFactor(value.numerator) : null;
    const denominator = isRecord(value.denominator) ? formatSimpleCountFactor(value.denominator) : null;
    if (!numerator || !denominator) return null;
    const parts = ['ratio', 'numerator', numerator, 'denominator', denominator];
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    if (typeof value.cap === 'number') parts.push('cap', String(value.cap));
    if (typeof value.fallbackValue === 'number') parts.push('fallback', String(value.fallbackValue));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  if (type === 'status_ratio') {
    const kind = value.kind;
    const aliveStatus = value.aliveStatus;
    if (typeof kind !== 'string' || typeof aliveStatus !== 'string') return null;
    const parts = ['status_ratio', 'kind', formatLabel(kind)];
    if (typeof value.subtype === 'string') parts.push('subtype', formatLabel(value.subtype));
    parts.push('alive_status', formatLabel(aliveStatus));
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    if (typeof value.cap === 'number') parts.push('cap', String(value.cap));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  if (type === 'cross_culture_ratio') {
    const list = formatSetInlineValue(value.relationshipKinds);
    if (!list || list === 'none') return null;
    const parts = ['cross_culture_ratio', list];
    if (typeof value.coefficient === 'number') parts.push('coefficient', String(value.coefficient));
    if (typeof value.cap === 'number') parts.push('cap', String(value.cap));
    return `${indent(indentLevel)}${parts.join(' ')}`;
  }

  return null;
}

function formatPressureFeedbackBlock(
  name: string,
  entries: unknown[],
  indentLevel: number
): string[] | null {
  if (!Array.isArray(entries)) return null;
  const lines = [`${indent(indentLevel)}${name} do`];
  for (const entry of entries) {
    if (!isRecord(entry)) return null;
    const line = formatPressureFactorLine(entry, indentLevel + 1);
    if (!line) return null;
    lines.push(line);
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPressureGrowthBlock(
  growth: unknown,
  indentLevel: number
): string[] | null {
  if (!isRecord(growth)) return null;
  const positive = growth.positiveFeedback;
  const negative = growth.negativeFeedback;
  if (!Array.isArray(positive) || !Array.isArray(negative)) return null;
  const lines = [`${indent(indentLevel)}growth do`];
  const positiveLines = formatPressureFeedbackBlock('positive_feedback', positive, indentLevel + 1);
  const negativeLines = formatPressureFeedbackBlock('negative_feedback', negative, indentLevel + 1);
  if (!positiveLines || !negativeLines) return null;
  lines.push(...positiveLines);
  lines.push(...negativeLines);
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatContractEntriesBlock(
  blockName: string,
  entryName: string,
  entries: unknown[],
  indentLevel: number
): string[] | null {
  if (!Array.isArray(entries)) return null;
  const lines = [`${indent(indentLevel)}${blockName} do`];
  for (const entry of entries) {
    if (!isRecord(entry)) return null;
    const parts = [entryName];
    if (typeof entry.component === 'string') {
      parts.push('component', formatLabel(entry.component));
    } else {
      return null;
    }
    if (entryName === 'affect') {
      if (typeof entry.effect === 'string') {
        parts.push('effect', formatLabel(entry.effect));
      } else {
        return null;
      }
      if (typeof entry.threshold === 'number') parts.push('threshold', String(entry.threshold));
      if (typeof entry.factor === 'number') parts.push('factor', String(entry.factor));
    } else {
      if (typeof entry.delta === 'number') parts.push('delta', String(entry.delta));
      if (typeof entry.formula === 'string') parts.push('formula', quoteString(entry.formula));
    }
    lines.push(`${indent(indentLevel + 1)}${parts.join(' ')}`);
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPressureContractBlock(
  contract: unknown,
  indentLevel: number
): string[] | null {
  if (!isRecord(contract)) return null;
  const lines = [`${indent(indentLevel)}contract do`];
  if (typeof contract.purpose === 'string') {
    lines.push(`${indent(indentLevel + 1)}purpose ${quoteString(contract.purpose)}`);
  }

  if (Array.isArray(contract.sources)) {
    const block = formatContractEntriesBlock('sources', 'source', contract.sources, indentLevel + 1);
    if (!block) return null;
    lines.push(...block);
  }
  if (Array.isArray(contract.sinks)) {
    const block = formatContractEntriesBlock('sinks', 'sink', contract.sinks, indentLevel + 1);
    if (!block) return null;
    lines.push(...block);
  }
  if (Array.isArray(contract.affects)) {
    const block = formatContractEntriesBlock('affects', 'affect', contract.affects, indentLevel + 1);
    if (!block) return null;
    lines.push(...block);
  }

  if (isRecord(contract.equilibrium)) {
    const equilibrium = contract.equilibrium as Record<string, unknown>;
    lines.push(`${indent(indentLevel + 1)}equilibrium do`);
    const expectedRange = equilibrium.expectedRange;
    if (Array.isArray(expectedRange) && expectedRange.length === 2
      && typeof expectedRange[0] === 'number'
      && typeof expectedRange[1] === 'number') {
      lines.push(`${indent(indentLevel + 2)}expected_range ${expectedRange[0]} ${expectedRange[1]}`);
    }
    if (typeof equilibrium.restingPoint === 'number') {
      lines.push(`${indent(indentLevel + 2)}resting_point ${equilibrium.restingPoint}`);
    }
    if (typeof equilibrium.oscillationPeriod === 'number') {
      lines.push(`${indent(indentLevel + 2)}oscillation_period ${equilibrium.oscillationPeriod}`);
    }
    lines.push(`${indent(indentLevel + 1)}end`);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPressureBlock(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;
  const name = typeof item.name === 'string' ? item.name : null;
  const lines = [`pressure ${formatLabel(id)}${name ? ' ' + quoteString(name) : ''} do`];

  const remaining = { ...item };
  delete remaining.id;
  delete remaining.name;

  if (remaining.initialValue !== undefined) {
    pushInlinePairLine(lines, 'initial_value', remaining.initialValue, 1);
    delete remaining.initialValue;
  }
  if (remaining.homeostasis !== undefined) {
    pushInlinePairLine(lines, 'homeostasis', remaining.homeostasis, 1);
    delete remaining.homeostasis;
  }
  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, 1);
    delete remaining.description;
  }

  if (remaining.contract !== undefined) {
    const contractLines = formatPressureContractBlock(remaining.contract, 1);
    if (contractLines) {
      lines.push(...contractLines);
      delete remaining.contract;
    }
  }

  if (remaining.growth !== undefined) {
    const growthLines = formatPressureGrowthBlock(remaining.growth, 1);
    if (growthLines) {
      lines.push(...growthLines);
      delete remaining.growth;
    }
  }

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatSeedRelationshipBlock(item: Record<string, unknown>): string | null {
  const kind = item.kind;
  const src = item.src;
  const dst = item.dst;
  if (typeof kind !== 'string' || typeof src !== 'string' || typeof dst !== 'string') {
    return formatBlock('seed_relationship', [], { ...item });
  }

  const strength = item.strength;
  const remaining = { ...item };
  delete remaining.kind;
  delete remaining.src;
  delete remaining.dst;
  delete remaining.strength;

  if (Object.keys(remaining).length > 0) {
    return formatBlock('seed_relationship', [], { ...item });
  }

  if (typeof strength !== 'number') {
    return formatBlock('seed_relationship', [], { ...item });
  }

  return `seed_relationship ${formatLabel(kind)} ${formatLabel(src)} ${formatLabel(dst)} ${strength}`;
}

function formatSeedRelationshipGroups(items: Record<string, unknown>[]): string[] {
  const groups = new Map<string, Array<{ kind: string; dst: string; strength: number }>>();
  const extras: Record<string, unknown>[] = [];

  for (const item of items) {
    const kind = item.kind;
    const src = item.src;
    const dst = item.dst;
    const strength = item.strength;
    const remaining = { ...item };
    delete remaining.kind;
    delete remaining.src;
    delete remaining.dst;
    delete remaining.strength;

    const hasExtras = Object.keys(remaining).length > 0;
    if (typeof kind !== 'string' || typeof src !== 'string' || typeof dst !== 'string' || typeof strength !== 'number' || hasExtras) {
      extras.push(item);
      continue;
    }

    if (!groups.has(src)) groups.set(src, []);
    groups.get(src)?.push({ kind, dst, strength });
  }

  const blocks: string[] = [];
  const sortedSources = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  for (const src of sortedSources) {
    const relationships = groups.get(src) || [];
    relationships.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      if (a.dst !== b.dst) return a.dst.localeCompare(b.dst);
      return a.strength - b.strength;
    });
    const lines = [`relationships ${formatLabel(src)} do`];
    for (const rel of relationships) {
      lines.push(`${indent(1)}${formatLabel(rel.kind)} ${formatLabel(rel.dst)} ${rel.strength}`);
    }
    lines.push('end');
    blocks.push(lines.join('\n'));
  }

  for (const extra of extras) {
    const block = formatSeedRelationshipBlock(extra);
    if (block) blocks.push(block);
  }

  return blocks;
}

function formatInlineList(items: unknown[]): string | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const parts = items.map((item) => formatInlineValue(item));
  if (parts.some((part) => part === null)) return null;
  return parts.join(' ');
}

function extractSetFieldItems(value: unknown): { items: string[]; none: boolean } | null {
  if (typeof value === 'string') {
    if (value === 'none') return { items: [], none: true };
    return { items: [value], none: false };
  }
  if (Array.isArray(value)) {
    const items = value.filter((entry) => typeof entry === 'string') as string[];
    if (items.length !== value.length) return null;
    return { items, none: items.length === 0 };
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return { items: [], none: true };
    if (!entries.every(([, entry]) => entry === true)) return null;
    return { items: entries.map(([key]) => key), none: false };
  }
  return null;
}

function formatSetInlineValue(value: unknown): string | null {
  const parsed = extractSetFieldItems(value);
  if (!parsed) return null;
  if (parsed.items.length === 0) return 'none';
  const parts = parsed.items.map((item) => formatInlineValue(item));
  if (parts.some((part) => part === null)) return null;
  return parts.join(' ');
}

function formatSetFieldLine(key: string, value: unknown, indentLevel: number): string[] | null {
  if (!SET_FIELD_KEYS.has(key)) return null;
  const parsed = extractSetFieldItems(value);
  if (!parsed) return null;
  const prefix = `${indent(indentLevel)}${formatAttributeKey(key)}`;
  if (parsed.items.length === 0) {
    return [`${prefix} none`];
  }
  const parts = parsed.items.map((item) => formatInlineValue(item));
  if (parts.some((part) => part === null)) return null;
  return [`${prefix} ${parts.join(' ')}`];
}

function formatSeedEntityBlock(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;
  const lines = [`seed_entity ${formatLabel(id)} do`];
  const remaining = { ...item };
  delete remaining.id;

  const knownKeys = [
    'kind',
    'subtype',
    'name',
    'summary',
    'description',
    'status',
    'prominence',
    'culture',
    'createdAt',
    'updatedAt'
  ];

  for (const key of knownKeys) {
    const value = remaining[key];
    delete remaining[key];
    if (value === undefined || value === null || (typeof value === 'string' && value.length === 0)) {
      pushInlinePairLine(lines, key, 'none', 1);
      continue;
    }
    pushInlinePairLine(lines, key, value, 1);
  }

  const tags = remaining.tags;
  delete remaining.tags;
  if (tags === undefined || tags === null || (typeof tags === 'string' && tags.length === 0)) {
    lines.push(`${indent(1)}tags none`);
  } else if (isRecord(tags)) {
    const entries = Object.entries(tags).filter(([, value]) => Boolean(value));
    if (entries.length === 0) {
      lines.push(`${indent(1)}tags none`);
    } else {
      const inline = formatInlineList(entries.map(([key]) => key));
      if (inline) {
        lines.push(`${indent(1)}tags ${inline}`);
      } else {
        lines.push(`${indent(1)}tags none`);
      }
    }
  } else if (Array.isArray(tags)) {
    if (tags.length === 0) {
      lines.push(`${indent(1)}tags none`);
    } else {
      const inline = formatInlineList(tags);
      if (inline) {
        lines.push(`${indent(1)}tags ${inline}`);
      } else {
        lines.push(`${indent(1)}tags none`);
      }
    }
  } else {
    lines.push(`${indent(1)}tags none`);
  }

  const coords = remaining.coords ?? remaining.coordinates;
  if (coords === undefined || coords === null) {
    lines.push(`${indent(1)}coords none`);
  } else if (isRecord(coords) && typeof coords.x === 'number' && typeof coords.y === 'number' && typeof coords.z === 'number') {
    lines.push(`${indent(1)}coords ${coords.x} ${coords.y} ${coords.z}`);
  } else if (Array.isArray(coords) && coords.length >= 3) {
    const [x, y, z] = coords;
    if ([x, y, z].every((value) => typeof value === 'number')) {
      lines.push(`${indent(1)}coords ${x} ${y} ${z}`);
    } else {
      lines.push(`${indent(1)}coords none`);
    }
  } else if (coords === 'none') {
    lines.push(`${indent(1)}coords none`);
  } else {
    lines.push(`${indent(1)}coords none`);
  }
  delete remaining.coords;
  delete remaining.coordinates;

  const links = remaining.links;
  delete remaining.links;
  if (links === undefined || links === null || (typeof links === 'string' && links.length === 0)) {
    lines.push(`${indent(1)}links none`);
  } else if (Array.isArray(links)) {
    if (links.length === 0) {
      lines.push(`${indent(1)}links none`);
    } else {
      const inline = formatInlineList(links);
      if (inline) {
        lines.push(`${indent(1)}links ${inline}`);
      } else {
        lines.push(`${indent(1)}links none`);
      }
    }
  } else {
    lines.push(`${indent(1)}links none`);
  }

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatEntityKindBlock(item: Record<string, unknown>): string | null {
  const kind = item.kind;
  if (typeof kind !== 'string') return null;
  const lines = [`entity_kind ${formatLabel(kind)} do`];
  const remaining = { ...item };
  delete remaining.kind;

  if (remaining.description !== undefined) {
    pushAttributeLine(lines, 'description', remaining.description, 1);
    delete remaining.description;
  }
  if (remaining.category !== undefined) {
    pushAttributeLine(lines, 'category', remaining.category, 1);
    delete remaining.category;
  }
  if (remaining.isFramework !== undefined) {
    pushAttributeLine(lines, 'isFramework', remaining.isFramework, 1);
    delete remaining.isFramework;
  }

  const subtypes = remaining.subtypes;
  delete remaining.subtypes;
  const statuses = remaining.statuses;
  delete remaining.statuses;
  const requiredRelationships = remaining.requiredRelationships;
  delete remaining.requiredRelationships;
  const semanticPlane = remaining.semanticPlane;
  delete remaining.semanticPlane;

  if (Array.isArray(subtypes)) {
    const subtypeLines = formatSubtypeLines(subtypes, 1);
    if (subtypeLines) {
      lines.push(...subtypeLines);
    } else {
      const subtypeBlock = formatSubtypesBlock(subtypes, 1);
      if (subtypeBlock) {
        lines.push(...subtypeBlock);
      } else {
        pushAttributeLine(lines, 'subtypes', subtypes, 1);
      }
    }
  } else if (subtypes !== undefined) {
    pushAttributeLine(lines, 'subtypes', subtypes, 1);
  }

  if (Array.isArray(statuses)) {
    const statusLines = formatStatusLines(statuses, 1);
    if (statusLines) {
      lines.push(...statusLines);
    } else {
      const statusBlock = formatStatusesBlock(statuses, 1);
      if (statusBlock) {
        lines.push(...statusBlock);
      } else {
        pushAttributeLine(lines, 'statuses', statuses, 1);
      }
    }
  } else if (statuses !== undefined) {
    pushAttributeLine(lines, 'statuses', statuses, 1);
  }

  if (Array.isArray(requiredRelationships)) {
    const requiredLines = formatRequiredRelationshipLines(requiredRelationships, 1);
    if (requiredLines) {
      lines.push(...requiredLines);
    } else {
      const requiredBlock = formatRequiredRelationshipsBlock(requiredRelationships, 1);
      if (requiredBlock) {
        lines.push(...requiredBlock);
      } else {
        pushAttributeLine(lines, 'requiredRelationships', requiredRelationships, 1);
      }
    }
  } else if (requiredRelationships !== undefined) {
    pushAttributeLine(lines, 'requiredRelationships', requiredRelationships, 1);
  }

  if (remaining.defaultStatus !== undefined) {
    pushAttributeLine(lines, 'defaultStatus', remaining.defaultStatus, 1);
    delete remaining.defaultStatus;
  }
  if (remaining.style !== undefined) {
    const styleLines = formatStyleLines(remaining.style, 1);
    if (styleLines) {
      lines.push(...styleLines);
    } else {
      pushAttributeLine(lines, 'style', remaining.style, 1);
    }
    delete remaining.style;
  }

  const semanticLines = isRecord(semanticPlane) ? formatSemanticPlaneBlock(semanticPlane, 1) : null;
  if (semanticLines) {
    lines.push(...semanticLines);
  } else if (semanticPlane !== undefined) {
    pushAttributeLine(lines, 'semanticPlane', semanticPlane, 1);
  }

  if (remaining.visualIdentityKeys !== undefined) {
    pushAttributeLine(lines, 'visualIdentityKeys', remaining.visualIdentityKeys, 1);
    delete remaining.visualIdentityKeys;
  }

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatSubtypesBlock(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    const entry = formatSubtypeEntry(item, indentLevel + 1);
    if (!entry) return null;
    lines.push(entry);
  }
  if (lines.length === 0) return [`${indent(indentLevel)}subtypes do`, `${indent(indentLevel)}end`];
  return [
    `${indent(indentLevel)}subtypes do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatSubtypeLines(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const id = item.id;
    const name = item.name;
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    const isAuthority = item.isAuthority === true || item.authority === true;
    const remaining = { ...item };
    delete remaining.id;
    delete remaining.name;
    delete remaining.isAuthority;
    delete remaining.authority;
    if (Object.keys(remaining).length > 0) return null;
    let line = `${indent(indentLevel)}subtype ${formatLabel(id)} ${formatLabel(name)}`;
    if (isAuthority) line += ' authority';
    lines.push(line);
  }
  return lines;
}

function formatSubtypeEntry(item: Record<string, unknown>, indentLevel: number): string | null {
  const id = item.id;
  const name = item.name;
  if (typeof id !== 'string' || typeof name !== 'string') return null;

  const body = { ...item };
  delete body.id;
  delete body.name;

  if (body.isAuthority !== undefined) {
    body.authority = body.isAuthority;
    delete body.isAuthority;
  }

  if (Object.keys(body).length === 0) {
    const nameValue = formatInlineValue(name);
    if (!nameValue) return null;
    return `${indent(indentLevel)}${formatAttributeKey(id)} ${nameValue}`;
  }

  body.name = name;
  const pairs = formatInlinePairs(body);
  if (pairs === null) return null;
  return `${indent(indentLevel)}${formatAttributeKey(id)}${pairs ? ' ' + pairs : ''}`;
}

function formatStatusesBlock(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    const entry = formatStatusEntry(item, indentLevel + 1);
    if (!entry) return null;
    lines.push(entry);
  }
  if (lines.length === 0) return [`${indent(indentLevel)}statuses do`, `${indent(indentLevel)}end`];
  return [
    `${indent(indentLevel)}statuses do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatStatusLines(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const id = item.id;
    const name = item.name;
    const polarity = item.polarity;
    const transitionVerb = item.transitionVerb;
    const isTerminal = item.isTerminal === true || item.terminal === true;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof polarity !== 'string') return null;
    const remaining = { ...item };
    delete remaining.id;
    delete remaining.name;
    delete remaining.polarity;
    delete remaining.transitionVerb;
    delete remaining.isTerminal;
    delete remaining.terminal;
    if (Object.keys(remaining).length > 0) return null;
    let line = `${indent(indentLevel)}status ${formatLabel(id)} ${formatLabel(name)} ${formatLabel(polarity)}`;
    if (typeof transitionVerb === 'string') {
      line += ` ${quoteString(transitionVerb)}`;
    }
    if (isTerminal) line += ' terminal';
    lines.push(line);
  }
  return lines;
}

function formatStatusEntry(item: Record<string, unknown>, indentLevel: number): string | null {
  const id = item.id;
  const name = item.name;
  if (typeof id !== 'string' || typeof name !== 'string') return null;

  const body = { ...item };
  delete body.id;
  delete body.name;

  if (body.isTerminal === true) {
    body.terminal = true;
  }
  delete body.isTerminal;

  if (Object.keys(body).length === 0) {
    const nameValue = formatInlineValue(name);
    if (!nameValue) return null;
    return `${indent(indentLevel)}${formatAttributeKey(id)} ${nameValue}`;
  }

  body.name = name;
  const pairs = formatInlinePairs(body);
  if (pairs === null) return null;
  return `${indent(indentLevel)}${formatAttributeKey(id)}${pairs ? ' ' + pairs : ''}`;
}

function formatRequiredRelationshipsBlock(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const kind = item.kind;
    if (typeof kind !== 'string') return null;
    const body = { ...item };
    delete body.kind;
    const description = body.description;
    delete body.description;

    if (Object.keys(body).length === 0 && (description === undefined || typeof description === 'string')) {
      if (description !== undefined) {
        const value = formatInlineValue(description);
        if (!value) return null;
        lines.push(`${indent(indentLevel + 1)}${formatAttributeKey(kind)} ${value}`);
      } else {
        lines.push(`${indent(indentLevel + 1)}${formatAttributeKey(kind)}`);
      }
      continue;
    }

    const entryBody: Record<string, unknown> = { ...body };
    if (description !== undefined) entryBody.description = description;
    const pairs = formatInlinePairs(entryBody);
    if (pairs === null) return null;
    lines.push(`${indent(indentLevel + 1)}${formatAttributeKey(kind)}${pairs ? ' ' + pairs : ''}`);
  }

  if (lines.length === 0) return [`${indent(indentLevel)}required_relationships do`, `${indent(indentLevel)}end`];
  return [
    `${indent(indentLevel)}required_relationships do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatRequiredRelationshipLines(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const kind = item.kind;
    const description = item.description;
    if (typeof kind !== 'string') return null;
    const remaining = { ...item };
    delete remaining.kind;
    delete remaining.description;
    if (Object.keys(remaining).length > 0) return null;
    let line = `${indent(indentLevel)}required ${formatLabel(kind)}`;
    if (typeof description === 'string') {
      line += ` ${quoteString(description)}`;
    }
    lines.push(line);
  }
  return lines;
}

function formatStyleLines(style: unknown, indentLevel: number): string[] | null {
  if (!isRecord(style)) return null;
  const color = style.color;
  const shape = style.shape;
  const displayName = style.displayName;
  const remaining = { ...style };
  delete remaining.color;
  delete remaining.shape;
  delete remaining.displayName;

  const hasExtra = Object.keys(remaining).length > 0;
  if (hasExtra) {
    const lines = [`${indent(indentLevel)}style do`];
    lines.push(...formatAttributeLines(style, indentLevel + 1));
    lines.push(`${indent(indentLevel)}end`);
    return lines;
  }

  const colorValue = color !== undefined ? formatInlineValue(color) : null;
  const shapeValue = shape !== undefined ? formatInlineValue(shape) : null;
  const nameValue = displayName !== undefined ? formatInlineValue(displayName) : null;
  if (colorValue === null && shapeValue === null && nameValue === null) return null;

  let line = `${indent(indentLevel)}style`;
  if (shapeValue || nameValue) {
    if (colorValue) line += ` color ${colorValue}`;
    if (shapeValue) line += ` shape ${shapeValue}`;
    if (nameValue) line += ` name ${nameValue}`;
  } else if (colorValue) {
    line += ` ${colorValue}`;
  }
  return [line];
}
function formatSemanticPlaneBlock(plane: Record<string, unknown>, indentLevel: number): string[] | null {
  const axes = plane.axes;
  const regions = plane.regions;
  const axesLine = isRecord(axes) ? formatAxesLine(axes, indentLevel + 1) : null;
  const axesLines = axesLine ? [axesLine] : (isRecord(axes) ? formatAxesBlock(axes, indentLevel + 1) : null);
  const regionLines = Array.isArray(regions) ? formatRegionBlocks(regions, indentLevel + 1) : null;
  if (!axesLines && !regionLines) return null;

  const lines: string[] = [];
  lines.push(`${indent(indentLevel)}semantic_plane do`);
  if (axesLines) lines.push(...axesLines);
  if (regionLines) lines.push(...regionLines);
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatAxesLine(axes: Record<string, unknown>, indentLevel: number): string | null {
  const axisIds: Record<string, string | null> = {};
  for (const axis of ['x', 'y', 'z']) {
    const axisValue = axes[axis];
    const axisId = isRecord(axisValue) ? axisValue.axisId : axisValue;
    axisIds[axis] = typeof axisId === 'string' ? formatResourceRef(axisId) : null;
  }
  if (!axisIds.x || !axisIds.y) return null;
  let line = `${indent(indentLevel)}axes ${formatScalarString(axisIds.x)} ${formatScalarString(axisIds.y)}`;
  if (axisIds.z) {
    line += ` ${formatScalarString(axisIds.z)}`;
  }
  return line;
}

function formatAxesBlock(axes: Record<string, unknown>, indentLevel: number): string[] | null {
  const axisLines: string[] = [];
  for (const axis of ['x', 'y', 'z']) {
    const axisValue = axes[axis];
    const axisId = isRecord(axisValue) ? axisValue.axisId : axisValue;
    if (typeof axisId === 'string') {
      axisLines.push(`${indent(indentLevel + 1)}${axis} ${formatScalarString(formatResourceRef(axisId))}`);
    }
  }
  if (axisLines.length === 0) return null;
  return [
    `${indent(indentLevel)}axes do`,
    ...axisLines,
    `${indent(indentLevel)}end`
  ];
}

function formatRegionBlocks(regions: Record<string, unknown>[], indentLevel: number): string[] | null {
  if (regions.length === 0) return null;
  const lines: string[] = [];
  for (const region of regions) {
    if (!isRecord(region)) return null;
    const regionLines = formatRegionBlock(region, indentLevel);
    if (!regionLines) return null;
    lines.push(...regionLines);
  }
  return lines;
}

function formatRegionsBlock(regions: Record<string, unknown>[], indentLevel: number): string[] | null {
  if (regions.length === 0) return null;
  const lines: string[] = [];
  for (const region of regions) {
    if (!isRecord(region)) return null;
    const regionLines = formatRegionBlock(region, indentLevel + 1);
    if (!regionLines) return null;
    lines.push(...regionLines);
  }
  return [
    `${indent(indentLevel)}regions do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatRegionBlock(region: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = region.id;
  if (typeof id !== 'string') return null;
  const label = region.label;
  const labels = [formatLabel(id)];
  if (typeof label === 'string') labels.push(formatLabel(label));

  const header = `${indent(indentLevel)}region ${labels.join(' ')} do`;
  const lines = [header];
  const remaining = { ...region };
  delete remaining.id;
  delete remaining.label;

  const bounds = remaining.bounds;
  delete remaining.bounds;

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (isRecord(bounds)) {
    const boundsLine = formatBoundsLine(bounds, indentLevel + 1);
    if (boundsLine) {
      lines.push(boundsLine);
    } else {
      const boundsLines = formatBoundsBlock(bounds, indentLevel + 1);
      if (boundsLines) {
        lines.push(...boundsLines);
      } else {
        pushAttributeLine(lines, 'bounds', bounds, indentLevel + 1);
      }
    }
  } else if (bounds !== undefined) {
    pushAttributeLine(lines, 'bounds', bounds, indentLevel + 1);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatBoundsLine(bounds: Record<string, unknown>, indentLevel: number): string | null {
  const shape = bounds.shape;
  if (typeof shape !== 'string') return null;

  if (shape === 'circle') {
    const center = bounds.center;
    const radius = bounds.radius;
    if (!isRecord(center) || typeof center.x !== 'number' || typeof center.y !== 'number' || typeof radius !== 'number') {
      return null;
    }
    return `${indent(indentLevel)}bounds ${formatLabel(shape)} ${center.x} ${center.y} ${radius}`;
  }

  if (shape === 'rect') {
    const { x1, y1, x2, y2 } = bounds as Record<string, unknown>;
    if ([x1, y1, x2, y2].every((value) => typeof value === 'number')) {
      return `${indent(indentLevel)}bounds ${formatLabel(shape)} ${x1} ${y1} ${x2} ${y2}`;
    }
    return null;
  }

  if (shape === 'polygon') {
    const points = bounds.points;
    if (!Array.isArray(points) || points.length === 0) return null;
    const coords: string[] = [];
    for (const point of points) {
      if (!isRecord(point) || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return null;
      }
      coords.push(`${point.x} ${point.y}`);
    }
    return `${indent(indentLevel)}bounds ${formatLabel(shape)} ${coords.join(' ')}`;
  }

  return null;
}

function formatBoundsBlock(bounds: Record<string, unknown>, indentLevel: number): string[] | null {
  const shape = bounds.shape;
  if (typeof shape !== 'string') return null;

  const lines: string[] = [];
  lines.push(`${indent(indentLevel)}bounds ${formatLabel(shape)} do`);

  if (shape === 'circle') {
    const center = bounds.center;
    const radius = bounds.radius;
    if (isRecord(center) && typeof center.x === 'number' && typeof center.y === 'number') {
      lines.push(`${indent(indentLevel + 1)}center ${center.x} ${center.y}`);
    } else {
      return null;
    }
    if (typeof radius === 'number') {
      lines.push(`${indent(indentLevel + 1)}radius ${radius}`);
    } else {
      return null;
    }
  } else if (shape === 'rect') {
    const { x1, y1, x2, y2 } = bounds as Record<string, unknown>;
    if ([x1, y1, x2, y2].every((value) => typeof value === 'number')) {
      lines.push(`${indent(indentLevel + 1)}x1 ${x1}`);
      lines.push(`${indent(indentLevel + 1)}y1 ${y1}`);
      lines.push(`${indent(indentLevel + 1)}x2 ${x2}`);
      lines.push(`${indent(indentLevel + 1)}y2 ${y2}`);
    } else {
      return null;
    }
  } else if (shape === 'polygon') {
    const points = bounds.points;
    if (!Array.isArray(points)) return null;
    for (const point of points) {
      if (!isRecord(point) || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return null;
      }
      lines.push(`${indent(indentLevel + 1)}point ${point.x} ${point.y}`);
    }
  } else {
    return null;
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatCultureBlock(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;
  const lines = [`culture ${formatLabel(id)} do`];
  const remaining = { ...item };
  delete remaining.id;

  delete remaining.naming;

  const axisBiases = remaining.axisBiases;
  delete remaining.axisBiases;
  const homeRegions = remaining.homeRegions;
  delete remaining.homeRegions;

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (isRecord(axisBiases)) {
    const entries = Object.entries(axisBiases).sort(([a], [b]) => a.localeCompare(b));
    for (const [kind, bias] of entries) {
      if (!isRecord(bias) || typeof bias.x !== 'number' || typeof bias.y !== 'number' || typeof bias.z !== 'number') {
        pushAttributeLine(lines, 'axisBiases', axisBiases, 1);
        break;
      }
      lines.push(`${indent(1)}axis_bias ${formatLabel(kind)} ${bias.x} ${bias.y} ${bias.z}`);
    }
  } else if (axisBiases !== undefined) {
    pushAttributeLine(lines, 'axisBiases', axisBiases, 1);
  }

  if (isRecord(homeRegions)) {
    const entries = Object.entries(homeRegions).sort(([a], [b]) => a.localeCompare(b));
    for (const [kind, regions] of entries) {
      if (!Array.isArray(regions)) {
        pushAttributeLine(lines, 'homeRegions', homeRegions, 1);
        break;
      }
      if (regions.length === 0) {
        continue;
      }
      const regionTokens = regions.map((region) => (typeof region === 'string' ? formatLabel(region) : null));
      if (regionTokens.some((token) => token === null)) {
        pushAttributeLine(lines, 'homeRegions', homeRegions, 1);
        break;
      }
      lines.push(`${indent(1)}home_region ${formatLabel(kind)} ${regionTokens.join(' ')}`);
    }
  } else if (homeRegions !== undefined) {
    pushAttributeLine(lines, 'homeRegions', homeRegions, 1);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatEraBlock(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;
  const name = typeof item.name === 'string' ? item.name : undefined;
  const labels = [formatLabel(id)];
  if (name) labels.push(quoteString(name));

  const lines = [`era ${labels.join(' ')} do`];
  const remaining = { ...item };
  delete remaining.id;
  delete remaining.name;

  const templateWeights = remaining.templateWeights;
  delete remaining.templateWeights;
  const systemModifiers = remaining.systemModifiers;
  delete remaining.systemModifiers;
  const entryConditions = remaining.entryConditions;
  delete remaining.entryConditions;
  const exitConditions = remaining.exitConditions;
  delete remaining.exitConditions;
  const entryEffects = remaining.entryEffects;
  delete remaining.entryEffects;
  const exitEffects = remaining.exitEffects;
  delete remaining.exitEffects;

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (Array.isArray(entryConditions)) {
    for (const condition of entryConditions) {
      lines.push(...formatConditionLinesWithKeyword(condition, 1, 'entry_condition'));
    }
  } else if (entryConditions !== undefined) {
    pushAttributeLine(lines, 'entryConditions', entryConditions, 1);
  }

  if (Array.isArray(exitConditions)) {
    for (const condition of exitConditions) {
      lines.push(...formatConditionLinesWithKeyword(condition, 1, 'exit_condition'));
    }
  } else if (exitConditions !== undefined) {
    pushAttributeLine(lines, 'exitConditions', exitConditions, 1);
  }

  const entryEffectLines = formatEraEffectLines(entryEffects, 1, 'entry_effect');
  if (entryEffectLines) {
    lines.push(...entryEffectLines);
  } else if (entryEffects !== undefined) {
    pushAttributeLine(lines, 'entryEffects', entryEffects, 1);
  }

  const exitEffectLines = formatEraEffectLines(exitEffects, 1, 'exit_effect');
  if (exitEffectLines) {
    lines.push(...exitEffectLines);
  } else if (exitEffects !== undefined) {
    pushAttributeLine(lines, 'exitEffects', exitEffects, 1);
  }

  if (isRecord(templateWeights)) {
    const entries = Object.entries(templateWeights).sort(([a], [b]) => a.localeCompare(b));
    for (const [templateId, weight] of entries) {
      if (typeof weight !== 'number') {
        pushAttributeLine(lines, 'templateWeights', templateWeights, 1);
        break;
      }
      lines.push(`${indent(1)}template_weight ${formatLabel(templateId)} ${weight}`);
    }
  } else if (templateWeights !== undefined) {
    pushAttributeLine(lines, 'templateWeights', templateWeights, 1);
  }

  if (isRecord(systemModifiers)) {
    const entries = Object.entries(systemModifiers).sort(([a], [b]) => a.localeCompare(b));
    for (const [systemId, multiplier] of entries) {
      if (typeof multiplier !== 'number') {
        pushAttributeLine(lines, 'systemModifiers', systemModifiers, 1);
        break;
      }
      lines.push(`${indent(1)}system_modifier ${formatLabel(systemId)} ${multiplier}`);
    }
  } else if (systemModifiers !== undefined) {
    pushAttributeLine(lines, 'systemModifiers', systemModifiers, 1);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatNamingBlock(naming: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}naming do`];
  const remaining = { ...naming };

  const domains = Array.isArray(remaining.domains) ? remaining.domains.slice() : null;
  delete remaining.domains;
  const lexemeLists = isRecord(remaining.lexemeLists) ? remaining.lexemeLists : null;
  delete remaining.lexemeLists;
  const lexemeSpecs = Array.isArray(remaining.lexemeSpecs) ? remaining.lexemeSpecs.slice() : null;
  delete remaining.lexemeSpecs;
  const grammars = Array.isArray(remaining.grammars) ? remaining.grammars.slice() : null;
  delete remaining.grammars;
  const profiles = Array.isArray(remaining.profiles) ? remaining.profiles.slice() : null;
  delete remaining.profiles;

  if (domains) {
    domains.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const domain of domains) {
      if (!isRecord(domain)) continue;
      const domainLines = formatNamingDomainBlock(domain, indentLevel + 1);
      if (domainLines) {
        lines.push(...domainLines);
      } else {
        const body = { ...domain };
        const labels: string[] = [];
        if (typeof body.id === 'string') {
          labels.push(body.id);
          delete body.id;
        }
        lines.push(
          ...formatBlock('domain', labels, body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (lexemeLists) {
    const entries = Object.entries(lexemeLists).sort(([a], [b]) => a.localeCompare(b));
    for (const [id, value] of entries) {
      if (!isRecord(value)) continue;
      const lexemeLines = formatLexemeListBlock(id, value, indentLevel + 1);
      if (lexemeLines) {
        lines.push(...lexemeLines);
      } else {
        const body = { ...value };
        delete body.id;
        lines.push(
          ...formatBlock('lexeme_list', [id], body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (lexemeSpecs) {
    lexemeSpecs.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const spec of lexemeSpecs) {
      if (!isRecord(spec)) continue;
      const specLines = formatLexemeSpecBlock(spec, indentLevel + 1);
      if (specLines) {
        lines.push(...specLines);
      } else {
        const body = { ...spec };
        const labels: string[] = [];
        if (typeof body.id === 'string') {
          labels.push(body.id);
          delete body.id;
        }
        lines.push(
          ...formatBlock('lexeme_spec', labels, body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (grammars) {
    grammars.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const grammar of grammars) {
      if (!isRecord(grammar)) continue;
      const grammarLines = formatGrammarBlock(grammar, indentLevel + 1);
      if (grammarLines) {
        lines.push(...grammarLines);
      } else {
        const body = { ...grammar };
        const labels: string[] = [];
        if (typeof body.id === 'string') {
          labels.push(body.id);
          delete body.id;
        }
        lines.push(
          ...formatBlock('grammar', labels, body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (profiles) {
    profiles.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const profile of profiles) {
      if (!isRecord(profile)) continue;
      const profileLines = formatProfileBlock(profile, indentLevel + 1);
      if (profileLines) lines.push(...profileLines);
    }
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatNamingDomainBlock(domain: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = domain.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}domain ${formatLabel(id)} do`];
  const remaining = { ...domain };
  delete remaining.id;

  const phonology = remaining.phonology;
  delete remaining.phonology;
  const morphology = remaining.morphology;
  delete remaining.morphology;
  const style = remaining.style;
  delete remaining.style;
  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  if (isRecord(phonology)) {
    lines.push(...formatPhonologyBlock(phonology, indentLevel + 1));
  } else if (phonology !== undefined) {
    pushAttributeLine(lines, 'phonology', phonology, indentLevel + 1);
  }

  if (isRecord(morphology)) {
    lines.push(...formatMorphologyBlock(morphology, indentLevel + 1));
  } else if (morphology !== undefined) {
    pushAttributeLine(lines, 'morphology', morphology, indentLevel + 1);
  }

  if (isRecord(style)) {
    lines.push(...formatNamingStyleBlock(style, indentLevel + 1));
  } else if (style !== undefined) {
    pushAttributeLine(lines, 'style', style, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPhonologyBlock(phonology: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}phonology do`];
  const remaining = { ...phonology };

  const lengthRange = remaining.lengthRange;
  delete remaining.lengthRange;
  const syllableTemplates = remaining.syllableTemplates;
  delete remaining.syllableTemplates;
  const favoredClusters = remaining.favoredClusters;
  delete remaining.favoredClusters;
  const forbiddenClusters = remaining.forbiddenClusters;
  delete remaining.forbiddenClusters;
  const favoredClusterBoost = remaining.favoredClusterBoost;
  delete remaining.favoredClusterBoost;
  const consonantWeights = remaining.consonantWeights;
  delete remaining.consonantWeights;
  const vowelWeights = remaining.vowelWeights;
  delete remaining.vowelWeights;
  const templateWeights = remaining.templateWeights;
  delete remaining.templateWeights;
  const maxCluster = remaining.maxConsonantCluster;
  delete remaining.maxConsonantCluster;
  const minVowelSpacing = remaining.minVowelSpacing;
  delete remaining.minVowelSpacing;
  const sonorityRanks = remaining.sonorityRanks;
  delete remaining.sonorityRanks;

  for (const key of ['consonants', 'vowels'] as const) {
    if (remaining[key] !== undefined) {
      pushInlinePairLine(lines, key, remaining[key], indentLevel + 1);
      delete remaining[key];
    }
  }

  if (syllableTemplates !== undefined) {
    pushInlinePairLine(lines, 'templates', syllableTemplates, indentLevel + 1);
  }
  if (Array.isArray(lengthRange) && lengthRange.length >= 2) {
    const [min, max] = lengthRange;
    if (typeof min === 'number' && typeof max === 'number') {
      lines.push(`${indent(indentLevel + 1)}length ${min} ${max}`);
    } else {
      pushAttributeLine(lines, 'lengthRange', lengthRange, indentLevel + 1);
    }
  } else if (lengthRange !== undefined) {
    pushAttributeLine(lines, 'lengthRange', lengthRange, indentLevel + 1);
  }
  if (favoredClusters !== undefined) {
    pushInlinePairLine(lines, 'favored_clusters', favoredClusters, indentLevel + 1);
  }
  if (forbiddenClusters !== undefined) {
    pushInlinePairLine(lines, 'forbidden_clusters', forbiddenClusters, indentLevel + 1);
  }
  if (favoredClusterBoost !== undefined) {
    pushInlinePairLine(lines, 'favored_cluster_boost', favoredClusterBoost, indentLevel + 1);
  }
  if (Array.isArray(consonantWeights)) {
    for (const weight of consonantWeights) {
      if (typeof weight !== 'number') {
        pushAttributeLine(lines, 'consonantWeights', consonantWeights, indentLevel + 1);
        break;
      }
      lines.push(`${indent(indentLevel + 1)}consonant_weight ${weight}`);
    }
  } else if (consonantWeights !== undefined) {
    pushAttributeLine(lines, 'consonantWeights', consonantWeights, indentLevel + 1);
  }
  if (Array.isArray(vowelWeights)) {
    for (const weight of vowelWeights) {
      if (typeof weight !== 'number') {
        pushAttributeLine(lines, 'vowelWeights', vowelWeights, indentLevel + 1);
        break;
      }
      lines.push(`${indent(indentLevel + 1)}vowel_weight ${weight}`);
    }
  } else if (vowelWeights !== undefined) {
    pushAttributeLine(lines, 'vowelWeights', vowelWeights, indentLevel + 1);
  }
  if (Array.isArray(templateWeights)) {
    for (const weight of templateWeights) {
      if (typeof weight !== 'number') {
        pushAttributeLine(lines, 'templateWeights', templateWeights, indentLevel + 1);
        break;
      }
      lines.push(`${indent(indentLevel + 1)}template_weight ${weight}`);
    }
  } else if (templateWeights !== undefined) {
    pushAttributeLine(lines, 'templateWeights', templateWeights, indentLevel + 1);
  }
  if (maxCluster !== undefined) {
    pushInlinePairLine(lines, 'max_cluster', maxCluster, indentLevel + 1);
  }
  if (minVowelSpacing !== undefined) {
    pushInlinePairLine(lines, 'min_vowel_spacing', minVowelSpacing, indentLevel + 1);
  }
  if (sonorityRanks !== undefined) {
    pushInlinePairLine(lines, 'sonority', sonorityRanks, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatMorphologyBlock(morphology: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}morphology do`];
  const remaining = { ...morphology };

  const wordRoots = remaining.wordRoots;
  delete remaining.wordRoots;
  const prefixWeights = remaining.prefixWeights;
  delete remaining.prefixWeights;
  const suffixWeights = remaining.suffixWeights;
  delete remaining.suffixWeights;
  const structureWeights = remaining.structureWeights;
  delete remaining.structureWeights;

  for (const key of ['prefixes', 'suffixes', 'infixes', 'honorifics', 'structure', 'word_roots'] as const) {
    if (key === 'word_roots') {
      if (wordRoots !== undefined) {
        pushInlinePairLine(lines, 'word_roots', wordRoots, indentLevel + 1);
      }
      continue;
    }
    if (remaining[key] !== undefined) {
      pushInlinePairLine(lines, key, remaining[key], indentLevel + 1);
      delete remaining[key];
    }
  }

  if (Array.isArray(prefixWeights)) {
    for (const weight of prefixWeights) {
      if (typeof weight !== 'number') {
        pushAttributeLine(lines, 'prefixWeights', prefixWeights, indentLevel + 1);
        break;
      }
      lines.push(`${indent(indentLevel + 1)}prefix_weight ${weight}`);
    }
  } else if (prefixWeights !== undefined) {
    pushAttributeLine(lines, 'prefixWeights', prefixWeights, indentLevel + 1);
  }
  if (Array.isArray(suffixWeights)) {
    for (const weight of suffixWeights) {
      if (typeof weight !== 'number') {
        pushAttributeLine(lines, 'suffixWeights', suffixWeights, indentLevel + 1);
        break;
      }
      lines.push(`${indent(indentLevel + 1)}suffix_weight ${weight}`);
    }
  } else if (suffixWeights !== undefined) {
    pushAttributeLine(lines, 'suffixWeights', suffixWeights, indentLevel + 1);
  }
  if (Array.isArray(structureWeights)) {
    for (const weight of structureWeights) {
      if (typeof weight !== 'number') {
        pushAttributeLine(lines, 'structureWeights', structureWeights, indentLevel + 1);
        break;
      }
      lines.push(`${indent(indentLevel + 1)}structure_weight ${weight}`);
    }
  } else if (structureWeights !== undefined) {
    pushAttributeLine(lines, 'structureWeights', structureWeights, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatNamingStyleBlock(style: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}style do`];
  const remaining = { ...style };

  const apostropheRate = remaining.apostropheRate;
  delete remaining.apostropheRate;
  const hyphenRate = remaining.hyphenRate;
  delete remaining.hyphenRate;
  const preferredEndings = remaining.preferredEndings;
  delete remaining.preferredEndings;
  const preferredEndingBoost = remaining.preferredEndingBoost;
  delete remaining.preferredEndingBoost;
  const rhythmBias = remaining.rhythmBias;
  delete remaining.rhythmBias;
  const targetLength = remaining.targetLength;
  delete remaining.targetLength;
  const lengthTolerance = remaining.lengthTolerance;
  delete remaining.lengthTolerance;

  if (remaining.capitalization !== undefined) {
    pushInlinePairLine(lines, 'capitalization', remaining.capitalization, indentLevel + 1);
    delete remaining.capitalization;
  }
  if (apostropheRate !== undefined) {
    pushInlinePairLine(lines, 'apostrophe_rate', apostropheRate, indentLevel + 1);
  }
  if (hyphenRate !== undefined) {
    pushInlinePairLine(lines, 'hyphen_rate', hyphenRate, indentLevel + 1);
  }
  if (preferredEndings !== undefined) {
    pushInlinePairLine(lines, 'preferred_endings', preferredEndings, indentLevel + 1);
  }
  if (preferredEndingBoost !== undefined) {
    pushInlinePairLine(lines, 'preferred_ending_boost', preferredEndingBoost, indentLevel + 1);
  }
  if (rhythmBias !== undefined) {
    pushInlinePairLine(lines, 'rhythm_bias', rhythmBias, indentLevel + 1);
  }
  if (targetLength !== undefined) {
    pushInlinePairLine(lines, 'target_length', targetLength, indentLevel + 1);
  }
  if (lengthTolerance !== undefined) {
    pushInlinePairLine(lines, 'length_tolerance', lengthTolerance, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatLexemeListBlock(id: string, list: Record<string, unknown>, indentLevel: number): string[] | null {
  const lines = [`${indent(indentLevel)}lexeme_list ${formatLabel(id)} do`];
  const remaining = { ...list };
  delete remaining.id;

  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  const entriesValue = remaining.entries;
  const entries = Array.isArray(entriesValue) ? entriesValue : null;
  delete remaining.entries;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel + 1);
    delete remaining.description;
  }
  if (remaining.source !== undefined) {
    pushInlinePairLine(lines, 'source', remaining.source, indentLevel + 1);
    delete remaining.source;
  }

  if (entries) {
    for (const entry of entries) {
      const inline = formatInlineValue(entry);
      if (!inline) return null;
      lines.push(`${indent(indentLevel + 1)}entry ${inline}`);
    }
  } else if (entriesValue !== undefined) {
    pushAttributeLine(lines, 'entries', entriesValue, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatLexemeSpecBlock(spec: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = spec.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}lexeme_spec ${formatLabel(id)} do`];
  const remaining = { ...spec };
  delete remaining.id;

  const targetCount = remaining.targetCount;
  delete remaining.targetCount;
  const qualityFilter = remaining.qualityFilter;
  delete remaining.qualityFilter;
  const cultureId = remaining.cultureId;
  delete remaining.cultureId;
  const maxWords = remaining.maxWords;
  delete remaining.maxWords;
  const wordStyle = remaining.wordStyle;
  delete remaining.wordStyle;

  if (remaining.pos !== undefined) {
    pushInlinePairLine(lines, 'pos', remaining.pos, indentLevel + 1);
    delete remaining.pos;
  }
  if (remaining.style !== undefined) {
    pushInlinePairLine(lines, 'style', remaining.style, indentLevel + 1);
    delete remaining.style;
  }
  if (targetCount !== undefined) {
    pushInlinePairLine(lines, 'target', targetCount, indentLevel + 1);
  }
  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }
  if (maxWords !== undefined) {
    pushInlinePairLine(lines, 'max_words', maxWords, indentLevel + 1);
  }
  if (wordStyle !== undefined) {
    pushInlinePairLine(lines, 'word_style', wordStyle, indentLevel + 1);
  }
  if (isRecord(qualityFilter)) {
    const minLength = qualityFilter.minLength;
    const maxLength = qualityFilter.maxLength;
    if (typeof minLength === 'number' && typeof maxLength === 'number') {
      lines.push(`${indent(indentLevel + 1)}quality ${minLength} ${maxLength}`);
    } else {
      pushAttributeLine(lines, 'qualityFilter', qualityFilter, indentLevel + 1);
    }
  } else if (qualityFilter !== undefined) {
    pushAttributeLine(lines, 'qualityFilter', qualityFilter, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatGrammarBlock(grammar: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = grammar.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}grammar ${formatLabel(id)} do`];
  const remaining = { ...grammar };
  delete remaining.id;

  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  const rulesValue = remaining.rules;
  const rules = isRecord(rulesValue) ? (rulesValue as Record<string, unknown>) : null;
  delete remaining.rules;

  if (remaining.start !== undefined) {
    pushInlinePairLine(lines, 'start', remaining.start, indentLevel + 1);
    delete remaining.start;
  }
  if (remaining.capitalization !== undefined) {
    pushInlinePairLine(lines, 'capitalization', remaining.capitalization, indentLevel + 1);
    delete remaining.capitalization;
  }

  if (rules) {
    const ruleEntries = Object.entries(rules).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, value] of ruleEntries) {
      if (!Array.isArray(value)) return null;
      for (const option of value) {
        if (!Array.isArray(option)) return null;
        const tokens: string[] = [];
        for (const token of option) {
          const inline = formatInlineValue(token);
          if (!inline) return null;
          tokens.push(inline);
        }
        lines.push(`${indent(indentLevel + 1)}rule ${formatLabel(name)} ${tokens.join(' ')}`);
      }
    }
  } else if (rulesValue !== undefined) {
    pushAttributeLine(lines, 'rules', rulesValue, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatProfileBlock(profile: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = profile.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}profile ${formatLabel(id)} do`];
  const remaining = { ...profile };
  delete remaining.id;

  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  const strategyGroups = Array.isArray(remaining.strategyGroups) ? remaining.strategyGroups.slice() : null;
  delete remaining.strategyGroups;

  if (remaining.name !== undefined) {
    pushAttributeLine(lines, 'name', remaining.name, indentLevel + 1);
    delete remaining.name;
  }
  if (remaining.isDefault !== undefined) {
    pushAttributeLine(lines, 'isDefault', remaining.isDefault, indentLevel + 1);
    delete remaining.isDefault;
  }
  if (remaining.entityKinds !== undefined) {
    pushAttributeLine(lines, 'entityKinds', remaining.entityKinds, indentLevel + 1);
    delete remaining.entityKinds;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (strategyGroups) {
    for (const group of strategyGroups) {
      if (!isRecord(group)) continue;
      const groupLines = formatStrategyGroupBlock(group, indentLevel + 1);
      if (groupLines) lines.push(...groupLines);
    }
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatStrategyGroupBlock(group: Record<string, unknown>, indentLevel: number): string[] | null {
  const name = group.name;
  const labels: string[] = [];
  if (typeof name === 'string') labels.push(name);
  const header = `${indent(indentLevel)}strategy_group${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const remaining = { ...group };
  delete remaining.name;

  const conditions = remaining.conditions;
  delete remaining.conditions;
  const strategies = Array.isArray(remaining.strategies) ? remaining.strategies : null;
  delete remaining.strategies;

  if (remaining.priority !== undefined) {
    pushAttributeLine(lines, 'priority', remaining.priority, indentLevel + 1);
    delete remaining.priority;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (conditions !== undefined) {
    if (isRecord(conditions)) {
      lines.push(
        ...formatBlock('conditions', [], conditions)
          .replace(/^/gm, indent(indentLevel + 1))
          .split('\n')
      );
    } else {
      pushAttributeLine(lines, 'conditions', conditions, indentLevel + 1);
    }
  }

  if (strategies) {
    for (const strategy of strategies) {
      if (!isRecord(strategy)) continue;
      const entryLines = formatStrategyEntry(strategy, indentLevel + 1);
      if (entryLines) lines.push(...entryLines);
    }
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatStrategyEntry(strategy: Record<string, unknown>, indentLevel: number): string[] | null {
  const type = strategy.type;
  if (typeof type !== 'string') return null;
  const body = { ...strategy };
  delete body.type;

  const labels = [type];
  if (type === 'grammar' && typeof body.grammarId === 'string') {
    labels.push(formatResourceRef(body.grammarId));
    delete body.grammarId;
  }
  if (type === 'phonotactic' && typeof body.domainId === 'string') {
    labels.push(formatResourceRef(body.domainId));
    delete body.domainId;
  }

  const header = `${indent(indentLevel)}strategy${labels.length ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const bodyLines = formatAttributeLines(body, indentLevel + 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatAttributeLines(obj: Record<string, unknown>, indentLevel: number): string[] {
  const lines: string[] = [];
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);

  for (const [key, value] of entries) {
    if (key === 'creation' && Array.isArray(value)) {
      const entryLines = formatCreationEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    if (key === 'relationships' && Array.isArray(value)) {
      const entryLines = formatRelationshipEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    if (key === 'variables' && isRecord(value)) {
      const entryLines = formatVariableEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    if (key === 'applicability' && Array.isArray(value)) {
      const entryLines = formatApplicabilityEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    pushAttributeLine(lines, key, value, indentLevel);
  }

  return lines;
}

function formatApplicabilityBlock(value: unknown, indentLevel: number): string[] | null {
  if (value === undefined || value === null) return null;
  let conditions: unknown[] | null = null;
  let mode: string | undefined;

  if (Array.isArray(value)) {
    conditions = value;
  } else if (isRecord(value) && (value.type === 'and' || value.type === 'or') && Array.isArray(value.conditions)) {
    conditions = value.conditions as unknown[];
    mode = value.type === 'or' ? 'any' : 'all';
  } else {
    return null;
  }

  if (conditions.length === 0) return null;

  const header = `${indent(indentLevel)}when${mode ? ' ' + mode : ''} do`;
  const lines = [header];
  for (const condition of conditions) {
    lines.push(...formatConditionLines(condition, indentLevel + 1));
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatConditionLines(condition: unknown, indentLevel: number): string[] {
  if (!isRecord(condition)) {
    const lines: string[] = [];
    pushAttributeLine(lines, 'condition', condition, indentLevel);
    return lines;
  }

  const cleaned = cloneAndStripRefs(condition) as Record<string, unknown>;
  const type = cleaned.type;

  if (type === 'pressure' && typeof cleaned.pressureId === 'string') {
    const min = cleaned.min;
    const max = cleaned.max;
    if (typeof min === 'number' && typeof max === 'number' && min === max) {
      return [`${indent(indentLevel)}pressure ${cleaned.pressureId} == ${min}`];
    }
    if (typeof min === 'number' && typeof max === 'number' && min !== max) {
      return [`${indent(indentLevel)}pressure ${cleaned.pressureId} between ${min} ${max}`];
    }
    if (typeof min === 'number' && max === undefined) {
      return [`${indent(indentLevel)}pressure ${cleaned.pressureId} >= ${min}`];
    }
    if (typeof max === 'number' && min === undefined) {
      return [`${indent(indentLevel)}pressure ${cleaned.pressureId} <= ${max}`];
    }
  }

  if (type === 'entity_count' && typeof cleaned.kind === 'string') {
    const min = cleaned.min;
    const max = cleaned.max;
    if (cleaned.subtype === undefined && cleaned.status === undefined) {
      if (typeof min === 'number' && typeof max === 'number' && min === max) {
        return [`${indent(indentLevel)}cap kind ${cleaned.kind} == ${min}`];
      }
      if (typeof min === 'number' && max === undefined) {
        return [`${indent(indentLevel)}cap kind ${cleaned.kind} >= ${min}`];
      }
      if (typeof max === 'number' && min === undefined) {
        return [`${indent(indentLevel)}cap kind ${cleaned.kind} <= ${max}`];
      }
    } else {
      const parts = [`${indent(indentLevel)}entity_count`, 'kind', cleaned.kind];
      if (typeof cleaned.subtype === 'string') {
        parts.push('subtype', formatLabel(cleaned.subtype));
      }
      if (typeof cleaned.status === 'string') {
        parts.push('status', formatLabel(cleaned.status));
      }
      if (typeof min === 'number' && typeof max === 'number' && min !== max) {
        parts.push('between', String(min), String(max));
      } else if (typeof min === 'number' && typeof max === 'number' && min === max) {
        parts.push('==', String(min));
      } else if (typeof min === 'number') {
        parts.push('>=', String(min));
      } else if (typeof max === 'number') {
        parts.push('<=', String(max));
      } else {
        return formatEntryLineOrBlock('condition', [], cleaned, indentLevel);
      }
      return [parts.join(' ')];
    }
  }

  if (type === 'relationship_count' && typeof cleaned.relationshipKind === 'string') {
    const min = cleaned.min;
    const max = cleaned.max;
    const direction = typeof cleaned.direction === 'string' ? cleaned.direction : null;
    const kind = formatLabel(cleaned.relationshipKind);
    if (typeof min === 'number' && typeof max === 'number' && min === max) {
      return [
        `${indent(indentLevel)}relationship_count ${kind}${direction ? ' ' + direction : ''} == ${min}`
      ];
    }
    if (typeof min === 'number' && max === undefined) {
      return [
        `${indent(indentLevel)}relationship_count ${kind}${direction ? ' ' + direction : ''} >= ${min}`
      ];
    }
    if (typeof max === 'number' && min === undefined) {
      return [
        `${indent(indentLevel)}relationship_count ${kind}${direction ? ' ' + direction : ''} <= ${max}`
      ];
    }
  }

  if (type === 'relationship_exists' && typeof cleaned.relationshipKind === 'string') {
    if (typeof cleaned.direction !== 'string') {
      return formatEntryLineOrBlock('condition', [], cleaned, indentLevel);
    }
    const parts = [
      `${indent(indentLevel)}relationship_exists`,
      formatLabel(cleaned.relationshipKind),
      cleaned.direction
    ];
    if (typeof cleaned.targetKind === 'string') {
      parts.push('target_kind', formatLabel(cleaned.targetKind));
    }
    if (typeof cleaned.targetStatus === 'string') {
      parts.push('target_status', formatLabel(cleaned.targetStatus));
    }
    return [parts.join(' ')];
  }

  if (type === 'prominence') {
    if (typeof cleaned.min === 'string' && cleaned.max === undefined) {
      return [`${indent(indentLevel)}prominence min ${formatLabel(cleaned.min)}`];
    }
    if (typeof cleaned.max === 'string' && cleaned.min === undefined) {
      return [`${indent(indentLevel)}prominence max ${formatLabel(cleaned.max)}`];
    }
  }

  if (type === 'tag_exists' && typeof cleaned.tag === 'string') {
    return [`${indent(indentLevel)}tag_exists ${formatLabel(cleaned.tag)}`];
  }

  if (type === 'lacks_tag' && typeof cleaned.tag === 'string') {
    if (typeof cleaned.entity === 'string') {
      return [
        `${indent(indentLevel)}lacks_tag ${formatLabel(stripBinding(cleaned.entity))} ${formatLabel(cleaned.tag)}`
      ];
    }
    return [`${indent(indentLevel)}lacks_tag ${formatLabel(cleaned.tag)}`];
  }

  if (type === 'random_chance' && typeof cleaned.chance === 'number') {
    return [`${indent(indentLevel)}random_chance ${cleaned.chance}`];
  }

  if (type === 'time_elapsed' && typeof cleaned.minTicks === 'number') {
    const parts = [`${indent(indentLevel)}time_elapsed`, String(cleaned.minTicks)];
    if (typeof cleaned.since === 'string') {
      parts.push('since', cleaned.since);
    }
    return [parts.join(' ')];
  }

  if (type === 'entity_exists' && typeof cleaned.entity === 'string') {
    return [`${indent(indentLevel)}entity_exists ${formatLabel(stripBinding(cleaned.entity))}`];
  }

  if (type === 'not_self') {
    return [`${indent(indentLevel)}not_self`];
  }

  if (type === 'era_match' && Array.isArray(cleaned.eras)) {
    const inline = formatSetInlineValue(cleaned.eras);
    if (inline) {
      return [`${indent(indentLevel)}era_match ${inline}`];
    }
  }

  if (type === 'graph_path' && isRecord(cleaned.assert)) {
    const graphLines = formatGraphPathLines(cleaned.assert, indentLevel, 'path');
    if (graphLines) return graphLines;
  }

  return formatEntryLineOrBlock('condition', [], cleaned, indentLevel);
}

function formatSelectionBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const selection = { ...cleaned };
  const labels: string[] = ['target'];

  if (typeof selection.kind === 'string') {
    labels.push('from', selection.kind);
    delete selection.kind;
  }

  const header = `${indent(indentLevel)}choose ${labels.map(formatLabel).join(' ')} do`;
  const lines = [header];
  const innerIndent = indentLevel + 1;

  if (selection.strategy !== undefined) {
    if (selection.strategy !== 'by_kind') {
      pushInlinePairLine(lines, 'strategy', selection.strategy, innerIndent);
    }
    delete selection.strategy;
  }

  const pickStrategy = selection.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete selection.pickStrategy;

  if (selection.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', selection.kinds, innerIndent);
    delete selection.kinds;
  }

  if (Array.isArray(selection.subtypes) && selection.subtypes.length > 0) {
    if (selection.subtypes.length > 1) {
      const inline = formatSetInlineValue(selection.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushAttributeLine(lines, 'subtypes', selection.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', selection.subtypes[0], innerIndent);
    }
    delete selection.subtypes;
  }

  if (Array.isArray(selection.statuses) && selection.statuses.length > 0) {
    if (selection.statuses.length > 1) {
      const inline = formatSetInlineValue(selection.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushAttributeLine(lines, 'statuses', selection.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', selection.statuses[0], innerIndent);
    }
    delete selection.statuses;
  }

  if (selection.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', selection.statusFilter, innerIndent);
    delete selection.statusFilter;
  }

  if (selection.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', selection.maxResults, innerIndent);
    delete selection.maxResults;
  }

  if (Array.isArray(selection.saturationLimits) && selection.saturationLimits.length > 0) {
    const saturationLines = formatSaturationLines(selection.saturationLimits, innerIndent);
    if (saturationLines) {
      lines.push(...saturationLines);
      delete selection.saturationLimits;
    }
  }

  if (selection.referenceEntity !== undefined) {
    pushInlinePairLine(lines, 'referenceEntity', selection.referenceEntity, innerIndent);
    delete selection.referenceEntity;
  }

  if (selection.relationshipKind !== undefined) {
    pushInlinePairLine(lines, 'relationshipKind', selection.relationshipKind, innerIndent);
    delete selection.relationshipKind;
  }

  if (selection.direction !== undefined) {
    pushInlinePairLine(lines, 'direction', selection.direction, innerIndent);
    delete selection.direction;
  }

  if (selection.mustHave !== undefined) {
    pushInlinePairLine(lines, 'mustHave', selection.mustHave, innerIndent);
    delete selection.mustHave;
  }

  if (selection.excludeSubtypes !== undefined) {
    pushInlinePairLine(lines, 'excludeSubtypes', selection.excludeSubtypes, innerIndent);
    delete selection.excludeSubtypes;
  }

  if (selection.notStatus !== undefined) {
    pushInlinePairLine(lines, 'notStatus', selection.notStatus, innerIndent);
    delete selection.notStatus;
  }

  if (selection.subtypePreferences !== undefined) {
    pushInlinePairLine(lines, 'subtypePreferences', selection.subtypePreferences, innerIndent);
    delete selection.subtypePreferences;
  }

  if (selection.maxDistance !== undefined) {
    pushInlinePairLine(lines, 'maxDistance', selection.maxDistance, innerIndent);
    delete selection.maxDistance;
  }

  if (selection.minProminence !== undefined) {
    pushInlinePairLine(lines, 'minProminence', selection.minProminence, innerIndent);
    delete selection.minProminence;
  }

  if (selection.filters !== undefined) {
    const filterLines = formatFilterLines(selection.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', selection.filters, innerIndent);
    }
    delete selection.filters;
  }

  if (selection.preferFilters !== undefined) {
    const preferLines = formatFilterLines(selection.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', selection.preferFilters, innerIndent);
    }
    delete selection.preferFilters;
  }

  for (const [key, value] of Object.entries(selection)) {
    if (value === undefined) continue;
    pushAttributeLine(lines, key, value, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatConditionLinesWithKeyword(
  condition: unknown,
  indentLevel: number,
  keyword: string
): string[] {
  const lines = formatConditionLines(condition, indentLevel);
  const baseIndent = indent(indentLevel);
  const prefix = `${baseIndent}${keyword} `;
  return lines.map((line) =>
    line.startsWith(baseIndent) ? `${prefix}${line.slice(baseIndent.length)}` : `${prefix}${line}`
  );
}

function formatEraEffectLines(
  effects: unknown,
  indentLevel: number,
  keyword: string
): string[] | null {
  if (!isRecord(effects)) return null;
  const mutations = effects.mutations;
  if (!Array.isArray(mutations)) return null;
  const lines: string[] = [];
  for (const mutation of mutations) {
    if (!isRecord(mutation)) return null;
    if (mutation.type !== 'modify_pressure') return null;
    const pressureId = mutation.pressureId;
    const delta = mutation.delta;
    if (typeof pressureId !== 'string' || typeof delta !== 'number') return null;
    lines.push(`${indent(indentLevel)}${keyword} modify_pressure ${pressureId} ${delta}`);
  }
  return lines.length > 0 ? lines : null;
}

function formatFilterLines(value: unknown, indentLevel: number, keyword: 'filter' | 'prefer'): string[] | null {
  if (!Array.isArray(value)) return null;
  const lines: string[] = [];
  for (const entry of value) {
    const line = formatFilterLine(entry, indentLevel, keyword);
    if (!line) return null;
    lines.push(...line);
  }
  return lines;
}

function formatFilterLine(
  value: unknown,
  indentLevel: number,
  keyword: 'filter' | 'prefer'
): string[] | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const type = cleaned.type;
  if (typeof type !== 'string') return null;

  if (type === 'graph_path' && isRecord(cleaned.assert)) {
    return formatGraphPathLines(cleaned.assert, indentLevel, `${keyword} path`);
  }

  if (type === 'exclude' && Array.isArray(cleaned.entities)) {
    const entities = cleaned.entities.map((entry) => formatLabel(String(entry)));
    if (entities.length === 0) return null;
    return [`${indent(indentLevel)}${keyword} exclude ${entities.join(' ')}`];
  }

  if (type === 'has_relationship' || type === 'lacks_relationship') {
    const kind = cleaned.kind;
    if (typeof kind !== 'string') return null;
    const parts = [`${indent(indentLevel)}${keyword}`, type, formatLabel(kind)];
    if (typeof cleaned.with === 'string') {
      parts.push('with', formatLabel(stripBinding(cleaned.with)));
    }
    if (type === 'has_relationship' && typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return [parts.join(' ')];
  }

  if (type === 'has_tag' || type === 'lacks_tag') {
    const tag = cleaned.tag;
    if (typeof tag !== 'string') return null;
    const parts = [`${indent(indentLevel)}${keyword}`, type, formatLabel(tag)];
    if (cleaned.value !== undefined) {
      const valueText = formatInlineValue(cleaned.value);
      if (!valueText) return null;
      parts.push(valueText);
    }
    return [parts.join(' ')];
  }

  if (type === 'has_any_tag' && Array.isArray(cleaned.tags)) {
    const tags = cleaned.tags.map((entry) => formatLabel(String(entry)));
    return [`${indent(indentLevel)}${keyword} has_any_tag ${tags.join(' ')}`];
  }

  if (type === 'matches_culture' || type === 'not_matches_culture') {
    const withValue = cleaned.with;
    if (typeof withValue !== 'string') return null;
    return [`${indent(indentLevel)}${keyword} ${type} ${formatLabel(stripBinding(withValue))}`];
  }

  if (type === 'has_culture' || type === 'not_has_culture') {
    const culture = cleaned.culture;
    if (typeof culture !== 'string') return null;
    return [`${indent(indentLevel)}${keyword} ${type} ${formatLabel(culture)}`];
  }

  return null;
}

function formatGraphPathLines(
  assert: Record<string, unknown>,
  indentLevel: number,
  prefix: string
): string[] | null {
  const check = assert.check;
  const path = assert.path;
  if (typeof check !== 'string' || !Array.isArray(path)) return null;
  const lines: string[] = [];
  lines.push(`${indent(indentLevel)}${prefix} ${check} do`);
  const innerIndent = indentLevel + 1;
  if (typeof assert.count === 'number') {
    lines.push(`${indent(innerIndent)}count ${assert.count}`);
  }
  for (const step of path) {
    const stepLines = formatGraphPathStepLines(step, innerIndent);
    if (!stepLines) return null;
    lines.push(...stepLines);
  }
  if (Array.isArray(assert.where)) {
    for (const constraint of assert.where) {
      const whereLine = formatPathConstraintLine(constraint, innerIndent);
      if (!whereLine) return null;
      lines.push(whereLine);
    }
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatGraphPathStepLines(step: unknown, indentLevel: number): string[] | null {
  if (!isRecord(step)) return null;
  const via = step.via;
  const direction = step.direction;
  const targetKind = step.targetKind;
  const targetSubtype = step.targetSubtype;
  if (typeof direction !== 'string' || typeof targetKind !== 'string' || typeof targetSubtype !== 'string') return null;
  const viaText = formatInlineValue(via);
  if (!viaText) return null;
  const base = `step ${viaText} ${direction} ${formatLabel(targetKind)} ${formatLabel(targetSubtype)}`;
  const status = typeof step.targetStatus === 'string' ? step.targetStatus : null;
  const filters = Array.isArray(step.filters) ? step.filters : null;

  if (!filters || filters.length === 0) {
    const suffix = status ? ` status ${formatLabel(status)}` : '';
    return [`${indent(indentLevel)}${base}${suffix}`];
  }

  const lines = [`${indent(indentLevel)}${base} do`];
  const innerIndent = indentLevel + 1;
  if (status) {
    lines.push(`${indent(innerIndent)}status ${formatLabel(status)}`);
  }
  const filterLines = formatFilterLines(filters, innerIndent, 'filter');
  if (!filterLines) return null;
  lines.push(...filterLines);
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPathConstraintLine(value: unknown, indentLevel: number): string | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const type = cleaned.type;
  if (typeof type !== 'string') return null;

  if (type === 'not_self') {
    return `${indent(indentLevel)}where not_self`;
  }
  if ((type === 'in' || type === 'not_in') && typeof cleaned.set === 'string') {
    return `${indent(indentLevel)}where ${type} ${formatLabel(cleaned.set)}`;
  }
  if ((type === 'has_relationship' || type === 'lacks_relationship')
    && typeof cleaned.kind === 'string'
    && typeof cleaned.with === 'string') {
    const parts = [
      `${indent(indentLevel)}where`,
      type,
      formatLabel(cleaned.kind),
      formatLabel(stripBinding(cleaned.with))
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return parts.join(' ');
  }
  if (type === 'kind_equals' && typeof cleaned.kind === 'string') {
    return `${indent(indentLevel)}where kind ${formatLabel(cleaned.kind)}`;
  }
  if (type === 'subtype_equals' && typeof cleaned.subtype === 'string') {
    return `${indent(indentLevel)}where subtype ${formatLabel(cleaned.subtype)}`;
  }

  return null;
}

function formatSaturationLines(items: unknown[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const kind = cleaned.relationshipKind;
    if (typeof kind !== 'string') return null;
    const fromKind = cleaned.fromKind;
    const maxCount = cleaned.maxCount;
    if (typeof maxCount !== 'number') return null;
    const direction = cleaned.direction;
    let keyword = 'both';
    if (direction === 'in') keyword = 'inbound';
    else if (direction === 'out') keyword = 'outbound';
    else if (direction === 'both' || direction === undefined) keyword = 'both';
    else return null;
    if (typeof fromKind === 'string') {
      lines.push(`${indent(indentLevel)}${keyword} ${kind} ${fromKind} <= ${Math.floor(maxCount)}`);
    } else {
      lines.push(`${indent(indentLevel)}${keyword} ${kind} <= ${Math.floor(maxCount)}`);
    }
  }
  return lines;
}

function formatLetEntry(name: string, value: Record<string, unknown>, indentLevel: number): string[] {
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const label = stripBinding(name);
  const selectValue = cleaned.select;

  if (!isRecord(selectValue)) {
    return formatEntryLineOrBlock('let', [label], cleaned, indentLevel);
  }

  const select = { ...selectValue };
  const lines: string[] = [];
  const header = `${indent(indentLevel)}let ${formatLabel(label)} do`;
  lines.push(header);
  const innerIndent = indentLevel + 1;

  if (select.from !== undefined) {
    if (select.from === 'graph') {
      lines.push(`${indent(innerIndent)}from graph`);
      delete select.from;
    } else if (isRecord(select.from)) {
      const relatedTo = select.from.relatedTo;
      const relationship = select.from.relationshipKind ?? select.from.relationship;
      const direction = select.from.direction;
      if (typeof relatedTo === 'string' && typeof relationship === 'string' && typeof direction === 'string') {
        lines.push(
          `${indent(innerIndent)}from ${formatLabel(stripBinding(relatedTo))} via ${relationship} ${direction}`
        );
        delete select.from;
      }
    }
  }

  if (select.kind !== undefined) {
    pushInlinePairLine(lines, 'kind', select.kind, innerIndent);
    delete select.kind;
  }

  if (select.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', select.kinds, innerIndent);
    delete select.kinds;
  }

  if (Array.isArray(select.subtypes) && select.subtypes.length > 0) {
    if (select.subtypes.length > 1) {
      const inline = formatSetInlineValue(select.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushAttributeLine(lines, 'subtypes', select.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', select.subtypes[0], innerIndent);
    }
    delete select.subtypes;
  }

  if (Array.isArray(select.statuses) && select.statuses.length > 0) {
    if (select.statuses.length > 1) {
      const inline = formatSetInlineValue(select.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushAttributeLine(lines, 'statuses', select.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', select.statuses[0], innerIndent);
    }
    delete select.statuses;
  }

  if (select.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', select.statusFilter, innerIndent);
    delete select.statusFilter;
  }

  const pickStrategy = select.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete select.pickStrategy;

  if (select.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', select.maxResults, innerIndent);
    delete select.maxResults;
  }

  if (select.filters !== undefined) {
    const filterLines = formatFilterLines(select.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', select.filters, innerIndent);
    }
    delete select.filters;
  }

  if (select.preferFilters !== undefined) {
    const preferLines = formatFilterLines(select.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', select.preferFilters, innerIndent);
    }
    delete select.preferFilters;
  }

  for (const [key, entry] of Object.entries(select)) {
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  if (cleaned.required !== undefined) {
    pushInlinePairLine(lines, 'required', cleaned.required, innerIndent);
  }

  for (const [key, entry] of Object.entries(cleaned)) {
    if (key === 'select' || key === 'required') continue;
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatMutationEntries(items: unknown[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    if (item.type !== 'modify_pressure') return null;
    const pressureId = item.pressureId;
    const delta = item.delta;
    if (typeof pressureId !== 'string' || typeof delta !== 'number') return null;
    const operator = delta < 0 ? '-=' : '+=';
    const value = Math.abs(delta);
    lines.push(`${indent(indentLevel)}mutate pressure ${pressureId} ${operator} ${value}`);
  }
  return lines.length > 0 ? lines : null;
}

function pushAttributeLine(lines: string[], key: string, value: unknown, indentLevel: number): void {
  if (SET_FIELD_KEYS.has(key)) {
    const setLine = formatSetFieldLine(key, value, indentLevel);
    if (setLine) {
      lines.push(...setLine);
      return;
    }
  }
  if (value === undefined) return;
  if (isCallValue(value)) {
    const inline = formatCallValue(value);
    if (inline) {
      lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${inline}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    const inline = formatInlineValue(value);
    if (inline) {
      lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${inline}`);
      return;
    }
    for (const entry of value) {
      if (isRecord(entry) && !isCallValue(entry)) {
        const blockLines = formatBlockBody(formatAttributeKey(key), entry, indentLevel);
        if (blockLines) {
          lines.push(...blockLines);
        }
        continue;
      }
      const entryInline = formatInlineValue(entry);
      if (entryInline) {
        lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${entryInline}`);
      }
    }
    return;
  }
  if (isRecord(value) && !isCallValue(value)) {
    const blockLines = formatBlockBody(formatAttributeKey(key), value, indentLevel);
    if (blockLines) {
      lines.push(...blockLines);
    }
    return;
  }
  const inline = formatInlineValue(value);
  if (inline) {
    lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${inline}`);
  }
}

function pushInlinePairLine(lines: string[], key: string, value: unknown, indentLevel: number): void {
  if (SET_FIELD_KEYS.has(key)) {
    const inlineSet = formatSetInlineValue(value);
    if (inlineSet) {
      lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${inlineSet}`);
      return;
    }
  }
  const inline = formatInlineValue(value);
  if (!inline) {
    pushAttributeLine(lines, key, value, indentLevel);
    return;
  }
  lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${inline}`);
}

function formatBlockBody(name: string, body: Record<string, unknown>, indentLevel: number): string[] | null {
  if (!name) return null;
  const header = `${indent(indentLevel)}${name} do`;
  const lines = [header];
  const bodyLines = formatAttributeLines(body, indentLevel + 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatValueLines(value: unknown, indentLevel: number): string[] {
  const inline = formatInlineValue(value);
  if (inline) {
    return [indent(indentLevel) + inline];
  }
  return [];
}

function formatArrayLines(items: unknown[], indentLevel: number): string[] {
  const lines: string[] = [];
  for (const item of items) {
    const inline = formatInlineValue(item);
    if (inline) {
      lines.push(indent(indentLevel) + inline);
    }
  }
  return lines;
}

function formatObjectLines(obj: Record<string, unknown>, indentLevel: number): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    pushAttributeLine(lines, key, value, indentLevel);
  }
  return lines;
}

function formatScalarString(value: string): string {
  if (isIdentifier(value) || isQualifiedIdentifier(value) || isVariableIdentifier(value) || isKindSubtype(value)) {
    return value;
  }
  return quoteString(value);
}

function formatResourceRef(value: string): string {
  return value.endsWith('.id') ? value : `${value}.id`;
}

function formatResourceRefValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return formatResourceRef(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === 'string' ? formatResourceRef(entry) : entry));
  }
  return value;
}

function formatAttributeKey(key: string): string {
  if (isIdentifier(key)) return key;
  return quoteString(key);
}

function formatObjectKey(key: string): string {
  if (isIdentifier(key)) return key;
  return quoteString(key);
}

function formatLabel(value: string): string {
  if (isIdentifier(value) || isQualifiedIdentifier(value) || isVariableIdentifier(value)) return value;
  return quoteString(value);
}

function formatCreationEntries(items: unknown[], indentLevel: number): string[] | null {
  if (items.length === 0) return null;
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const entityRef = cleaned.entityRef;
    if (typeof entityRef !== 'string') return null;
    const body = { ...cleaned };
    delete body.entityRef;
    lines.push(...formatEntryLineOrBlock('create', [stripBinding(entityRef)], body, indentLevel));
  }
  return lines;
}

function formatRelationshipEntries(items: unknown[], indentLevel: number): string[] | null {
  if (items.length === 0) return null;
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const kind = cleaned.kind;
    const src = cleaned.src;
    const dst = cleaned.dst;
    if (typeof kind !== 'string' || typeof src !== 'string' || typeof dst !== 'string') return null;
    const body = { ...cleaned };
    delete body.kind;
    delete body.src;
    delete body.dst;
    const pairs = formatInlinePairs(body);
    const formattedSrc = stripBinding(src);
    const formattedDst = stripBinding(dst);
    if (pairs !== null) {
      const prefix = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} -> ${formatLabel(formattedDst)}`;
      lines.push(pairs ? `${prefix} ${pairs}` : prefix);
      continue;
    }
    const header = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} ${formatLabel(formattedDst)} do`;
    const blockLines = [header];
    const bodyLines = formatAttributeLines(body, indentLevel + 1);
    if (bodyLines.length > 0) {
      blockLines.push(...bodyLines);
    }
    blockLines.push(`${indent(indentLevel)}end`);
    lines.push(...blockLines);
  }
  return lines;
}

function formatVariableEntries(vars: Record<string, unknown> | undefined, indentLevel: number): string[] | null {
  if (!vars || !isRecord(vars)) return null;
  const rawEntries = Object.entries(vars);
  if (rawEntries.some(([, value]) => !isRecord(value))) return null;
  const entries = rawEntries as Array<[string, Record<string, unknown>]>;
  if (entries.length === 0) return null;
  const lines: string[] = [];
  for (const [name, value] of orderVariableEntries(entries)) {
    lines.push(...formatLetEntry(name, value, indentLevel));
  }
  return lines;
}

function orderVariableEntries(
  entries: Array<[string, Record<string, unknown>]>
): Array<[string, Record<string, unknown>]> {
  const names = entries.map(([name]) => name);
  const entryByName = new Map(entries);
  const nameSet = new Set(names);
  const orderIndex = new Map(names.map((name, index) => [name, index]));

  const deps = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const [name, value] of entries) {
    const refs = collectVariableRefs(value);
    const filtered = new Set(
      Array.from(refs).filter((ref) => ref !== name && nameSet.has(ref))
    );
    deps.set(name, filtered);
    for (const ref of filtered) {
      if (!dependents.has(ref)) dependents.set(ref, new Set());
      dependents.get(ref)?.add(name);
    }
  }

  const remainingDeps = new Map<string, Set<string>>();
  for (const [name, set] of deps) {
    remainingDeps.set(name, new Set(set));
  }

  const ready = names.filter((name) => (remainingDeps.get(name)?.size ?? 0) === 0);
  ready.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));

  const orderedNames: string[] = [];
  while (ready.length > 0) {
    const name = ready.shift();
    if (!name) break;
    orderedNames.push(name);
    const dependentsFor = dependents.get(name);
    if (!dependentsFor) continue;
    for (const dependent of dependentsFor) {
      const set = remainingDeps.get(dependent);
      if (!set) continue;
      set.delete(name);
      if (set.size === 0) {
        ready.push(dependent);
        ready.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
      }
    }
  }

  if (orderedNames.length < names.length) {
    for (const name of names) {
      if (!orderedNames.includes(name)) orderedNames.push(name);
    }
  }

  return orderedNames
    .map((name) => {
      const entry = entryByName.get(name);
      return entry ? [name, entry] as [string, Record<string, unknown>] : null;
    })
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry));
}

function collectVariableRefs(value: unknown): Set<string> {
  const refs = new Set<string>();
  const visit = (entry: unknown) => {
    if (typeof entry === 'string') {
      const ref = extractVariableRef(entry);
      if (ref) refs.add(ref);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (isRecord(entry)) {
      for (const [key, val] of Object.entries(entry)) {
        const keyRef = extractVariableRef(key);
        if (keyRef) refs.add(keyRef);
        visit(val);
      }
    }
  };
  visit(value);
  return refs;
}

function extractVariableRef(value: string): string | null {
  if (!VARIABLE_RE.test(value)) return null;
  const base = value.slice(1).split('.')[0];
  if (!base) return null;
  return `$${base}`;
}

function formatApplicabilityEntries(items: unknown[], indentLevel: number): string[] | null {
  if (items.length === 0) return null;
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const type = cleaned.type;
    if (typeof type !== 'string') return null;
    const body = { ...cleaned };
    delete body.type;
    lines.push(...formatEntryLineOrBlock('applicability', [type], body, indentLevel));
  }
  return lines;
}

function formatEntryLineOrBlock(
  keyword: string,
  labels: string[],
  body: Record<string, unknown>,
  indentLevel: number
): string[] {
  const pairs = formatInlinePairs(body);
  if (pairs !== null) {
    const labelText = labels.map(formatLabel).join(' ');
    const content = `${keyword}${labelText ? ' ' + labelText : ''}${pairs ? ' ' + pairs : ''}`;
    return [indent(indentLevel) + content];
  }

  const header = `${indent(indentLevel)}${keyword}${labels.length ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const bodyLines = formatAttributeLines(body, indentLevel + 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatInlinePairs(body: Record<string, unknown>): string | null {
  const entries = Object.entries(body).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '';
  const parts: string[] = [];
  for (const [key, value] of entries) {
    if (SET_FIELD_KEYS.has(key)) return null;
    if (Array.isArray(value)) return null;
    if (isRecord(value) && !isCallValue(value)) return null;
    const inlineValue = formatInlineValue(value);
    if (!inlineValue) return null;
    parts.push(`${formatAttributeKey(key)} ${inlineValue}`);
  }
  return parts.join(' ');
}

function isInlineFriendlyObject(value: Record<string, unknown>): boolean {
  return Object.values(value).every(entry => isInlineFriendlyValue(entry));
}

function isInlineFriendlyValue(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (isCallValue(value)) return true;
  if (Array.isArray(value)) {
    return value.every(entry => isInlineFriendlyValue(entry));
  }
  return false;
}

function formatInlineValue(value: unknown): string | null {
  if (value === null) return 'null';
  if (isCallValue(value)) return formatCallValue(value);
  if (typeof value === 'string') return formatScalarString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const parts = value.map(item => formatInlineValue(item));
    if (parts.some(part => part === null)) return null;
    return parts.join(' ');
  }
  return null;
}

function stripBinding(value: string): string {
  if (VARIABLE_RE.test(value)) {
    return value.slice(1);
  }
  return value;
}

function cloneAndStripRefs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => cloneAndStripRefs(entry));
  }
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'replacements' && isRecord(entry)) {
      const replacements: Record<string, unknown> = {};
      for (const [repKey, repValue] of Object.entries(entry)) {
        if (typeof repValue === 'string') {
          replacements[repKey] = stripBinding(repValue);
        } else {
          replacements[repKey] = cloneAndStripRefs(repValue);
        }
      }
      result[key] = replacements;
      continue;
    }

    if (REF_KEYS.has(key) && typeof entry === 'string') {
      result[key] = stripBinding(entry);
      continue;
    }

    if (REF_LIST_KEYS.has(key) && Array.isArray(entry)) {
      result[key] = entry.map((item) => {
        if (typeof item === 'string') return stripBinding(item);
        return cloneAndStripRefs(item);
      });
      continue;
    }

    result[key] = cloneAndStripRefs(entry);
  }
  return result;
}

function quoteString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`;
}

function indent(level: number): string {
  return INDENT.repeat(level);
}

function isIdentifier(value: string): boolean {
  return IDENTIFIER_RE.test(value) && !KEYWORDS.has(value);
}

function isQualifiedIdentifier(value: string): boolean {
  if (!QUALIFIED_IDENTIFIER_RE.test(value)) return false;
  return value.split('.').every(segment => isIdentifier(segment));
}

function isKindSubtype(value: string): boolean {
  if (!KIND_SUBTYPE_RE.test(value)) return false;
  const [left, right] = value.split(':');
  return isIdentifier(left) && isIdentifier(right);
}

function isVariableIdentifier(value: string): boolean {
  return VARIABLE_RE.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCallValue(value: unknown): value is { type: 'call'; name: string; args: unknown[] } {
  return isRecord(value)
    && value.type === 'call'
    && typeof value.name === 'string'
    && Array.isArray(value.args);
}

function formatCallValue(value: { name: string; args: unknown[] }): string | null {
  if (value.args.some((arg) => Array.isArray(arg))) return null;
  const args = value.args.map((arg) => formatInlineValue(arg));
  if (args.some((arg) => arg === null)) return null;
  return `${value.name}(${args.join(' ')})`;
}

function normalizeStaticPageDir(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.replace(/[\\/]+/g, '/').replace(/^\/+|\/+$/g, '');
}

function generateStaticPageSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function resolveStaticPageFilename(slug: string, used: Set<string>): string {
  const base = slug && slug.length > 0 ? slug : 'page';
  let name = `${base}.md`;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}-${suffix}.md`;
    suffix += 1;
  }
  used.add(name);
  return name;
}
