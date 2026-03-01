/**
 * Validation Rules - SEMANTIC/REFERENCE VALIDATION
 *
 * These rules validate the semantic coherence of the world configuration:
 * - Reference integrity (do referenced entity kinds, pressures, etc. exist?)
 * - Balance analysis (pressures have sources and sinks?)
 * - Dead code detection (orphan generators/systems not in any era?)
 * - Cross-reference consistency (tags, cultures, subtypes)
 *
 * BOUNDARY: This does NOT handle structure validation (handled by configSchemaValidator):
 * - Required fields present
 * - Correct types (string, number, object, array)
 * - Valid shapes (CultureSpec, SubtypeSpec, generator format)
 *
 * Structure errors are caught before simulation run as a hard gate.
 * Coherence issues are displayed in the Coherence Engine tab as editorial guidance.
 *
 * NOTE: This module uses the usageMap from @the-canonry/shared-components computeUsageMap
 * for reference validation. This ensures a single source of truth for all validation logic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvalidRef {
  refType: string;
  refId: string | Record<string, unknown>;
  type?: string;
  id?: string;
  location: string;
}

interface OrphanEntry {
  type: string;
  id: string;
  reason: string;
}

interface CompatibilityIssue {
  type: string;
  id: string;
  field: string;
  issue: string;
}

interface TagUsage {
  generators?: string[];
  systems?: string[];
  pressures?: string[];
  actions?: string[];
}

interface UsageMapValidation {
  invalidRefs?: InvalidRef[];
  orphans?: OrphanEntry[];
  compatibility?: CompatibilityIssue[];
}

interface UsageMap {
  validation?: UsageMapValidation;
  tags?: Record<string, TagUsage>;
}

interface SubtypeDef {
  id: string;
  name?: string;
}

interface StatusDef {
  id: string;
  name?: string;
}

interface SemanticRegion {
  id: string;
  culture?: string;
}

interface SemanticPlane {
  regions?: SemanticRegion[];
}

interface EntityKindDef {
  kind: string;
  subtypes?: SubtypeDef[];
  statuses?: StatusDef[];
  semanticPlane?: SemanticPlane;
}

interface CultureDef {
  id: string;
  name?: string;
}

interface TagRegistryEntry {
  tag: string;
  conflictingTags?: string[];
}

interface Schema {
  entityKinds?: EntityKindDef[];
  cultures?: CultureDef[];
  tagRegistry?: TagRegistryEntry[];
}

interface StateUpdate {
  type: string;
  pressureId?: string;
  delta?: number;
}

interface CreationSpec {
  kind?: string;
  subtype?: string | { random?: string[]; inherit?: unknown };
  status?: string;
  tags?: Record<string, boolean>;
}

interface Generator {
  id: string;
  name?: string;
  enabled?: boolean;
  stateUpdates?: StateUpdate[];
  creation?: CreationSpec[];
}

interface MutationAction {
  type?: string;
  pressureId?: string;
  delta?: number;
}

interface SystemRule {
  action?: MutationAction;
}

interface SystemConfig {
  pressureChanges?: Record<string, number>;
  actions?: MutationAction[];
  infectionAction?: MutationAction;
  rules?: SystemRule[];
}

interface System {
  id: string;
  name?: string;
  config: SystemConfig;
}

interface PressureGrowth {
  positiveFeedback?: PressureFactor[];
  negativeFeedback?: PressureFactor[];
}

interface PressureFactor {
  kind?: string;
  subtype?: string;
  numerator?: { kind?: string; subtype?: string };
}

interface Pressure {
  id: string;
  name?: string;
  initialValue?: number;
  homeostasis?: number;
  growth?: PressureGrowth;
}

interface Era {
  id: string;
  templateWeights?: Record<string, number>;
  systemModifiers?: Record<string, number>;
}

interface AffectedItem {
  id: string;
  label: string;
  detail: string;
}

type Severity = "error" | "warning";

interface ValidationResult {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  affectedItems: AffectedItem[];
}

interface ValidationResults {
  errors: ValidationResult[];
  warnings: ValidationResult[];
}

type OverallStatus = "error" | "warning" | "clean";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function groupInvalidRefsByKey(
  refs: InvalidRef[],
): Record<string, InvalidRef[]> {
  const grouped: Record<string, InvalidRef[]> = {};
  for (const r of refs) {
    const key =
      typeof r.refId === "object" ? JSON.stringify(r.refId) : String(r.refId);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  return grouped;
}

function buildInvalidRefResult(
  id: string,
  title: string,
  message: string,
  severity: Severity,
  invalid: InvalidRef[],
): ValidationResult {
  const grouped = groupInvalidRefsByKey(invalid);
  return {
    id,
    title,
    message,
    severity,
    affectedItems: Object.entries(grouped).map(([kind, sources]) => ({
      id: kind,
      label: kind,
      detail: `Referenced by: ${sources.map((s) => s.location).join(", ")}`,
    })),
  };
}

/** Collect all mutation-like actions from a system's config */
function collectMutationActions(cfg: SystemConfig): MutationAction[] {
  const actions: MutationAction[] = [];
  if (Array.isArray(cfg.actions)) actions.push(...cfg.actions);
  if (cfg.infectionAction) actions.push(cfg.infectionAction);
  if (Array.isArray(cfg.rules)) {
    for (const rule of cfg.rules) {
      if (rule?.action) actions.push(rule.action);
    }
  }
  return actions;
}

