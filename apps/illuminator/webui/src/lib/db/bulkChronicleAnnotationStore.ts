/**
 * bulkChronicleAnnotationStore — Zustand store for bulk chronicle historian annotations
 *
 * Two operations:
 * 1. Run Annotations: Sequential historian review on all eligible chronicles,
 *    auto-applying results (no manual review step).
 * 2. Clear Annotations: Batch-clear historian notes from all chronicles with notes.
 *
 * State lives in Zustand so it survives component unmounts during tab switches.
 * Same pattern as toneRankingStore.
 */

import { create } from 'zustand';
import type { ChronicleNavItem } from './chronicleNav';
import type { HistorianTone } from '../historianTypes';
import {
  createHistorianRun,
  generateHistorianRunId,
} from './historianRepository';
import { updateChronicleHistorianNotes } from './chronicleRepository';
import { useChronicleStore } from './chronicleStore';
import { buildChronicleReviewContext } from '../historianContextBuilders';
import type { CorpusVoiceDigestCache, ReinforcementCache } from '../historianContextBuilders';
import { dispatchReviewTask, pollReviewCompletion, extractReinforcedFactIds } from './historianRunHelpers';

// ============================================================================
// Types
// ============================================================================

export interface BulkAnnotationChronicleSummary {
  chronicleId: string;
  title: string;
  assignedTone?: string;
  hasNotes: boolean;
}

export interface BulkAnnotationProgress {
  status: 'idle' | 'confirming' | 'running' | 'complete' | 'cancelled' | 'failed';
  operation: 'run' | 'clear';
  chronicles: BulkAnnotationChronicleSummary[];
  totalChronicles: number;
  processedChronicles: number;
  currentTitle: string;
  currentTone?: string;
  totalCost: number;
  error?: string;
  failedChronicles: Array<{ chronicleId: string; title: string; error: string }>;
}

const IDLE_PROGRESS: BulkAnnotationProgress = {
  status: 'idle',
  operation: 'run',
  chronicles: [],
  totalChronicles: 0,
  processedChronicles: 0,
  currentTitle: '',
  totalCost: 0,
  failedChronicles: [],
};

// ============================================================================
// Module-level flags (survive component unmounts)
// ============================================================================

let activeFlag = false;
let cancelledFlag = false;
let scanData: {
  operation: 'run' | 'clear';
  chronicles: BulkAnnotationChronicleSummary[];
} | null = null;

// ============================================================================
// Cancellation check for shared poll helper
// ============================================================================

const isCancelled = () => cancelledFlag;

// ============================================================================
// Store
// ============================================================================

interface BulkChronicleAnnotationStore {
  progress: BulkAnnotationProgress;
  prepareAnnotation: (operation: 'run' | 'clear', chronicleItems: ChronicleNavItem[]) => void;
  confirmAnnotation: () => void;
  cancelAnnotation: () => void;
  closeAnnotation: () => void;
}

