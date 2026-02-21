/**
 * historianRunHelpers — Shared dispatch and poll utilities for historian runs.
 *
 * Extracted from bulkChronicleAnnotationStore so both the chronicle-only
 * store and the interleaved annotation store can reuse them.
 */

import type { HistorianNote } from '../historianTypes';
import type { EnrichmentType } from '../enrichmentTypes';
import { getEnqueue } from './enrichmentQueueBridge';
import {
  getHistorianRun,
  deleteHistorianRun,
} from './historianRepository';

// ============================================================================
// Constants
// ============================================================================

export const POLL_INTERVAL_MS = 1500;

// ============================================================================
// Types
// ============================================================================

export interface ReviewResult {
  notes: HistorianNote[];
  cost: number;
  prompts?: { systemPrompt: string; userPrompt: string };
}

// ============================================================================
// Context extraction
// ============================================================================

/**
 * Extract reinforced fact IDs from a HistorianReviewConfig's contextJson.
 * Returns the factIds from factCoverageGuidance targets, or undefined if none.
 */
export function extractReinforcedFactIds(contextJson: string): string[] | undefined {
  try {
    const ctx = JSON.parse(contextJson);
    if (!Array.isArray(ctx.factCoverageGuidance) || ctx.factCoverageGuidance.length === 0) return undefined;
    return ctx.factCoverageGuidance.map((t: { factId: string }) => t.factId).filter(Boolean);
  } catch {
    return undefined;
  }
}

// ============================================================================
// Helpers
// ============================================================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enqueue a historian review task to the enrichment worker.
 */
export function dispatchReviewTask(runId: string): void {
  getEnqueue()([{
    entity: {
      id: '__historian_review__',
      name: 'Historian Review',
      kind: 'system',
      subtype: '',
      prominence: '',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    },
    type: 'historianReview' as EnrichmentType,
    prompt: '',
    chronicleId: runId,
  }]);
}

/**
 * Poll a historian run until it reaches 'reviewing' (success) or 'failed'.
 *
 * @param isCancelled — checked before and after each sleep; return true to abort.
 * @returns ReviewResult on success, null if cancelled or run disappeared.
 * @throws on run failure.
 */
export async function pollReviewCompletion(
  runId: string,
  isCancelled: () => boolean,
): Promise<ReviewResult | null> {
  while (true) {
    if (isCancelled()) return null;
    await sleep(POLL_INTERVAL_MS);
    if (isCancelled()) return null;

    const run = await getHistorianRun(runId);
    if (!run) return null;

    if (run.status === 'reviewing') {
      const cost = run.actualCost || 0;
      const prompts = run.systemPrompt && run.userPrompt
        ? { systemPrompt: run.systemPrompt, userPrompt: run.userPrompt }
        : undefined;
      await deleteHistorianRun(runId);
      return { notes: run.notes || [], cost, prompts };
    }

    if (run.status === 'failed') {
      const error = run.error || 'Unknown error';
      await deleteHistorianRun(runId);
      throw new Error(error);
    }
  }
}
