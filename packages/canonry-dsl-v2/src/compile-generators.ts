import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
} from './types.js';

import type { GeneratorContext, ActionContext } from './compile-types.js';
import { SET_FIELD_KEYS } from './compile-types.js';
import { isRecord, setObjectValue, pushArrayValue, applyLabelField, isArrayValue, isObjectValue } from './compile-utils.js';
import { valueToJson } from './compile-variables.js';
import { normalizeRefName, normalizeRefsInObject, normalizeConditionObject, buildObjectFromStatements, normalizeDeclaredBinding, hasDslStatements, hasActionDslStatements } from './compile-objects.js';
import { applySetFieldAttribute } from './compile-sets.js';
import { valueToTokenList, parseFilterTokens, conditionFromPredicate, parseWhereBlock } from './compile-conditions.js';

export function buildGeneratorItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = hasDslStatements(block.body)
    ? buildGeneratorFromStatements(block.body, diagnostics, block)
    : buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const idLabel = block.labels[0];
  const nameLabel = block.labels[1];

  if (idLabel) {
    const existing = item.id;
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'id must be a string',
          span: block.span
        });
        return null;
      }
      if (existing !== idLabel) {
        diagnostics.push({
          severity: 'error',
          message: `id mismatch: label "${idLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item.id = idLabel;
  }

  if (nameLabel) {
    const existing = item.name;
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'name must be a string',
          span: block.span
        });
        return null;
      }
      if (existing !== nameLabel) {
        diagnostics.push({
          severity: 'error',
          message: `name mismatch: label "${nameLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item.name = nameLabel;
  }

  return item;
}

export function buildActionItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = hasActionDslStatements(block.body)
    ? buildActionFromStatements(block.body, diagnostics, block)
    : buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const idLabel = block.labels[0];
  const nameLabel = block.labels[1];

  if (idLabel && !applyLabelField(item, 'id', idLabel, diagnostics, block)) return null;
  if (nameLabel && !applyLabelField(item, 'name', nameLabel, diagnostics, block)) return null;

  return item;
}

export function buildGeneratorFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const ctx: GeneratorContext = {
    bindings: new Map(),
    diagnostics,
    parent,
    selectionDefined: false
  };

  for (const stmt of statements) {
    applyGeneratorStatement(stmt, obj, ctx);
  }

  if (!Object.prototype.hasOwnProperty.call(obj, 'applicability')) {
    obj.applicability = [];
  }
  if (!Object.prototype.hasOwnProperty.call(obj, 'stateUpdates')) {
    obj.stateUpdates = [];
  }

  return obj;
}

