/**
 * Motif weaver scanning — sentence extraction and concept matching.
 */

import type { WeaveCandidate } from "./types";

export const CONTEXT_RADIUS = 150;
export const BATCH_SIZE = 25;
export const TARGET_PHRASE = "the ice remembers";

// Targets the ice-as-archive concept, not incidental ice mentions.
// Split into two patterns to reduce regex complexity.
const ICE_MEMORY_PRIMARY =
  /ice[\s-]memor(?:y|ies)|the ice preserve[sd]|preserved in the ice|impressions? (?:in|frozen into) the ice/gi;
const ICE_MEMORY_SECONDARY =
  /ice[\s-]testimon|ice[\s-]record|the substrate(?:'s)? (?:record|testimon|memor)/gi;
const ALREADY_HAS_PHRASE = /the ice remembers/i;

// ============================================================================
// Sentence extraction
// ============================================================================

/** Walk backward from matchStart to find the beginning of the sentence. */
function findSentenceStart(text: string, matchStart: number): number {
  let start = matchStart;
  while (start > 0) {
    const ch = text[start - 1];
    if (ch === "\n") break;
    if (ch === "." && start > 1 && /\s/.test(text[start])) break;
    start--;
  }
  // Skip leading whitespace
  while (start < matchStart && /\s/.test(text[start])) start++;
  return start;
}

/** Walk forward from matchEnd to find the end of the sentence. */
function findSentenceEnd(text: string, matchEnd: number): number {
  let end = matchEnd;
  while (end < text.length) {
    const ch = text[end];
    if (ch === "\n") break;
    if (ch === "." && (end + 1 >= text.length || /\s/.test(text[end + 1]))) {
      end++; // include the period
      break;
    }
    end++;
  }
  return end;
}

/**
 * Find the sentence boundaries around a regex match position.
 * Sentences end at period-space, period-newline, newline-newline, or string boundary.
 */
export function extractSentence(
  text: string,
  matchStart: number,
  matchEnd: number,
): { sentence: string; start: number; end: number } {
  const start = findSentenceStart(text, matchStart);
  const end = findSentenceEnd(text, matchEnd);
  return { sentence: text.slice(start, end), start, end };
}

// ============================================================================
// Scan Logic
// ============================================================================

/** Collect all ice-memory regex matches from both patterns, sorted by index. */
function collectIceMemoryMatches(description: string): RegExpExecArray[] {
  const allMatches: RegExpExecArray[] = [];
  for (const pattern of [ICE_MEMORY_PRIMARY, ICE_MEMORY_SECONDARY]) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(description)) !== null) {
      allMatches.push(m);
    }
  }
  allMatches.sort((a, b) => a.index - b.index);
  return allMatches;
}

export function scanDescriptionForConcepts(
  entityId: string,
  entityName: string,
  description: string,
  startIndex: number,
): WeaveCandidate[] {
  // Skip entities that already contain the target phrase
  if (ALREADY_HAS_PHRASE.test(description)) return [];

  const candidates: WeaveCandidate[] = [];
  const seenSentences = new Set<string>(); // dedupe overlapping matches in same sentence
  let idx = startIndex;

  const allMatches = collectIceMemoryMatches(description);

  for (const regexMatch of allMatches) {
    const { sentence, start, end } = extractSentence(
      description,
      regexMatch.index,
      regexMatch.index + regexMatch[0].length,
    );

    // Dedupe: if we already have a candidate for this sentence, skip
    const sentenceKey = `${start}:${end}`;
    if (seenSentences.has(sentenceKey)) continue;
    seenSentences.add(sentenceKey);

    const ctxBefore = description.slice(Math.max(0, start - CONTEXT_RADIUS), start);
    const ctxAfter = description.slice(end, Math.min(description.length, end + CONTEXT_RADIUS));

    candidates.push({
      id: `${entityId}:${start}`,
      batchIndex: idx,
      entityId,
      entityName,
      sentence,
      sentenceStart: start,
      sentenceEnd: end,
      matchedConcept: regexMatch[0],
      contextBefore: (start - CONTEXT_RADIUS > 0 ? "\u2026" : "") + ctxBefore,
      contextAfter: ctxAfter + (end + CONTEXT_RADIUS < description.length ? "\u2026" : ""),
    });
    idx++;
  }

  return candidates;
}
