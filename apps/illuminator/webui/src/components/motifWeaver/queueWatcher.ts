/**
 * Queue watcher logic for motif weaver — parses completed enrichment queue
 * items and extracts variant mappings.
 */

import type { QueueItem } from "../../lib/enrichmentTypes";
import type { MotifVariationResult } from "../../workers/tasks/motifVariationTask";
import type { WeaveCandidate } from "./types";

interface QueueWatcherResult {
  finished: boolean;
  errorMessage: string | null;
  variantMap: Map<string, string>;
}

function parseCompletedResults(
  completedItems: QueueItem[],
  currentCandidates: WeaveCandidate[],
): Map<string, string> {
  const variantMap = new Map<string, string>();

  for (const item of completedItems) {
    if (!item.result?.description) continue;
    try {
      const results = JSON.parse(item.result.description) as MotifVariationResult[];
      for (const r of results) {
        const candidate = currentCandidates.find((c) => c.batchIndex === r.index);
        if (candidate) {
          variantMap.set(candidate.id, r.variant);
        }
      }
    } catch {
      // Skip unparseable results
    }
  }

  return variantMap;
}

export function evaluateQueueState(
  queue: QueueItem[],
  dispatchTime: number,
  currentCandidates: WeaveCandidate[],
): QueueWatcherResult {
  const motifItems = queue.filter(
    (item) => item.type === "motifVariation" && item.queuedAt >= dispatchTime,
  );
  if (motifItems.length === 0) {
    return { finished: false, errorMessage: null, variantMap: new Map() };
  }

  const running = motifItems.filter(
    (item) => item.status === "running" || item.status === "queued",
  );
  const completed = motifItems.filter((item) => item.status === "complete");
  const errored = motifItems.filter((item) => item.status === "error");

  if (running.length > 0 || (completed.length === 0 && errored.length === 0)) {
    return { finished: false, errorMessage: null, variantMap: new Map() };
  }

  const errorMessage =
    errored.length > 0
      ? `${errored.length} batch(es) failed: ${errored[0].error ?? "Unknown error"}`
      : null;

  const variantMap = parseCompletedResults(completed, currentCandidates);

  return { finished: true, errorMessage, variantMap };
}
