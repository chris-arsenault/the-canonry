/**
 * Array and JSON Utilities
 *
 * Generic utility functions for arrays and JSON parsing.
 */

/**
 * Safely parse JSON with automatic cleanup of markdown code blocks.
 * Returns null if parsing fails.
 */
export function parseJsonSafe<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Split an array into chunks of a specified size.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
