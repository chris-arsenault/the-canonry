import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
} from './types.js';

import type { GeneratorContext } from './compile-types.js';
import { SYSTEM_CONDITION_KEYS, SYSTEM_OPERATOR_KEYWORDS } from './compile-types.js';
import { isRecord, isRelationshipDirection, flattenTokenList, mapSaturationDirection, isArrayValue, isObjectValue } from './compile-utils.js';
import { valueToJson } from './compile-variables.js';
import { normalizeRefName, normalizeRefsInObject } from './compile-objects.js';

export function parseStringListValue(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span'],
  label: string
): string[] | null {
  const tokens = valueToTokenList(value, ctx, span);
  if (!tokens) return null;
  const list = flattenTokenList(tokens, ctx, span);
  if (!list) return null;
  if (list.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `${label} requires at least one value`,
      span
    });
    return null;
  }
  return list;
}

export function parseOperatorKeyword(
  token: unknown,
  ctx: GeneratorContext,
  span: BlockNode['span']
): string | null {
  if (typeof token === 'string') {
    const operatorMap: Record<string, string> = { '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte', '==': 'eq' };
    const mapped = operatorMap[token] ?? null;
    if (mapped) return mapped;
    if (SYSTEM_OPERATOR_KEYWORDS.has(token)) return token;
  }
  if (typeof token !== 'string' || !SYSTEM_OPERATOR_KEYWORDS.has(token)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'Expected an operator keyword (gt/gte/lt/lte/eq/between)',
      span
    });
    return null;
  }
  return token;
}

