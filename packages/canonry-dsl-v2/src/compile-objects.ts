import type {
  BlockNode,
  Diagnostic,
  Value,
  ObjectValue,
  ArrayValue,
  StatementNode,
  AttributeNode,
  AstFile,
} from './types.js';

import type { GeneratorContext, BlockMapping } from './compile-types.js';
import { CONTAINER_ALIASES, INLINE_ITEM_KEYS, SET_FIELD_KEYS, DSL_BLOCK_NAMES, ACTION_DSL_BLOCKS, ACTION_DSL_ATTRIBUTES, VARIABLE_REFERENCE_PREFIXES } from './compile-types.js';
import { isArrayValue, isObjectValue, isRecord, coerceStringValue, applyLabelField, setObjectValue, parseInlineKeyValuePairs, pushArrayValue, isIdentifierValue } from './compile-utils.js';
import { valueToJson, activeEvalContext, parseResourceReferenceValue } from './compile-variables.js';
import { applySetFieldAttribute, applySetFieldBlock, parseSetBlockItems } from './compile-sets.js';

export function expandContainers(block: BlockNode, diagnostics: Diagnostic[]): BlockNode[] {
  const alias = CONTAINER_ALIASES[block.name];
  if (!alias) return [block];

  const blocks: BlockNode[] = [];
  for (const stmt of block.body) {
    if (stmt.type === 'block') {
      blocks.push({ ...stmt, name: alias });
    } else if (stmt.type === 'attribute') {
      const inlineBlock = inlineBlockFromAttribute(stmt, diagnostics);
      if (inlineBlock) {
        blocks.push({ ...inlineBlock, name: alias });
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Container block "${block.name}" only accepts nested blocks`,
        span: stmt.span
      });
    } else {
      diagnostics.push({
        severity: 'error',
        message: `Container block "${block.name}" only accepts nested blocks`,
        span: stmt.span
      });
    }
  }

  return blocks;
}

export function inlineBlockFromAttribute(
  stmt: AttributeNode,
  diagnostics: Diagnostic[]
): BlockNode | null {
  if (!INLINE_ITEM_KEYS.has(stmt.key)) return null;
  if (stmt.labels && stmt.labels.length > 0) {
    if (isArrayValue(stmt.value)) {
      const body = positionalInlineStatements(stmt, diagnostics);
      if (!body) return null;
      return {
        type: 'block',
        name: stmt.key,
        labels: stmt.labels,
        body,
        span: stmt.span
      };
    }
    diagnostics.push({
      severity: 'error',
      message: `Inline ${stmt.key} entries must use positional fields`,
      span: stmt.span
    });
    return null;
  }

  if (!isArrayValue(stmt.value)) return null;
  const items = stmt.value.items;
  if (items.length === 0) return null;

  const requiredLabels = stmt.key === 'seed_relationship' ? 3 : 1;
  if (items.length < requiredLabels) {
    diagnostics.push({
      severity: 'error',
      message: `Inline ${stmt.key} entries must include ${requiredLabels} leading identifiers`,
      span: stmt.span
    });
    return null;
  }

  const labels: string[] = [];
  for (let i = 0; i < requiredLabels; i += 1) {
    const label = coerceStringValue(items[i]);
    if (!label) {
      diagnostics.push({
        severity: 'error',
        message: `Inline ${stmt.key} entries must use identifier labels`,
        span: stmt.span
      });
      return null;
    }
    labels.push(label);
  }

  const rest = items.slice(requiredLabels);
  const inlineStmt: AttributeNode = {
    ...stmt,
    labels,
    value: makeArrayValue(rest, stmt.span)
  };

  const body = positionalInlineStatements(inlineStmt, diagnostics);
  if (!body) return null;
  return {
    type: 'block',
    name: stmt.key,
    labels,
    body,
    span: stmt.span
  };
}

export function _objectValueToStatements(value: ObjectValue): StatementNode[] {
  return value.entries.map((entry) => ({
    type: 'attribute',
    key: entry.key,
    value: entry.value,
    labels: [],
    span: entry.span
  }));
}

export function positionalInlineStatements(stmt: AttributeNode, diagnostics: Diagnostic[]): StatementNode[] | null {
  if (!isArrayValue(stmt.value)) return null;
  const items = stmt.value.items;
  if (stmt.key === 'tag') {
    return parseTagInline(items, diagnostics, stmt);
  }
  if (stmt.key === 'relationship_kind') {
    return parseRelationshipKindInline(items, diagnostics, stmt);
  }
  if (stmt.key === 'seed_relationship') {
    return parseSeedRelationshipInline(items, diagnostics, stmt);
  }
  diagnostics.push({
    severity: 'error',
    message: `Inline ${stmt.key} entries must use positional fields`,
    span: stmt.span
  });
  return null;
}

export function makeAttributeStatement(key: string, value: Value, span: AttributeNode['span']): StatementNode {
  return {
    type: 'attribute',
    key,
    value,
    labels: [],
    span
  };
}

export function makeArrayValue(items: Value[], span: AttributeNode['span']): ArrayValue {
  return { type: 'array', items, span };
}

export function makeObjectValue(entries: Array<{ key: string; value: Value }>, span: AttributeNode['span']): ObjectValue {

export function _ensureArrayValue(
  value: Value | undefined,
  diagnostics: Diagnostic[],
  stmt: AttributeNode,
  label: string
): ArrayValue | null {
  if (!value) {
    diagnostics.push({
      severity: 'error',
      message: `${label} requires a list`,
      span: stmt.span
    });
    return null;
  }
  if (isArrayValue(value)) return value;
  const text = coerceStringValue(value);
  if (text !== null) {
    return makeArrayValue([value], stmt.span);
  }
  diagnostics.push({
    severity: 'error',
    message: `${label} must be a list of identifiers or strings`,
    span: stmt.span
  });
  return null;
}

export function consumeInlineSetValues(
  items: Value[],
  startIndex: number,
  keywordSet: Set<string>,
  diagnostics: Diagnostic[],
  stmt: AttributeNode,
  label: string
): { value: Value; nextIndex: number } | null {

export function parseTagInline(
  items: Value[],
  diagnostics: Diagnostic[],
  stmt: AttributeNode
): StatementNode[] | null {
  if (items.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'tag requires category and rarity',
      span: stmt.span
    });
    return null;
  }

  const statements: StatementNode[] = [];
  statements.push(makeAttributeStatement('category', items[0], stmt.span));
  statements.push(makeAttributeStatement('rarity', items[1], stmt.span));

  let index = 2;
  const keywordSet = new Set([
    'kinds',
    'related',
    'conflicts',
    'exclusive',
    'templates',
    'usage',
    'count',
    'axis',
    'framework'
  ]);

  const candidate = items[index];
  if (index < items.length && typeof candidate === 'string' && !keywordSet.has(candidate)) {
    statements.push(makeAttributeStatement('description', candidate, stmt.span));
    index += 1;
  }

  while (index < items.length) {
    const keyword = coerceStringValue(items[index]);
    if (!keyword) {
      diagnostics.push({
        severity: 'error',
        message: 'tag options must be identifiers',
        span: stmt.span
      });
      return null;
    }

    if (keyword === 'axis') {
      statements.push(makeAttributeStatement('isAxis', true, stmt.span));
      index += 1;
      continue;
    }
    if (keyword === 'framework') {
      statements.push(makeAttributeStatement('isFramework', true, stmt.span));
      index += 1;
      continue;
    }

    if (keyword === 'kinds' || keyword === 'related' || keyword === 'conflicts' || keyword === 'exclusive' || keyword === 'templates') {
      const parsed = consumeInlineSetValues(items, index + 1, keywordSet, diagnostics, stmt, keyword);
      if (!parsed) return null;
      const keyMap: Record<string, string> = {
        kinds: 'entityKinds',
        related: 'relatedTags',
        conflicts: 'conflictingTags',
        exclusive: 'mutuallyExclusiveWith',
        templates: 'templates',
      };
      const key = keyMap[keyword];
      statements.push(makeAttributeStatement(key, parsed.value, stmt.span));
      index = parsed.nextIndex;
      continue;
    }

    if (keyword === 'usage') {
      if (index + 1 >= items.length) {
        diagnostics.push({
          severity: 'error',
          message: 'usage requires min and max values',
          span: stmt.span
        });
        return null;
      }
      const minValue = items[index + 1];
      const maxValue = items[index + 2];
      if (index + 2 >= items.length) {
        diagnostics.push({
          severity: 'error',
          message: 'usage requires min and max values',
          span: stmt.span
        });
        return null;
      }
      statements.push(makeAttributeStatement('minUsage', minValue, stmt.span));
      statements.push(makeAttributeStatement('maxUsage', maxValue, stmt.span));
      index += 3;
      continue;
    }

    if (keyword === 'count') {
      const value = items[index + 1];
      if (index + 1 >= items.length) {
        diagnostics.push({
          severity: 'error',
          message: 'count requires a value',
          span: stmt.span
        });
        return null;
      }
      statements.push(makeAttributeStatement('usageCount', value, stmt.span));
      index += 2;
      continue;
    }

    diagnostics.push({
      severity: 'error',
      message: `Unknown tag option "${keyword}"`,
      span: stmt.span
    });
    return null;
  }

  return statements;
}

export function parseRelationshipKindInline(
  items: Value[],
  diagnostics: Diagnostic[],
  stmt: AttributeNode
): StatementNode[] | null {
  const statements: StatementNode[] = [];
  let index = 0;
  const polaritySet = new Set(['positive', 'neutral', 'negative']);
  const keywordSet = new Set([
    'src',
    'dst',
    'verbs',
    'category',
    'name',
    'desc',
    'symmetric',
    'framework'
  ]);

  const firstLabel = coerceStringValue(items[index]);
  if (typeof items[index] === 'string' || (firstLabel && !polaritySet.has(firstLabel))) {
    statements.push(makeAttributeStatement('description', items[index], stmt.span));
    index += 1;
  }

  const polarity = items[index++];
  const decay = items[index++];
  const cullableToken = items[index++];
  const cullableLabel = coerceStringValue(cullableToken);
  if (!cullableLabel || (cullableLabel !== 'cullable' && cullableLabel !== 'fixed')) {
    diagnostics.push({
      severity: 'error',
      message: 'relationship_kind requires cullable or fixed flag',
      span: stmt.span
    });
    return null;
  }
  statements.push(makeAttributeStatement('polarity', polarity, stmt.span));
  statements.push(makeAttributeStatement('decayRate', decay, stmt.span));
  statements.push(makeAttributeStatement('cullable', cullableLabel === 'cullable', stmt.span));

  const srcKeyword = coerceStringValue(items[index]);
  if (srcKeyword !== 'src') {
    diagnostics.push({
      severity: 'error',
      message: 'relationship_kind requires src list',
      span: stmt.span
    });
    return null;
  }
  const srcParsed = consumeInlineSetValues(items, index + 1, keywordSet, diagnostics, stmt, 'src');
  if (!srcParsed) return null;
  statements.push(makeAttributeStatement('srcKinds', srcParsed.value, stmt.span));
  index = srcParsed.nextIndex;

  const dstKeyword = coerceStringValue(items[index]);
  if (dstKeyword !== 'dst') {
    diagnostics.push({
      severity: 'error',
      message: 'relationship_kind requires dst list',
      span: stmt.span
    });
    return null;
  }
  const dstParsed = consumeInlineSetValues(items, index + 1, keywordSet, diagnostics, stmt, 'dst');
  if (!dstParsed) return null;
  statements.push(makeAttributeStatement('dstKinds', dstParsed.value, stmt.span));
  index = dstParsed.nextIndex;

  while (index < items.length) {
    const keyword = coerceStringValue(items[index]);
    if (!keyword) {
      diagnostics.push({
        severity: 'error',
        message: 'relationship_kind options must be identifiers',
        span: stmt.span
      });
      return null;
    }
    if (keyword === 'verbs') {
      const formed = items[index + 1];
      const ended = items[index + 2];
      if (index + 2 >= items.length) {
        diagnostics.push({
          severity: 'error',
          message: 'verbs requires formed and ended values',
          span: stmt.span
        });
        return null;
      }
      const verbs = makeObjectValue(
        [
          { key: 'formed', value: formed },
          { key: 'ended', value: ended }
        ],
        stmt.span
      );
      statements.push(makeAttributeStatement('verbs', verbs, stmt.span));
      index += 3;
      continue;
    }
    if (keyword === 'category') {
      if (index + 1 >= items.length) {
        diagnostics.push({
          severity: 'error',
          message: 'category requires a value',
          span: stmt.span
        });
        return null;
      }
      const value = items[index + 1];
      statements.push(makeAttributeStatement('category', value, stmt.span));
      index += 2;
      continue;
    }
    if (keyword === 'name') {
      if (index + 1 >= items.length) {
        diagnostics.push({
          severity: 'error',
          message: 'name requires a value',
          span: stmt.span
        });
        return null;
      }
      const value = items[index + 1];
      statements.push(makeAttributeStatement('name', value, stmt.span));
      index += 2;
      continue;
    }
    if (keyword === 'desc') {
      if (index + 1 >= items.length) {
        diagnostics.push({
          severity: 'error',
          message: 'desc requires a value',
          span: stmt.span
        });
        return null;
      }
      const descValue = items[index + 1];
      statements.push(makeAttributeStatement('description', descValue, stmt.span));
      index += 2;
      continue;
    }
    if (keyword === 'symmetric') {
      statements.push(makeAttributeStatement('symmetric', true, stmt.span));
      index += 1;
      continue;
    }
    if (keyword === 'framework') {
      statements.push(makeAttributeStatement('isFramework', true, stmt.span));
      index += 1;
      continue;
    }

    diagnostics.push({
      severity: 'error',
      message: `Unknown relationship_kind option "${keyword}"`,
      span: stmt.span
    });
    return null;
  }

  return statements;
}

export function parseSeedRelationshipInline(
  items: Value[],
  diagnostics: Diagnostic[],
  stmt: AttributeNode
): StatementNode[] | null {
  if (items.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship requires a strength value',
      span: stmt.span
    });
    return null;
  }

  let index = 0;
  let strength: Value | undefined;
  const keyword = coerceStringValue(items[index]);
  if (keyword === 'strength') {
    if (index + 1 >= items.length) {
      strength = undefined;
    } else {
      strength = items[index + 1];
    }
    index += 2;
  } else {
    strength = items[index];
    index += 1;
  }

  if (strength == null) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship requires a strength value',
      span: stmt.span
    });
    return null;
  }

  if (index < items.length) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship only supports a strength value',
      span: stmt.span
    });
    return null;
  }

  return [makeAttributeStatement('strength', strength, stmt.span)];
}

export function buildObjectFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (stmt.labels && stmt.labels.length > 0) {
        if (applyLabeledAttribute(stmt, obj, diagnostics, parent)) {
          continue;
        }
      }
      if (applySetFieldAttribute(stmt, obj, diagnostics, parent)) {
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, parent);
      setObjectValue(obj, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (applySpecialBlock(stmt, obj, diagnostics)) {
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

      setObjectValue(obj, stmt.name, child);
    }

    if (stmt.type === 'bare') {
      diagnostics.push({
        severity: 'error',
        message: 'bare statements are only valid inside set blocks',
        span: stmt.span
      });
    }
  }

  return obj;
}

export function applyLabeledAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,

export function applySpecialBlock(
  stmt: BlockNode,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[]
): boolean {
  const key = stmt.name;
  if (SET_FIELD_KEYS.has(key)) {
    applySetFieldBlock(stmt, obj, diagnostics);
    return true;
  }
  if (key === 'create') {
    addCreationEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
    return true;
  }
  if (key === 'relationship' || key === 'rel') {
    addRelationshipEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
    return true;
  }
  if (key === 'var' || key === 'variable' || key === 'let') {
    addVariableEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
    return true;
  }
  if (key === 'applicability') {
    addApplicabilityEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
    return true;
  }
  return false;
}

export function addCreationEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): void {
  const entityRef = labels[0];
  if (!entityRef) {
    diagnostics.push({
      severity: 'error',
      message: 'create requires an entityRef label',
      span: parent.span
    });
    return;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : parseInlineKeyValuePairs(rawValue, diagnostics, parent, 'create');
  if (!value) return;

  const existingRef = value.entityRef;
  if (existingRef !== undefined) {
    if (typeof existingRef !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'create entityRef must be a string',
        span: parent.span
      });
      return;
    }
    if (existingRef !== entityRef) {
      diagnostics.push({
        severity: 'error',
        message: `create entityRef mismatch: label "${entityRef}" vs value "${existingRef}"`,
        span: parent.span
      });
      return;
    }
  } else {
    value.entityRef = entityRef;
  }

  normalizeTagMapField(value, 'tags', diagnostics, parent.span);
  pushArrayValue(obj, 'creation', value);
}

export function addRelationshipEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): void {
  const [kind, src, dst] = labels;
  if (!kind || !src || !dst) {
    diagnostics.push({
      severity: 'error',
      message: 'relationship requires labels: <kind> <src> <dst>',
      span: parent.span
    });
    return;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : parseInlineKeyValuePairs(rawValue, diagnostics, parent, 'relationship');
  if (!value) return;

  if (!applyLabelField(value, 'kind', kind, diagnostics, parent)) return;
  if (!applyLabelField(value, 'src', src, diagnostics, parent)) return;
  if (!applyLabelField(value, 'dst', dst, diagnostics, parent)) return;

  pushArrayValue(obj, 'relationships', value);
}

export function addVariableEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): void {
  const varName = labels[0];
  if (!varName) {
    diagnostics.push({
      severity: 'error',
      message: 'var requires a variable name label',
      span: parent.span
    });
    return;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : parseInlineKeyValuePairs(rawValue, diagnostics, parent, 'variable');
  if (!value) return;

  if (!isRecord(value.select)) {
    const select: Record<string, unknown> = {};
    let moved = false;

    if ('kind' in value) {
      select.kind = value.kind;
      delete value.kind;
      moved = true;
    }
    if ('kinds' in value) {
      select.kinds = value.kinds;
      delete value.kinds;
      moved = true;
    }
    if ('subtypes' in value) {
      select.subtypes = value.subtypes;
      delete value.subtypes;
      moved = true;
    }
    if ('subtype' in value) {
      select.subtypes = [value.subtype];
      delete value.subtype;
      moved = true;
    }
    if ('status' in value) {
      select.status = value.status;
      delete value.status;
      moved = true;
    }
    if ('statuses' in value) {
      select.statuses = value.statuses;
      delete value.statuses;
      moved = true;
    }
    if ('statusFilter' in value) {
      select.status = value.statusFilter;
      delete value.statusFilter;
      moved = true;
    }
    if ('pickStrategy' in value) {
      select.pickStrategy = value.pickStrategy;
      delete value.pickStrategy;
      moved = true;
    }
    if ('pick' in value) {
      select.pickStrategy = value.pick;
      delete value.pick;
      moved = true;
    }
    if ('from' in value) {
      select.from = value.from;
      delete value.from;
      moved = true;
    }
    if ('filters' in value) {
      select.filters = value.filters;
      delete value.filters;
      moved = true;
    }
    if ('maxResults' in value) {
      select.maxResults = value.maxResults;
      delete value.maxResults;
      moved = true;
    }

    if (moved) {
      value.select = select;
    }
  } else if (isRecord(value.select.from) && 'relationship' in value.select.from && !('relationshipKind' in value.select.from)) {
    value.select.from.relationshipKind = value.select.from.relationship;
    delete value.select.from.relationship;
  }

  const existingVariables = obj.variables;
  let variables: Record<string, unknown>;
  if (existingVariables === undefined) {
    variables = {};
    obj.variables = variables;
  } else if (isRecord(existingVariables)) {
    variables = existingVariables;
  } else {
    diagnostics.push({
      severity: 'error',
      message: 'variables must be an object',
      span: parent.span
    });
    return;
  }

  if (Object.prototype.hasOwnProperty.call(variables, varName)) {
    diagnostics.push({
      severity: 'error',
      message: `Duplicate variable "${varName}"`,
      span: parent.span
    });
    return;
  }

  variables[varName] = value;
}

export function addApplicabilityEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): void {
  const typeLabel = labels[0];
  if (!typeLabel) {
    diagnostics.push({
      severity: 'error',
      message: 'applicability requires a type label',
      span: parent.span
    });
    return;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : parseInlineKeyValuePairs(rawValue, diagnostics, parent, 'applicability');
  if (!value) return;

  if (!applyLabelField(value, 'type', typeLabel, diagnostics, parent)) return;

  pushArrayValue(obj, 'applicability', value);
}

export function validateTextFormatting(files: AstFile[], diagnostics: Diagnostic[]): void {
  for (const file of files) {
    for (const stmt of file.statements) {
      validateTextFormattingStatement(stmt, diagnostics);
    }
  }
}

export function validateTextFormattingStatement(
  stmt: StatementNode,
  diagnostics: Diagnostic[]
): void {
  if (stmt.type === 'attribute') {
    if (stmt.valueKind === 'heredoc') {
      if (typeof stmt.value === 'string') {
        const lineCount = stmt.value.split(/\r?\n/).length;
        if (lineCount < 2) {
          diagnostics.push({
            severity: 'error',
            message: `Here-doc for "${stmt.key}" must contain at least two lines`,
            span: stmt.span
          });
        }
      }
      return;
    }
    if (valueContainsNewline(stmt.value)) {
      diagnostics.push({
        severity: 'error',
        message: `Inline "${stmt.key}" strings must not contain line breaks`,
        span: stmt.span
      });
    }
    return;
  }

  if (stmt.type === 'block') {
    for (const child of stmt.body) {
      validateTextFormattingStatement(child, diagnostics);
    }
  }
}

export function collectTopLevelBlocks(
  files: AstFile[],
  diagnostics: Diagnostic[]
): BlockNode[] {
  const blocks: BlockNode[] = [];

  for (const astFile of files) {
    for (const stmt of astFile.statements) {
      if (stmt.type === 'block') {
        blocks.push(...expandContainers(stmt, diagnostics));
        continue;
      }
      if (stmt.type === 'attribute') {
        const inlineBlock = inlineBlockFromAttribute(stmt, diagnostics);
        if (inlineBlock) {
          blocks.push(...expandContainers(inlineBlock, diagnostics));
          continue;
        }
        diagnostics.push({
          severity: 'error',
          message: `Top-level attribute "${stmt.key}" is not allowed`,
          span: stmt.span
        });
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Top-level statement "${stmt.type}" is not allowed`,
        span: stmt.span
      });
    }
  }

  return blocks;
}

