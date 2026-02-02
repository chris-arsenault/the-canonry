/**
 * Tag Utilities
 *
 * Functions for working with EntityTags (key-value pair format).
 */

import { EntityTags } from '../core/worldTypes';

/**
 * Merge multiple tag objects. Later tags override earlier ones.
 */
export function mergeTags(...tagSets: (EntityTags | undefined)[]): EntityTags {
  const result: EntityTags = {};
  for (const tags of tagSets) {
    if (tags) {
      Object.assign(result, tags);
    }
  }
  return result;
}

/**
 * Check if an entity has a specific tag.
 * @param tags - The entity's tags
 * @param key - The tag key to check
 * @param value - Optional: specific value to match (if not provided, checks key existence)
 */
export function hasTag(tags: EntityTags | undefined, key: string, value?: string | boolean): boolean {
  if (!tags) return false;
  if (!(key in tags)) return false;
  if (value === undefined) return true;
  return tags[key] === value;
}

/**
 * Get a tag's value, with optional default.
 */
export function getTagValue<T extends string | boolean>(
  tags: EntityTags | undefined,
  key: string,
  defaultValue?: T
): T | undefined {
  if (!tags || !(key in tags)) return defaultValue;
  return tags[key] as T;
}

/**
 * Get all tag keys that have truthy values.
 */
export function getTrueTagKeys(tags: EntityTags | undefined): string[] {
  if (!tags) return [];
  return Object.entries(tags)
    .filter(([_, value]) => value === true)
    .map(([key]) => key);
}

/**
 * Get all string-valued tags as key-value entries.
 */
export function getStringTags(tags: EntityTags | undefined): Array<[string, string]> {
  if (!tags) return [];
  return Object.entries(tags)
    .filter(([_, value]) => typeof value === 'string')
    .map(([key, value]) => [key, value as string]);
}


/**
 * Convert array tags to EntityTags (KVP) format.
 * Plain strings become boolean true, "key:value" becomes string value.
 */
export function arrayToTags(arr: string[] | undefined): EntityTags {
  if (!arr) return {};
  const result: EntityTags = {};
  for (const tag of arr) {
    if (tag.startsWith('!')) {
      result[tag.slice(1)] = false;
    } else if (tag.includes(':')) {
      const [key, ...valueParts] = tag.split(':');
      result[key] = valueParts.join(':');
    } else {
      result[tag] = true;
    }
  }
  return result;
}