export function applyGeneratorStatement(
  stmt: StatementNode,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): void {
  if (stmt.type === 'attribute') {
    if (stmt.labels && stmt.labels.length > 0) {
      if (applyLabeledAttributeDsl(stmt, obj, ctx)) {
        return;
      }
    }
    const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
    setObjectValue(obj, stmt.key, value);
    return;
  }

  if (stmt.type === 'block') {
    if (stmt.name === 'constraints') {
      const conditions = buildConditionsFromStatements(stmt.body, ctx);
      if (conditions.length > 0) {
        pushArrayValue(obj, 'applicability', {
          type: 'and',
          conditions
        });
      }
      return;
    }
    if (stmt.name === 'when') {
      const mode = stmt.labels.find((label) => label === 'any' || label === 'or' || label === 'all' || label === 'and');
      const type = (mode === 'any' || mode === 'or') ? 'or' : 'and';
      const conditions = buildConditionsFromStatements(stmt.body, ctx);
      if (conditions.length === 0) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'when block requires at least one condition',
          span: stmt.span
        });
        return;
      }
      if (!mode) {
        if (conditions.length === 1 && isRecord(conditions[0])) {
          const candidate = conditions[0];
          if (typeof candidate.type === 'string' && Array.isArray(candidate.conditions)) {
            pushArrayValue(obj, 'applicability', candidate);
            return;
          }
        }
        for (const condition of conditions) {
          pushArrayValue(obj, 'applicability', condition);
        }
        return;
      }
      pushArrayValue(obj, 'applicability', { type, conditions });
      return;
    }
    if (stmt.name === 'choose' || stmt.name === 'selection') {
      const { selection, targetAlias } = buildSelectionFromStatements(stmt, ctx);
      if (selection) {
        if (ctx.selectionDefined) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          return;
        }
        ctx.selectionDefined = true;
        if (targetAlias) {
          ctx.targetAlias = targetAlias;
          ctx.bindings.set(targetAlias, '$target');
        } else if (!ctx.bindings.has('target')) {
          ctx.bindings.set('target', '$target');
        }
        normalizeRefsInObject(selection, ctx);
        obj.selection = selection;
      }
      return;
    }
    if (stmt.name === 'let' || stmt.name === 'var' || stmt.name === 'variable') {
      addVariableEntryDsl(stmt.labels, buildVariableFromStatements(stmt, ctx), obj, ctx);
      return;
    }
    if (stmt.name === 'create') {
      addCreationEntryDsl(stmt.labels, buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt), obj, ctx);
      return;
    }
    if (stmt.name === 'relationship' || stmt.name === 'rel') {
      const body = buildRelationshipBodyFromStatements(stmt.body, ctx);
      addRelationshipEntryDsl(stmt.labels, body, obj, ctx);
      return;
    }
    if (stmt.name === 'applicability') {
      addApplicabilityEntry(stmt.labels, buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt), obj, ctx.diagnostics, stmt);
      return;
    }
    if (stmt.name === 'mutate') {
      const mutations = buildMutationListFromStatements(stmt.body, ctx);
      for (const mutation of mutations) {
        pushArrayValue(obj, 'stateUpdates', mutation);
      }
      return;
    }
    if (stmt.name === 'stateUpdates') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'stateUpdates blocks are not supported; use a mutate block',
        span: stmt.span
      });
      return;
    }
    if (stmt.name === 'variants') {
      const variants = buildVariantsFromBlock(stmt, ctx);
      if (variants) {
        obj.variants = variants;
      }
      return;
    }

    const child = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    if (stmt.labels.length > 0) {
      const existingId = child.id;
      if (existingId === undefined) {
        child.id = stmt.labels[0];
      } else if (typeof existingId !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'block id must be a string',
          span: stmt.span
        });
      } else if (existingId !== stmt.labels[0]) {
        ctx.diagnostics.push({
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
        ctx.diagnostics.push({
          severity: 'error',
          message: 'block name must be a string',
          span: stmt.span
        });
      } else if (existingName !== stmt.labels[1]) {
        ctx.diagnostics.push({
          severity: 'error',
          message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
          span: stmt.span
        });
      }
    }
    setObjectValue(obj, stmt.name, child);
    return;
  }

  if (stmt.type === 'rel') {
    addRelationshipEntryDsl([stmt.kind, stmt.src, stmt.dst], stmt.value, obj, ctx);
    return;
  }

  if (stmt.type === 'mutate') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'mutate statements are not supported; use a mutate block',
      span: stmt.span
    });
    return;
  }

  if (stmt.type === 'predicate') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Predicate "${stmt.keyword}" must be inside a when/constraints block`,
      span: stmt.span
    });
    return;
  }

  if (stmt.type === 'in' || stmt.type === 'from') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `"${stmt.type}" statement is not valid at generator scope`,
      span: stmt.span
    });
  }
}

export function buildVariantsFromBlock(block: BlockNode, ctx: GeneratorContext): Record<string, unknown> | null {
  const variants: Record<string, unknown> = {};
  const options: Record<string, unknown>[] = [];

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'selection') {
        variants.selection = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      setObjectValue(variants, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'options') {
        const option = buildVariantOptionFromBlock(stmt, ctx);
        if (option) options.push(option);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
      setObjectValue(variants, stmt.name, child);
      continue;
    }

    if (stmt.type === 'bare') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'bare statements are not allowed in variants',
        span: stmt.span
      });
    }
  }

  if (options.length > 0) {
    variants.options = options;
  }

  return variants;
}

export function buildVariantOptionFromBlock(block: BlockNode, ctx: GeneratorContext): Record<string, unknown> | null {
  const option: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'name') {
        option.name = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      setObjectValue(option, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'when') {
        option.when = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'apply') {
        const apply = buildVariantApplyFromBlock(stmt, ctx);
        if (apply) option.apply = apply;
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
      setObjectValue(option, stmt.name, child);
      continue;
    }

    if (stmt.type === 'bare') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'bare statements are not allowed in variant options',
        span: stmt.span
      });
    }
  }

  return option;
}

export function buildVariantApplyFromBlock(block: BlockNode, ctx: GeneratorContext): Record<string, unknown> | null {
  const apply: Record<string, unknown> = {};
  const tags: Record<string, Record<string, boolean>> = {};
  const subtypes: Record<string, string> = {};
  const stateUpdates: Record<string, unknown>[] = [];

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'tag_assign') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 3) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'tag_assign requires: tag_assign <entity> <tag> <true|false>',
            span: stmt.span
          });
          continue;
        }
        const [entity, tag, enabled] = tokens;
        if (typeof entity !== 'string' || typeof tag !== 'string' || typeof enabled !== 'boolean') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'tag_assign requires: tag_assign <entity> <tag> <true|false>',
            span: stmt.span
          });
          continue;
        }
        if (!tags[entity]) tags[entity] = {};
        tags[entity][tag] = enabled;
        continue;
      }
      if (stmt.key === 'subtype') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 2) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'subtype requires: subtype <entity> <subtype>',
            span: stmt.span
          });
          continue;
        }
        const [entity, subtype] = tokens;
        if (typeof entity !== 'string' || typeof subtype !== 'string') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'subtype requires: subtype <entity> <subtype>',
            span: stmt.span
          });
          continue;
        }
        subtypes[entity] = subtype;
        continue;
      }
      if (stmt.key === 'stateUpdates') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'stateUpdates attributes are not supported; use a mutate block',
          span: stmt.span
        });
        continue;
      }
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      setObjectValue(apply, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'mutate') {
        const mutations = buildMutationListFromStatements(stmt.body, ctx);
        stateUpdates.push(...mutations);
        continue;
      }
      if (stmt.name === 'stateUpdates') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'stateUpdates blocks are not supported; use a mutate block',
          span: stmt.span
        });
        continue;
      }
      if (stmt.name === 'tags' || stmt.name === 'subtype') {
        ctx.diagnostics.push({
          severity: 'error',
          message: `${stmt.name} blocks are not supported here; use tag_assign or subtype statements`,
          span: stmt.span
        });
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
      setObjectValue(apply, stmt.name, child);
      continue;
    }

    if (stmt.type === 'bare') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'bare statements are not allowed in apply blocks',
        span: stmt.span
      });
    }
  }

  if (Object.keys(tags).length > 0) {
    apply.tags = tags;
  }
  if (Object.keys(subtypes).length > 0) {
    apply.subtype = subtypes;
  }
  if (stateUpdates.length > 0) {
    apply.stateUpdates = stateUpdates;
  }

  return apply;
}

export function buildConditionsFromStatements(statements: StatementNode[], ctx: GeneratorContext): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];
  const conditionKeys = new Set([
    'pressure',
    'cap',
    'entity_count',
    'relationship_count',
    'relationship_exists',
    'tag_exists',
    'random_chance',
    'time_elapsed',
    'growth_phases_complete',
    'entity_exists',
    'not_self',
    'era_match'
  ]);

  for (const stmt of statements) {
    if (stmt.type === 'predicate') {
      const condition = conditionFromPredicate(stmt, ctx);
      if (condition) conditions.push(condition);
      continue;
    }
    if (stmt.type === 'block' && (stmt.name === 'condition' || stmt.name === 'when')) {
      const mode = stmt.labels.find((label) =>
        label === 'any' || label === 'or' || label === 'all' || label === 'and'
      );
      if (mode) {
        const nested = buildConditionsFromStatements(stmt.body, ctx);
        if (nested.length === 0) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'condition group requires at least one condition',
            span: stmt.span
          });
          continue;
        }
        const type = (mode === 'any' || mode === 'or') ? 'or' : 'and';
        conditions.push({ type, conditions: nested });
        continue;
      }
      const condition = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
      normalizeRefsInObject(condition, ctx);
      normalizeConditionObject(condition, ctx, stmt.span);
      conditions.push(condition);
      continue;
    }
    if (stmt.type === 'block' && (stmt.name === 'path' || stmt.name === 'graph_path')) {
      const condition = parseGraphPathBlock(stmt, ctx);
      if (condition) conditions.push(condition);
      continue;
    }
    if (stmt.type === 'attribute' && conditionKeys.has(stmt.key)) {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (!tokens) continue;
      const condition = parseSystemConditionTokens([stmt.key, ...tokens], ctx, stmt.span);
      if (condition) {
        normalizeRefsInObject(condition, ctx);
        conditions.push(condition);
      }
      continue;
    }
    if (stmt.type === 'attribute' && stmt.key === 'condition') {
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      if (isRecord(value)) {
        normalizeRefsInObject(value, ctx);
        normalizeConditionObject(value, ctx, stmt.span);
        conditions.push(value);
      } else {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'condition value must be an object',
          span: stmt.span
        });
      }
      continue;
    }
    if (stmt.type === 'attribute' && stmt.key === 'prominence') {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (!tokens || tokens.length < 2) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'prominence requires: prominence min|max <value>',
          span: stmt.span
        });
        continue;
      }
      const [mode, value] = tokens;
      if (mode !== 'min' && mode !== 'max') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'prominence requires min or max',
          span: stmt.span
        });
        continue;
      }
      if (typeof value !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'prominence value must be an identifier',
          span: stmt.span
        });
        continue;
      }
      const condition: Record<string, unknown> = { type: 'prominence' };
      if (mode === 'min') condition.min = value;
      if (mode === 'max') condition.max = value;
      conditions.push(condition);
      continue;
    }
    if (stmt.type === 'attribute' && stmt.key === 'lacks_tag') {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (!tokens || tokens.length === 0) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'lacks_tag requires a tag',
          span: stmt.span
        });
        continue;
      }
      const tag = tokens.length === 1 ? tokens[0] : tokens[1];
      const entity = tokens.length > 1 ? tokens[0] : undefined;
      if (typeof tag !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'lacks_tag requires a tag identifier',
          span: stmt.span
        });
        continue;
      }
      const condition: Record<string, unknown> = { type: 'lacks_tag', tag };
      if (typeof entity === 'string') {
        condition.entity = normalizeRefName(entity, ctx);
      }
      conditions.push(condition);
      continue;
    }
    if (stmt.type !== 'attribute' && stmt.type !== 'block') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported condition statement "${stmt.type}"`,
        span: stmt.span
      });
      continue;
    }
    if (stmt.type === 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported condition attribute "${stmt.key}"`,
        span: stmt.span
      });
    }
  }

  return conditions;
}

export function buildSelectionFromStatements(
  stmt: Extract<StatementNode, { type: 'block' }>,

export function buildVariableFromStatements(
  stmt: Extract<StatementNode, { type: 'block' }>,

export function buildRelationshipBodyFromStatements(
  statements: StatementNode[],
  ctx: GeneratorContext
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (stmt.labels && stmt.labels.length > 0) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'relationship attributes do not support labels',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'condition') {
        const tokens = tokensFromAttribute(stmt, ctx);
        if (!tokens || tokens.length === 0) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'condition requires a condition statement',
            span: stmt.span
          });
          continue;
        }
        const condition = parseSystemConditionTokens(tokens, ctx, stmt.span);
        if (condition) {
          normalizeRefsInObject(condition, ctx);
          body.condition = condition;
        }
        continue;
      }
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      setObjectValue(body, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'condition') {
        const mode = stmt.labels.find((label) =>
          label === 'any' || label === 'or' || label === 'all' || label === 'and'
        );
        const type = (mode === 'any' || mode === 'or') ? 'or' : 'and';
        const conditions = buildSystemConditionStatements(stmt.body, ctx);
        if (conditions.length === 0) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'condition block requires at least one condition',
            span: stmt.span
          });
          continue;
        }
        const condition =
          !mode && conditions.length === 1
            ? conditions[0]
            : { type, conditions };
        body.condition = condition;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported relationship block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported relationship statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  return body;
}

export function applyActionStatement(
  stmt: StatementNode,
  obj: Record<string, unknown>,
  ctx: ActionContext
): void {
  if (stmt.type === 'attribute') {
    if (stmt.labels && stmt.labels.length > 0 && applyActionLabeledAttribute(stmt, obj, ctx)) {
      return;
    }

    if (stmt.key === 'description') {
      obj.description = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'narrative' || stmt.key === 'descriptionTemplate') {
      const outcome = ensureActionOutcome(obj);
      outcome.descriptionTemplate = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'success_chance') {
      const probability = ensureActionProbability(obj);
      probability.baseSuccessChance = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'weight') {
      const probability = ensureActionProbability(obj);
      probability.baseWeight = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'pressure_modifier') {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (tokens && tokens.length === 1 && tokens[0] === 'none') {
        const probability = ensureActionProbability(obj);
        const existing = probability.pressureModifiers;
        if (Array.isArray(existing) && existing.length > 0) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'pressure_modifier none cannot be combined with modifiers',
            span: stmt.span
          });
          return;
        }
        probability.pressureModifiers = [];
        return;
      }
      const modifier = parsePressureModifier(stmt.value, ctx);
      if (modifier) {
        const probability = ensureActionProbability(obj);
        pushArrayValue(probability, 'pressureModifiers', modifier);
      }
      return;
    }
    if (stmt.key === 'prominence') {
      applyActionProminence(stmt.value, obj, ctx);
      return;
    }
    if (stmt.key === 'enabled') {
      obj.enabled = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }

    const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
    setObjectValue(obj, stmt.key, value);
    return;
  }

  if (stmt.type === 'block') {
    if (stmt.name === 'actor') {
      applyActionActorBlock(stmt, obj, ctx);
      return;
    }
    if (stmt.name === 'target' || stmt.name === 'targeting') {
      applyActionTargetBlock(stmt, obj, ctx);
      return;
    }
    if (stmt.name === 'on') {
      applyActionOutcomeBlock(stmt, obj, ctx);
      return;
    }
    if (stmt.name === 'mutate') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'mutate blocks must be inside an "on success" block',
        span: stmt.span
      });
      return;
    }
    if (stmt.name === 'let' || stmt.name === 'var' || stmt.name === 'variable') {
      addVariableEntryDsl(stmt.labels, buildVariableFromStatements(stmt, ctx), obj, ctx, { useBareKey: true });
      return;
    }

    const child = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    if (stmt.labels.length > 0) {
      applyLabelField(child, 'id', stmt.labels[0], ctx.diagnostics, stmt);
    }
    if (stmt.labels.length > 1) {
      applyLabelField(child, 'name', stmt.labels[1], ctx.diagnostics, stmt);
    }
    setObjectValue(obj, stmt.name, child);
    return;
  }

  if (stmt.type === 'rel' || stmt.type === 'mutate') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `${stmt.type} statements must be inside an "on success" block`,
      span: stmt.span
    });
    return;
  }

  if (stmt.type === 'predicate' || stmt.type === 'in' || stmt.type === 'from') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `"${stmt.type}" statement is not valid at action scope`,
      span: stmt.span
    });
  }
}

export function applyActionActorBlock(stmt: BlockNode, obj: Record<string, unknown>, ctx: ActionContext): void {
  const actor = ensureActionActor(obj);
  if (stmt.labels.length === 0) {
    actor.selection = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    return;
  }

  const mode = stmt.labels[0];
  if (mode === 'choose' || mode === 'selection') {
    const selection = buildActionSelectionFromBlock(stmt, ctx, 'actor');
    if (selection) {
      if (ctx.actorDefined) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'actor selection already defined',
          span: stmt.span
        });
        return;
      }
      ctx.actorDefined = true;
      ctx.bindings.set('actor', '$actor');
      actor.selection = selection;
    }
    return;
  }

  if (mode === 'when' || mode === 'conditions') {
    const conditions = buildConditionsFromStatements(stmt.body, ctx);
    if (conditions.length > 0) {
      actor.conditions = conditions;
    } else {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'actor when block requires at least one condition',
        span: stmt.span
      });
    }
    return;
  }

  if (mode === 'instigator') {
    if (ctx.instigatorDefined) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'instigator already defined',
        span: stmt.span
      });
      return;
    }
    const instigator = buildActionInstigatorFromBlock(stmt, ctx);
    if (instigator) {
      ctx.instigatorDefined = true;
      ctx.bindings.set('instigator', '$instigator');
      actor.instigator = instigator;
    }
    return;
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported actor block "${mode}"`,
    span: stmt.span
  });
}

