/**
 * useCopyEdit - Hook for single-entity description copy editing
 *
 * Lightweight version of useChronicleLoreBackport:
 * 1. Create run in IndexedDB with one batch (one entity)
 * 2. Dispatch worker task
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. User reviews patch via SummaryRevisionModal diff viewer
 * 5. Apply accepted patch to entity state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentType } from '../lib/enrichmentTypes';
import type {
  SummaryRevisionRun,
  SummaryRevisionPatch,
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

export interface CopyEditConfig {
  projectId: string;
  simulationRunId: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype?: string;
  entityCulture?: string;
  entityProminence?: string;
  description: string;
  summary: string;
  kindFocus: string;
  visualThesis: string;
  relationships: Array<{ kind: string; targetName: string; targetKind: string }>;
}

export interface UseCopyEditReturn {
  /** Current run state */
  run: SummaryRevisionRun | null;
  /** Whether a copy edit session is active */
  isActive: boolean;
  /** Start a new copy edit session */
  startCopyEdit: (config: CopyEditConfig) => void;
  /** Toggle accept/reject for the entity patch */
  togglePatchDecision: (entityId: string, accepted: boolean) => void;
  /** Apply the accepted patch and close the session */
  applyAccepted: () => SummaryRevisionPatch[];
  /** Cancel the current session */
  cancelCopyEdit: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 1500;

// ============================================================================
// Hook
// ============================================================================

export function useCopyEdit(
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void,
): UseCopyEditReturn {
  const [run, setRun] = useState<SummaryRevisionRun | null>(null);
  const [isActive, setIsActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Dispatch a worker task for the single entity
  const dispatchTask = useCallback((runId: string, config: CopyEditConfig) => {
    const sentinelEntity = {
      id: '__copy_edit__',
      name: 'Copy Edit',
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
      type: 'copyEdit' as EnrichmentType,
      prompt: '', // Entity data is in IndexedDB run context, not prompt
      chronicleId: runId, // Repurpose chronicleId field for runId
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
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Start a new copy edit session
  const startCopyEdit = useCallback(async (config: CopyEditConfig) => {
    const runId = generateRevisionRunId();

    // Single batch with one entity ID
    const batches = [{
      culture: 'copy-edit',
      entityIds: [config.entityId],
      status: 'pending' as const,
      patches: [],
    }];

    // Store entity metadata as JSON in staticPagesContext
    const metaJson = JSON.stringify({
      entityId: config.entityId,
      entityName: config.entityName,
      entityKind: config.entityKind,
      entitySubtype: config.entitySubtype,
      entityCulture: config.entityCulture,
      entityProminence: config.entityProminence,
      kindFocus: config.kindFocus,
      visualThesis: config.visualThesis,
      summary: config.summary,
      relationships: config.relationships,
    });

    // Create run in IndexedDB
    // worldDynamicsContext = description text, staticPagesContext = entity metadata JSON
    const newRun = await createRevisionRun(runId, config.projectId, config.simulationRunId, batches, {
      worldDynamicsContext: config.description,
      staticPagesContext: metaJson,
      schemaContext: '',
      revisionGuidance: '',
    });

    setRun(newRun);
    setIsActive(true);

    // Dispatch the worker task
    dispatchTask(runId, config);

    // Start polling
    startPolling(runId);
  }, [dispatchTask, startPolling]);

  // Toggle accept/reject for the entity patch
  const togglePatchDecision = useCallback(async (entityId: string, accepted: boolean) => {
    if (!run) return;

    const newDecisions = { ...run.patchDecisions, [entityId]: accepted };
    await updateRevisionRun(run.runId, { patchDecisions: newDecisions });

    setRun((prev) => prev ? { ...prev, patchDecisions: newDecisions } : null);
  }, [run]);

  // Apply the accepted patch and return it
  const applyAccepted = useCallback((): SummaryRevisionPatch[] => {
    if (!run) return [];

    // Collect patches where the entity was accepted
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
  const cancelCopyEdit = useCallback(() => {
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
    startCopyEdit,
    togglePatchDecision,
    applyAccepted,
    cancelCopyEdit,
  };
}