export function parseSystemConditionTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length === 0 || typeof tokens[0] !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'condition requires a type',
      span
    });
    return null;
  }

  const type = tokens[0];
  const rest = tokens.slice(1);

  if (type === 'pressure') {
    const pressureId = rest[0];
    if (typeof pressureId !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'pressure requires a pressure id',
        span
      });
      return null;
    }
    const opToken = rest[1];
    const op = parseOperatorKeyword(opToken, ctx, span);
    if (!op) return null;
    if (op === 'between') {
      const minValue = rest[2];
      const maxValue = rest[3];
      if (typeof minValue !== 'number' || typeof maxValue !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'pressure between requires two numeric values',
          span
        });
        return null;
      }
      return { type: 'pressure', pressureId, min: minValue, max: maxValue };
    }
    const value = rest[2];
    if (typeof value !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'pressure requires a numeric threshold',
        span
      });
      return null;
    }
    if (op === 'eq') {
      return { type: 'pressure', pressureId, min: value, max: value };
    }
    if (op === 'gt' || op === 'gte') {
      return { type: 'pressure', pressureId, min: value };
    }
    if (op === 'lt' || op === 'lte') {
      return { type: 'pressure', pressureId, max: value };
    }
  }

  if (type === 'cap') {
    const field = rest[0];
    const kind = rest[1];
    if (field !== 'kind' || typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'cap requires: cap kind <kind> <operator> <value>',
        span
      });
      return null;
    }
    const opToken = rest[2];
    const op = parseOperatorKeyword(opToken, ctx, span);
    if (!op) return null;
    if (op === 'between') {
      const minValue = rest[3];
      const maxValue = rest[4];
      if (typeof minValue !== 'number' || typeof maxValue !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'cap between requires two numeric values',
          span
        });
        return null;
      }
      return { type: 'entity_count', kind, min: minValue, max: maxValue };
    }
    const value = rest[3];
    if (typeof value !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'cap requires a numeric threshold',
        span
      });
      return null;
    }
    if (op === 'eq') {
      return { type: 'entity_count', kind, min: value, max: value };
    }
    if (op === 'gt' || op === 'gte') {
      return { type: 'entity_count', kind, min: value };
    }
    if (op === 'lt' || op === 'lte') {
      return { type: 'entity_count', kind, max: value };
    }
  }

  if (type === 'entity_count') {
    if (rest[0] !== 'kind' || typeof rest[1] !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'entity_count requires: entity_count kind <kind> [subtype <subtype>] [status <status>] <operator> <value>',
        span
      });
      return null;
    }
    const kind = rest[1];
    let idx = 2;
    let subtype: string | undefined;
    let status: string | undefined;
    while (idx < rest.length) {
      const token = rest[idx];
      const next = rest[idx + 1];
      if (token === 'subtype' && typeof next === 'string') {
        subtype = next;
        idx += 2;
        continue;
      }
      if (token === 'status' && typeof next === 'string') {
        status = next;
        idx += 2;
        continue;
      }
      break;
    }
    const opToken = rest[idx];
    const op = parseOperatorKeyword(opToken, ctx, span);
    if (!op) return null;
    idx += 1;
    const condition: Record<string, unknown> = { type: 'entity_count', kind };
    if (subtype) condition.subtype = subtype;
    if (status) condition.status = status;

    if (op === 'between') {
      const minValue = rest[idx];
      const maxValue = rest[idx + 1];
      if (typeof minValue !== 'number' || typeof maxValue !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'entity_count between requires two numeric values',
          span
        });
        return null;
      }
      condition.min = minValue;
      condition.max = maxValue;
      return condition;
    }

    const value = rest[idx];
    if (typeof value !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'entity_count requires a numeric threshold',
        span
      });
      return null;
    }
    if (op === 'eq') {
      condition.min = value;
      condition.max = value;
      return condition;
    }
    if (op === 'gt' || op === 'gte') {
      condition.min = value;
      return condition;
    }
    if (op === 'lt' || op === 'lte') {
      condition.max = value;
      return condition;
    }
  }

  if (type === 'tag_exists') {
    const tag = rest[0];
    if (typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'tag_exists requires a tag identifier',
        span
      });
      return null;
    }
    return { type: 'tag_exists', tag };
  }

  if (type === 'lacks_tag') {
    if (rest.length === 1 && typeof rest[0] === 'string') {
      return { type: 'lacks_tag', tag: rest[0] };
    }
    if (rest.length === 2 && typeof rest[0] === 'string' && typeof rest[1] === 'string') {
      return {
        type: 'lacks_tag',
        entity: normalizeRefName(rest[0], ctx),
        tag: rest[1]
      };
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: 'lacks_tag requires: lacks_tag <tag> or lacks_tag <entity> <tag>',
      span
    });
    return null;
  }

  if (type === 'relationship_exists') {
    const relationshipKind = rest[0];
    const direction = rest[1];
    if (typeof relationshipKind !== 'string' || typeof direction !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship_exists requires: relationship_exists <relationship> <direction>',
        span
      });
      return null;
    }
    const condition: Record<string, unknown> = {
      type: 'relationship_exists',
      relationshipKind,
      direction
    };
    let idx = 2;
    while (idx < rest.length) {
      const key = rest[idx];
      const value = rest[idx + 1];
      if (key === 'target_kind' && typeof value === 'string') {
        condition.targetKind = value;
        idx += 2;
        continue;
      }
      if (key === 'target_status' && typeof value === 'string') {
        condition.targetStatus = value;
        idx += 2;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship_exists supports target_kind and target_status modifiers',
        span
      });
      return null;
    }
    normalizeRefsInObject(condition, ctx);
    return condition;
  }

  if (type === 'relationship_count') {
    const relationshipKind = rest[0];
    if (typeof relationshipKind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship_count requires a relationship kind',
        span
      });
      return null;
    }
    let idx = 1;
    let direction: string | undefined;
    const next = rest[idx];
    if (typeof next === 'string' && !SYSTEM_OPERATOR_KEYWORDS.has(next)) {
      direction = next;
      idx += 1;
    }
    const opToken = rest[idx];
    const op = parseOperatorKeyword(opToken, ctx, span);
    if (!op) return null;
    idx += 1;

    const condition: Record<string, unknown> = {
      type: 'relationship_count',
      relationshipKind
    };
    if (direction) condition.direction = direction;

    if (op === 'between') {
      const minValue = rest[idx];
      const maxValue = rest[idx + 1];
      if (typeof minValue !== 'number' || typeof maxValue !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'relationship_count between requires two numeric values',
          span
        });
        return null;
      }
      condition.min = minValue;
      condition.max = maxValue;
      return condition;
    }

    const value = rest[idx];
    if (typeof value !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship_count requires a numeric threshold',
        span
      });
      return null;
    }
    if (op === 'eq') {
      condition.min = value;
      condition.max = value;
      return condition;
    }
    if (op === 'gt' || op === 'gte') {
      condition.min = value;
      return condition;
    }
    if (op === 'lt' || op === 'lte') {
      condition.max = value;
      return condition;
    }
  }

  if (type === 'random_chance') {
    const chance = rest[0];
    if (typeof chance !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'random_chance requires a numeric value',
        span
      });
      return null;
    }
    return { type: 'random_chance', chance };
  }

  if (type === 'time_elapsed') {
    let index = 0;
    let minTicks = rest[index];
    if (minTicks === 'min') {
      index += 1;
      minTicks = rest[index];
    }
    if (typeof minTicks !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'time_elapsed requires a numeric tick value',
        span
      });
      return null;
    }
    const condition: Record<string, unknown> = { type: 'time_elapsed', minTicks };
    const nextIndex = index + 1;
    if (rest.length > nextIndex) {
      if (rest[nextIndex] === 'since' && typeof rest[nextIndex + 1] === 'string') {
        condition.since = rest[nextIndex + 1];
      } else {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'time_elapsed only supports: since <created|updated>',
          span
        });
        return null;
      }
    }
    return condition;
  }

  if (type === 'growth_phases_complete') {
    const minPhases = rest[0];
    if (typeof minPhases !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'growth_phases_complete requires a numeric phase count',
        span
      });
      return null;
    }
    const condition: Record<string, unknown> = { type: 'growth_phases_complete', minPhases };
    if (rest.length > 1) {
      if (rest[1] === 'era' && typeof rest[2] === 'string') {
        condition.eraId = rest[2];
      } else {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'growth_phases_complete only supports: era <eraId>',
          span
        });
        return null;
      }
    }
    return condition;
  }

  if (type === 'era_match') {
    const eras = rest.filter((entry) => entry !== undefined);
    if (eras.length === 0 || eras.some((entry) => typeof entry !== 'string')) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'era_match requires one or more era identifiers',
        span
      });
      return null;
    }
    return { type: 'era_match', eras };
  }

  if (type === 'prominence') {
    const bound = rest[0];
    const value = rest[1];
    if ((bound !== 'min' && bound !== 'max') || typeof value !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'prominence requires: prominence min|max <label>',
        span
      });
      return null;
    }
    return bound === 'min'
      ? { type: 'prominence', min: value }
      : { type: 'prominence', max: value };
  }

  if (type === 'entity_exists') {
    const entity = rest[0];
    if (typeof entity !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'entity_exists requires an entity reference',
        span
      });
      return null;
    }
    return {
      type: 'entity_exists',
      entity: normalizeRefName(entity, ctx)
    };
  }

  if (type === 'not_self') {
    return { type: 'not_self' };
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported condition type "${type}"`,
    span
  });
  return null;
}

export function parseSystemConditionStatement(
  stmt: StatementNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  if (stmt.type === 'attribute') {
    if (stmt.key === 'condition') {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (!tokens) return null;
      const condition = parseSystemConditionTokens(tokens, ctx, stmt.span);
      if (condition) {
        normalizeRefsInObject(condition, ctx);
      }
      return condition;
    }
    if (SYSTEM_CONDITION_KEYS.has(stmt.key)) {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (!tokens) return null;
      const condition = parseSystemConditionTokens([stmt.key, ...tokens], ctx, stmt.span);
      if (condition) {
        normalizeRefsInObject(condition, ctx);
      }
      return condition;
    }
  }

  if (stmt.type === 'predicate') {
    const condition = conditionFromPredicate(stmt, ctx);
    if (condition) {
      normalizeRefsInObject(condition, ctx);
    }
    return condition;
  }

  if (stmt.type === 'block' && (stmt.name === 'path' || stmt.name === 'graph_path')) {
    const condition = parseGraphPathBlock(stmt, ctx);
    if (condition) {
      normalizeRefsInObject(condition, ctx);
    }
    return condition;
  }

  if (stmt.type === 'block' && stmt.name === 'condition') {
    const mode = stmt.labels.find((label) =>
      label === 'any' || label === 'or' || label === 'all' || label === 'and'
    );
    const conditions = buildSystemConditionStatements(stmt.body, ctx);
    if (conditions.length === 0) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'condition block requires at least one condition',
        span: stmt.span
      });
      return null;
    }
    const type = (mode === 'any' || mode === 'or') ? 'or' : 'and';
    if (!mode && conditions.length === 1) {
      return conditions[0];
    }
    return { type, conditions };
  }

  return null;
}

export function buildSystemConditionStatements(
  statements: StatementNode[],
  ctx: GeneratorContext
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];
  for (const stmt of statements) {
    if (stmt.type === 'block' && (stmt.name === 'when' || stmt.name === 'conditions')) {
      const group = buildSystemConditionGroup(stmt, ctx);
      if (group) {
        conditions.push(group);
      }
      continue;
    }
    const condition = parseSystemConditionStatement(stmt, ctx);
    if (condition) {
      conditions.push(condition);
    } else {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported condition statement "${stmt.type}"`,
        span: stmt.span
      });
    }
  }
  return conditions;
}

