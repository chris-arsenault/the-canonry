/**
 * Schema Usage Map - Computes bidirectional reference tracking across all config elements
 *
 * This utility analyzes the relationships between:
 * - Schema (entity kinds, relationship kinds, statuses, subtypes, tags)
 * - Pressures (and their feedback factors)
 * - Eras (and their generator/system weights)
 * - Generators (and their entity/relationship references)
 * - Systems (and their entity/relationship/pressure references)
 * - Actions (and their actor/target/outcome references)
 *
 * Returns a comprehensive map showing:
 * 1. Where each element is used (forward references)
 * 2. What each element references (backward references)
 * 3. Validation status for each reference
 */

// ---------------------------------------------------------------------------
// Domain model interfaces
//
// These describe the shapes of JSON config objects as consumed by this module.
// The shapes are intentionally structural: they only declare the fields that
// the usage-map scanner actually reads, with everything else captured by an
// index signature typed as `unknown`.
// ---------------------------------------------------------------------------

/** String-or-object subtype/status entries in entity kind definitions. */
import type { Optional } from '../types/optionality.js';

interface SubtypeEntry {
  id: string;
  [key: string]: unknown;
}

interface StatusEntry {
  id: string;
  [key: string]: unknown;
}

/** An entity kind definition from the schema. */
interface SchemaEntityKind {
  kind: string;
  subtypes: Optional<Array<string | SubtypeEntry>>;
  statuses: Optional<Array<string | StatusEntry>>;
  [key: string]: unknown;
}

/** A relationship kind definition from the schema. */
interface SchemaRelationshipKind {
  kind: string;
  srcKinds: Optional<string[]>;
  dstKinds: Optional<string[]>;
  [key: string]: unknown;
}

/** A tag registry entry (string or object with `.tag`). */
interface TagRegistryEntry {
  tag: string;
  [key: string]: unknown;
}

/** The top-level schema object. */
interface SchemaConfig {
  entityKinds: Optional<SchemaEntityKind[]>;
  relationshipKinds: Optional<SchemaRelationshipKind[]>;
  tagRegistry: Optional<Array<string | TagRegistryEntry>>;
  [key: string]: unknown;
}

/** A feedback factor within a pressure's growth config. */
interface FeedbackFactor {
  type: Optional<string>;
  kind: Optional<string>;
  relationshipKinds: Optional<string[]>;
  tag: Optional<string>;
  tags: Optional<string[]>;
  [key: string]: unknown;
}

