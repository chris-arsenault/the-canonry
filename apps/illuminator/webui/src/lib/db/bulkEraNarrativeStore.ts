/**
 * bulkEraNarrativeStore — Zustand store for bulk era narrative generation.
 *
 * Runs all eras (that have prepped chronicles) through the full era narrative
 * pipeline (threads → generate → edit) sequentially. Each era produces a
 * complete EraNarrativeRecord in IndexedDB.
 *
 * Follows the bulkChronicleAnnotationStore pattern: Zustand store with
 * module-level flags, fire-and-forget async processing loop, IndexedDB polling.
 */

import { create } from 'zustand';
import type { ChronicleNavItem } from './chronicleNav';
import type { EraTemporalEntry } from './indexTypes';
import type { EraNarrativeStep, EraNarrativeRecord, EraNarrativeTone } from '../eraNarrativeTypes';
import type { EnrichmentType } from '../enrichmentTypes';
import {
  createEraNarrative,
  getEraNarrative,
  updateEraNarrative,
  generateEraNarrativeId,
  getEraNarrativesForEra,
} from './eraNarrativeRepository';
import { useChronicleStore } from './chronicleStore';
import { useIlluminatorConfigStore } from './illuminatorConfigStore';
import { getEnqueue } from './enrichmentQueueBridge';
import { sleep } from './historianRunHelpers';

// ============================================================================
// Types
// ============================================================================

export interface BulkEraNarrativeEraSummary {
  eraId: string;
  eraName: string;
  order: number;
  preppedCount: number;
  totalCount: number;
  hasExisting: boolean;
  tone: EraNarrativeTone;
}

export interface BulkEraNarrativeProgress {
  status: 'idle' | 'confirming' | 'running' | 'complete' | 'cancelled' | 'failed';
  eras: BulkEraNarrativeEraSummary[];
  totalEras: number;
  processedEras: number;
  currentEraName: string;
  currentStep: EraNarrativeStep | '';
  currentNarrativeId: string;
  totalCost: number;
  totalWords: number;
  error?: string;
}

const IDLE_PROGRESS: BulkEraNarrativeProgress = {
  status: 'idle',
  eras: [],
  totalEras: 0,
  processedEras: 0,
  currentEraName: '',
  currentStep: '',
  currentNarrativeId: '',
  totalCost: 0,
  totalWords: 0,
};

// ============================================================================
// Module-level flags (survive component unmounts)
// ============================================================================

let activeFlag = false;
let cancelledFlag = false;
let scanData: {
  eras: BulkEraNarrativeEraSummary[];
  tone: EraNarrativeTone;
  projectId: string;
  simulationRunId: string;
  eraTemporalInfo: EraTemporalEntry[];
  chronicleItems: ChronicleNavItem[];
  narrativeWeightMap: Record<string, string>;
} | null = null;

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 2000;

/** If a step stays in 'generating' with no status change for this long, assume the
 *  service worker died mid-task. */
const STALL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const STEP_ORDER: EraNarrativeStep[] = ['threads', 'generate', 'edit'];

// ============================================================================
// Helpers
// ============================================================================

const isCancelled = () => cancelledFlag;

function dispatchEraNarrativeTask(narrativeId: string): void {
  getEnqueue()([{
    entity: {
      id: '__era_narrative__',
      name: 'Era Narrative',
      kind: 'system',
      subtype: '',
      prominence: '',
      culture: '',
      status: 'active',
      description: '',
      tags: {},
    },
    type: 'eraNarrative' as EnrichmentType,
    prompt: '',
    chronicleId: narrativeId,
  }]);
}

async function pollEraNarrativeStep(
  narrativeId: string,
): Promise<EraNarrativeRecord | null> {
  let lastSeenStatus: string | null = null;
  let lastChangeTime = Date.now();

  while (true) {
    if (isCancelled()) return null;
    await sleep(POLL_INTERVAL_MS);
    if (isCancelled()) return null;

    const record = await getEraNarrative(narrativeId);
    if (!record) return null;

    // Track status transitions for stall detection
    if (record.status !== lastSeenStatus) {
      lastSeenStatus = record.status;
      lastChangeTime = Date.now();
    }

    if (record.status === 'step_complete' || record.status === 'complete') {
      return record;
    }
    if (record.status === 'failed') {
      throw new Error(record.error || 'Era narrative step failed');
    }

    // If the record has been stuck in 'generating' with no change, the
    // service worker likely died mid-task.
    if (Date.now() - lastChangeTime > STALL_TIMEOUT_MS) {
      throw new Error(`Task stalled — no progress for ${Math.round(STALL_TIMEOUT_MS / 60000)} minutes (service worker may have been terminated)`);
    }
  }
}

/**
 * Build the full era narrative config for a given era.
 * Mirrors EraNarrativeModal.buildConfig but operates outside React.
 */