export function buildItemFromBlock(
  block: BlockNode,
  mapping: BlockMapping,
  diagnostics: Diagnostic[]
): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const idLabel = block.labels[0];
  const nameLabel = block.labels[1];

  if (mapping.idKey && idLabel) {
    const existing = item[mapping.idKey];
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.idKey} must be a string`,
          span: block.span
        });
        return null;
      }
      if (existing !== idLabel) {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.idKey} mismatch: label "${idLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item[mapping.idKey] = idLabel;
  }

  if (mapping.nameKey && nameLabel) {
    const existing = item[mapping.nameKey];
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.nameKey} must be a string`,
          span: block.span
        });
        return null;
      }
      if (existing !== nameLabel) {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.nameKey} mismatch: label "${nameLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item[mapping.nameKey] = nameLabel;
  }

  return item;
}

export function hasDslStatements(statements: StatementNode[]): boolean {
  return statements.some((stmt) => {
    if (stmt.type === 'block') {
      return DSL_BLOCK_NAMES.has(stmt.name);
    }
    if (stmt.type === 'attribute' && stmt.key === 'let') {
      return true;
    }
    return (
      stmt.type === 'predicate'
      || stmt.type === 'in'
      || stmt.type === 'from'
      || stmt.type === 'mutate'
      || stmt.type === 'rel'
    );
  });
}

