import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
} from './types.js';

import { isRecord, normalizeKindList, normalizeStringList, setObjectValue, readStringValue, readNumberValue, applyLabelField, tokensFromValueStrict, tokensFromBlockAttributes, isArrayValue, isObjectValue, isCallValue, pushArrayValue } from './compile-utils.js';
import { valueToJson, parseResourceReferenceValue } from './compile-variables.js';
import { applySetFieldAttribute } from './compile-sets.js';
import { buildObjectFromStatements } from './compile-objects.js';

export function buildTagItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;

  if (block.labels[0]) {
    if (!applyLabelField(item, 'tag', block.labels[0], diagnostics, block)) return null;
  }

  if (item.kinds !== undefined && item.entityKinds === undefined) {
    const normalized = normalizeStringList(item.kinds, diagnostics, block, 'kinds');
    if (!normalized) return null;
    item.entityKinds = normalized;
    delete item.kinds;
  }
  if (item.related !== undefined && item.relatedTags === undefined) {
    const normalized = normalizeStringList(item.related, diagnostics, block, 'related');
    if (!normalized) return null;
    item.relatedTags = normalized;
    delete item.related;
  }
  if (item.conflicts !== undefined && item.conflictingTags === undefined) {
    const normalized = normalizeStringList(item.conflicts, diagnostics, block, 'conflicts');
    if (!normalized) return null;
    item.conflictingTags = normalized;
    delete item.conflicts;
  }
  if (item.exclusive !== undefined && item.mutuallyExclusiveWith === undefined) {
    const normalized = normalizeStringList(item.exclusive, diagnostics, block, 'exclusive');
    if (!normalized) return null;
    item.mutuallyExclusiveWith = normalized;
    delete item.exclusive;
  }
  if (item.axis !== undefined && item.isAxis === undefined) {
    if (item.axis === true) {
      item.isAxis = true;
    } else if (item.axis === false || item.axis === null || item.axis === 'none') {
      item.isAxis = false;
    } else if (typeof item.axis === 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'axis must be "none" or omitted',
        span: block.span
      });
      return null;
    } else {
      item.isAxis = item.axis;
    }
    delete item.axis;
  }

  if (item.usage !== undefined) {
    if (item.minUsage === undefined && item.maxUsage === undefined) {
      if (item.usage === 'none' || item.usage === null) {
        delete item.usage;
      } else if (Array.isArray(item.usage) && item.usage.length === 2) {
        item.minUsage = item.usage[0];
        item.maxUsage = item.usage[1];
        delete item.usage;
      } else {
        diagnostics.push({
          severity: 'error',
          message: 'usage must be "none" or two numeric values',
          span: block.span
        });
        return null;
      }
    } else {
      delete item.usage;
    }
  }

  if (item.count !== undefined && item.usageCount === undefined) {
    if (item.count === 'none' || item.count === null) {
      delete item.count;
    } else {
      item.usageCount = item.count;
      delete item.count;
    }
  }

  return item;
}

export function buildRelationshipKindItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;

  if (block.labels[0]) {
    if (!applyLabelField(item, 'kind', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (item.description === undefined && item.name === undefined) {
      item.description = block.labels[1];
    } else if (item.description !== undefined) {
      if (!applyLabelField(item, 'description', block.labels[1], diagnostics, block)) return null;
    } else if (item.name !== undefined) {
      if (!applyLabelField(item, 'name', block.labels[1], diagnostics, block)) return null;
    }
  }

  if (item.srcKinds === undefined && item.src !== undefined) {
    const normalized = normalizeKindList(item.src, diagnostics, block, 'src');
    if (!normalized) return null;
    item.srcKinds = normalized;
    delete item.src;
  }

  if (item.dstKinds === undefined && item.dst !== undefined) {
    const normalized = normalizeKindList(item.dst, diagnostics, block, 'dst');
    if (!normalized) return null;
    item.dstKinds = normalized;
    delete item.dst;
  }

  if (item.srcKinds !== undefined && !Array.isArray(item.srcKinds)) {
    const normalized = normalizeKindList(item.srcKinds, diagnostics, block, 'srcKinds');
    if (!normalized) return null;
    item.srcKinds = normalized;
  }

  if (item.dstKinds !== undefined && !Array.isArray(item.dstKinds)) {
    const normalized = normalizeKindList(item.dstKinds, diagnostics, block, 'dstKinds');
    if (!normalized) return null;
    item.dstKinds = normalized;
  }

  return item;
}

export function buildSeedEntityItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item = buildObjectFromStatements(block.body, diagnostics, block);

  if (block.labels[0]) {
    if (!applyLabelField(item, 'id', block.labels[0], diagnostics, block)) return null;
  }

  if (item.coords !== undefined && item.coordinates === undefined) {
    item.coordinates = item.coords;
    delete item.coords;
  }

  const isNone = (value: unknown) => typeof value === 'string' && value === 'none';
  const requiredFields = [
    'kind',
    'subtype',
    'name',
    'summary',
    'description',
    'status',
    'prominence',
    'culture',
    'createdAt',
    'updatedAt',
    'tags',
    'coords',
    'links'
  ];

  for (const field of requiredFields) {
    if (field === 'coords') {
      if (item.coordinates === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'seed_entity requires coords (use coords none when empty)',
          span: block.span
        });
      }
      if (item.coordinates === null) {
        diagnostics.push({
          severity: 'error',
          message: 'coords must use none sentinel (null is not allowed)',
          span: block.span
        });
      }
      continue;
    }
    if (item[field] === undefined) {
      diagnostics.push({
        severity: 'error',
        message: `seed_entity requires ${field} (use ${field} none when empty)`,
        span: block.span
      });
    }
    if (item[field] === null) {
      diagnostics.push({
        severity: 'error',
        message: `${field} must use none sentinel (null is not allowed)`,
        span: block.span
      });
    }
  }

  if (isNone(item.kind)) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_entity kind cannot be none',
      span: block.span
    });
    return null;
  }
  if (isNone(item.name)) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_entity name cannot be none',
      span: block.span
    });
    return null;
  }
  if (isNone(item.prominence)) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_entity prominence cannot be none',
      span: block.span
    });
    return null;
  }

  const summaryNone = isNone(item.summary);
  if (summaryNone) {
    item.summary = '';
  } else if (typeof item.summary === 'string' && item.summary.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'summary must use none sentinel when empty',
      span: block.span
    });
    return null;
  }

  const descriptionNone = isNone(item.description);
  if (descriptionNone) {
    item.description = '';
  } else if (typeof item.description === 'string' && item.description.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'description must use none sentinel when empty',
      span: block.span
    });
    return null;
  }

  const subtypeNone = isNone(item.subtype);
  if (subtypeNone) {
    delete item.subtype;
  } else if (typeof item.subtype === 'string' && item.subtype.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'subtype must use none sentinel when empty',
      span: block.span
    });
    return null;
  }

  const statusNone = isNone(item.status);
  if (statusNone) {
    delete item.status;
  } else if (typeof item.status === 'string' && item.status.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'status must use none sentinel when empty',
      span: block.span
    });
    return null;
  }

  const cultureNone = isNone(item.culture);
  if (cultureNone) {
    delete item.culture;
  } else if (typeof item.culture === 'string' && item.culture.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'culture must use none sentinel when empty',
      span: block.span
    });
    return null;
  }

  if (isNone(item.createdAt) || isNone(item.updatedAt)) {
    diagnostics.push({
      severity: 'error',
      message: 'createdAt/updatedAt must be numbers (not none)',
      span: block.span
    });
    return null;
  }

  if (Array.isArray(item.coordinates)) {
    const coords = item.coordinates as unknown[];
    const [x, y, z] = [coords[0], coords[1], coords[2]];
    if ([x, y, z].every((value) => typeof value === 'number')) {
      item.coordinates = { x: x as number, y: y as number, z: z as number };
    } else {
      diagnostics.push({
        severity: 'error',
        message: 'coordinates must be [x y z] numbers',
        span: block.span
      });
      return null;
    }
  }

  if (isNone(item.coordinates)) {
    diagnostics.push({
      severity: 'error',
      message: 'coords cannot be none',
      span: block.span
    });
    return null;
  }

  if (typeof item.tags === 'string' && !isNone(item.tags)) {
    item.tags = [item.tags];
  }

  const tagsNone = isNone(item.tags) || (Array.isArray(item.tags) && item.tags.length === 0);
  if (tagsNone) {
    item.tags = {};
  } else if (Array.isArray(item.tags)) {
    const tags: Record<string, boolean> = {};
    for (const entry of item.tags) {
      if (typeof entry !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'tags must be a list of identifiers',
          span: block.span
        });
        return null;
      }
      tags[entry] = true;
    }
    item.tags = tags;
  } else if (isRecord(item.tags)) {
    const entries = Object.entries(item.tags);
    if (entries.length === 0) {
      diagnostics.push({
        severity: 'error',
        message: 'tags must use none sentinel when empty',
        span: block.span
      });
      return null;
    }
    if (!entries.every(([, value]) => value === true)) {
      diagnostics.push({
        severity: 'error',
        message: 'tags must be a list of identifiers (values are not supported in seed_entity)',
        span: block.span
      });
      return null;
    }
  }

  const linksNone = isNone(item.links) || (Array.isArray(item.links) && item.links.length === 0);
  if (linksNone) {
    item.links = [];
  } else if (Array.isArray(item.links)) {
    if (!item.links.every((entry) => typeof entry === 'string')) {
      diagnostics.push({
        severity: 'error',
        message: 'links must be a list of identifiers',
        span: block.span
      });
      return null;
    }
  } else if (item.links !== undefined) {
    diagnostics.push({
      severity: 'error',
      message: 'links must be a list of identifiers or none',
      span: block.span
    });
    return null;
  }

  return item;
}

