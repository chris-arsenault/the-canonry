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

/**
 * Compute complete usage map for all schema elements
 */
export function computeUsageMap(schema, pressures, eras, generators, systems, actions) {
  const usageMap = {
    // Schema element usage tracking
    entityKinds: {},      // { kindId: { generators: [], systems: [], actions: [], pressures: [] } }
    subtypes: {},         // { subtype: { generators: [], systems: [], actions: [] } }
    statuses: {},         // { status: { generators: [], systems: [], actions: [] } }
    relationshipKinds: {},// { kindId: { generators: [], systems: [], actions: [], pressures: [] } }
    tags: {},             // { tag: { pressures: [], systems: [], generators: [], actions: [] } }

    // Cross-tab reference tracking
    pressures: {},        // { pressureId: { generators: [], systems: [], actions: [], eras: [] } }
    generators: {},       // { generatorId: { eras: [{ id, weight }] } }
    systems: {},          // { systemId: { eras: [{ id, weight }] } }

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
  scanPressureReferences(usageMap, pressures, schema);

  // Scan eras for generator/system references
  scanEraReferences(usageMap, eras, generators, systems);

  // Scan generators for all references
  scanGeneratorReferences(usageMap, generators, schema, pressures);

  // Scan systems for all references
  scanSystemReferences(usageMap, systems, schema, pressures);

  // Scan actions for all references
  scanActionReferences(usageMap, actions, schema, pressures);

  // Detect orphans (unused elements)
  detectOrphans(usageMap, schema, pressures, generators, systems);

  // Check relationship compatibility
  checkRelationshipCompatibility(usageMap, generators, actions, schema);

  return usageMap;
}

function initializeFromSchema(usageMap, schema) {
  // Entity kinds
  (schema?.entityKinds || []).forEach(ek => {
    usageMap.entityKinds[ek.kind] = { generators: [], systems: [], actions: [], pressures: [] };

    // Subtypes
    (ek.subtypes || []).forEach(st => {
      const subtypeId = typeof st === 'string' ? st : st.id;
      if (!usageMap.subtypes[subtypeId]) {
        usageMap.subtypes[subtypeId] = { generators: [], systems: [], actions: [] };
      }
    });

    // Statuses
    (ek.statuses || []).forEach(s => {
      const statusId = typeof s === 'string' ? s : s.id;
      if (!usageMap.statuses[statusId]) {
        usageMap.statuses[statusId] = { generators: [], systems: [], actions: [] };
      }
    });
  });

  // Relationship kinds
  (schema?.relationshipKinds || []).forEach(rk => {
    usageMap.relationshipKinds[rk.kind] = {
      generators: [],
      systems: [],
      actions: [],
      pressures: [],
      srcKinds: rk.srcKinds || [],
      dstKinds: rk.dstKinds || [],
    };
  });

  // Tags (from tag registry if available)
  (schema?.tagRegistry || []).forEach(t => {
    const tagId = typeof t === 'string' ? t : t.tag;
    ensureTagEntry(usageMap, tagId);
  });
}

function initializePressures(usageMap, pressures) {
  (pressures || []).forEach(p => {
    usageMap.pressures[p.id] = { generators: [], systems: [], actions: [], eras: [], feedbackSources: [], feedbackSinks: [] };
  });
}

function initializeGeneratorsAndSystems(usageMap, generators, systems) {
  (generators || []).forEach(g => {
    usageMap.generators[g.id] = { eras: [] };
  });

  (systems || []).forEach(s => {
    const sysId = s.config.id;
    usageMap.systems[sysId] = { eras: [] };
  });
}

function normalizeTagId(tag) {
  if (!tag) return '';
  if (typeof tag === 'string') return tag;
  if (typeof tag === 'object') {
    if (typeof tag.tag === 'string') return tag.tag;
    if (typeof tag.id === 'string') return tag.id;
  }
  return String(tag);
}

function ensureTagEntry(usageMap, tag) {
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

function recordEntityKindRef(usageMap, kind, contextKey, ref, info) {
  if (!kind || kind === 'any') return;
  if (usageMap.entityKinds[kind]) {
    usageMap.entityKinds[kind][contextKey].push(ref);
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

function recordRelationshipKindRef(usageMap, kind, contextKey, ref, info) {
  if (!kind) return;
  if (usageMap.relationshipKinds[kind]) {
    usageMap.relationshipKinds[kind][contextKey].push(ref);
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

function recordPressureRef(usageMap, pressureIds, pressureId, contextKey, ref, info) {
  if (!pressureId) return;
  if (usageMap.pressures[pressureId]) {
    usageMap.pressures[pressureId][contextKey].push(ref);
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

function recordTagRef(usageMap, tag, contextKey, ref) {
  const tagId = ensureTagEntry(usageMap, tag);
  if (!tagId) return;
  if (!Array.isArray(usageMap.tags[tagId][contextKey])) {
    usageMap.tags[tagId][contextKey] = [];
  }
  usageMap.tags[tagId][contextKey].push(ref);
}

function recordSubtypeRef(usageMap, subtype, contextKey, ref) {
  if (!subtype) return;
  if (usageMap.subtypes[subtype]) {
    usageMap.subtypes[subtype][contextKey].push(ref);
  }
}

function recordStatusRef(usageMap, status, contextKey, ref) {
  if (!status) return;
  if (usageMap.statuses[status]) {
    usageMap.statuses[status][contextKey].push(ref);
  }
}

function scanGraphPathAssertion(assertion, usageMap, contextKey, ref, info) {
  if (!assertion) return;
  (assertion.path || []).forEach((step, idx) => {
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

  (assertion.where || []).forEach((constraint, idx) => {
    switch (constraint.type) {
      case 'has_relationship':
      case 'lacks_relationship':
        recordRelationshipKindRef(
          usageMap,
          constraint.kind,
          contextKey,
          ref,
          { ...info, field: `${info.field}.where[${idx}].kind` }
        );
        break;
      case 'kind_equals':
        recordEntityKindRef(
          usageMap,
          constraint.kind,
          contextKey,
          ref,
          { ...info, field: `${info.field}.where[${idx}].kind` }
        );
        break;
      case 'subtype_equals':
        recordSubtypeRef(usageMap, constraint.subtype, contextKey, ref);
        break;
      default:
        break;
    }
  });
}

function scanSelectionFilters(filters, usageMap, contextKey, ref, info) {
  (filters || []).forEach((filter, idx) => {
    switch (filter.type) {
      case 'has_relationship':
      case 'lacks_relationship':
        recordRelationshipKindRef(
          usageMap,
          filter.kind,
          contextKey,
          ref,
          { ...info, field: `${info.field}[${idx}].kind` }
        );
        break;
      case 'shares_related':
        recordRelationshipKindRef(
          usageMap,
          filter.relationshipKind,
          contextKey,
          ref,
          { ...info, field: `${info.field}[${idx}].relationshipKind` }
        );
        break;
      case 'has_tag':
      case 'lacks_tag':
        recordTagRef(usageMap, filter.tag, contextKey, ref);
        break;
      case 'has_tags':
      case 'has_any_tag':
      case 'lacks_any_tag':
        (filter.tags || []).forEach(tag => recordTagRef(usageMap, tag, contextKey, ref));
        break;
      case 'has_status':
        recordStatusRef(usageMap, filter.status, contextKey, ref);
        break;
      case 'graph_path':
        scanGraphPathAssertion(filter.assert, usageMap, contextKey, ref, {
          ...info,
          field: `${info.field}[${idx}].assert`,
        });
        break;
      default:
        break;
    }
  });
}

function scanSelectionRule(selection, usageMap, contextKey, ref, info) {
  if (!selection) return;
  if (selection.kind) {
    recordEntityKindRef(usageMap, selection.kind, contextKey, ref, { ...info, field: `${info.field}.kind` });
  }
  (selection.kinds || []).forEach((kind) => {
    recordEntityKindRef(usageMap, kind, contextKey, ref, { ...info, field: `${info.field}.kinds` });
  });
  (selection.subtypes || []).forEach(subtype => recordSubtypeRef(usageMap, subtype, contextKey, ref));
  (selection.excludeSubtypes || []).forEach(subtype => recordSubtypeRef(usageMap, subtype, contextKey, ref));
  if (selection.status) {
    recordStatusRef(usageMap, selection.status, contextKey, ref);
  }
  (selection.statuses || []).forEach(status => recordStatusRef(usageMap, status, contextKey, ref));
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
  (selection.saturationLimits || []).forEach((limit, idx) => {
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

function scanVariableSelectionRule(selection, usageMap, contextKey, ref, info) {
  if (!selection) return;
  const from = selection.from;
  if (from && typeof from === 'object') {
    recordRelationshipKindRef(usageMap, from.relationshipKind, contextKey, ref, {
      ...info,
      field: `${info.field}.from.relationshipKind`,
    });
  }
  if (selection.kind) {
    recordEntityKindRef(usageMap, selection.kind, contextKey, ref, { ...info, field: `${info.field}.kind` });
  }
  (selection.kinds || []).forEach(kind => {
    recordEntityKindRef(usageMap, kind, contextKey, ref, { ...info, field: `${info.field}.kinds` });
  });
  (selection.subtypes || []).forEach(subtype => recordSubtypeRef(usageMap, subtype, contextKey, ref));
  if (selection.status) {
    recordStatusRef(usageMap, selection.status, contextKey, ref);
  }
  (selection.statuses || []).forEach(status => recordStatusRef(usageMap, status, contextKey, ref));
  if (selection.notStatus) {
    recordStatusRef(usageMap, selection.notStatus, contextKey, ref);
  }
  scanSelectionFilters(selection.filters, usageMap, contextKey, ref, { ...info, field: `${info.field}.filters` });
  scanSelectionFilters(selection.preferFilters, usageMap, contextKey, ref, { ...info, field: `${info.field}.preferFilters` });
}

function scanCondition(condition, usageMap, pressureIds, contextKey, ref, info) {
  if (!condition) return;
  switch (condition.type) {
    case 'pressure':
      recordPressureRef(usageMap, pressureIds, condition.pressureId, contextKey, ref, info);
      break;
    case 'pressure_any_above':
      (condition.pressureIds || []).forEach((pressureId) =>
        recordPressureRef(usageMap, pressureIds, pressureId, contextKey, ref, info)
      );
      break;
    case 'pressure_compare':
      recordPressureRef(usageMap, pressureIds, condition.pressureA, contextKey, ref, info);
      recordPressureRef(usageMap, pressureIds, condition.pressureB, contextKey, ref, info);
      break;
    case 'entity_count':
      recordEntityKindRef(usageMap, condition.kind, contextKey, ref, info);
      recordSubtypeRef(usageMap, condition.subtype, contextKey, ref);
      recordStatusRef(usageMap, condition.status, contextKey, ref);
      break;
    case 'relationship_count':
      recordRelationshipKindRef(usageMap, condition.relationshipKind, contextKey, ref, info);
      break;
    case 'relationship_exists':
      recordRelationshipKindRef(usageMap, condition.relationshipKind, contextKey, ref, info);
      recordEntityKindRef(usageMap, condition.targetKind, contextKey, ref, info);
      recordSubtypeRef(usageMap, condition.targetSubtype, contextKey, ref);
      recordStatusRef(usageMap, condition.targetStatus, contextKey, ref);
      break;
    case 'tag_exists':
    case 'tag_absent':
      recordTagRef(usageMap, condition.tag, contextKey, ref);
      break;
    case 'status':
      recordStatusRef(usageMap, condition.status, contextKey, ref);
      break;
    case 'graph_path':
      scanGraphPathAssertion(condition.assert, usageMap, contextKey, ref, info);
      break;
    case 'entity_has_relationship':
      recordRelationshipKindRef(usageMap, condition.relationshipKind, contextKey, ref, info);
      break;
    case 'and':
    case 'or':
      (condition.conditions || []).forEach((child, idx) =>
        scanCondition(child, usageMap, pressureIds, contextKey, ref, { ...info, field: `${info.field}.${condition.type}[${idx}]` })
      );
      break;
    default:
      break;
  }
}

function scanMutations(mutations, usageMap, pressureIds, contextKey, ref, info) {
  (mutations || []).forEach((mutation, idx) => {
    switch (mutation.type) {
      case 'set_tag':
      case 'remove_tag':
        recordTagRef(usageMap, mutation.tag, contextKey, ref);
        break;
      case 'create_relationship':
        recordRelationshipKindRef(usageMap, mutation.kind, contextKey, ref, {
          ...info,
          field: `${info.field}[${idx}].kind`,
        });
        break;
      case 'adjust_relationship_strength':
        recordRelationshipKindRef(usageMap, mutation.kind, contextKey, ref, {
          ...info,
          field: `${info.field}[${idx}].kind`,
        });
        break;
      case 'archive_relationship':
        recordRelationshipKindRef(usageMap, mutation.relationshipKind, contextKey, ref, {
          ...info,
          field: `${info.field}[${idx}].relationshipKind`,
        });
        break;
      case 'change_status':
        recordStatusRef(usageMap, mutation.newStatus, contextKey, ref);
        break;
      case 'modify_pressure':
        recordPressureRef(usageMap, pressureIds, mutation.pressureId, contextKey, ref, {
          ...info,
          field: `${info.field}[${idx}].pressureId`,
        });
        break;
      default:
        break;
    }
  });
}

function scanMetric(metric, usageMap, contextKey, ref, info) {
  if (!metric) return;
  switch (metric.type) {
    case 'entity_count':
      recordEntityKindRef(usageMap, metric.kind, contextKey, ref, info);
      recordSubtypeRef(usageMap, metric.subtype, contextKey, ref);
      recordStatusRef(usageMap, metric.status, contextKey, ref);
      break;
    case 'relationship_count':
    case 'connection_count':
      (metric.relationshipKinds || []).forEach((kind) =>
        recordRelationshipKindRef(usageMap, kind, contextKey, ref, info)
      );
      break;
    case 'tag_count':
      (metric.tags || []).forEach(tag => recordTagRef(usageMap, tag, contextKey, ref));
      break;
    case 'ratio':
      scanMetric(metric.numerator, usageMap, contextKey, ref, info);
      scanMetric(metric.denominator, usageMap, contextKey, ref, info);
      break;
    case 'status_ratio':
      recordEntityKindRef(usageMap, metric.kind, contextKey, ref, info);
      recordSubtypeRef(usageMap, metric.subtype, contextKey, ref);
      recordStatusRef(usageMap, metric.aliveStatus, contextKey, ref);
      break;
    case 'cross_culture_ratio':
      (metric.relationshipKinds || []).forEach((kind) =>
        recordRelationshipKindRef(usageMap, kind, contextKey, ref, info)
      );
      break;
    case 'shared_relationship':
      recordRelationshipKindRef(usageMap, metric.sharedRelationshipKind, contextKey, ref, info);
      break;
    case 'neighbor_kind_count':
    case 'neighbor_prominence':
      // Support both single relationship kind and array of kinds for 'via'
      if (metric.via) {
        const viaKinds = Array.isArray(metric.via) ? metric.via : [metric.via];
        viaKinds.forEach((kind) =>
          recordRelationshipKindRef(usageMap, kind, contextKey, ref, info)
        );
      }
      // Handle 'then' relationship if present
      if (metric.then) {
        recordRelationshipKindRef(usageMap, metric.then, contextKey, ref, info);
      }
      // Handle relationshipKinds array (for neighbor_prominence)
      (metric.relationshipKinds || []).forEach((kind) =>
        recordRelationshipKindRef(usageMap, kind, contextKey, ref, info)
      );
      // Handle kind filter for neighbor_kind_count
      if (metric.kind) {
        recordEntityKindRef(usageMap, metric.kind, contextKey, ref, info);
      }
      break;
    default:
      break;
  }
}

function scanPressureReferences(usageMap, pressures, schema) {
  (pressures || []).forEach(pressure => {
    const scanFeedbackFactors = (factors, isPositive) => {
      (factors || []).forEach(factor => {
        // Track entity kind references
        if (factor.kind && usageMap.entityKinds[factor.kind]) {
          usageMap.entityKinds[factor.kind].pressures.push({ id: pressure.id, factor: factor.type });
        } else if (factor.kind) {
          usageMap.validation.invalidRefs.push({
            type: 'pressure',
            id: pressure.id,
            field: `${isPositive ? 'positive' : 'negative'}Feedback.kind`,
            refType: 'entityKind',
            refId: factor.kind,
            location: `Pressure "${pressure.name || pressure.id}"`,
          });
        }

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
                location: `Pressure "${pressure.name || pressure.id}"`,
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
    };

    scanFeedbackFactors(pressure.growth?.positiveFeedback, true);
    scanFeedbackFactors(pressure.growth?.negativeFeedback, false);
  });
}

function scanEraReferences(usageMap, eras, generators, systems) {
  const generatorIds = new Set((generators || []).map(g => g.id));
  const systemIds = new Set((systems || []).map(s => s.config.id));
  const pressureIds = new Set(Object.keys(usageMap.pressures || {}));

  (eras || []).forEach(era => {
    const eraRef = { id: era.id, name: era.name };

    // Track generator references
    Object.entries(era.templateWeights || {}).forEach(([genId, weight]) => {
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
          location: `Era "${era.name || era.id}"`,
        });
      }
    });

    // Track system references
    Object.entries(era.systemModifiers || {}).forEach(([sysId, weight]) => {
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
          location: `Era "${era.name || era.id}"`,
        });
      }
    });

    (era.entryEffects?.mutations || []).forEach((mutation) => {
      if (mutation?.type !== 'modify_pressure') return;
      recordPressureRef(usageMap, pressureIds, mutation.pressureId, 'eras', eraRef, {
        type: 'era',
        id: era.id,
        field: 'entryEffects.mutations',
        location: `Era "${era.name || era.id}"`,
      });
    });
    (era.exitEffects?.mutations || []).forEach((mutation) => {
      if (mutation?.type !== 'modify_pressure') return;
      recordPressureRef(usageMap, pressureIds, mutation.pressureId, 'eras', eraRef, {
        type: 'era',
        id: era.id,
        field: 'exitEffects.mutations',
        location: `Era "${era.name || era.id}"`,
      });
    });
  });
}

function scanGeneratorReferences(usageMap, generators, schema, pressures) {
  const pressureIds = new Set((pressures || []).map(p => p.id));

  (generators || []).forEach(gen => {
    const genRef = { id: gen.id, name: gen.name };
    const location = `Generator "${gen.name || gen.id}"`;

    (gen.applicability || []).forEach((rule, idx) => {
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

    Object.entries(gen.variables || {}).forEach(([varName, variable]) => {
      scanVariableSelectionRule(variable?.select, usageMap, 'generators', genRef, {
        type: 'generator',
        id: gen.id,
        field: `variables.${varName}.select`,
        location,
      });
    });

    (gen.creation || []).forEach((creation, idx) => {
      const kind = typeof creation.kind === 'string' ? creation.kind : null;
      if (kind) {
        recordEntityKindRef(usageMap, kind, 'generators', genRef, {
          type: 'generator',
          id: gen.id,
          field: `creation[${idx}].kind`,
          location,
        });
      }

      if (typeof creation.subtype === 'string') {
        recordSubtypeRef(usageMap, creation.subtype, 'generators', genRef);
      } else if (creation.subtype?.random && Array.isArray(creation.subtype.random)) {
        creation.subtype.random.forEach((subtype) => {
          recordSubtypeRef(usageMap, subtype, 'generators', genRef);
        });
      }

      if (creation.status) {
        recordStatusRef(usageMap, creation.status, 'generators', genRef);
      }

      if (creation.tags && typeof creation.tags === 'object') {
        Object.keys(creation.tags).forEach(tag => recordTagRef(usageMap, tag, 'generators', genRef));
      }
    });

    (gen.relationships || []).forEach((rel, idx) => {
      recordRelationshipKindRef(usageMap, rel.kind, 'generators', genRef, {
        type: 'generator',
        id: gen.id,
        field: `relationships[${idx}].kind`,
        location,
      });
    });

    scanMutations(gen.stateUpdates || [], usageMap, pressureIds, 'generators', genRef, {
      type: 'generator',
      id: gen.id,
      field: 'stateUpdates',
      location,
    });

    (gen.variants?.options || []).forEach((variant, idx) => {
      scanCondition(variant.when, usageMap, pressureIds, 'generators', genRef, {
        type: 'generator',
        id: gen.id,
        field: `variants.options[${idx}].when`,
        location,
      });

      (variant.apply?.relationships || []).forEach((rel, relIdx) => {
        recordRelationshipKindRef(usageMap, rel.kind, 'generators', genRef, {
          type: 'generator',
          id: gen.id,
          field: `variants.options[${idx}].apply.relationships[${relIdx}].kind`,
          location,
        });
      });

      if (variant.apply?.tags) {
        Object.values(variant.apply.tags).forEach((tagMap) => {
          if (!tagMap || typeof tagMap !== 'object') return;
          Object.keys(tagMap).forEach((tag) => recordTagRef(usageMap, tag, 'generators', genRef));
        });
      }

      scanMutations(variant.apply?.stateUpdates || [], usageMap, pressureIds, 'generators', genRef, {
        type: 'generator',
        id: gen.id,
        field: `variants.options[${idx}].apply.stateUpdates`,
        location,
      });
    });
  });
}

function scanSystemReferences(usageMap, systems, schema, pressures) {
  const pressureIds = new Set((pressures || []).map(p => p.id));

  (systems || []).forEach(sys => {
    const sysId = sys.config.id;
    const sysName = sys.config.name || sysId;
    const sysRef = { id: sysId, name: sysName };
    const config = sys.config;
    const location = `System "${sysName}"`;

    scanSelectionRule(config.selection, usageMap, 'systems', sysRef, {
      type: 'system',
      id: sysId,
      field: 'selection',
      location,
    });

    Object.keys(config.pressureChanges || {}).forEach((pressureId) => {
      recordPressureRef(usageMap, pressureIds, pressureId, 'systems', sysRef, {
        type: 'system',
        id: sysId,
        field: 'pressureChanges',
        location,
      });
    });

    // Type-specific scanning
    switch (sys.systemType) {
      case 'graphContagion':
        if (config.contagion?.type === 'relationship') {
          recordRelationshipKindRef(usageMap, config.contagion.relationshipKind, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'contagion.relationshipKind',
            location,
          });
        }
        if (config.contagion?.type === 'tag' && config.contagion.tagPattern) {
          recordTagRef(usageMap, config.contagion.tagPattern, 'systems', sysRef);
        }
        (config.vectors || []).forEach((vector, idx) => {
          recordRelationshipKindRef(usageMap, vector.relationshipKind, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: `vectors[${idx}].relationshipKind`,
            location,
          });
        });
        scanMutations(
          config.infectionAction ? [config.infectionAction] : [],
          usageMap,
          pressureIds,
          'systems',
          sysRef,
          {
            type: 'system',
            id: sysId,
            field: 'infectionAction',
            location,
          }
        );
        (config.phaseTransitions || []).forEach((transition, idx) => {
          scanSelectionRule(transition.selection, usageMap, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: `phaseTransitions[${idx}].selection`,
            location,
          });
          if (transition.toStatus) {
            recordStatusRef(usageMap, transition.toStatus, 'systems', sysRef);
          }
        });
        if (config.multiSource?.sourceSelection) {
          scanSelectionRule(config.multiSource.sourceSelection, usageMap, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'multiSource.sourceSelection',
            location,
          });
        }
        if (config.multiSource?.immunityTagPrefix) {
          recordTagRef(usageMap, config.multiSource.immunityTagPrefix, 'systems', sysRef);
        }
        break;

      case 'connectionEvolution':
        (config.subtypeBonuses || []).forEach((bonus) => recordSubtypeRef(usageMap, bonus.subtype, 'systems', sysRef));
        scanMetric(config.metric, usageMap, 'systems', sysRef, {
          type: 'system',
          id: sysId,
          field: 'metric',
          location,
        });
        (config.rules || []).forEach((rule, idx) => {
          scanMutations(rule?.action ? [rule.action] : [], usageMap, pressureIds, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: `rules[${idx}].action`,
            location,
          });
        });
        break;

      case 'thresholdTrigger':
        (config.conditions || []).forEach((cond, idx) => {
          scanCondition(cond, usageMap, pressureIds, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: `conditions[${idx}]`,
            location,
          });
        });
        scanMutations(config.actions || [], usageMap, pressureIds, 'systems', sysRef, {
          type: 'system',
          id: sysId,
          field: 'actions',
          location,
        });
        if (config.clusterRelationshipKind) {
          recordRelationshipKindRef(usageMap, config.clusterRelationshipKind, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'clusterRelationshipKind',
            location,
          });
        }
        break;

      case 'clusterFormation':
        (config.clustering?.criteria || []).forEach((crit, idx) => {
          if (crit.type === 'shared_relationship') {
            recordRelationshipKindRef(usageMap, crit.relationshipKind, 'systems', sysRef, {
              type: 'system',
              id: sysId,
              field: `clustering.criteria[${idx}].relationshipKind`,
              location,
            });
          }
        });
        if (config.metaEntity?.kind) {
          recordEntityKindRef(usageMap, config.metaEntity.kind, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'metaEntity.kind',
            location,
          });
        }
        (config.metaEntity?.additionalTags || []).forEach((tag) => recordTagRef(usageMap, tag, 'systems', sysRef));
        Object.keys(config.postProcess?.pressureChanges || {}).forEach((pressureId) => {
          recordPressureRef(usageMap, pressureIds, pressureId, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'postProcess.pressureChanges',
            location,
          });
        });
        if (config.postProcess?.governanceRelationship) {
          recordRelationshipKindRef(usageMap, config.postProcess.governanceRelationship, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'postProcess.governanceRelationship',
            location,
          });
        }
        if (config.postProcess?.governanceFactionSubtype) {
          recordSubtypeRef(usageMap, config.postProcess.governanceFactionSubtype, 'systems', sysRef);
        }
        break;

      case 'tagDiffusion':
        if (config.connectionKind) {
          recordRelationshipKindRef(usageMap, config.connectionKind, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'connectionKind',
            location,
          });
        }
        (config.convergence?.tags || []).forEach((tag) => recordTagRef(usageMap, tag, 'systems', sysRef));
        (config.divergence?.tags || []).forEach((tag) => recordTagRef(usageMap, tag, 'systems', sysRef));
        if (config.divergencePressure?.pressureName) {
          recordPressureRef(usageMap, pressureIds, config.divergencePressure.pressureName, 'systems', sysRef, {
            type: 'system',
            id: sysId,
            field: 'divergencePressure.pressureName',
            location,
          });
        }
        break;

      case 'planeDiffusion':
        if (config.sources?.tagFilter) recordTagRef(usageMap, config.sources.tagFilter, 'systems', sysRef);
        if (config.sources?.strengthTag) recordTagRef(usageMap, config.sources.strengthTag, 'systems', sysRef);
        if (config.sinks?.tagFilter) recordTagRef(usageMap, config.sinks.tagFilter, 'systems', sysRef);
        if (config.sinks?.strengthTag) recordTagRef(usageMap, config.sinks.strengthTag, 'systems', sysRef);
        (config.outputTags || []).forEach((tagConfig) => recordTagRef(usageMap, tagConfig.tag, 'systems', sysRef));
        if (config.valueTag) recordTagRef(usageMap, config.valueTag, 'systems', sysRef);
        break;
      default:
        break;
    }
  });
}