export function buildSystemConditionGroup(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const mode = stmt.labels.find((label) =>
    label === 'any' || label === 'or' || label === 'all' || label === 'and'
  );
  const type = (mode === 'any' || mode === 'or') ? 'or' : 'and';
  const conditions = buildSystemConditionStatements(stmt.body, ctx);
  if (conditions.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'when block requires at least one condition',
      span: stmt.span
    });
    return null;
  }
  return { type, conditions };
}

export function _buildSystemConditions(
  statements: StatementNode[],
  ctx: GeneratorContext
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];
  for (const stmt of statements) {
    if (stmt.type === 'block' && (stmt.name === 'when' || stmt.name === 'conditions')) {
      const group = buildSystemConditionGroup(stmt, ctx);
      if (group) conditions.push(group);
      continue;
    }
    const condition = parseSystemConditionStatement(stmt, ctx);
    if (condition) {
      conditions.push(condition);
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported condition statement "${stmt.type}"`,
      span: stmt.span
    });
  }
  return conditions;
}

export function conditionFromPredicate(
  stmt: Extract<StatementNode, { type: 'predicate' }>,

export function valueToTokenList(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span']
): unknown[] | null {
  const raw = valueToJson(value, ctx.diagnostics, ctx.parent);
  if (Array.isArray(raw)) return raw as unknown[];
  if (raw === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'Expected a value list',
      span
    });
    return null;
  }
  return [raw];
}

export function parseFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length === 0 || typeof tokens[0] !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'filter requires a type',
      span
    });
    return null;
  }
  const type = tokens[0];
  const rest = tokens.slice(1);

  if (type === 'exclude') {
    const entities = flattenTokenList(rest, ctx, span);
    if (!entities) return null;
    if (entities.length === 0) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'exclude filter requires at least one entity',
        span
      });
      return null;
    }
    return {
      type,
      entities: entities.map((entry) => normalizeRefName(entry, ctx))
    };
  }

  if (type === 'has_relationship' || type === 'lacks_relationship') {
    const kind = rest[0];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a relationship kind`,
        span
      });
      return null;
    }
    const filter: Record<string, unknown> = { type, kind };
    let idx = 1;
    while (idx < rest.length) {
      const token = rest[idx];
      const value = rest[idx + 1];
      if (token === 'with' && typeof value === 'string') {
        filter.with = normalizeRefName(value, ctx);
        idx += 2;
        continue;
      }
      if (token === 'direction' && typeof value === 'string') {
        filter.direction = value;
        idx += 2;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported ${type} filter token "${String(token)}"`,
        span
      });
      return null;
    }
    return filter;
  }

  if (type === 'has_tag' || type === 'lacks_tag') {
    const tag = rest[0];
    if (typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a tag`,
        span
      });
      return null;
    }
    const filter: Record<string, unknown> = { type, tag };
    if (rest.length > 1) {
      if (rest[1] === 'value') {
        filter.value = rest[2];
      } else {
        filter.value = rest[1];
      }
    }
    return filter;
  }

  if (type === 'has_any_tag') {
    const tags = flattenTokenList(rest, ctx, span);
    if (!tags || tags.length === 0) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'has_any_tag filter requires tags',
        span
      });
      return null;
    }
    return { type, tags };
  }

  if (type === 'component_size') {
    const relationshipKinds: string[] = [];
    let min: number | undefined;
    let max: number | undefined;
    let idx = 0;
    while (idx < rest.length) {
      const token = rest[idx];
      if (token === 'min' || token === 'max') {
        const value = rest[idx + 1];
        if (typeof value !== 'number') {
          ctx.diagnostics.push({
            severity: 'error',
            message: `component_size ${token} requires a number`,
            span
          });
          return null;
        }
        if (token === 'min') min = value;
        else max = value;
        idx += 2;
        continue;
      }
      if (typeof token !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'component_size relationship kinds must be identifiers',
          span
        });
        return null;
      }
      relationshipKinds.push(token);
      idx += 1;
    }
    if (relationshipKinds.length === 0) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'component_size requires at least one relationship kind',
        span
      });
      return null;
    }
    if (min === undefined && max === undefined) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'component_size requires min or max',
        span
      });
      return null;
    }
    const filter: Record<string, unknown> = { type, relationshipKinds };
    if (min !== undefined) filter.min = min;
    if (max !== undefined) filter.max = max;
    return filter;
  }

  if (type === 'shares_related') {
    const relationshipKind = rest[0];
    if (typeof relationshipKind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'shares_related requires a relationship kind',
        span
      });
      return null;
    }
    let withRef: string | undefined;
    let idx = 1;
    while (idx < rest.length) {
      const token = rest[idx];
      const value = rest[idx + 1];
      if (token === 'with' && typeof value === 'string') {
        withRef = normalizeRefName(value, ctx);
        idx += 2;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported shares_related filter token "${String(token)}"`,
        span
      });
      return null;
    }
    if (!withRef) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'shares_related requires with <entity>',
        span
      });
      return null;
    }
    return { type, relationshipKind, with: withRef };
  }

  if (type === 'matches_culture' || type === 'not_matches_culture') {
    const ref = rest[0];
    if (typeof ref !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a reference`,
        span
      });
      return null;
    }
    return { type, with: normalizeRefName(ref, ctx) };
  }

  if (type === 'has_culture' || type === 'not_has_culture') {
    const culture = rest[0];
    if (typeof culture !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a culture`,
        span
      });
      return null;
    }
    return { type, culture };
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported filter type "${type}"`,
    span
  });
  return null;
}