async function buildEraConfig(
  eraId: string,
  eraName: string,
  tone: EraNarrativeTone,
  projectId: string,
  simulationRunId: string,
  eraTemporalInfo: EraTemporalEntry[],
  chronicleItems: ChronicleNavItem[],
  narrativeWeightMap: Record<string, string>,
) {
  const store = useChronicleStore.getState();
  const eraChronicles = chronicleItems.filter((c) => c.focalEraName === eraName);

  const prepBriefs = [];
  for (const item of eraChronicles) {
    const record = await store.loadChronicle(item.chronicleId);
    if (!record?.historianPrep) continue;
    prepBriefs.push({
      chronicleId: record.chronicleId,
      chronicleTitle: record.title || item.name,
      eraYear: record.eraYear,
      weight: record.narrativeStyle?.eraNarrativeWeight || narrativeWeightMap[record.narrativeStyleId] || undefined,
      prep: record.historianPrep,
    });
  }

  if (prepBriefs.length === 0) return null;

  // Build world-level context
  const configStore = useIlluminatorConfigStore.getState();
  const worldDynamics = configStore.worldContext?.worldDynamics || [];
  const cultureIds = configStore.cultureIdentities || {};

  // Only include dynamics that have an override for this era
  const resolvedDynamics = worldDynamics
    .filter((d) => d.eraOverrides?.[eraId])
    .map((d) => {
      const override = d.eraOverrides![eraId];
      return override.replace ? override.text : `${d.text || ''} ${override.text}`;
    })
    .filter(Boolean);

  const focalEraInfo = eraTemporalInfo.find((e) => e.id === eraId);
  const focalOrder = focalEraInfo?.order ?? -1;
  const previousEraInfo = focalOrder > 0
    ? eraTemporalInfo.find((e) => e.order === focalOrder - 1)
    : undefined;
  const nextEraInfo = eraTemporalInfo.find((e) => e.order === focalOrder + 1);

  const toSummary = (info?: EraTemporalEntry) =>
    info ? { id: info.id, name: info.name, summary: info.summary || '' } : undefined;

  // Look up the previous era's completed narrative thesis for continuity
  let previousEraThesis: string | undefined;
  if (previousEraInfo) {
    const prevNarratives = await getEraNarrativesForEra(simulationRunId, previousEraInfo.id);
    const completedPrev = prevNarratives
      .filter((r) => r.status === 'complete' && r.threadSynthesis?.thesis)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (completedPrev.length > 0) {
      previousEraThesis = completedPrev[0].threadSynthesis!.thesis;
    }
  }

  const worldContext = focalEraInfo ? {
    focalEra: toSummary(focalEraInfo)!,
    previousEra: toSummary(previousEraInfo),
    nextEra: toSummary(nextEraInfo),
    previousEraThesis,
    resolvedDynamics,
    culturalIdentities: cultureIds,
  } : undefined;

  const historianConfig = configStore.historianConfig;

  return {
    projectId,
    simulationRunId,
    eraId,
    eraName,
    tone,
    historianConfig,
    prepBriefs,
    worldContext,
  };
}

// ============================================================================
// Store
// ============================================================================

interface BulkEraNarrativeStore {
  progress: BulkEraNarrativeProgress;
  prepareBulk: (
    chronicleItems: ChronicleNavItem[],
    wizardEras: EraTemporalEntry[],
    eraTemporalInfo: EraTemporalEntry[],
    projectId: string,
    simulationRunId: string,
    tone: EraNarrativeTone,
    narrativeWeightMap: Record<string, string>,
  ) => void;
  /** Set the tone for a single era (confirmation phase only) */
  setEraTone: (eraId: string, tone: EraNarrativeTone) => void;
  /** Set every era to the same tone */
  setAllTones: (tone: EraNarrativeTone) => void;
  confirmBulk: () => void;
  cancelBulk: () => void;
  closeBulk: () => void;
}