function scanActionReferences(usageMap, actions, schema, pressures) {
  const pressureIds = new Set((pressures || []).map(p => p.id));

  (actions || []).forEach(action => {
    const actionRef = { id: action.id, name: action.name };
    const location = `Action "${action.name || action.id}"`;

    scanSelectionRule(action.actor?.selection, usageMap, 'actions', actionRef, {
      type: 'action',
      id: action.id,
      field: 'actor.selection',
      location,
    });

    (action.actor?.conditions || []).forEach((condition, idx) => {
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

    scanMutations(action.outcome?.mutations || [], usageMap, pressureIds, 'actions', actionRef, {
      type: 'action',
      id: action.id,
      field: 'outcome.mutations',
      location,
    });

    const pressureModifiers = action.probability?.pressureModifiers;
    if (Array.isArray(pressureModifiers)) {
      pressureModifiers.forEach((mod) => {
        recordPressureRef(usageMap, pressureIds, mod?.pressure, 'actions', actionRef, {
          type: 'action',
          id: action.id,
          field: 'probability.pressureModifiers',
          location,
        });
      });
    }
  });
}

function detectOrphans(usageMap, schema, pressures, generators, systems) {
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

function checkRelationshipCompatibility(usageMap, generators, actions, schema) {
  const relationshipKinds = {};
  (schema?.relationshipKinds || []).forEach(rk => {
    relationshipKinds[rk.kind] = {
      srcKinds: rk.srcKinds || [],
      dstKinds: rk.dstKinds || [],
    };
  });

  // Check generator relationship compatibility
  (generators || []).forEach(gen => {
    const createdKinds = new Set((gen.creation || []).map(c => c.kind));

    (gen.relationships || []).forEach((rel, idx) => {
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
  (actions || []).forEach(action => {
    const actorSelection = action.actor?.selection || {};
    const actorKinds = [
      ...(actorSelection.kind ? [actorSelection.kind] : []),
      ...(actorSelection.kinds || []),
    ];
    const instigatorSelection = action.actor?.instigator || {};
    const instigatorKinds = [
      ...(instigatorSelection.kind ? [instigatorSelection.kind] : []),
      ...(instigatorSelection.kinds || []),
    ];
    const targetSelection = action.targeting || {};
    const targetKinds = [
      ...(targetSelection.kind ? [targetSelection.kind] : []),
      ...(targetSelection.kinds || []),
    ];

    const kindsForRef = (ref) => {
      if (ref === '$actor') return actorKinds;
      if (ref === '$instigator') return instigatorKinds;
      if (ref === '$target' || ref === '$target2') return targetKinds;
      return [];
    };

    (action.outcome?.mutations || []).forEach((mutation, idx) => {
      if (mutation.type !== 'create_relationship' && mutation.type !== 'adjust_relationship_strength') {
        return;
      }
      const rkDef = relationshipKinds[mutation.kind];
      if (!rkDef) return;

      const srcKinds = kindsForRef(mutation.src);
      const dstKinds = kindsForRef(mutation.dst);

      if (rkDef.srcKinds.length > 0 && srcKinds.length > 0) {
        const compatible = srcKinds.some(k => rkDef.srcKinds.includes(k));
        if (!compatible) {
          usageMap.validation.compatibility.push({
            type: 'action',
            id: action.id,
            field: `outcome.mutations[${idx}]`,
            issue: `Relationship "${mutation.kind}" requires src to be one of [${rkDef.srcKinds.join(', ')}], but ${mutation.src} kinds are [${srcKinds.join(', ')}]`,
          });
        }
      }

      if (rkDef.dstKinds.length > 0 && dstKinds.length > 0) {
        const compatible = dstKinds.some(k => rkDef.dstKinds.includes(k));
        if (!compatible) {
          usageMap.validation.compatibility.push({
            type: 'action',
            id: action.id,
            field: `outcome.mutations[${idx}]`,
            issue: `Relationship "${mutation.kind}" requires dst to be one of [${rkDef.dstKinds.join(', ')}], but ${mutation.dst} kinds are [${dstKinds.join(', ')}]`,
          });
        }
      }
    });
  });
}

/**
 * Get validation status for a specific element
 */
export function getElementValidation(usageMap, type, id) {
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

/**
 * Get usage summary for display
 */
export function getUsageSummary(usage) {
  const parts = [];
  if (usage.generators?.length > 0) {
    parts.push(`${usage.generators.length} generator${usage.generators.length !== 1 ? 's' : ''}`);
  }
  if (usage.systems?.length > 0) {
    parts.push(`${usage.systems.length} system${usage.systems.length !== 1 ? 's' : ''}`);
  }
  if (usage.actions?.length > 0) {
    parts.push(`${usage.actions.length} action${usage.actions.length !== 1 ? 's' : ''}`);
  }
  if (usage.pressures?.length > 0) {
    parts.push(`${usage.pressures.length} pressure${usage.pressures.length !== 1 ? 's' : ''}`);
  }
  if (usage.eras?.length > 0) {
    parts.push(`${usage.eras.length} era${usage.eras.length !== 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Not used';
}

// =============================================================================
// Helper functions from Canonry for cross-tool usage display
// =============================================================================

/**
 * Utility function to compute tag usage across tools
 *
 * @param {Object} params - All sources that reference tags
 * @param {Array} params.cultures - Array of culture objects with naming.profiles
 * @param {Array} params.seedEntities - Array of seed entities with tags
 * @param {Array} params.generators - Array of generator configs
 * @param {Array} params.systems - Array of system configs
 * @param {Array} params.pressures - Array of pressure configs
 * @param {Array} params.entityKinds - Array of entity kind definitions (with semantic planes)
 * @param {Array} params.axisDefinitions - Axis definitions referenced by semantic planes
 * @returns {Object} - Map of tag -> { nameforge, seed, generators, systems, pressures, axis }
 */
export function computeTagUsage({ cultures, seedEntities, generators, systems, pressures, entityKinds, axisDefinitions } = {}) {
  const usage = {};

  const ensureTag = (tag) => {
    if (!usage[tag]) {
      usage[tag] = {};
    }
  };

  const addTagUsage = (tag, section) => {
    if (!tag) return;
    ensureTag(tag);
    usage[tag][section] = (usage[tag][section] || 0) + 1;
  };

  const collectTagsFromFilters = (filters, section) => {
    (filters || []).forEach((filter) => {
      switch (filter.type) {
        case 'has_tag':
        case 'lacks_tag':
          addTagUsage(filter.tag, section);
          break;
        case 'has_tags':
        case 'has_any_tag':
        case 'lacks_any_tag':
          (filter.tags || []).forEach((tag) => addTagUsage(tag, section));
          break;
        default:
          break;
      }
    });
  };

  const collectTagsFromCondition = (condition, section) => {
    if (!condition) return;
    switch (condition.type) {
      case 'tag_exists':
      case 'tag_absent':
        addTagUsage(condition.tag, section);
        break;
      case 'and':
      case 'or':
        (condition.conditions || []).forEach((child) => collectTagsFromCondition(child, section));
        break;
      default:
        break;
    }
  };

  const collectTagsFromMutations = (mutations, section) => {
    (mutations || []).forEach((mutation) => {
      if (mutation.type === 'set_tag' || mutation.type === 'remove_tag') {
        addTagUsage(mutation.tag, section);
      }
    });
  };

  // Count tags used in Name Forge profiles
  (cultures || []).forEach(culture => {
    const profiles = culture.naming?.profiles || [];
    profiles.forEach(profile => {
      const groups = profile.strategyGroups || [];
      groups.forEach(group => {
        const tags = group.conditions?.tags || [];
        tags.forEach(tag => {
          ensureTag(tag);
          usage[tag].nameforge = (usage[tag].nameforge || 0) + 1;
        });
      });
    });
  });

  // Count tags used in seed entities (tags stored as { tag: true } object)
  (seedEntities || []).forEach(entity => {
    const tags = entity.tags || {};
    Object.keys(tags).forEach(tag => {
      ensureTag(tag);
      usage[tag].seed = (usage[tag].seed || 0) + 1;
    });
  });

  // Count tags used in generators
  (generators || []).forEach(gen => {
    // Tags in creation entries
    (gen.creation || []).forEach(creation => {
      if (creation.tags && typeof creation.tags === 'object') {
        Object.keys(creation.tags).forEach(tag => addTagUsage(tag, 'generators'));
      }
    });

    // Tags in applicability rules
    (gen.applicability || []).forEach((rule) => collectTagsFromCondition(rule, 'generators'));

    // Tags in selection filters
    collectTagsFromFilters(gen.selection?.filters, 'generators');

    // Tags in stateUpdates (set_tag, remove_tag)
    collectTagsFromMutations(gen.stateUpdates || [], 'generators');

    // Tags in variants
    (gen.variants?.options || []).forEach(variant => {
      // Tags in variant conditions
      collectTagsFromCondition(variant.when, 'generators');
      // Tags in variant effects
      if (variant.apply?.tags && typeof variant.apply.tags === 'object') {
        Object.entries(variant.apply.tags).forEach(([ref, tagMap]) => {
          Object.keys(tagMap).forEach(tag => {
            addTagUsage(tag, 'generators');
          });
        });
      }
      collectTagsFromMutations(variant.apply?.stateUpdates || [], 'generators');
    });
  });

  // Count tags used in systems
  (systems || []).forEach(sys => {
    const config = sys.config;

    // Tags in selection filters
    collectTagsFromFilters(config.selection?.filters, 'systems');
    collectTagsFromFilters(config.multiSource?.sourceSelection?.filters, 'systems');
    (config.phaseTransitions || []).forEach((transition) => {
      collectTagsFromFilters(transition.selection?.filters, 'systems');
    });

    // Tag diffusion systems
    if (sys.systemType === 'tagDiffusion') {
      (config.convergence?.tags || []).forEach(tag => {
        addTagUsage(tag, 'systems');
      });
      (config.divergence?.tags || []).forEach(tag => {
        addTagUsage(tag, 'systems');
      });
    }

    // Threshold trigger conditions
    if (sys.systemType === 'thresholdTrigger') {
      (config.conditions || []).forEach((cond) => collectTagsFromCondition(cond, 'systems'));
      collectTagsFromMutations(config.actions || [], 'systems');
    }

    if (sys.systemType === 'graphContagion') {
      if (config.contagion?.type === 'tag' && config.contagion.tagPattern) {
        addTagUsage(config.contagion.tagPattern, 'systems');
      }
      collectTagsFromMutations(config.infectionAction ? [config.infectionAction] : [], 'systems');
    }

    if (sys.systemType === 'connectionEvolution') {
      (config.rules || []).forEach((rule) => {
        collectTagsFromMutations(rule?.action ? [rule.action] : [], 'systems');
      });
    }

    if (sys.systemType === 'clusterFormation') {
      (config.metaEntity?.additionalTags || []).forEach((tag) => addTagUsage(tag, 'systems'));
    }

    if (sys.systemType === 'planeDiffusion') {
      if (config.sources?.tagFilter) addTagUsage(config.sources.tagFilter, 'systems');
      if (config.sources?.strengthTag) addTagUsage(config.sources.strengthTag, 'systems');
      if (config.sinks?.tagFilter) addTagUsage(config.sinks.tagFilter, 'systems');
      if (config.sinks?.strengthTag) addTagUsage(config.sinks.strengthTag, 'systems');
      (config.outputTags || []).forEach((tagConfig) => addTagUsage(tagConfig.tag, 'systems'));
      if (config.valueTag) addTagUsage(config.valueTag, 'systems');
    }
  });

  // Count tags used in pressures (feedback factors)
  (pressures || []).forEach(pressure => {
    const scanFeedbackFactors = (factors) => {
      (factors || []).forEach(factor => {
        if (factor.tag) {
          ensureTag(factor.tag);
          usage[factor.tag].pressures = (usage[factor.tag].pressures || 0) + 1;
        }
        if (factor.tags && Array.isArray(factor.tags)) {
          factor.tags.forEach(tag => {
            ensureTag(tag);
            usage[tag].pressures = (usage[tag].pressures || 0) + 1;
          });
        }
      });
    };
    scanFeedbackFactors(pressure.growth?.positiveFeedback);
    scanFeedbackFactors(pressure.growth?.negativeFeedback);
  });

  // Count tags used as semantic plane axis labels
  const axisById = new Map((axisDefinitions || []).map(axis => [axis.id, axis]));
  (entityKinds || []).forEach(ek => {
    const axes = ek.semanticPlane?.axes || {};
    Object.values(axes).forEach(axisRef => {
      if (!axisRef?.axisId) return;
      const axis = axisById.get(axisRef.axisId);
      if (!axis) return;
      if (axis.lowTag) {
        ensureTag(axis.lowTag);
        usage[axis.lowTag].axis = (usage[axis.lowTag].axis || 0) + 1;
      }
      if (axis.highTag) {
        ensureTag(axis.highTag);
        usage[axis.highTag].axis = (usage[axis.highTag].axis || 0) + 1;
      }
    });
  });

  return usage;
}

/**
 * Get a summary of usage for an entity kind (for cross-tool badges)
 * @param {Object} schemaUsage - Output from computeSchemaUsage or usageMap.entityKinds
 * @param {string} kind - Entity kind ID
 * @returns {Object} - { coherence: number, seed: number } for ToolUsageBadges component
 */
export function getEntityKindUsageSummary(schemaUsage, kind) {
  const usage = schemaUsage?.entityKinds?.[kind];
  if (!usage) return { coherence: 0 };

  const coherenceTotal =
    (usage.generators?.length || 0) +
    (usage.systems?.length || 0) +
    (usage.actions?.length || 0) +
    (usage.pressures?.length || 0);

  const seedTotal = usage.seeds?.length || 0;

  return {
    coherence: coherenceTotal,
    ...(seedTotal > 0 && { seed: seedTotal }),
  };
}

/**
 * Get a summary of usage for a relationship kind (for cross-tool badges)
 * @param {Object} schemaUsage - Output from computeSchemaUsage or usageMap.relationshipKinds
 * @param {string} kind - Relationship kind ID
 * @returns {Object} - { coherence: number } for ToolUsageBadges component
 */
export function getRelationshipKindUsageSummary(schemaUsage, kind) {
  const usage = schemaUsage?.relationshipKinds?.[kind];
  if (!usage) return { coherence: 0 };

  const total =
    (usage.generators?.length || 0) +
    (usage.systems?.length || 0) +
    (usage.actions?.length || 0);

  return { coherence: total };
}

/**
 * Compute schema element usage (simpler version for badge display)
 *
 * Unlike computeUsageMap which focuses on validation, this function tracks
 * usage counts including seed entities for display in Canonry's schema editors.
 *
 * @param {Object} params
 * @param {Array} params.generators - Array of generator configs
 * @param {Array} params.systems - Array of system configs
 * @param {Array} params.actions - Array of action configs
 * @param {Array} params.pressures - Array of pressure configs
 * @param {Array} params.seedEntities - Array of seed entities
 * @returns {Object} - {
 *   entityKinds: { [kindId]: { generators: [], systems: [], actions: [], pressures: [], seeds: [] } },
 *   relationshipKinds: { [kindId]: { generators: [], systems: [], actions: [] } },
 *   subtypes: { [kindId]: { [subtypeId]: { generators: [], systems: [], seeds: [] } } },
 *   statuses: { [kindId]: { [statusId]: { generators: [], systems: [] } } }
 * }
 */
export function computeSchemaUsage({
  generators = [],
  systems = [],
  actions = [],
  pressures = [],
  seedEntities = [],
}) {
  const usage = {
    entityKinds: {},
    relationshipKinds: {},
    subtypes: {},
    statuses: {},
  };

  // Helper to ensure usage entry exists
  const ensureEntityKind = (kind) => {
    if (!usage.entityKinds[kind]) {
      usage.entityKinds[kind] = { generators: [], systems: [], actions: [], pressures: [], seeds: [] };
    }
  };

  const ensureRelationshipKind = (kind) => {
    if (!usage.relationshipKinds[kind]) {
      usage.relationshipKinds[kind] = { generators: [], systems: [], actions: [] };
    }
  };

  const ensureSubtype = (entityKind, subtype) => {
    if (!usage.subtypes[entityKind]) {
      usage.subtypes[entityKind] = {};
    }
    if (!usage.subtypes[entityKind][subtype]) {
      usage.subtypes[entityKind][subtype] = { generators: [], systems: [], seeds: [] };
    }
  };

  const ensureStatus = (entityKind, status) => {
    if (!usage.statuses[entityKind]) {
      usage.statuses[entityKind] = {};
    }
    if (!usage.statuses[entityKind][status]) {
      usage.statuses[entityKind][status] = { generators: [], systems: [] };
    }
  };

  const addEntityKindUsage = (kind, section, id) => {
    if (!kind || kind === 'any') return;
    ensureEntityKind(kind);
    usage.entityKinds[kind][section].push(id);
  };

  const addRelationshipKindUsage = (kind, section, id) => {
    if (!kind) return;
    ensureRelationshipKind(kind);
    usage.relationshipKinds[kind][section].push(id);
  };

  const addSubtypeUsage = (kind, subtype, section, id) => {
    if (!kind || !subtype) return;
    ensureSubtype(kind, subtype);
    usage.subtypes[kind][subtype][section].push(id);
  };

  const addStatusUsage = (kind, status, section, id) => {
    if (!kind || !status) return;
    ensureStatus(kind, status);
    usage.statuses[kind][status][section].push(id);
  };

  const recordSelectionUsage = (selection, section, id) => {
    if (!selection) return;
    if (selection.kind) addEntityKindUsage(selection.kind, section, id);
    (selection.kinds || []).forEach((kind) => addEntityKindUsage(kind, section, id));
  };

  const recordConditionUsage = (condition, section, id) => {
    if (!condition) return;
    switch (condition.type) {
      case 'entity_count':
        addEntityKindUsage(condition.kind, section, id);
        if (condition.subtype) addSubtypeUsage(condition.kind, condition.subtype, section, id);
        if (condition.status) addStatusUsage(condition.kind, condition.status, section, id);
        break;
      case 'relationship_count':
      case 'relationship_exists':
      case 'entity_has_relationship':
        addRelationshipKindUsage(condition.relationshipKind, section, id);
        break;
      case 'and':
      case 'or':
        (condition.conditions || []).forEach((child) => recordConditionUsage(child, section, id));
        break;
      default:
        break;
    }
  };

  const recordMutationUsage = (mutation, section, id) => {
    if (!mutation) return;
    if (mutation.type === 'create_relationship' || mutation.type === 'adjust_relationship_strength') {
      addRelationshipKindUsage(mutation.kind, section, id);
    } else if (mutation.type === 'archive_relationship') {
      addRelationshipKindUsage(mutation.relationshipKind, section, id);
    }
  };

  // Analyze generators
  generators.forEach((gen) => {
    const genId = gen.id || gen.name || 'unnamed';

    // Entity kinds produced (in creation array)
    const creations = gen.creation || [];
    creations.forEach((c) => {
      const kind = typeof c.kind === 'string' ? c.kind : null;
      if (kind) {
        addEntityKindUsage(kind, 'generators', genId);
      }
      if (kind && typeof c.subtype === 'string') {
        addSubtypeUsage(kind, c.subtype, 'generators', genId);
      } else if (kind && c.subtype?.random && Array.isArray(c.subtype.random)) {
        c.subtype.random.forEach((subtype) => addSubtypeUsage(kind, subtype, 'generators', genId));
      }
      if (kind && typeof c.status === 'string') {
        addStatusUsage(kind, c.status, 'generators', genId);
      }
    });

    // Selection kind (the kind being selected from)
    recordSelectionUsage(gen.selection, 'generators', genId);

    // Applicability rules that reference kinds
    (gen.applicability || []).forEach((rule) => recordConditionUsage(rule, 'generators', genId));

    // Relationships created (in creation or at top level)
    const relationships = gen.relationships || [];
    relationships.forEach((rel) => {
      const relKind = typeof rel === 'string' ? rel : rel.kind;
      if (relKind) {
        addRelationshipKindUsage(relKind, 'generators', genId);
      }
    });

    // Relationships in creation entries
    creations.forEach((c) => {
      if (c.lineage?.relationshipKind) {
        addRelationshipKindUsage(c.lineage.relationshipKind, 'generators', genId);
      }
    });

    // Requirements (entity kinds in conditions)
    if (gen.requires) {
      Object.entries(gen.requires).forEach(([key, value]) => {
        if (key === 'entityKind' || key === 'kind') {
          addEntityKindUsage(value, 'generators', genId);
        }
      });
    }

    (gen.stateUpdates || []).forEach((mutation) => recordMutationUsage(mutation, 'generators', genId));

    (gen.variants?.options || []).forEach((variant) => {
      recordConditionUsage(variant.when, 'generators', genId);
      (variant.apply?.relationships || []).forEach((rel) => {
        if (rel?.kind) addRelationshipKindUsage(rel.kind, 'generators', genId);
      });
      (variant.apply?.stateUpdates || []).forEach((mutation) => recordMutationUsage(mutation, 'generators', genId));
    });
  });

  // Analyze systems
  systems.forEach((sys) => {
    const cfg = sys.config;
    const sysId = cfg.id;

    recordSelectionUsage(cfg.selection, 'systems', sysId);

    if (sys.systemType === 'graphContagion') {
      if (cfg.contagion?.relationshipKind) {
        addRelationshipKindUsage(cfg.contagion.relationshipKind, 'systems', sysId);
      }
      (cfg.vectors || []).forEach((vector) => {
        if (vector.relationshipKind) addRelationshipKindUsage(vector.relationshipKind, 'systems', sysId);
      });
      recordMutationUsage(cfg.infectionAction, 'systems', sysId);
      if (cfg.multiSource?.sourceSelection) {
        recordSelectionUsage(cfg.multiSource.sourceSelection, 'systems', sysId);
      }
      (cfg.phaseTransitions || []).forEach((transition) => {
        recordSelectionUsage(transition.selection, 'systems', sysId);
      });
    }

    if (sys.systemType === 'thresholdTrigger') {
      (cfg.conditions || []).forEach((condition) => recordConditionUsage(condition, 'systems', sysId));
      (cfg.actions || []).forEach((mutation) => recordMutationUsage(mutation, 'systems', sysId));
      if (cfg.clusterRelationshipKind) addRelationshipKindUsage(cfg.clusterRelationshipKind, 'systems', sysId);
    }

    if (sys.systemType === 'connectionEvolution') {
      if (cfg.metric?.relationshipKinds) {
        cfg.metric.relationshipKinds.forEach((kind) => addRelationshipKindUsage(kind, 'systems', sysId));
      }
      if (cfg.metric?.sharedRelationshipKind) {
        addRelationshipKindUsage(cfg.metric.sharedRelationshipKind, 'systems', sysId);
      }
      (cfg.rules || []).forEach((rule) => recordMutationUsage(rule?.action, 'systems', sysId));
    }

    if (sys.systemType === 'tagDiffusion') {
      if (cfg.connectionKind) addRelationshipKindUsage(cfg.connectionKind, 'systems', sysId);
    }

    if (sys.systemType === 'clusterFormation') {
      if (cfg.metaEntity?.kind) addEntityKindUsage(cfg.metaEntity.kind, 'systems', sysId);
      (cfg.clustering?.criteria || []).forEach((criterion) => {
        if (criterion.type === 'shared_relationship') {
          addRelationshipKindUsage(criterion.relationshipKind, 'systems', sysId);
        }
      });
    }
  });

  // Analyze actions
  actions.forEach((action) => {
    const actionId = action.id || action.name || 'unnamed';
    recordSelectionUsage(action.actor?.selection, 'actions', actionId);
    recordSelectionUsage(action.targeting, 'actions', actionId);
    (action.outcome?.mutations || []).forEach((mutation) => recordMutationUsage(mutation, 'actions', actionId));
  });

  // Analyze seed entities
  seedEntities.forEach((entity) => {
    const entityLabel = entity.name || entity.id || 'unnamed seed';

    if (entity.kind) {
      ensureEntityKind(entity.kind);
      usage.entityKinds[entity.kind].seeds.push(entityLabel);
    }

    if (entity.kind && entity.subtype) {
      ensureSubtype(entity.kind, entity.subtype);
      usage.subtypes[entity.kind][entity.subtype].seeds.push(entityLabel);
    }
  });

  return usage;
}
