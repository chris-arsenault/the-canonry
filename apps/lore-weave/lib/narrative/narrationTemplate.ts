/**
 * Narration Template System
 *
 * A shared template interpolation system for domain-controlled narration.
 * Used by actions, systems, and generators to produce narrative-quality text.
 *
 * Template Syntax:
 * - {entity.field} - Access entity fields (name, kind, subtype, culture, etc.)
 * - {$variable.field} - Access resolved variables from context
 * - {field|fallback} - Use fallback if field is null/undefined
 * - {count:kind} - Count of entities by kind from context
 * - {list:entityRef} - Comma-separated list of entity names
 * - {list:entityRef.field} - Comma-separated list of entity field values
 */

import type { HardState } from '../core/worldTypes';

/**
 * Context for template interpolation.
 * Provides access to entities and computed values.
 */
export interface NarrationContext {
  /** Named entity bindings (actor, target, $variable, etc.) */
  entities: Record<string, HardState | HardState[] | undefined>;
  /** Counts by entity kind */
  counts?: Record<string, number>;
  /** Additional string values */
  values?: Record<string, string | number | boolean>;
}

/**
 * Result of template interpolation.
 */
export interface NarrationResult {
  /** The interpolated text */
  text: string;
  /** Whether all tokens were successfully resolved */
  complete: boolean;
  /** Tokens that could not be resolved */
  unresolvedTokens: string[];
}

/**
 * Token types recognized by the parser.
 */
type TokenType =
  | 'entity_field'      // {actor.name}
  | 'variable_field'    // {$myVar.name}
  | 'count'             // {count:faction}
  | 'list'              // {list:members} or {list:members.name}
  | 'value';            // {someValue}

interface ParsedToken {
  type: TokenType;
  raw: string;
  entityRef?: string;
  field?: string;
  fallback?: string;
  countKind?: string;
  listRef?: string;
  listField?: string;
  valueKey?: string;
}

/**
 * Parse a template token like {actor.name|unknown} into its components.
 */
function parseToken(token: string): ParsedToken {
  // Remove braces
  const inner = token.slice(1, -1);

  // Check for fallback
  const [mainPart, fallback] = inner.split('|');
  const trimmedMain = mainPart.trim();
  const trimmedFallback = fallback?.trim();

  // Check for count: prefix
  if (trimmedMain.startsWith('count:')) {
    return {
      type: 'count',
      raw: token,
      countKind: trimmedMain.slice(6),
      fallback: trimmedFallback,
    };
  }

  // Check for list: prefix
  if (trimmedMain.startsWith('list:')) {
    const listPart = trimmedMain.slice(5);
    const dotIndex = listPart.indexOf('.');
    if (dotIndex !== -1) {
      return {
        type: 'list',
        raw: token,
        listRef: listPart.slice(0, dotIndex),
        listField: listPart.slice(dotIndex + 1),
        fallback: trimmedFallback,
      };
    }
    return {
      type: 'list',
      raw: token,
      listRef: listPart,
      listField: 'name', // default to name
      fallback: trimmedFallback,
    };
  }

  // Check for variable reference ($varName.field)
  if (trimmedMain.startsWith('$')) {
    const dotIndex = trimmedMain.indexOf('.');
    if (dotIndex !== -1) {
      return {
        type: 'variable_field',
        raw: token,
        entityRef: trimmedMain.slice(0, dotIndex),
        field: trimmedMain.slice(dotIndex + 1),
        fallback: trimmedFallback,
      };
    }
    // Variable without field - default to name
    return {
      type: 'variable_field',
      raw: token,
      entityRef: trimmedMain,
      field: 'name',
      fallback: trimmedFallback,
    };
  }

  // Check for entity.field pattern
  const dotIndex = trimmedMain.indexOf('.');
  if (dotIndex !== -1) {
    return {
      type: 'entity_field',
      raw: token,
      entityRef: trimmedMain.slice(0, dotIndex),
      field: trimmedMain.slice(dotIndex + 1),
      fallback: trimmedFallback,
    };
  }

  // Simple value reference
  return {
    type: 'value',
    raw: token,
    valueKey: trimmedMain,
    fallback: trimmedFallback,
  };
}

