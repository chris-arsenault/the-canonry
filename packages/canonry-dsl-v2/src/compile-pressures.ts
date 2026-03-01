import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
} from './types.js';

import { isRecord, readStringValue, readNumberValue, applyLabelField, parseKeyValuePairs, parseListSegment } from './compile-utils.js';
import { valueToJson } from './compile-variables.js';

export function parseEntityCountFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  allowCoefficient: boolean,
  allowCap: boolean
): Record<string, unknown> | null {
  const allowed = new Set<string>(['kind', 'subtype', 'status']);
  if (allowCoefficient) allowed.add('coefficient');
  if (allowCap) allowed.add('cap');
  const kv = parseKeyValuePairs(tokens, diagnostics, span, allowed);
  if (!kv) return null;

  const kind = kv.kind;
  if (typeof kind !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'entity_count requires kind',
      span
    });
    return null;
  }

  const factor: Record<string, unknown> = { type: 'entity_count', kind };
  if (typeof kv.subtype === 'string') factor.subtype = kv.subtype;
  if (typeof kv.status === 'string') factor.status = kv.status;
  if (allowCoefficient && typeof kv.coefficient === 'number') factor.coefficient = kv.coefficient;
  if (allowCap && typeof kv.cap === 'number') factor.cap = kv.cap;
  return factor;
}

export function parseRelationshipCountFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  allowDirection: boolean,
  allowMinStrength: boolean,
  allowCoefficient: boolean,
  allowCap: boolean
): Record<string, unknown> | null {
  const stopWords = new Set<string>(['direction', 'min_strength', 'minStrength', 'coefficient', 'cap', 'relationship_kinds', 'relationshipKinds', 'relationships', 'kinds']);
  let index = 0;
  const first = tokens[0];
  if (typeof first === 'string' && (first === 'relationship_kinds' || first === 'relationshipKinds' || first === 'relationships' || first === 'kinds')) {
    index = 1;
  }
  const listResult = parseListSegment(tokens, index, stopWords, diagnostics, span, 'relationship_count');
  if (!listResult) return null;
  const relationshipKinds = listResult.list;
  index = listResult.nextIndex;

  const allowed = new Set<string>();
  if (allowDirection) allowed.add('direction');
  if (allowMinStrength) {
    allowed.add('min_strength');
    allowed.add('minStrength');
  }
  if (allowCoefficient) allowed.add('coefficient');
  if (allowCap) allowed.add('cap');
  const kv = parseKeyValuePairs(tokens.slice(index), diagnostics, span, allowed);
  if (!kv) return null;

  const factor: Record<string, unknown> = { type: 'relationship_count', relationshipKinds };
  if (allowDirection && typeof kv.direction === 'string') factor.direction = kv.direction;
  if (allowMinStrength) {
    const strength = kv.minStrength ?? kv.min_strength;
    if (typeof strength === 'number') factor.minStrength = strength;
  }
  if (allowCoefficient && typeof kv.coefficient === 'number') factor.coefficient = kv.coefficient;
  if (allowCap && typeof kv.cap === 'number') factor.cap = kv.cap;
  return factor;
}

export function parseTagCountFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  allowCoefficient: boolean,
  allowCap: boolean
): Record<string, unknown> | null {
  const stopWords = new Set<string>(['coefficient', 'cap', 'tags']);
  let index = 0;
  if (tokens[0] === 'tags') index = 1;
  const listResult = parseListSegment(tokens, index, stopWords, diagnostics, span, 'tag_count');
  if (!listResult) return null;
  const tags = listResult.list;
  index = listResult.nextIndex;

  const allowed = new Set<string>();
  if (allowCoefficient) allowed.add('coefficient');
  if (allowCap) allowed.add('cap');
  const kv = parseKeyValuePairs(tokens.slice(index), diagnostics, span, allowed);
  if (!kv) return null;

  const factor: Record<string, unknown> = { type: 'tag_count', tags };
  if (allowCoefficient && typeof kv.coefficient === 'number') factor.coefficient = kv.coefficient;
  if (allowCap && typeof kv.cap === 'number') factor.cap = kv.cap;
  return factor;
}

export function parseTotalEntitiesFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  allowCoefficient: boolean,
  allowCap: boolean
): Record<string, unknown> | null {
  const allowed = new Set<string>();
  if (allowCoefficient) allowed.add('coefficient');
  if (allowCap) allowed.add('cap');
  const kv = parseKeyValuePairs(tokens, diagnostics, span, allowed);
  if (!kv) return null;
  const factor: Record<string, unknown> = { type: 'total_entities' };
  if (allowCoefficient && typeof kv.coefficient === 'number') factor.coefficient = kv.coefficient;
  if (allowCap && typeof kv.cap === 'number') factor.cap = kv.cap;
  return factor;
}

