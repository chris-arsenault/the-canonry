/**
 * Tone Ranking Store — Zustand store for bulk tone ranking + corpus assignment state.
 *
 * Survives component unmounts (tab switching). The polling loop and async logic
 * live here, not in a React hook, so they persist across ChroniclePanel remounts.
 */

import { create } from 'zustand';
import { getEnqueue } from './enrichmentQueueBridge';
import {
  getChronicle,
  getChroniclesForSimulation,
  updateChronicleAssignedTone,
} from './chronicleRepository';
import { useIlluminatorConfigStore } from './illuminatorConfigStore';
import { assignCorpusTones, countDistribution } from '../../hooks/useToneRanking';
import type { ChronicleNavItem } from './chronicleNav';
import type { HistorianTone } from '../historianTypes';
import type {
  ToneRankingProgress,
  ToneRankingChronicleSummary,
  ToneAssignmentPreview,
  ToneAssignmentEntry,
} from '../../hooks/useToneRanking';

// ============================================================================
// Store
// ============================================================================

interface ToneRankingStoreState {
  progress: ToneRankingProgress;
  assignmentPreview: ToneAssignmentPreview | null;

  // Actions — Phase 1: LLM Ranking
  prepareToneRanking: (chronicleItems: ChronicleNavItem[]) => void;
  confirmToneRanking: () => void;
  cancelToneRanking: () => void;
  closeToneRanking: () => void;

  // Actions — Phase 2: Corpus Assignment
  prepareAssignment: () => Promise<void>;
  applyAssignment: (entries: ToneAssignmentEntry[]) => Promise<void>;
  closeAssignment: () => void;
}