export function buildActionFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const ctx: ActionContext = {
    bindings: new Map(),
    diagnostics,
    parent,
    selectionDefined: false,
    actorDefined: false,
    targetDefined: false,
    instigatorDefined: false
  };
  ctx.bindings.set('actor', '$actor');
  ctx.bindings.set('target', '$target');

  for (const stmt of statements) {
    applyActionStatement(stmt, obj, ctx);
  }

  if (!Object.prototype.hasOwnProperty.call(obj, 'enabled')) {
    obj.enabled = true;
  }

  return obj;
}

export function parsePressureModifier(value: Value, ctx: ActionContext): Record<string, unknown> | null {
  const tokens = valueToTokenList(value, ctx, ctx.parent.span);
  if (!tokens || tokens.length < 2) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure_modifier requires: pressure_modifier <pressure> <multiplier>',
      span: ctx.parent.span
    });
    return null;
  }
  const [pressure, multiplier] = tokens;
  if (typeof pressure !== 'string' || typeof multiplier !== 'number') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure_modifier requires a pressure id and numeric multiplier',
      span: ctx.parent.span
    });
    return null;
  }
  return { pressure, multiplier };
}

export function buildMutationListFromStatements(
  statements: StatementNode[],
  ctx: GeneratorContext,
  options: { requireMutateBlock?: boolean } = {}

export function parseMutationStatement(
  stmt: StatementNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  if (stmt.type === 'block') {
    if (stmt.name === 'conditional' || stmt.name === 'if') {
      return parseConditionalActionBlock(stmt, ctx);
    }
    if (stmt.name === 'for_each_related') {
      return parseForEachRelatedActionBlock(stmt, ctx);
    }
    return null;
  }

  if (stmt.type !== 'attribute') {
    return null;
  }

  const tokens = tokensFromAttribute(stmt, ctx);
  if (!tokens || tokens.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `${stmt.key} mutation requires arguments`,
      span: stmt.span
    });
    return null;
  }

  if (stmt.key === 'tag') {
    return parseTagMutationTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'status') {
    return parseStatusMutationTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'prominence') {
    return parseProminenceMutationTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'pressure') {
    return parsePressureMutationTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'relationship') {
    return parseRelationshipMutationTokens(tokens, ctx, stmt.span);
  }
  if (stmt.key === 'rate_limit') {
    const op = tokens[0];
    if (op !== 'update' || tokens.length > 1) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'rate_limit only supports: rate_limit update',
        span: stmt.span
      });
      return null;
    }
    return { type: 'update_rate_limit' };
  }

  return null;
}