export function parseConstantFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  allowCoefficient: boolean
): Record<string, unknown> | null {
  let value: number | null = null;
  let remaining = tokens;
  if (tokens.length > 0 && typeof tokens[0] === 'number') {
    value = tokens[0];
    remaining = tokens.slice(1);
  }
  const allowed = new Set<string>(['value']);
  if (allowCoefficient) allowed.add('coefficient');
  const kv = remaining.length > 0 ? parseKeyValuePairs(remaining, diagnostics, span, allowed) : {};
  if (remaining.length > 0 && !kv) return null;
  const nextValue = kv?.value;
  if (value === null) {
    if (typeof nextValue === 'number') {
      value = nextValue;
    } else {
      diagnostics.push({
        severity: 'error',
        message: 'constant requires a numeric value',
        span
      });
      return null;
    }
  }
  const factor: Record<string, unknown> = { type: 'constant', value };
  if (allowCoefficient && typeof kv?.coefficient === 'number') factor.coefficient = kv.coefficient;
  return factor;
}

export function parseSimpleCountFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length === 0 || typeof tokens[0] !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'ratio requires a numerator and denominator factor',
      span
    });
    return null;
  }
  const type = tokens[0];
  const rest = tokens.slice(1);
  if (type === 'entity_count') {
    return parseEntityCountFactor(rest, diagnostics, span, false, false);
  }
  if (type === 'relationship_count') {
    return parseRelationshipCountFactor(rest, diagnostics, span, false, false, false, false);
  }
  if (type === 'tag_count') {
    return parseTagCountFactor(rest, diagnostics, span, false, false);
  }
  if (type === 'total_entities') {
    return parseTotalEntitiesFactor(rest, diagnostics, span, false, false);
  }
  if (type === 'constant') {
    return parseConstantFactor(rest, diagnostics, span, false);
  }
  diagnostics.push({
    severity: 'error',
    message: `Unsupported ratio factor "${type}"`,
    span
  });
  return null;
}

export function parseRatioFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): Record<string, unknown> | null {
  const numeratorIndex = tokens.indexOf('numerator');
  const denominatorIndex = tokens.indexOf('denominator');
  if (numeratorIndex === -1 || denominatorIndex === -1 || numeratorIndex > denominatorIndex) {
    diagnostics.push({
      severity: 'error',
      message: 'ratio requires numerator and denominator sections',
      span
    });
    return null;
  }

  const ratioOptions = new Set(['coefficient', 'cap', 'fallback', 'fallback_value', 'fallbackValue']);
  const numeratorTokens = tokens.slice(numeratorIndex + 1, denominatorIndex);
  const numerator = parseSimpleCountFactor(numeratorTokens, diagnostics, span);
  if (!numerator) return null;

  let denominatorEnd = tokens.length;
  for (let i = denominatorIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (typeof token === 'string' && ratioOptions.has(token)) {
      denominatorEnd = i;
      break;
    }
  }

  const denominatorTokens = tokens.slice(denominatorIndex + 1, denominatorEnd);
  const denominator = parseSimpleCountFactor(denominatorTokens, diagnostics, span);
  if (!denominator) return null;

  const optionTokens = tokens.slice(denominatorEnd);
  const allowed = new Set<string>(['coefficient', 'cap', 'fallback', 'fallback_value', 'fallbackValue']);
  const kv = optionTokens.length > 0 ? parseKeyValuePairs(optionTokens, diagnostics, span, allowed) : {};
  if (optionTokens.length > 0 && !kv) return null;

  const factor: Record<string, unknown> = { type: 'ratio', numerator, denominator };
  if (typeof kv?.coefficient === 'number') factor.coefficient = kv.coefficient;
  if (typeof kv?.cap === 'number') factor.cap = kv.cap;
  const fallback = kv?.fallback ?? kv?.fallback_value ?? kv?.fallbackValue;
  if (typeof fallback === 'number') factor.fallbackValue = fallback;
  return factor;
}

