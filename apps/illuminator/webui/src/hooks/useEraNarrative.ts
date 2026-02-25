/**
 * useEraNarrative - Hook for era narrative generation
 *
 * Follows the useHistorianChronology pattern:
 * 1. Create EraNarrativeRecord in IndexedDB
 * 2. Dispatch worker task via onEnqueue
 * 3. Poll IndexedDB for status changes
 * 4. User reviews each step, then advances to the next
 * 5. Pauses between every step for prompt engineering iteration
 *
 * Pipeline: threads → generate → edit (linear, no looping)
 *
 * Headless mode: runs all steps without pausing for review.
 * Auto-advances on step_complete, auto-finishes after the last step.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { EnrichmentType } from "../lib/enrichmentTypes";
import type { HistorianConfig } from "../lib/historianTypes";
import type {
  EraNarrativeRecord,
  EraNarrativeStep,
  EraNarrativePrepBrief,
  EraNarrativeWorldContext,
  EraNarrativeTone,
} from "../lib/eraNarrativeTypes";
import {
  createEraNarrative,
  getEraNarrative,
  updateEraNarrative,
  deleteEraNarrative,
  generateEraNarrativeId,
  deleteEraNarrativeVersion,
  setEraNarrativeActiveVersion,
} from "../lib/db/eraNarrativeRepository";

// ============================================================================
// Types
// ============================================================================

export interface EraNarrativeConfig {
  projectId: string;
  simulationRunId: string;
  eraId: string;
  eraName: string;
  tone: EraNarrativeTone;
  /** Optional arc direction override — framing constraint for thesis, threads, and registers */
  arcDirection?: string;
  historianConfig: HistorianConfig;
  prepBriefs: EraNarrativePrepBrief[];
  worldContext?: EraNarrativeWorldContext;
}