export function parseRelationshipMutationTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  if (op === 'create') {
    const kind = tokens[1];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship create requires a relationship kind',
        span
      });
      return null;
    }
    const src = tokens[2];
    const dst = tokens[3];
    if (typeof src !== 'string' || typeof dst !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship create requires: relationship create <kind> <src> <dst> [key value]...',
        span
      });
      return null;
    }
    const extras = parseInlineKeyValueTokenPairs(tokens.slice(4), ctx, span, 'relationship create');
    if (extras === null) return null;
    const mutation: Record<string, unknown> = {
      type: 'create_relationship',
      kind,
      src: normalizeRefName(src, ctx),
      dst: normalizeRefName(dst, ctx),
      ...extras
    };
    normalizeRefsInObject(mutation, ctx);
    return mutation;
  }

  if (op === 'adjust') {
    const kind = tokens[1];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship adjust requires a relationship kind',
        span
      });
      return null;
    }
    const src = tokens[2];
    const dst = tokens[3];
    if (typeof src !== 'string' || typeof dst !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship adjust requires: relationship adjust <kind> <src> <dst> <delta>',
        span
      });
      return null;
    }
    const rest = tokens.slice(4);
    let delta: number | undefined;
    let remaining = rest;
    if (typeof rest[0] === 'number') {
      delta = rest[0];
      remaining = rest.slice(1);
    } else if (rest[0] === 'delta' && typeof rest[1] === 'number') {
      delta = rest[1];
      remaining = rest.slice(2);
    }
    if (delta === undefined) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship adjust requires a numeric delta',
        span
      });
      return null;
    }
    const extras = parseInlineKeyValueTokenPairs(remaining, ctx, span, 'relationship adjust');
    if (extras === null) return null;
    const mutation: Record<string, unknown> = {
      type: 'adjust_relationship_strength',
      kind,
      src: normalizeRefName(src, ctx),
      dst: normalizeRefName(dst, ctx),
      delta,
      ...extras
    };
    normalizeRefsInObject(mutation, ctx);
    return mutation;
  }

  if (op === 'archive') {
    const entity = tokens[1];
    const kind = tokens[2];
    if (typeof entity !== 'string' || typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship archive requires: relationship archive <entity> <kind> [with <entity>] [all] [direction <dir>]',
        span
      });
      return null;
    }
    let withValue: string | undefined;
    let direction: string | undefined;
    let forceAll = false;
    let idx = 3;
    while (idx < tokens.length) {
      const token = tokens[idx];
      const value = tokens[idx + 1];
      if (token === 'with' && typeof value === 'string') {
        withValue = normalizeRefName(value, ctx);
        idx += 2;
        continue;
      }
      if (token === 'all') {
        forceAll = true;
        idx += 1;
        continue;
      }
      if (token === 'direction' && typeof value === 'string') {
        direction = value;
        idx += 2;
        continue;
      }
      if (typeof token === 'string' && isRelationshipDirection(token)) {
        direction = token;
        idx += 1;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported relationship archive token "${String(token)}"`,
        span
      });
      return null;
    }
    if (forceAll && withValue) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship archive does not support both "with" and "all"',
        span
      });
      return null;
    }
    const mutation: Record<string, unknown> = {
      type: forceAll ? 'archive_all_relationships' : 'archive_relationship',
      entity: normalizeRefName(entity, ctx),
      relationshipKind: kind
    };
    if (withValue) mutation.with = withValue;
    if (direction) mutation.direction = direction;
    normalizeRefsInObject(mutation, ctx);
    return mutation;
  }

  if (op === 'transfer') {
    const kind = tokens[1];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship transfer requires a relationship kind',
        span
      });
      return null;
    }
    const entity = tokens[2];
    if (typeof entity !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship transfer requires: relationship transfer <kind> <entity> from <from> to <to>',
        span
      });
      return null;
    }
    const remaining = tokens.slice(3);
    const action = parseTransferRelationshipTokens(kind, entity, remaining, ctx, span);
    if (action) {
      normalizeRefsInObject(action, ctx);
    }
    return action;
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported relationship mutation "${String(op)}"`,
    span
  });
  return null;
}