/** A pressure config object. */
interface PressureConfig {
  id: string;
  name: Optional<string>;
  homeostasis: Optional<number>;
  growth: Optional<{
    positiveFeedback: Optional<FeedbackFactor[]>;
    negativeFeedback: Optional<FeedbackFactor[]>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/** A mutation entry used in effects / outcomes. */
interface MutationEntry {
  type: Optional<string>;
  tag: Optional<string>;
  kind: Optional<string>;
  relationshipKind: Optional<string>;
  newStatus: Optional<string>;
  pressureId: Optional<string>;
  src: Optional<string>;
  dst: Optional<string>;
  [key: string]: unknown;
}

/** Entry/exit effects on an era. */
interface EraEffects {
  mutations: Optional<MutationEntry[]>;
  [key: string]: unknown;
}

/** An era config object. */
interface EraConfig {
  id: string;
  name: Optional<string>;
  templateWeights: Optional<Record<string, unknown>>;
  systemModifiers: Optional<Record<string, unknown>>;
  entryEffects: Optional<EraEffects>;
  exitEffects: Optional<EraEffects>;
  [key: string]: unknown;
}

/** A graph-path step within an assertion. */
interface GraphPathStep {
  via: Optional<string | string[]>;
  targetKind: Optional<string>;
  targetSubtype: Optional<string>;
  targetStatus: Optional<string>;
  [key: string]: unknown;
}

/** A where-constraint in a graph path assertion. */
interface WhereConstraint {
  type: Optional<string>;
  kind: Optional<string>;
  subtype: Optional<string>;
  [key: string]: unknown;
}

/** A graph-path assertion (used in conditions and filters). */
interface GraphPathAssertion {
  path: Optional<GraphPathStep[]>;
  where: Optional<WhereConstraint[]>;
  [key: string]: unknown;
}

/** A selection filter entry. */
interface SelectionFilter {
  type: Optional<string>;
  kind: Optional<string>;
  relationshipKind: Optional<string>;
  tag: Optional<string>;
  tags: Optional<string[]>;
  status: Optional<string>;
  assert: Optional<GraphPathAssertion | null>;
  [key: string]: unknown;
}

/** A saturation limit within a selection rule. */
interface SaturationLimit {
  relationshipKind: string;
  fromKind: Optional<string>;
  [key: string]: unknown;
}

/** A selection rule describing target criteria. */
interface SelectionRule {
  kind: Optional<string>;
  kinds: Optional<string[]>;
  subtypes: Optional<string[]>;
  excludeSubtypes: Optional<string[]>;
  status: Optional<string>;
  statuses: Optional<string[]>;
  notStatus: Optional<string>;
  relationshipKind: Optional<string>;
  filters: Optional<SelectionFilter[]>;
  saturationLimits: Optional<SaturationLimit[]>;
  [key: string]: unknown;
}

/** A "from" clause within a variable selection rule. */
interface VariableFromClause {
  relationshipKind: Optional<string>;
  [key: string]: unknown;
}

/** A variable selection rule (superset of selection with `from` and `preferFilters`). */
interface VariableSelectionRule {
  from: Optional<VariableFromClause | string>;
  kind: Optional<string>;
  kinds: Optional<string[]>;
  subtypes: Optional<string[]>;
  status: Optional<string>;
  statuses: Optional<string[]>;
  notStatus: Optional<string>;
  filters: Optional<SelectionFilter[]>;
  preferFilters: Optional<SelectionFilter[]>;
  [key: string]: unknown;
}

/** A condition entry (used in applicability, thresholds, etc.). */
interface ConditionEntry {
  type: Optional<string>;
  pressureId: Optional<string>;
  pressureIds: Optional<string[]>;
  pressureA: Optional<string>;
  pressureB: Optional<string>;
  kind: Optional<string>;
  subtype: Optional<string>;
  status: Optional<string>;
  relationshipKind: Optional<string>;
  targetKind: Optional<string>;
  targetSubtype: Optional<string>;
  targetStatus: Optional<string>;
  tag: Optional<string>;
  assert: Optional<GraphPathAssertion | null>;
  conditions: Optional<ConditionEntry[]>;
  [key: string]: unknown;
}

/** A metric definition (used in evolution systems, feedback, etc.). */
interface MetricEntry {
  type: Optional<string>;
  kind: Optional<string>;
  subtype: Optional<string>;
  status: Optional<string>;
  relationshipKinds: Optional<string[]>;
  tags: Optional<string[]>;
  numerator: Optional<MetricEntry | null>;
  denominator: Optional<MetricEntry | null>;
  aliveStatus: Optional<string>;
  sharedRelationshipKind: Optional<string>;
  via: Optional<string | string[]>;
  then: Optional<string>;
  [key: string]: unknown;
}

/** A relationship entry within a generator creation or variant. */
interface RelationshipEntry {
  kind: string;
  [key: string]: unknown;
}

/** A random subtype wrapper. */
interface RandomSubtype {
  random: string[];
  [key: string]: unknown;
}

/** A creation entry within a generator. */
interface CreationEntry {
  kind: Optional<string>;
  subtype: Optional<string | RandomSubtype>;
  status: Optional<string>;
  tags: Optional<Record<string, string>>;
  [key: string]: unknown;
}

/** Apply block within a generator variant. */
interface VariantApply {
  relationships: Optional<RelationshipEntry[]>;
  tags: Optional<Record<string, Record<string, string>>>;
  stateUpdates: Optional<MutationEntry[]>;
  [key: string]: unknown;
}

/** A variant option in a generator. */
interface VariantOption {
  when: Optional<ConditionEntry | null>;
  apply: Optional<VariantApply>;
  [key: string]: unknown;
}

/** A generator's variables entry. */
interface GeneratorVariable {
  select: Optional<VariableSelectionRule>;
  [key: string]: unknown;
}

/** A generator config object. */
interface GeneratorConfig {
  id: string;
  name: Optional<string>;
  applicability: Optional<ConditionEntry[]>;
  selection: Optional<SelectionRule>;
  variables: Optional<Record<string, GeneratorVariable>>;
  creation: Optional<CreationEntry[]>;
  relationships: Optional<RelationshipEntry[]>;
  stateUpdates: Optional<MutationEntry[]>;
  variants: Optional<{
    options: Optional<VariantOption[]>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/** A phase transition in a contagion system. */
interface PhaseTransition {
  selection: Optional<SelectionRule>;
  toStatus: Optional<string>;
  [key: string]: unknown;
}

/** A contagion config within a system. */
interface ContagionConfig {
  type: Optional<string>;
  relationshipKind: Optional<string>;
  tagPattern: Optional<string>;
  [key: string]: unknown;
}

/** A vector within a contagion system. */
interface ContagionVector {
  relationshipKind: string;
  [key: string]: unknown;
}

/** Multi-source configuration in contagion systems. */
interface MultiSourceConfig {
  sourceSelection: Optional<SelectionRule>;
  immunityTagPrefix: Optional<string>;
  [key: string]: unknown;
}

/** A clustering criterion. */
interface ClusteringCriterion {
  type: Optional<string>;
  relationshipKind: Optional<string>;
  [key: string]: unknown;
}

/** A meta-entity config within cluster formation. */
interface MetaEntityConfig {
  kind: Optional<string>;
  additionalTags: Optional<string[]>;
  [key: string]: unknown;
}

/** Post-process config within cluster formation. */
interface PostProcessConfig {
  pressureChanges: Optional<Record<string, unknown>>;
  governanceRelationship: Optional<string>;
  governanceFactionSubtype: Optional<string>;
  [key: string]: unknown;
}

/** Tag diffusion convergence/divergence config. */
interface TagDiffusionTagList {
  tags: Optional<string[]>;
  [key: string]: unknown;
}

/** Tag diffusion divergence pressure config. */
interface DivergencePressureConfig {
  pressureName: Optional<string>;
  [key: string]: unknown;
}

/** Source/sink config for plane diffusion. */
interface PlaneDiffusionEndpoint {
  tagFilter: Optional<string>;
  strengthTag: Optional<string>;
  [key: string]: unknown;
}

/** Output tag config in plane diffusion. */
interface PlaneDiffusionOutputTag {
  tag: string;
  [key: string]: unknown;
}

/** A subtype bonus within an evolution system. */
interface SubtypeBonus {
  subtype: string;
  [key: string]: unknown;
}

/** An evolution rule. */
interface EvolutionRule {
  action: Optional<MutationEntry>;
  [key: string]: unknown;
}

/** Inner config block for a system definition. */
interface SystemInnerConfig {
  id: string;
  name: Optional<string>;
  selection: Optional<SelectionRule>;
  pressureChanges: Optional<Record<string, unknown>>;
  // Contagion system fields
  contagion: Optional<ContagionConfig>;
  vectors: Optional<ContagionVector[]>;
  infectionAction: Optional<MutationEntry>;
  phaseTransitions: Optional<PhaseTransition[]>;
  multiSource: Optional<MultiSourceConfig>;
  // Evolution system fields
  subtypeBonuses: Optional<SubtypeBonus[]>;
  metric: Optional<MetricEntry>;
  rules: Optional<EvolutionRule[]>;
  // Threshold system fields
  conditions: Optional<ConditionEntry[]>;
  actions: Optional<MutationEntry[]>;
  clusterRelationshipKind: Optional<string>;
  // Cluster formation fields
  clustering: Optional<{ criteria: Optional<ClusteringCriterion[]>; [key: string]: unknown }>;
  metaEntity: Optional<MetaEntityConfig>;
  postProcess: Optional<PostProcessConfig>;
  // Tag diffusion fields
  connectionKind: Optional<string>;
  convergence: Optional<TagDiffusionTagList>;
  divergence: Optional<TagDiffusionTagList>;
  divergencePressure: Optional<DivergencePressureConfig>;
  // Plane diffusion fields
  sources: Optional<PlaneDiffusionEndpoint>;
  sinks: Optional<PlaneDiffusionEndpoint>;
  outputTags: Optional<PlaneDiffusionOutputTag[]>;
  valueTag: Optional<string>;
  [key: string]: unknown;
}

/** A system config object (wraps inner config with systemType). */
interface SystemConfig {
  systemType: string;
  config: SystemInnerConfig;
  [key: string]: unknown;
}

/** A pressure modifier within an action's probability. */
interface PressureModifier {
  pressure: Optional<string>;
  [key: string]: unknown;
}

/** An action config object. */
interface ActionConfig {
  id: string;
  name: Optional<string>;
  actor: Optional<{
    selection: Optional<SelectionRule>;
    conditions: Optional<ConditionEntry[]>;
    instigator: Optional<VariableSelectionRule>;
    [key: string]: unknown;
  }>;
  targeting: Optional<SelectionRule>;
  outcome: Optional<{
    mutations: Optional<MutationEntry[]>;
    [key: string]: unknown;
  }>;
  probability: Optional<{
    pressureModifiers: Optional<PressureModifier[]>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Usage map output types
// ---------------------------------------------------------------------------

/** A reference entry stored in usage tracking arrays (e.g. { id, name }). */
interface Ref {
  id: string;
  name: Optional<string>;
  [key: string]: unknown;
}

/** Context passed alongside invalid-reference recording. */
interface RefInfo {
  type: string;
  id: string;
  field: string;
  location: Optional<string>;
}

/** A single invalid reference found during scanning. */
export interface InvalidRef {
  type: string;
  id: string;
  field: string;
  refType: string;
  refId: string;
  location: Optional<string>;
}

/** An orphaned element (unused). */
export interface Orphan {
  type: string;
  id: string;
  reason: string;
}

/** A compatibility issue found during checking. */
export interface CompatibilityIssue {
  type: string;
  id: string;
  field: string;
  issue: string;
}

export interface ValidationResults {
  invalidRefs: InvalidRef[];
  orphans: Orphan[];
  compatibility: CompatibilityIssue[];
}

export interface ElementUsage {
  generators: Ref[];
  systems: Ref[];
  actions: Ref[];
  pressures: Ref[];
  [key: string]: Ref[] | string[];
}

export interface UsageMap {
  entityKinds: Partial<Record<string, ElementUsage>>;
  subtypes: Partial<Record<string, { generators: Ref[]; systems: Ref[]; actions: Ref[] }>>;
  statuses: Partial<Record<string, { generators: Ref[]; systems: Ref[]; actions: Ref[] }>>;
  relationshipKinds: Partial<Record<string, ElementUsage & { srcKinds: string[]; dstKinds: string[] }>>;
  tags: Partial<Record<string, Record<string, Ref[]>>>;
  pressures: Partial<Record<string, { generators: Ref[]; systems: Ref[]; actions: Ref[]; eras: Ref[]; feedbackSources: FeedbackFactor[]; feedbackSinks: FeedbackFactor[] }>>;
  generators: Partial<Record<string, { eras: Ref[] }>>;
  systems: Partial<Record<string, { eras: Ref[] }>>;
  validation: ValidationResults;
}

export interface ElementValidationResult {
  isValid: boolean;
  invalidRefs: InvalidRef[];
  compatibility: CompatibilityIssue[];
  isOrphan: boolean;
}

/**
 * Compute complete usage map for all schema elements
 */
export function computeUsageMap(
  schema: SchemaConfig,
  pressures: PressureConfig[],
  eras: EraConfig[],
  generators: GeneratorConfig[],
  systems: SystemConfig[],
  actions: ActionConfig[],
): UsageMap {
  const usageMap: UsageMap = {
    // Schema element usage tracking
    entityKinds: {},      // { kindId: { generators: [], systems: [], actions: [], pressures: [] } }
    subtypes: {},         // { subtype: { generators: [], systems: [], actions: [] } }
    statuses: {},         // { status: { generators: [], systems: [], actions: [] } }
    relationshipKinds: {},// { kindId: { generators: [], systems: [], actions: [], pressures: [] } }
    tags: {},             // { tag: { pressures: [], systems: [], generators: [], actions: [] } }

    // Cross-tab reference tracking
    pressures: {},        // { pressureId: { generators: [], systems: [], actions: [], eras: [] } }
    generators: {},       // generatorId -> eras with id and weight
    systems: {},          // systemId -> eras with id and weight

    // Validation results
    validation: {
      invalidRefs: [],    // [{ type, id, field, refType, refId, location }]
      orphans: [],        // [{ type, id, reason }]
      compatibility: [],  // [{ type, id, field, issue }]
    }
  };

  // Initialize from schema
  initializeFromSchema(usageMap, schema);

  // Initialize pressure tracking
  initializePressures(usageMap, pressures);

  // Initialize generator/system tracking
  initializeGeneratorsAndSystems(usageMap, generators, systems);

  // Scan pressures for schema references
  scanPressureReferences(usageMap, pressures);

  // Scan eras for generator/system references
  scanEraReferences(usageMap, eras, generators, systems);

  // Scan generators for all references
  scanGeneratorReferences(usageMap, generators, pressures);

  // Scan systems for all references
  scanSystemReferences(usageMap, systems, pressures);

  // Scan actions for all references
  scanActionReferences(usageMap, actions, pressures);

  // Detect orphans (unused elements)
  detectOrphans(usageMap, pressures);

  // Check relationship compatibility
  checkRelationshipCompatibility(usageMap, generators, actions, schema);

  return usageMap;
}

function initializeFromSchema(usageMap: UsageMap, schema: SchemaConfig): void {
  // Entity kinds
  (schema.entityKinds ?? []).forEach(ek => {
    usageMap.entityKinds[ek.kind] = { generators: [], systems: [], actions: [], pressures: [] };

    // Subtypes
    (ek.subtypes ?? []).forEach(st => {
      const subtypeId = typeof st === 'string' ? st : st.id;
      if (!usageMap.subtypes[subtypeId]) {
        usageMap.subtypes[subtypeId] = { generators: [], systems: [], actions: [] };
      }
    });

    // Statuses
    (ek.statuses ?? []).forEach(s => {
      const statusId = typeof s === 'string' ? s : s.id;
      if (!usageMap.statuses[statusId]) {
        usageMap.statuses[statusId] = { generators: [], systems: [], actions: [] };
      }
    });
  });

  // Relationship kinds
  (schema.relationshipKinds ?? []).forEach(rk => {
    usageMap.relationshipKinds[rk.kind] = {
      generators: [],
      systems: [],
      actions: [],
      pressures: [],
      srcKinds: rk.srcKinds ?? [],
      dstKinds: rk.dstKinds ?? [],
    };
  });

  // Tags (from tag registry if available)
  (schema.tagRegistry ?? []).forEach(t => {
    const tagId = typeof t === 'string' ? t : t.tag;
    ensureTagEntry(usageMap, tagId);
  });
}

function initializePressures(usageMap: UsageMap, pressures: PressureConfig[]): void {
  pressures.forEach(p => {
    usageMap.pressures[p.id] = { generators: [], systems: [], actions: [], eras: [], feedbackSources: [], feedbackSinks: [] };
  });
}

function initializeGeneratorsAndSystems(usageMap: UsageMap, generators: GeneratorConfig[], systems: SystemConfig[]): void {
  generators.forEach(g => {
    usageMap.generators[g.id] = { eras: [] };
  });

  systems.forEach(s => {
    const sysId = s.config.id;
    usageMap.systems[sysId] = { eras: [] };
  });
}

function normalizeTagId(tag: unknown): string {
  if (!tag) return '';
  if (typeof tag === 'string') return tag;
  if (typeof tag === 'object') {
    const tagObj = tag as Record<string, unknown>;
    if (typeof tagObj.tag === 'string') return tagObj.tag;
    if (typeof tagObj.id === 'string') return tagObj.id;
  }
  // At this point tag is a non-string, non-object truthy value (number, boolean, etc.)
  return `${tag as string | number | boolean}`;
}

function ensureTagEntry(usageMap: UsageMap, tag: unknown): string {
  const tagId = normalizeTagId(tag);
  if (!tagId) return '';
  if (!usageMap.tags[tagId] || typeof usageMap.tags[tagId] !== 'object') {
    usageMap.tags[tagId] = {};
  }
  const entry = usageMap.tags[tagId];
  if (!Array.isArray(entry.pressures)) entry.pressures = [];
  if (!Array.isArray(entry.systems)) entry.systems = [];
  if (!Array.isArray(entry.generators)) entry.generators = [];
  if (!Array.isArray(entry.actions)) entry.actions = [];
  return tagId;
}

function recordEntityKindRef(usageMap: UsageMap, kind: string, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!kind || kind === 'any') return;
  if (usageMap.entityKinds[kind]) {
    (usageMap.entityKinds[kind][contextKey] as Ref[]).push(ref);
  } else {
    usageMap.validation.invalidRefs.push({
      type: info.type,
      id: info.id,
      field: info.field,
      refType: 'entityKind',
      refId: kind,
      location: info.location,
    });
  }
}

function recordRelationshipKindRef(usageMap: UsageMap, kind: string, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!kind) return;
  if (usageMap.relationshipKinds[kind]) {
    (usageMap.relationshipKinds[kind][contextKey] as Ref[]).push(ref);
  } else {
    usageMap.validation.invalidRefs.push({
      type: info.type,
      id: info.id,
      field: info.field,
      refType: 'relationshipKind',
      refId: kind,
      location: info.location,
    });
  }
}

function recordPressureRef(usageMap: UsageMap, pressureIds: Set<string>, pressureId: string, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!pressureId) return;
  const pressureEntry = usageMap.pressures[pressureId];
  if (pressureEntry) {
    const arr = pressureEntry[contextKey as keyof typeof pressureEntry];
    if (Array.isArray(arr)) {
      (arr as Ref[]).push(ref);
    }
  }
  if (!pressureIds.has(pressureId)) {
    usageMap.validation.invalidRefs.push({
      type: info.type,
      id: info.id,
      field: info.field,
      refType: 'pressure',
      refId: pressureId,
      location: info.location,
    });
  }
}

function recordTagRef(usageMap: UsageMap, tag: unknown, contextKey: string, ref: Ref): void {
  const tagId = ensureTagEntry(usageMap, tag);
  if (!tagId) return;
  if (!Array.isArray(usageMap.tags[tagId][contextKey])) {
    usageMap.tags[tagId][contextKey] = [];
  }
  usageMap.tags[tagId][contextKey].push(ref);
}

function recordSubtypeRef(usageMap: UsageMap, subtype: string, contextKey: string, ref: Ref): void {
  if (!subtype) return;
  const subtypeEntry = usageMap.subtypes[subtype];
  if (subtypeEntry) {
    const arr = subtypeEntry[contextKey as keyof typeof subtypeEntry];
    if (Array.isArray(arr)) {
      arr.push(ref);
    }
  }
}

function recordStatusRef(usageMap: UsageMap, status: string, contextKey: string, ref: Ref): void {
  if (!status) return;
  const statusEntry = usageMap.statuses[status];
  if (statusEntry) {
    const arr = statusEntry[contextKey as keyof typeof statusEntry];
    if (Array.isArray(arr)) {
      arr.push(ref);
    }
  }
}

function scanGraphPathAssertion(assertion: GraphPathAssertion | null | undefined, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!assertion) return;
  (assertion.path ?? []).forEach((step, idx) => {
    if (step.via) {
      // Support both single relationship kind and array of kinds
      const viaKinds = Array.isArray(step.via) ? step.via : [step.via];
      viaKinds.forEach((viaKind) => {
        recordRelationshipKindRef(
          usageMap,
          viaKind,
          contextKey,
          ref,
          { ...info, field: `${info.field}.path[${idx}].via` }
        );
      });
    }
    if (step.targetKind && step.targetKind !== 'any') {
      recordEntityKindRef(
        usageMap,
        step.targetKind,
        contextKey,
        ref,
        { ...info, field: `${info.field}.path[${idx}].targetKind` }
      );
    }
    if (step.targetSubtype && step.targetSubtype !== 'any') {
      recordSubtypeRef(usageMap, step.targetSubtype, contextKey, ref);
    }
    if (step.targetStatus && step.targetStatus !== 'any') {
      recordStatusRef(usageMap, step.targetStatus, contextKey, ref);
    }
  });

  (assertion.where ?? []).forEach((constraint, idx) => {
    switch (constraint.type) {
      case 'has_relationship':
      case 'lacks_relationship':
        if (constraint.kind) {
          recordRelationshipKindRef(
            usageMap,
            constraint.kind,
            contextKey,
            ref,
            { ...info, field: `${info.field}.where[${idx}].kind` }
          );
        }
        break;
      case 'kind_equals':
        if (constraint.kind) {
          recordEntityKindRef(
            usageMap,
            constraint.kind,
            contextKey,
            ref,
            { ...info, field: `${info.field}.where[${idx}].kind` }
          );
        }
        break;
      case 'subtype_equals':
        if (constraint.subtype) {
          recordSubtypeRef(usageMap, constraint.subtype, contextKey, ref);
        }
        break;
      default:
        break;
    }
  });
}

function scanSelectionFilter(filter: SelectionFilter, idx: number, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  const recordRelKind = () => {
    if (filter.kind) recordRelationshipKindRef(usageMap, filter.kind, contextKey, ref, { ...info, field: `${info.field}[${idx}].kind` });
  };
  const recordTag = () => recordTagRef(usageMap, filter.tag, contextKey, ref);
  const recordTags = () => (filter.tags ?? []).forEach(tag => recordTagRef(usageMap, tag, contextKey, ref));
  const handlers: Partial<Record<string, () => void>> = {
    has_relationship: recordRelKind,
    lacks_relationship: recordRelKind,
    shares_related: () => {
      if (filter.relationshipKind) recordRelationshipKindRef(usageMap, filter.relationshipKind, contextKey, ref, { ...info, field: `${info.field}[${idx}].relationshipKind` });
    },
    has_tag: recordTag,
    lacks_tag: recordTag,
    has_tags: recordTags,
    has_any_tag: recordTags,
    lacks_any_tag: recordTags,
    has_status: () => { if (filter.status) recordStatusRef(usageMap, filter.status, contextKey, ref); },
    graph_path: () => scanGraphPathAssertion(filter.assert, usageMap, contextKey, ref, { ...info, field: `${info.field}[${idx}].assert` }),
  };
  if (!filter.type) return;
  const handler = handlers[filter.type];
  if (handler) handler();
}

function scanSelectionFilters(filters: SelectionFilter[] | null | undefined, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  (filters ?? []).forEach((filter, idx) => scanSelectionFilter(filter, idx, usageMap, contextKey, ref, info));
}

// eslint-disable-next-line complexity -- flat sequential scan of independent optional selection fields
function scanSelectionRule(selection: SelectionRule | null | undefined, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!selection) return;
  if (selection.kind) {
    recordEntityKindRef(usageMap, selection.kind, contextKey, ref, { ...info, field: `${info.field}.kind` });
  }
  (selection.kinds ?? []).forEach((kind) => {
    recordEntityKindRef(usageMap, kind, contextKey, ref, { ...info, field: `${info.field}.kinds` });
  });
  (selection.subtypes ?? []).forEach(subtype => recordSubtypeRef(usageMap, subtype, contextKey, ref));
  (selection.excludeSubtypes ?? []).forEach(subtype => recordSubtypeRef(usageMap, subtype, contextKey, ref));
  if (selection.status) {
    recordStatusRef(usageMap, selection.status, contextKey, ref);
  }
  (selection.statuses ?? []).forEach(status => recordStatusRef(usageMap, status, contextKey, ref));
  if (selection.notStatus) {
    recordStatusRef(usageMap, selection.notStatus, contextKey, ref);
  }
  if (selection.relationshipKind) {
    recordRelationshipKindRef(usageMap, selection.relationshipKind, contextKey, ref, {
      ...info,
      field: `${info.field}.relationshipKind`,
    });
  }
  scanSelectionFilters(selection.filters, usageMap, contextKey, ref, { ...info, field: `${info.field}.filters` });
  (selection.saturationLimits ?? []).forEach((limit, idx) => {
    recordRelationshipKindRef(usageMap, limit.relationshipKind, contextKey, ref, {
      ...info,
      field: `${info.field}.saturationLimits[${idx}].relationshipKind`,
    });
    if (limit.fromKind) {
      recordEntityKindRef(usageMap, limit.fromKind, contextKey, ref, {
        ...info,
        field: `${info.field}.saturationLimits[${idx}].fromKind`,
      });
    }
  });
}

// eslint-disable-next-line complexity -- flat sequential scan of independent optional variable selection fields
function scanVariableSelectionRule(selection: VariableSelectionRule | null | undefined, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!selection) return;
  const from = selection.from;
  if (from && typeof from === 'object') {
    if (from.relationshipKind) {
      recordRelationshipKindRef(usageMap, from.relationshipKind, contextKey, ref, {
        ...info,
        field: `${info.field}.from.relationshipKind`,
      });
    }
  }
  if (selection.kind) {
    recordEntityKindRef(usageMap, selection.kind, contextKey, ref, { ...info, field: `${info.field}.kind` });
  }
  (selection.kinds ?? []).forEach(kind => {
    recordEntityKindRef(usageMap, kind, contextKey, ref, { ...info, field: `${info.field}.kinds` });
  });
  (selection.subtypes ?? []).forEach(subtype => recordSubtypeRef(usageMap, subtype, contextKey, ref));
  if (selection.status) {
    recordStatusRef(usageMap, selection.status, contextKey, ref);
  }
  (selection.statuses ?? []).forEach(status => recordStatusRef(usageMap, status, contextKey, ref));
  if (selection.notStatus) {
    recordStatusRef(usageMap, selection.notStatus, contextKey, ref);
  }
  scanSelectionFilters(selection.filters, usageMap, contextKey, ref, { ...info, field: `${info.field}.filters` });
  scanSelectionFilters(selection.preferFilters, usageMap, contextKey, ref, { ...info, field: `${info.field}.preferFilters` });
}

