/**
 * useHistorianReview - Hook for historian annotation of entities and chronicles
 *
 * Follows the useCopyEdit pattern:
 * 1. Create run in IndexedDB with target context
 * 2. Dispatch worker task
 * 3. Monitor IndexedDB for status changes (polling)
 * 4. User reviews notes via HistorianReviewModal
 * 5. Apply accepted notes to entity enrichment or chronicle record
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentType } from '../lib/enrichmentTypes';
import type {
  HistorianRun,
  HistorianNote,
  HistorianConfig,
  HistorianTargetType,
  HistorianTone,
} from '../lib/historianTypes';
import {
  createHistorianRun,
  getHistorianRun,
  updateHistorianRun,
  deleteHistorianRun,
  generateHistorianRunId,
} from '../lib/db/historianRepository';

// ============================================================================
// Types
// ============================================================================

export interface HistorianReviewConfig {
  projectId: string;
  simulationRunId: string;
  targetType: HistorianTargetType;
  targetId: string;
  targetName: string;
  sourceText: string;
  /** Serialized entity/chronicle metadata + neighbor summaries + world context */
  contextJson: string;
  /** Serialized sample of historian's prior annotations */
  previousNotesJson: string;
  /** The historian persona config */
  historianConfig: HistorianConfig;
  /** Tone/mood for this review session */
  tone: HistorianTone;
}

export interface UseHistorianReviewReturn {
  /** Current run state */
  run: HistorianRun | null;
  /** Whether a historian review session is active */
  isActive: boolean;
  /** Start a new historian review session */
  startReview: (config: HistorianReviewConfig) => void;
  /** Toggle accept/reject for a note */
  toggleNoteDecision: (noteId: string, accepted: boolean) => void;
  /** Apply accepted notes and close the session */
  applyAccepted: () => HistorianNote[];
  /** Cancel the current session */
  cancelReview: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 1500;

// ============================================================================
// Hook
// ============================================================================

export function useHistorianReview(
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void,
): UseHistorianReviewReturn {
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
  const dispatchTask = useCallback((runId: string) => {
    const sentinelEntity = {
      id: '__historian_review__',
      name: 'Historian Review',
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
      type: 'historianReview' as EnrichmentType,
      prompt: '', // All data is in IndexedDB run context
      chronicleId: runId, // Repurpose chronicleId field for runId
    }]);
  }, [onEnqueue]);

  // Poll IndexedDB for run state changes
  const startPolling = useCallback((runId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const updated = await getHistorianRun(runId);
      if (!updated) return;

      setRun(updated);

      // Stop polling on review/terminal states
      if (
        updated.status === 'reviewing' ||
        updated.status === 'complete' ||
        updated.status === 'failed' ||
        updated.status === 'cancelled'
      ) {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Start a new historian review session
  const startReview = useCallback(async (config: HistorianReviewConfig) => {
    const runId = generateHistorianRunId();
    const now = Date.now();

    const newRun: HistorianRun = {
      runId,
      projectId: config.projectId,
      simulationRunId: config.simulationRunId,
      status: 'pending',
      tone: config.tone,
      targetType: config.targetType,
      targetId: config.targetId,
      targetName: config.targetName,
      sourceText: config.sourceText,
      notes: [],
      noteDecisions: {},
      contextJson: config.contextJson,
      previousNotesJson: config.previousNotesJson,
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
  }, [dispatchTask, startPolling]);

  // Toggle accept/reject for a note
  const toggleNoteDecision = useCallback(async (noteId: string, accepted: boolean) => {
    if (!run) return;

    const newDecisions = { ...run.noteDecisions, [noteId]: accepted };
    await updateHistorianRun(run.runId, { noteDecisions: newDecisions });

    setRun((prev) => prev ? { ...prev, noteDecisions: newDecisions } : null);
  }, [run]);

  // Apply accepted notes and return them
  const applyAccepted = useCallback((): HistorianNote[] => {
    if (!run) return [];

    // Collect notes where accepted (default to accepted if no explicit decision)
    const acceptedNotes: HistorianNote[] = run.notes.filter(
      (note) => run.noteDecisions[note.noteId] !== false
    );

    // Clean up
    setIsActive(false);
    stopPolling();
    if (run.runId) {
      deleteHistorianRun(run.runId).catch(() => {});
    }
    setRun(null);

    return acceptedNotes;
  }, [run, stopPolling]);

  // Cancel
  const cancelReview = useCallback(() => {
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
    startReview,
    toggleNoteDecision,
    applyAccepted,
    cancelReview,
  };
}