export function buildSeedRelationshipItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const [kindLabel, srcLabel, dstLabel] = block.labels;

  if (kindLabel) {
    if (!applyLabelField(item, 'kind', kindLabel, diagnostics, block)) return null;
  }
  if (srcLabel) {
    if (!applyLabelField(item, 'src', srcLabel, diagnostics, block)) return null;
  }
  if (dstLabel) {
    if (!applyLabelField(item, 'dst', dstLabel, diagnostics, block)) return null;
  }

  if (typeof item.kind !== 'string' || typeof item.src !== 'string' || typeof item.dst !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship requires kind, src, and dst',
      span: block.span
    });
    return null;
  }

  return item;
}

export function buildSeedRelationshipGroup(
  block: BlockNode,
  diagnostics: Diagnostic[]
): Record<string, unknown>[] {
  const src = block.labels[0];
  if (!src) {
    diagnostics.push({
      severity: 'error',
      message: 'relationships block requires a source entity label',
      span: block.span
    });
    return [];
  }
  if (block.labels.length > 1) {
    diagnostics.push({
      severity: 'error',
      message: 'relationships block only supports a single source label',
      span: block.span
    });
    return [];
  }

  const relationships: Record<string, unknown>[] = [];
  for (const stmt of block.body) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'relationships block only supports relationship entries',
        span: stmt.span
      });
      continue;
    }
    if (stmt.labels && stmt.labels.length > 0) {
      diagnostics.push({
        severity: 'error',
        message: 'relationships entries must use "<kind> <dst> <strength>"',
        span: stmt.span
      });
      continue;
    }
    const raw = valueToJson(stmt.value, diagnostics, block);
    if (!Array.isArray(raw) || raw.length < 2) {
      diagnostics.push({
        severity: 'error',
        message: 'relationships entries require "<dst> <strength>"',
        span: stmt.span
      });
      continue;
    }
    if (raw.length > 2) {
      diagnostics.push({
        severity: 'error',
        message: 'relationships entries only support "<dst> <strength>"',
        span: stmt.span
      });
      continue;
    }
    const dst: unknown = raw[0];
    const strength: unknown = raw[1];
    if (typeof dst !== 'string' || typeof strength !== 'number') {
      diagnostics.push({
        severity: 'error',
        message: 'relationships entries require "<dst> <strength>"',
        span: stmt.span
      });
      continue;
    }
    relationships.push({
      kind: stmt.key,
      src,
      dst,
      strength
    });
  }

  return relationships;
}

