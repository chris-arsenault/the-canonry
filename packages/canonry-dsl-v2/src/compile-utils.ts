import type {
  BlockNode,
  Diagnostic,
  Value,
  ObjectValue,
  ArrayValue,
  IdentifierValue,
  CallValue,
  StatementNode,
} from './types.js';

import type { EvalContext, GeneratorContext } from './compile-types.js';
import { VARIABLE_REFERENCE_PREFIXES } from './compile-types.js';

export function isIdentifierValue(value: Value): value is IdentifierValue {
  return typeof value === 'object' && value !== null && (value as IdentifierValue).type === 'identifier';
}

export function isCallValue(value: Value): value is CallValue {
  return typeof value === 'object' && value !== null && (value as CallValue).type === 'call';
}

export function isArrayValue(value: Value): value is ArrayValue {
  return typeof value === 'object' && value !== null && (value as ArrayValue).type === 'array';
}

export function isObjectValue(value: Value): value is ObjectValue {
  return typeof value === 'object' && value !== null && (value as ObjectValue).type === 'object';
}

export function isValueNode(value: unknown): value is Value {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: string }).type;
  if (type === 'identifier') {
    return typeof (value as IdentifierValue).value === 'string';
  }
  if (type === 'array') {
    return Array.isArray((value as ArrayValue).items);
  }
  if (type === 'object') {
    return Array.isArray((value as ObjectValue).entries);
  }
  if (type === 'call') {
    return typeof (value as CallValue).name === 'string';
  }
  return false;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isValueNode(value);
}

export function valueContainsNewline(value: Value): boolean {
  if (typeof value === 'string') {
    return value.includes('\n') || value.includes('\r');
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return false;
  }
  if (isIdentifierValue(value)) {
    return false;
  }
  if (isArrayValue(value)) {
    return value.items.some((item) => valueContainsNewline(item));
  }
  if (isObjectValue(value)) {
    return value.entries.some((entry) => valueContainsNewline(entry.value));
  }
  if (isCallValue(value)) {
    return value.args.some((arg) => valueContainsNewline(arg));
  }
  return false;
}

export function coerceStringValue(value: Value | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (isIdentifierValue(value)) return value.value;
  return null;
}

export function generateStaticPageSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

export function setObjectValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (key in obj) {
    const existing = obj[key];
    if (Array.isArray(existing)) {
      existing.push(value);
      return;
    }
    obj[key] = [existing, value];
    return;
  }
  obj[key] = value;
}

export function pushArrayValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  const existing = obj[key];
  if (existing === undefined) {
    obj[key] = [value];
    return;
  }
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }
  obj[key] = [existing, value];
}

export function readStringValue(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  span: BlockNode['span'],
  label: string
): string | null {
  const raw = valueToJson(value, diagnostics, parent);
  if (typeof raw === 'string') return raw;
  diagnostics.push({
    severity: 'error',
    message: `${label} must be a string`,
    span
  });
  return null;
}

export function readNumberValue(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  span: BlockNode['span'],
  label: string
): number | null {
  const raw = valueToJson(value, diagnostics, parent);
  if (typeof raw === 'number') return raw;
  diagnostics.push({
    severity: 'error',
    message: `${label} must be a number`,
    span
  });
  return null;
}

export function tokensFromValueStrict(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  span: BlockNode['span'],
  label: string
): Array<string | number> | null {
  if (isObjectValue(value)) {
    diagnostics.push({
      severity: 'error',
      message: `${label} does not support object literals`,
      span
    });
    return null;
  }
  const raw = valueToJson(value, diagnostics, parent);
  if (isRecord(raw)) {
    diagnostics.push({
      severity: 'error',
      message: `${label} does not support object values`,
      span
    });
    return null;
  }
  const tokens = Array.isArray(raw) ? raw : [raw];
  const result: Array<string | number> = [];
  for (const token of tokens) {
    if (token === null || typeof token === 'boolean') {
      diagnostics.push({
        severity: 'error',
        message: `${label} requires identifiers or numbers`,
        span
      });
      return null;
    }
    if (Array.isArray(token) || isRecord(token)) {
      diagnostics.push({
        severity: 'error',
        message: `${label} does not support nested arrays or objects`,
        span
      });
      return null;
    }
    if (typeof token !== 'string' && typeof token !== 'number') {
      diagnostics.push({
        severity: 'error',
        message: `${label} requires identifiers or numbers`,
        span
      });
      return null;
    }
    result.push(token);
  }
  return result;
}

export function tokensFromBlockAttributes(
  stmt: BlockNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Array<string | number> | null {
  const tokens: Array<string | number> = [];
  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.name} blocks only support attribute statements`,
        span: child.span
      });
      return null;
    }
    if (child.labels && child.labels.length > 0) {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.name} attributes do not support labels`,
        span: child.span
      });
      return null;
    }
    tokens.push(child.key);
    const values = tokensFromValueStrict(child.value, diagnostics, parent, child.span, child.key);
    if (!values) return null;
    tokens.push(...values);
  }
  return tokens;
}

