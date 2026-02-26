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

import { create } from "zustand";
import type { ChronicleNavItem } from "./chronicleNav";
import { createHistorianRun, generateHistorianRunId } from "./historianRepository";
import { updateChronicleHistorianNotes } from "./chronicleRepository";
import { useChronicleStore } from "./chronicleStore";
import { buildChronicleReviewContext } from "../historianContextBuilders";
import type { CorpusVoiceDigestCache, ReinforcementCache } from "../historianContextBuilders";
import {
  dispatchReviewTask,
  pollReviewCompletion,
  extractReinforcedFactIds,
} from "./historianRunHelpers";

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
  status: "idle" | "confirming" | "running" | "complete" | "cancelled" | "failed";
  operation: "run" | "clear";
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
  status: "idle",
  operation: "run",
  chronicles: [],
  totalChronicles: 0,
  processedChronicles: 0,
  currentTitle: "",
  totalCost: 0,
  failedChronicles: [],
};

// ============================================================================
// Module-level flags (survive component unmounts)
// ============================================================================

let activeFlag = false;
let cancelledFlag = false;
let scanData: {
  operation: "run" | "clear";
  chronicles: BulkAnnotationChronicleSummary[];
} | null = null;

// ============================================================================
// Cancellation check for shared poll helper
// ============================================================================

const isCancelled = () => cancelledFlag;

// ============================================================================
// Bulk annotation runners (extracted for cognitive-complexity)
// ============================================================================

type SetFn = (fn: (s: BulkChronicleAnnotationStore) => Partial<BulkChronicleAnnotationStore>) => void;

async function clearAllAnnotations(
  chronicles: BulkAnnotationChronicleSummary[],
  set: SetFn,
  state: { processed: number; failed: Array<{ chronicleId: string; title: string; error: string }> }
): Promise<void> {
  for (const chron of chronicles) {
    if (cancelledFlag) break;
    set((s) => ({ progress: { ...s.progress, currentTitle: chron.title } }));
    try {
      await updateChronicleHistorianNotes(chron.chronicleId, [], undefined, []);
      state.processed++;
      set((s) => ({ progress: { ...s.progress, processedChronicles: state.processed } }));
    } catch (err) {
      state.processed++;
      state.failed.push({ chronicleId: chron.chronicleId, title: chron.title, error: err instanceof Error ? err.message : String(err) });
      set((s) => ({ progress: { ...s.progress, processedChronicles: state.processed, failedChronicles: [...state.failed] } }));
    }
  }
}

async function annotateChronicle(
  chron: BulkAnnotationChronicleSummary,
  caches: { corpusStrength: any; voiceDigest: CorpusVoiceDigestCache; reinforcement: ReinforcementCache },
  set: SetFn,
  state: { processed: number; cost: number; failed: Array<{ chronicleId: string; title: string; error: string }> }
): Promise<boolean> {
  const tone = chron.assignedTone || "weary";
  set((s) => ({ progress: { ...s.progress, currentTitle: chron.title, currentTone: tone } }));

  const config = await buildChronicleReviewContext(chron.chronicleId, tone, caches.corpusStrength, caches.voiceDigest, caches.reinforcement);
  if (!config) {
    state.processed++;
    set((s) => ({ progress: { ...s.progress, processedChronicles: state.processed } }));
    return true;
  }

  const runId = generateHistorianRunId();
  const now = Date.now();
  await createHistorianRun({
    runId, projectId: config.projectId, simulationRunId: config.simulationRunId,
    status: "pending", tone: config.tone, targetType: "chronicle",
    targetId: config.targetId, targetName: config.targetName, sourceText: config.sourceText,
    notes: [], noteDecisions: {}, contextJson: config.contextJson,
    previousNotesJson: config.previousNotesJson,
    historianConfigJson: JSON.stringify(config.historianConfig),
    inputTokens: 0, outputTokens: 0, actualCost: 0, createdAt: now, updatedAt: now,
  });

  dispatchReviewTask(runId);
  const result = await pollReviewCompletion(runId, isCancelled);
  if (cancelledFlag || !result) return false;

  if (result.notes.length > 0) {
    const reinforcedFacts = extractReinforcedFactIds(config.contextJson);
    await updateChronicleHistorianNotes(chron.chronicleId, result.notes, result.prompts, reinforcedFacts);
    caches.reinforcement.runId = null;
    caches.reinforcement.data = null;
  }
  state.cost += result.cost;
  state.processed++;
  set((s) => ({
    progress: { ...s.progress, processedChronicles: state.processed, totalCost: state.cost, failedChronicles: [...state.failed] },
  }));
  return true;
}