export function buildActionMutationFromAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,

export function parseArchiveRelationship(
  tokens: unknown[],
  ctx: ActionContext,
  span: BlockNode['span'],
  allowAll: boolean = false
): Record<string, unknown> | null {
  const [entity, kind, withToken, maybeDirection, maybeValue] = tokens;
  if (typeof entity !== 'string' || typeof kind !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: allowAll
        ? 'archive_all_relationships requires: archive_all_relationships <entity> <kind> [direction <dir>]'
        : 'archive_relationship requires: archive_relationship <entity> <kind> <with> [direction <dir>]',
      span
    });
    return null;
  }

  const result: Record<string, unknown> = {
    entity: normalizeRefName(entity, ctx),
    relationshipKind: kind
  };

  if (!allowAll) {
    if (typeof withToken !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'archive_relationship requires a target reference',
        span
      });
      return null;
    }
    result.with = normalizeRefName(withToken, ctx);
  }

  const label = allowAll ? withToken : maybeDirection;
  const value = allowAll ? maybeDirection : maybeValue;
  if (label === 'direction' && typeof value === 'string') {
    result.direction = value;
  }

  return result;
}

export function applyActionProminence(
  value: Value,
  obj: Record<string, unknown>,
  ctx: ActionContext
): void {
  const tokens = valueToTokenList(value, ctx, ctx.parent.span);
  if (!tokens || tokens.length < 3) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence requires: prominence <actor|target> success <value> failure <value>',
      span: ctx.parent.span
    });
    return;
  }
  const target = tokens[0];
  if (target !== 'actor' && target !== 'target') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence requires actor or target',
      span: ctx.parent.span
    });
    return;
  }
  const outcome = ensureActionOutcome(obj);
  const deltaKey = target === 'actor' ? 'actorProminenceDelta' : 'targetProminenceDelta';
  const delta = isRecord(outcome[deltaKey]) ? (outcome[deltaKey]) : {};

  let idx = 1;
  while (idx < tokens.length) {
    if (tokens[idx] === 'on') {
      idx += 1;
      continue;
    }
    const label = tokens[idx];
    const amount = tokens[idx + 1];
    if ((label === 'success' || label === 'failure') && typeof amount === 'number') {
      const field = label === 'success' ? 'onSuccess' : 'onFailure';
      delta[field] = amount;
      idx += 2;
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence requires success/failure entries with numeric values',
      span: ctx.parent.span
    });
    return;
  }

  outcome[deltaKey] = delta;
}