function scanConditionPressure(condition: ConditionEntry, usageMap: UsageMap, pressureIds: Set<string>, contextKey: string, ref: Ref, info: RefInfo): void {
  switch (condition.type) {
    case 'pressure':
      if (condition.pressureId) {
        recordPressureRef(usageMap, pressureIds, condition.pressureId, contextKey, ref, info);
      }
      break;
    case 'pressure_any_above':
      (condition.pressureIds ?? []).forEach((pressureId) =>
        recordPressureRef(usageMap, pressureIds, pressureId, contextKey, ref, info)
      );
      break;
    case 'pressure_compare':
      if (condition.pressureA) {
        recordPressureRef(usageMap, pressureIds, condition.pressureA, contextKey, ref, info);
      }
      if (condition.pressureB) {
        recordPressureRef(usageMap, pressureIds, condition.pressureB, contextKey, ref, info);
      }
      break;
    default:
      break;
  }
}

/** Record optional kind/subtype/status refs from a condition. */
function recordConditionEntityRefs(condition: ConditionEntry, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  if (condition.kind) recordEntityKindRef(usageMap, condition.kind, contextKey, ref, info);
  if (condition.subtype) recordSubtypeRef(usageMap, condition.subtype, contextKey, ref);
  if (condition.status) recordStatusRef(usageMap, condition.status, contextKey, ref);
}

/** Record optional relationship + target refs from a condition. */
function recordConditionRelationshipRefs(condition: ConditionEntry, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  if (condition.relationshipKind) recordRelationshipKindRef(usageMap, condition.relationshipKind, contextKey, ref, info);
  if (condition.targetKind) recordEntityKindRef(usageMap, condition.targetKind, contextKey, ref, info);
  if (condition.targetSubtype) recordSubtypeRef(usageMap, condition.targetSubtype, contextKey, ref);
  if (condition.targetStatus) recordStatusRef(usageMap, condition.targetStatus, contextKey, ref);
}

function scanConditionEntity(condition: ConditionEntry, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  switch (condition.type) {
    case 'entity_count':
      recordConditionEntityRefs(condition, usageMap, contextKey, ref, info);
      break;
    case 'relationship_count':
    case 'entity_has_relationship':
      if (condition.relationshipKind) {
        recordRelationshipKindRef(usageMap, condition.relationshipKind, contextKey, ref, info);
      }
      break;
    case 'relationship_exists':
      recordConditionRelationshipRefs(condition, usageMap, contextKey, ref, info);
      break;
    case 'tag_exists':
    case 'tag_absent':
      recordTagRef(usageMap, condition.tag, contextKey, ref);
      break;
    case 'status':
      if (condition.status) {
        recordStatusRef(usageMap, condition.status, contextKey, ref);
      }
      break;
    default:
      break;
  }
}

function scanConditionInner(condition: ConditionEntry, usageMap: UsageMap, pressureIds: Set<string>, contextKey: string, ref: Ref, info: RefInfo): void {
  // Pressure-related conditions
  if (condition.type === 'pressure' || condition.type === 'pressure_any_above' || condition.type === 'pressure_compare') {
    scanConditionPressure(condition, usageMap, pressureIds, contextKey, ref, info);
    return;
  }
  // Graph path
  if (condition.type === 'graph_path') {
    scanGraphPathAssertion(condition.assert, usageMap, contextKey, ref, info);
    return;
  }
  // Compound conditions
  if (condition.type === 'and' || condition.type === 'or') {
    (condition.conditions ?? []).forEach((child, idx) =>
      scanConditionInner(child, usageMap, pressureIds, contextKey, ref, { ...info, field: `${info.field}.${condition.type}[${idx}]` })
    );
    return;
  }
  // Entity/relationship/tag/status conditions
  scanConditionEntity(condition, usageMap, contextKey, ref, info);
}

