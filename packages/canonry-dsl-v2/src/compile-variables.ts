import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
  AttributeNode,
  AstFile,
  CallValue,
} from './types.js';

import type { EvalContext, VariableEntry, ResourceEntry } from './compile-types.js';
import { VARIABLE_BLOCK_NAMES, VARIABLE_ATTRIBUTE_KEYS, VARIABLE_REFERENCE_PREFIXES, RESOURCE_BLOCKS, NAMING_RESOURCE_BLOCKS } from './compile-types.js';
import { isObjectValue, isRecord, isIdentifierValue, isCallValue, isArrayValue } from './compile-utils.js';

export let activeEvalContext: EvalContext | null = null;

export function collectVariables(
  astFiles: AstFile[],
  diagnostics: Diagnostic[]
): { files: AstFile[]; variables: Map<string, VariableEntry> } {

export function registerVariableBlock(
  stmt: BlockNode,
  variables: Map<string, VariableEntry>,
  diagnostics: Diagnostic[]
): void {
  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.name} blocks only support attribute assignments`,
        span: child.span
      });
      continue;
    }
    if (child.labels && child.labels.length > 0) {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.name} assignments cannot use labels`,
        span: child.span
      });
      continue;
    }
    registerVariableEntry(child.key, child.value, child.span, variables, diagnostics);
  }
}

export function registerVariableAttribute(
  stmt: AttributeNode,
  variables: Map<string, VariableEntry>,
  diagnostics: Diagnostic[]
): void {
  if (!isObjectValue(stmt.value)) {
    diagnostics.push({
      severity: 'error',
      message: `${stmt.key} requires key:value pairs`,
      span: stmt.span
    });
    return;
  }
  for (const entry of stmt.value.entries) {
    registerVariableEntry(entry.key, entry.value, entry.span, variables, diagnostics);
  }
}

export function registerVariableEntry(
  name: string,
  value: Value,
  span: BlockNode['span'],
  variables: Map<string, VariableEntry>,
  diagnostics: Diagnostic[]
): void {
  if (name.includes('.')) {
    diagnostics.push({
      severity: 'error',
      message: `Variable names cannot contain "." (found "${name}")`,
      span
    });
    return;
  }
  if (variables.has(name)) {
    diagnostics.push({
      severity: 'error',
      message: `Duplicate variable "${name}"`,
      span
    });
    return;
  }
  variables.set(name, { name, value, span });
}

export function expandStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[]
): StatementNode[] {
  const expanded: StatementNode[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'block') {
      if (stmt.name === 'def') {
        diagnostics.push({
          severity: 'error',
          message: 'def blocks are no longer supported; declare resources directly',
          span: stmt.span
        });
        continue;
      }
      if (VARIABLE_BLOCK_NAMES.has(stmt.name)) {
        diagnostics.push({
          severity: 'error',
          message: `${stmt.name} blocks are only allowed at the top level`,
          span: stmt.span
        });
        continue;
      }
      const body = expandStatements(stmt.body, diagnostics);
      if (body !== stmt.body) {
        expanded.push({ ...stmt, body });
      } else {
        expanded.push(stmt);
      }
      continue;
    }

    expanded.push(stmt);
  }

  return expanded;
}

export function createEvalContext(
  variables: Map<string, VariableEntry>,
  resources: Map<string, ResourceEntry[]>,
  sets: Map<string, string[]>,
  diagnostics: Diagnostic[]
): EvalContext {
  return {
    variables,
    resources,
    sets,
    resolved: new Map<string, unknown>(),
    resolving: new Set<string>(),
    diagnostics
  };
}

export function withEvalContext<T>(ctx: EvalContext, fn: () => T): T {
  const previous = activeEvalContext;
  activeEvalContext = ctx;
  try {
    return fn();
  } finally {
    activeEvalContext = previous;
  }
}

export function collectResourceRegistry(blocks: BlockNode[]): Map<string, ResourceEntry[]> {
  const resources = new Map<string, ResourceEntry[]>();
  const namingIdsByType = new Map<string, Set<string>>();

  for (const block of blocks) {
    if (!RESOURCE_BLOCKS.has(block.name)) continue;
    const name = block.labels[0];
    if (!name) continue;

    if (NAMING_RESOURCE_BLOCKS.has(block.name)) {
      const seen = namingIdsByType.get(block.name) ?? new Set<string>();
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      namingIdsByType.set(block.name, seen);
    }

    const entry: ResourceEntry = {
      name,
      id: name,
      type: block.name,
      span: block.span
    };
    const existing = resources.get(name);
    if (existing) {
      existing.push(entry);
    } else {
      resources.set(name, [entry]);
    }
  }

  return resources;
}

