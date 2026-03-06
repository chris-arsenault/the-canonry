/**
 * ID Generation Utilities
 *
 * Functions for generating unique identifiers.
 */

// ID generation counter
let idCounter = 1000;

export function generateId(prefix: string): string {
  return `${prefix}_${idCounter++}`;
}

/**
 * Generate a prefixed ID with timestamp and random UUID slice.
 * Canonical pattern: prefix_timestamp_randomSlice
 */
function generatePrefixedId(prefix: string, sliceLength = 8): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, sliceLength)}`;
}

/**
 * Generate a globally unique ID for narrative events.
 */
export function generateEventId(): string {
  return generatePrefixedId("event");
}

/**
 * Generate unique ID for lore records with timestamp and random component.
 */
export function generateLoreId(prefix: string): string {
  return generatePrefixedId(prefix);
}