export function parseStatusRatioFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): Record<string, unknown> | null {
  const allowed = new Set<string>(['kind', 'subtype', 'alive_status', 'aliveStatus', 'coefficient', 'cap']);
  const kv = parseKeyValuePairs(tokens, diagnostics, span, allowed);
  if (!kv) return null;

  const kind = kv.kind;
  const aliveStatus = kv.aliveStatus ?? kv.alive_status;
  if (typeof kind !== 'string' || typeof aliveStatus !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'status_ratio requires kind and alive_status',
      span
    });
    return null;
  }

  const factor: Record<string, unknown> = { type: 'status_ratio', kind, aliveStatus };
  if (typeof kv.subtype === 'string') factor.subtype = kv.subtype;
  if (typeof kv.coefficient === 'number') factor.coefficient = kv.coefficient;
  if (typeof kv.cap === 'number') factor.cap = kv.cap;
  return factor;
}

export function parseCrossCultureRatioFactor(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): Record<string, unknown> | null {
  const base = parseRelationshipCountFactor(tokens, diagnostics, span, false, false, true, true);
  if (!base) return null;
  const { relationshipKinds, coefficient, cap } = base;
  const factor: Record<string, unknown> = { type: 'cross_culture_ratio', relationshipKinds };
  if (typeof coefficient === 'number') factor.coefficient = coefficient;
  if (typeof cap === 'number') factor.cap = cap;
  return factor;
}

export function parsePressureFactorTokens(
  type: string,
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (type === 'entity_count') {
    return parseEntityCountFactor(tokens, diagnostics, span, true, true);
  }
  if (type === 'relationship_count') {
    return parseRelationshipCountFactor(tokens, diagnostics, span, true, true, true, true);
  }
  if (type === 'tag_count') {
    return parseTagCountFactor(tokens, diagnostics, span, true, true);
  }
  if (type === 'total_entities') {
    return parseTotalEntitiesFactor(tokens, diagnostics, span, true, true);
  }
  if (type === 'constant') {
    return parseConstantFactor(tokens, diagnostics, span, true);
  }
  if (type === 'ratio') {
    return parseRatioFactor(tokens, diagnostics, span);
  }
  if (type === 'status_ratio') {
    return parseStatusRatioFactor(tokens, diagnostics, span);
  }
  if (type === 'cross_culture_ratio') {
    return parseCrossCultureRatioFactor(tokens, diagnostics, span);
  }
  diagnostics.push({
    severity: 'error',
    message: `Unsupported pressure factor "${type}"`,
    span
  });
  return null;
}

export function parsePressureFeedbackBlock(
  stmt: BlockNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] | null {
  const factors: Record<string, unknown>[] = [];
  for (const child of stmt.body) {
    if (child.type === 'attribute') {
      const tokens = tokensFromValueStrict(child.value, diagnostics, parent, child.span, child.key);
      if (!tokens) continue;
      const factor = parsePressureFactorTokens(child.key, tokens, diagnostics, child.span);
      if (factor) factors.push(factor);
      continue;
    }
    if (child.type === 'block') {
      const tokens = tokensFromBlockAttributes(child, diagnostics, parent);
      if (!tokens) continue;
      const factor = parsePressureFactorTokens(child.name, tokens, diagnostics, child.span);
      if (factor) factors.push(factor);
      continue;
    }
    if (child.type === 'bare') {
      const type = coerceStringValue(child.value);
      if (!type) {
        diagnostics.push({
          severity: 'error',
          message: 'feedback entries must be identifiers',
          span: child.span
        });
        continue;
      }
      if (type !== 'total_entities') {
        diagnostics.push({
          severity: 'error',
          message: 'bare feedback entries are only supported for total_entities',
          span: child.span
        });
        continue;
      }
      factors.push({ type: 'total_entities' });
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'pressure feedback blocks only support attribute or block statements',
      span: child.span
    });
  }
  return factors;
}

