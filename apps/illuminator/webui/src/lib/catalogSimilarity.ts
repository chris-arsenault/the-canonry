/**
 * catalogSimilarity — Pairwise title similarity analysis.
 *
 * Loads LLM-titled images from DB, then offloads the O(n²) Levenshtein
 * computation to a web worker. Reports progress via callback.
 */

import { db } from "./db/illuminatorDb";
import type { WorkerMessage, SimilarPair } from "./catalogSimilarityWorker";

export type { SimilarPair };

export interface SimilarityReport {
  totalTitles: number;
  uniqueTitles: number;
  pairs: SimilarPair[];
}

export interface SimilarityProgress {
  completed: number;
  total: number;
  pairsFound: number;
}

/** Minimum similarity floor — all pairs at or above this are returned. */
const SIMILARITY_FLOOR = 0.5;

export async function findMostSimilarPairs(
  projectId: string,
  onProgress?: (progress: SimilarityProgress) => void,
): Promise<SimilarityReport> {
  const allImages = await db.images.where("projectId").equals(projectId).toArray();

  const titles: { id: string; title: string; titleLower: string; hasPrompt: boolean }[] = [];
  for (const img of allImages) {
    const rec = img as unknown as Record<string, unknown>;
    if (rec.llmTitle && rec.title) {
      titles.push({
        id: rec.imageId as string,
        title: rec.title as string,
        titleLower: (rec.title as string).toLowerCase(),
        hasPrompt: Boolean(rec.finalPrompt || rec.originalPrompt),
      });
    }
  }

  if (titles.length < 2) {
    return { totalTitles: titles.length, uniqueTitles: titles.length, pairs: [] };
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./catalogSimilarityWorker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        onProgress?.({
          completed: msg.completed,
          total: msg.total,
          pairsFound: msg.pairsFound,
        });
      } else if (msg.type === "result") {
        worker.terminate();
        resolve({
          totalTitles: msg.totalTitles,
          uniqueTitles: msg.uniqueTitles,
          pairs: msg.pairs,
        });
      }
    };

    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(`Similarity worker error: ${e.message}`));
    };

    worker.postMessage({ titles, floor: SIMILARITY_FLOOR });
  });
}
