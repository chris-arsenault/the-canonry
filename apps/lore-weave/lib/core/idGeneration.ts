/**
 * ID Generation Utilities
 *
 * Functions for generating unique identifiers.
 */

// ID generation counter
let idCounter = 1000;
let eventCounter = 0;

export function generateId(prefix: string): string {
  return `${prefix}_${idCounter++}`;
}

/**
 * Generate a globally unique ID for narrative events.
 */
export function generateEventId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) {
    return `event_${cryptoObj.randomUUID()}`;
  }
  return `event_${Date.now()}_${eventCounter++}`;
}

// ID generation for lore records
let loreRecordCounter = 0;

/**
 * Generate unique ID for lore records with timestamp and counter
 */
export function generateLoreId(prefix: string): string {
  return `${prefix}_${Date.now()}_${loreRecordCounter++}`;
}