export function parseWhereBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown>[] {
  const filters: Record<string, unknown>[] = [];
  for (const child of stmt.body) {
    const filter = parseWhereStatement(child, ctx);
    if (filter) {
      filters.push(filter);
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported where statement "${child.type}"`,
      span: child.span
    });
  }
  return filters;
}

export function parseWhereStatement(
  stmt: StatementNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  if (stmt.type === 'block' && stmt.name === 'graph_path') {
    return parseGraphPathBlock(stmt, ctx);
  }
  if (stmt.type !== 'attribute') {
    return null;
  }
  const tokens = tokensFromAttribute(stmt, ctx);
  if (!tokens || tokens.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `${stmt.key} filter requires a value`,
      span: stmt.span
    });
    return null;
  }

  if (stmt.key === 'entity') {
    return parseEntityFilterTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'tag') {
    return parseTagFilterTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'relationship') {
    return parseRelationshipFilterTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'culture') {
    return parseCultureFilterTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'status') {
    return parseStatusFilterTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'prominence') {
    return parseProminenceFilterTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'component_size') {
    return parseComponentSizeFilterTokens(tokens, ctx, stmt.span);
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported where filter "${stmt.key}"`,
    span: stmt.span
  });
  return null;
}

export function parseEntityFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  if (op !== 'exclude') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'entity filter only supports: entity exclude <entity>...',
      span
    });
    return null;
  }
  const entities = flattenTokenList(tokens.slice(1), ctx, span);
  if (!entities || entities.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'entity exclude requires at least one entity',
      span
    });
    return null;
  }
  const filter: Record<string, unknown> = {
    type: 'exclude',
    entities: entities.map((entry) => normalizeRefName(entry, ctx))
  };
  return filter;
}