export function parseVariableReference(value: string): { name: string; path: string[] } | null {

export function resolveResourceReference(
  value: string,
  ctx: EvalContext | null,
  span: BlockNode['span'],
  diagnostics: Diagnostic[],
  allowedTypes?: string[],
  allowAmbiguous = false
): string | null {
  if (!ctx) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [name, attr] = parts;
  if (!name || attr !== 'id') return null;
  const resources = ctx.resources.get(name) || [];
  const matches = allowedTypes && allowedTypes.length > 0
    ? resources.filter((entry) => allowedTypes.includes(entry.type))
    : resources;
  if (matches.length === 0) return null;
  if (matches.length > 1 && !allowAmbiguous) {
    diagnostics.push({
      severity: 'error',
      message: `Ambiguous resource reference "${value}" (matches ${matches.map(entry => entry.type).join(', ')})`,
      span
    });
    return null;
  }
  return matches[0].id;
}

export function parseResourceReferenceString(
  raw: string,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  label: string,
  allowedTypes?: string[],
  allowAmbiguous = false
): string | null {
  const parts = raw.split('.');
  if (parts.length !== 2 || parts[1] !== 'id' || !parts[0]) {
    diagnostics.push({
      severity: 'error',
      message: `${label} reference must use "<name>.id"`,
      span
    });
    return null;
  }
  const resolved = resolveResourceReference(raw, activeEvalContext, span, diagnostics, allowedTypes, allowAmbiguous);
  if (resolved === null) {
    diagnostics.push({
      severity: 'error',
      message: `Unknown ${label} reference "${raw}"`,
      span
    });
    return null;
  }
  return resolved;
}

export function parseResourceReferenceValue(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  label: string,
  options?: { allowArray?: boolean; allowedTypes?: string[]; allowAmbiguous?: boolean }

export function parseResourceReferenceLabel(
  label: string | undefined,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  name: string,
  allowedTypes?: string[],
  allowAmbiguous = false
): string | null {
  if (!label) {
    diagnostics.push({
      severity: 'error',
      message: `${name} reference must use "<name>.id"`,
      span
    });
    return null;
  }
  return parseResourceReferenceString(label, diagnostics, span, name, allowedTypes, allowAmbiguous);
}

export function resolveVariablePath(
  ref: { name: string; path: string[] },

export function resolveVariableValue(
  name: string,
  ctx: EvalContext,
  span: BlockNode['span']
): unknown {
  if (ctx.resolved.has(name)) {
    return ctx.resolved.get(name);
  }
  if (ctx.resolving.has(name)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Circular variable reference "${name}"`,
      span
    });
    return null;
  }
  const entry = ctx.variables.get(name);
  if (!entry) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unknown variable "${name}"`,
      span
    });
    return null;
  }

  ctx.resolving.add(name);
  const parent: BlockNode = {
    type: 'block',
    name: 'vars',
    labels: [],
    body: [],
    span: entry.span
  };
  const resolved = valueToJson(entry.value, ctx.diagnostics, parent);
  ctx.resolving.delete(name);
  ctx.resolved.set(name, resolved);
  return resolved;
}

export function evaluateCallExpression(
  call: CallValue,
  diagnostics: Diagnostic[],
  parent: BlockNode
): unknown {
  const name = call.name;
  const args = call.args || [];

  const evaluateArg = (index: number): unknown => {
    if (index < 0 || index >= args.length) return null;
    return valueToJson(args[index], diagnostics, parent);
  };

  const requireArgs = (min: number, max?: number): boolean => {
    if (args.length < min || (max !== undefined && args.length > max)) {
      const range = max !== undefined ? `${min}-${max}` : `${min}+`;
      diagnostics.push({
        severity: 'error',
        message: `${name} requires ${range} argument(s)`,
        span: call.span
      });
      return false;
    }
    return true;
  };

  const ensureArray = (value: unknown, index: number): unknown[] | null => {
    if (!Array.isArray(value)) {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be an array`,
        span: call.span
      });
      return null;
    }
    return value as unknown[];
  };

  const ensureObject = (value: unknown, index: number): Record<string, unknown> | null => {
    if (!isRecord(value)) {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be an object`,
        span: call.span
      });
      return null;
    }
    return value;
  };

  const ensureString = (value: unknown, index: number): string | null => {
    if (typeof value !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be a string`,
        span: call.span
      });
      return null;
    }
    return value;
  };

  const ensureBoolean = (value: unknown, index: number): boolean | null => {
    if (typeof value !== 'boolean') {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be a boolean`,
        span: call.span
      });
      return null;
    }
    return value;
  };

  if (name === 'if') {
    if (!requireArgs(3, 3)) return null;
    const condition = evaluateArg(0);
    const bool = ensureBoolean(condition, 0);
    if (bool === null) return null;
    return bool ? evaluateArg(1) : evaluateArg(2);
  }

  if (name === 'coalesce') {
    if (!requireArgs(1)) return null;
    for (let i = 0; i < args.length; i += 1) {
      const value = evaluateArg(i);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }

  if (name === 'default') {
    if (!requireArgs(2, 2)) return null;
    const primary = evaluateArg(0);
    return primary === null || primary === undefined ? evaluateArg(1) : primary;
  }

  if (name === 'merge') {
    if (!requireArgs(1)) return null;
    const result: Record<string, unknown> = {};
    for (let i = 0; i < args.length; i += 1) {
      const value = evaluateArg(i);
      const obj = ensureObject(value, i);
      if (!obj) return null;
      Object.assign(result, obj);
    }
    return result;
  }

  if (name === 'concat') {
    if (!requireArgs(1)) return null;
    const result: unknown[] = [];
    for (let i = 0; i < args.length; i += 1) {
      const value = evaluateArg(i);
      const list = ensureArray(value, i);
      if (!list) return null;
      result.push(...list);
    }
    return result;
  }

  if (name === 'distinct') {
    if (!requireArgs(1, 1)) return null;
    const list = ensureArray(evaluateArg(0), 0);
    if (!list) return null;
    const output: unknown[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      if (item === null || item === undefined) continue;
      if (typeof item === 'object') {
        diagnostics.push({
          severity: 'error',
          message: `${name} only supports primitive values`,
          span: call.span
        });
        return null;
      }
      const key = `${typeof item}:${String(item)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
    return output;
  }

  if (name === 'sort') {
    if (!requireArgs(1, 1)) return null;
    const list = ensureArray(evaluateArg(0), 0);
    if (!list) return null;
    const numbers = list.every((item) => typeof item === 'number');
    const strings = list.every((item) => typeof item === 'string');
    if (!numbers && !strings) {
      diagnostics.push({
        severity: 'error',
        message: `${name} only supports string or number arrays`,
        span: call.span
      });
      return null;
    }
    const copy = [...list];
    if (numbers) {
      copy.sort((a, b) => (a as number) - (b as number));
    } else {
      copy.sort((a, b) => String(a).localeCompare(String(b)));
    }
    return copy;
  }

  if (name === 'join') {
    if (!requireArgs(2, 2)) return null;
    const separator = ensureString(evaluateArg(0), 0);
    const list = ensureArray(evaluateArg(1), 1);
    if (!separator || !list) return null;
    if (!list.every((item) => typeof item === 'string')) {
      diagnostics.push({
        severity: 'error',
        message: `${name} list must contain only strings`,
        span: call.span
      });
      return null;
    }
    return (list).join(separator);
  }

  if (name === 'upper' || name === 'lower') {
    if (!requireArgs(1, 1)) return null;
    const value = ensureString(evaluateArg(0), 0);
    if (!value) return null;
    return name === 'upper' ? value.toUpperCase() : value.toLowerCase();
  }

  if (name === 'replace') {
    if (!requireArgs(3, 3)) return null;
    const source = ensureString(evaluateArg(0), 0);
    const match = ensureString(evaluateArg(1), 1);
    const replacement = ensureString(evaluateArg(2), 2);
    if (!source || match === null || replacement === null) return null;
    return source.split(match).join(replacement);
  }

  if (name === 'lookup') {
    if (!requireArgs(2, 3)) return null;
    const target = ensureObject(evaluateArg(0), 0);
    const key = ensureString(evaluateArg(1), 1);
    if (!target || !key) return null;
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      return target[key];
    }
    return args.length === 3 ? evaluateArg(2) : null;
  }

  if (name === 'keys' || name === 'values') {
    if (!requireArgs(1, 1)) return null;
    const target = ensureObject(evaluateArg(0), 0);
    if (!target) return null;
    return name === 'keys' ? Object.keys(target) : Object.values(target);
  }

  if (name === 'length') {
    if (!requireArgs(1, 1)) return null;
    const target = evaluateArg(0);
    if (typeof target === 'string' || Array.isArray(target)) {
      return target.length;
    }
    if (isRecord(target)) {
      return Object.keys(target).length;
    }
    diagnostics.push({
      severity: 'error',
      message: `${name} only supports strings, arrays, or objects`,
      span: call.span
    });
    return null;
  }

  if (name === 'and' || name === 'or') {
    if (!requireArgs(1)) return null;
    const values = args.map((_, index) => evaluateArg(index));
    if (!values.every((value) => typeof value === 'boolean')) {
      diagnostics.push({
        severity: 'error',
        message: `${name} only supports boolean arguments`,
        span: call.span
      });
      return null;
    }
    return name === 'and'
      ? values.every(Boolean)
      : values.some(Boolean);
  }

  if (name === 'not') {
    if (!requireArgs(1, 1)) return null;
    const value = ensureBoolean(evaluateArg(0), 0);
    if (value === null) return null;
    return !value;
  }

  diagnostics.push({
    severity: 'error',
    message: `Unsupported call "${name}"`,
    span: call.span
  });
  return null;
}

export function valueToJson(value: Value, diagnostics: Diagnostic[], parent: BlockNode): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (isIdentifierValue(value)) {
    const ref = parseVariableReference(value.value);
    if (ref) {
      return resolveVariablePath(ref, activeEvalContext, value.span, diagnostics);
    }
    return value.value;
  }

  if (isCallValue(value)) {
    return evaluateCallExpression(value, diagnostics, parent);
  }

  if (isArrayValue(value)) {
    return value.items.map(item => valueToJson(item, diagnostics, parent));
  }

  if (isObjectValue(value)) {
    const obj: Record<string, unknown> = {};
    for (const entry of value.entries) {
      const jsonValue = valueToJson(entry.value, diagnostics, parent);
      setObjectValue(obj, entry.key, jsonValue);
    }
    return obj;
  }

  return value;
}