export const useBulkChronicleAnnotationStore = create<BulkChronicleAnnotationStore>((set) => ({
  progress: IDLE_PROGRESS,

  prepareAnnotation(operation, chronicleItems) {
    if (activeFlag) return;

    let eligible: BulkAnnotationChronicleSummary[];

    if (operation === 'run') {
      // Run: complete chronicles with finalContent
      eligible = chronicleItems
        .filter((c) => c.status === 'complete')
        .map((c) => ({
          chronicleId: c.chronicleId,
          title: c.title || c.name || 'Untitled',
          assignedTone: c.assignedTone,
          hasNotes: c.historianNoteCount > 0,
        }));
    } else {
      // Clear: chronicles that have historian notes
      eligible = chronicleItems
        .filter((c) => c.historianNoteCount > 0)
        .map((c) => ({
          chronicleId: c.chronicleId,
          title: c.title || c.name || 'Untitled',
          assignedTone: c.assignedTone,
          hasNotes: true,
        }));
    }

    if (eligible.length === 0) return;

    scanData = { operation, chronicles: eligible };

    set({
      progress: {
        status: 'confirming',
        operation,
        chronicles: eligible,
        totalChronicles: eligible.length,
        processedChronicles: 0,
        currentTitle: '',
        totalCost: 0,
        failedChronicles: [],
      },
    });
  },

  confirmAnnotation() {
    if (!scanData || activeFlag) return;

    activeFlag = true;
    cancelledFlag = false;
    const { operation, chronicles } = scanData;

    set((s) => ({ progress: { ...s.progress, status: 'running' } }));

    (async () => {
      try {
        let globalProcessed = 0;
        let globalCost = 0;
        const failedChronicles: Array<{ chronicleId: string; title: string; error: string }> = [];

        // Corpus strength cache shared across all chronicles in this run
        const corpusStrengthCache = { runId: null as string | null, strength: null as Map<string, number> | null };
        // Voice digest cache — annotation quality tracking, computed once per batch
        const voiceDigestCache: CorpusVoiceDigestCache = { runId: null, digest: null };
        // Reinforcement cache — dynamic dampening for fact guidance
        const reinforcementCache: ReinforcementCache = { runId: null, data: null };

        if (operation === 'clear') {
          // Clear all historian notes
          for (const chron of chronicles) {
            if (cancelledFlag) break;

            set((s) => ({
              progress: { ...s.progress, currentTitle: chron.title },
            }));

            try {
              await updateChronicleHistorianNotes(chron.chronicleId, [], undefined, []);
              globalProcessed++;
              set((s) => ({
                progress: { ...s.progress, processedChronicles: globalProcessed },
              }));
            } catch (err) {
              globalProcessed++;
              failedChronicles.push({
                chronicleId: chron.chronicleId,
                title: chron.title,
                error: err instanceof Error ? err.message : String(err),
              });
              set((s) => ({
                progress: {
                  ...s.progress,
                  processedChronicles: globalProcessed,
                  failedChronicles: [...failedChronicles],
                },
              }));
            }
          }
        } else {
          // Run annotations sequentially
          for (const chron of chronicles) {
            if (cancelledFlag) break;

            const tone = chron.assignedTone || 'weary';
            set((s) => ({
              progress: { ...s.progress, currentTitle: chron.title, currentTone: tone },
            }));

            try {
              const config = await buildChronicleReviewContext(
                chron.chronicleId,
                tone,
                corpusStrengthCache,
                voiceDigestCache,
                reinforcementCache,
              );
              if (!config) {
                globalProcessed++;
                set((s) => ({ progress: { ...s.progress, processedChronicles: globalProcessed } }));
                continue;
              }

              const runId = generateHistorianRunId();
              const now = Date.now();

              await createHistorianRun({
                runId,
                projectId: config.projectId,
                simulationRunId: config.simulationRunId,
                status: 'pending',
                tone: config.tone as HistorianTone,
                targetType: 'chronicle',
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
              });

              dispatchReviewTask(runId);

              const result = await pollReviewCompletion(runId, isCancelled);
              if (cancelledFlag || !result) break;

              // Auto-apply all notes (no manual review)
              if (result.notes.length > 0) {
                const reinforcedFacts = extractReinforcedFactIds(config.contextJson);
                await updateChronicleHistorianNotes(
                  chron.chronicleId,
                  result.notes,
                  result.prompts,
                  reinforcedFacts,
                );
                // Invalidate reinforcement cache so next chronicle sees updated counts
                reinforcementCache.runId = null;
                reinforcementCache.data = null;
              }
              globalCost += result.cost;

              globalProcessed++;
              set((s) => ({
                progress: {
                  ...s.progress,
                  processedChronicles: globalProcessed,
                  totalCost: globalCost,
                  failedChronicles: [...failedChronicles],
                },
              }));

            } catch (err) {
              console.error(`[Bulk Chronicle Annotation] ${chron.title} failed:`, err);
              globalProcessed++;
              failedChronicles.push({
                chronicleId: chron.chronicleId,
                title: chron.title,
                error: err instanceof Error ? err.message : String(err),
              });
              set((s) => ({
                progress: {
                  ...s.progress,
                  processedChronicles: globalProcessed,
                  totalCost: globalCost,
                  failedChronicles: [...failedChronicles],
                },
              }));
            }
          }
        }

        // Refresh chronicle store to pick up changes
        await useChronicleStore.getState().refreshAll();

        if (cancelledFlag) {
          set((s) => ({ progress: { ...s.progress, status: 'cancelled', currentTitle: '' } }));
        } else {
          set((s) => ({ progress: { ...s.progress, status: 'complete', currentTitle: '' } }));
        }
      } catch (err) {
        console.error('[Bulk Chronicle Annotation] Fatal error:', err);
        set((s) => ({
          progress: {
            ...s.progress,
            status: 'failed',
            currentTitle: '',
            error: err instanceof Error ? err.message : String(err),
          },
        }));
      } finally {
        activeFlag = false;
        scanData = null;
      }
    })();
  },

  cancelAnnotation() {
    cancelledFlag = true;
    scanData = null;
    set((s) => {
      if (s.progress.status === 'confirming') return { progress: IDLE_PROGRESS };
      return s; // running state will pick up cancellation via cancelledFlag
    });
  },

  closeAnnotation() {
    if (!activeFlag) {
      scanData = null;
      set({ progress: IDLE_PROGRESS });
    }
  },
}));