function scanCondition(condition: ConditionEntry | null | undefined, usageMap: UsageMap, pressureIds: Set<string>, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!condition) return;
  scanConditionInner(condition, usageMap, pressureIds, contextKey, ref, info);
}

function scanMutation(mutation: MutationEntry, idx: number, usageMap: UsageMap, pressureIds: Set<string>, contextKey: string, ref: Ref, info: RefInfo): void {
  const handlers: Partial<Record<string, () => void>> = {
    set_tag: () => recordTagRef(usageMap, mutation.tag, contextKey, ref),
    remove_tag: () => recordTagRef(usageMap, mutation.tag, contextKey, ref),
    create_relationship: () => {
      if (mutation.kind) recordRelationshipKindRef(usageMap, mutation.kind, contextKey, ref, { ...info, field: `${info.field}[${idx}].kind` });
    },
    adjust_relationship_strength: () => {
      if (mutation.kind) recordRelationshipKindRef(usageMap, mutation.kind, contextKey, ref, { ...info, field: `${info.field}[${idx}].kind` });
    },
    archive_relationship: () => {
      if (mutation.relationshipKind) recordRelationshipKindRef(usageMap, mutation.relationshipKind, contextKey, ref, { ...info, field: `${info.field}[${idx}].relationshipKind` });
    },
    change_status: () => { if (mutation.newStatus) recordStatusRef(usageMap, mutation.newStatus, contextKey, ref); },
    modify_pressure: () => {
      if (mutation.pressureId) recordPressureRef(usageMap, pressureIds, mutation.pressureId, contextKey, ref, { ...info, field: `${info.field}[${idx}].pressureId` });
    },
  };
  if (!mutation.type) return;
  const handler = handlers[mutation.type];
  if (handler) handler();
}

function scanMutations(mutations: MutationEntry[], usageMap: UsageMap, pressureIds: Set<string>, contextKey: string, ref: Ref, info: RefInfo): void {
  mutations.forEach((mutation, idx) => scanMutation(mutation, idx, usageMap, pressureIds, contextKey, ref, info));
}

function scanMetricEntityCount(metric: MetricEntry, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  if (metric.kind) {
    recordEntityKindRef(usageMap, metric.kind, contextKey, ref, info);
  }
  if (metric.subtype) {
    recordSubtypeRef(usageMap, metric.subtype, contextKey, ref);
  }
  if (metric.status) {
    recordStatusRef(usageMap, metric.status, contextKey, ref);
  }
}

function scanMetricNeighbor(metric: MetricEntry, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  // Support both single relationship kind and array of kinds for 'via'
  if (metric.via) {
    const viaKinds = Array.isArray(metric.via) ? metric.via : [metric.via];
    viaKinds.forEach((kind) =>
      recordRelationshipKindRef(usageMap, kind, contextKey, ref, info)
    );
  }
  if (metric.then) {
    recordRelationshipKindRef(usageMap, metric.then, contextKey, ref, info);
  }
  (metric.relationshipKinds ?? []).forEach((kind) =>
    recordRelationshipKindRef(usageMap, kind, contextKey, ref, info)
  );
  if (metric.kind) {
    recordEntityKindRef(usageMap, metric.kind, contextKey, ref, info);
  }
}

function scanMetricInner(metric: MetricEntry, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  const scanRelKinds = () => (metric.relationshipKinds ?? []).forEach((kind) =>
    recordRelationshipKindRef(usageMap, kind, contextKey, ref, info));
  const scanNeighbor = () => scanMetricNeighbor(metric, usageMap, contextKey, ref, info);
  const handlers: Partial<Record<string, () => void>> = {
    entity_count: () => scanMetricEntityCount(metric, usageMap, contextKey, ref, info),
    relationship_count: scanRelKinds,
    connection_count: scanRelKinds,
    cross_culture_ratio: scanRelKinds,
    tag_count: () => (metric.tags ?? []).forEach(tag => recordTagRef(usageMap, tag, contextKey, ref)),
    ratio: () => {
      if (metric.numerator) scanMetricInner(metric.numerator, usageMap, contextKey, ref, info);
      if (metric.denominator) scanMetricInner(metric.denominator, usageMap, contextKey, ref, info);
    },
    status_ratio: () => {
      scanMetricEntityCount(metric, usageMap, contextKey, ref, info);
      if (metric.aliveStatus) recordStatusRef(usageMap, metric.aliveStatus, contextKey, ref);
    },
    shared_relationship: () => {
      if (metric.sharedRelationshipKind) recordRelationshipKindRef(usageMap, metric.sharedRelationshipKind, contextKey, ref, info);
    },
    neighbor_kind_count: scanNeighbor,
    neighbor_prominence: scanNeighbor,
  };
  if (!metric.type) return;
  const handler = handlers[metric.type];
  if (handler) handler();
}

function scanMetric(metric: MetricEntry | null | undefined, usageMap: UsageMap, contextKey: string, ref: Ref, info: RefInfo): void {
  if (!metric) return;
  scanMetricInner(metric, usageMap, contextKey, ref, info);
}

function trackFeedbackEntityKind(factor: FeedbackFactor, usageMap: UsageMap, pressure: PressureConfig, isPositive: boolean): void {
  if (!factor.kind) return;
  if (usageMap.entityKinds[factor.kind]) {
    usageMap.entityKinds[factor.kind].pressures.push({ id: pressure.id, factor: factor.type });
  } else {
    usageMap.validation.invalidRefs.push({
      type: 'pressure',
      id: pressure.id,
      field: `${isPositive ? 'positive' : 'negative'}Feedback.kind`,
      refType: 'entityKind',
      refId: factor.kind,
      location: `Pressure "${pressure.name ?? pressure.id}"`,
    });
  }
}

function scanFeedbackFactors(usageMap: UsageMap, pressure: PressureConfig, factors: FeedbackFactor[] | undefined, isPositive: boolean): void {
  (factors ?? []).forEach(factor => {
    trackFeedbackEntityKind(factor, usageMap, pressure, isPositive);

    // Track relationship kind references
    if (factor.relationshipKinds) {
      factor.relationshipKinds.forEach(rk => {
        if (usageMap.relationshipKinds[rk]) {
          usageMap.relationshipKinds[rk].pressures.push({ id: pressure.id, factor: factor.type });
        } else {
          usageMap.validation.invalidRefs.push({
            type: 'pressure',
            id: pressure.id,
            field: `${isPositive ? 'positive' : 'negative'}Feedback.relationshipKinds`,
            refType: 'relationshipKind',
            refId: rk,
            location: `Pressure "${pressure.name ?? pressure.id}"`,
          });
        }
      });
    }

    // Track tag references
    if (factor.tag) {
      if (!usageMap.tags[factor.tag]) {
        usageMap.tags[factor.tag] = { pressures: [], systems: [], generators: [], actions: [] };
      }
      usageMap.tags[factor.tag].pressures.push({ id: pressure.id, factor: factor.type });
    }

    // Track tags array (tag_count factor type)
    if (factor.tags && Array.isArray(factor.tags)) {
      factor.tags.forEach(tag => {
        if (!usageMap.tags[tag]) {
          usageMap.tags[tag] = { pressures: [], systems: [], generators: [], actions: [] };
        }
        usageMap.tags[tag].pressures.push({ id: pressure.id, factor: factor.type });
      });
    }

    // Track as feedback source/sink
    if (usageMap.pressures[pressure.id]) {
      if (isPositive) {
        usageMap.pressures[pressure.id].feedbackSources.push(factor);
      } else {
        usageMap.pressures[pressure.id].feedbackSinks.push(factor);
      }
    }
  });
}

function scanPressureReferences(usageMap: UsageMap, pressures: PressureConfig[]): void {
  pressures.forEach(pressure => {
    scanFeedbackFactors(usageMap, pressure, pressure.growth?.positiveFeedback, true);
    scanFeedbackFactors(usageMap, pressure, pressure.growth?.negativeFeedback, false);
  });
}

function scanEraReferences(usageMap: UsageMap, eras: EraConfig[], generators: GeneratorConfig[], systems: SystemConfig[]): void {
  const generatorIds = new Set(generators.map(g => g.id));
  const systemIds = new Set(systems.map(s => s.config.id));
  const pressureIds = new Set(Object.keys(usageMap.pressures));

  eras.forEach(era => {
    const eraRef: Ref = { id: era.id, name: era.name };

    // Track generator references
    Object.entries(era.templateWeights ?? {}).forEach(([genId, weight]) => {
      if (usageMap.generators[genId]) {
        usageMap.generators[genId].eras.push({ id: era.id, name: era.name, weight });
      }
      if (!generatorIds.has(genId)) {
        usageMap.validation.invalidRefs.push({
          type: 'era',
          id: era.id,
          field: 'templateWeights',
          refType: 'generator',
          refId: genId,
          location: `Era "${era.name ?? era.id}"`,
        });
      }
    });

    // Track system references
    Object.entries(era.systemModifiers ?? {}).forEach(([sysId, weight]) => {
      if (usageMap.systems[sysId]) {
        usageMap.systems[sysId].eras.push({ id: era.id, name: era.name, weight });
      }
      if (!systemIds.has(sysId)) {
        usageMap.validation.invalidRefs.push({
          type: 'era',
          id: era.id,
          field: 'systemModifiers',
          refType: 'system',
          refId: sysId,
          location: `Era "${era.name ?? era.id}"`,
        });
      }
    });

    (era.entryEffects?.mutations ?? []).forEach((mutation) => {
      if (mutation.type !== 'modify_pressure') return;
      if (mutation.pressureId) {
        recordPressureRef(usageMap, pressureIds, mutation.pressureId, 'eras', eraRef, {
          type: 'era',
          id: era.id,
          field: 'entryEffects.mutations',
          location: `Era "${era.name ?? era.id}"`,
        });
      }
    });
    (era.exitEffects?.mutations ?? []).forEach((mutation) => {
      if (mutation.type !== 'modify_pressure') return;
      if (mutation.pressureId) {
        recordPressureRef(usageMap, pressureIds, mutation.pressureId, 'eras', eraRef, {
          type: 'era',
          id: era.id,
          field: 'exitEffects.mutations',
          location: `Era "${era.name ?? era.id}"`,
        });
      }
    });
  });
}

function scanVariantApplyTags(tags: Record<string, Record<string, string>> | null | undefined, usageMap: UsageMap, contextKey: string, ref: Ref): void {
  if (!tags) return;
  Object.values(tags).forEach((tagMap) => {
    Object.keys(tagMap).forEach((tag) => recordTagRef(usageMap, tag, contextKey, ref));
  });
}