/** Scan generators for pressure mutations matching a delta predicate */
function collectGeneratorPressureIds(
  generators: Generator[],
  deltaPredicate: (d: number) => boolean,
): Set<string> {
  const ids = new Set<string>();
  for (const gen of generators) {
    if (gen.enabled === false) continue;
    if (!gen.stateUpdates) continue;
    for (const u of gen.stateUpdates) {
      if (
        u.type === "modify_pressure" &&
        u.pressureId &&
        u.delta !== undefined &&
        deltaPredicate(u.delta)
      ) {
        ids.add(u.pressureId);
      }
    }
  }
  return ids;
}

/** Scan systems for pressure changes matching a delta predicate */
function collectSystemPressureIds(
  systems: System[],
  deltaPredicate: (d: number) => boolean,
): Set<string> {
  const ids = new Set<string>();
  for (const sys of systems) {
    const cfg = sys.config;
    if (cfg.pressureChanges) {
      for (const [pId, delta] of Object.entries(cfg.pressureChanges)) {
        if (deltaPredicate(delta)) ids.add(pId);
      }
    }
    for (const mutation of collectMutationActions(cfg)) {
      if (
        mutation?.type === "modify_pressure" &&
        mutation.pressureId &&
        mutation.delta !== undefined &&
        deltaPredicate(mutation.delta)
      ) {
        ids.add(mutation.pressureId);
      }
    }
  }
  return ids;
}

/** Build a map of valid subtype IDs keyed by entity kind */
function buildSubtypesByKind(
  schema: Schema,
): Record<string, Set<string>> {
  const result: Record<string, Set<string>> = {};
  for (const ek of schema.entityKinds ?? []) {
    result[ek.kind] = new Set((ek.subtypes ?? []).map((s) => s.id));
  }
  return result;
}

/** Validate random-array subtypes in a creation spec */
function validateCreationSubtypes(
  creation: CreationSpec,
  subtypesByKind: Record<string, Set<string>>,
  genId: string,
): { kind: string; subtype: string; source: string }[] {
  const invalid: { kind: string; subtype: string; source: string }[] = [];
  if (!creation.kind || !creation.subtype || !subtypesByKind[creation.kind]) {
    return invalid;
  }

  if (typeof creation.subtype === "object") {
    const sub = creation.subtype as { random?: string[]; inherit?: unknown };
    if (sub.random && Array.isArray(sub.random)) {
      for (const st of sub.random) {
        if (!subtypesByKind[creation.kind].has(st)) {
          invalid.push({ kind: creation.kind, subtype: st, source: `generator "${genId}"` });
        }
      }
    }
    return invalid;
  }

  if (!subtypesByKind[creation.kind].has(creation.subtype)) {
    invalid.push({
      kind: creation.kind,
      subtype: creation.subtype,
      source: `generator "${genId}"`,
    });
  }
  return invalid;
}

