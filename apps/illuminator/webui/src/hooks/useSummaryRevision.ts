/**
 * useSummaryRevision - Hook for managing batch summary revision
 *
 * Orchestrates the flow:
 * 1. Create run in IndexedDB with batches grouped by culture
 * 2. Dispatch worker task for current batch (one at a time)
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. User reviews batch → continue to next or cancel
 * 5. After all batches: user does final per-entity accept/reject
 * 6. Apply accepted patches to entity state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentType } from '../lib/enrichmentTypes';
import type {
  SummaryRevisionRun,
  SummaryRevisionBatch,
  SummaryRevisionPatch,
  RevisionEntityContext,
} from '../lib/summaryRevisionTypes';
import {
  createRevisionRun,
  getRevisionRun,
  updateRevisionRun,
  generateRevisionRunId,
  deleteRevisionRun,
} from '../lib/db/summaryRevisionRepository';

// ============================================================================
// Types
// ============================================================================

export interface SummaryRevisionConfig {
  projectId: string;
  simulationRunId: string;
  /** World dynamics text */
  worldDynamicsContext: string;
  /** Static pages content */
  staticPagesContext: string;
  /** Schema context */
  schemaContext: string;
  /** User-editable revision guidance for prompt tuning */
  revisionGuidance: string;
  /** All entities to revise, with their context */
  entities: RevisionEntityContext[];
}

export interface UseSummaryRevisionReturn {
  /** Current run state */
  run: SummaryRevisionRun | null;
  /** Whether a revision session is active */
  isActive: boolean;
  /** Start a new revision session */
  startRevision: (config: SummaryRevisionConfig) => void;
  /** Continue to next batch after reviewing current one */
  continueToNextBatch: () => void;
  /** Auto-continue all remaining batches without per-batch review */
  autoContineAll: () => void;
  /** Toggle accept/reject for a specific entity patch */
  togglePatchDecision: (entityId: string, accepted: boolean) => void;
  /** Apply all accepted patches and close the session */
  applyAccepted: () => SummaryRevisionPatch[];
  /** Cancel the current session */
  cancelRevision: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 1500;
const BATCH_SIZE = 18;  // Target 15-20, use 18 as default

// ============================================================================
// Batch Grouping
// ============================================================================

function groupEntitiesIntoBatches(entities: RevisionEntityContext[]): SummaryRevisionBatch[] {
  // Group by culture
  const byCulture = new Map<string, RevisionEntityContext[]>();
  for (const e of entities) {
    const culture = e.culture || 'uncategorized';
    const list = byCulture.get(culture) || [];
    list.push(e);
    byCulture.set(culture, list);
  }

  // Sort within each culture by prominence
  const prominenceOrder: Record<string, number> = {
    mythic: 0, renowned: 1, recognized: 2, marginal: 3, forgotten: 4,
  };

  const batches: SummaryRevisionBatch[] = [];

  for (const [culture, cultureEntities] of byCulture.entries()) {
    const sorted = [...cultureEntities].sort(
      (a, b) => (prominenceOrder[a.prominence] ?? 5) - (prominenceOrder[b.prominence] ?? 5)
    );

    // Split into batches of BATCH_SIZE
    for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
      const chunk = sorted.slice(i, i + BATCH_SIZE);
      batches.push({
        culture,
        entityIds: chunk.map((e) => e.id),
        status: 'pending',
        patches: [],
      });
    }
  }

  return batches;
}

// ============================================================================
// Hook
// ============================================================================