export function applyLabeledAttributeDsl(
  stmt: Extract<StatementNode, { type: 'attribute' }>,

export function addCreationEntryDsl(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): void {
  const label = labels[0];
  if (!label) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'create requires an entity label',
      span: ctx.parent.span
    });
    return;
  }
  const normalizedLabel = normalizeDeclaredBinding(label, ctx);
  if (!normalizedLabel) return;

  const value = isRecord(rawValue)
    ? rawValue
    : parseInlineKeyValuePairs(rawValue, ctx.diagnostics, ctx.parent, 'create');
  if (!value) return;

  value.entityRef = normalizedLabel;
  normalizeRefsInObject(value, ctx);
  normalizeTagMapField(value, 'tags', ctx.diagnostics, ctx.parent.span);
  pushArrayValue(obj, 'creation', value);
}

export function normalizeTagMapField(
  obj: Record<string, unknown>,
  key: string,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): void {
  if (!(key in obj)) return;
  const raw = obj[key];
  if (raw === 'none') {
    obj[key] = {};
    return;
  }
  if (typeof raw === 'string') {
    obj[key] = { [raw]: true };
    return;
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      obj[key] = {};
      return;
    }
    const tags: Record<string, boolean> = {};
    for (const entry of raw) {
      if (typeof entry !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: `${key} must be a list of identifiers`,
          span
        });
        return;
      }
      tags[entry] = true;
    }
    obj[key] = tags;
    return;
  }
  if (isRecord(raw)) {
    const entries = Object.entries(raw);
    if (!entries.every(([, value]) => value === true)) {
      diagnostics.push({
        severity: 'error',
        message: `${key} must map identifiers to true`,
        span
      });
    }
    return;
  }
  diagnostics.push({
    severity: 'error',
    message: `${key} must be a list of identifiers`,
    span
  });
}