/**
 * Get a field value from an entity.
 */
function getEntityField(entity: HardState, field: string): string | undefined {
  switch (field) {
    case 'name':
      return entity.name;
    case 'id':
      return entity.id;
    case 'kind':
      return entity.kind;
    case 'subtype':
      return entity.subtype;
    case 'culture':
      return entity.culture;
    case 'status':
      return entity.status;
    case 'description':
      return entity.description;
    default:
      // Check tags
      if (entity.tags && field in entity.tags) {
        const tagValue = entity.tags[field];
        return typeof tagValue === 'string' ? tagValue : String(tagValue);
      }
      // Try direct property access for extensibility
      const value = (entity as unknown as Record<string, unknown>)[field];
      if (value !== undefined && value !== null) {
        return String(value);
      }
      return undefined;
  }
}

/**
 * Resolve an entity reference from context.
 */
function resolveEntityRef(
  ref: string,
  context: NarrationContext
): HardState | HardState[] | undefined {
  // Handle $ prefix for variables
  const key = ref.startsWith('$') ? ref : ref;
  return context.entities[key];
}

/**
 * Resolve a single token to its string value.
 */
function resolveToken(
  token: ParsedToken,
  context: NarrationContext
): string | undefined {
  switch (token.type) {
    case 'entity_field':
    case 'variable_field': {
      // Check if the key exists in context (even if undefined)
      const key = token.entityRef!.startsWith('$') ? token.entityRef! : token.entityRef!;
      const keyExists = key in context.entities;

      const entityOrArray = resolveEntityRef(token.entityRef!, context);
      if (!entityOrArray) {
        // If key exists but value is undefined, use fallback or empty string
        // (don't leave the literal token in the output)
        if (keyExists) {
          return token.fallback ?? '';
        }
        return token.fallback;
      }
      const entity = Array.isArray(entityOrArray) ? entityOrArray[0] : entityOrArray;
      if (!entity) {
        return token.fallback ?? '';
      }
      const value = getEntityField(entity, token.field!);
      return value ?? token.fallback;
    }

    case 'count': {
      const count = context.counts?.[token.countKind!];
      if (count === undefined) {
        return token.fallback;
      }
      return String(count);
    }

    case 'list': {
      const entityOrArray = resolveEntityRef(token.listRef!, context);
      if (!entityOrArray) {
        return token.fallback;
      }
      const entities = Array.isArray(entityOrArray) ? entityOrArray : [entityOrArray];
      if (entities.length === 0) {
        return token.fallback;
      }
      const values = entities
        .map((e) => getEntityField(e, token.listField!))
        .filter((v): v is string => v !== undefined);
      if (values.length === 0) {
        return token.fallback;
      }
      // Format list naturally: "A", "A and B", "A, B, and C"
      if (values.length === 1) {
        return values[0];
      }
      if (values.length === 2) {
        return `${values[0]} and ${values[1]}`;
      }
      return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
    }

    case 'value': {
      const value = context.values?.[token.valueKey!];
      if (value === undefined) {
        return token.fallback;
      }
      return String(value);
    }

    default:
      return token.fallback;
  }
}

/**
 * Find all tokens in a template string.
 */
function findTokens(template: string): string[] {
  const regex = /\{[^}]+\}/g;
  return template.match(regex) || [];
}

/**
 * Interpolate a narration template with context values.
 *
 * @param template - The template string with {token} placeholders
 * @param context - Context providing entity bindings and values
 * @returns The interpolated result
 *
 * @example
 * interpolate(
 *   "The {actor.subtype} {actor.name} marched on {target.name}, wresting it from {$previousOwner.name|the realm's grasp}.",
 *   {
 *     entities: {
 *       actor: { name: 'House Valorn', subtype: 'faction', ... },
 *       target: { name: 'Ironhold', ... },
 *       $previousOwner: undefined
 *     }
 *   }
 * )
 * // => "The faction House Valorn marched on Ironhold, wresting it from the realm's grasp."
 */
