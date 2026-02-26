/**
 * useHistorianEdition - Hook for historian-voiced description synthesis
 *
 * Replaces useCopyEdit. The historian persona rewrites an entity description
 * using the full description history as source material, producing a
 * markdown-formatted scholarly entry.
 *
 * Uses the SummaryRevisionRun infrastructure:
 * 1. Create run in IndexedDB with one batch (one entity)
 * 2. Dispatch worker task
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. User reviews rewrite via SummaryRevisionModal diff viewer
 * 5. Apply accepted patch to entity state
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { EnrichmentType } from "../lib/enrichmentTypes";
import { getEnqueue } from "../lib/db/enrichmentQueueBridge";
import type { HistorianConfig, HistorianTone } from "../lib/historianTypes";
import type { SummaryRevisionRun, SummaryRevisionPatch } from "../lib/summaryRevisionTypes";
import {
  createRevisionRun,
  getRevisionRun,
  updateRevisionRun,
  generateRevisionRunId,
  deleteRevisionRun,
} from "../lib/db/summaryRevisionRepository";

// ============================================================================
// Types
// ============================================================================

export interface HistorianEditionConfig {
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
  descriptionHistory: Array<{ description: string; source?: string; replacedAt?: number }>;
  chronicleSummaries: Array<{
    chronicleId: string;
    title: string;
    format: string;
    summary: string;
  }>;
  relationships: Array<{ kind: string; targetName: string; targetKind: string }>;
  neighborSummaries: Array<{ name: string; kind: string; summary: string }>;
  canonFacts: string[];
  worldDynamics: string[];
  previousNotes: Array<{ targetName: string; anchorPhrase: string; text: string; type: string }>;
  historianConfig: HistorianConfig;
  tone: HistorianTone;
}

export interface UseHistorianEditionReturn {
  /** Current run state */
  run: SummaryRevisionRun | null;
  /** Whether a historian edition session is active */
  isActive: boolean;
  /** Start a new historian edition session */
  startHistorianEdition: (config: HistorianEditionConfig) => Promise<void>;
  /** Toggle accept/reject for the entity patch */
  togglePatchDecision: (entityId: string, accepted: boolean) => Promise<void>;
  /** Apply the accepted patch and close the session */
  applyAccepted: () => SummaryRevisionPatch[];
  /** Cancel the current session */
  cancelHistorianEdition: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 1500;

// ============================================================================
// Hook
// ============================================================================

export function useHistorianEdition(): UseHistorianEditionReturn {
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
  const dispatchTask = useCallback((runId: string) => {
    const sentinelEntity = {
      id: "__historian_edition__",
      name: "Historian Edition",
      kind: "system",
      subtype: "",
      prominence: "",
      culture: "",
      status: "active",
      description: "",
      tags: {},
    };

    getEnqueue()([
      {
        entity: sentinelEntity,
        type: "historianEdition" as EnrichmentType,
        prompt: "", // All data is in IndexedDB run context
        chronicleId: runId, // Repurpose chronicleId field for runId
      },
    ]);
  }, []);

  // Poll IndexedDB for run state changes
  const startPolling = useCallback(
    (runId: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void (async () => {
          const updated = await getRevisionRun(runId);
          if (!updated) return;

          setRun(updated);

          // Stop polling on review/terminal states
          if (
            updated.status === "batch_reviewing" ||
            updated.status === "run_reviewing" ||
            updated.status === "complete" ||
            updated.status === "failed" ||
            updated.status === "cancelled"
          ) {
            stopPolling();
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  // Start a new historian edition session
  const startHistorianEdition = useCallback(
    async (cfg: HistorianEditionConfig) => {
      const runId = generateRevisionRunId();

      // Single batch with one entity ID
      const batches = [
        {
          culture: "historian-edition",
          entityIds: [cfg.entityId],
          status: "pending" as const,
          patches: [],
        },
      ];

      // Pack all context into staticPagesContext as JSON
      const contextJson = JSON.stringify({
        entityId: cfg.entityId,
        entityName: cfg.entityName,
        entityKind: cfg.entityKind,
        entitySubtype: cfg.entitySubtype,
        entityCulture: cfg.entityCulture,
        entityProminence: cfg.entityProminence,
        summary: cfg.summary,
        descriptionHistory: cfg.descriptionHistory,
        chronicleSummaries: cfg.chronicleSummaries,
        relationships: cfg.relationships,
        neighborSummaries: cfg.neighborSummaries,
        canonFacts: cfg.canonFacts,
        worldDynamics: cfg.worldDynamics,
        previousNotes: cfg.previousNotes,
        historianConfig: cfg.historianConfig,
        tone: cfg.tone,
      });

      // Create run in IndexedDB
      // worldDynamicsContext = current description, staticPagesContext = everything else
      const newRun = await createRevisionRun(runId, cfg.projectId, cfg.simulationRunId, batches, {
        worldDynamicsContext: cfg.description,
        staticPagesContext: contextJson,
        schemaContext: "",
        revisionGuidance: "",
      });

      setRun(newRun);
      setIsActive(true);

      // Dispatch the worker task
      dispatchTask(runId);

      // Start polling
      startPolling(runId);
    },
    [dispatchTask, startPolling]
  );

  // Toggle accept/reject for the entity patch
  const togglePatchDecision = useCallback(
    async (entityId: string, accepted: boolean) => {
      if (!run) return;

      const newDecisions = { ...run.patchDecisions, [entityId]: accepted };
      await updateRevisionRun(run.runId, { patchDecisions: newDecisions });

      setRun((prev) => (prev ? { ...prev, patchDecisions: newDecisions } : null));
    },
    [run]
  );

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
  const cancelHistorianEdition = useCallback(() => {
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
    startHistorianEdition,
    togglePatchDecision,
    applyAccepted,
    cancelHistorianEdition,
  };
}