export const useBulkEraNarrativeStore = create<BulkEraNarrativeStore>((set) => ({
  progress: IDLE_PROGRESS,

  prepareBulk(chronicleItems, wizardEras, eraTemporalInfo, projectId, simulationRunId, tone, narrativeWeightMap) {
    if (activeFlag) return;

    // Filter eras that have at least one prepped chronicle, sorted by temporal order
    const eligible: BulkEraNarrativeEraSummary[] = wizardEras
      .map((era) => {
        const eraChronicles = chronicleItems.filter((c) => c.focalEraName === era.name);
        const preppedCount = eraChronicles.filter((c) => c.hasHistorianPrep).length;
        return {
          eraId: era.id,
          eraName: era.name,
          order: era.order,
          preppedCount,
          totalCount: eraChronicles.length,
          hasExisting: false, // will be populated async
          tone,
        };
      })
      .filter((e) => e.preppedCount > 0)
      .sort((a, b) => a.order - b.order);

    if (eligible.length === 0) return;

    // Check for existing narratives async (fire-and-forget, updates store)
    (async () => {
      const updated = [...eligible];
      for (const era of updated) {
        const existing = await getEraNarrativesForEra(simulationRunId, era.eraId);
        era.hasExisting = existing.some((r) => r.status === 'complete');
      }
      set((s) => {
        if (s.progress.status !== 'confirming') return s;
        return { progress: { ...s.progress, eras: updated } };
      });
    })();

    scanData = { eras: eligible, tone, projectId, simulationRunId, eraTemporalInfo, chronicleItems, narrativeWeightMap };

    set({
      progress: {
        status: 'confirming',
        eras: eligible,
        totalEras: eligible.length,
        processedEras: 0,
        currentEraName: '',
        currentStep: '',
        currentNarrativeId: '',
        totalCost: 0,
        totalWords: 0,
      },
    });
  },

  setEraTone(eraId, newTone) {
    set((s) => {
      if (s.progress.status !== 'confirming') return s;
      const eras = s.progress.eras.map((e) =>
        e.eraId === eraId ? { ...e, tone: newTone } : e,
      );
      // Keep scanData in sync
      if (scanData) scanData.eras = eras;
      return { progress: { ...s.progress, eras } };
    });
  },

  setAllTones(newTone) {
    set((s) => {
      if (s.progress.status !== 'confirming') return s;
      const eras = s.progress.eras.map((e) => ({ ...e, tone: newTone }));
      if (scanData) scanData.eras = eras;
      return { progress: { ...s.progress, eras } };
    });
  },

  confirmBulk() {
    if (!scanData || activeFlag) return;

    activeFlag = true;
    cancelledFlag = false;
    const { eras, projectId, simulationRunId, eraTemporalInfo, chronicleItems, narrativeWeightMap } = scanData;

    set((s) => ({ progress: { ...s.progress, status: 'running' } }));

    (async () => {
      try {
        let globalProcessed = 0;
        let globalCost = 0;
        let globalWords = 0;

        for (const era of eras) {
          if (cancelledFlag) break;

          set((s) => ({
            progress: {
              ...s.progress,
              currentEraName: era.eraName,
              currentStep: 'threads',
              currentNarrativeId: '',
            },
          }));

          // Build config for this era (each era has its own tone)
          const config = await buildEraConfig(
            era.eraId, era.eraName, era.tone,
            projectId, simulationRunId,
            eraTemporalInfo, chronicleItems, narrativeWeightMap,
          );

          if (!config) {
            globalProcessed++;
            set((s) => ({ progress: { ...s.progress, processedEras: globalProcessed } }));
            continue;
          }

          // Create narrative record
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
            prepBriefs: config.prepBriefs,
            worldContext: config.worldContext,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalActualCost: 0,
            createdAt: now,
            updatedAt: now,
          };

          await createEraNarrative(newRecord);

          set((s) => ({
            progress: { ...s.progress, currentNarrativeId: narrativeId },
          }));

          // Run all 3 steps sequentially
          for (let stepIdx = 0; stepIdx < STEP_ORDER.length; stepIdx++) {
            if (cancelledFlag) break;

            const step = STEP_ORDER[stepIdx];
            set((s) => ({ progress: { ...s.progress, currentStep: step } }));

            // Dispatch the task
            dispatchEraNarrativeTask(narrativeId);

            // Poll until step completes
            const result = await pollEraNarrativeStep(narrativeId);
            if (cancelledFlag || !result) break;

            // If there's a next step, advance the record
            const nextStep = STEP_ORDER[stepIdx + 1];
            if (nextStep) {
              await updateEraNarrative(narrativeId, {
                status: 'pending',
                currentStep: nextStep,
              });
            }
          }

          if (cancelledFlag) break;

          // Mark complete and collect stats
          await updateEraNarrative(narrativeId, { status: 'complete' });

          const finalRecord = await getEraNarrative(narrativeId);
          if (finalRecord) {
            globalCost += finalRecord.totalActualCost || 0;
            const wc = finalRecord.narrative?.editedWordCount || finalRecord.narrative?.wordCount || 0;
            globalWords += wc;
          }

          globalProcessed++;
          set((s) => ({
            progress: {
              ...s.progress,
              processedEras: globalProcessed,
              totalCost: globalCost,
              totalWords: globalWords,
            },
          }));
        }

        if (cancelledFlag) {
          set((s) => ({
            progress: { ...s.progress, status: 'cancelled', currentEraName: '', currentStep: '', currentNarrativeId: '' },
          }));
        } else {
          set((s) => ({
            progress: { ...s.progress, status: 'complete', currentEraName: '', currentStep: '', currentNarrativeId: '' },
          }));
        }
      } catch (err) {
        console.error('[Bulk Era Narrative] Failed:', err);
        set((s) => ({
          progress: {
            ...s.progress,
            status: 'failed',
            currentEraName: '',
            currentStep: '',
            currentNarrativeId: '',
            error: err instanceof Error ? err.message : String(err),
          },
        }));
      } finally {
        activeFlag = false;
        scanData = null;
      }
    })();
  },

  cancelBulk() {
    cancelledFlag = true;
    scanData = null;
    set((s) => {
      if (s.progress.status === 'confirming') return { progress: IDLE_PROGRESS };
      return s;
    });
  },

  closeBulk() {
    if (!activeFlag) {
      scanData = null;
      set({ progress: IDLE_PROGRESS });
    }
  },
}));