export function hasActionDslStatements(statements: StatementNode[]): boolean {
  return statements.some((stmt) => {
    if (stmt.type === 'block') {
      return ACTION_DSL_BLOCKS.has(stmt.name);
    }
    if (stmt.type === 'attribute') {
      return ACTION_DSL_ATTRIBUTES.has(stmt.key) || stmt.key === 'narrative';
    }
    return stmt.type === 'mutate' || stmt.type === 'rel';
  });
}

export function normalizeDeclaredBinding(name: string, ctx: GeneratorContext): string | null {
  if (name.includes('.')) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Invalid binding name "${name}"`,
      span: ctx.parent.span
    });
    return null;
  }
  const bare = name.startsWith('$') ? name.slice(1) : name;
  const normalized = name.startsWith('$') ? name : `$${name}`;
  ctx.bindings.set(bare, normalized);
  return normalized;
}

export function resolveRequiredRefName(
  name: string,
  ctx: GeneratorContext,
  span: BlockNode['span'],
  label: string
): string | null {
  if (name === 'any') return name;
  const normalized = normalizeRefName(name, ctx);
  const base = normalized.startsWith('$') ? normalized.slice(1).split('.')[0] : normalized.split('.')[0];
  if (!ctx.bindings.has(base) && !normalized.startsWith('$')) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unknown reference "${name}" in ${label} (declare before use or quote literal)`,
      span
    });
    return null;
  }
  return normalized;
}

