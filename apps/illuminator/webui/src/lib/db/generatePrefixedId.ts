/**
 * Canonical prefixed ID generator.
 *
 * Produces IDs in the format: prefix_timestamp_randomSlice
 * Used across all Illuminator repositories for database record keys.
 */
export function generatePrefixedId(prefix: string, sliceLength = 8): string {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, sliceLength)}`;
}