export function buildCultureItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item: Record<string, unknown> = {};
  const axisBiases: Record<string, unknown> = {};
  const homeRegions: Record<string, unknown[]> = {};
  let seenAxisBiases = false;
  let seenHomeRegions = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'naming') {
        diagnostics.push({
          severity: 'error',
          message: 'naming attributes are not allowed; define naming resources at top level',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'axis_bias') {
        const raw = valueToJson(stmt.value, diagnostics, block);
        if (!Array.isArray(raw) || raw.length < 4) {
          diagnostics.push({
            severity: 'error',
            message: 'axis_bias requires kind and x y z values',
            span: stmt.span
          });
          continue;
        }
        const kind: unknown = raw[0];
        const x: unknown = raw[1];
        const y: unknown = raw[2];
        const z: unknown = raw[3];
        if (typeof kind !== 'string' || typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
          diagnostics.push({
            severity: 'error',
            message: 'axis_bias requires kind and numeric x y z values',
            span: stmt.span
          });
          continue;
        }
        seenAxisBiases = true;
        axisBiases[kind] = { x, y, z };
        continue;
      }
      if (stmt.key === 'home_region') {
        const raw = valueToJson(stmt.value, diagnostics, block);
        const normalized = typeof raw === 'string' ? [raw] : raw;
        if (!Array.isArray(normalized) || normalized.length < 1) {
          diagnostics.push({
            severity: 'error',
            message: 'home_region requires kind and at least one region',
            span: stmt.span
          });
          continue;
        }
        const kind: unknown = normalized[0];
        const rest: unknown[] = normalized.slice(1);
        const regions = rest.flatMap((entry: unknown) => Array.isArray(entry) ? entry as unknown[] : [entry]);
        if (typeof kind !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'home_region requires kind and region ids',
            span: stmt.span
          });
          continue;
        }
        if (regions.length === 1 && regions[0] === 'none') {
          seenHomeRegions = true;
          homeRegions[kind] = [];
          continue;
        }
        if (regions.length === 0) {
          continue;
        }
        if (regions.includes('none')) {
          diagnostics.push({
            severity: 'error',
            message: 'home_region cannot combine none with other regions',
            span: stmt.span
          });
          continue;
        }
        if (regions.some((region) => typeof region !== 'string')) {
          diagnostics.push({
            severity: 'error',
            message: 'home_region requires kind and region ids',
            span: stmt.span
          });
          continue;
        }
        seenHomeRegions = true;
        if (!homeRegions[kind]) homeRegions[kind] = [];
        homeRegions[kind].push(...(regions as string[]));
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      setObjectValue(item, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'naming') {
        diagnostics.push({
          severity: 'error',
          message: 'naming blocks are not allowed; define domains/grammars/profiles/lexemes at top level',
          span: stmt.span
        });
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (stmt.labels.length > 0) {
        const existingId = child.id;
        if (existingId === undefined) {
          child.id = stmt.labels[0];
        } else if (typeof existingId !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block id must be a string',
            span: stmt.span
          });
        } else if (existingId !== stmt.labels[0]) {
          diagnostics.push({
            severity: 'error',
            message: `block id mismatch: label "${stmt.labels[0]}" vs id "${existingId}"`,
            span: stmt.span
          });
        }
      }
      if (stmt.labels.length > 1) {
        const existingName = child.name;
        if (existingName === undefined) {
          child.name = stmt.labels[1];
        } else if (typeof existingName !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block name must be a string',
            span: stmt.span
          });
        } else if (existingName !== stmt.labels[1]) {
          diagnostics.push({
            severity: 'error',
            message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
            span: stmt.span
          });
        }
      }
      setObjectValue(item, stmt.name, child);
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(item, 'id', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (!applyLabelField(item, 'name', block.labels[1], diagnostics, block)) return null;
  }

  if (seenAxisBiases) {
    if (isRecord(item.axisBiases)) {
      Object.assign(item.axisBiases, axisBiases);
    } else {
      item.axisBiases = axisBiases;
    }
  }
  if (seenHomeRegions) {
    if (isRecord(item.homeRegions)) {
      Object.assign(item.homeRegions, homeRegions);
    } else {
      item.homeRegions = homeRegions;
    }
  }

  return item;
}

export function buildEntityKindItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item: Record<string, unknown> = {};
  const subtypes: Record<string, unknown>[] = [];
  const statuses: Record<string, unknown>[] = [];
  const requiredRelationships: Record<string, unknown>[] = [];
  let seenSubtypes = false;
  let seenStatuses = false;
  let seenRequired = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'subtype') {
        seenSubtypes = true;
        const subtype = buildSubtypeFromPositional(stmt, diagnostics, block);
        if (subtype) subtypes.push(subtype);
        continue;
      }
      if (stmt.key === 'status') {
        seenStatuses = true;
        const status = buildStatusFromPositional(stmt, diagnostics, block);
        if (status) statuses.push(status);
        continue;
      }
      if (stmt.key === 'required') {
        seenRequired = true;
        const rule = buildRequiredRelationshipFromPositional(stmt, diagnostics, block);
        if (rule) requiredRelationships.push(rule);
        continue;
      }
      if (stmt.key === 'style') {
        const style = buildStyleFromValue(stmt.value, diagnostics, block);
        if (style) {
          item.style = style;
        }
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'subtypes') {
        seenSubtypes = true;
        if (Array.isArray(value)) subtypes.push(...(value as Record<string, unknown>[]));
        else item.subtypes = value;
        continue;
      }
      if (stmt.key === 'statuses') {
        seenStatuses = true;
        if (Array.isArray(value)) statuses.push(...(value as Record<string, unknown>[]));
        else item.statuses = value;
        continue;
      }
      if (stmt.key === 'requiredRelationships') {
        seenRequired = true;
        if (Array.isArray(value)) requiredRelationships.push(...(value as Record<string, unknown>[]));
        else item.requiredRelationships = value;
        continue;
      }
      if (stmt.key === 'semanticPlane' || stmt.key === 'semantic_plane') {
        item.semanticPlane = value;
        continue;
      }
      setObjectValue(item, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'subtypes') {
        seenSubtypes = true;
        subtypes.push(...buildSubtypesFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'statuses') {
        seenStatuses = true;
        statuses.push(...buildStatusesFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'required_relationships' || stmt.name === 'requiredRelationships') {
        seenRequired = true;
        requiredRelationships.push(...buildRequiredRelationshipsFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'semantic_plane' || stmt.name === 'semanticPlane') {
        item.semanticPlane = buildSemanticPlaneFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'style') {
        item.style = buildObjectFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (stmt.labels.length > 0) {
        const existingId = child.id;
        if (existingId === undefined) {
          child.id = stmt.labels[0];
        } else if (typeof existingId !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block id must be a string',
            span: stmt.span
          });
        } else if (existingId !== stmt.labels[0]) {
          diagnostics.push({
            severity: 'error',
            message: `block id mismatch: label "${stmt.labels[0]}" vs id "${existingId}"`,
            span: stmt.span
          });
        }
      }
      if (stmt.labels.length > 1) {
        const existingName = child.name;
        if (existingName === undefined) {
          child.name = stmt.labels[1];
        } else if (typeof existingName !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block name must be a string',
            span: stmt.span
          });
        } else if (existingName !== stmt.labels[1]) {
          diagnostics.push({
            severity: 'error',
            message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
            span: stmt.span
          });
        }
      }
      setObjectValue(item, stmt.name, child);
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(item, 'kind', block.labels[0], diagnostics, block)) return null;
  }
  if (seenSubtypes) {
    item.subtypes = subtypes;
  }
  if (seenStatuses) {
    item.statuses = statuses;
  }
  if (seenRequired) {
    item.requiredRelationships = requiredRelationships;
  }

  return item;
}