export function parsePressureGrowthBlock(
  stmt: BlockNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const positiveFeedback: Record<string, unknown>[] = [];
  const negativeFeedback: Record<string, unknown>[] = [];
  let sawPositive = false;
  let sawNegative = false;

  for (const child of stmt.body) {
    if (child.type !== 'block') {
      diagnostics.push({
        severity: 'error',
        message: 'growth only supports positive_feedback and negative_feedback blocks',
        span: child.span
      });
      continue;
    }
    if (child.name === 'positive_feedback' || child.name === 'positiveFeedback') {
      const factors = parsePressureFeedbackBlock(child, diagnostics, parent);
      if (factors) positiveFeedback.push(...factors);
      sawPositive = true;
      continue;
    }
    if (child.name === 'negative_feedback' || child.name === 'negativeFeedback') {
      const factors = parsePressureFeedbackBlock(child, diagnostics, parent);
      if (factors) negativeFeedback.push(...factors);
      sawNegative = true;
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unsupported growth block "${child.name}"`,
      span: child.span
    });
  }

  if (!sawPositive) {
    diagnostics.push({
      severity: 'error',
      message: 'growth requires a positive_feedback block',
      span: stmt.span
    });
  }
  if (!sawNegative) {
    diagnostics.push({
      severity: 'error',
      message: 'growth requires a negative_feedback block',
      span: stmt.span
    });
  }

  return { positiveFeedback, negativeFeedback };
}

export function parseContractEntryTokens(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  allowed: Set<string>,
  required: string[],
  label: string
): Record<string, unknown> | null {
  const kv = parseKeyValuePairs(tokens, diagnostics, span, allowed);
  if (!kv) return null;
  for (const key of required) {
    if (typeof kv[key] !== 'string' && typeof kv[key] !== 'number') {
      diagnostics.push({
        severity: 'error',
        message: `${label} requires ${key}`,
        span
      });
      return null;
    }
  }
  return kv;
}

export function validateContractEntry(
  entryName: string,
  entry: Record<string, unknown>,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): boolean {
  const component = entry.component;
  if (typeof component !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: `${entryName} requires a component string`,
      span
    });
    return false;
  }

  if (entryName === 'affect') {
    const effect = entry.effect;
    if (typeof effect !== 'string' || !['enabler', 'amplifier', 'suppressor'].includes(effect)) {
      diagnostics.push({
        severity: 'error',
        message: 'affect requires effect: enabler|amplifier|suppressor',
        span
      });
      return false;
    }
    if (entry.threshold !== undefined && typeof entry.threshold !== 'number') {
      diagnostics.push({
        severity: 'error',
        message: 'affect threshold must be a number',
        span
      });
      return false;
    }
    if (entry.factor !== undefined && typeof entry.factor !== 'number') {
      diagnostics.push({
        severity: 'error',
        message: 'affect factor must be a number',
        span
      });
      return false;
    }
    return true;
  }

  if (entry.delta !== undefined && typeof entry.delta !== 'number') {
    diagnostics.push({
      severity: 'error',
      message: `${entryName} delta must be a number`,
      span
    });
    return false;
  }
  if (entry.formula !== undefined && typeof entry.formula !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: `${entryName} formula must be a string`,
      span
    });
    return false;
  }

  return true;
}

export function parseContractEntriesBlock(
  stmt: BlockNode,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  entryName: string,
  allowed: Set<string>,
  required: string[],
  label: string
): Record<string, unknown>[] | null {
  const entries: Record<string, unknown>[] = [];
  for (const child of stmt.body) {
    if (child.type === 'attribute' && child.key === entryName) {
      const tokens = tokensFromValueStrict(child.value, diagnostics, parent, child.span, entryName);
      if (!tokens) continue;
      const entry = parseContractEntryTokens(tokens, diagnostics, child.span, allowed, required, label);
      if (entry) {
        if (!validateContractEntry(entryName, entry, diagnostics, child.span)) continue;
        entries.push(entry);
      }
      continue;
    }
    if (child.type === 'block' && child.name === entryName) {
      const tokens = tokensFromBlockAttributes(child, diagnostics, parent);
      if (!tokens) continue;
      const entry = parseContractEntryTokens(tokens, diagnostics, child.span, allowed, required, label);
      if (entry) {
        if (!validateContractEntry(entryName, entry, diagnostics, child.span)) continue;
        entries.push(entry);
      }
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `${stmt.name} only supports ${entryName} entries`,
      span: child.span
    });
  }
  return entries;
}

export function parsePressureContractBlock(
  stmt: BlockNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const contract: Record<string, unknown> = {};

  for (const child of stmt.body) {
    if (child.type === 'attribute') {
      if (child.key === 'purpose') {
        const value = readStringValue(child.value, diagnostics, parent, child.span, 'purpose');
        if (value !== null) contract.purpose = value;
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported contract attribute "${child.key}"`,
        span: child.span
      });
      continue;
    }
    if (child.type === 'block') {
      if (child.name === 'sources') {
        const entries = parseContractEntriesBlock(
          child,
          diagnostics,
          parent,
          'source',
          new Set(['component', 'delta', 'formula']),
          ['component'],
          'source'
        );
        if (entries) contract.sources = entries;
        continue;
      }
      if (child.name === 'sinks') {
        const entries = parseContractEntriesBlock(
          child,
          diagnostics,
          parent,
          'sink',
          new Set(['component', 'delta', 'formula']),
          ['component'],
          'sink'
        );
        if (entries) contract.sinks = entries;
        continue;
      }
      if (child.name === 'affects') {
        const entries = parseContractEntriesBlock(
          child,
          diagnostics,
          parent,
          'affect',
          new Set(['component', 'effect', 'threshold', 'factor']),
          ['component', 'effect'],
          'affect'
        );
        if (entries) contract.affects = entries;
        continue;
      }
      if (child.name === 'equilibrium') {
        const equilibrium: Record<string, unknown> = {};
        for (const entry of child.body) {
          if (entry.type !== 'attribute') {
            diagnostics.push({
              severity: 'error',
              message: 'equilibrium only supports attribute statements',
              span: entry.span
            });
            continue;
          }
          if (entry.key === 'expected_range' || entry.key === 'expectedRange') {
            const tokens = tokensFromValueStrict(entry.value, diagnostics, parent, entry.span, 'expected_range');
            if (!tokens) continue;
            if (tokens.length !== 2 || typeof tokens[0] !== 'number' || typeof tokens[1] !== 'number') {
              diagnostics.push({
                severity: 'error',
                message: 'expected_range requires two numbers',
                span: entry.span
              });
              continue;
            }
            equilibrium.expectedRange = [tokens[0], tokens[1]];
            continue;
          }
          if (entry.key === 'resting_point' || entry.key === 'restingPoint') {
            const value = readNumberValue(entry.value, diagnostics, parent, entry.span, 'resting_point');
            if (value !== null) equilibrium.restingPoint = value;
            continue;
          }
          if (entry.key === 'oscillation_period' || entry.key === 'oscillationPeriod') {
            const value = readNumberValue(entry.value, diagnostics, parent, entry.span, 'oscillation_period');
            if (value !== null) equilibrium.oscillationPeriod = value;
            continue;
          }
          diagnostics.push({
            severity: 'error',
            message: `Unsupported equilibrium attribute "${entry.key}"`,
            span: entry.span
          });
        }
        contract.equilibrium = equilibrium;
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported contract block "${child.name}"`,
        span: child.span
      });
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unsupported contract statement "${child.type}"`,
      span: child.span
    });
  }

  return contract;
}