function scanGeneratorCreation(
  creation: CreationEntry[],
  usageMap: UsageMap,
  genRef: Ref,
  genId: string,
  location: string,
): void {
  // eslint-disable-next-line complexity -- flat sequential scan of creation entry fields (kind, subtype, status, culture, relationships)
  creation.forEach((entry, idx) => {
    const kind = typeof entry.kind === 'string' ? entry.kind : null;
    if (kind) {
      recordEntityKindRef(usageMap, kind, 'generators', genRef, {
        type: 'generator',
        id: genId,
        field: `creation[${idx}].kind`,
        location,
      });
    }

    if (typeof entry.subtype === 'string') {
      recordSubtypeRef(usageMap, entry.subtype, 'generators', genRef);
    } else if (entry.subtype && typeof entry.subtype === 'object' && 'random' in entry.subtype && Array.isArray(entry.subtype.random)) {
      entry.subtype.random.forEach((subtype) => {
        recordSubtypeRef(usageMap, subtype, 'generators', genRef);
      });
    }

    if (entry.status) {
      recordStatusRef(usageMap, entry.status, 'generators', genRef);
    }

    if (entry.tags && typeof entry.tags === 'object') {
      Object.keys(entry.tags).forEach(tag => recordTagRef(usageMap, tag, 'generators', genRef));
    }
  });
}

function scanGeneratorVariants(
  variants: GeneratorConfig['variants'],
  usageMap: UsageMap,
  pressureIds: Set<string>,
  genRef: Ref,
  genId: string,
  location: string,
): void {
  (variants?.options ?? []).forEach((variant, idx) => {
    scanCondition(variant.when, usageMap, pressureIds, 'generators', genRef, {
      type: 'generator',
      id: genId,
      field: `variants.options[${idx}].when`,
      location,
    });

    (variant.apply?.relationships ?? []).forEach((rel, relIdx) => {
      recordRelationshipKindRef(usageMap, rel.kind, 'generators', genRef, {
        type: 'generator',
        id: genId,
        field: `variants.options[${idx}].apply.relationships[${relIdx}].kind`,
        location,
      });
    });

    scanVariantApplyTags(variant.apply?.tags, usageMap, 'generators', genRef);

    scanMutations(variant.apply?.stateUpdates ?? [], usageMap, pressureIds, 'generators', genRef, {
      type: 'generator',
      id: genId,
      field: `variants.options[${idx}].apply.stateUpdates`,
      location,
    });
  });
}

function scanGeneratorReferences(usageMap: UsageMap, generators: GeneratorConfig[], pressures: PressureConfig[]): void {
  const pressureIds = new Set(pressures.map(p => p.id));

  generators.forEach(gen => {
    const genRef: Ref = { id: gen.id, name: gen.name };
    const location = `Generator "${gen.name ?? gen.id}"`;

    (gen.applicability ?? []).forEach((rule, idx) => {
      scanCondition(rule, usageMap, pressureIds, 'generators', genRef, {
        type: 'generator',
        id: gen.id,
        field: `applicability[${idx}]`,
        location,
      });
    });

    scanSelectionRule(gen.selection, usageMap, 'generators', genRef, {
      type: 'generator',
      id: gen.id,
      field: 'selection',
      location,
    });

    Object.entries(gen.variables ?? {}).forEach(([varName, variable]) => {
      scanVariableSelectionRule(variable.select, usageMap, 'generators', genRef, {
        type: 'generator',
        id: gen.id,
        field: `variables.${varName}.select`,
        location,
      });
    });

    scanGeneratorCreation(gen.creation ?? [], usageMap, genRef, gen.id, location);

    (gen.relationships ?? []).forEach((rel, idx) => {
      recordRelationshipKindRef(usageMap, rel.kind, 'generators', genRef, {
        type: 'generator',
        id: gen.id,
        field: `relationships[${idx}].kind`,
        location,
      });
    });

    scanMutations(gen.stateUpdates ?? [], usageMap, pressureIds, 'generators', genRef, {
      type: 'generator',
      id: gen.id,
      field: 'stateUpdates',
      location,
    });

    scanGeneratorVariants(gen.variants, usageMap, pressureIds, genRef, gen.id, location);
  });
}

function scanContagionSystem(config: SystemInnerConfig, usageMap: UsageMap, pressureIds: Set<string>, sysRef: Ref, sysId: string, location: string): void {
  if (config.contagion?.type === 'relationship' && config.contagion.relationshipKind) {
    recordRelationshipKindRef(usageMap, config.contagion.relationshipKind, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'contagion.relationshipKind', location,
    });
  }
  if (config.contagion?.type === 'tag' && config.contagion.tagPattern) {
    recordTagRef(usageMap, config.contagion.tagPattern, 'systems', sysRef);
  }
  (config.vectors ?? []).forEach((vector, idx) => {
    recordRelationshipKindRef(usageMap, vector.relationshipKind, 'systems', sysRef, {
      type: 'system', id: sysId, field: `vectors[${idx}].relationshipKind`, location,
    });
  });
  scanMutations(config.infectionAction ? [config.infectionAction] : [], usageMap, pressureIds, 'systems', sysRef, {
    type: 'system', id: sysId, field: 'infectionAction', location,
  });
  (config.phaseTransitions ?? []).forEach((transition, idx) => {
    scanSelectionRule(transition.selection, usageMap, 'systems', sysRef, {
      type: 'system', id: sysId, field: `phaseTransitions[${idx}].selection`, location,
    });
    if (transition.toStatus) recordStatusRef(usageMap, transition.toStatus, 'systems', sysRef);
  });
  scanContagionMultiSource(config, usageMap, sysRef, sysId, location);
}

function scanContagionMultiSource(config: SystemInnerConfig, usageMap: UsageMap, sysRef: Ref, sysId: string, location: string): void {
  if (config.multiSource?.sourceSelection) {
    scanSelectionRule(config.multiSource.sourceSelection, usageMap, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'multiSource.sourceSelection', location,
    });
  }
  if (config.multiSource?.immunityTagPrefix) {
    recordTagRef(usageMap, config.multiSource.immunityTagPrefix, 'systems', sysRef);
  }
}

function scanEvolutionSystem(config: SystemInnerConfig, usageMap: UsageMap, pressureIds: Set<string>, sysRef: Ref, sysId: string, location: string): void {
  (config.subtypeBonuses ?? []).forEach((bonus) => recordSubtypeRef(usageMap, bonus.subtype, 'systems', sysRef));
  scanMetric(config.metric, usageMap, 'systems', sysRef, {
    type: 'system', id: sysId, field: 'metric', location,
  });
  (config.rules ?? []).forEach((rule, idx) => {
    scanMutations(rule.action ? [rule.action] : [], usageMap, pressureIds, 'systems', sysRef, {
      type: 'system', id: sysId, field: `rules[${idx}].action`, location,
    });
  });
}

function scanThresholdSystem(config: SystemInnerConfig, usageMap: UsageMap, pressureIds: Set<string>, sysRef: Ref, sysId: string, location: string): void {
  (config.conditions ?? []).forEach((cond, idx) => {
    scanCondition(cond, usageMap, pressureIds, 'systems', sysRef, {
      type: 'system', id: sysId, field: `conditions[${idx}]`, location,
    });
  });
  scanMutations(config.actions ?? [], usageMap, pressureIds, 'systems', sysRef, {
    type: 'system', id: sysId, field: 'actions', location,
  });
  if (config.clusterRelationshipKind) {
    recordRelationshipKindRef(usageMap, config.clusterRelationshipKind, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'clusterRelationshipKind', location,
    });
  }
}

function scanClusterSystem(config: SystemInnerConfig, usageMap: UsageMap, pressureIds: Set<string>, sysRef: Ref, sysId: string, location: string): void {
  (config.clustering?.criteria ?? []).forEach((crit, idx) => {
    if (crit.type === 'shared_relationship' && crit.relationshipKind) {
      recordRelationshipKindRef(usageMap, crit.relationshipKind, 'systems', sysRef, {
        type: 'system', id: sysId, field: `clustering.criteria[${idx}].relationshipKind`, location,
      });
    }
  });
  if (config.metaEntity?.kind) {
    recordEntityKindRef(usageMap, config.metaEntity.kind, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'metaEntity.kind', location,
    });
  }
  (config.metaEntity?.additionalTags ?? []).forEach((tag) => recordTagRef(usageMap, tag, 'systems', sysRef));
  scanClusterPostProcess(config, usageMap, pressureIds, sysRef, sysId, location);
}

function scanClusterPostProcess(config: SystemInnerConfig, usageMap: UsageMap, pressureIds: Set<string>, sysRef: Ref, sysId: string, location: string): void {
  Object.keys(config.postProcess?.pressureChanges ?? {}).forEach((pressureId) => {
    recordPressureRef(usageMap, pressureIds, pressureId, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'postProcess.pressureChanges', location,
    });
  });
  if (config.postProcess?.governanceRelationship) {
    recordRelationshipKindRef(usageMap, config.postProcess.governanceRelationship, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'postProcess.governanceRelationship', location,
    });
  }
  if (config.postProcess?.governanceFactionSubtype) {
    recordSubtypeRef(usageMap, config.postProcess.governanceFactionSubtype, 'systems', sysRef);
  }
}

function scanTagDiffusionSystem(config: SystemInnerConfig, usageMap: UsageMap, pressureIds: Set<string>, sysRef: Ref, sysId: string, location: string): void {
  if (config.connectionKind) {
    recordRelationshipKindRef(usageMap, config.connectionKind, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'connectionKind', location,
    });
  }
  (config.convergence?.tags ?? []).forEach((tag) => recordTagRef(usageMap, tag, 'systems', sysRef));
  (config.divergence?.tags ?? []).forEach((tag) => recordTagRef(usageMap, tag, 'systems', sysRef));
  if (config.divergencePressure?.pressureName) {
    recordPressureRef(usageMap, pressureIds, config.divergencePressure.pressureName, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'divergencePressure.pressureName', location,
    });
  }
}

// eslint-disable-next-line complexity -- flat sequential scan of independent plane diffusion config fields (sources, sinks, outputTags)
function scanPlaneDiffusionSystem(config: SystemInnerConfig, usageMap: UsageMap, sysRef: Ref): void {
  if (config.sources?.tagFilter) recordTagRef(usageMap, config.sources.tagFilter, 'systems', sysRef);
  if (config.sources?.strengthTag) recordTagRef(usageMap, config.sources.strengthTag, 'systems', sysRef);
  if (config.sinks?.tagFilter) recordTagRef(usageMap, config.sinks.tagFilter, 'systems', sysRef);
  if (config.sinks?.strengthTag) recordTagRef(usageMap, config.sinks.strengthTag, 'systems', sysRef);
  (config.outputTags ?? []).forEach((tagConfig) => recordTagRef(usageMap, tagConfig.tag, 'systems', sysRef));
  if (config.valueTag) recordTagRef(usageMap, config.valueTag, 'systems', sysRef);
}

type SystemScanner = (config: SystemInnerConfig, usageMap: UsageMap, pressureIds: Set<string>, sysRef: Ref, sysId: string, location: string) => void;

const systemTypeScanners: Partial<Record<string, SystemScanner>> = {
  graphContagion: scanContagionSystem,
  connectionEvolution: scanEvolutionSystem,
  thresholdTrigger: scanThresholdSystem,
  clusterFormation: scanClusterSystem,
  tagDiffusion: scanTagDiffusionSystem,
};