export function buildSubtypesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const subtypes: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      const subtype = buildSubtypeFromValue(stmt.key, value, diagnostics, parent);
      if (subtype) subtypes.push(subtype);
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'subtype') {
      const subtype = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (!applyLabelField(subtype, 'id', stmt.labels[0], diagnostics, stmt)) continue;
      if (stmt.labels[1]) {
        if (!applyLabelField(subtype, 'name', stmt.labels[1], diagnostics, stmt)) continue;
      }
      normalizeSubtypeFields(subtype);
      if (!ensureNameField(subtype, diagnostics, stmt)) continue;
      subtypes.push(subtype);
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'subtypes block only supports subtype entries',
      span: stmt.span
    });
  }

  return subtypes;
}

export function buildSubtypeFromPositional(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(stmt.value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'subtype requires id and name',
      span: stmt.span
    });
    return null;
  }
  const rawArr = raw as unknown[];
  const id: unknown = rawArr[0];
  const name: unknown = rawArr[1];
  const rest: unknown[] = rawArr.slice(2);
  if (typeof id !== 'string' || typeof name !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'subtype id and name must be strings',
      span: stmt.span
    });
    return null;
  }
  const subtype: Record<string, unknown> = { id, name };
  for (const entry of rest) {
    if (entry === 'authority') {
      subtype.isAuthority = true;
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unknown subtype flag "${String(entry)}"`,
      span: stmt.span
    });
    return null;
  }
  return subtype;
}

export function buildSubtypeFromValue(
  id: string,
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  if (typeof value === 'string') {
    return { id, name: value };
  }
  if (isRecord(value)) {
    const subtype: Record<string, unknown> = { id, ...value };
    normalizeSubtypeFields(subtype);
    if (!ensureNameField(subtype, diagnostics, parent)) return null;
    return subtype;
  }
  diagnostics.push({
    severity: 'error',
    message: 'subtype entries must be a string or object',
    span: parent.span
  });
  return null;
}

export function normalizeSubtypeFields(subtype: Record<string, unknown>): void {
  if (subtype.authority !== undefined && subtype.isAuthority === undefined) {
    subtype.isAuthority = subtype.authority;
    delete subtype.authority;
  }
}

export function buildStatusesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const statuses: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      const status = buildStatusFromValue(stmt.key, value, diagnostics, parent);
      if (status) statuses.push(status);
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'status') {
      const status = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (!applyLabelField(status, 'id', stmt.labels[0], diagnostics, stmt)) continue;
      if (stmt.labels[1]) {
        if (!applyLabelField(status, 'name', stmt.labels[1], diagnostics, stmt)) continue;
      }
      normalizeStatusFields(status);
      if (!ensureNameField(status, diagnostics, stmt)) continue;
      if (status.isTerminal === undefined) {
        status.isTerminal = false;
      }
      statuses.push(status);
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'statuses block only supports status entries',
      span: stmt.span
    });
  }

  return statuses;
}

export function buildStatusFromPositional(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(stmt.value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length < 3) {
    diagnostics.push({
      severity: 'error',
      message: 'status requires id, name, and polarity',
      span: stmt.span
    });
    return null;
  }
  const rawArr2 = raw as unknown[];
  const id: unknown = rawArr2[0];
  const name: unknown = rawArr2[1];
  const polarity: unknown = rawArr2[2];
  const rest: unknown[] = rawArr2.slice(3);
  if (typeof id !== 'string' || typeof name !== 'string' || typeof polarity !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'status id, name, and polarity must be strings',
      span: stmt.span
    });
    return null;
  }
  const status: Record<string, unknown> = {
    id,
    name,
    polarity,
    isTerminal: false
  };
  let index = 0;
  if (index < rest.length && typeof rest[index] === 'string' && rest[index] !== 'terminal') {
    status.transitionVerb = rest[index];
    index += 1;
  }
  for (const entry of rest.slice(index)) {
    if (entry === 'terminal') {
      status.isTerminal = true;
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unknown status flag "${String(entry)}"`,
      span: stmt.span
    });
    return null;
  }
  return status;
}

export function buildStyleFromValue(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(value, diagnostics, parent);
  if (raw === null || raw === undefined) return null;
  if (isRecord(raw)) {
    return { ...raw };
  }
  if (typeof raw === 'string') {
    return { color: raw };
  }
  if (Array.isArray(raw)) {
    if (raw.length === 1 && typeof raw[0] === 'string') {
      return { color: raw[0] };
    }
    const style: Record<string, unknown> = {};
    for (let i = 0; i < raw.length; i += 2) {
      const key: unknown = (raw as unknown[])[i];
      const val: unknown = (raw as unknown[])[i + 1];
      if (typeof key !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'style keys must be strings',
          span: parent.span
        });
        return null;
      }
      if (val === undefined) {
        diagnostics.push({
          severity: 'error',
          message: `style value missing for "${key}"`,
          span: parent.span
        });
        return null;
      }
      if (key === 'name' || key === 'display') {
        style.displayName = val;
      } else {
        style[key] = val;
      }
    }
    return style;
  }
  diagnostics.push({
    severity: 'error',
    message: 'style must be a string, list, or object',
    span: parent.span
  });
  return null;
}

