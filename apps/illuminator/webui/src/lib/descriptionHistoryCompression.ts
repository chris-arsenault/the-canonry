/**
 * Description History Compression
 *
 * Compresses long description histories for the historian edition prompt.
 * Entities with 4-5 versions pass through unchanged. Outliers with 45+
 * versions (from incremental backport passes) get compressed to ~8-15
 * meaningful milestones.
 *
 * Algorithm: Walk entries oldest→newest, comparing each to the GROUP ANCHOR
 * (first entry in the current group) using word-set Jaccard similarity.
 * This prevents gradual drift where each step is <10% different but the
 * total accumulated drift is significant.
 */

export const SIMILARITY_THRESHOLD = 0.9;
export const COMPRESSION_FLOOR = 8;

export interface DescriptionHistoryEntry {
  description: string;
  source: string;
  replacedAt: number;
}

export interface CompressedHistoryEntry {
  description: string;
  source: string;
  replacedAt: number;
  consolidatedCount?: number;
  earliestDate?: number;
}

export function wordSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function flushGroup(group: DescriptionHistoryEntry[], result: CompressedHistoryEntry[]): void {
  const last = group[group.length - 1];
  if (group.length === 1) {
    result.push(last);
  } else {
    result.push({
      description: last.description,
      source: last.source,
      replacedAt: last.replacedAt,
      consolidatedCount: group.length,
      earliestDate: group[0].replacedAt,
    });
  }
}

export function compressDescriptionHistory(
  history: DescriptionHistoryEntry[]
): CompressedHistoryEntry[] {
  if (history.length <= COMPRESSION_FLOOR) {
    return history;
  }

  const result: CompressedHistoryEntry[] = [];
  let currentGroup: DescriptionHistoryEntry[] = [history[0]];

  for (let i = 1; i < history.length; i++) {
    const anchor = currentGroup[0]; // compare to group anchor, not last entry
    const curr = history[i];
    const sameSource = anchor.source === curr.source;
    const similar = wordSimilarity(anchor.description, curr.description) > SIMILARITY_THRESHOLD;

    if (sameSource && similar) {
      currentGroup.push(curr);
    } else {
      flushGroup(currentGroup, result);
      currentGroup = [curr];
    }
  }
  flushGroup(currentGroup, result);

  return result;
}
