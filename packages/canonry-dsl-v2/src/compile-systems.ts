import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
} from './types.js';

import type { GeneratorContext, SystemParseResult } from './compile-types.js';
import { SYSTEM_BINDINGS } from './compile-types.js';
import { isRecord, flattenTokenList, setObjectValue } from './compile-utils.js';
import { valueToJson } from './compile-variables.js';
import { normalizeRefsInObject, normalizeDeclaredBinding } from './compile-objects.js';
import { parseSystemConditionStatement, buildSystemConditionStatements, buildSystemConditionGroup, parseGraphPathBlock, parseStringListValue, valueToTokenList } from './compile-conditions.js';
import { buildSelectionFromStatements, buildVariableFromStatements, addVariableEntryDsl } from './compile-generators.js';

export function buildSystemItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  if (block.labels.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'system block requires: system <systemType> <id> ["name"]',
      span: block.span
    });
    return null;
  }

  const [systemType, idLabel, nameLabel] = block.labels;
  const metadataStatements = block.body.filter(
    (stmt) => stmt.type === 'attribute' && stmt.key.startsWith('_')
  );
  const systemStatements = metadataStatements.length > 0
    ? block.body.filter((stmt) => !(stmt.type === 'attribute' && stmt.key.startsWith('_')))
    : block.body;
  const metadata = metadataStatements.length > 0
    ? buildObjectFromStatements(metadataStatements, diagnostics, block)
    : {};

  const hasConfig = systemStatements.some((stmt) =>
    (stmt.type === 'attribute' && stmt.key === 'config')
    || (stmt.type === 'block' && stmt.name === 'config')
  );

  if (!hasConfig) {
    const ctx = createSystemContext(diagnostics, block);
    const parsed = buildSystemConfigFromStatements(systemType, systemStatements, ctx);
    if (!parsed) return null;

    const { config, enabled } = parsed;
    if (config.id !== undefined) {
      diagnostics.push({
        severity: 'error',
        message: 'system config.id must be provided via the system block label',
        span: block.span
      });
      return null;
    }
    if (config.name !== undefined) {
      diagnostics.push({
        severity: 'error',
        message: 'system config.name must be provided via the system block label',
        span: block.span
      });
      return null;
    }

    const finalConfig = {
      ...config,
      id: idLabel,
      ...(nameLabel ? { name: nameLabel } : {})
    };

    return {
      systemType,
      config: finalConfig,
      ...(enabled !== undefined ? { enabled } : {}),
      ...metadata
    };
  }

  const rawBody = buildObjectFromStatements(systemStatements, diagnostics, block);
  const configFromBody = (rawBody.config && typeof rawBody.config === 'object' && !Array.isArray(rawBody.config))
    ? (rawBody.config as Record<string, unknown>)
    : { ...rawBody };

  if (!rawBody.config && rawBody.enabled !== undefined) {
    delete configFromBody.enabled;
  }

  const configId = configFromBody.id;
  if (configId !== undefined) {
    if (typeof configId !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'system config.id must be a string',
        span: block.span
      });
      return null;
    }
    if (configId !== idLabel) {
      diagnostics.push({
        severity: 'error',
        message: `system id mismatch: label "${idLabel}" vs config.id "${configId}"`,
        span: block.span
      });
      return null;
    }
  }

  const configName = configFromBody.name;
  if (nameLabel && configName !== undefined) {
    if (typeof configName !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'system config.name must be a string',
        span: block.span
      });
      return null;
    }
    if (configName !== nameLabel) {
      diagnostics.push({
        severity: 'error',
        message: `system name mismatch: label "${nameLabel}" vs config.name "${configName}"`,
        span: block.span
      });
      return null;
    }
  }

  const config = {
    ...configFromBody,
    id: idLabel,
    ...(nameLabel ? { name: nameLabel } : {})
  };

  const enabled = rawBody.enabled;

  return {
    systemType,
    config,
    ...(enabled !== undefined ? { enabled } : {}),
    ...metadata
  };
}

export function createSystemContext(diagnostics: Diagnostic[], parent: BlockNode): GeneratorContext {
  const bindings = new Map<string, string>();
  for (const name of SYSTEM_BINDINGS) {
    bindings.set(name, `$${name}`);
  }
  return {
    bindings,
    diagnostics,
    parent,
    selectionDefined: false
  };
}