const IDLE_PROGRESS: ToneRankingProgress = {
  status: 'idle',
  chronicles: [],
  totalChronicles: 0,
  processedChronicles: 0,
  currentTitle: '',
  totalCost: 0,
  failedChronicles: [],
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Module-level refs (survive across store actions, not tied to React lifecycle)
let activeFlag = false;
let cancelledFlag = false;
let scanData: { chronicles: ToneRankingChronicleSummary[] } | null = null;

export const useToneRankingStore = create<ToneRankingStoreState>((set, get) => ({
  progress: IDLE_PROGRESS,
  assignmentPreview: null,

  // ========================================================================
  // Phase 1: LLM Ranking
  // ========================================================================

  prepareToneRanking: (chronicleItems) => {
    if (activeFlag) return;

    const eligible = chronicleItems.filter(
      (c) => (c.status === 'complete' || c.status === 'assembly_ready') && c.hasSummary,
    );

    const chronicles: ToneRankingChronicleSummary[] = eligible.map((c) => ({
      chronicleId: c.chronicleId,
      title: c.title || c.name,
    }));

    if (chronicles.length === 0) {
      set({
        progress: {
          ...IDLE_PROGRESS,
          status: 'failed',
          error: 'No eligible chronicles (need summary, no existing ranking)',
        },
      });
      return;
    }

    scanData = { chronicles };

    set({
      progress: {
        ...IDLE_PROGRESS,
        status: 'confirming',
        chronicles,
        totalChronicles: chronicles.length,
      },
    });
  },

  confirmToneRanking: () => {
    const scan = scanData;
    if (!scan || activeFlag) return;

    activeFlag = true;
    cancelledFlag = false;

    set((s) => ({ progress: { ...s.progress, status: 'running', currentTitle: 'Loading chronicles...' } }));

    (async () => {
      try {
        const { chronicles } = scan;

        const bulkEntries: Array<{
          chronicleId: string;
          title: string;
          format: string;
          narrativeStyleName?: string;
          summary: string;
          brief?: string;
        }> = [];
        const prevTimestamps = new Map<string, number>();

        for (const chron of chronicles) {
          const record = await getChronicle(chron.chronicleId);
          if (!record?.summary) continue;

          prevTimestamps.set(chron.chronicleId, record.toneRanking?.generatedAt ?? 0);

          bulkEntries.push({
            chronicleId: chron.chronicleId,
            title: chron.title,
            summary: record.summary,
            format: record.format || 'story',
            narrativeStyleName: record.narrativeStyle?.name,
            brief: record.perspectiveSynthesis?.brief,
          });
        }

        if (bulkEntries.length === 0) {
          set((s) => ({ progress: { ...s.progress, status: 'failed', error: 'No chronicles with summaries found', currentTitle: '' } }));
          return;
        }

        const batchN = Math.max(1, Math.round(bulkEntries.length / 40));
        const batchSize = Math.ceil(bulkEntries.length / batchN);
        const batchCount = batchN;

        set((s) => ({
          progress: {
            ...s.progress,
            currentTitle: `Ranking ${bulkEntries.length} chronicles in ${batchCount} batch${batchCount > 1 ? 'es' : ''}...`,
            totalChronicles: bulkEntries.length,
          },
        }));

        const syntheticEntity = {
          id: 'bulk-tone-ranking',
          name: 'Bulk Tone Ranking',
          kind: 'chronicle',
          subtype: '',
          prominence: 'recognized',
          culture: '',
          status: 'active',
          description: '',
          tags: {},
        };

        getEnqueue()([{
          entity: syntheticEntity as never,
          type: 'bulkToneRanking' as const,
          prompt: JSON.stringify(bulkEntries),
        }]);

        // Poll for incremental progress
        let lastUpdatedCount = 0;

        while (!cancelledFlag) {
          await sleep(2000);
          if (cancelledFlag) break;

          let updatedCount = 0;
          let totalCost = 0;
          for (const entry of bulkEntries) {
            const record = await getChronicle(entry.chronicleId);
            const prev = prevTimestamps.get(entry.chronicleId) ?? 0;
            if (record?.toneRanking?.generatedAt && record.toneRanking.generatedAt > prev) {
              updatedCount++;
              totalCost += record.toneRanking.actualCost ?? 0;
            }
          }

          if (updatedCount > lastUpdatedCount) {
            lastUpdatedCount = updatedCount;
            const currentBatch = Math.min(Math.ceil(updatedCount / batchSize), batchCount);
            set((s) => ({
              progress: {
                ...s.progress,
                processedChronicles: updatedCount,
                totalCost,
                currentTitle: updatedCount >= bulkEntries.length
                  ? ''
                  : `Batch ${currentBatch + 1}/${batchCount} — ${updatedCount}/${bulkEntries.length} ranked`,
              },
            }));
          }

          if (updatedCount >= bulkEntries.length) {
            set((s) => ({
              progress: {
                ...s.progress,
                status: 'complete',
                currentTitle: '',
                processedChronicles: updatedCount,
                totalCost,
              },
            }));
            break;
          }
        }

        if (cancelledFlag) {
          set((s) => ({ progress: { ...s.progress, status: 'cancelled', currentTitle: '' } }));
        }
      } catch (err) {
        console.error('[Tone Ranking] Fatal error:', err);
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

  cancelToneRanking: () => {
    cancelledFlag = true;
    scanData = null;
    const { progress } = get();
    if (progress.status === 'confirming') {
      set({ progress: IDLE_PROGRESS });
    }
  },

  closeToneRanking: () => {
    set({ progress: IDLE_PROGRESS });
  },

  // ========================================================================
  // Phase 2: Corpus Assignment
  // ========================================================================

  prepareAssignment: async () => {
    const { simulationRunId } = useIlluminatorConfigStore.getState();
    if (!simulationRunId) return;

    const allChronicles = await getChroniclesForSimulation(simulationRunId);
    const withRanking = allChronicles
      .filter((c) => c.toneRanking?.ranking?.length === 3)
      .map((c) => ({
        chronicleId: c.chronicleId,
        title: c.title || c.chronicleId,
        ranking: c.toneRanking!.ranking,
      }));

    if (withRanking.length === 0) return;

    const entries = assignCorpusTones(withRanking);
    const distribution = countDistribution(entries);

    set({ assignmentPreview: { entries, distribution } });
  },

  applyAssignment: async (entries) => {
    for (const entry of entries) {
      await updateChronicleAssignedTone(entry.chronicleId, entry.assignedTone);
    }
    set({ assignmentPreview: null });
  },

  closeAssignment: () => {
    set({ assignmentPreview: null });
  },
}));