export function addRelationshipEntryDsl(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): void {
  const [kind, src, dst] = labels;
  if (!kind || !src || !dst) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'relationship requires labels: <kind> <src> <dst>',
      span: ctx.parent.span
    });
    return;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : parseInlineKeyValuePairs(rawValue, ctx.diagnostics, ctx.parent, 'relationship');
  if (!value) return;

  const normalizedSrc = resolveRequiredRefName(src, ctx, ctx.parent.span, 'src');
  const normalizedDst = resolveRequiredRefName(dst, ctx, ctx.parent.span, 'dst');
  if (!normalizedSrc || !normalizedDst) return;

  value.kind = kind;
  value.src = normalizedSrc;
  value.dst = normalizedDst;
  if (value.strength === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'relationship requires explicit strength',
      span: ctx.parent.span
    });
  }

  normalizeRefsInObject(value, ctx);
  pushArrayValue(obj, 'relationships', value);
}

export function addVariableEntryDsl(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext,
  options: { useBareKey?: boolean } = {}


export function applyActionLabeledAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,

export function applyActionOutcomeBlock(stmt: BlockNode, obj: Record<string, unknown>, ctx: ActionContext): void {
  const mode = stmt.labels[0];
  if (mode !== 'success') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'only "on success" blocks are supported for actions',
      span: stmt.span
    });
    return;
  }

  const mutations = buildActionMutationsFromStatements(stmt.body, ctx);
  if (mutations.length > 0) {
    const outcome = ensureActionOutcome(obj);
    outcome.mutations = mutations;
  }
}

export function applyActionTargetBlock(stmt: BlockNode, obj: Record<string, unknown>, ctx: ActionContext): void {
  if (stmt.labels.length === 0) {
    obj.targeting = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    return;
  }
  const mode = stmt.labels[0];
  if (mode !== 'choose' && mode !== 'selection') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported target block "${mode}"`,
      span: stmt.span
    });
    return;
  }

  const selection = buildActionSelectionFromBlock(stmt, ctx, 'target');
  if (selection) {
    if (ctx.targetDefined) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'target selection already defined',
        span: stmt.span
      });
      return;
    }
    ctx.targetDefined = true;
    ctx.bindings.set('target', '$target');
    if (typeof selection.maxResults === 'number' && selection.maxResults > 1) {
      const maxResults = Math.floor(selection.maxResults);
      for (let index = 2; index <= maxResults; index += 1) {
        ctx.bindings.set(`target${index}`, `$target${index}`);
      }
    }
    obj.targeting = selection;
  }
}

export function buildActionInstigatorFromBlock(stmt: BlockNode, ctx: ActionContext): Record<string, unknown> | null {
  const variable = buildVariableFromStatements(stmt, ctx, { requirePickStrategy: false });
  const select = variable.select;
  if (!isRecord(select)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'instigator selection must be an object',
      span: stmt.span
    });
    return null;
  }
  const instigator = { ...select };
  if (variable.required !== undefined) {
    instigator.required = variable.required;
  }
  return instigator;
}

export function buildActionMutationsFromStatements(
  statements: StatementNode[],
  ctx: ActionContext
): Record<string, unknown>[] {
  return buildMutationListFromStatements(statements, ctx, { requireMutateBlock: true });
}

export function buildActionPressureMutation(
  stmt: Extract<StatementNode, { type: 'mutate' }>,

export function buildActionRelationshipMutation(
  stmt: Extract<StatementNode, { type: 'rel' }>,

export function buildActionSelectionFromBlock(
  stmt: BlockNode,
  ctx: ActionContext,
  bindingName: string
): Record<string, unknown> | null {
  const kind = parseActionSelectionKind(stmt.labels, ctx, stmt.span);
  if (!kind) return null;
  const chooseBlock: BlockNode = {
    ...stmt,
    name: 'choose',
    labels: [bindingName, 'from', kind]
  };
  const { selection } = buildSelectionFromStatements(chooseBlock, ctx, { requirePickStrategy: false });
  if (!selection) return null;
  normalizeRefsInObject(selection, ctx);
  return selection;
}

export function ensureActionActor(obj: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(obj.actor)) {
    obj.actor = {};
  }
  return obj.actor as Record<string, unknown>;
}

export function ensureActionOutcome(obj: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(obj.outcome)) {
    obj.outcome = {};
  }
  return obj.outcome as Record<string, unknown>;
}

export function ensureActionProbability(obj: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(obj.probability)) {
    obj.probability = {};
  }
  return obj.probability as Record<string, unknown>;
}

export function parseActionSelectionKind(
  labels: string[],
  ctx: ActionContext,
  span: BlockNode['span']
): string | null {
  if (labels.length < 2) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'selection requires a kind label',
      span
    });
    return null;
  }
  const mode = labels[0];
  if (mode !== 'choose' && mode !== 'selection') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported selection mode "${mode}"`,
      span
    });
    return null;
  }
  const rest = labels.slice(1);
  if (rest[0] === 'from') {
    return rest[1] || null;
  }
  if (rest[1] === 'from') {
    return rest[2] || null;
  }
  return rest[0] || null;
}

