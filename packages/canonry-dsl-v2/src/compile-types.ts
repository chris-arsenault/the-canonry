import type {
  BlockNode,
  Diagnostic,
  Value,
  ObjectValue,
  ArrayValue,
  IdentifierValue,
  CallValue,
  StatementNode,
  AttributeNode,
  AstFile,
} from './types.js';

export interface SourceFile {
  path: string;
  content: string;
}

export interface BlockMapping {
  target: string;
  idKey?: string;
  nameKey?: string;
  singleton?: boolean;
  mergeIntoRoot?: boolean;
  sortKey?: (item: Record<string, unknown>) => string;
  buildItem?: (block: BlockNode, diagnostics: Diagnostic[]) => Record<string, unknown> | null;
}

export const DEFAULT_SORT = (key?: string) => (item: Record<string, unknown>) => {
  if (!key) return '';
  const value = item[key];
  return typeof value === 'string' ? value : '';
};

export const CONTAINER_ALIASES: Record<string, string> = {
  generators: 'generator',
  actions: 'action',
  pressures: 'pressure',
  eras: 'era',
  entity_kinds: 'entity_kind',
  relationship_kinds: 'relationship_kind',
  cultures: 'culture',
  tags: 'tag',
  axes: 'axis',
  systems: 'system',
  seed_entities: 'seed_entity',
  seed_relationships: 'seed_relationship'
};

export const INLINE_ITEM_KEYS = new Set([
  'axis',
  'entity_kind',
  'relationship_kind',
  'tag',
  'seed_relationship'
]);

export interface VariableEntry {
  name: string;
  value: Value;
  span: BlockNode['span'];
}

export interface ResourceEntry {
  name: string;
  id: string;
  type: string;
  span: BlockNode['span'];
}

export interface SetDefinition {
  name: string;
  items: string[];
  includes: string[];
  span: BlockNode['span'];
}

export const RESOURCE_BLOCKS = new Set([
  'entity_kind',
  'relationship_kind',
  'era',
  'culture',
  'axis',
  'tag',
  'pressure',
  'region',
  'domain',
  'grammar',
  'profile',
  'lexeme_spec',
  'lexeme',
  'lexeme_list'
]);

export const SET_FIELD_KEYS = new Set([
  'tags',
  'links',
  'linkedEntityIds',
  'avoidRefs',
  'kinds',
  'entityKinds',
  'favored_clusters',
  'forbidden_clusters',
  'subtypes',
  'statuses',
  'excludeSubtypes',
  'excludeStatuses',
  'subtypePreferences',
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
  'srcKinds',
  'dstKinds',
  'culture_id',
  'cultureId'
]);

export const VARIABLE_BLOCK_NAMES = new Set(['vars', 'locals']);
export const VARIABLE_ATTRIBUTE_KEYS = new Set(['var', 'variable']);
export const VARIABLE_REFERENCE_PREFIXES = ['var.', 'vars.', 'local.'];
export const NAMING_RESOURCE_BLOCKS = new Set([
  'domain',
  'grammar',
  'profile',
  'lexeme_spec',
  'lexeme_list',
  'lexeme'
]);

export interface EvalContext {
  variables: Map<string, VariableEntry>;
  resources: Map<string, ResourceEntry[]>;
  sets: Map<string, string[]>;
  resolved: Map<string, unknown>;
  resolving: Set<string>;
  diagnostics: Diagnostic[];
}

export interface NamingResourceEntry {
  item: Record<string, unknown>;
  cultures: string[];
  span: BlockNode['span'];
}

export interface NamingResourceCollection {
  domains: NamingResourceEntry[];
  grammars: NamingResourceEntry[];
  profiles: NamingResourceEntry[];
  lexemeSpecs: NamingResourceEntry[];
  lexemeLists: NamingResourceEntry[];
}

export interface SystemParseResult {
  config: Record<string, unknown>;
  enabled?: unknown;
}

export const SYSTEM_BINDINGS = [
  'self',
  'partner',
  'member',
  'member2',
  'source',
  'target',
  'contagion_source',
  'related',
  'meta'
];

export const SYSTEM_CONDITION_KEYS = new Set([
  'condition',
  'pressure',
  'cap',
  'entity_count',
  'tag_exists',
  'lacks_tag',
  'relationship_exists',
  'relationship_count',
  'random_chance',
  'time_elapsed',
  'growth_phases_complete',
  'prominence',
  'entity_exists',
  'not_self',
  'era_match'
]);

export const SYSTEM_OPERATOR_KEYWORDS = new Set(['gt', 'gte', 'lt', 'lte', 'eq', 'between', '>', '>=', '<', '<=', '==']);

export interface GeneratorContext {
  bindings: Map<string, string>;
  diagnostics: Diagnostic[];
  parent: BlockNode;
  selectionDefined: boolean;
  targetAlias?: string;
}

export const DSL_BLOCK_NAMES = new Set(['when', 'choose', 'let', 'constraints', 'mutate', 'stateUpdates']);

export interface ActionContext extends GeneratorContext {
  actorDefined: boolean;
  targetDefined: boolean;
  instigatorDefined: boolean;
}

export const ACTION_DSL_BLOCKS = new Set(['actor', 'target', 'targeting', 'on', 'mutate']);
export const ACTION_DSL_ATTRIBUTES = new Set([
  'narrative',
  'success_chance',
  'weight',
  'pressure_modifier',
  'prominence'
]);