export function parseTagFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const rest = tokens.slice(1);
  if (op === 'has' || op === 'lacks') {
    const tag = rest[0];
    if (typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `tag ${op} requires a tag id`,
        span
      });
      return null;
    }
    const filter: Record<string, unknown> = {
      type: op === 'has' ? 'has_tag' : 'lacks_tag',
      tag
    };
    if (rest.length > 1) {
      if (rest[1] === 'value') {
        filter.value = rest[2];
      } else {
        filter.value = rest[1];
      }
    }
    return filter;
  }
  if (op === 'has_any' || op === 'has_all' || op === 'lacks_any') {
    const tags = flattenTokenList(rest, ctx, span);
    if (!tags || tags.length === 0) {
      ctx.diagnostics.push({
        severity: 'error',
        message: `tag ${op} requires tags`,
        span
      });
      return null;
    }
    if (op === 'has_any') return { type: 'has_any_tag', tags };
    if (op === 'lacks_any') return { type: 'lacks_any_tag', tags };
    return { type: 'has_tags', tags };
  }
  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported tag filter "${String(op)}"`,
    span
  });
  return null;
}

export function parseRelationshipFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const rest = tokens.slice(1);
  if (op === 'has' || op === 'lacks') {
    const kind = rest[0];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `relationship ${op} requires a relationship kind`,
        span
      });
      return null;
    }
    const filter: Record<string, unknown> = {
      type: op === 'has' ? 'has_relationship' : 'lacks_relationship',
      kind
    };
    let idx = 1;
    while (idx < rest.length) {
      const token = rest[idx];
      const value = rest[idx + 1];
      if (token === 'with' && typeof value === 'string') {
        filter.with = normalizeRefName(value, ctx);
        idx += 2;
        continue;
      }
      if (token === 'direction' && typeof value === 'string') {
        if (op === 'lacks') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'relationship lacks does not support direction',
            span
          });
          return null;
        }
        filter.direction = value;
        idx += 2;
        continue;
      }
      if (typeof token === 'string' && isRelationshipDirection(token)) {
        if (op === 'lacks') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'relationship lacks does not support direction',
            span
          });
          return null;
        }
        filter.direction = token;
        idx += 1;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported relationship ${op} token "${String(token)}"`,
        span
      });
      return null;
    }
    return filter;
  }
  if (op === 'shares_related') {
    const kind = rest[0];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship shares_related requires a relationship kind',
        span
      });
      return null;
    }
    if (rest[1] !== 'with' || typeof rest[2] !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship shares_related requires: shares_related <kind> with <entity>',
        span
      });
      return null;
    }
    return {
      type: 'shares_related',
      relationshipKind: kind,
      with: normalizeRefName(rest[2], ctx)
    };
  }
  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported relationship filter "${String(op)}"`,
    span
  });
  return null;
}

export function parseCultureFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const value = tokens[1];
  if (typeof value !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `culture ${String(op)} requires a value`,
      span
    });
    return null;
  }
  if (op === 'matches' || op === 'not_matches') {
    return {
      type: op === 'matches' ? 'matches_culture' : 'not_matches_culture',
      with: normalizeRefName(value, ctx)
    };
  }
  if (op === 'has' || op === 'not_has') {
    return {
      type: op === 'has' ? 'has_culture' : 'not_has_culture',
      culture: value
    };
  }
  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported culture filter "${String(op)}"`,
    span
  });
  return null;
}

