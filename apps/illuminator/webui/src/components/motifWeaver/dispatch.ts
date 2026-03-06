/**
 * Dispatch motif weave batches to the enrichment queue.
 */

import { getEnqueue } from "../../lib/db/enrichmentQueueBridge";
import type { MotifWeavePayload } from "../../workers/tasks/motifVariationTask";
import type { WeaveCandidate } from "./types";
import { BATCH_SIZE, TARGET_PHRASE } from "./scanning";

interface DispatchResult {
  dispatchTime: number;
  errorMessage: string | null;
}

function buildSyntheticEntity(dispatchTime: number, batchIdx: number): Record<string, unknown> {
  return {
    id: `weave_batch_${dispatchTime}_${batchIdx}`,
    name: `Weave: ${TARGET_PHRASE} (batch ${batchIdx + 1})`,
    kind: "motif",
    subtype: "weave",
    prominence: "marginal",
    culture: "",
    status: "active",
    description: "",
    tags: {},
  };
}

export function dispatchWeaveBatches(candidates: WeaveCandidate[]): DispatchResult {
  const batches: WeaveCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  const dispatchTime = Date.now();

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const payload: MotifWeavePayload = {
      mode: "weave",
      targetPhrase: TARGET_PHRASE,
      instances: batch.map((c) => ({
        index: c.batchIndex,
        entityName: c.entityName,
        sentence: c.sentence,
        surroundingContext: c.contextBefore + c.contextAfter,
      })),
    };

    try {
      getEnqueue()([
        {
          entity: buildSyntheticEntity(dispatchTime, batchIdx),
          type: "motifVariation" as const,
          prompt: JSON.stringify(payload),
        },
      ]);
    } catch (err) {
      return {
        dispatchTime,
        errorMessage: `Failed to dispatch batch ${batchIdx + 1}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { dispatchTime, errorMessage: null };
}
