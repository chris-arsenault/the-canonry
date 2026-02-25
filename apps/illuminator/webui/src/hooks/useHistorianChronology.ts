/**
 * useHistorianChronology - Hook for historian-assigned chronicle year ordering
 *
 * Follows the useHistorianReview pattern:
 * 1. Create run in IndexedDB with era + chronicle context
 * 2. Dispatch worker task
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. User reviews year assignments
 * 5. Apply accepted assignments to chronicle records
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { EnrichmentType } from "../lib/enrichmentTypes";
import type {
  HistorianRun,
  HistorianConfig,
  HistorianTone,
  ChronologyAssignment,
} from "../lib/historianTypes";
import {
  createHistorianRun,
  getHistorianRun,
  updateHistorianRun,
  deleteHistorianRun,
  generateHistorianRunId,
} from "../lib/db/historianRepository";

// ============================================================================
// Types
// ============================================================================

export interface ChronologyConfig {
  projectId: string;
  simulationRunId: string;
  eraId: string;
  eraName: string;
  /** Serialized era info + chronicle data + previous eras */
  contextJson: string;
  /** The historian persona config */
  historianConfig: HistorianConfig;
  /** Tone/mood for this chronology session */
  tone: HistorianTone;
}

export interface UseHistorianChronologyReturn {
  /** Current run state */
  run: HistorianRun | null;
  /** Whether a chronology session is active */
  isActive: boolean;
  /** Start a new chronology session */
  startChronology: (config: ChronologyConfig) => void;
  /** Adjust a year for a specific chronicle before applying */
  adjustYear: (chronicleId: string, year: number) => void;
  /** Apply all assignments and close the session */
  applyChronology: () => ChronologyAssignment[];
  /** Cancel the current session */
  cancelChronology: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 1500;

// ============================================================================
// Hook
// ============================================================================

export function useHistorianChronology(
  onEnqueue: (
    items: Array<{
      entity: {
        id: string;
        name: string;
        kind: string;
        subtype: string;
        prominence: string;
        culture: string;
        status: string;
        description: string;
        tags: Record<string, unknown>;
      };
      type: EnrichmentType;
      prompt: string;
      chronicleId?: string;
    }>
  ) => void
): UseHistorianChronologyReturn {
  const [run, setRun] = useState<HistorianRun | null>(null);
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

  // Dispatch a worker task
  const dispatchTask = useCallback(
    (runId: string) => {
      const sentinelEntity = {
        id: "__historian_chronology__",
        name: "Historian Chronology",
        kind: "system",
        subtype: "",
        prominence: "",
        culture: "",
        status: "active",
        description: "",
        tags: {},
      };

      onEnqueue([
        {
          entity: sentinelEntity,
          type: "historianChronology" as EnrichmentType,
          prompt: "", // All data is in IndexedDB run context
          chronicleId: runId, // Repurpose chronicleId field for runId
        },
      ]);
    },
    [onEnqueue]
  );

  // Poll IndexedDB for run state changes
  const startPolling = useCallback(
    (runId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        const updated = await getHistorianRun(runId);
        if (!updated) return;

        setRun(updated);

        // Stop polling on review/terminal states
        if (
          updated.status === "reviewing" ||
          updated.status === "complete" ||
          updated.status === "failed" ||
          updated.status === "cancelled"
        ) {
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  // Start a new chronology session
  const startChronology = useCallback(
    async (config: ChronologyConfig) => {
      const runId = generateHistorianRunId();
      const now = Date.now();

      const newRun: HistorianRun = {
        runId,
        projectId: config.projectId,
        simulationRunId: config.simulationRunId,
        status: "pending",
        tone: config.tone,
        targetType: "chronology",
        targetId: config.eraId,
        targetName: config.eraName,
        sourceText: "", // Not used for chronology
        notes: [],
        noteDecisions: {},
        contextJson: config.contextJson,
        previousNotesJson: "[]",
        historianConfigJson: JSON.stringify(config.historianConfig),
        inputTokens: 0,
        outputTokens: 0,
        actualCost: 0,
        createdAt: now,
        updatedAt: now,
      };

      await createHistorianRun(newRun);
      setRun(newRun);
      setIsActive(true);

      // Dispatch the worker task
      dispatchTask(runId);

      // Start polling
      startPolling(runId);
    },
    [dispatchTask, startPolling]
  );

  // Adjust a year for a specific chronicle before applying
  const adjustYear = useCallback(
    async (chronicleId: string, year: number) => {
      if (!run?.chronologyAssignments) return;

      const updated = run.chronologyAssignments.map((a) =>
        a.chronicleId === chronicleId ? { ...a, year } : a
      );

      await updateHistorianRun(run.runId, { chronologyAssignments: updated });
      setRun((prev) => (prev ? { ...prev, chronologyAssignments: updated } : null));
    },
    [run]
  );

  // Apply all assignments and return them
  const applyChronology = useCallback((): ChronologyAssignment[] => {
    if (!run?.chronologyAssignments) return [];

    const assignments = [...run.chronologyAssignments];

    // Clean up
    setIsActive(false);
    stopPolling();
    if (run.runId) {
      deleteHistorianRun(run.runId).catch(() => {});
    }
    setRun(null);

    return assignments;
  }, [run, stopPolling]);

  // Cancel
  const cancelChronology = useCallback(() => {
    setIsActive(false);
    stopPolling();
    if (run?.runId) {
      deleteHistorianRun(run.runId).catch(() => {});
    }
    setRun(null);
  }, [run, stopPolling]);

  return {
    run,
    isActive,
    startChronology,
    adjustYear,
    applyChronology,
    cancelChronology,
  };
}
