/**
 * annotateEntityNames — inline entity type annotations in text.
 *
 * Replaces first occurrence of each entity name with
 * `Name (kind/subtype, culture)` so downstream LLM consumers
 * see entity classification in immediate context.
 *
 * Idempotent: skips names already followed by a parenthetical.
 */

import type { EntityNavItem } from './db/entityNav';

interface Candidate {
  name: string;
  annotation: string;
}

function buildAnnotation(item: EntityNavItem): string {
  const type = item.subtype ? `${item.kind}/${item.subtype}` : item.kind;
  return `${item.name} (${type}, ${item.culture})`;
}

/**
 * Annotate entity names inline in `text`.
 *
 * - Filters names < 4 chars (avoids "Ice", "Ash", etc.)
 * - Filters era entities (era names appear everywhere)
 * - Sorts by name length descending to prevent partial matches
 * - Annotates first occurrence only, case-sensitive
 * - Tracks character ranges to prevent overlapping annotations
 * - Idempotent: skips names already followed by ` (`
 */
export function annotateEntityNames(
  text: string,
  navItems: Map<string, EntityNavItem>,
): string {
  // Build candidates
  const candidates: Candidate[] = [];
  for (const item of navItems.values()) {
    if (item.name.length < 4) continue;
    if (item.kind === 'era') continue;
    candidates.push({
      name: item.name,
      annotation: buildAnnotation(item),
    });
  }

  // Longest first — prevents partial matches (e.g. "The Pinnacle" before "Pinnacle")
  candidates.sort((a, b) => b.name.length - a.name.length);

  // Track annotated regions to prevent overlaps
  const annotatedRanges: Array<[number, number]> = [];

  const overlaps = (start: number, end: number): boolean =>
    annotatedRanges.some(([rs, re]) => start < re && end > rs);

  let result = text;
  let offset = 0; // cumulative offset from prior replacements

  for (const { name, annotation } of candidates) {
    const idx = result.indexOf(name);
    if (idx === -1) continue;

    // Already annotated? Check if followed by ` (`
    const afterName = idx + name.length;
    if (result.length > afterName + 1 && result[afterName] === ' ' && result[afterName + 1] === '(') {
      continue;
    }

    // Check overlap with already-annotated regions
    const originalStart = idx - offset;
    const originalEnd = originalStart + name.length;
    if (overlaps(originalStart, originalEnd)) continue;

    // Replace
    result = result.slice(0, idx) + annotation + result.slice(afterName);

    // Track the annotated region in original-text coordinates
    annotatedRanges.push([originalStart, originalStart + annotation.length]);

    // Update offset
    offset += annotation.length - name.length;
  }

  return result;
}
