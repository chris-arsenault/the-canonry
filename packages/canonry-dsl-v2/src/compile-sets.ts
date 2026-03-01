import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
} from './types.js';

import type { SetDefinition } from './compile-types.js';
import { SET_FIELD_KEYS } from './compile-types.js';
import { isObjectValue, isArrayValue, isRecord, coerceStringValue } from './compile-utils.js';
import { activeEvalContext, valueToJson } from './compile-variables.js';

export function parseSetIncludeValue(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode
): string | null {
  if (isArrayValue(value) || isObjectValue(value) || Array.isArray(value)) {
    diagnostics.push({
      severity: 'error',
      message: 'include requires a single set identifier',
      span: parent.span
    });
    return null;
  }
  const raw = valueToJson(value, diagnostics, parent);
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length !== 1 || typeof list[0] !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'include requires a single set identifier',
      span: parent.span
    });
    return null;
  }
  return list[0];
}

export function parseSetBlockItems(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): { items: string[]; includes: string[]; none: boolean } | null {

export function collectSetDefinitions(
  blocks: BlockNode[],
  diagnostics: Diagnostic[]
): { blocks: BlockNode[]; sets: Map<string, string[]> } {

export function parseSetTokens(
  tokens: unknown[],
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): { items: string[]; includes: string[]; none: boolean } | null {

export function resolveSetIncludes(
  includes: string[],
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): string[] | null {
  if (includes.length === 0) return [];
  const registry = activeEvalContext?.sets;
  if (!registry) {
    diagnostics.push({
      severity: 'error',
      message: 'set includes are not available in this context',
      span
    });
    return null;
  }
  const output: string[] = [];
  const seen = new Set<string>();
  for (const name of includes) {
    const set = registry.get(name);
    if (!set) {
      diagnostics.push({
        severity: 'error',
        message: `Unknown set "${name}"`,
        span
      });
      return null;
    }
    for (const item of set) {
      if (seen.has(item)) continue;
      seen.add(item);
      output.push(item);
    }
  }
  return output;
}

export function normalizeExistingSetValue(
  value: unknown,
  diagnostics: Diagnostic[],
  span: BlockNode['span']
): string[] | null {
  if (value === undefined) return [];
  if (value === 'none') return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    if (!value.every((entry) => typeof entry === 'string')) {
      diagnostics.push({
        severity: 'error',
        message: 'set fields only support identifiers or strings',
        span
      });
      return null;
    }
    return value;
  }
  diagnostics.push({
    severity: 'error',
    message: 'set fields only support identifiers or strings',
    span
  });
  return null;
}

export function mergeSetFieldValue(
  obj: Record<string, unknown>,
  key: string,
  parsed: { items: string[]; includes: string[]; none: boolean },

export function applySetFieldAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,

export function applySetFieldBlock(
  stmt: BlockNode,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[]
): void {
  const parsed = parseSetBlockItems(stmt.body, diagnostics, stmt);
  if (!parsed) return;
  mergeSetFieldValue(obj, stmt.name, parsed, diagnostics, stmt.span);
}