/** Validate subtypes referenced in pressure factors */
function validatePressureFactorSubtypes(
  factors: PressureFactor[],
  subtypesByKind: Record<string, Set<string>>,
  source: string,
): { kind: string; subtype: string; source: string }[] {
  const invalid: { kind: string; subtype: string; source: string }[] = [];
  for (const f of factors) {
    if (f.kind && f.subtype && subtypesByKind[f.kind]) {
      if (!subtypesByKind[f.kind].has(f.subtype)) {
        invalid.push({ kind: f.kind, subtype: f.subtype, source });
      }
    }
    if (f.numerator?.kind && f.numerator?.subtype && subtypesByKind[f.numerator.kind]) {
      if (!subtypesByKind[f.numerator.kind].has(f.numerator.subtype)) {
        invalid.push({
          kind: f.numerator.kind,
          subtype: f.numerator.subtype,
          source,
        });
      }
    }
  }
  return invalid;
}

/** Check a creation spec's assigned tags for mutual conflicts */
function findConflictingTagPairs(
  creation: CreationSpec,
  conflictMap: Record<string, Set<string>>,
  genId: string,
): { generator: string; tagA: string; tagB: string; entityKind: string | undefined }[] {
  const issues: {
    generator: string;
    tagA: string;
    tagB: string;
    entityKind: string | undefined;
  }[] = [];
  if (!creation.tags || typeof creation.tags !== "object") return issues;

  const assignedTags = Object.keys(creation.tags).filter(
    (t) => creation.tags![t] === true,
  );
  for (let i = 0; i < assignedTags.length; i++) {
    for (let j = i + 1; j < assignedTags.length; j++) {
      const tagA = assignedTags[i];
      const tagB = assignedTags[j];
      if (conflictMap[tagA]?.has(tagB) || conflictMap[tagB]?.has(tagA)) {
        issues.push({ generator: genId, tagA, tagB, entityKind: creation.kind });
      }
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------

export const validationRules = {
  /**
   * 1. Invalid Entity Kind References (ERROR)
   */
  invalidEntityKind(usageMap: UsageMap): ValidationResult | null {
    const invalid = (usageMap?.validation?.invalidRefs ?? []).filter(
      (r) => r.refType === "entityKind",
    );
    if (invalid.length === 0) return null;
    return buildInvalidRefResult(
      "invalid-entity-kind",
      "Invalid entity kind references",
      "These configurations reference entity kinds that do not exist in the schema. This will cause runtime crashes.",
      "error",
      invalid,
    );
  },

  /**
   * 2. Invalid Relationship Kind References (ERROR)
   */
  invalidRelationshipKind(usageMap: UsageMap): ValidationResult | null {
    const invalid = (usageMap?.validation?.invalidRefs ?? []).filter(
      (r) => r.refType === "relationshipKind",
    );
    if (invalid.length === 0) return null;
    return buildInvalidRefResult(
      "invalid-relationship-kind",
      "Invalid relationship kind references",
      "These configurations reference relationship kinds that do not exist in the schema. This will cause runtime crashes or silent failures.",
      "error",
      invalid,
    );
  },

  /**
   * 3. Invalid Pressure ID References (ERROR)
   */
  invalidPressureId(usageMap: UsageMap): ValidationResult | null {
    const invalid = (usageMap?.validation?.invalidRefs ?? []).filter(
      (r) => r.refType === "pressure",
    );
    if (invalid.length === 0) return null;
    return buildInvalidRefResult(
      "invalid-pressure-id",
      "Invalid pressure ID references",
      "These configurations reference pressure IDs that do not exist. This will cause runtime failures when evaluating or modifying pressures.",
      "error",
      invalid,
    );
  },

  /**
   * 4. Invalid Era Template References (ERROR)
   */
  invalidEraTemplateRef(usageMap: UsageMap): ValidationResult | null {
    const invalid = (usageMap?.validation?.invalidRefs ?? []).filter(
      (r) => r.refType === "generator" && r.type === "era",
    );
    if (invalid.length === 0) return null;
    return {
      id: "invalid-era-template-ref",
      title: "Invalid generator references in eras",
      message:
        "These eras reference generators that do not exist. The weights will have no effect.",
      severity: "error",
      affectedItems: invalid.map((i) => ({
        id: `${i.id}:${i.refId}`,
        label: String(i.refId),
        detail: i.location,
      })),
    };
  },

  /**
   * 5. Invalid Era System References (ERROR)
   */
  invalidEraSystemRef(usageMap: UsageMap): ValidationResult | null {
    const invalid = (usageMap?.validation?.invalidRefs ?? []).filter(
      (r) => r.refType === "system" && r.type === "era",
    );
    if (invalid.length === 0) return null;
    return {
      id: "invalid-era-system-ref",
      title: "Invalid system references in eras",
      message:
        "These eras reference systems that do not exist. The modifiers will have no effect.",
      severity: "error",
      affectedItems: invalid.map((i) => ({
        id: `${i.id}:${i.refId}`,
        label: String(i.refId),
        detail: i.location,
      })),
    };
  },

  /**
   * 6. Pressure Without Sources (WARNING)
   */
  pressureWithoutSources(
    _usageMap: UsageMap,
    pressures: Pressure[],
    generators: Generator[],
    systems: System[],
  ): ValidationResult | null {
    const pressuresWithSources = new Set([
      ...collectGeneratorPressureIds(generators, (d) => d > 0),
      ...collectSystemPressureIds(systems, (d) => d > 0),
    ]);

    for (const p of pressures) {
      if ((p.growth?.positiveFeedback?.length ?? 0) > 0) {
        pressuresWithSources.add(p.id);
      }
    }

    const withoutSources = pressures.filter(
      (p) => !pressuresWithSources.has(p.id),
    );
    if (withoutSources.length === 0) return null;

    return {
      id: "pressure-without-sources",
      title: "Pressures without sources",
      message:
        "These pressures have no positive drivers (no generators/systems increase them, no positiveFeedback). They will be pulled toward equilibrium unless something else raises them.",
      severity: "warning",
      affectedItems: withoutSources.map((p) => ({
        id: p.id,
        label: p.name ?? p.id,
        detail: `Homeostasis: ${p.homeostasis ?? 0}, no sources found`,
      })),
    };
  },

  /**
   * 7. Pressure Without Sinks (WARNING)
   */
  pressureWithoutSinks(
    _usageMap: UsageMap,
    pressures: Pressure[],
    generators: Generator[],
    systems: System[],
  ): ValidationResult | null {
    const pressuresWithSinks = new Set([
      ...collectGeneratorPressureIds(generators, (d) => d < 0),
      ...collectSystemPressureIds(systems, (d) => d < 0),
    ]);

    for (const p of pressures) {
      if ((p.homeostasis ?? 0) > 0 || (p.growth?.negativeFeedback?.length ?? 0) > 0) {
        pressuresWithSinks.add(p.id);
      }
    }

    const withoutSinks = pressures.filter(
      (p) => !pressuresWithSinks.has(p.id),
    );
    if (withoutSinks.length === 0) return null;

    return {
      id: "pressure-without-sinks",
      title: "Pressures without sinks",
      message:
        "These pressures have no negative drivers (no homeostasis, no negativeFeedback, nothing decreases them). They can drift to extremes.",
      severity: "warning",
      affectedItems: withoutSinks.map((p) => ({
        id: p.id,
        label: p.name ?? p.id,
        detail: `Homeostasis: ${p.homeostasis ?? 0}`,
      })),
    };
  },

  /**
   * 8. Orphan Generators (WARNING)
   */
  orphanGenerators(usageMap: UsageMap): ValidationResult | null {
    const orphans = (usageMap?.validation?.orphans ?? []).filter(
      (o) => o.type === "generator",
    );
    if (orphans.length === 0) return null;
    return {
      id: "orphan-generators",
      title: "Generators not referenced in any era",
      message:
        "These generators are not referenced in any era's templateWeights. They will never execute during simulation.",
      severity: "warning",
      affectedItems: orphans.map((o) => ({
        id: o.id,
        label: o.id,
        detail: o.reason,
      })),
    };
  },

  /**
   * 9. Orphan Systems (WARNING)
   */
  orphanSystems(usageMap: UsageMap): ValidationResult | null {
    const orphans = (usageMap?.validation?.orphans ?? []).filter(
      (o) => o.type === "system",
    );
    if (orphans.length === 0) return null;
    return {
      id: "orphan-systems",
      title: "Systems not referenced in any era",
      message:
        "These systems are not referenced in any era's systemModifiers. They may not run with intended weights.",
      severity: "warning",
      affectedItems: orphans.map((o) => ({
        id: o.id,
        label: o.id,
        detail: o.reason,
      })),
    };
  },

  /**
   * 10. Zero-Weight Generators in All Eras (WARNING)
   */
  zeroWeightGenerators(
    _usageMap: UsageMap,
    eras: Era[],
    generators: Generator[],
  ): ValidationResult | null {
    const zeroInAll: Generator[] = [];
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      const isReferenced = eras.some(
        (e) => e.templateWeights?.[gen.id] !== undefined,
      );
      if (!isReferenced) continue;
      const hasNonZeroWeight = eras.some((e) => {
        const w = e.templateWeights?.[gen.id];
        return w !== undefined && w > 0;
      });
      if (!hasNonZeroWeight) zeroInAll.push(gen);
    }
    if (zeroInAll.length === 0) return null;
    return {
      id: "zero-weight-generators",
      title: "Generators with zero weight in all eras",
      message:
        "These generators are referenced in era templateWeights but always have weight 0. They are effectively disabled but not obviously so.",
      severity: "warning",
      affectedItems: zeroInAll.map((g) => ({
        id: g.id,
        label: g.name ?? g.id,
        detail: "Weight is 0 in all eras where referenced",
      })),
    };
  },

  /**
   * 11. Invalid Subtype References (WARNING)
   */
  invalidSubtypeRef(
    _usageMap: UsageMap,
    schema: Schema,
    generators: Generator[],
    pressures: Pressure[],
  ): ValidationResult | null {
    const subtypesByKind = buildSubtypesByKind(schema);
    const invalid: { kind: string; subtype: string; source: string }[] = [];

    for (const gen of generators) {
      if (gen.enabled === false || !gen.creation) continue;
      for (const c of gen.creation) {
        invalid.push(...validateCreationSubtypes(c, subtypesByKind, gen.id));
      }
    }

    for (const p of pressures) {
      const src = `pressure "${p.id}"`;
      invalid.push(
        ...validatePressureFactorSubtypes(p.growth?.positiveFeedback ?? [], subtypesByKind, src),
        ...validatePressureFactorSubtypes(p.growth?.negativeFeedback ?? [], subtypesByKind, src),
      );
    }

    if (invalid.length === 0) return null;
    return {
      id: "invalid-subtype-ref",
      title: "Invalid subtype references",
      message:
        "These configurations reference subtypes that do not exist for the specified entity kind.",
      severity: "warning",
      affectedItems: invalid.map((i, idx) => {
        const subtypeStr =
          typeof i.subtype === "object"
            ? JSON.stringify(i.subtype)
            : i.subtype;
        return {
          id: `${i.kind}:${subtypeStr}:${i.source}:${idx}`,
          label: `${i.kind}:${subtypeStr}`,
          detail: `In ${i.source}`,
        };
      }),
    };
  },

  /**
   * 12. Invalid Status References (WARNING)
   */
  invalidStatusRef(
    _usageMap: UsageMap,
    schema: Schema,
    generators: Generator[],
  ): ValidationResult | null {
    const statusesByKind: Record<string, Set<string>> = {};
    for (const ek of schema.entityKinds ?? []) {
      statusesByKind[ek.kind] = new Set((ek.statuses ?? []).map((s) => s.id));
    }

    const invalid: { kind: string; status: string; source: string }[] = [];
    for (const gen of generators) {
      if (gen.enabled === false || !gen.creation) continue;
      for (const c of gen.creation) {
        if (c.kind && c.status && statusesByKind[c.kind]) {
          if (!statusesByKind[c.kind].has(c.status)) {
            invalid.push({ kind: c.kind, status: c.status, source: `generator "${gen.id}"` });
          }
        }
      }
    }

    if (invalid.length === 0) return null;
    return {
      id: "invalid-status-ref",
      title: "Invalid status references",
      message:
        "These generators set entity statuses that are not valid for the entity kind.",
      severity: "warning",
      affectedItems: invalid.map((i, idx) => ({
        id: `${i.kind}:${i.status}:${i.source}:${idx}`,
        label: `${i.kind} status "${i.status}"`,
        detail: `In ${i.source}`,
      })),
    };
  },

  /**
   * 13. Invalid Culture References (WARNING)
   */
  invalidCultureRef(
    _usageMap: UsageMap,
    schema: Schema,
  ): ValidationResult | null {
    const validCultures = new Set(
      (schema.cultures ?? []).map((c) => c.id),
    );
    const invalid: { culture: string; source: string }[] = [];

    for (const ek of schema.entityKinds ?? []) {
      for (const r of ek.semanticPlane?.regions ?? []) {
        if (r.culture && !validCultures.has(r.culture)) {
          invalid.push({ culture: r.culture, source: `${ek.kind} region "${r.id}"` });
        }
      }
    }

    if (invalid.length === 0) return null;
    return {
      id: "invalid-culture-ref",
      title: "Invalid culture references",
      message:
        "These semantic plane regions reference cultures that do not exist. Name generation may fail.",
      severity: "warning",
      affectedItems: invalid.map((i) => ({
        id: i.culture,
        label: i.culture,
        detail: `In ${i.source}`,
      })),
    };
  },

  /**
   * 14. Undefined Tag References (WARNING)
   */
  undefinedTagRefs(
    usageMap: UsageMap,
    schema: Schema,
  ): ValidationResult | null {
    const definedTags = new Set(
      (schema.tagRegistry ?? []).map((t) => t.tag),
    );
    const referencedTags = new Set(Object.keys(usageMap?.tags ?? {}));
    const undefinedTags = [...referencedTags].filter(
      (tag) => !definedTags.has(tag),
    );

    if (undefinedTags.length === 0) return null;
    return {
      id: "undefined-tag-refs",
      title: "Tags used but not in registry",
      message:
        "These tags are referenced in generators, systems, or pressures but are not defined in the tag registry. They will still work at runtime but lack metadata like conflictingTags.",
      severity: "warning",
      affectedItems: undefinedTags.map((tag) => {
        const usage = usageMap.tags![tag];
        const sources: string[] = [];
        if (usage.generators?.length)
          sources.push(`${usage.generators.length} generators`);
        if (usage.systems?.length)
          sources.push(`${usage.systems.length} systems`);
        if (usage.pressures?.length)
          sources.push(`${usage.pressures.length} pressures`);
        if (usage.actions?.length)
          sources.push(`${usage.actions.length} actions`);
        return {
          id: tag,
          label: tag,
          detail: `Used by: ${sources.join(", ") || "unknown"}`,
        };
      }),
    };
  },

  /**
   * 15. Conflicting Tags (WARNING)
   */
  conflictingTagsInUse(
    _usageMap: UsageMap,
    schema: Schema,
    generators: Generator[],
  ): ValidationResult | null {
    const tagRegistry = schema.tagRegistry ?? [];
    const conflictMap: Record<string, Set<string>> = {};
    for (const t of tagRegistry) {
      if (t.conflictingTags && t.conflictingTags.length > 0) {
        conflictMap[t.tag] = new Set(t.conflictingTags);
      }
    }

    const issues: {
      generator: string;
      tagA: string;
      tagB: string;
      entityKind: string | undefined;
    }[] = [];

    for (const gen of generators) {
      if (gen.enabled === false || !gen.creation) continue;
      for (const c of gen.creation) {
        issues.push(...findConflictingTagPairs(c, conflictMap, gen.id));
      }
    }

    if (issues.length === 0) return null;
    return {
      id: "conflicting-tags-in-use",
      title: "Conflicting tags assigned together",
      message:
        "These generators assign tags that are marked as conflicting in the tag registry. This may produce semantically inconsistent entities.",
      severity: "warning",
      affectedItems: issues.map((i, idx) => ({
        id: `${i.generator}:${i.tagA}:${i.tagB}:${idx}`,
        label: `${i.tagA} + ${i.tagB}`,
        detail: `In generator "${i.generator}" creating ${i.entityKind}`,
      })),
    };
  },

  /**
   * 16. Numeric Range Validation (WARNING)
   */
  numericRangeIssues(
    _usageMap: UsageMap,
    pressures: Pressure[],
    eras: Era[],
  ): ValidationResult | null {
    const issues: {
      source: string;
      field: string;
      value: number;
      expected: string;
    }[] = [];

    collectPressureRangeIssues(pressures, issues);
    collectEraWeightIssues(eras, issues);

    if (issues.length === 0) return null;
    return {
      id: "numeric-range-issues",
      title: "Values outside expected ranges",
      message:
        "These configuration values are outside their expected ranges, which may cause unexpected behavior.",
      severity: "warning",
      affectedItems: issues.map((i) => ({
        id: `${i.source}:${i.field}`,
        label: `${i.source}: ${i.field}`,
        detail: `Value: ${i.value}, Expected: ${i.expected}`,
      })),
    };
  },

  /**
   * 17. Relationship Compatibility Issues (WARNING)
   */
  relationshipCompatibility(usageMap: UsageMap): ValidationResult | null {
    const issues = usageMap?.validation?.compatibility ?? [];
    if (issues.length === 0) return null;
    return {
      id: "relationship-compatibility",
      title: "Relationship compatibility issues",
      message:
        "These relationships may have src/dst entity kinds that don't match the relationship kind constraints.",
      severity: "warning",
      affectedItems: issues.map((i, idx) => ({
        id: `${i.type}:${i.id}:${i.field}:${idx}`,
        label: `${i.type} "${i.id}"`,
        detail: i.issue,
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// Numeric-range sub-helpers (extracted to reduce numericRangeIssues complexity)
// ---------------------------------------------------------------------------

interface RangeIssue {
  source: string;
  field: string;
  value: number;
  expected: string;
}

function collectPressureRangeIssues(
  pressures: Pressure[],
  issues: RangeIssue[],
): void {
  for (const p of pressures) {
    if (
      p.initialValue !== undefined &&
      (p.initialValue < -100 || p.initialValue > 100)
    ) {
      issues.push({
        source: `pressure "${p.id}"`,
        field: "initialValue",
        value: p.initialValue,
        expected: "-100 to 100",
      });
    }
    if (p.homeostasis !== undefined && p.homeostasis < 0) {
      issues.push({
        source: `pressure "${p.id}"`,
        field: "homeostasis",
        value: p.homeostasis,
        expected: ">= 0",
      });
    }
  }
}

function collectEraWeightIssues(eras: Era[], issues: RangeIssue[]): void {
  for (const era of eras) {
    if (era.templateWeights) {
      for (const [genId, weight] of Object.entries(era.templateWeights)) {
        if (weight < 0) {
          issues.push({
            source: `era "${era.id}"`,
            field: `templateWeights.${genId}`,
            value: weight,
            expected: ">= 0",
          });
        }
      }
    }
    if (era.systemModifiers) {
      for (const [sysId, mod] of Object.entries(era.systemModifiers)) {
        if (mod < 0) {
          issues.push({
            source: `era "${era.id}"`,
            field: `systemModifiers.${sysId}`,
            value: mod,
            expected: ">= 0",
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all validations
 */
export function runValidations(
  usageMap: UsageMap,
  schema: Schema,
  eras: Era[],
  pressures: Pressure[],
  generators: Generator[],
  systems: System[],
): ValidationResults {
  const results: ValidationResults = { errors: [], warnings: [] };

  const usageMapRules: Array<() => ValidationResult | null> = [
    () => validationRules.invalidEntityKind(usageMap),
    () => validationRules.invalidRelationshipKind(usageMap),
    () => validationRules.invalidPressureId(usageMap),
    () => validationRules.invalidEraTemplateRef(usageMap),
    () => validationRules.invalidEraSystemRef(usageMap),
    () => validationRules.orphanGenerators(usageMap),
    () => validationRules.orphanSystems(usageMap),
    () => validationRules.relationshipCompatibility(usageMap),
  ];

  const dataRules: Array<() => ValidationResult | null> = [
    () =>
      validationRules.pressureWithoutSources(
        usageMap,
        pressures,
        generators,
        systems,
      ),
    () =>
      validationRules.pressureWithoutSinks(
        usageMap,
        pressures,
        generators,
        systems,
      ),
    () => validationRules.zeroWeightGenerators(usageMap, eras, generators),
    () =>
      validationRules.invalidSubtypeRef(
        usageMap,
        schema,
        generators,
        pressures,
      ),
    () => validationRules.invalidStatusRef(usageMap, schema, generators),
    () => validationRules.invalidCultureRef(usageMap, schema),
    () => validationRules.undefinedTagRefs(usageMap, schema),
    () =>
      validationRules.conflictingTagsInUse(usageMap, schema, generators),
    () => validationRules.numericRangeIssues(usageMap, pressures, eras),
  ];

  const allRules = [...usageMapRules, ...dataRules];
  for (const rule of allRules) {
    const result = rule();
    if (result) {
      if (result.severity === "error") {
        results.errors.push(result);
      } else {
        results.warnings.push(result);
      }
    }
  }

  return results;
}

export function getOverallStatus(results: ValidationResults): OverallStatus {
  if (results.errors.length > 0) return "error";
  if (results.warnings.length > 0) return "warning";
  return "clean";
}