export function normalizeRefName(name: string, ctx: GeneratorContext): string {
  if (name.startsWith('$')) return name;
  const [base, ...rest] = name.split('.');
  const bound = ctx.bindings.get(base);
  if (!bound) return name;
  const suffix = rest.length > 0 ? `.${rest.join('.')}` : '';
  return bound + suffix;
}

export function normalizeRefsInObject(value: Record<string, unknown>, ctx: GeneratorContext): void {
  const refKeys = new Set([
    'entityRef',
    'src',
    'dst',
    'entity',
    'with',
    'from',
    'to',
    'relatedTo',
    'referenceEntity',
    'catalyzedBy',
    'inherit',
    'ref'
  ]);
  const refListKeys = new Set(['entities']);

  for (const [key, entry] of Object.entries(value)) {
    if (refKeys.has(key) && typeof entry === 'string') {
      value[key] = normalizeRefName(entry, ctx);
      continue;
    }
    if (refListKeys.has(key) && Array.isArray(entry)) {
      entry.forEach((item, index) => {
        if (typeof item === 'string') {
          entry[index] = normalizeRefName(item, ctx);
        } else if (isRecord(item)) {
          normalizeRefsInObject(item, ctx);
        }
      });
      continue;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item) => {
        if (isRecord(item)) {
          normalizeRefsInObject(item, ctx);
        }
      });
      continue;
    }
    if (isRecord(entry)) {
      if (key === 'replacements') {
        for (const [repKey, repValue] of Object.entries(entry)) {
          if (typeof repValue === 'string') {
            entry[repKey] = normalizeRefName(repValue, ctx);
          }
        }
        continue;
      }
      normalizeRefsInObject(entry, ctx);
    }
  }
}

export function normalizeConditionObject(
  condition: Record<string, unknown>,
  ctx: GeneratorContext,
  span: BlockNode['span']
): void {
  const type = condition.type;
  if (type !== 'era_match') return;

  const eras = condition.eras;
  if (typeof eras === 'string') {
    if (eras === 'none') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'era_match requires one or more era identifiers',
        span
      });
      return;
    }
    condition.eras = [eras];
    return;
  }
  if (Array.isArray(eras)) {
    if (eras.length === 0 || eras.some((entry) => typeof entry !== 'string')) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'era_match requires one or more era identifiers',
        span
      });
      return;
    }
    condition.eras = eras.filter((entry) => typeof entry === 'string');
    return;
  }
  if (eras === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'era_match requires one or more era identifiers',
      span
    });
    return;
  }
  ctx.diagnostics.push({
    severity: 'error',
    message: 'era_match requires one or more era identifiers',
    span
  });
}