export function buildSystemConfigFromStatements(
  systemType: string,
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  switch (systemType) {
    case 'thresholdTrigger':
      return buildThresholdTriggerSystem(statements, ctx);
    case 'connectionEvolution':
      return buildConnectionEvolutionSystem(statements, ctx);
    case 'clusterFormation':
      return buildClusterFormationSystem(statements, ctx);
    case 'graphContagion':
      return buildGraphContagionSystem(statements, ctx);
    case 'planeDiffusion':
      return buildPlaneDiffusionSystem(statements, ctx);
    case 'tagDiffusion':
      return buildTagDiffusionSystem(statements, ctx);
    case 'eraSpawner':
      return buildEraSpawnerSystem(statements, ctx);
    case 'eraTransition':
      return buildEraTransitionSystem(statements, ctx);
    case 'universalCatalyst':
      return buildUniversalCatalystSystem(statements, ctx);
    case 'relationshipMaintenance':
      return buildRelationshipMaintenanceSystem(statements, ctx);
    default:
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported system type "${systemType}"`,
        span: ctx.parent.span
      });
      return null;
  }
}

export function applySystemCommonAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,

export function parseSystemSelectionBlock(stmt: BlockNode, ctx: GeneratorContext): Record<string, unknown> | null {
  const { selection } = buildSelectionFromStatements(stmt, ctx, { requirePickStrategy: false });
  if (!selection) return null;
  normalizeRefsInObject(selection, ctx);
  return selection;
}

export function applyPressureChangeValue(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span'],
  pressureChanges: Record<string, unknown>
): boolean {
  const tokens = valueToTokenList(value, ctx, span);
  if (!tokens || tokens.length < 2) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure requires: pressure <id> <delta>',
      span
    });
    return false;
  }
  const id = tokens[0];
  const delta = tokens[1];
  if (typeof id !== 'string' || typeof delta !== 'number') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure requires a pressure id and numeric delta',
      span
    });
    return false;
  }
  if (tokens.length > 2) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure only supports a single delta value',
      span
    });
    return false;
  }
  pressureChanges[id] = delta;
  return true;
}

export function buildPickerFromStatements(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const picker: Record<string, unknown> = {};
  for (const child of stmt.body) {
    if (child.type === 'block') {
      if (child.name === 'where') {
        const filters = parseWhereBlock(child, ctx);
        for (const filter of filters) {
          pushArrayValue(picker, 'filters', filter);
        }
        continue;
      }
      if (child.name === 'prefer') {
        const filters = parseWhereBlock(child, ctx);
        for (const filter of filters) {
          pushArrayValue(picker, 'preferFilters', filter);
        }
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported picker block "${child.name}"`,
        span: child.span
      });
      continue;
    }

    if (child.type === 'attribute') {
      const value = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      if (child.key === 'filter' || child.key === 'filters' || child.key === 'prefer' || child.key === 'preferFilters') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'filters must be declared inside a where/prefer block',
          span: child.span
        });
        continue;
      }
      if (child.key === 'pick') {
        picker.pickStrategy = value;
        continue;
      }
      if (child.key === 'max') {
        picker.maxResults = value;
        continue;
      }
      picker[child.key] = value;
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported picker statement "${child.type}"`,
      span: child.span
    });
  }

  if (picker.pickStrategy === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'picker requires explicit pick strategy',
      span: stmt.span
    });
  }

  normalizeRefsInObject(picker, ctx);
  return picker;
}

export function parseMetricBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const metricType = stmt.labels[0];
  if (!metricType) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'metric requires a type label',
      span: stmt.span
    });
    return null;
  }

  const metric: Record<string, unknown> = { type: metricType };

  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'metric only supports attribute statements',
        span: child.span
      });
      continue;
    }
    let value;
    if (child.value === null && child.labels && child.labels.length > 0) {
      value = child.labels.length === 1 ? child.labels[0] : child.labels.slice();
    } else {
      value = valueToJson(child.value, ctx.diagnostics, ctx.parent);
    }
    if (metricType === 'shared_relationship') {
      if (child.key === 'relationship' || child.key === 'relationship_kind' || child.key === 'relationshipKind') {
        metric.sharedRelationshipKind = value;
        continue;
      }
      if (child.key === 'direction' || child.key === 'sharedDirection') {
        metric.sharedDirection = value;
        continue;
      }
      if (child.key === 'via_relationship' || child.key === 'viaRelationship') {
        metric.viaRelationship = value;
        continue;
      }
      if (child.key === 'via') {
        const tokens = valueToTokenList(child.value, ctx, child.span);
        if (!tokens) continue;
        let relationshipKind: string | undefined;
        let direction: string | undefined;
        let intermediateKind: string | undefined;
        let idx = 0;
        while (idx < tokens.length) {
          const token = tokens[idx];
          const tokenValue = tokens[idx + 1];
          if ((token === 'relationship' || token === 'relationship_kind' || token === 'relationshipKind')
            && typeof tokenValue === 'string') {
            relationshipKind = tokenValue;
            idx += 2;
            continue;
          }
          if (token === 'direction' && typeof tokenValue === 'string') {
            direction = tokenValue;
            idx += 2;
            continue;
          }
          if ((token === 'intermediate_kind' || token === 'intermediateKind') && typeof tokenValue === 'string') {
            intermediateKind = tokenValue;
            idx += 2;
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: `Unsupported via token "${String(token)}" for shared_relationship metric`,
            span: child.span
          });
          return null;
        }
        if (!relationshipKind || !direction || !intermediateKind) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'via requires: via relationship <kind> direction <dir> intermediate_kind <kind>',
            span: child.span
          });
          return null;
        }
        metric.via = { relationshipKind, direction, intermediateKind };
        continue;
      }
    }
    if (metricType === 'connection_count') {
      if (child.key === 'relationships' || child.key === 'relationshipKinds' || child.key === 'relationship') {
        const list = normalizeStringList(value, ctx.diagnostics, ctx.parent, 'relationships');
        if (list) metric.relationshipKinds = list;
        continue;
      }
      if (child.key === 'direction') {
        metric.direction = value;
        continue;
      }
      if (child.key === 'min_strength' || child.key === 'minStrength') {
        metric.minStrength = value;
        continue;
      }
    }
    if (metricType === 'neighbor_prominence') {
      if (child.key === 'direction') {
        metric.direction = value;
        continue;
      }
      if (child.key === 'min_strength' || child.key === 'minStrength') {
        metric.minStrength = value;
        continue;
      }
    }
    if (metricType === 'neighbor_kind_count') {
      if (child.key === 'kind') {
        metric.kind = value;
        continue;
      }
      if (child.key === 'via') {
        const list = normalizeStringList(value, ctx.diagnostics, ctx.parent, 'via');
        if (list) metric.via = list;
        continue;
      }
      if (child.key === 'via_direction' || child.key === 'viaDirection') {
        metric.viaDirection = value;
        continue;
      }
      if (child.key === 'then') {
        metric.then = value;
        continue;
      }
      if (child.key === 'then_direction' || child.key === 'thenDirection') {
        metric.thenDirection = value;
        continue;
      }
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported metric attribute "${child.key}" for ${metricType}`,
      span: child.span
    });
  }

  return metric;
}