export interface UseEraNarrativeReturn {
  /** Current narrative record state */
  narrative: EraNarrativeRecord | null;
  /** Whether a narrative session is active */
  isActive: boolean;
  /** Start a new narrative session (interactive, pauses for review) */
  startNarrative: (config: EraNarrativeConfig) => Promise<void>;
  /** Start a headless session (runs all steps without pausing) */
  startHeadless: (config: EraNarrativeConfig) => Promise<void>;
  /** Resume an existing narrative from IndexedDB */
  resumeNarrative: (narrativeId: string) => Promise<void>;
  /** Advance to the next step (dispatches worker task) */
  advanceStep: () => Promise<void>;
  /** Skip edit step and mark complete */
  skipEdit: () => Promise<void>;
  /** Re-run copy edit on the latest version of a completed narrative */
  rerunCopyEdit: () => Promise<void>;
  /** Delete a content version (cannot delete the generate version) */
  deleteVersion: (versionId: string) => Promise<void>;
  /** Set the active content version */
  setActiveVersion: (versionId: string) => Promise<void>;
  /** Cancel the current session */
  cancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 2000;

const NEXT_STEP: Record<EraNarrativeStep, EraNarrativeStep | null> = {
  threads: "generate",
  generate: "edit",
  edit: null,
};

// ============================================================================
// Hook
// ============================================================================

export function useEraNarrative(
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
): UseEraNarrativeReturn {
  const [narrative, setNarrative] = useState<EraNarrativeRecord | null>(null);
  const [isActive, setIsActive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headlessRef = useRef(false);

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
    (narrativeId: string) => {
      const sentinelEntity = {
        id: "__era_narrative__",
        name: "Era Narrative",
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
          type: "eraNarrative" as EnrichmentType,
          prompt: "",
          chronicleId: narrativeId, // Repurposed for narrativeId
        },
      ]);
    },
    [onEnqueue]
  );

  // Advance a narrative to its next step (shared by interactive and headless)
  const advanceRecord = useCallback(
    async (narrativeId: string, currentStep: EraNarrativeStep) => {
      const nextStep = NEXT_STEP[currentStep];
      if (!nextStep) return;

      await updateEraNarrative(narrativeId, {
        status: "pending",
        currentStep: nextStep,
      });

      setNarrative((prev) =>
        prev
          ? {
              ...prev,
              status: "pending",
              currentStep: nextStep,
            }
          : null
      );

      dispatchTask(narrativeId);
    },
    [dispatchTask]
  );

  // Poll IndexedDB for state changes
  const startPolling = useCallback(
    (narrativeId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        const updated = await getEraNarrative(narrativeId);
        if (!updated) return;

        setNarrative(updated);

        // Terminal states always stop polling
        if (
          updated.status === "complete" ||
          updated.status === "failed" ||
          updated.status === "cancelled"
        ) {
          stopPolling();
          return;
        }

        if (updated.status === "step_complete") {
          if (headlessRef.current) {
            // Headless: auto-advance without user interaction (skips edit)
            stopPolling();

            const nextStep = NEXT_STEP[updated.currentStep];
            if (!nextStep || updated.currentStep === "generate") {
              // Final step (or generate in headless — skip edit): mark complete
              await updateEraNarrative(updated.narrativeId, { status: "complete" });
              setNarrative((prev) => (prev ? { ...prev, status: "complete" } : null));
            } else {
              // Intermediate step: advance and restart polling
              await advanceRecord(updated.narrativeId, updated.currentStep);
              startPolling(updated.narrativeId);
            }
          } else {
            // Interactive: stop polling, wait for user action
            stopPolling();
          }
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, advanceRecord]
  );

  // Create a record and start
  const createAndStart = useCallback(
    async (config: EraNarrativeConfig, headless: boolean) => {
      const narrativeId = generateEraNarrativeId();
      const now = Date.now();

      const newRecord: EraNarrativeRecord = {
        narrativeId,
        projectId: config.projectId,
        simulationRunId: config.simulationRunId,
        eraId: config.eraId,
        eraName: config.eraName,
        status: "pending",
        tone: config.tone,
        arcDirection: config.arcDirection || undefined,
        historianConfigJson: JSON.stringify(config.historianConfig),
        currentStep: "threads",
        prepBriefs: config.prepBriefs,
        worldContext: config.worldContext,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalActualCost: 0,
        createdAt: now,
        updatedAt: now,
      };

      headlessRef.current = headless;
      await createEraNarrative(newRecord);
      setNarrative(newRecord);
      setIsActive(true);

      dispatchTask(narrativeId);
      startPolling(narrativeId);
    },
    [dispatchTask, startPolling]
  );

  // Start interactive session
  const startNarrative = useCallback(
    async (config: EraNarrativeConfig) => {
      await createAndStart(config, false);
    },
    [createAndStart]
  );

  // Start headless session (all steps, no pauses)
  const startHeadless = useCallback(
    async (config: EraNarrativeConfig) => {
      await createAndStart(config, true);
    },
    [createAndStart]
  );

  // Resume an existing narrative from IndexedDB
  const resumeNarrative = useCallback(
    async (narrativeId: string) => {
      const record = await getEraNarrative(narrativeId);
      if (!record) return;

      headlessRef.current = false;
      setNarrative(record);
      setIsActive(true);

      if (record.status === "pending" || record.status === "generating") {
        // After a page refresh, the worker that was processing this step is gone.
        // Reset to pending and re-dispatch so the step actually runs again.
        await updateEraNarrative(narrativeId, { status: "pending" });
        setNarrative((prev) => (prev ? { ...prev, status: "pending" } : null));
        dispatchTask(narrativeId);
        startPolling(narrativeId);
      }
      // step_complete, failed, complete: just show current state, no polling needed
    },
    [dispatchTask, startPolling]
  );

  // Advance to the next step, or mark complete if at the final step
  const advanceStep = useCallback(async () => {
    if (!narrative) return;
    const nextStep = NEXT_STEP[narrative.currentStep];
    if (!nextStep) {
      // Final step — mark complete
      await updateEraNarrative(narrative.narrativeId, { status: "complete" });
      setNarrative((prev) => (prev ? { ...prev, status: "complete" } : null));
      stopPolling();
      return;
    }
    await advanceRecord(narrative.narrativeId, narrative.currentStep);
    startPolling(narrative.narrativeId);
  }, [narrative, advanceRecord, startPolling, stopPolling]);

  // Skip edit step and mark complete
  const skipEdit = useCallback(async () => {
    if (!narrative) return;

    await updateEraNarrative(narrative.narrativeId, { status: "complete" });
    setNarrative((prev) => (prev ? { ...prev, status: "complete" } : null));
    stopPolling();
  }, [narrative, stopPolling]);

  // Re-run copy edit on the latest version of a completed narrative
  const rerunCopyEdit = useCallback(async () => {
    if (!narrative) return;

    // Reset to edit step + pending so the worker picks it up
    await updateEraNarrative(narrative.narrativeId, {
      status: "pending",
      currentStep: "edit",
    });

    setNarrative((prev) =>
      prev
        ? {
            ...prev,
            status: "pending",
            currentStep: "edit",
          }
        : null
    );

    headlessRef.current = false;
    dispatchTask(narrative.narrativeId);
    startPolling(narrative.narrativeId);
  }, [narrative, dispatchTask, startPolling]);

  // Delete a content version (cannot delete the generate version)
  const deleteVersion = useCallback(
    async (versionId: string) => {
      if (!narrative) return;
      const updated = await deleteEraNarrativeVersion(narrative.narrativeId, versionId);
      setNarrative(updated);
    },
    [narrative]
  );

  // Set the active content version
  const setActiveVersion = useCallback(
    async (versionId: string) => {
      if (!narrative) return;
      const updated = await setEraNarrativeActiveVersion(narrative.narrativeId, versionId);
      setNarrative(updated);
    },
    [narrative]
  );

  // Cancel
  const cancel = useCallback(() => {
    headlessRef.current = false;
    setIsActive(false);
    stopPolling();
    if (narrative?.narrativeId) {
      deleteEraNarrative(narrative.narrativeId).catch(() => {});
    }
    setNarrative(null);
  }, [narrative, stopPolling]);

  return {
    narrative,
    isActive,
    startNarrative,
    startHeadless,
    resumeNarrative,
    advanceStep,
    skipEdit,
    rerunCopyEdit,
    deleteVersion,
    setActiveVersion,
    cancel,
  };
}