export function buildSemanticPlaneFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const plane: Record<string, unknown> = {};
  const axes: Record<string, unknown> = {};
  const regions: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'axes') {
        if (isObjectValue(stmt.value)) {
          for (const entry of stmt.value.entries) {
            if (entry.key !== 'x' && entry.key !== 'y' && entry.key !== 'z') {
              diagnostics.push({
                severity: 'error',
                message: 'axes object must use x, y, z keys',
                span: entry.span
              });
              continue;
            }
            const axisId = parseResourceReferenceValue(entry.value, diagnostics, parent, 'axis', {
              allowedTypes: ['axis']
            });
            if (!axisId || Array.isArray(axisId)) continue;
            axes[entry.key] = { axisId };
          }
          continue;
        }
        if (isArrayValue(stmt.value)) {
          const parsed = parseAxesList(stmt.value.items, diagnostics, parent);
          if (parsed) Object.assign(axes, parsed);
          continue;
        }
      }
      if (stmt.key === 'regions') {
        const value = valueToJson(stmt.value, diagnostics, parent);
        if (Array.isArray(value)) {
          regions.push(...(value as Record<string, unknown>[]));
          continue;
        }
      }
      if (stmt.key === 'x' || stmt.key === 'y' || stmt.key === 'z') {
        const axisId = parseResourceReferenceValue(stmt.value, diagnostics, parent, 'axis', {
          allowedTypes: ['axis']
        });
        if (axisId && !Array.isArray(axisId)) {
          axes[stmt.key] = { axisId };
        }
        continue;
      }
      if (stmt.key === 'axis' && stmt.labels && stmt.labels.length >= 2) {
        const [axisKey, axisId] = stmt.labels;
        if (axisKey === 'x' || axisKey === 'y' || axisKey === 'z') {
          const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
          if (resolved) {
            axes[axisKey] = { axisId: resolved };
          }
          continue;
        }
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported semantic_plane attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'axes') {
        Object.assign(axes, buildAxesFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'regions') {
        regions.push(...buildRegionsFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'region') {
        const region = buildRegionFromBlock(stmt, diagnostics);
        if (region) regions.push(region);
        continue;
      }
      if (stmt.name === 'axis') {
        const axisKey = stmt.labels[0];
        const axisId = stmt.labels[1];
        if ((axisKey === 'x' || axisKey === 'y' || axisKey === 'z') && axisId) {
          const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
          if (resolved) {
            axes[axisKey] = { axisId: resolved };
          }
          continue;
        }
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported semantic_plane block "${stmt.name}"`,
        span: stmt.span
      });
    }
  }

  normalizeAxisRefs(axes);
  plane.axes = axes;
  plane.regions = regions;
  return plane;
}

export function parseAxesList(
  value: Value[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const axes: Record<string, unknown> = {};
  const items = value.map((item) => coerceStringValue(item));
  if (items.some((item) => item === null)) {
    diagnostics.push({
      severity: 'error',
      message: 'axes must use identifiers',
      span: parent.span
    });
    return null;
  }
  const tokens = items as string[];

  if (tokens.length >= 6 && tokens.length % 2 === 0) {
    for (let i = 0; i < tokens.length; i += 2) {
      const axisKey = tokens[i];
      const axisId = tokens[i + 1];
      if (axisKey !== 'x' && axisKey !== 'y' && axisKey !== 'z') {
        diagnostics.push({
          severity: 'error',
          message: 'axes list must use x, y, z keys',
          span: parent.span
        });
        return null;
      }
      if (!axisId) {
        diagnostics.push({
          severity: 'error',
          message: 'axes ids must use "<name>.id"',
          span: parent.span
        });
        return null;
      }
      const resolved = parseResourceReferenceString(axisId, diagnostics, parent.span, 'axis', ['axis']);
      if (!resolved) return null;
      axes[axisKey] = resolved;
    }
    return axes;
  }

  if (tokens.length >= 2) {
    const [x, y, z] = tokens;
    if (!x || !y) {
      diagnostics.push({
        severity: 'error',
        message: 'axes ids must use "<name>.id"',
        span: parent.span
      });
      return null;
    }
    const resolvedX = parseResourceReferenceString(x, diagnostics, parent.span, 'axis', ['axis']);
    const resolvedY = parseResourceReferenceString(y, diagnostics, parent.span, 'axis', ['axis']);
    if (!resolvedX || !resolvedY) return null;
    axes.x = resolvedX;
    axes.y = resolvedY;
    if (tokens.length >= 3) {
      const resolvedZ = parseResourceReferenceString(z, diagnostics, parent.span, 'axis', ['axis']);
      if (!resolvedZ) return null;
      axes.z = resolvedZ;
    }
    return axes;
  }

  diagnostics.push({
    severity: 'error',
    message: 'axes requires at least x and y',
    span: parent.span
  });
  return null;
}

export function buildAxesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const axes: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'axis' && stmt.labels && stmt.labels.length >= 2) {
        const [axisKey, axisId] = stmt.labels;
        if (axisKey === 'x' || axisKey === 'y' || axisKey === 'z') {
          const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
          if (resolved) {
            axes[axisKey] = { axisId: resolved };
          }
          continue;
        }
      }
      if (stmt.key === 'x' || stmt.key === 'y' || stmt.key === 'z') {
        const axisId = parseResourceReferenceValue(stmt.value, diagnostics, parent, 'axis', {
          allowedTypes: ['axis']
        });
        if (axisId && !Array.isArray(axisId)) {
          axes[stmt.key] = { axisId };
        }
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported axes attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'axis') {
      const axisKey = stmt.labels[0];
      const axisId = stmt.labels[1];
      if ((axisKey === 'x' || axisKey === 'y' || axisKey === 'z') && axisId) {
        const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
        if (resolved) {
          axes[axisKey] = { axisId: resolved };
        }
        continue;
      }
    }
    diagnostics.push({
      severity: 'error',
      message: 'axes block only supports axis entries',
      span: stmt.span
    });
  }

  return axes;
}

export function buildEraItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item: Record<string, unknown> = {};
  const ctx = createSystemContext(diagnostics, block);
  const templateWeights: Record<string, number> = {};
  const systemModifiers: Record<string, number> = {};
  const entryConditions: Record<string, unknown>[] = [];
  const exitConditions: Record<string, unknown>[] = [];
  const entryEffects: Record<string, unknown>[] = [];
  const exitEffects: Record<string, unknown>[] = [];
  let sawTemplateWeights = false;
  let sawSystemModifiers = false;
  let sawEntryConditions = false;
  let sawExitConditions = false;
  let sawEntryEffects = false;
  let sawExitEffects = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.labels && stmt.labels.length > 0) {
        diagnostics.push({
          severity: 'error',
          message: 'era attributes do not support labels',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'template_weight') {
        const raw = valueToJson(stmt.value, diagnostics, block);
        const tokens = Array.isArray(raw) ? raw : [raw];
        if (tokens.length !== 2) {
          diagnostics.push({
            severity: 'error',
            message: 'template_weight requires: template_weight <template> <weight>',
            span: stmt.span
          });
          continue;
        }
        const templateId: unknown = (tokens as unknown[])[0];
        const weight: unknown = (tokens as unknown[])[1];
        if (typeof templateId !== 'string' || typeof weight !== 'number') {
          diagnostics.push({
            severity: 'error',
            message: 'template_weight requires a template id and numeric weight',
            span: stmt.span
          });
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(templateWeights, templateId)) {
          diagnostics.push({
            severity: 'error',
            message: `Duplicate template_weight "${templateId}"`,
            span: stmt.span
          });
          continue;
        }
        sawTemplateWeights = true;
        templateWeights[templateId] = weight;
        continue;
      }
      if (stmt.key === 'system_modifier') {
        const raw = valueToJson(stmt.value, diagnostics, block);
        const tokens = Array.isArray(raw) ? raw : [raw];
        if (tokens.length !== 2) {
          diagnostics.push({
            severity: 'error',
            message: 'system_modifier requires: system_modifier <system> <multiplier>',
            span: stmt.span
          });
          continue;
        }
        const systemId: unknown = (tokens as unknown[])[0];
        const multiplier: unknown = (tokens as unknown[])[1];
        if (typeof systemId !== 'string' || typeof multiplier !== 'number') {
          diagnostics.push({
            severity: 'error',
            message: 'system_modifier requires a system id and numeric multiplier',
            span: stmt.span
          });
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(systemModifiers, systemId)) {
          diagnostics.push({
            severity: 'error',
            message: `Duplicate system_modifier "${systemId}"`,
            span: stmt.span
          });
          continue;
        }
        sawSystemModifiers = true;
        systemModifiers[systemId] = multiplier;
        continue;
      }
      if (stmt.key === 'entry_condition' || stmt.key === 'exit_condition') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens) continue;
        if (tokens.length === 1 && tokens[0] === 'none') {
          if (stmt.key === 'entry_condition') {
            sawEntryConditions = true;
            entryConditions.length = 0;
          } else {
            sawExitConditions = true;
            exitConditions.length = 0;
          }
          continue;
        }
        if (tokens.includes('none')) {
          diagnostics.push({
            severity: 'error',
            message: 'none cannot be combined with other entry/exit conditions',
            span: stmt.span
          });
          continue;
        }
        const condition = parseSystemConditionTokens(tokens, ctx, stmt.span);
        if (condition) {
          normalizeRefsInObject(condition, ctx);
          if (stmt.key === 'entry_condition') {
            sawEntryConditions = true;
            entryConditions.push(condition);
          } else {
            sawExitConditions = true;
            exitConditions.push(condition);
          }
        }
        continue;
      }
      if (stmt.key === 'entry_effect' || stmt.key === 'exit_effect') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens) continue;
        const mutation = parseEraEffectTokens(tokens, diagnostics, stmt.span);
        if (mutation) {
          if (stmt.key === 'entry_effect') {
            sawEntryEffects = true;
            entryEffects.push(mutation);
          } else {
            sawExitEffects = true;
            exitEffects.push(mutation);
          }
        }
        continue;
      }
      if (applySetFieldAttribute(stmt, item, diagnostics, block)) {
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      setObjectValue(item, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (SET_FIELD_KEYS.has(stmt.name)) {
        applySetFieldBlock(stmt, item, diagnostics);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (stmt.labels.length > 0) {
        const existingId = child.id;
        if (existingId === undefined) {
          child.id = stmt.labels[0];
        } else if (typeof existingId !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block id must be a string',
            span: stmt.span
          });
        } else if (existingId !== stmt.labels[0]) {
          diagnostics.push({
            severity: 'error',
            message: `block id mismatch: label "${stmt.labels[0]}" vs id "${existingId}"`,
            span: stmt.span
          });
        }
      }
      if (stmt.labels.length > 1) {
        const existingName = child.name;
        if (existingName === undefined) {
          child.name = stmt.labels[1];
        } else if (typeof existingName !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block name must be a string',
            span: stmt.span
          });
        } else if (existingName !== stmt.labels[1]) {
          diagnostics.push({
            severity: 'error',
            message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
            span: stmt.span
          });
        }
      }
      setObjectValue(item, stmt.name, child);
      continue;
    }

    if (stmt.type === 'predicate' && (stmt.keyword === 'entry_condition' || stmt.keyword === 'exit_condition')) {
      if (!stmt.field) {
        diagnostics.push({
          severity: 'error',
          message: `${stmt.keyword} requires a condition type`,
          span: stmt.span
        });
        continue;
      }
      const predicate = {
        type: 'predicate',
        keyword: stmt.field,
        subject: stmt.subject,
        operator: stmt.operator,
        value: stmt.value,
        span: stmt.span
      } as Extract<StatementNode, { type: 'predicate' }>;
      const condition = conditionFromPredicate(predicate, ctx);
      if (condition) {
        normalizeRefsInObject(condition, ctx);
        if (stmt.keyword === 'entry_condition') {
          sawEntryConditions = true;
          entryConditions.push(condition);
        } else {
          sawExitConditions = true;
          exitConditions.push(condition);
        }
      }
      continue;
    }

    if (stmt.type === 'bare') {
      diagnostics.push({
        severity: 'error',
        message: 'bare statements are not valid in era blocks',
        span: stmt.span
      });
    }
  }

  if (sawTemplateWeights) {
    item.templateWeights = templateWeights;
  }
  if (sawSystemModifiers) {
    item.systemModifiers = systemModifiers;
  }
  if (sawEntryConditions) {
    item.entryConditions = entryConditions;
  }
  if (sawExitConditions) {
    item.exitConditions = exitConditions;
  }
  if (sawEntryEffects) {
    item.entryEffects = { mutations: entryEffects };
  }
  if (sawExitEffects) {
    item.exitEffects = { mutations: exitEffects };
  }

  const idLabel = block.labels[0];
  const nameLabel = block.labels[1];
  if (idLabel && !applyLabelField(item, 'id', idLabel, diagnostics, block)) return null;
  if (nameLabel && !applyLabelField(item, 'name', nameLabel, diagnostics, block)) return null;

  return item;
}

export function buildRegionFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const region: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'bounds' && isArrayValue(stmt.value)) {
        const bounds = buildBoundsFromLine(stmt.value, diagnostics, block);
        if (bounds) {
          region.bounds = bounds;
          continue;
        }
      }
      if (stmt.key === 'tags') {
        const raw = valueToJson(stmt.value, diagnostics, block);
        const tokens = Array.isArray(raw) ? raw : [raw];
        const parsed = parseSetTokens(tokens, diagnostics, stmt.span);
        if (!parsed) return null;
        region.tags = parsed.none ? [] : parsed.items;
        continue;
      }
      let value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'zRange' && Array.isArray(value) && value.length >= 2) {
        const arr = value as unknown[];
        value = { min: arr[0], max: arr[1] };
      }
      setObjectValue(region, stmt.key, value);
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'bounds') {
      region.bounds = buildBoundsFromBlock(stmt, diagnostics);
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unsupported region statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (!applyLabelField(region, 'id', block.labels[0], diagnostics, block)) return null;
  if (block.labels[1]) {
    if (!applyLabelField(region, 'label', block.labels[1], diagnostics, block)) return null;
  }

  return region;
}

export function buildBoundsFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const shape = block.labels[0];
  const raw = buildObjectFromStatements(block.body, diagnostics, block);

  if (!shape) {
    diagnostics.push({
      severity: 'error',
      message: 'bounds requires a shape label',
      span: block.span
    });
    return null;
  }

  if (shape === 'circle') {
    const center = normalizePoint(raw.center, diagnostics, block);
    const radius = raw.radius;
    if (!center || typeof radius !== 'number') {
      diagnostics.push({
        severity: 'error',
        message: 'circle bounds require center and radius',
        span: block.span
      });
      return null;
    }
    return { shape, center, radius };
  }

  if (shape === 'rect') {
    const { x1, y1, x2, y2 } = raw;
    if (![x1, y1, x2, y2].every((value) => typeof value === 'number')) {
      diagnostics.push({
        severity: 'error',
        message: 'rect bounds require x1, y1, x2, y2',
        span: block.span
      });
      return null;
    }
    return { shape, x1, y1, x2, y2 };
  }

  if (shape === 'polygon') {
    const points: { x: number; y: number }[] = [];
    const rawPoints = raw.points;
    if (Array.isArray(rawPoints)) {
      for (const entry of rawPoints) {
        const point = normalizePoint(entry, diagnostics, block);
        if (point) points.push(point);
      }
    }
    const rawPoint = raw.point;
    if (Array.isArray(rawPoint)) {
      if (rawPoint.length >= 2 && typeof rawPoint[0] === 'number') {
        const point = normalizePoint(rawPoint, diagnostics, block);
        if (point) points.push(point);
      } else {
        for (const entry of rawPoint) {
          const point = normalizePoint(entry, diagnostics, block);
          if (point) points.push(point);
        }
      }
    } else if (rawPoint) {
      const point = normalizePoint(rawPoint, diagnostics, block);
      if (point) points.push(point);
    }
    if (points.length === 0) {
      diagnostics.push({
        severity: 'error',
        message: 'polygon bounds require points',
        span: block.span
      });
      return null;
    }
    return { shape, points };
  }

  diagnostics.push({
    severity: 'error',
    message: `Unsupported bounds shape "${shape}"`,
    span: block.span
  });
  return null;
}

export function buildBoundsFromLine(
  value: ArrayValue,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'bounds requires a shape and coordinates',
      span: parent.span
    });
    return null;
  }

  const rawArr3 = raw as unknown[];
  const shape: unknown = rawArr3[0];
  const rest: unknown[] = rawArr3.slice(1);
  if (typeof shape !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'bounds shape must be a string',
      span: parent.span
    });
    return null;
  }

  if (shape === 'circle') {
    const x: unknown = rest[0];
    const y: unknown = rest[1];
    const radius: unknown = rest[2];
    if (typeof x === 'number' && typeof y === 'number' && typeof radius === 'number') {
      return { shape, center: { x, y }, radius };
    }
    diagnostics.push({
      severity: 'error',
      message: 'circle bounds require x y radius',
      span: parent.span
    });
    return null;
  }

  if (shape === 'rect') {
    const x1: unknown = rest[0];
    const y1: unknown = rest[1];
    const x2: unknown = rest[2];
    const y2: unknown = rest[3];
    if (typeof x1 === 'number' && typeof y1 === 'number' && typeof x2 === 'number' && typeof y2 === 'number') {
      return { shape, x1, y1, x2, y2 };
    }
    diagnostics.push({
      severity: 'error',
      message: 'rect bounds require x1 y1 x2 y2',
      span: parent.span
    });
    return null;
  }

  if (shape === 'polygon') {
    if (rest.length % 2 !== 0 || rest.length === 0) {
      diagnostics.push({
        severity: 'error',
        message: 'polygon bounds require paired coordinates',
        span: parent.span
      });
      return null;
    }
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < rest.length; i += 2) {
      const x: unknown = rest[i];
      const y: unknown = rest[i + 1];
      if (typeof x !== 'number' || typeof y !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'polygon bounds require numeric coordinates',
          span: parent.span
        });
        return null;
      }
      points.push({ x, y });
    }
    return { shape, points };
  }

  diagnostics.push({
    severity: 'error',
    message: `Unsupported bounds shape "${shape}"`,
    span: parent.span
  });
  return null;
}

export function buildStaticPageFromBlock(
  block: BlockNode,
  contentByPath: Map<string, string>,
  diagnostics: Diagnostic[]
): Record<string, unknown> | null {
  const titleLabel = block.labels[0];
  if (!titleLabel) {
    diagnostics.push({
      severity: 'error',
      message: 'static_page requires a title label',
      span: block.span
    });
    return null;
  }

  const page: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type === 'block') {
      if (SET_FIELD_KEYS.has(stmt.name)) {
        applySetFieldBlock(stmt, page, diagnostics);
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: 'static_page only supports attributes and set blocks',
        span: stmt.span
      });
      continue;
    }
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'static_page only supports attributes and set blocks',
        span: stmt.span
      });
      continue;
    }

    if (stmt.key === 'content') {
      const content = resolveStaticPageContent(stmt.value, contentByPath, diagnostics, block);
      if (content !== null) page.content = content;
      continue;
    }

    if (SET_FIELD_KEYS.has(stmt.key)) {
      applySetFieldAttribute(stmt, page, diagnostics, block);
      continue;
    }

    const value = valueToJson(stmt.value, diagnostics, block);
    if (stmt.key === 'seed_id') {
      page.seedId = value;
      continue;
    }
    setObjectValue(page, stmt.key, value);
  }

  if (page.title !== undefined && page.title !== titleLabel) {
    diagnostics.push({
      severity: 'error',
      message: `static_page title mismatch: label "${titleLabel}" vs title "${String(page.title)}"`,
      span: block.span
    });
    return null;
  }

  page.title = titleLabel;
  if (typeof page.slug !== 'string' || page.slug.length === 0) {
    page.slug = generateStaticPageSlug(titleLabel);
  }

  return page;
}

export function resolveStaticPageContent(
  value: Value,
  contentByPath: Map<string, string>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): string | null {
  if (isCallValue(value)) {
    if (value.name !== 'read') {
      diagnostics.push({
        severity: 'error',
        message: `Unsupported call "${value.name}" in static_page content`,
        span: parent.span
      });
      return null;
    }
    const arg = value.args[0];
    const path = coerceStringValue(arg);
    if (!path) {
      diagnostics.push({
        severity: 'error',
        message: 'read() requires a string path',
        span: parent.span
      });
      return null;
    }
    const direct = contentByPath.get(path);
    if (direct !== undefined) return direct;
    for (const [key, content] of contentByPath.entries()) {
      if (key.endsWith(path)) return content;
    }
    diagnostics.push({
      severity: 'error',
      message: `Missing static page content file "${path}"`,
      span: parent.span
    });
    return null;
  }

  if (typeof value === 'string') return value;
  if (isIdentifierValue(value)) return value.value;

  diagnostics.push({
    severity: 'error',
    message: 'content must be a string or read("file.md")',
    span: parent.span
  });
  return null;
}

export function buildAxisItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;

  if (block.labels[0]) {
    if (!applyLabelField(item, 'id', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (!applyLabelField(item, 'name', block.labels[1], diagnostics, block)) return null;
  }

  if (item.low !== undefined && item.lowTag === undefined) {
    item.lowTag = item.low;
    delete item.low;
  }
  if (item.high !== undefined && item.highTag === undefined) {
    item.highTag = item.high;
    delete item.high;
  }
  if (item.description === undefined) {
    item.description = '';
  }

  return item;
}

export function buildDistributionTargetsItem(
  block: BlockNode,
  diagnostics: Diagnostic[]
): Record<string, unknown> | null {
  const item = buildObjectFromStatements(block.body, diagnostics, block);

  const perEraRaw = item.per_era;
  if (perEraRaw !== undefined) {
    const entries = Array.isArray(perEraRaw) ? perEraRaw : [perEraRaw];
    const perEra: Record<string, unknown> = {};
    for (const entry of entries) {
      if (!isRecord(entry)) {
        diagnostics.push({
          severity: 'error',
          message: 'per_era entries must be blocks',
          span: block.span
        });
        continue;
      }
      const id = entry.id;
      if (typeof id !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'per_era blocks require an era label',
          span: block.span
        });
        continue;
      }
      if (perEra[id]) {
        diagnostics.push({
          severity: 'error',
          message: `duplicate per_era entry: ${id}`,
          span: block.span
        });
        continue;
      }
      const { id: _id, ...rest } = entry; // eslint-disable-line sonarjs/no-unused-vars
      perEra[id] = rest;
    }
    item.perEra = perEra;
    delete item.per_era;
  }

  return item;
}

export function validateSeedRelationships(config: Record<string, unknown>, diagnostics: Diagnostic[]): void {
  const entities = config.seedEntities;
  const relationships = config.seedRelationships;
  if (!Array.isArray(entities) || !Array.isArray(relationships)) return;

  const ids = new Set<string>();
  for (const entity of entities) {
    if (isRecord(entity) && typeof entity.id === 'string') {
      ids.add(entity.id);
    }
  }

  for (const rel of relationships) {
    if (!isRecord(rel)) continue;
    const src = rel.src;
    const dst = rel.dst;
    if (typeof src === 'string' && !ids.has(src)) {
      diagnostics.push({
        severity: 'error',
        message: `seed_relationship src "${src}" does not match any seed_entity id`,
        span: undefined
      });
    }
    if (typeof dst === 'string' && !ids.has(dst)) {
      diagnostics.push({
        severity: 'error',
        message: `seed_relationship dst "${dst}" does not match any seed_entity id`,
        span: undefined
      });
    }
  }
}


export function buildRegionsFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const regions: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'block' && stmt.name === 'region') {
      const region = buildRegionFromBlock(stmt, diagnostics);
      if (region) regions.push(region);
      continue;
    }
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      if (isRecord(value)) {
        const region: Record<string, unknown> = { id: stmt.key, ...value };
        regions.push(region);
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: 'region entries must be objects',
        span: stmt.span
      });
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'regions block only supports region entries',
      span: stmt.span
    });
  }

  return regions;
}

export function buildRequiredRelationshipFromPositional(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(stmt.value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'required requires a relationship kind',
      span: stmt.span
    });
    return null;
  }
  const kind: unknown = (raw as unknown[])[0];
  const description: unknown = (raw as unknown[])[1];
  if (typeof kind !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'required relationship kind must be a string',
      span: stmt.span
    });
    return null;
  }
  const rule: Record<string, unknown> = { kind };
  if (description !== undefined) {
    if (typeof description !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'required relationship description must be a string',
        span: stmt.span
      });
      return null;
    }
    rule.description = description;
  }
  return rule;
}

export function buildRequiredRelationshipsFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const rules: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      if (typeof value === 'string') {
        rules.push({ kind: stmt.key, description: value });
        continue;
      }
      if (value === null || value === undefined) {
        rules.push({ kind: stmt.key });
        continue;
      }
      if (isRecord(value)) {
        rules.push({ kind: stmt.key, ...value });
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: 'required relationship entries must be a string or object',
        span: stmt.span
      });
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'required_relationships block only supports relationship entries',
      span: stmt.span
    });
  }

  return rules;
}

export function buildStatusFromValue(
  id: string,
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  if (typeof value === 'string') {
    return { id, name: value, isTerminal: false };
  }
  if (isRecord(value)) {
    const status: Record<string, unknown> = { id, ...value };
    normalizeStatusFields(status);
    if (status.isTerminal === undefined) {
      status.isTerminal = false;
    }
    if (!ensureNameField(status, diagnostics, parent)) return null;
    return status;
  }
  diagnostics.push({
    severity: 'error',
    message: 'status entries must be a string or object',
    span: parent.span
  });
  return null;
}

export function ensureNameField(
  item: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  if (typeof item.name === 'string' && item.name.length > 0) {
    return true;
  }
  diagnostics.push({
    severity: 'error',
    message: 'entry requires a name',
    span: parent.span
  });
  return false;
}

export function normalizeAxisRefs(axes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(axes)) {
    if (typeof value === 'string') {
      axes[key] = { axisId: value };
    }
  }
}

export function normalizePoint(
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode
): { x: number; y: number } | null {

export function normalizeStatusFields(status: Record<string, unknown>): void {
  if (status.terminal !== undefined && status.isTerminal === undefined) {
    status.isTerminal = status.terminal;
    delete status.terminal;
  }
}

export function parseEraEffectTokens(
  tokens: unknown[],
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length !== 3 || typeof tokens[0] !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'effect requires: effect <type> <pressure> <delta>',
      span
    });
    return null;
  }
  const [type, pressureId, delta] = tokens;
  if (type !== 'modify_pressure') {
    diagnostics.push({
      severity: 'error',
      message: `Unsupported effect type "${type}"`,
      span
    });
    return null;
  }
  if (typeof pressureId !== 'string' || typeof delta !== 'number') {
    diagnostics.push({
      severity: 'error',
      message: 'modify_pressure requires a pressure id and numeric delta',
      span
    });
    return null;
  }
  return { type: 'modify_pressure', pressureId, delta };
}
