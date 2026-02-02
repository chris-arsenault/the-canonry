/**
 * Resolve entity/event references by id or name.
 */

export type ReferenceLookup = {
  ids: Map<string, string>;
  names: Map<string, string | null>;
};

function stripReferenceDecorators(value: string): string {
  return value.replace(/[\[\]]/g, '');
}

function normalizeId(value: string): string {
  return stripReferenceDecorators(value).trim().toLowerCase();
}

function normalizeName(value: string): string {
  return stripReferenceDecorators(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildReferenceLookup<T>(
  items: T[],
  getId: (item: T) => string,
  getName: (item: T) => string | undefined
): ReferenceLookup {
  const ids = new Map<string, string>();
  const names = new Map<string, string | null>();

  for (const item of items) {
    const id = getId(item);
    if (id) {
      ids.set(normalizeId(id), id);
    }
    const name = getName(item);
    if (!name) continue;
    const normalized = normalizeName(name);
    if (!names.has(normalized)) {
      names.set(normalized, id);
    } else if (names.get(normalized) !== id) {
      names.set(normalized, null);
    }
  }

  return { ids, names };
}

export function resolveReference(value: string, lookup: ReferenceLookup): string {
  const rawValue = String(value);
  const directMatch = lookup.ids.get(normalizeId(rawValue));
  if (directMatch) {
    return directMatch;
  }
  const nameMatch = lookup.names.get(normalizeName(rawValue));
  return nameMatch || rawValue;
}