export function interpolate(template: string, context: NarrationContext): NarrationResult {
  const tokens = findTokens(template);
  const unresolvedTokens: string[] = [];
  let result = template;

  for (const tokenStr of tokens) {
    const token = parseToken(tokenStr);
    const resolved = resolveToken(token, context);

    if (resolved === undefined) {
      unresolvedTokens.push(tokenStr);
      // Leave token in place if no fallback
      continue;
    }

    result = result.replace(tokenStr, resolved);
  }

  return {
    text: result,
    complete: unresolvedTokens.length === 0,
    unresolvedTokens,
  };
}

/**
 * Create a NarrationContext from common action/system bindings.
 */
export function createNarrationContext(bindings: {
  actor?: HardState;
  target?: HardState;
  target2?: HardState;
  instigator?: HardState | null;
  variables?: Record<string, HardState | HardState[] | undefined>;
  counts?: Record<string, number>;
  values?: Record<string, string | number | boolean>;
}): NarrationContext {
  const entities: Record<string, HardState | HardState[] | undefined> = {};

  if (bindings.actor) {
    entities['actor'] = bindings.actor;
  }
  if (bindings.target) {
    entities['target'] = bindings.target;
  }
  if (bindings.target2) {
    entities['target2'] = bindings.target2;
  }
  // Always add instigator key if it was provided (even if null),
  // so templates can resolve to fallback or empty string
  if ('instigator' in bindings) {
    entities['instigator'] = bindings.instigator ?? undefined;
  }

  // Add variables with $ prefix
  if (bindings.variables) {
    for (const [key, value] of Object.entries(bindings.variables)) {
      // Ensure $ prefix for consistency
      const prefixedKey = key.startsWith('$') ? key : `$${key}`;
      entities[prefixedKey] = value;
    }
  }

  return {
    entities,
    counts: bindings.counts,
    values: bindings.values,
  };
}

/**
 * Helper to create context for system rules (connectionEvolution, etc.)
 */
export function createSystemRuleContext(bindings: {
  self?: HardState;
  member?: HardState;
  member2?: HardState;
  sharedVia?: HardState;
  variables?: Record<string, HardState | HardState[] | undefined>;
  counts?: Record<string, number>;
  values?: Record<string, string | number | boolean>;
}): NarrationContext {
  const entities: Record<string, HardState | HardState[] | undefined> = {};

  if (bindings.self) {
    entities['self'] = bindings.self;
    entities['$self'] = bindings.self;
  }
  if (bindings.member) {
    entities['member'] = bindings.member;
    entities['$member'] = bindings.member;
  }
  if (bindings.member2) {
    entities['member2'] = bindings.member2;
    entities['$member2'] = bindings.member2;
  }
  if (bindings.sharedVia) {
    entities['sharedVia'] = bindings.sharedVia;
    entities['$sharedVia'] = bindings.sharedVia;
  }

  if (bindings.variables) {
    for (const [key, value] of Object.entries(bindings.variables)) {
      const prefixedKey = key.startsWith('$') ? key : `$${key}`;
      entities[prefixedKey] = value;
    }
  }

  return {
    entities,
    counts: bindings.counts,
    values: bindings.values,
  };
}

/**
 * Helper to create context for template/generator execution
 */
export function createGeneratorContext(bindings: {
  target?: HardState;
  selected?: HardState;
  variables?: Record<string, HardState | HardState[] | undefined>;
  entitiesCreated?: HardState[];
  counts?: Record<string, number>;
  values?: Record<string, string | number | boolean>;
}): NarrationContext {
  const entities: Record<string, HardState | HardState[] | undefined> = {};

  if (bindings.target) {
    entities['target'] = bindings.target;
    entities['$target'] = bindings.target;
  }
  if (bindings.selected) {
    entities['selected'] = bindings.selected;
    entities['$selected'] = bindings.selected;
  }
  if (bindings.entitiesCreated) {
    entities['created'] = bindings.entitiesCreated;
    entities['$created'] = bindings.entitiesCreated;
  }

  if (bindings.variables) {
    for (const [key, value] of Object.entries(bindings.variables)) {
      const prefixedKey = key.startsWith('$') ? key : `$${key}`;
      entities[prefixedKey] = value;
      // Also without prefix for convenience
      entities[key.replace(/^\$/, '')] = value;
    }
  }

  return {
    entities,
    counts: bindings.counts,
    values: bindings.values,
  };
}