export function parseStatusFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const status = tokens[1];
  if (op !== 'has' || typeof status !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'status filter requires: status has <status>',
      span
    });
    return null;
  }
  return { type: 'has_status', status };
}

export function parseProminenceFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const value = tokens[1];
  if ((op !== '>=' && op !== '>') || typeof value !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence filter requires: prominence >= <label>',
      span
    });
    return null;
  }
  return { type: 'has_prominence', minProminence: value };
}

export function parseComponentSizeFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const relationshipKinds: string[] = [];
  let min: number | undefined;
  let max: number | undefined;
  let minStrength: number | undefined;
  let idx = 0;
  while (idx < tokens.length) {
    const token = tokens[idx];
    if (token === 'min' || token === 'max' || token === 'min_strength') {
      const value = tokens[idx + 1];
      if (typeof value !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: `component_size ${token} requires a number`,
          span
        });
        return null;
      }
      if (token === 'min') min = value;
      else if (token === 'max') max = value;
      else minStrength = value;
      idx += 2;
      continue;
    }
    if (typeof token !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'component_size relationship kinds must be identifiers',
        span
      });
      return null;
    }
    relationshipKinds.push(token);
    idx += 1;
  }
  if (relationshipKinds.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'component_size requires at least one relationship kind',
      span
    });
    return null;
  }
  if (min === undefined && max === undefined && minStrength === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'component_size requires min, max, or min_strength',
      span
    });
    return null;
  }
  const filter: Record<string, unknown> = { type: 'component_size', relationshipKinds };
  if (min !== undefined) filter.min = min;
  if (max !== undefined) filter.max = max;
  if (minStrength !== undefined) filter.minStrength = minStrength;
  return filter;
}