export function parseRuleBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const rule: Record<string, unknown> = {};
  let action: Record<string, unknown> | null = null;

  for (const child of stmt.body) {
    if (child.type === 'attribute') {
      if (child.key === 'threshold') {
        const tokens = valueToTokenList(child.value, ctx, child.span);
        if (!tokens || tokens.length < 2) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'threshold requires: threshold <op> <value>',
            span: child.span
          });
          continue;
        }
        const op = parseOperatorKeyword(tokens[0], ctx, child.span);
        if (op === 'between') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'threshold does not support between',
            span: child.span
          });
          continue;
        }
        const threshold = tokens[1];
        if (!op || typeof threshold !== 'number') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'threshold requires an operator keyword and numeric value',
            span: child.span
          });
          continue;
        }
        const reverseOpMap: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
        const operator = reverseOpMap[op] ?? '==';
        rule.condition = { operator, threshold };
        continue;
      }
      if (child.key === 'probability') {
        rule.probability = valueToJson(child.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      if (child.key === 'between_matching' || child.key === 'betweenMatching') {
        rule.betweenMatching = valueToJson(child.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported rule attribute "${child.key}"`,
        span: child.span
      });
      continue;
    }

    if (child.type === 'block' && child.name === 'action') {
      const actions = buildSystemActionListFromStatements(child.body, ctx);
      if (actions.length !== 1) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'rule action block requires exactly one action',
          span: child.span
        });
        continue;
      }
      if (action) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'rule already has an action',
          span: child.span
        });
        continue;
      }
      action = actions[0];
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported rule statement "${child.type}"`,
      span: child.span
    });
  }

  if (action) {
    rule.action = action;
  }

  return rule;
}

export function parseClusteringBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const clustering: Record<string, unknown> = {};
  const criteria: Record<string, unknown>[] = [];

  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'clustering only supports attribute statements',
        span: child.span
      });
      continue;
    }
    if (child.key === 'criterion' || child.key === 'criteria') {
      const tokens = valueToTokenList(child.value, ctx, child.span);
      if (!tokens || tokens.length < 2 || typeof tokens[0] !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'criterion requires: criterion <type> <weight> ...',
          span: child.span
        });
        continue;
      }
      const type = tokens[0];
      const weight = tokens[1];
      if (typeof weight !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'criterion weight must be numeric',
          span: child.span
        });
        continue;
      }
      const criterion: Record<string, unknown> = { type, weight };
      if (type === 'shared_relationship') {
        const relationshipKind = tokens[2];
        const direction = tokens[3];
        if (typeof relationshipKind !== 'string' || typeof direction !== 'string') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'shared_relationship criterion requires relationship kind and direction',
            span: child.span
          });
          continue;
        }
        criterion.relationshipKind = relationshipKind;
        criterion.direction = direction;
      } else if (type === 'shared_tags' || type === 'temporal_proximity') {
        const threshold = tokens[2];
        if (typeof threshold !== 'number') {
          ctx.diagnostics.push({
            severity: 'error',
            message: `${type} criterion requires a numeric threshold`,
            span: child.span
          });
          continue;
        }
        criterion.threshold = threshold;
      } else if (type !== 'same_culture') {
        ctx.diagnostics.push({
          severity: 'error',
          message: `Unsupported clustering criterion "${type}"`,
          span: child.span
        });
        continue;
      }
      criteria.push(criterion);
      continue;
    }

    const value = valueToJson(child.value, ctx.diagnostics, ctx.parent);
    if (child.key === 'min_size' || child.key === 'minSize') {
      clustering.minSize = value;
      continue;
    }
    if (child.key === 'max_size' || child.key === 'maxSize') {
      clustering.maxSize = value;
      continue;
    }
    if (child.key === 'minimum_score' || child.key === 'minimumScore') {
      clustering.minimumScore = value;
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported clustering attribute "${child.key}"`,
      span: child.span
    });
  }

  if (criteria.length > 0) {
    clustering.criteria = criteria;
  }

  return clustering;
}

export function parseProminenceFromSizeTokens(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, number> | null {
  const tokens = valueToTokenList(value, ctx, span);
  if (!tokens || tokens.length === 0 || tokens.length % 2 !== 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence_from_size requires pairs of <label> <value>',
      span
    });
    return null;
  }
  const result: Record<string, number> = {};
  for (let i = 0; i < tokens.length; i += 2) {
    const label = tokens[i];
    const valueToken = tokens[i + 1];
    if (typeof label !== 'string' || typeof valueToken !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'prominence_from_size requires label and numeric value pairs',
        span
      });
      return null;
    }
    result[label] = valueToken;
  }
  return result;
}

export function parseMetaEntityBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const meta: Record<string, unknown> = {};

  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'meta_entity only supports attribute statements',
        span: child.span
      });
      continue;
    }
    if (child.key === 'prominence_from_size') {
      const mapping = parseProminenceFromSizeTokens(child.value, ctx, child.span);
      if (mapping) meta.prominenceFromSize = mapping;
      continue;
    }
    if (child.key === 'additional_tags') {
      const tags = parseStringListValue(child.value, ctx, child.span, 'additional_tags');
      if (tags) meta.additionalTags = tags;
      continue;
    }
    const value = valueToJson(child.value, ctx.diagnostics, ctx.parent);
    if (child.key === 'kind') {
      meta.kind = value;
      continue;
    }
    if (child.key === 'subtype_from_majority' || child.key === 'subtypeFromMajority') {
      meta.subtypeFromMajority = value;
      continue;
    }
    if (child.key === 'status') {
      meta.status = value;
      continue;
    }
    if (child.key === 'description_template' || child.key === 'descriptionTemplate') {
      meta.descriptionTemplate = value;
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported meta_entity attribute "${child.key}"`,
      span: child.span
    });
  }

  if (!Object.prototype.hasOwnProperty.call(meta, 'additionalTags')) {
    meta.additionalTags = [];
  }

  return meta;
}

