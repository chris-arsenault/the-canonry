/**
 * Web Worker for pairwise title similarity computation.
 *
 * Receives an array of {id, title, titleLower} entries,
 * computes normalized Levenshtein similarity for all pairs,
 * reports progress, and returns the top N most similar pairs.
 *
 * Deduplicates by title text — if multiple images share the same title,
 * only one representative pair is kept per unique title combination.
 */

export interface TitleEntry {
  id: string;
  title: string;
  titleLower: string;
  hasPrompt: boolean;
}

export interface SimilarPair {
  idA: string;
  idB: string;
  titleA: string;
  titleB: string;
  hasPromptA: boolean;
  hasPromptB: boolean;
  similarity: number;
}

export interface WorkerInput {
  titles: TitleEntry[];
  /** Minimum similarity to keep a pair. Pairs below this are discarded. */
  floor: number;
}

export interface WorkerProgress {
  type: "progress";
  completed: number;
  total: number;
  pairsFound: number;
}

export interface WorkerResult {
  type: "result";
  totalTitles: number;
  uniqueTitles: number;
  pairs: SimilarPair[];
}

export type WorkerMessage = WorkerProgress | WorkerResult;

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { titles, floor } = e.data;

  // Dedupe: group by lowercase title, keep first image ID as representative
  const byText = new Map<string, TitleEntry>();
  for (const t of titles) {
    if (!byText.has(t.titleLower)) {
      byText.set(t.titleLower, t);
    }
  }
  const unique = Array.from(byText.values());
  const n = unique.length;
  const totalPairs = (n * (n - 1)) / 2;

  const results: SimilarPair[] = [];
  let completed = 0;
  let lastProgressAt = 0;
  const progressInterval = Math.max(1, Math.floor(totalPairs / 200));

  for (let i = 0; i < n; i++) {
    const a = unique[i].titleLower;
    const aLen = a.length;

    for (let j = i + 1; j < n; j++) {
      completed++;

      const b = unique[j].titleLower;
      const bLen = b.length;
      const maxLen = Math.max(aLen, bLen);
      if (maxLen === 0) continue;

      // Length pruning: best possible similarity given length difference alone
      const lenDiff = Math.abs(aLen - bLen);
      const upperBound = 1 - lenDiff / maxLen;
      if (upperBound < floor) continue;

      const sim = 1 - levenshteinDistance(a, b) / maxLen;
      if (sim < floor) continue;

      results.push({
        idA: unique[i].id,
        idB: unique[j].id,
        titleA: unique[i].title,
        titleB: unique[j].title,
        hasPromptA: unique[i].hasPrompt,
        hasPromptB: unique[j].hasPrompt,
        similarity: Math.round(sim * 1000) / 1000,
      });

      if (completed - lastProgressAt >= progressInterval) {
        lastProgressAt = completed;
        (self as unknown as Worker).postMessage({
          type: "progress",
          completed,
          total: totalPairs,
          pairsFound: results.length,
        } satisfies WorkerProgress);
      }
    }
  }

  results.sort((x, y) => y.similarity - x.similarity);

  (self as unknown as Worker).postMessage({
    type: "result",
    totalTitles: titles.length,
    uniqueTitles: n,
    pairs: results,
  } satisfies WorkerResult);
};