function scanSystemReferences(usageMap: UsageMap, systems: SystemConfig[], pressures: PressureConfig[]): void {
  const pressureIds = new Set(pressures.map(p => p.id));

  systems.forEach(sys => {
    const sysId = sys.config.id;
    const sysName = sys.config.name ?? sysId;
    const sysRef: Ref = { id: sysId, name: sysName };
    const config = sys.config;
    const location = `System "${sysName}"`;

    scanSelectionRule(config.selection, usageMap, 'systems', sysRef, {
      type: 'system', id: sysId, field: 'selection', location,
    });

    Object.keys(config.pressureChanges ?? {}).forEach((pressureId) => {
      recordPressureRef(usageMap, pressureIds, pressureId, 'systems', sysRef, {
        type: 'system', id: sysId, field: 'pressureChanges', location,
      });
    });

    const scanner = systemTypeScanners[sys.systemType];
    if (scanner) {
      scanner(config, usageMap, pressureIds, sysRef, sysId, location);
    } else if (sys.systemType === 'planeDiffusion') {
      scanPlaneDiffusionSystem(config, usageMap, sysRef);
    }
  });
}

function scanActionReferences(usageMap: UsageMap, actions: ActionConfig[], pressures: PressureConfig[]): void {
  const pressureIds = new Set(pressures.map(p => p.id));

  actions.forEach(action => {
    const actionRef: Ref = { id: action.id, name: action.name };
    const location = `Action "${action.name ?? action.id}"`;

    scanSelectionRule(action.actor?.selection, usageMap, 'actions', actionRef, {
      type: 'action',
      id: action.id,
      field: 'actor.selection',
      location,
    });

    (action.actor?.conditions ?? []).forEach((condition, idx) => {
      scanCondition(condition, usageMap, pressureIds, 'actions', actionRef, {
        type: 'action',
        id: action.id,
        field: `actor.conditions[${idx}]`,
        location,
      });
    });

    scanVariableSelectionRule(action.actor?.instigator, usageMap, 'actions', actionRef, {
      type: 'action',
      id: action.id,
      field: 'actor.instigator',
      location,
    });

    scanSelectionRule(action.targeting, usageMap, 'actions', actionRef, {
      type: 'action',
      id: action.id,
      field: 'targeting',
      location,
    });

    scanMutations(action.outcome?.mutations ?? [], usageMap, pressureIds, 'actions', actionRef, {
      type: 'action',
      id: action.id,
      field: 'outcome.mutations',
      location,
    });

    const pressureModifiers = action.probability?.pressureModifiers;
    if (Array.isArray(pressureModifiers)) {
      pressureModifiers.forEach((mod) => {
        if (mod.pressure) {
          recordPressureRef(usageMap, pressureIds, mod.pressure, 'actions', actionRef, {
            type: 'action',
            id: action.id,
            field: 'probability.pressureModifiers',
            location,
          });
        }
      });
    }
  });
}

function detectOrphans(usageMap: UsageMap, pressures: PressureConfig[]): void {
  // Check for unused entity kinds
  Object.entries(usageMap.entityKinds).forEach(([kind, usage]) => {
    const totalUsage = usage.generators.length + usage.systems.length + usage.actions.length + usage.pressures.length;
    if (totalUsage === 0) {
      usageMap.validation.orphans.push({
        type: 'entityKind',
        id: kind,
        reason: 'Not referenced by any generator, system, action, or pressure',
      });
    }
  });

  // Check for unused relationship kinds
  Object.entries(usageMap.relationshipKinds).forEach(([kind, usage]) => {
    const totalUsage = usage.generators.length + usage.systems.length + usage.actions.length + usage.pressures.length;
    if (totalUsage === 0) {
      usageMap.validation.orphans.push({
        type: 'relationshipKind',
        id: kind,
        reason: 'Not referenced by any generator, system, action, or pressure',
      });
    }
  });

  // Check for unused pressures
  Object.entries(usageMap.pressures).forEach(([pressureId, usage]) => {
    const totalUsage = usage.generators.length + usage.systems.length + usage.actions.length;
    if (totalUsage === 0) {
      usageMap.validation.orphans.push({
        type: 'pressure',
        id: pressureId,
        reason: 'Not referenced by any generator, system, or action',
      });
    }
  });

  // Check for generators not used in any era
  Object.entries(usageMap.generators).forEach(([genId, usage]) => {
    if (usage.eras.length === 0) {
      usageMap.validation.orphans.push({
        type: 'generator',
        id: genId,
        reason: 'Not included in any era',
      });
    }
  });

  // Check for systems not used in any era
  Object.entries(usageMap.systems).forEach(([sysId, usage]) => {
    if (usage.eras.length === 0) {
      usageMap.validation.orphans.push({
        type: 'system',
        id: sysId,
        reason: 'Not included in any era',
      });
    }
  });

  // Check for pressures with no feedback (will monotonically change)
  Object.entries(usageMap.pressures).forEach(([pressureId, usage]) => {
    if (usage.feedbackSources.length === 0 && usage.feedbackSinks.length === 0) {
      const pressure = pressures.find(p => p.id === pressureId);
      if (pressure && (pressure.homeostasis ?? 0) === 0) {
        usageMap.validation.orphans.push({
          type: 'pressure',
          id: pressureId,
          reason: 'No feedback or homeostasis defined - pressure will remain static',
        });
      }
    }
  });
}

interface RelKindConstraints {
  srcKinds: string[];
  dstKinds: string[];
}

function collectKindsFromSelection(selection: SelectionRule | null | undefined): string[] {
  return [
    ...(selection?.kind ? [selection.kind] : []),
    ...(selection?.kinds ?? []),
  ];
}

function checkDirectionalCompat(
  constraintKinds: string[], actualKinds: string[], direction: string,
  mutation: MutationEntry, idx: number, actionId: string, usageMap: UsageMap,
): void {
  if (constraintKinds.length === 0 || actualKinds.length === 0) return;
  const compatible = actualKinds.some(k => constraintKinds.includes(k));
  if (!compatible) {
    const ref = direction === 'src' ? mutation.src : mutation.dst;
    usageMap.validation.compatibility.push({
      type: 'action',
      id: actionId,
      field: `outcome.mutations[${idx}]`,
      issue: `Relationship "${mutation.kind}" requires ${direction} to be one of [${constraintKinds.join(', ')}], but ${ref ?? 'unknown'} kinds are [${actualKinds.join(', ')}]`,
    });
  }
}

function checkRelationshipCompatibility(usageMap: UsageMap, generators: GeneratorConfig[], actions: ActionConfig[], schema: SchemaConfig): void {
  const relationshipKinds: Partial<Record<string, RelKindConstraints>> = {};
  (schema.relationshipKinds ?? []).forEach(rk => {
    relationshipKinds[rk.kind] = {
      srcKinds: rk.srcKinds ?? [],
      dstKinds: rk.dstKinds ?? [],
    };
  });

  // Check generator relationship compatibility
  generators.forEach(gen => {
    (gen.relationships ?? []).forEach((rel) => {
      const rkDef = relationshipKinds[rel.kind];
      if (!rkDef) return; // Already flagged as invalid ref

      // Check if src/dst are compatible
      // This is a simplified check - in reality we'd need to resolve $target, $created, etc.
      if (rkDef.srcKinds.length > 0 || rkDef.dstKinds.length > 0) {
        // If the relationship has constraints, note it for review
        // Full compatibility checking would require runtime context
      }
    });
  });

  // Check action outcome relationship compatibility
  actions.forEach(action => {
    const actorKinds = collectKindsFromSelection(action.actor?.selection);
    const instigatorKinds = collectKindsFromSelection(action.actor?.instigator);
    const targetKinds = collectKindsFromSelection(action.targeting);

    const kindsForRef = (entityRef: string): string[] => {
      if (entityRef === '$actor') return actorKinds;
      if (entityRef === '$instigator') return instigatorKinds;
      if (entityRef === '$target' || entityRef === '$target2') return targetKinds;
      return [];
    };

    (action.outcome?.mutations ?? []).forEach((mutation, idx) => {
      if (mutation.type !== 'create_relationship' && mutation.type !== 'adjust_relationship_strength') return;
      if (!mutation.kind) return;
      const rkDef = relationshipKinds[mutation.kind];
      if (!rkDef) return;
      const srcKinds = mutation.src ? kindsForRef(mutation.src) : [];
      const dstKinds = mutation.dst ? kindsForRef(mutation.dst) : [];
      checkDirectionalCompat(rkDef.srcKinds, srcKinds, 'src', mutation, idx, action.id, usageMap);
      checkDirectionalCompat(rkDef.dstKinds, dstKinds, 'dst', mutation, idx, action.id, usageMap);
    });
  });
}

/**
 * Get validation status for a specific element
 */