export function parseInlineKeyValueTokenPairs(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span'],
  context: string
): Record<string, unknown> | null {
  if (tokens.length === 0) return {};
  if (tokens.length % 2 !== 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `${context} entries must use key value pairs`,
      span
    });
    return null;
  }
  const obj: Record<string, unknown> = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (typeof key !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${context} keys must be identifiers`,
        span
      });
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${context} key "${key}" is duplicated`,
        span
      });
      return null;
    }
    obj[key] = value;
  }
  return obj;
}

export function parseMutateBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown>[] {
  const mutations: Record<string, unknown>[] = [];
  for (const child of stmt.body) {
    if (child.type === 'block' && child.name === 'mutate') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'nested mutate blocks are not supported',
        span: child.span
      });
      continue;
    }
    const mutation = parseMutationStatement(child, ctx);
    if (mutation) {
      mutations.push(mutation);
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: child.type === 'attribute'
        ? `Unsupported mutation "${child.key}"`
        : `Unsupported mutation statement "${child.type}"`,
      span: child.span
    });
  }
  return mutations;
}

export function parsePressureMutationTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const pressureId = tokens[1];
  const delta = tokens[2];
  if (op !== 'modify' || typeof pressureId !== 'string' || typeof delta !== 'number') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure modify requires: pressure modify <pressure> <delta>',
      span
    });
    return null;
  }
  return {
    type: 'modify_pressure',
    pressureId,
    delta
  };
}

export function parseProminenceMutationTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const entity = tokens[1];
  const delta = tokens[2];
  if (op !== 'adjust' || typeof entity !== 'string' || typeof delta !== 'number') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence adjust requires: prominence adjust <entity> <delta>',
      span
    });
    return null;
  }
  return {
    type: 'adjust_prominence',
    entity: normalizeRefName(entity, ctx),
    delta
  };
}

export function parseStatusMutationTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  const entity = tokens[1];
  const status = tokens[2];
  if (op !== 'change' || typeof entity !== 'string' || typeof status !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'status change requires: status change <entity> <status>',
      span
    });
    return null;
  }
  return {
    type: 'change_status',
    entity: normalizeRefName(entity, ctx),
    newStatus: status
  };
}

export function parseTagMutationTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const op = tokens[0];
  if (op === 'set') {
    const entity = tokens[1];
    const tag = tokens[2];
    if (typeof entity !== 'string' || typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'tag set requires: tag set <entity> <tag> [value] [from <ref>]',
        span
      });
      return null;
    }
    const mutation: Record<string, unknown> = {
      type: 'set_tag',
      entity: normalizeRefName(entity, ctx),
      tag
    };
    const parsed = parseTagValue(tokens.slice(3), ctx as ActionContext, span);
    if (parsed.value !== undefined) mutation.value = parsed.value;
    if (parsed.valueFrom !== undefined) mutation.valueFrom = parsed.valueFrom;
    normalizeRefsInObject(mutation, ctx);
    return mutation;
  }
  if (op === 'remove') {
    const entity = tokens[1];
    const tag = tokens[2];
    if (typeof entity !== 'string' || typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'tag remove requires: tag remove <entity> <tag>',
        span
      });
      return null;
    }
    return {
      type: 'remove_tag',
      entity: normalizeRefName(entity, ctx),
      tag
    };
  }
  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported tag mutation "${String(op)}"`,
    span
  });
  return null;
}

export function parseTagValue(
  tokens: unknown[],
  ctx: ActionContext,
  span: BlockNode['span']
): { value?: unknown; valueFrom?: string } {

export function parseTransferRelationshipTokens(
  relationshipKind: string,
  entity: string,
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length < 4 || tokens[0] !== 'from' || tokens[2] !== 'to') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'relationship transfer requires: relationship transfer <kind> <entity> from <from> to <to>',
      span
    });
    return null;
  }
  const from = tokens[1];
  const to = tokens[3];
  if (typeof from !== 'string' || typeof to !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'relationship transfer requires from/to references',
      span
    });
    return null;
  }

  const action: Record<string, unknown> = {
    type: 'transfer_relationship',
    entity: normalizeRefName(entity, ctx),
    relationshipKind,
    from: normalizeRefName(from, ctx),
    to: normalizeRefName(to, ctx)
  };

  if (tokens.length > 4) {
    const keyword = tokens[4];
    const rest = tokens.slice(5);
    if (keyword !== 'if' && keyword !== 'when') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship transfer only supports an optional if/when condition',
        span
      });
      return null;
    }
    const condition = parseSystemConditionTokens(rest, ctx, span);
    if (!condition) return null;
    action.condition = condition;
  }

  return action;
}

export function tokensFromAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,
