/**
 * annotateEntityNames — inline entity type annotations in text.
 *
 * Replaces first occurrence of each entity name with
 * `Name (kind/subtype, culture)` so downstream LLM consumers
 * see entity classification in immediate context.
 *
 * Idempotent: skips names already followed by a parenthetical.
 */

import type { EntityNavItem } from "./db/entityNav";

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
 * - Tracks character ranges in the mutated string to prevent overlapping annotations
 * - Idempotent: skips names already followed by ` (`
 */
function buildCandidates(navItems: Map<string, EntityNavItem>): Candidate[] {
  const candidates: Candidate[] = [];
  for (const item of navItems.values()) {
    if (item.name.length < 4) continue;
    if (item.kind === "era") continue;
    candidates.push({ name: item.name, annotation: buildAnnotation(item) });
  }
  // Longest first -- prevents partial matches (e.g. "The Pinnacle" before "Pinnacle")
  candidates.sort((a, b) => b.name.length - a.name.length);
  return candidates;
}

function isAlreadyAnnotated(text: string, afterName: number): boolean {
  return (
    text.length > afterName + 1 &&
    text[afterName] === " " &&
    text[afterName + 1] === "("
  );
}

function shiftRanges(
  ranges: Array<[number, number]>,
  afterName: number,
  delta: number
): void {
  for (let i = 0; i < ranges.length; i++) {
    const [rs, re] = ranges[i];
    if (rs >= afterName) {
      ranges[i] = [rs + delta, re + delta];
    }
  }
}

export function annotateEntityNames(text: string, navItems: Map<string, EntityNavItem>): string {
  const candidates = buildCandidates(navItems);

  // Track annotated regions in the mutated string's coordinates.
  // After each replacement the ranges shift -- we adjust all existing ranges
  // so overlap checks always work against current positions.
  const annotatedRanges: Array<[number, number]> = [];
  const overlaps = (start: number, end: number): boolean =>
    annotatedRanges.some(([rs, re]) => start < re && end > rs);

  let result = text;

  for (const { name, annotation } of candidates) {
    const idx = result.indexOf(name);
    if (idx === -1) continue;

    const afterName = idx + name.length;
    if (isAlreadyAnnotated(result, afterName)) continue;
    if (overlaps(idx, afterName)) continue;

    result = result.slice(0, idx) + annotation + result.slice(afterName);
    const delta = annotation.length - name.length;
    shiftRanges(annotatedRanges, afterName, delta);
    annotatedRanges.push([idx, idx + annotation.length]);
  }

  return result;
}