export function parseGraphPathBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const { check } = parseGraphPathHeader(stmt, ctx);
  if (!check) return null;

  const path: Record<string, unknown>[] = [];
  const where: Record<string, unknown>[] = [];
  let count: number | undefined;

  for (const child of stmt.body) {
    if (child.type === 'attribute' && child.key === 'count') {
      const raw = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      if (typeof raw !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'count must be a number',
          span: child.span
        });
      } else {
        count = raw;
      }
      continue;
    }
    if (child.type === 'attribute' && child.key === 'step') {
      const tokens = valueToTokenList(child.value, ctx, child.span);
      if (!tokens) continue;
      const step = parseGraphPathStepTokens(tokens, ctx, child.span);
      if (step) path.push(step);
      continue;
    }
    if (child.type === 'block' && child.name === 'step') {
      const step = parseGraphPathStepBlock(child, ctx);
      if (step) path.push(step);
      continue;
    }
    if (child.type === 'attribute' && child.key === 'where') {
      const constraint = parsePathConstraintValue(child.value, ctx, child.span);
      if (constraint) where.push(constraint);
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported graph path statement "${child.type}"`,
      span: child.span
    });
  }

  if (path.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'graph path requires at least one step',
      span: stmt.span
    });
    return null;
  }

  if ((check === 'count_min' || check === 'count_max') && count === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'graph path count requires count <number>',
      span: stmt.span
    });
    return null;
  }

  const assert: Record<string, unknown> = { check, path };
  if (count !== undefined) assert.count = count;
  if (where.length > 0) assert.where = where;

  return { type: 'graph_path', assert };
}

export function parseGraphPathHeader(
  stmt: BlockNode,
  ctx: GeneratorContext
): { check?: string } {

export function parseGraphPathStepTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length < 3) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'step requires: step <via> <direction> <kind> [<subtype>] [status <status>]',
      span
    });
    return null;
  }
  const directionIndex = tokens.findIndex(
    (token) => typeof token === 'string' && ['in', 'out', 'any', 'both'].includes(token)
  );
  if (directionIndex < 1 || directionIndex + 1 >= tokens.length) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'step requires: step <via> <direction> <kind> [<subtype>] [status <status>]',
      span
    });
    return null;
  }

  const viaToken = directionIndex === 1 ? tokens[0] : tokens.slice(0, directionIndex);
  const direction = tokens[directionIndex];
  const targetKind = tokens[directionIndex + 1];
  const possibleSubtype = tokens[directionIndex + 2];
  let targetSubtype: string | undefined;
  let statusIndex = directionIndex + 2;
  if (typeof possibleSubtype === 'string' && possibleSubtype !== 'status') {
    targetSubtype = possibleSubtype;
    statusIndex = directionIndex + 3;
  }
  const statusLabel = tokens[statusIndex];
  const statusValue = tokens[statusIndex + 1];

  const via = parseViaToken(viaToken, ctx, span);
  if (!via || typeof direction !== 'string' || typeof targetKind !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'step requires via, direction, and kind',
      span
    });
    return null;
  }

  const step: Record<string, unknown> = {
    via,
    direction,
    targetKind
  };
  if (targetSubtype !== undefined) {
    step.targetSubtype = targetSubtype;
  }

  if (statusLabel !== undefined) {
    if (statusLabel !== 'status' || typeof statusValue !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'step status requires: status <status>',
        span
      });
      return null;
    }
    step.targetStatus = statusValue;
  }

  return step;
}

export function parseGraphPathStepBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const baseStep = stmt.labels.length > 0 ? parseGraphPathStepTokens(stmt.labels, ctx, stmt.span) : {};
  const step: Record<string, unknown> = baseStep ?? {};
  const filters: Record<string, unknown>[] = [];

  for (const child of stmt.body) {
    if (child.type === 'block' && child.name === 'where') {
      const nested = parseWhereBlock(child, ctx);
      if (nested.length > 0) {
        filters.push(...nested);
      }
      continue;
    }
    if (child.type !== 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'step blocks only support attributes and where blocks',
        span: child.span
      });
      continue;
    }
    if (child.key === 'via') {
      const raw = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      const via = parseViaToken(raw, ctx, child.span);
      if (via) step.via = via;
      continue;
    }
    if (child.key === 'direction') {
      const raw = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      step.direction = raw;
      continue;
    }
    if (child.key === 'target') {
      const tokens = valueToTokenList(child.value, ctx, child.span);
      if (!tokens || tokens.length < 1) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'target requires: target <kind> [<subtype>]',
          span: child.span
        });
      } else {
        step.targetKind = tokens[0];
        if (tokens[1] !== undefined) {
          step.targetSubtype = tokens[1];
        }
      }
      continue;
    }
    if (child.key === 'kind' || child.key === 'targetKind') {
      step.targetKind = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      continue;
    }
    if (child.key === 'subtype' || child.key === 'targetSubtype') {
      step.targetSubtype = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      continue;
    }
    if (child.key === 'status' || child.key === 'targetStatus') {
      step.targetStatus = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported step attribute "${child.key}"`,
      span: child.span
    });
  }

  if (filters.length > 0) {
    step.filters = filters;
  }

  if (!step.via || !step.direction || !step.targetKind || !step.targetSubtype) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'step requires via, direction, target kind, target subtype',
      span: stmt.span
    });
    return null;
  }

  return step;
}