export function useSummaryRevision(
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void,
  /** Callback to get entity context by IDs (called when dispatching a batch) */
  getEntityContexts: (entityIds: string[]) => RevisionEntityContext[],
): UseSummaryRevisionReturn {
  const [run, setRun] = useState<SummaryRevisionRun | null>(null);
  const [isActive, setIsActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoModeRef = useRef(false);
  const entityContextCacheRef = useRef<Map<string, RevisionEntityContext[]>>(new Map());

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Dispatch a worker task for one batch
  const dispatchBatch = useCallback((runId: string, batchEntityContexts: RevisionEntityContext[]) => {
    const sentinelEntity = {
      id: '__summary_revision__',
      name: 'Summary Revision',
      kind: 'system',
      subtype: '',
      prominence: '',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    };

    onEnqueue([{
      entity: sentinelEntity,
      type: 'summaryRevision' as EnrichmentType,
      prompt: JSON.stringify(batchEntityContexts),
      chronicleId: runId,
    }]);
  }, [onEnqueue]);

  // Poll IndexedDB for run state changes
  const startPolling = useCallback((runId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const updated = await getRevisionRun(runId);
      if (!updated) return;

      setRun(updated);

      // Stop polling on review/terminal states
      if (
        updated.status === 'batch_reviewing' ||
        updated.status === 'run_reviewing' ||
        updated.status === 'complete' ||
        updated.status === 'failed' ||
        updated.status === 'cancelled'
      ) {
        stopPolling();

        // In auto mode, continue to next batch if batch_reviewing
        if (autoModeRef.current && updated.status === 'batch_reviewing') {
          const nextIndex = updated.currentBatchIndex + 1;
          if (nextIndex < updated.batches.length) {
            // Dispatch next batch
            const nextBatch = updated.batches[nextIndex];
            const contexts = getEntityContexts(nextBatch.entityIds);
            await updateRevisionRun(runId, { currentBatchIndex: nextIndex });
            dispatchBatch(runId, contexts);
            startPolling(runId);
          }
        }
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, dispatchBatch, getEntityContexts]);

  // Start a new revision session
  const startRevision = useCallback(async (config: SummaryRevisionConfig) => {
    const runId = generateRevisionRunId();
    autoModeRef.current = false;

    // Filter out locked-summary entities
    const eligibleEntities = config.entities;

    // Group into batches
    const batches = groupEntitiesIntoBatches(eligibleEntities);

    if (batches.length === 0) {
      return;
    }

    // Cache entity contexts for batch dispatch
    const contextMap = new Map<string, RevisionEntityContext>();
    for (const e of eligibleEntities) {
      contextMap.set(e.id, e);
    }

    // Create run in IndexedDB
    const newRun = await createRevisionRun(runId, config.projectId, config.simulationRunId, batches, {
      worldDynamicsContext: config.worldDynamicsContext,
      staticPagesContext: config.staticPagesContext,
      schemaContext: config.schemaContext,
      revisionGuidance: config.revisionGuidance,
    });

    setRun(newRun);
    setIsActive(true);

    // Dispatch first batch
    const firstBatch = batches[0];
    const firstContexts = getEntityContexts(firstBatch.entityIds);
    dispatchBatch(runId, firstContexts);

    // Start polling
    startPolling(runId);
  }, [dispatchBatch, startPolling, getEntityContexts]);

  // Continue to next batch after reviewing current one
  const continueToNextBatch = useCallback(async () => {
    if (!run) return;

    const nextIndex = run.currentBatchIndex + 1;
    if (nextIndex >= run.batches.length) {
      // All batches done — move to run_reviewing
      await updateRevisionRun(run.runId, { status: 'run_reviewing' });
      const updated = await getRevisionRun(run.runId);
      if (updated) setRun(updated);
      return;
    }

    // Advance to next batch
    await updateRevisionRun(run.runId, {
      currentBatchIndex: nextIndex,
      status: 'generating',
    });

    const nextBatch = run.batches[nextIndex];
    const contexts = getEntityContexts(nextBatch.entityIds);
    dispatchBatch(run.runId, contexts);
    startPolling(run.runId);
  }, [run, dispatchBatch, startPolling, getEntityContexts]);

  // Auto-continue all remaining batches
  const autoContineAll = useCallback(async () => {
    if (!run) return;
    autoModeRef.current = true;

    // Trigger next batch
    await continueToNextBatch();
  }, [run, continueToNextBatch]);

  // Toggle accept/reject for a specific entity patch
  const togglePatchDecision = useCallback(async (entityId: string, accepted: boolean) => {
    if (!run) return;

    const newDecisions = { ...run.patchDecisions, [entityId]: accepted };
    await updateRevisionRun(run.runId, { patchDecisions: newDecisions });

    setRun((prev) => prev ? { ...prev, patchDecisions: newDecisions } : null);
  }, [run]);

  // Apply all accepted patches and return them
  const applyAccepted = useCallback((): SummaryRevisionPatch[] => {
    if (!run) return [];

    // Collect all patches from all batches where the entity was accepted
    const acceptedPatches: SummaryRevisionPatch[] = [];
    for (const batch of run.batches) {
      for (const patch of batch.patches) {
        const decision = run.patchDecisions[patch.entityId];
        // Default to accepted if no explicit decision
        if (decision !== false) {
          acceptedPatches.push(patch);
        }
      }
    }

    // Clean up
    setIsActive(false);
    stopPolling();
    if (run.runId) {
      deleteRevisionRun(run.runId).catch(() => {});
    }
    setRun(null);

    return acceptedPatches;
  }, [run, stopPolling]);

  // Cancel
  const cancelRevision = useCallback(() => {
    autoModeRef.current = false;
    setIsActive(false);
    stopPolling();
    if (run?.runId) {
      deleteRevisionRun(run.runId).catch(() => {});
    }
    setRun(null);
  }, [run, stopPolling]);

  return {
    run,
    isActive,
    startRevision,
    continueToNextBatch,
    autoContineAll,
    togglePatchDecision,
    applyAccepted,
    cancelRevision,
  };
}