export function parseKeyValuePairs(
  tokens: Array<string | number>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  allowed: Set<string>
): Record<string, unknown> | null {
  if (tokens.length % 2 !== 0) {
    diagnostics.push({
      severity: 'error',
      message: 'Expected key/value pairs',
      span
    });
    return null;
  }
  const result: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length; i += 2) {
    const key = tokens[i];
    const value = tokens[i + 1];
    if (typeof key !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'Keys must be identifiers',
        span
      });
      return null;
    }
    if (!allowed.has(key)) {
      diagnostics.push({
        severity: 'error',
        message: `Unsupported key "${key}"`,
        span
      });
      return null;
    }
    result[key] = value;
  }
  return result;
}

export function parseListSegment(
  tokens: Array<string | number>,
  start: number,
  stopWords: Set<string>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  label: string
): { list: string[]; nextIndex: number } | null {

export function normalizeKindList(
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  label: string
): string[] | null {
  if (typeof value === 'string') {
    if (value === 'none') return [];
    return [value];
  }
  if (Array.isArray(value)) {
    const arr = value as unknown[];
    const items = arr.filter((entry): entry is string => typeof entry === 'string');
    if (items.length !== arr.length) {
      diagnostics.push({
        severity: 'error',
        message: `${label} must be a list of strings`,
        span: parent.span
      });
      return null;
    }
    return items;
  }
  diagnostics.push({
    severity: 'error',
    message: `${label} must be a string or list of strings`,
    span: parent.span
  });
  return null;
}

export function normalizeStringList(
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  label: string
): string[] | null {
  return normalizeKindList(value, diagnostics, parent, label);
}

export function isRelationshipDirection(value: string): boolean {
  return value === 'src' || value === 'dst' || value === 'both' || value === 'any' || value === 'in' || value === 'out';
}

export function flattenTokenList(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): string[] | null {
  let list: unknown[] = tokens;
  if (tokens.length === 1 && Array.isArray(tokens[0])) {
    list = tokens[0] as unknown[];
  }
  const result: string[] = [];
  for (const entry of list) {
    if (typeof entry !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'Expected a list of identifiers',
        span
      });
      return null;
    }
    result.push(entry);
  }
  return result;
}

export function applyLabelField(
  target: Record<string, unknown>,
  key: string,
  labelValue: string,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  const existing = target[key];
  if (existing !== undefined) {
    if (typeof existing !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: `${key} must be a string`,
        span: parent.span
      });
      return false;
    }
    if (existing !== labelValue) {
      diagnostics.push({
        severity: 'error',
        message: `${key} mismatch: label "${labelValue}" vs value "${existing}"`,
        span: parent.span
      });
      return false;
    }
  } else {
    target[key] = labelValue;
  }

  return true;
}

export function mapSaturationDirection(keyword: string): string | null {
  if (keyword === 'inbound' || keyword === 'in') return 'in';
  if (keyword === 'outbound' || keyword === 'out') return 'out';
  if (keyword === 'both') return 'both';
  return null;
}

export function parseListTokens(
  tokens: unknown[],
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  label: string
): { items: string[]; none: boolean } | null {

export function mergeListFieldValue(
  obj: Record<string, unknown>,
  key: string,
  parsed: { items: string[]; none: boolean },

export function parseInlineKeyValuePairs(
  rawValue: Value | Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  context: string
): Record<string, unknown> | null {
  if (isRecord(rawValue)) return rawValue;
  if (!isArrayValue(rawValue)) {
    diagnostics.push({
      severity: 'error',
      message: `${context} entries must use key value pairs`,
      span: parent.span
    });
    return null;
  }

  const items = rawValue.items;
  if (items.length === 0 || items.length % 2 !== 0) {
    diagnostics.push({
      severity: 'error',
      message: `${context} entries must use key value pairs`,
      span: parent.span
    });
    return null;
  }

  const obj: Record<string, unknown> = {};
  for (let index = 0; index < items.length; index += 2) {
    const key = coerceStringValue(items[index]);
    if (!key) {
      diagnostics.push({
        severity: 'error',
        message: `${context} keys must be identifiers or strings`,
        span: parent.span
      });
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      diagnostics.push({
        severity: 'error',
        message: `${context} key "${key}" is duplicated`,
        span: parent.span
      });
      return null;
    }
    const valueNode = items[index + 1];
    if (isArrayValue(valueNode) || isObjectValue(valueNode)) {
      diagnostics.push({
        severity: 'error',
        message: `${context} values must be single values`,
        span: parent.span
      });
      return null;
    }
    obj[key] = valueToJson(valueNode, diagnostics, parent);
  }

  return obj;
}

