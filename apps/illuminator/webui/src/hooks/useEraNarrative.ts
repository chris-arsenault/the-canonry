/**
 * useEraNarrative - Hook for multi-chapter era narrative generation
 *
 * Follows the useHistorianChronology pattern:
 * 1. Create EraNarrativeRecord in IndexedDB
 * 2. Dispatch worker task via onEnqueue
 * 3. Poll IndexedDB for status changes
 * 4. User reviews each step, then advances to the next
 * 5. Pauses between every step for prompt engineering iteration
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EnrichmentType } from '../lib/enrichmentTypes';
import type { HistorianConfig, HistorianTone } from '../lib/historianTypes';
import type {
  EraNarrativeRecord,
  EraNarrativePrepBrief,
} from '../lib/eraNarrativeTypes';
import {
  createEraNarrative,
  getEraNarrative,
  updateEraNarrative,
  deleteEraNarrative,
  generateEraNarrativeId,
} from '../lib/db/eraNarrativeRepository';

// ============================================================================
// Types
// ============================================================================

export interface EraNarrativeConfig {
  projectId: string;
  simulationRunId: string;
  eraId: string;
  eraName: string;
  tone: HistorianTone;
  historianConfig: HistorianConfig;
  prepBriefs: EraNarrativePrepBrief[];
}

export interface UseEraNarrativeReturn {
  /** Current narrative record state */
  narrative: EraNarrativeRecord | null;
  /** Whether a narrative session is active */
  isActive: boolean;
  /** Start a new narrative session */
  startNarrative: (config: EraNarrativeConfig) => Promise<void>;
  /** Advance to the next step (dispatches worker task) */
  advanceStep: () => Promise<void>;
  /** Skip chapter edit, go to next chapter or title */
  skipChapterEdit: () => Promise<void>;
  /** Select a title and mark complete */
  selectTitle: (title: string) => Promise<void>;
  /** Cancel the current session */
  cancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 2000;

// ============================================================================
// Hook
// ============================================================================

export function useEraNarrative(
  onEnqueue: (items: Array<{
    entity: { id: string; name: string; kind: string; subtype: string; prominence: string; culture: string; status: string; description: string; tags: Record<string, unknown> };
    type: EnrichmentType;
    prompt: string;
    chronicleId?: string;
  }>) => void,
): UseEraNarrativeReturn {
  const [narrative, setNarrative] = useState<EraNarrativeRecord | null>(null);
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
  const dispatchTask = useCallback((narrativeId: string) => {
    const sentinelEntity = {
      id: '__era_narrative__',
      name: 'Era Narrative',
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
      type: 'eraNarrative' as EnrichmentType,
      prompt: '',
      chronicleId: narrativeId, // Repurposed for narrativeId
    }]);
  }, [onEnqueue]);

  // Poll IndexedDB for state changes
  const startPolling = useCallback((narrativeId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const updated = await getEraNarrative(narrativeId);
      if (!updated) return;

      setNarrative(updated);

      // Stop polling on review/terminal states
      if (
        updated.status === 'step_complete' ||
        updated.status === 'complete' ||
        updated.status === 'failed' ||
        updated.status === 'cancelled'
      ) {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Start a new narrative session
  const startNarrative = useCallback(async (config: EraNarrativeConfig) => {
    const narrativeId = generateEraNarrativeId();
    const now = Date.now();

    const newRecord: EraNarrativeRecord = {
      narrativeId,
      projectId: config.projectId,
      simulationRunId: config.simulationRunId,
      eraId: config.eraId,
      eraName: config.eraName,
      status: 'pending',
      tone: config.tone,
      historianConfigJson: JSON.stringify(config.historianConfig),
      currentStep: 'threads',
      currentChapterIndex: 0,
      prepBriefs: config.prepBriefs,
      chapters: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalActualCost: 0,
      createdAt: now,
      updatedAt: now,
    };

    await createEraNarrative(newRecord);
    setNarrative(newRecord);
    setIsActive(true);

    dispatchTask(narrativeId);
    startPolling(narrativeId);
  }, [dispatchTask, startPolling]);

  // Advance to the next step
  const advanceStep = useCallback(async () => {
    if (!narrative?.threadSynthesis) return;

    const totalChapters = narrative.threadSynthesis.chapterPlan.length;
    let nextStep = narrative.currentStep;
    let nextChapterIndex = narrative.currentChapterIndex;

    switch (narrative.currentStep) {
      case 'threads':
        // After threads → first chapter
        nextStep = 'chapter';
        nextChapterIndex = 0;
        break;

      case 'chapter':
        // After chapter → chapter_edit (same index)
        nextStep = 'chapter_edit';
        break;

      case 'chapter_edit':
        // After edit → next chapter, or title if last
        if (narrative.currentChapterIndex < totalChapters - 1) {
          nextStep = 'chapter';
          nextChapterIndex = narrative.currentChapterIndex + 1;
        } else {
          nextStep = 'title';
        }
        break;

      case 'title':
        // After title → user calls selectTitle
        return;
    }

    await updateEraNarrative(narrative.narrativeId, {
      status: 'pending',
      currentStep: nextStep,
      currentChapterIndex: nextChapterIndex,
    });

    setNarrative((prev) => prev ? {
      ...prev,
      status: 'pending',
      currentStep: nextStep,
      currentChapterIndex: nextChapterIndex,
    } : null);

    dispatchTask(narrative.narrativeId);
    startPolling(narrative.narrativeId);
  }, [narrative, dispatchTask, startPolling]);

  // Skip chapter edit, go to next chapter or title
  const skipChapterEdit = useCallback(async () => {
    if (!narrative?.threadSynthesis) return;

    const totalChapters = narrative.threadSynthesis.chapterPlan.length;
    let nextStep: EraNarrativeRecord['currentStep'];
    let nextChapterIndex = narrative.currentChapterIndex;

    if (narrative.currentChapterIndex < totalChapters - 1) {
      nextStep = 'chapter';
      nextChapterIndex = narrative.currentChapterIndex + 1;
    } else {
      nextStep = 'title';
    }

    await updateEraNarrative(narrative.narrativeId, {
      status: 'pending',
      currentStep: nextStep,
      currentChapterIndex: nextChapterIndex,
    });

    setNarrative((prev) => prev ? {
      ...prev,
      status: 'pending',
      currentStep: nextStep,
      currentChapterIndex: nextChapterIndex,
    } : null);

    dispatchTask(narrative.narrativeId);
    startPolling(narrative.narrativeId);
  }, [narrative, dispatchTask, startPolling]);

  // Select title and mark complete
  const selectTitle = useCallback(async (title: string) => {
    if (!narrative) return;

    await updateEraNarrative(narrative.narrativeId, {
      status: 'complete',
      selectedTitle: title,
    });

    setNarrative((prev) => prev ? {
      ...prev,
      status: 'complete',
      selectedTitle: title,
    } : null);

    stopPolling();
  }, [narrative, stopPolling]);

  // Cancel
  const cancel = useCallback(() => {
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
    advanceStep,
    skipChapterEdit,
    selectTitle,
    cancel,
  };
}
