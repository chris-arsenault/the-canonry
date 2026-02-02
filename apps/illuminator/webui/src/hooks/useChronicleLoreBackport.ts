/**
 * useChronicleLoreBackport - Hook for chronicle lore backport to cast entities
 *
 * Simplified single-batch flow:
 * 1. Create run in IndexedDB with one batch (the chronicle cast)
 * 2. Dispatch worker task
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. User reviews patches → accept/reject per entity
 * 5. Apply accepted patches to entity state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentType } from '../lib/enrichmentTypes';
import type {
  SummaryRevisionRun,
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

export interface ChronicleLoreBackportConfig {
  projectId: string;
  simulationRunId: string;
  /** The chronicle being backported */
  chronicleId: string;
  /** The published chronicle text (finalContent) */
  chronicleText: string;
  /** JSON-stringified perspective synthesis output (brief, facets, directives, voice, motifs) */
  perspectiveSynthesisJson: string;
  /** Cast entities with their context */
  entities: RevisionEntityContext[];
  /** Optional custom instructions injected as CRITICAL directives into the backport prompt */
  customInstructions?: string;
}

export interface UseChronicleLoreBackportReturn {
  /** Current run state */
  run: SummaryRevisionRun | null;
  /** Whether a backport session is active */
  isActive: boolean;
  /** The chronicle ID being backported */
  chronicleId: string | null;
  /** Start a new backport session */
  startBackport: (config: ChronicleLoreBackportConfig) => void;
  /** Toggle accept/reject for a specific entity patch */
  togglePatchDecision: (entityId: string, accepted: boolean) => void;
  /** Update the anchor phrase for a specific entity patch */
  updateAnchorPhrase: (entityId: string, anchorPhrase: string) => void;
  /** Apply all accepted patches and close the session */
  applyAccepted: () => SummaryRevisionPatch[];
  /** Cancel the current session */
  cancelBackport: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 1500;

// ============================================================================
// Hook
// ============================================================================

export function useChronicleLoreBackport(
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void,
  getEntityContexts: (entityIds: string[]) => RevisionEntityContext[],
): UseChronicleLoreBackportReturn {
  const [run, setRun] = useState<SummaryRevisionRun | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [chronicleId, setChronicleId] = useState<string | null>(null);
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

  // Dispatch a worker task for the single batch
  const dispatchBatch = useCallback((runId: string, batchEntityContexts: RevisionEntityContext[]) => {
    const sentinelEntity = {
      id: '__chronicle_lore_backport__',
      name: 'Chronicle Lore Backport',
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
      type: 'chronicleLoreBackport' as EnrichmentType,
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
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Start a new backport session
  const startBackport = useCallback(async (config: ChronicleLoreBackportConfig) => {
    const runId = generateRevisionRunId();

    // Single batch with all cast entity IDs
    const batches = [{
      culture: 'cast',
      entityIds: config.entities.map((e) => e.id),
      status: 'pending' as const,
      patches: [],
    }];

    // Create run in IndexedDB
    // Repurpose context fields: worldDynamicsContext = chronicle text, staticPagesContext = perspective JSON
    // revisionGuidance = custom user instructions for the backport
    const newRun = await createRevisionRun(runId, config.projectId, config.simulationRunId, batches, {
      worldDynamicsContext: config.chronicleText,
      staticPagesContext: config.perspectiveSynthesisJson,
      schemaContext: '',
      revisionGuidance: config.customInstructions || '',
    });

    setRun(newRun);
    setIsActive(true);
    setChronicleId(config.chronicleId);

    // Dispatch the single batch — use config.entities directly to preserve isLens flags
    dispatchBatch(runId, config.entities);

    // Start polling
    startPolling(runId);
  }, [dispatchBatch, startPolling, getEntityContexts]);

  // Toggle accept/reject for a specific entity patch
  const togglePatchDecision = useCallback(async (entityId: string, accepted: boolean) => {
    if (!run) return;

    const newDecisions = { ...run.patchDecisions, [entityId]: accepted };
    await updateRevisionRun(run.runId, { patchDecisions: newDecisions });

    setRun((prev) => prev ? { ...prev, patchDecisions: newDecisions } : null);
  }, [run]);

  // Update anchor phrase for a patch (user override)
  const updateAnchorPhrase = useCallback(async (entityId: string, anchorPhrase: string) => {
    if (!run) return;

    // Update the patch in the batch
    const updatedBatches = run.batches.map((batch) => ({
      ...batch,
      patches: batch.patches.map((p) =>
        p.entityId === entityId ? { ...p, anchorPhrase } : p
      ),
    }));
    await updateRevisionRun(run.runId, { batches: updatedBatches });
    setRun((prev) => prev ? { ...prev, batches: updatedBatches } : null);
  }, [run]);

  // Apply all accepted patches and return them
  const applyAccepted = useCallback((): SummaryRevisionPatch[] => {
    if (!run) return [];

    // Collect all patches where the entity was accepted
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
    setChronicleId(null);
    if (run.runId) {
      deleteRevisionRun(run.runId).catch(() => {});
    }
    setRun(null);

    return acceptedPatches;
  }, [run, stopPolling]);

  // Cancel
  const cancelBackport = useCallback(() => {
    setIsActive(false);
    stopPolling();
    setChronicleId(null);
    if (run?.runId) {
      deleteRevisionRun(run.runId).catch(() => {});
    }
    setRun(null);
  }, [run, stopPolling]);

  return {
    run,
    isActive,
    chronicleId,
    startBackport,
    togglePatchDecision,
    updateAnchorPhrase,
    applyAccepted,
    cancelBackport,
  };
}