async function runAnnotations(
  chronicles: BulkAnnotationChronicleSummary[],
  set: SetFn,
  state: { processed: number; cost: number; failed: Array<{ chronicleId: string; title: string; error: string }> }
): Promise<void> {
  const caches = {
    corpusStrength: { runId: null as string | null, strength: null as Map<string, number> | null },
    voiceDigest: { runId: null, digest: null } as CorpusVoiceDigestCache,
    reinforcement: { runId: null, data: null } as ReinforcementCache,
  };

  for (const chron of chronicles) {
    if (cancelledFlag) break;
    try {
      const shouldContinue = await annotateChronicle(chron, caches, set, state);
      if (!shouldContinue) break;
    } catch (err) {
      console.error(`[Bulk Chronicle Annotation] ${chron.title} failed:`, err);
      state.processed++;
      state.failed.push({ chronicleId: chron.chronicleId, title: chron.title, error: err instanceof Error ? err.message : String(err) });
      set((s) => ({
        progress: { ...s.progress, processedChronicles: state.processed, totalCost: state.cost, failedChronicles: [...state.failed] },
      }));
    }
  }
}

async function runBulkAnnotation(
  chronicles: BulkAnnotationChronicleSummary[],
  operation: "run" | "clear",
  set: SetFn,
  _isCancelled: () => boolean
): Promise<void> {
  try {
    const state = { processed: 0, cost: 0, failed: [] as Array<{ chronicleId: string; title: string; error: string }> };

    if (operation === "clear") {
      await clearAllAnnotations(chronicles, set, state);
    } else {
      await runAnnotations(chronicles, set, state);
    }

    await useChronicleStore.getState().refreshAll();
    const finalStatus = cancelledFlag ? "cancelled" : "complete";
    set((s) => ({ progress: { ...s.progress, status: finalStatus, currentTitle: "" } }));
  } catch (err) {
    console.error("[Bulk Chronicle Annotation] Fatal error:", err);
    set((s) => ({
      progress: { ...s.progress, status: "failed", currentTitle: "", error: err instanceof Error ? err.message : String(err) },
    }));
  }
}

// ============================================================================
// Store
// ============================================================================

interface BulkChronicleAnnotationStore {
  progress: BulkAnnotationProgress;
  prepareAnnotation: (operation: "run" | "clear", chronicleItems: ChronicleNavItem[]) => void;
  confirmAnnotation: () => void;
  cancelAnnotation: () => void;
  closeAnnotation: () => void;
}

export const useBulkChronicleAnnotationStore = create<BulkChronicleAnnotationStore>((set) => ({
  progress: IDLE_PROGRESS,

  prepareAnnotation(operation, chronicleItems) {
    if (activeFlag) return;

    let eligible: BulkAnnotationChronicleSummary[];

    if (operation === "run") {
      // Run: complete chronicles with finalContent
      eligible = chronicleItems
        .filter((c) => c.status === "complete")
        .map((c) => ({
          chronicleId: c.chronicleId,
          title: c.title || c.name || "Untitled",
          assignedTone: c.assignedTone,
          hasNotes: c.historianNoteCount > 0,
        }));
    } else {
      // Clear: chronicles that have historian notes
      eligible = chronicleItems
        .filter((c) => c.historianNoteCount > 0)
        .map((c) => ({
          chronicleId: c.chronicleId,
          title: c.title || c.name || "Untitled",
          assignedTone: c.assignedTone,
          hasNotes: true,
        }));
    }

    if (eligible.length === 0) return;

    scanData = { operation, chronicles: eligible };

    set({
      progress: {
        status: "confirming",
        operation,
        chronicles: eligible,
        totalChronicles: eligible.length,
        processedChronicles: 0,
        currentTitle: "",
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

    set((s) => ({ progress: { ...s.progress, status: "running" } }));

    void runBulkAnnotation(chronicles, operation, set, isCancelled)
      .finally(() => { activeFlag = false; scanData = null; });
  },

  cancelAnnotation() {
    cancelledFlag = true;
    scanData = null;
    set((s) => {
      if (s.progress.status === "confirming") return { progress: IDLE_PROGRESS };
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
