/**
 * Chronicle V2 Pipeline
 *
 * Single-shot chronicle generation - one LLM call instead of 5+ stages.
 * Simpler entity selection, direct prose output, deterministic post-processing.
 */

export { selectEntitiesV2 } from './selectionV2';
export {
  buildV2Prompt,
  getMaxTokensFromStyle,
  getV2SystemPrompt,
} from './promptBuilder';
export {
  DEFAULT_V2_CONFIG,
  type V2SelectionConfig,
  type V2SelectionResult,
  type V2GenerationResult,
} from './types';

import type { EntityContext } from '../chronicleTypes';

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a position in the string is inside a [[wikilink]].
 */
function isInsideWikilink(text: string, position: number): boolean {
  // Find the most recent [[ or ]] before this position
  let depth = 0;
  for (let i = 0; i < position; i++) {
    if (text[i] === '[' && text[i + 1] === '[') {
      depth++;
      i++; // Skip next char
    } else if (text[i] === ']' && text[i + 1] === ']') {
      depth = Math.max(0, depth - 1);
      i++; // Skip next char
    }
  }
  return depth > 0;
}

/**
 * Apply wikilinks to content deterministically.
 * Replaces entity name mentions with [[entity]] syntax.
 *
 * Process: Replaces all mentions in a single pass using a combined regex
 * to avoid offset issues from multiple sequential replacements.
 */
export function applyWikilinks(
  content: string,
  entities: EntityContext[]
): string {
  // Filter and sort entities by name length descending
  // (match longer names first to avoid partial matches)
  const validEntities = entities
    .filter((e) => e.name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length);

  if (validEntities.length === 0) return content;

  // Build a single regex that matches any entity name
  const patterns = validEntities.map((e) => `\\b${escapeRegex(e.name)}\\b`);
  const combinedPattern = new RegExp(`(${patterns.join('|')})`, 'gi');

  // Single pass replacement - check each match to see if already linked
  return content.replace(combinedPattern, (match, _group, offset) => {
    // Check if this position is already inside a wikilink
    if (isInsideWikilink(content, offset)) {
      return match;
    }
    return `[[${match}]]`;
  });
}