export function buildPressureItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item: Record<string, unknown> = {};
  let growth: Record<string, unknown> | null = null;
  let contract: Record<string, unknown> | null = null;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.labels && stmt.labels.length > 0) {
        diagnostics.push({
          severity: 'error',
          message: 'pressure attributes do not support labels',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'initial_value' || stmt.key === 'initialValue') {
        const value = readNumberValue(stmt.value, diagnostics, block, stmt.span, 'initial_value');
        if (value !== null) item.initialValue = value;
        continue;
      }
      if (stmt.key === 'homeostasis') {
        const value = readNumberValue(stmt.value, diagnostics, block, stmt.span, 'homeostasis');
        if (value !== null) item.homeostasis = value;
        continue;
      }
      if (stmt.key === 'description' || stmt.key === 'desc') {
        const value = readStringValue(stmt.value, diagnostics, block, stmt.span, 'description');
        if (value !== null) item.description = value;
        continue;
      }
      if (stmt.key === 'name') {
        const value = readStringValue(stmt.value, diagnostics, block, stmt.span, 'name');
        if (value !== null) item.name = value;
        continue;
      }
      if (stmt.key === 'growth' || stmt.key === 'contract') {
        diagnostics.push({
          severity: 'error',
          message: `${stmt.key} must be a block`,
          span: stmt.span
        });
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported pressure attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'growth') {
        if (growth) {
          diagnostics.push({
            severity: 'error',
            message: 'growth already defined',
            span: stmt.span
          });
          continue;
        }
        growth = parsePressureGrowthBlock(stmt, diagnostics, block);
        continue;
      }
      if (stmt.name === 'contract') {
        if (contract) {
          diagnostics.push({
            severity: 'error',
            message: 'contract already defined',
            span: stmt.span
          });
          continue;
        }
        contract = parsePressureContractBlock(stmt, diagnostics, block);
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported pressure block "${stmt.name}"`,
        span: stmt.span
      });
      continue;
    }

    diagnostics.push({
      severity: 'error',
      message: `Unsupported pressure statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (block.labels[0]) {
    if (!applyLabelField(item, 'id', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (!applyLabelField(item, 'name', block.labels[1], diagnostics, block)) return null;
  }

  if (!growth) {
    diagnostics.push({
      severity: 'error',
      message: 'pressure requires a growth block',
      span: block.span
    });
  } else {
    item.growth = growth;
  }

  if (contract) item.contract = contract;

  return item;
}

