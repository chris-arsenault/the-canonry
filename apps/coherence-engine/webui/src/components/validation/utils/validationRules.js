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
 * NOTE: This module uses the usageMap from @penguin-tales/shared-components computeUsageMap
 * for reference validation. This ensures a single source of truth for all validation logic.
 */

export const validationRules = {
  /**
   * 1. Invalid Entity Kind References (ERROR)
   * Uses usageMap.validation.invalidRefs where refType === 'entityKind'
   */
  invalidEntityKind: (usageMap) => {
    const invalid = (usageMap?.validation?.invalidRefs || [])
      .filter(r => r.refType === 'entityKind');

    if (invalid.length === 0) return null;

    // Group by invalid kind
    const byKind = {};
    for (const r of invalid) {
      const kindStr = typeof r.refId === 'object' ? JSON.stringify(r.refId) : String(r.refId);
      if (!byKind[kindStr]) byKind[kindStr] = [];
      byKind[kindStr].push(r);
    }

    return {
      id: 'invalid-entity-kind',
      title: 'Invalid entity kind references',
      message: 'These configurations reference entity kinds that do not exist in the schema. This will cause runtime crashes.',
      severity: 'error',
      affectedItems: Object.entries(byKind).map(([kind, sources]) => ({
        id: kind,
        label: kind,
        detail: `Referenced by: ${sources.map(s => s.location).join(', ')}`,
      })),
    };
  },

  /**
   * 2. Invalid Relationship Kind References (ERROR)
   * Uses usageMap.validation.invalidRefs where refType === 'relationshipKind'
   */
  invalidRelationshipKind: (usageMap) => {
    const invalid = (usageMap?.validation?.invalidRefs || [])
      .filter(r => r.refType === 'relationshipKind');

    if (invalid.length === 0) return null;

    const byKind = {};
    for (const r of invalid) {
      const kindStr = typeof r.refId === 'object' ? JSON.stringify(r.refId) : String(r.refId);
      if (!byKind[kindStr]) byKind[kindStr] = [];
      byKind[kindStr].push(r);
    }

    return {
      id: 'invalid-relationship-kind',
      title: 'Invalid relationship kind references',
      message: 'These configurations reference relationship kinds that do not exist in the schema. This will cause runtime crashes or silent failures.',
      severity: 'error',
      affectedItems: Object.entries(byKind).map(([kind, sources]) => ({
        id: kind,
        label: kind,
        detail: `Referenced by: ${sources.map(s => s.location).join(', ')}`,
      })),
    };
  },

  /**
   * 3. Invalid Pressure ID References (ERROR)
   * Uses usageMap.validation.invalidRefs where refType === 'pressure'
   */
  invalidPressureId: (usageMap) => {
    const invalid = (usageMap?.validation?.invalidRefs || [])
      .filter(r => r.refType === 'pressure');

    if (invalid.length === 0) return null;

    const byId = {};
    for (const r of invalid) {
      const idStr = typeof r.refId === 'object' ? JSON.stringify(r.refId) : String(r.refId);
      if (!byId[idStr]) byId[idStr] = [];
      byId[idStr].push(r);
    }

    return {
      id: 'invalid-pressure-id',
      title: 'Invalid pressure ID references',
      message: 'These configurations reference pressure IDs that do not exist. This will cause runtime failures when evaluating or modifying pressures.',
      severity: 'error',
      affectedItems: Object.entries(byId).map(([id, sources]) => ({
        id,
        label: id,
        detail: `Referenced by: ${sources.map(s => s.location).join(', ')}`,
      })),
    };
  },

  /**
   * 4. Invalid Era Template References (ERROR)
   * Uses usageMap.validation.invalidRefs where refType === 'generator'
   */
  invalidEraTemplateRef: (usageMap) => {
    const invalid = (usageMap?.validation?.invalidRefs || [])
      .filter(r => r.refType === 'generator' && r.type === 'era');

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-era-template-ref',
      title: 'Invalid generator references in eras',
      message: 'These eras reference generators that do not exist. The weights will have no effect.',
      severity: 'error',
      affectedItems: invalid.map(i => ({
        id: `${i.id}:${i.refId}`,
        label: i.refId,
        detail: i.location,
      })),
    };
  },

  /**
   * 5. Invalid Era System References (ERROR)
   * Uses usageMap.validation.invalidRefs where refType === 'system'
   */
  invalidEraSystemRef: (usageMap) => {
    const invalid = (usageMap?.validation?.invalidRefs || [])
      .filter(r => r.refType === 'system' && r.type === 'era');

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-era-system-ref',
      title: 'Invalid system references in eras',
      message: 'These eras reference systems that do not exist. The modifiers will have no effect.',
      severity: 'error',
      affectedItems: invalid.map(i => ({
        id: `${i.id}:${i.refId}`,
        label: i.refId,
        detail: i.location,
      })),
    };
  },

  /**
   * 6. Pressure Without Sources (WARNING)
   */
  pressureWithoutSources: (usageMap, pressures, generators, systems) => {
    const pressuresWithSources = new Set();

    // Check generators for positive pressure changes
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.stateUpdates) {
        for (const u of gen.stateUpdates) {
          if (u.type === 'modify_pressure' && u.delta > 0) {
            pressuresWithSources.add(u.pressureId);
          }
        }
      }
    }

    // Check systems for positive pressure changes
    for (const sys of systems) {
      const cfg = sys.config;
      if (cfg.pressureChanges) {
        for (const [pId, delta] of Object.entries(cfg.pressureChanges)) {
          if (delta > 0) pressuresWithSources.add(pId);
        }
      }

      const mutationSources = [];
      if (Array.isArray(cfg.actions)) mutationSources.push(...cfg.actions);
      if (cfg.infectionAction) mutationSources.push(cfg.infectionAction);
      if (Array.isArray(cfg.rules)) {
        cfg.rules.forEach((rule) => {
          if (rule?.action) mutationSources.push(rule.action);
        });
      }

      for (const mutation of mutationSources) {
        if (mutation?.type === 'modify_pressure' && mutation.delta > 0) {
          pressuresWithSources.add(mutation.pressureId);
        }
      }
    }

    // Also check if pressure has positiveFeedback (homeostasis alone doesn't raise it)
    for (const p of pressures) {
      if (p.growth?.positiveFeedback?.length > 0) {
        pressuresWithSources.add(p.id);
      }
    }

    const withoutSources = pressures.filter(p => !pressuresWithSources.has(p.id));

    if (withoutSources.length === 0) return null;

    return {
      id: 'pressure-without-sources',
      title: 'Pressures without sources',
      message: 'These pressures have no positive drivers (no generators/systems increase them, no positiveFeedback). They will be pulled toward equilibrium unless something else raises them.',
      severity: 'warning',
      affectedItems: withoutSources.map(p => ({
        id: p.id,
        label: p.name || p.id,
        detail: `Homeostasis: ${p.homeostasis ?? 0}, no sources found`,
      })),
    };
  },

  /**
   * 7. Pressure Without Sinks (WARNING)
   */
  pressureWithoutSinks: (usageMap, pressures, generators, systems) => {
    const pressuresWithSinks = new Set();

    // Check generators for negative pressure changes
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.stateUpdates) {
        for (const u of gen.stateUpdates) {
          if (u.type === 'modify_pressure' && u.delta < 0) {
            pressuresWithSinks.add(u.pressureId);
          }
        }
      }
    }

    // Check systems for negative pressure changes
    for (const sys of systems) {
      const cfg = sys.config;
      if (cfg.pressureChanges) {
        for (const [pId, delta] of Object.entries(cfg.pressureChanges)) {
          if (delta < 0) pressuresWithSinks.add(pId);
        }
      }

      const mutationSinks = [];
      if (Array.isArray(cfg.actions)) mutationSinks.push(...cfg.actions);
      if (cfg.infectionAction) mutationSinks.push(cfg.infectionAction);
      if (Array.isArray(cfg.rules)) {
        cfg.rules.forEach((rule) => {
          if (rule?.action) mutationSinks.push(rule.action);
        });
      }

      for (const mutation of mutationSinks) {
        if (mutation?.type === 'modify_pressure' && mutation.delta < 0) {
          pressuresWithSinks.add(mutation.pressureId);
        }
      }
    }

    // Homeostasis and negative feedback both act as sinks
    for (const p of pressures) {
      if ((p.homeostasis ?? 0) > 0 || (p.growth?.negativeFeedback?.length > 0)) {
        pressuresWithSinks.add(p.id);
      }
    }

    const withoutSinks = pressures.filter(p => !pressuresWithSinks.has(p.id));

    if (withoutSinks.length === 0) return null;

    return {
      id: 'pressure-without-sinks',
      title: 'Pressures without sinks',
      message: 'These pressures have no negative drivers (no homeostasis, no negativeFeedback, nothing decreases them). They can drift to extremes.',
      severity: 'warning',
      affectedItems: withoutSinks.map(p => ({
        id: p.id,
        label: p.name || p.id,
        detail: `Homeostasis: ${p.homeostasis ?? 0}`,
      })),
    };
  },

  /**
   * 8. Orphan Generators (WARNING)
   * Uses usageMap.validation.orphans where type === 'generator'
   */
  orphanGenerators: (usageMap) => {
    const orphans = (usageMap?.validation?.orphans || [])
      .filter(o => o.type === 'generator');

    if (orphans.length === 0) return null;

    return {
      id: 'orphan-generators',
      title: 'Generators not referenced in any era',
      message: 'These generators are not referenced in any era\'s templateWeights. They will never execute during simulation.',
      severity: 'warning',
      affectedItems: orphans.map(o => ({
        id: o.id,
        label: o.id,
        detail: o.reason,
      })),
    };
  },

  /**
   * 9. Orphan Systems (WARNING)
   * Uses usageMap.validation.orphans where type === 'system'
   */
  orphanSystems: (usageMap) => {
    const orphans = (usageMap?.validation?.orphans || [])
      .filter(o => o.type === 'system');

    if (orphans.length === 0) return null;

    return {
      id: 'orphan-systems',
      title: 'Systems not referenced in any era',
      message: 'These systems are not referenced in any era\'s systemModifiers. They may not run with intended weights.',
      severity: 'warning',
      affectedItems: orphans.map(o => ({
        id: o.id,
        label: o.id,
        detail: o.reason,
      })),
    };
  },

  /**
   * 10. Zero-Weight Generators in All Eras (WARNING)
   */
  zeroWeightGenerators: (usageMap, eras, generators) => {
    const zeroInAll = [];

    for (const gen of generators) {
      if (gen.enabled === false) continue;

      let hasNonZeroWeight = false;
      for (const era of eras) {
        const weight = era.templateWeights?.[gen.id];
        if (weight !== undefined && weight > 0) {
          hasNonZeroWeight = true;
          break;
        }
      }

      // Check if it's referenced at all
      const isReferenced = eras.some(e => e.templateWeights?.[gen.id] !== undefined);

      if (isReferenced && !hasNonZeroWeight) {
        zeroInAll.push(gen);
      }
    }

    if (zeroInAll.length === 0) return null;

    return {
      id: 'zero-weight-generators',
      title: 'Generators with zero weight in all eras',
      message: 'These generators are referenced in era templateWeights but always have weight 0. They are effectively disabled but not obviously so.',
      severity: 'warning',
      affectedItems: zeroInAll.map(g => ({
        id: g.id,
        label: g.name || g.id,
        detail: 'Weight is 0 in all eras where referenced',
      })),
    };
  },

  /**
   * 11. Invalid Subtype References (WARNING)
   */
  invalidSubtypeRef: (usageMap, schema, generators, pressures) => {
    // Build map of valid subtypes per kind
    const subtypesByKind = {};
    for (const ek of (schema.entityKinds || [])) {
      subtypesByKind[ek.kind] = new Set((ek.subtypes || []).map(s => s.id));
    }

    const invalid = [];

    // Check generators
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.creation) {
        for (const c of gen.creation) {
          if (c.kind && c.subtype && subtypesByKind[c.kind]) {
            // Skip DSL-based subtypes (objects like {inherit: ...} or {random: [...]})
            if (typeof c.subtype === 'object') {
              // For random subtypes, validate the array values
              if (c.subtype.random && Array.isArray(c.subtype.random)) {
                for (const st of c.subtype.random) {
                  if (!subtypesByKind[c.kind].has(st)) {
                    invalid.push({ kind: c.kind, subtype: st, source: `generator "${gen.id}"` });
                  }
                }
              }
              // For inherit subtypes, skip validation (runtime-resolved)
              continue;
            }
            if (!subtypesByKind[c.kind].has(c.subtype)) {
              invalid.push({ kind: c.kind, subtype: c.subtype, source: `generator "${gen.id}"` });
            }
          }
        }
      }
    }

    // Check pressures
    for (const p of pressures) {
      const checkFactors = (factors, source) => {
        for (const f of (factors || [])) {
          if (f.kind && f.subtype && subtypesByKind[f.kind]) {
            if (!subtypesByKind[f.kind].has(f.subtype)) {
              invalid.push({ kind: f.kind, subtype: f.subtype, source });
            }
          }
          if (f.numerator?.kind && f.numerator?.subtype && subtypesByKind[f.numerator.kind]) {
            if (!subtypesByKind[f.numerator.kind].has(f.numerator.subtype)) {
              invalid.push({ kind: f.numerator.kind, subtype: f.numerator.subtype, source });
            }
          }
        }
      };
      checkFactors(p.growth?.positiveFeedback, `pressure "${p.id}"`);
      checkFactors(p.growth?.negativeFeedback, `pressure "${p.id}"`);
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-subtype-ref',
      title: 'Invalid subtype references',
      message: 'These configurations reference subtypes that do not exist for the specified entity kind.',
      severity: 'warning',
      affectedItems: invalid.map((i, idx) => {
        const subtypeStr = typeof i.subtype === 'object' ? JSON.stringify(i.subtype) : i.subtype;
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
  invalidStatusRef: (usageMap, schema, generators) => {
    // Build map of valid statuses per kind
    const statusesByKind = {};
    for (const ek of (schema.entityKinds || [])) {
      statusesByKind[ek.kind] = new Set((ek.statuses || []).map(s => s.id));
    }

    const invalid = [];

    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.creation) {
        for (const c of gen.creation) {
          if (c.kind && c.status && statusesByKind[c.kind]) {
            if (!statusesByKind[c.kind].has(c.status)) {
              invalid.push({ kind: c.kind, status: c.status, source: `generator "${gen.id}"` });
            }
          }
        }
      }
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-status-ref',
      title: 'Invalid status references',
      message: 'These generators set entity statuses that are not valid for the entity kind.',
      severity: 'warning',
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
  invalidCultureRef: (usageMap, schema) => {
    const validCultures = new Set((schema.cultures || []).map(c => c.id));
    const invalid = [];

    // Check semantic plane regions
    for (const ek of (schema.entityKinds || [])) {
      if (ek.semanticPlane?.regions) {
        for (const r of ek.semanticPlane.regions) {
          if (r.culture && !validCultures.has(r.culture)) {
            invalid.push({ culture: r.culture, source: `${ek.kind} region "${r.id}"` });
          }
        }
      }
    }

    if (invalid.length === 0) return null;

    return {
      id: 'invalid-culture-ref',
      title: 'Invalid culture references',
      message: 'These semantic plane regions reference cultures that do not exist. Name generation may fail.',
      severity: 'warning',
      affectedItems: invalid.map(i => ({
        id: i.culture,
        label: i.culture,
        detail: `In ${i.source}`,
      })),
    };
  },

  /**
   * 14. Undefined Tag References (WARNING)
   */
  undefinedTagRefs: (usageMap, schema) => {
    const definedTags = new Set((schema.tagRegistry || []).map(t => t.tag));

    // Get all tags from usageMap
    const referencedTags = new Set(Object.keys(usageMap?.tags || {}));

    // Find tags that are referenced but not in registry
    const undefinedTags = [...referencedTags].filter(tag => !definedTags.has(tag));

    if (undefinedTags.length === 0) return null;

    return {
      id: 'undefined-tag-refs',
      title: 'Tags used but not in registry',
      message: 'These tags are referenced in generators, systems, or pressures but are not defined in the tag registry. They will still work at runtime but lack metadata like conflictingTags.',
      severity: 'warning',
      affectedItems: undefinedTags.map(tag => {
        const usage = usageMap.tags[tag];
        const sources = [];
        if (usage.generators?.length) sources.push(`${usage.generators.length} generators`);
        if (usage.systems?.length) sources.push(`${usage.systems.length} systems`);
        if (usage.pressures?.length) sources.push(`${usage.pressures.length} pressures`);
        if (usage.actions?.length) sources.push(`${usage.actions.length} actions`);
        return {
          id: tag,
          label: tag,
          detail: `Used by: ${sources.join(', ') || 'unknown'}`,
        };
      }),
    };
  },

  /**
   * 15. Conflicting Tags (WARNING) - Tags assigned together that are marked as conflicting
   */
  conflictingTagsInUse: (usageMap, schema, generators) => {
    const tagRegistry = schema.tagRegistry || [];
    const conflictMap = {};
    for (const t of tagRegistry) {
      if (t.conflictingTags && t.conflictingTags.length > 0) {
        conflictMap[t.tag] = new Set(t.conflictingTags);
      }
    }

    const issues = [];

    // Check generators that assign multiple tags
    for (const gen of generators) {
      if (gen.enabled === false) continue;
      if (gen.creation) {
        for (const c of gen.creation) {
          if (c.tags && typeof c.tags === 'object') {
            const assignedTags = Object.keys(c.tags).filter(t => c.tags[t] === true);
            // Check for conflicts among assigned tags
            for (let i = 0; i < assignedTags.length; i++) {
              for (let j = i + 1; j < assignedTags.length; j++) {
                const tagA = assignedTags[i];
                const tagB = assignedTags[j];
                if (conflictMap[tagA]?.has(tagB) || conflictMap[tagB]?.has(tagA)) {
                  issues.push({
                    generator: gen.id,
                    tagA,
                    tagB,
                    entityKind: c.kind,
                  });
                }
              }
            }
          }
        }
      }
    }

    if (issues.length === 0) return null;

    return {
      id: 'conflicting-tags-in-use',
      title: 'Conflicting tags assigned together',
      message: 'These generators assign tags that are marked as conflicting in the tag registry. This may produce semantically inconsistent entities.',
      severity: 'warning',
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
  numericRangeIssues: (usageMap, pressures, eras) => {
    const issues = [];

    // Check pressures
    for (const p of pressures) {
      if (p.initialValue !== undefined && (p.initialValue < -100 || p.initialValue > 100)) {
        issues.push({ source: `pressure "${p.id}"`, field: 'initialValue', value: p.initialValue, expected: '-100 to 100' });
      }
      if (p.homeostasis !== undefined && p.homeostasis < 0) {
        issues.push({ source: `pressure "${p.id}"`, field: 'homeostasis', value: p.homeostasis, expected: '>= 0' });
      }
    }

    // Check era weights
    for (const era of eras) {
      if (era.templateWeights) {
        for (const [genId, weight] of Object.entries(era.templateWeights)) {
          if (weight < 0) {
            issues.push({ source: `era "${era.id}"`, field: `templateWeights.${genId}`, value: weight, expected: '>= 0' });
          }
        }
      }
      if (era.systemModifiers) {
        for (const [sysId, mod] of Object.entries(era.systemModifiers)) {
          if (mod < 0) {
            issues.push({ source: `era "${era.id}"`, field: `systemModifiers.${sysId}`, value: mod, expected: '>= 0' });
          }
        }
      }
    }

    if (issues.length === 0) return null;

    return {
      id: 'numeric-range-issues',
      title: 'Values outside expected ranges',
      message: 'These configuration values are outside their expected ranges, which may cause unexpected behavior.',
      severity: 'warning',
      affectedItems: issues.map(i => ({
        id: `${i.source}:${i.field}`,
        label: `${i.source}: ${i.field}`,
        detail: `Value: ${i.value}, Expected: ${i.expected}`,
      })),
    };
  },

  /**
   * 17. Relationship Compatibility Issues (WARNING)
   * Uses usageMap.validation.compatibility
   */
  relationshipCompatibility: (usageMap) => {
    const issues = usageMap?.validation?.compatibility || [];

    if (issues.length === 0) return null;

    return {
      id: 'relationship-compatibility',
      title: 'Relationship compatibility issues',
      message: 'These relationships may have src/dst entity kinds that don\'t match the relationship kind constraints.',
      severity: 'warning',
      affectedItems: issues.map((i, idx) => ({
        id: `${i.type}:${i.id}:${i.field}:${idx}`,
        label: `${i.type} "${i.id}"`,
        detail: i.issue,
      })),
    };
  },
};

/**
 * Run all validations
 * @param {Object} usageMap - Pre-computed usage map from computeUsageMap
 * @param {Object} schema - Domain schema
 * @param {Array} eras - Era configurations
 * @param {Array} pressures - Pressure configurations
 * @param {Array} generators - Generator configurations
 * @param {Array} systems - System configurations
 */
export function runValidations(usageMap, schema, eras, pressures, generators, systems) {
  const results = {
    errors: [],
    warnings: [],
  };

  // Run each validation rule
  // Rules that use usageMap only
  const usageMapRules = [
    () => validationRules.invalidEntityKind(usageMap),
    () => validationRules.invalidRelationshipKind(usageMap),
    () => validationRules.invalidPressureId(usageMap),
    () => validationRules.invalidEraTemplateRef(usageMap),
    () => validationRules.invalidEraSystemRef(usageMap),
    () => validationRules.orphanGenerators(usageMap),
    () => validationRules.orphanSystems(usageMap),
    () => validationRules.relationshipCompatibility(usageMap),
  ];

  // Rules that need additional data
  const dataRules = [
    () => validationRules.pressureWithoutSources(usageMap, pressures, generators, systems),
    () => validationRules.pressureWithoutSinks(usageMap, pressures, generators, systems),
    () => validationRules.zeroWeightGenerators(usageMap, eras, generators),
    () => validationRules.invalidSubtypeRef(usageMap, schema, generators, pressures),
    () => validationRules.invalidStatusRef(usageMap, schema, generators),
    () => validationRules.invalidCultureRef(usageMap, schema),
    () => validationRules.undefinedTagRefs(usageMap, schema),
    () => validationRules.conflictingTagsInUse(usageMap, schema, generators),
    () => validationRules.numericRangeIssues(usageMap, pressures, eras),
  ];

  const allRules = [...usageMapRules, ...dataRules];

  for (const rule of allRules) {
    const result = rule();
    if (result) {
      if (result.severity === 'error') {
        results.errors.push(result);
      } else {
        results.warnings.push(result);
      }
    }
  }

  return results;
}

export function getOverallStatus(results) {
  if (results.errors.length > 0) return 'error';
  if (results.warnings.length > 0) return 'warning';
  return 'clean';
}