export function getElementValidation(usageMap: UsageMap, type: string, id: string): ElementValidationResult {
  const invalidRefs = usageMap.validation.invalidRefs.filter(
    ref => ref.type === type && ref.id === id
  );
  const compatibility = usageMap.validation.compatibility.filter(
    c => c.type === type && c.id === id
  );
  const isOrphan = usageMap.validation.orphans.some(
    o => o.type === type && o.id === id
  );

  return {
    isValid: invalidRefs.length === 0 && compatibility.length === 0,
    invalidRefs,
    compatibility,
    isOrphan,
  };
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count !== 1 ? 's' : ''}`;
}

/**
 * Get usage summary for display
 */
export function getUsageSummary(usage: Partial<Record<string, Ref[]>>): string {
  const labels: Array<[string, string]> = [
    ['generators', 'generator'],
    ['systems', 'system'],
    ['actions', 'action'],
    ['pressures', 'pressure'],
    ['eras', 'era'],
  ];
  const parts = labels
    .filter(([key]) => usage[key] && usage[key].length > 0)
    .map(([key, label]) => pluralize(usage[key]!.length, label));
  return parts.length > 0 ? parts.join(', ') : 'Not used';
}

// ---------------------------------------------------------------------------
// Tag usage computation
// ---------------------------------------------------------------------------

/** Axis definition for semantic planes. */
interface AxisDef {
  id: string;
  name: Optional<string>;
  lowTag: Optional<string>;
  highTag: Optional<string>;
  [key: string]: unknown;
}

/** A seed entity entry. */
interface SeedEntityEntry {
  id: Optional<string>;
  name: Optional<string>;
  kind: Optional<string>;
  subtype: Optional<string>;
  tags: Optional<Record<string, unknown>>;
  [key: string]: unknown;
}

/** Culture definition with naming data. */
interface CultureEntry {
  naming: Optional<{
    profiles: Optional<Array<{
      strategyGroups: Optional<Array<{
        conditions: Optional<{ tags: Optional<string[]>; [key: string]: unknown }>;
        [key: string]: unknown;
      }>>;
      [key: string]: unknown;
    }>>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/** Entity kind entry (for computeTagUsage axis scanning). */
interface EntityKindEntry {
  kind: Optional<string>;
  semanticPlane: Optional<{
    axes: Optional<Record<string, { axisId: Optional<string> } | undefined>>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface ComputeTagUsageParams {
  cultures: Optional<CultureEntry[]>;
  seedEntities: Optional<SeedEntityEntry[]>;
  generators: Optional<GeneratorConfig[]>;
  systems: Optional<SystemConfig[]>;
  pressures: Optional<PressureConfig[]>;
  entityKinds: Optional<EntityKindEntry[]>;
  axisDefinitions: Optional<AxisDef[]>;
}

type TagUsageMap = Partial<Record<string, Partial<Record<string, number>>>>;

function collectTagsFromFilters(filters: SelectionFilter[] | undefined, section: string, usage: TagUsageMap, addTagUsage: (tag: string, sec: string) => void): void {
  (filters ?? []).forEach((filter) => {
    switch (filter.type) {
      case 'has_tag':
      case 'lacks_tag':
        if (filter.tag) addTagUsage(filter.tag, section);
        break;
      case 'has_tags':
      case 'has_any_tag':
      case 'lacks_any_tag':
        (filter.tags ?? []).forEach((tag) => addTagUsage(tag, section));
        break;
      default:
        break;
    }
  });
}

function collectTagsFromCondition(condition: ConditionEntry | null | undefined, section: string, addTagUsage: (tag: string, sec: string) => void): void {
  if (!condition) return;
  switch (condition.type) {
    case 'tag_exists':
    case 'tag_absent':
      if (condition.tag) addTagUsage(condition.tag, section);
      break;
    case 'and':
    case 'or':
      (condition.conditions ?? []).forEach((child) => collectTagsFromCondition(child, section, addTagUsage));
      break;
    default:
      break;
  }
}

function collectTagsFromMutations(mutations: MutationEntry[], section: string, addTagUsage: (tag: string, sec: string) => void): void {
  mutations.forEach((mutation) => {
    if ((mutation.type === 'set_tag' || mutation.type === 'remove_tag') && mutation.tag) {
      addTagUsage(mutation.tag, section);
    }
  });
}

function collectTagsFromVariantApply(tags: Record<string, Record<string, string>> | undefined, addTagUsage: (tag: string, sec: string) => void): void {
  if (!tags || typeof tags !== 'object') return;
  Object.values(tags).forEach((tagMap) => {
    Object.keys(tagMap).forEach(tag => addTagUsage(tag, 'generators'));
  });
}

function collectTagsFromGenerators(generators: GeneratorConfig[], usage: TagUsageMap, addTagUsage: (tag: string, sec: string) => void): void {
  generators.forEach(gen => {
    (gen.creation ?? []).forEach(creation => {
      if (creation.tags && typeof creation.tags === 'object') {
        Object.keys(creation.tags).forEach(tag => addTagUsage(tag, 'generators'));
      }
    });
    (gen.applicability ?? []).forEach((rule) => collectTagsFromCondition(rule, 'generators', addTagUsage));
    collectTagsFromFilters(gen.selection?.filters, 'generators', usage, addTagUsage);
    collectTagsFromMutations(gen.stateUpdates ?? [], 'generators', addTagUsage);
    (gen.variants?.options ?? []).forEach(variant => {
      collectTagsFromCondition(variant.when, 'generators', addTagUsage);
      collectTagsFromVariantApply(variant.apply?.tags, addTagUsage);
      collectTagsFromMutations(variant.apply?.stateUpdates ?? [], 'generators', addTagUsage);
    });
  });
}

function collectTagsFromSystems(systems: SystemConfig[], usage: TagUsageMap, addTagUsage: (tag: string, sec: string) => void): void {
  systems.forEach(sys => {
    const config = sys.config;
    collectTagsFromFilters(config.selection?.filters, 'systems', usage, addTagUsage);
    collectTagsFromFilters(config.multiSource?.sourceSelection?.filters, 'systems', usage, addTagUsage);
    (config.phaseTransitions ?? []).forEach((transition) => {
      collectTagsFromFilters(transition.selection?.filters, 'systems', usage, addTagUsage);
    });
    collectTagsFromSystemType(sys, config, addTagUsage);
  });
}

function collectTagsFromSystemType(sys: SystemConfig, config: SystemInnerConfig, addTagUsage: (tag: string, sec: string) => void): void {
  const collectors: Partial<Record<string, () => void>> = {
    tagDiffusion: () => {
      (config.convergence?.tags ?? []).forEach(tag => addTagUsage(tag, 'systems'));
      (config.divergence?.tags ?? []).forEach(tag => addTagUsage(tag, 'systems'));
    },
    thresholdTrigger: () => {
      (config.conditions ?? []).forEach((cond) => collectTagsFromCondition(cond, 'systems', addTagUsage));
      collectTagsFromMutations(config.actions ?? [], 'systems', addTagUsage);
    },
    graphContagion: () => {
      if (config.contagion?.type === 'tag' && config.contagion.tagPattern) {
        addTagUsage(config.contagion.tagPattern, 'systems');
      }
      collectTagsFromMutations(config.infectionAction ? [config.infectionAction] : [], 'systems', addTagUsage);
    },
    connectionEvolution: () => {
      (config.rules ?? []).forEach((rule) => {
        collectTagsFromMutations(rule.action ? [rule.action] : [], 'systems', addTagUsage);
      });
    },
    clusterFormation: () => {
      (config.metaEntity?.additionalTags ?? []).forEach((tag) => addTagUsage(tag, 'systems'));
    },
    planeDiffusion: () => collectTagsFromPlaneDiffusion(config, addTagUsage),
  };
  const collector = collectors[sys.systemType];
  if (collector) collector();
}

// eslint-disable-next-line complexity -- flat sequential scan of plane diffusion tag fields (sources, sinks, outputTags, dynamicInfluence)
function collectTagsFromPlaneDiffusion(config: SystemInnerConfig, addTagUsage: (tag: string, sec: string) => void): void {
  if (config.sources?.tagFilter) addTagUsage(config.sources.tagFilter, 'systems');
  if (config.sources?.strengthTag) addTagUsage(config.sources.strengthTag, 'systems');
  if (config.sinks?.tagFilter) addTagUsage(config.sinks.tagFilter, 'systems');
  if (config.sinks?.strengthTag) addTagUsage(config.sinks.strengthTag, 'systems');
  (config.outputTags ?? []).forEach((tagConfig) => addTagUsage(tagConfig.tag, 'systems'));
  if (config.valueTag) addTagUsage(config.valueTag, 'systems');
}

function ensureTagUsage(usage: TagUsageMap, tag: string): void {
  if (!usage[tag]) usage[tag] = {};
}

function addTagUsageCount(usage: TagUsageMap, tag: string, section: string): void {
  if (!tag) return;
  ensureTagUsage(usage, tag);
  usage[tag][section] = (usage[tag][section] ?? 0) + 1;
}

type CultureProfile = NonNullable<NonNullable<CultureEntry['naming']>['profiles']>[number];

function collectCultureProfileTags(profiles: CultureProfile[], usage: TagUsageMap): void {
  profiles.forEach(profile => {
    (profile.strategyGroups ?? []).forEach(group => {
      (group.conditions?.tags ?? []).forEach(tag => addTagUsageCount(usage, tag, 'nameforge'));
    });
  });
}

function collectCultureTags(cultures: CultureEntry[], usage: TagUsageMap): void {
  cultures.forEach(culture => {
    collectCultureProfileTags(culture.naming?.profiles ?? [], usage);
  });
}

function collectSeedEntityTags(seedEntities: SeedEntityEntry[], usage: TagUsageMap): void {
  seedEntities.forEach(entity => {
    Object.keys(entity.tags ?? {}).forEach(tag => addTagUsageCount(usage, tag, 'seed'));
  });
}

function collectPressureFactorTags(factors: FeedbackFactor[] | undefined, usage: TagUsageMap): void {
  (factors ?? []).forEach(factor => {
    if (factor.tag) addTagUsageCount(usage, factor.tag, 'pressures');
    if (factor.tags && Array.isArray(factor.tags)) {
      factor.tags.forEach(tag => addTagUsageCount(usage, tag, 'pressures'));
    }
  });
}

function collectPressureTags(pressures: PressureConfig[], usage: TagUsageMap): void {
  pressures.forEach(pressure => {
    collectPressureFactorTags(pressure.growth?.positiveFeedback, usage);
    collectPressureFactorTags(pressure.growth?.negativeFeedback, usage);
  });
}

function collectAxisTags(entityKinds: EntityKindEntry[], axisDefinitions: AxisDef[], usage: TagUsageMap): void {
  const axisById = new Map(axisDefinitions.map(axis => [axis.id, axis]));
  entityKinds.forEach(ek => {
    const axes = ek.semanticPlane?.axes ?? {};
    Object.values(axes).forEach(axisRef => {
      if (!axisRef?.axisId) return;
      const axis = axisById.get(axisRef.axisId);
      if (!axis) return;
      if (axis.lowTag) addTagUsageCount(usage, axis.lowTag, 'axis');
      if (axis.highTag) addTagUsageCount(usage, axis.highTag, 'axis');
    });
  });
}

/**
 * Compute tag usage across all configuration elements.
 */
export function computeTagUsage({
  cultures = [],
  seedEntities = [],
  generators = [],
  systems = [],
  pressures = [],
  entityKinds = [],
  axisDefinitions = [],
}: ComputeTagUsageParams = {}): TagUsageMap {
  const usage: TagUsageMap = {};
  const addTag = (tag: string, section: string): void => addTagUsageCount(usage, tag, section);

  collectCultureTags(cultures, usage);
  collectSeedEntityTags(seedEntities, usage);
  collectTagsFromGenerators(generators, usage, addTag);
  collectTagsFromSystems(systems, usage, addTag);
  collectPressureTags(pressures, usage);
  collectAxisTags(entityKinds, axisDefinitions, usage);

  return usage;
}

// ---------------------------------------------------------------------------
// Schema usage (simpler badge-oriented computation)
// ---------------------------------------------------------------------------

interface SchemaUsageEntityKind {
  generators: string[];
  systems: string[];
  actions: string[];
  pressures: string[];
  seeds: string[];
}

interface SchemaUsageRelKind {
  generators: string[];
  systems: string[];
  actions: string[];
}

interface SchemaUsageSubtypeEntry {
  generators: string[];
  systems: string[];
  seeds: string[];
}

interface SchemaUsageStatusEntry {
  generators: string[];
  systems: string[];
}

export interface SchemaUsage {
  entityKinds: Partial<Record<string, SchemaUsageEntityKind>>;
  relationshipKinds: Partial<Record<string, SchemaUsageRelKind>>;
  subtypes: Partial<Record<string, Partial<Record<string, SchemaUsageSubtypeEntry>>>>;
  statuses: Partial<Record<string, Partial<Record<string, SchemaUsageStatusEntry>>>>;
}

/**
 * Get a summary of usage for an entity kind (for cross-tool badges).
 */
export function getEntityKindUsageSummary(
  schemaUsage: SchemaUsage | null | undefined,
  kind: string,
): { coherence: number; seed: Optional<number> } {
  const usage = schemaUsage?.entityKinds[kind];
  if (!usage) return { coherence: 0 };

  const coherenceTotal =
    usage.generators.length +
    usage.systems.length +
    usage.actions.length +
    usage.pressures.length;

  const seedTotal = usage.seeds.length;

  return {
    coherence: coherenceTotal,
    ...(seedTotal > 0 && { seed: seedTotal }),
  };
}

/**
 * Get a summary of usage for a relationship kind (for cross-tool badges).
 */
export function getRelationshipKindUsageSummary(
  schemaUsage: SchemaUsage | null | undefined,
  kind: string,
): { coherence: number } {
  const usage = schemaUsage?.relationshipKinds[kind];
  if (!usage) return { coherence: 0 };

  const total =
    usage.generators.length +
    usage.systems.length +
    usage.actions.length;

  return { coherence: total };
}

export interface ComputeSchemaUsageParams {
  generators: Optional<GeneratorConfig[]>;
  systems: Optional<SystemConfig[]>;
  actions: Optional<ActionConfig[]>;
  pressures: Optional<PressureConfig[]>;
  seedEntities: Optional<SeedEntityEntry[]>;
}

function recordSchemaSelectionUsage(selection: SelectionRule | undefined, section: string, id: string, usage: SchemaUsage): void {
  if (!selection) return;
  if (selection.kind) addSchemaEntityKindUsage(selection.kind, section, id, usage);
  (selection.kinds ?? []).forEach((kind) => addSchemaEntityKindUsage(kind, section, id, usage));
}

function addSchemaEntityKindUsage(kind: string, section: string, id: string, usage: SchemaUsage): void {
  if (!kind || kind === 'any') return;
  if (!usage.entityKinds[kind]) {
    usage.entityKinds[kind] = { generators: [], systems: [], actions: [], pressures: [], seeds: [] };
  }
  usage.entityKinds[kind][section as keyof SchemaUsageEntityKind].push(id);
}

function addSchemaRelKindUsage(kind: string, section: string, id: string, usage: SchemaUsage): void {
  if (!kind) return;
  if (!usage.relationshipKinds[kind]) {
    usage.relationshipKinds[kind] = { generators: [], systems: [], actions: [] };
  }
  usage.relationshipKinds[kind][section as keyof SchemaUsageRelKind].push(id);
}

function addSchemaSubtypeUsage(entityKind: string, subtype: string, section: string, id: string, usage: SchemaUsage): void {
  if (!entityKind || !subtype) return;
  if (!usage.subtypes[entityKind]) usage.subtypes[entityKind] = {};
  if (!usage.subtypes[entityKind][subtype]) {
    usage.subtypes[entityKind][subtype] = { generators: [], systems: [], seeds: [] };
  }
  usage.subtypes[entityKind][subtype][section as keyof SchemaUsageSubtypeEntry].push(id);
}

function addSchemaStatusUsage(entityKind: string, status: string, section: string, id: string, usage: SchemaUsage): void {
  if (!entityKind || !status) return;
  if (!usage.statuses[entityKind]) usage.statuses[entityKind] = {};
  if (!usage.statuses[entityKind][status]) {
    usage.statuses[entityKind][status] = { generators: [], systems: [] };
  }
  usage.statuses[entityKind][status][section as keyof SchemaUsageStatusEntry].push(id);
}

function recordSchemaConditionUsage(condition: ConditionEntry | null | undefined, section: string, id: string, usage: SchemaUsage): void {
  if (!condition) return;
  const handlers: Partial<Record<string, () => void>> = {
    entity_count: () => {
      if (condition.kind) addSchemaEntityKindUsage(condition.kind, section, id, usage);
      if (condition.kind && condition.subtype) addSchemaSubtypeUsage(condition.kind, condition.subtype, section, id, usage);
      if (condition.kind && condition.status) addSchemaStatusUsage(condition.kind, condition.status, section, id, usage);
    },
    relationship_count: () => { if (condition.relationshipKind) addSchemaRelKindUsage(condition.relationshipKind, section, id, usage); },
    relationship_exists: () => { if (condition.relationshipKind) addSchemaRelKindUsage(condition.relationshipKind, section, id, usage); },
    entity_has_relationship: () => { if (condition.relationshipKind) addSchemaRelKindUsage(condition.relationshipKind, section, id, usage); },
    and: () => (condition.conditions ?? []).forEach((child) => recordSchemaConditionUsage(child, section, id, usage)),
    or: () => (condition.conditions ?? []).forEach((child) => recordSchemaConditionUsage(child, section, id, usage)),
  };
  if (!condition.type) return;
  const handler = handlers[condition.type];
  if (handler) handler();
}

function recordSchemaMutationUsage(mutation: MutationEntry | null | undefined, section: string, id: string, usage: SchemaUsage): void {
  if (!mutation) return;
  if (mutation.type === 'create_relationship' || mutation.type === 'adjust_relationship_strength') {
    if (mutation.kind) addSchemaRelKindUsage(mutation.kind, section, id, usage);
  } else if (mutation.type === 'archive_relationship') {
    if (mutation.relationshipKind) addSchemaRelKindUsage(mutation.relationshipKind, section, id, usage);
  }
}

function computeSchemaUsageGenerators(generators: GeneratorConfig[], usage: SchemaUsage): void {
  generators.forEach((gen) => {
    const genId = gen.id;
    // eslint-disable-next-line complexity -- creation entry kind/subtype/status extraction with random-subtype variant detection
    (gen.creation ?? []).forEach((c) => {
      const kind = typeof c.kind === 'string' ? c.kind : null;
      if (kind) addSchemaEntityKindUsage(kind, 'generators', genId, usage);
      if (kind && typeof c.subtype === 'string') {
        addSchemaSubtypeUsage(kind, c.subtype, 'generators', genId, usage);
      } else if (kind && c.subtype && typeof c.subtype === 'object' && 'random' in c.subtype && Array.isArray(c.subtype.random)) {
        c.subtype.random.forEach((subtype) => addSchemaSubtypeUsage(kind, subtype, 'generators', genId, usage));
      }
      if (kind && typeof c.status === 'string') {
        addSchemaStatusUsage(kind, c.status, 'generators', genId, usage);
      }
    });
    recordSchemaSelectionUsage(gen.selection, 'generators', genId, usage);
    (gen.applicability ?? []).forEach((rule) => recordSchemaConditionUsage(rule, 'generators', genId, usage));
    (gen.relationships ?? []).forEach((rel) => {
      if (rel.kind) addSchemaRelKindUsage(rel.kind, 'generators', genId, usage);
    });
    (gen.creation ?? []).forEach((c) => {
      const lineage = c as Record<string, unknown>;
      const lin = lineage.lineage as Record<string, unknown> | undefined;
      if (lin?.relationshipKind && typeof lin.relationshipKind === 'string') {
        addSchemaRelKindUsage(lin.relationshipKind, 'generators', genId, usage);
      }
    });
    (gen.stateUpdates ?? []).forEach((mutation) => recordSchemaMutationUsage(mutation, 'generators', genId, usage));
    (gen.variants?.options ?? []).forEach((variant) => {
      recordSchemaConditionUsage(variant.when, 'generators', genId, usage);
      (variant.apply?.relationships ?? []).forEach((rel) => {
        if (rel.kind) addSchemaRelKindUsage(rel.kind, 'generators', genId, usage);
      });
      (variant.apply?.stateUpdates ?? []).forEach((mutation) => recordSchemaMutationUsage(mutation, 'generators', genId, usage));
    });
  });
}

function computeSchemaUsageSystems(systems: SystemConfig[], usage: SchemaUsage): void {
  systems.forEach((sys) => {
    const cfg = sys.config;
    const sysId = cfg.id;
    recordSchemaSelectionUsage(cfg.selection, 'systems', sysId, usage);
    computeSchemaUsageSystemType(sys, cfg, sysId, usage);
  });
}

function computeSchemaContagionUsage(cfg: SystemInnerConfig, sysId: string, usage: SchemaUsage): void {
  if (cfg.contagion?.relationshipKind) addSchemaRelKindUsage(cfg.contagion.relationshipKind, 'systems', sysId, usage);
  (cfg.vectors ?? []).forEach((vector) => {
    if (vector.relationshipKind) addSchemaRelKindUsage(vector.relationshipKind, 'systems', sysId, usage);
  });
  if (cfg.infectionAction) recordSchemaMutationUsage(cfg.infectionAction, 'systems', sysId, usage);
  if (cfg.multiSource?.sourceSelection) recordSchemaSelectionUsage(cfg.multiSource.sourceSelection, 'systems', sysId, usage);
  (cfg.phaseTransitions ?? []).forEach((transition) => {
    recordSchemaSelectionUsage(transition.selection, 'systems', sysId, usage);
  });
}

function computeSchemaUsageSystemType(sys: SystemConfig, cfg: SystemInnerConfig, sysId: string, usage: SchemaUsage): void {
  const handlers: Partial<Record<string, () => void>> = {
    graphContagion: () => computeSchemaContagionUsage(cfg, sysId, usage),
    thresholdTrigger: () => {
      (cfg.conditions ?? []).forEach((condition) => recordSchemaConditionUsage(condition, 'systems', sysId, usage));
      (cfg.actions ?? []).forEach((mutation) => recordSchemaMutationUsage(mutation, 'systems', sysId, usage));
      if (cfg.clusterRelationshipKind) addSchemaRelKindUsage(cfg.clusterRelationshipKind, 'systems', sysId, usage);
    },
    connectionEvolution: () => {
      (cfg.metric?.relationshipKinds ?? []).forEach((kind) => addSchemaRelKindUsage(kind, 'systems', sysId, usage));
      if (cfg.metric?.sharedRelationshipKind) addSchemaRelKindUsage(cfg.metric.sharedRelationshipKind, 'systems', sysId, usage);
      (cfg.rules ?? []).forEach((rule) => recordSchemaMutationUsage(rule.action, 'systems', sysId, usage));
    },
    tagDiffusion: () => {
      if (cfg.connectionKind) addSchemaRelKindUsage(cfg.connectionKind, 'systems', sysId, usage);
    },
    clusterFormation: () => {
      if (cfg.metaEntity?.kind) addSchemaEntityKindUsage(cfg.metaEntity.kind, 'systems', sysId, usage);
      (cfg.clustering?.criteria ?? []).forEach((criterion) => {
        if (criterion.type === 'shared_relationship' && criterion.relationshipKind) {
          addSchemaRelKindUsage(criterion.relationshipKind, 'systems', sysId, usage);
        }
      });
    },
  };
  const handler = handlers[sys.systemType];
  if (handler) handler();
}

/**
 * Compute schema element usage (simpler version for badge display).
 *
 * Unlike computeUsageMap which focuses on validation, this function tracks
 * usage counts including seed entities for display in Canonry's schema editors.
 */
export function computeSchemaUsage({
  generators = [],
  systems = [],
  actions = [],
  pressures: _pressures = [],
  seedEntities = [],
}: ComputeSchemaUsageParams = {}): SchemaUsage {
  const usage: SchemaUsage = {
    entityKinds: {},
    relationshipKinds: {},
    subtypes: {},
    statuses: {},
  };

  computeSchemaUsageGenerators(generators, usage);
  computeSchemaUsageSystems(systems, usage);

  // Analyze actions
  actions.forEach((action) => {
    const actionId = action.id;
    recordSchemaSelectionUsage(action.actor?.selection, 'actions', actionId, usage);
    recordSchemaSelectionUsage(action.targeting, 'actions', actionId, usage);
    (action.outcome?.mutations ?? []).forEach((mutation) => recordSchemaMutationUsage(mutation, 'actions', actionId, usage));
  });

  // Analyze seed entities
  seedEntities.forEach((entity) => {
    const entityLabel = entity.name ?? entity.id ?? 'unnamed seed';
    if (entity.kind) {
      addSchemaEntityKindUsage(entity.kind, 'seeds', entityLabel, usage);
    }
    if (entity.kind && entity.subtype) {
      addSchemaSubtypeUsage(entity.kind, entity.subtype, 'seeds', entityLabel, usage);
    }
  });

  return usage;
}