export function parsePostProcessBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const post: Record<string, unknown> = {};
  const pressureChanges: Record<string, unknown> = {};

  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'post_process only supports attribute statements',
        span: child.span
      });
      continue;
    }
    if (child.key === 'pressure') {
      applyPressureChangeValue(child.value, ctx, child.span, pressureChanges);
      continue;
    }
    const value = valueToJson(child.value, ctx.diagnostics, ctx.parent);
    if (child.key === 'create_governance_faction' || child.key === 'createGovernanceFaction') {
      post.createGovernanceFaction = value;
      continue;
    }
    if (child.key === 'governance_faction_subtype' || child.key === 'governanceFactionSubtype') {
      post.governanceFactionSubtype = value;
      continue;
    }
    if (child.key === 'governance_relationship' || child.key === 'governanceRelationship') {
      post.governanceRelationship = value;
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported post_process attribute "${child.key}"`,
      span: child.span
    });
  }

  if (Object.keys(pressureChanges).length > 0) {
    post.pressureChanges = pressureChanges;
  }

  return post;
}

export function buildThresholdTriggerSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };
  const conditions: Record<string, unknown>[] = [];
  const actions: Record<string, unknown>[] = [];
  let selection: Record<string, unknown> | null = null;
  const pressureChanges: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      if (stmt.key === 'cluster_mode' || stmt.key === 'clusterMode') {
        config.clusterMode = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      if (stmt.key === 'throttle' || stmt.key === 'throttleChance') {
        config.throttleChance = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      if (stmt.key === 'pressure') {
        applyPressureChangeValue(stmt.value, ctx, stmt.span, pressureChanges);
        continue;
      }
      const condition = parseSystemConditionStatement(stmt, ctx);
      if (condition) {
        conditions.push(condition);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported thresholdTrigger attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'selection' || stmt.name === 'choose') {
        if (selection) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          continue;
        }
        selection = parseSystemSelectionBlock(stmt, ctx);
        continue;
      }
      if (stmt.name === 'actions') {
        actions.push(...buildSystemActionListFromStatements(stmt.body, ctx));
        continue;
      }
      if (stmt.name === 'when' || stmt.name === 'conditions') {
        const mode = stmt.labels.find((label) =>
          label === 'any' || label === 'or' || label === 'all' || label === 'and'
        );
        if (!mode) {
          const nested = buildSystemConditionStatements(stmt.body, ctx);
          if (nested.length === 0) {
            ctx.diagnostics.push({
              severity: 'error',
              message: 'when block requires at least one condition',
              span: stmt.span
            });
          } else {
            conditions.push(...nested);
          }
          continue;
        }
        const group = buildSystemConditionGroup(stmt, ctx);
        if (group) conditions.push(group);
        continue;
      }
      if (stmt.name === 'path' || stmt.name === 'graph_path') {
        const condition = parseGraphPathBlock(stmt, ctx);
        if (condition) conditions.push(condition);
        continue;
      }
      if (stmt.name === 'let' || stmt.name === 'var' || stmt.name === 'variable') {
        addVariableEntryDsl(stmt.labels, buildVariableFromStatements(stmt, ctx, { requirePickStrategy: false }), config, ctx);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported thresholdTrigger block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported thresholdTrigger statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (selection) config.selection = selection;
  if (conditions.length > 0) config.conditions = conditions;
  if (actions.length > 0) config.actions = actions;
  if (Object.keys(pressureChanges).length > 0) config.pressureChanges = pressureChanges;

  return result;
}

export function buildConnectionEvolutionSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };
  const rules: Record<string, unknown>[] = [];
  let selection: Record<string, unknown> | null = null;
  const pressureChanges: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      if (stmt.key === 'pair_exclude' || stmt.key === 'pairExclude') {
        const list = parseStringListValue(stmt.value, ctx, stmt.span, 'pair_exclude');
        if (list) config.pairExcludeRelationships = list;
        continue;
      }
      if (stmt.key === 'pair_component_limit' || stmt.key === 'pairComponentLimit') {
        const raw = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        if (typeof raw === 'number') {
          config.pairComponentSizeLimit = raw;
          continue;
        }
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens) continue;
        const maxIndex = tokens.findIndex((token) => token === 'max');
        if (maxIndex === -1) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'pair_component_limit requires "max" keyword',
            span: stmt.span
          });
          continue;
        }
        const kinds = flattenTokenList(tokens.slice(0, maxIndex), ctx, stmt.span);
        const maxValue = tokens[maxIndex + 1];
        if (!kinds || typeof maxValue !== 'number') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'pair_component_limit requires relationship kinds and numeric max',
            span: stmt.span
          });
          continue;
        }
        config.pairComponentSizeLimit = {
          relationshipKinds: kinds,
          max: maxValue
        };
        continue;
      }
      if (stmt.key === 'throttle' || stmt.key === 'throttleChance') {
        config.throttleChance = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      if (stmt.key === 'pressure') {
        applyPressureChangeValue(stmt.value, ctx, stmt.span, pressureChanges);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported connectionEvolution attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'selection' || stmt.name === 'choose') {
        if (selection) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          continue;
        }
        selection = parseSystemSelectionBlock(stmt, ctx);
        continue;
      }
      if (stmt.name === 'metric') {
        const metric = parseMetricBlock(stmt, ctx);
        if (metric) config.metric = metric;
        continue;
      }
      if (stmt.name === 'rule') {
        const rule = parseRuleBlock(stmt, ctx);
        if (rule) rules.push(rule);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported connectionEvolution block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported connectionEvolution statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (selection) config.selection = selection;
  if (rules.length > 0) config.rules = rules;
  if (Object.keys(pressureChanges).length > 0) config.pressureChanges = pressureChanges;

  return result;
}

export function buildClusterFormationSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };
  let selection: Record<string, unknown> | null = null;

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      if (stmt.key === 'run_at_epoch_end' || stmt.key === 'runAtEpochEnd') {
        config.runAtEpochEnd = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported clusterFormation attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'selection' || stmt.name === 'choose') {
        if (selection) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          continue;
        }
        selection = parseSystemSelectionBlock(stmt, ctx);
        continue;
      }
      if (stmt.name === 'clustering') {
        const clustering = parseClusteringBlock(stmt, ctx);
        if (clustering) config.clustering = clustering;
        continue;
      }
      if (stmt.name === 'meta_entity') {
        const meta = parseMetaEntityBlock(stmt, ctx);
        if (meta) config.metaEntity = meta;
        continue;
      }
      if (stmt.name === 'master_selection') {
        const master = buildPickerFromStatements(stmt, ctx);
        if (master) config.masterSelection = master;
        continue;
      }
      if (stmt.name === 'member_updates') {
        const updates = buildSystemActionListFromStatements(stmt.body, ctx);
        if (updates.length > 0) config.memberUpdates = updates;
        continue;
      }
      if (stmt.name === 'post_process') {
        const post = parsePostProcessBlock(stmt, ctx);
        if (post) config.postProcess = post;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported clusterFormation block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported clusterFormation statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (selection) config.selection = selection;
  return result;
}

export function buildGraphContagionSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };
  const vectors: Record<string, unknown>[] = [];
  const susceptibilityModifiers: Record<string, unknown>[] = [];
  const phaseTransitions: Record<string, unknown>[] = [];
  const pressureChanges: Record<string, unknown> = {};
  let selection: Record<string, unknown> | null = null;

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      if (stmt.key === 'contagion') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 2) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'contagion requires: contagion tag|relationship <value>',
            span: stmt.span
          });
          continue;
        }
        const kind = tokens[0];
        const value = tokens[1];
        if (kind === 'tag' && typeof value === 'string') {
          config.contagion = { type: 'tag', tag: value };
          continue;
        }
        if (kind === 'relationship' && typeof value === 'string') {
          config.contagion = { type: 'relationship', relationshipKind: value };
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'contagion requires tag or relationship kind',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'vector') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 3) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'vector requires: vector <relationship> <direction> <minStrength>',
            span: stmt.span
          });
          continue;
        }
        const relationshipKind = tokens[0];
        const direction = tokens[1];
        const minStrength = tokens[2];
        if (typeof relationshipKind === 'string' && typeof direction === 'string' && typeof minStrength === 'number') {
          vectors.push({ relationshipKind, direction, minStrength });
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'vector requires relationship kind, direction, and numeric strength',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'transmission') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 3) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'transmission requires: transmission <baseRate> <contactMultiplier> <maxProbability>',
            span: stmt.span
          });
          continue;
        }
        const [baseRate, contactMultiplier, maxProbability] = tokens;
        if (typeof baseRate === 'number' && typeof contactMultiplier === 'number' && typeof maxProbability === 'number') {
          config.transmission = { baseRate, contactMultiplier, maxProbability };
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'transmission requires numeric values',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'exclude_relationships') {
        const list = parseStringListValue(stmt.value, ctx, stmt.span, 'exclude_relationships');
        if (list) config.excludeRelationships = list;
        continue;
      }
      if (stmt.key === 'throttle' || stmt.key === 'throttleChance') {
        config.throttleChance = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      if (stmt.key === 'cooldown') {
        config.cooldown = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      if (stmt.key === 'pressure') {
        applyPressureChangeValue(stmt.value, ctx, stmt.span, pressureChanges);
        continue;
      }
      if (stmt.key === 'susceptibility') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 2) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'susceptibility requires: susceptibility <tag> <modifier>',
            span: stmt.span
          });
          continue;
        }
        const tag = tokens[0];
        const modifier = tokens[1];
        if (typeof tag === 'string' && typeof modifier === 'number') {
          susceptibilityModifiers.push({ tag, modifier });
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'susceptibility requires a tag and numeric modifier',
          span: stmt.span
        });
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported graphContagion attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'selection' || stmt.name === 'choose') {
        if (selection) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          continue;
        }
        selection = parseSystemSelectionBlock(stmt, ctx);
        continue;
      }
      if (stmt.name === 'infection_action') {
        const actions = buildSystemActionListFromStatements(stmt.body, ctx);
        if (actions.length !== 1) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'infection_action requires exactly one action',
            span: stmt.span
          });
          continue;
        }
        config.infectionAction = actions[0];
        continue;
      }
      if (stmt.name === 'recovery') {
        const recovery: Record<string, unknown> = {};
        const bonuses: Record<string, unknown>[] = [];
        for (const child of stmt.body) {
          if (child.type !== 'attribute') {
            ctx.diagnostics.push({
              severity: 'error',
              message: 'recovery only supports attribute statements',
              span: child.span
            });
            continue;
          }
          if (child.key === 'base_rate' || child.key === 'baseRate') {
            recovery.baseRate = valueToJson(child.value, ctx.diagnostics, ctx.parent);
            continue;
          }
          if (child.key === 'bonus' || child.key === 'recovery_bonus') {
            const tokens = valueToTokenList(child.value, ctx, child.span);
            if (!tokens || tokens.length < 2) {
              ctx.diagnostics.push({
                severity: 'error',
                message: 'recovery bonus requires: bonus <tag> <value>',
                span: child.span
              });
              continue;
            }
            const tag = tokens[0];
            const bonus = tokens[1];
            if (typeof tag === 'string' && typeof bonus === 'number') {
              bonuses.push({ tag, bonus });
              continue;
            }
            ctx.diagnostics.push({
              severity: 'error',
              message: 'recovery bonus requires a tag and numeric value',
              span: child.span
            });
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: `Unsupported recovery attribute "${child.key}"`,
            span: child.span
          });
        }
        if (bonuses.length > 0) {
          recovery.recoveryBonusTraits = bonuses;
        }
        config.recovery = recovery;
        continue;
      }
      if (stmt.name === 'phase_transition') {
        const toStatus = stmt.labels[0];
        if (!toStatus) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'phase_transition requires a status label',
            span: stmt.span
          });
          continue;
        }
        const transition: Record<string, unknown> = { toStatus };
        for (const child of stmt.body) {
          if (child.type === 'attribute') {
            if (child.key === 'adoption_threshold' || child.key === 'adoptionThreshold') {
              transition.adoptionThreshold = valueToJson(child.value, ctx.diagnostics, ctx.parent);
              continue;
            }
            if (child.key === 'description_suffix' || child.key === 'descriptionSuffix') {
              transition.descriptionSuffix = valueToJson(child.value, ctx.diagnostics, ctx.parent);
              continue;
            }
            ctx.diagnostics.push({
              severity: 'error',
              message: `Unsupported phase_transition attribute "${child.key}"`,
              span: child.span
            });
            continue;
          }
          if (child.type === 'block' && (child.name === 'selection' || child.name === 'choose')) {
            const phaseSelection = parseSystemSelectionBlock(child, ctx);
            if (phaseSelection) transition.selection = phaseSelection;
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: `Unsupported phase_transition statement "${child.type}"`,
            span: child.span
          });
        }
        phaseTransitions.push(transition);
        continue;
      }
      if (stmt.name === 'multi_source') {
        const multi: Record<string, unknown> = {};
        for (const child of stmt.body) {
          if (child.type === 'attribute') {
            if (child.key === 'immunity_tag_prefix' || child.key === 'immunityTagPrefix') {
              multi.immunityTagPrefix = valueToJson(child.value, ctx.diagnostics, ctx.parent);
              continue;
            }
            if (child.key === 'low_adoption_threshold' || child.key === 'lowAdoptionThreshold') {
              multi.lowAdoptionThreshold = valueToJson(child.value, ctx.diagnostics, ctx.parent);
              continue;
            }
            if (child.key === 'low_adoption_status' || child.key === 'lowAdoptionStatus') {
              multi.lowAdoptionStatus = valueToJson(child.value, ctx.diagnostics, ctx.parent);
              continue;
            }
            ctx.diagnostics.push({
              severity: 'error',
              message: `Unsupported multi_source attribute "${child.key}"`,
              span: child.span
            });
            continue;
          }
          if (child.type === 'block' && (child.name === 'source_selection' || child.name === 'selection' || child.name === 'choose')) {
            const sourceSelection = parseSystemSelectionBlock(child, ctx);
            if (sourceSelection) multi.sourceSelection = sourceSelection;
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: `Unsupported multi_source statement "${child.type}"`,
            span: child.span
          });
        }
        config.multiSource = multi;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported graphContagion block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported graphContagion statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (selection) config.selection = selection;
  if (vectors.length > 0) config.vectors = vectors;
  if (susceptibilityModifiers.length > 0) config.susceptibilityModifiers = susceptibilityModifiers;
  if (phaseTransitions.length > 0) config.phaseTransitions = phaseTransitions;
  if (Object.keys(pressureChanges).length > 0) config.pressureChanges = pressureChanges;

  return result;
}

export function buildPlaneDiffusionSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };
  const outputTags: Record<string, unknown>[] = [];
  let selection: Record<string, unknown> | null = null;

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      if (stmt.key === 'sources') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 2) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'sources requires: sources <tag> <strength>',
            span: stmt.span
          });
          continue;
        }
        const tagFilter = tokens[0];
        const defaultStrength = tokens[1];
        if (typeof tagFilter === 'string' && typeof defaultStrength === 'number') {
          config.sources = { tagFilter, defaultStrength };
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'sources requires a tag and numeric strength',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'sinks') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 2) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'sinks requires: sinks <tag> <strength>',
            span: stmt.span
          });
          continue;
        }
        const tagFilter = tokens[0];
        const defaultStrength = tokens[1];
        if (typeof tagFilter === 'string' && typeof defaultStrength === 'number') {
          config.sinks = { tagFilter, defaultStrength };
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'sinks requires a tag and numeric strength',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'diffusion') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 5) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'diffusion requires: diffusion <rate> <decay> <radius> <falloff> <iterations>',
            span: stmt.span
          });
          continue;
        }
        const [rate, decayRate, sourceRadius, falloffType, iterationsPerTick] = tokens;
        if (typeof rate === 'number'
          && typeof decayRate === 'number'
          && typeof sourceRadius === 'number'
          && typeof falloffType === 'string'
          && typeof iterationsPerTick === 'number'
        ) {
          config.diffusion = {
            rate,
            decayRate,
            sourceRadius,
            falloffType,
            iterationsPerTick
          };
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'diffusion requires numeric values and falloff type',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'output_tag') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 1) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'output_tag requires: output_tag <tag> [min <value>] [max <value>]',
            span: stmt.span
          });
          continue;
        }
        const tag = tokens[0];
        if (typeof tag !== 'string') {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'output_tag requires a tag identifier',
            span: stmt.span
          });
          continue;
        }
        const entry: Record<string, unknown> = { tag };
        let idx = 1;
        while (idx < tokens.length) {
          const key = tokens[idx];
          const value = tokens[idx + 1];
          if (key === 'min' && typeof value === 'number') {
            entry.minValue = value;
            idx += 2;
            continue;
          }
          if (key === 'max' && typeof value === 'number') {
            entry.maxValue = value;
            idx += 2;
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: 'output_tag supports min/max numeric values',
            span: stmt.span
          });
          break;
        }
        outputTags.push(entry);
        continue;
      }
      if (stmt.key === 'value_tag' || stmt.key === 'valueTag') {
        config.valueTag = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported planeDiffusion attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'selection' || stmt.name === 'choose') {
        if (selection) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          continue;
        }
        selection = parseSystemSelectionBlock(stmt, ctx);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported planeDiffusion block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported planeDiffusion statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (selection) config.selection = selection;
  if (outputTags.length > 0) config.outputTags = outputTags;

  return result;
}

export function buildTagDiffusionSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };
  let selection: Record<string, unknown> | null = null;

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      if (stmt.key === 'connection') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 2) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'connection requires: connection <relationship> <direction>',
            span: stmt.span
          });
          continue;
        }
        const connectionKind = tokens[0];
        const connectionDirection = tokens[1];
        if (typeof connectionKind === 'string' && typeof connectionDirection === 'string') {
          config.connectionKind = connectionKind;
          config.connectionDirection = connectionDirection;
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'connection requires relationship kind and direction',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'convergence' || stmt.key === 'divergence') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length === 0 || tokens[0] !== 'tags') {
          ctx.diagnostics.push({
            severity: 'error',
            message: `${stmt.key} requires: ${stmt.key} tags <list> ...`,
            span: stmt.span
          });
          continue;
        }
        const tags: string[] = [];
        const keywordSet = new Set(['min_connections', 'max_connections', 'probability', 'max_shared_tags']);
        let idx = 1;
        while (idx < tokens.length) {
          const token = tokens[idx];
          if (typeof token === 'string' && keywordSet.has(token)) break;
          if (Array.isArray(token)) {
            for (const entry of token) {
              if (typeof entry !== 'string') {
                ctx.diagnostics.push({
                  severity: 'error',
                  message: `${stmt.key} tags must be identifiers`,
                  span: stmt.span
                });
                break;
              }
              tags.push(entry);
            }
            idx += 1;
            continue;
          }
          if (typeof token === 'string') {
            tags.push(token);
            idx += 1;
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: `${stmt.key} tags must be identifiers`,
            span: stmt.span
          });
          break;
        }
        if (tags.length === 0) {
          ctx.diagnostics.push({
            severity: 'error',
            message: `${stmt.key} requires at least one tag`,
            span: stmt.span
          });
          continue;
        }
        const group: Record<string, unknown> = { tags };
        while (idx < tokens.length) {
          const key = tokens[idx];
          const value = tokens[idx + 1];
          if (key === 'min_connections' && typeof value === 'number') {
            group.minConnections = value;
            idx += 2;
            continue;
          }
          if (key === 'max_connections' && typeof value === 'number') {
            group.maxConnections = value;
            idx += 2;
            continue;
          }
          if (key === 'probability' && typeof value === 'number') {
            group.probability = value;
            idx += 2;
            continue;
          }
          if (key === 'max_shared_tags' && typeof value === 'number') {
            group.maxSharedTags = value;
            idx += 2;
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: `${stmt.key} supports min_connections/max_connections/probability/max_shared_tags`,
            span: stmt.span
          });
          break;
        }
        if (stmt.key === 'convergence') {
          config.convergence = group;
        } else {
          config.divergence = group;
        }
        continue;
      }
      if (stmt.key === 'max_tags' || stmt.key === 'maxTags') {
        config.maxTags = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
        continue;
      }
      if (stmt.key === 'divergence_pressure' || stmt.key === 'divergencePressure') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length < 3) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'divergence_pressure requires: divergence_pressure <pressure> <minDivergent> <delta>',
            span: stmt.span
          });
          continue;
        }
        const pressureName = tokens[0];
        const minDivergent = tokens[1];
        const delta = tokens[2];
        if (typeof pressureName === 'string' && typeof minDivergent === 'number' && typeof delta === 'number') {
          config.divergencePressure = { pressureName, minDivergent, delta };
          continue;
        }
        ctx.diagnostics.push({
          severity: 'error',
          message: 'divergence_pressure requires pressure name and numeric values',
          span: stmt.span
        });
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported tagDiffusion attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'selection' || stmt.name === 'choose') {
        if (selection) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          continue;
        }
        selection = parseSystemSelectionBlock(stmt, ctx);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported tagDiffusion block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported tagDiffusion statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (selection) config.selection = selection;
  return result;
}

export function buildEraSpawnerSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported eraSpawner attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported eraSpawner statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  return result;
}

export function buildEraTransitionSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      if (stmt.key === 'prominence_snapshot' || stmt.key === 'prominenceSnapshot') {
        const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
        if (!tokens || tokens.length % 2 !== 0) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'prominence_snapshot requires pairs of <key> <value>',
            span: stmt.span
          });
          continue;
        }
        const snapshot: Record<string, unknown> = {};
        for (let i = 0; i < tokens.length; i += 2) {
          const key = tokens[i];
          const value = tokens[i + 1];
          if (key === 'enabled') {
            snapshot.enabled = value;
            continue;
          }
          if (key === 'min_prominence' || key === 'minProminence') {
            snapshot.minProminence = value;
            continue;
          }
          ctx.diagnostics.push({
            severity: 'error',
            message: 'prominence_snapshot supports enabled and min_prominence',
            span: stmt.span
          });
          break;
        }
        config.prominenceSnapshot = snapshot;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported eraTransition attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported eraTransition statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  return result;
}

export function buildUniversalCatalystSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      if (stmt.key === 'action_attempt_rate' || stmt.key === 'actionAttemptRate') {
        config.actionAttemptRate = value;
        continue;
      }
      if (stmt.key === 'pressure_multiplier' || stmt.key === 'pressureMultiplier') {
        config.pressureMultiplier = value;
        continue;
      }
      if (stmt.key === 'prominence_up_chance' || stmt.key === 'prominenceUpChanceOnSuccess') {
        config.prominenceUpChanceOnSuccess = value;
        continue;
      }
      if (stmt.key === 'prominence_down_chance' || stmt.key === 'prominenceDownChanceOnFailure') {
        config.prominenceDownChanceOnFailure = value;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported universalCatalyst attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported universalCatalyst statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  return result;
}

export function buildRelationshipMaintenanceSystem(
  statements: StatementNode[],
  ctx: GeneratorContext
): SystemParseResult | null {
  const config: Record<string, unknown> = {};
  const result: SystemParseResult = { config };

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (applySystemCommonAttribute(stmt, result, ctx)) continue;
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      if (stmt.key === 'maintenance_frequency' || stmt.key === 'maintenanceFrequency') {
        config.maintenanceFrequency = value;
        continue;
      }
      if (stmt.key === 'cull_threshold' || stmt.key === 'cullThreshold') {
        config.cullThreshold = value;
        continue;
      }
      if (stmt.key === 'grace_period' || stmt.key === 'gracePeriod') {
        config.gracePeriod = value;
        continue;
      }
      if (stmt.key === 'reinforcement_bonus' || stmt.key === 'reinforcementBonus') {
        config.reinforcementBonus = value;
        continue;
      }
      if (stmt.key === 'max_strength' || stmt.key === 'maxStrength') {
        config.maxStrength = value;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported relationshipMaintenance attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported relationshipMaintenance statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  return result;
}

export function buildSystemActionListFromStatements(
  statements: StatementNode[],
  ctx: GeneratorContext
): Record<string, unknown>[] {
  return buildMutationListFromStatements(statements, ctx, { requireMutateBlock: true });
}

export function _parseSystemActionStatement(
  stmt: StatementNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  if (stmt.type === 'rel') {
    return buildActionRelationshipMutation(stmt, ctx as ActionContext);
  }
  if (stmt.type === 'mutate') {
    return buildActionPressureMutation(stmt, ctx as ActionContext);
  }
  if (stmt.type === 'attribute') {
    if (stmt.key === 'transfer_relationship') {
      return parseTransferRelationshipAction(stmt, ctx);
    }
    const mutation = buildActionMutationFromAttribute(stmt, ctx as ActionContext);
    return mutation ?? null;
  }
  if (stmt.type === 'block') {
    if (stmt.name === 'conditional' || stmt.name === 'if') {
      return parseConditionalActionBlock(stmt, ctx);
    }
    if (stmt.name === 'for_each_related') {
      return parseForEachRelatedActionBlock(stmt, ctx);
    }
    if (stmt.name === 'action') {
      const actions = buildSystemActionListFromStatements(stmt.body, ctx);
      if (actions.length !== 1) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'action block requires exactly one action',
          span: stmt.span
        });
        return null;
      }
      return actions[0];
    }
  }
  return null;
}

export function parseConditionalActionBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const conditions: Record<string, unknown>[] = [];
  let thenActions: Record<string, unknown>[] | null = null;
  let elseActions: Record<string, unknown>[] | null = null;

  for (const child of stmt.body) {
    if (child.type === 'block' && child.name === 'then') {
      thenActions = buildMutationListFromStatements(child.body, ctx);
      continue;
    }
    if (child.type === 'block' && child.name === 'else') {
      elseActions = buildMutationListFromStatements(child.body, ctx);
      continue;
    }
    if (child.type === 'block' && (child.name === 'when' || child.name === 'conditions')) {
      const group = buildSystemConditionGroup(child, ctx);
      if (group) conditions.push(group);
      continue;
    }
    const condition = parseSystemConditionStatement(child, ctx);
    if (condition) {
      conditions.push(condition);
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported conditional statement "${child.type}"`,
      span: child.span
    });
  }

  if (!thenActions || thenActions.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'conditional requires a then block with actions',
      span: stmt.span
    });
    return null;
  }
  if (conditions.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'conditional requires a condition',
      span: stmt.span
    });
    return null;
  }

  const condition = conditions.length === 1 ? conditions[0] : { type: 'and', conditions };
  const action: Record<string, unknown> = {
    type: 'conditional',
    condition,
    thenActions
  };
  if (elseActions && elseActions.length > 0) {
    action.elseActions = elseActions;
  }
  normalizeRefsInObject(action, ctx);
  return action;
}

export function parseForEachRelatedActionBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const [relationship, direction, targetKind, targetSubtype] = stmt.labels;
  if (!relationship || !direction) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'for_each_related requires: for_each_related <relationship> <direction> [<kind>]',
      span: stmt.span
    });
    return null;
  }
  const actions = buildMutationListFromStatements(stmt.body, ctx);
  if (actions.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'for_each_related requires at least one action',
      span: stmt.span
    });
    return null;
  }
  const action: Record<string, unknown> = {
    type: 'for_each_related',
    relationship,
    direction,
    actions
  };
  if (targetKind) {
    action.targetKind = targetKind;
  }
  if (targetSubtype) {
    action.targetSubtype = targetSubtype;
  }
  normalizeRefsInObject(action, ctx);
  return action;
}

export function parseTransferRelationshipAction(
  stmt: Extract<StatementNode, { type: 'attribute' }>,

