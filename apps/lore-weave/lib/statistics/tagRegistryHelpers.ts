/**
 * Tag Registry Helper Functions
 *
 * Parameterized utility functions for working with tag registries.
 * These are pure functions that take the registry as a parameter,
 * allowing domain to provide its own tag registry configuration.
 */

import { TagMetadata } from '../engine/types';
import { EntityTags } from '../core/worldTypes';

/**
 * Get tag metadata by tag name
 */
export function getTagMetadata(registry: TagMetadata[], tag: string): TagMetadata | undefined {
  return registry.find(t => t.tag === tag);
}

/**
 * Get all tags in a category
 */
export function getTagsByCategory(registry: TagMetadata[], category: TagMetadata['category']): TagMetadata[] {
  return registry.filter(t => t.category === category);
}

/**
 * Get consolidation suggestions (tags that should be merged)
 */
export function getConsolidationSuggestions(registry: TagMetadata[]): Array<{ from: string; to: string }> {
  return registry
    .filter(t => t.consolidateInto)
    .map(t => ({ from: t.tag, to: t.consolidateInto }));
}

/**
 * Check if two tags conflict
 */
export function tagsConflict(registry: TagMetadata[], tag1: string, tag2: string): boolean {
  const metadata1 = getTagMetadata(registry, tag1);
  const metadata2 = getTagMetadata(registry, tag2);

  if (!metadata1 || !metadata2) return false;

  return metadata1.conflictingTags.includes(tag2) ||
         metadata2.conflictingTags.includes(tag1);
}

/**
 * Validate that an entity's tags don't have conflicts.
 * Accepts EntityTags (KVP format) and checks tag keys for conflicts.
 */
export function validateEntityTags(
  registry: TagMetadata[],
  tags: EntityTags | undefined
): { valid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  if (!tags) {
    return { valid: true, conflicts: [] };
  }

  const tagKeys = Object.keys(tags);

  for (let i = 0; i < tagKeys.length; i++) {
    for (let j = i + 1; j < tagKeys.length; j++) {
      if (tagsConflict(registry, tagKeys[i], tagKeys[j])) {
        conflicts.push(`${tagKeys[i]} conflicts with ${tagKeys[j]}`);
      }
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts
  };
}