export function parseViaToken(
  token: unknown,
  ctx: GeneratorContext,
  span: BlockNode['span']
): string | string[] | null {
  if (typeof token === 'string') return token;
  if (Array.isArray(token)) {
    const vias: string[] = [];
    for (const entry of token) {
      if (typeof entry !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'via list must contain identifiers',
          span
        });
        return null;
      }
      vias.push(entry);
    }
    return vias;
  }
  ctx.diagnostics.push({
    severity: 'error',
    message: 'via must be a string or list',
    span
  });
  return null;
}

export function parsePathConstraintValue(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const raw = valueToJson(value, ctx.diagnostics, ctx.parent);
  if (isRecord(raw) && typeof raw.type === 'string') {
    normalizeRefsInObject(raw, ctx);
    return raw;
  }
  const tokens = Array.isArray(raw) ? raw : [raw];
  return parsePathConstraintTokens(tokens, ctx, span);
}

export function parsePathConstraintTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length === 0 || typeof tokens[0] !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'where requires a constraint type',
      span
    });
    return null;
  }
  const type = tokens[0];
  const rest = tokens.slice(1);

  if (type === 'not_self') {
    return { type };
  }
  if (type === 'in' || type === 'not_in') {
    const set = rest[0];
    if (typeof set !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} requires a set id`,
        span
      });
      return null;
    }
    return { type, set };
  }
  if (type === 'has_relationship' || type === 'lacks_relationship') {
    const kind = rest[0];
    const withToken = rest[1];
    if (typeof kind !== 'string' || typeof withToken !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} requires: ${type} <kind> <with> [direction <dir>]`,
        span
      });
      return null;
    }
    const constraint: Record<string, unknown> = {
      type,
      kind,
      with: normalizeRefName(withToken, ctx)
    };
    if (rest[2] === 'direction' && typeof rest[3] === 'string') {
      constraint.direction = rest[3];
    }
    return constraint;
  }
  if (type === 'kind') {
    const kind = rest[0];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'where kind requires a kind',
        span
      });
      return null;
    }
    return { type: 'kind_equals', kind };
  }
  if (type === 'subtype') {
    const subtype = rest[0];
    if (typeof subtype !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'where subtype requires a subtype',
        span
      });
      return null;
    }
    return { type: 'subtype_equals', subtype };
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported where constraint "${type}"`,
    span
  });
  return null;
}

