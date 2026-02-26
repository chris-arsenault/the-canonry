/**
 * interleavedAnnotationStore — Zustand store for interleaved chronicle + entity annotation.
 *
 * Processes chronicles in chronological order. After each chronicle, annotates
 * its referenced entities that haven't been annotated yet. This interleaving
 * ensures the corpus voice digest accumulates naturally across both target types,
 * preventing concentrated back-references.
 *
 * Same architectural pattern as bulkChronicleAnnotationStore:
 * module-level flags, prepare→confirm→run workflow, shared caches.
 */

import { create } from "zustand";
import type { ChronicleNavItem } from "./chronicleNav";
import type { EntityNavItem } from "./entityNav";
import type { HistorianTone } from "../historianTypes";
import { createHistorianRun, generateHistorianRunId } from "./historianRepository";
import { updateChronicleHistorianNotes } from "./chronicleRepository";
import { setHistorianNotes } from "./entityRepository";
import { useChronicleStore } from "./chronicleStore";
import { reloadEntities } from "../../hooks/useEntityCrud";
import {
  buildChronicleReviewContext,
  buildHistorianReviewContext,
} from "../historianContextBuilders";
import type { CorpusVoiceDigestCache, ReinforcementCache } from "../historianContextBuilders";
import type { HistorianReviewConfig } from "../../hooks/useHistorianReview";
import {
  dispatchReviewTask,
  pollReviewCompletion,
  extractReinforcedFactIds,
} from "./historianRunHelpers";

// ============================================================================
// Types
// ============================================================================

export type InterleavedWorkItem =
  | { type: "chronicle"; chronicleId: string; title: string; tone: string }
  | { type: "entity"; entityId: string; entityName: string; entityKind: string; tone: string };

export interface InterleavedAnnotationProgress {
  status: "idle" | "confirming" | "running" | "complete" | "cancelled" | "failed";
  workItems: InterleavedWorkItem[];
  totalItems: number;
  processedItems: number;
  currentItem?: InterleavedWorkItem;
  totalCost: number;
  error?: string;
  failedItems: Array<{ item: InterleavedWorkItem; error: string }>;
  chronicleCount: number;
  entityCount: number;
  processedChronicles: number;
  processedEntities: number;
}

const IDLE_PROGRESS: InterleavedAnnotationProgress = {
  status: "idle",
  workItems: [],
  totalItems: 0,
  processedItems: 0,
  totalCost: 0,
  failedItems: [],
  chronicleCount: 0,
  entityCount: 0,
  processedChronicles: 0,
  processedEntities: 0,
};

// ============================================================================
// Module-level flags (survive component unmounts)
// ============================================================================

let activeFlag = false;
let cancelledFlag = false;
let scanData: InterleavedWorkItem[] | null = null;

const isCancelled = () => cancelledFlag;

// ============================================================================
// Tone cycling for orphan entities
// ============================================================================

const ORPHAN_TONE_CYCLE: HistorianTone[] = [
  "witty",
  "weary",
  "forensic",
  "elegiac",
  "cantankerous",
];

/**
 * Compute previous-notes cap based on position in interleaved run.
 * Early items get fewer/no notes to avoid forced cross-references.
 */
function computeNotesMaxOverride(index: number): number | undefined {
  if (index <= 2) return 0;
  if (index <= 5) return 5;
  if (index <= 10) return 10;
  return undefined; // fall through to default 15
}

// ============================================================================
// Work list construction
// ============================================================================

function buildInterleavedWorkList(
  chronicleItems: ChronicleNavItem[],
  entityNavItems: Map<string, EntityNavItem>
): InterleavedWorkItem[] {
  const workItems: InterleavedWorkItem[] = [];

  // 1. Filter eligible chronicles (complete status, no existing notes)
  const eligible = chronicleItems.filter(
    (c) => c.status === "complete" && c.historianNoteCount === 0
  );

  // 2. Sort in chronological order: focalEraOrder → eraYear → era name
  //    Year-0 chronicles (mythology) are pushed to the end so the historian
  //    annotates them last, with a full corpus of prior notes to draw from.
  eligible.sort((a, b) => {
    const yearA = a.eraYear ?? Number.MAX_SAFE_INTEGER;
    const yearB = b.eraYear ?? Number.MAX_SAFE_INTEGER;
    const aIsZero = yearA === 0 ? 1 : 0;
    const bIsZero = yearB === 0 ? 1 : 0;
    if (aIsZero !== bIsZero) return aIsZero - bIsZero;
    const orderA = a.focalEraOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.focalEraOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (yearA !== yearB) return yearA - yearB;
    return (a.focalEraName || "").localeCompare(b.focalEraName || "");
  });

  // 3. Track which entities are already scheduled or already annotated
  const scheduledEntityIds = new Set<string>();
  for (const [id, nav] of entityNavItems) {
    if (nav.hasHistorianNotes) scheduledEntityIds.add(id);
  }

  // 4. Interleave: each chronicle followed by its referenced entities
  for (const chron of eligible) {
    const chronicleTone = chron.assignedTone || "weary";

    workItems.push({
      type: "chronicle",
      chronicleId: chron.chronicleId,
      title: chron.title || chron.name || "Untitled",
      tone: chronicleTone,
    });

    // Get referenced entities from roleAssignments, primaries first
    const roles = chron.roleAssignments || [];
    const primaries = roles.filter((r) => r.isPrimary);
    const supporting = roles.filter((r) => !r.isPrimary);
    const orderedRoles = [...primaries, ...supporting];

    for (const role of orderedRoles) {
      if (scheduledEntityIds.has(role.entityId)) continue;

      const nav = entityNavItems.get(role.entityId);
      if (!nav || !nav.hasDescription) continue;

      scheduledEntityIds.add(role.entityId);
      workItems.push({
        type: "entity",
        entityId: role.entityId,
        entityName: nav.name,
        entityKind: nav.kind,
        tone: chronicleTone,
      });
    }
  }

  // 5. Append orphan entities (have descriptions but not referenced by any chronicle)
  let orphanIndex = 0;
  for (const [id, nav] of entityNavItems) {
    if (scheduledEntityIds.has(id)) continue;
    if (!nav.hasDescription) continue;

    workItems.push({
      type: "entity",
      entityId: id,
      entityName: nav.name,
      entityKind: nav.kind,
      tone: ORPHAN_TONE_CYCLE[orphanIndex % ORPHAN_TONE_CYCLE.length],
    });
    orphanIndex++;
    scheduledEntityIds.add(id);
  }

  return workItems;
}

// ============================================================================
// Store
// ============================================================================

interface InterleavedAnnotationStore {
  progress: InterleavedAnnotationProgress;
  prepareInterleaved: (
    chronicleItems: ChronicleNavItem[],
    entityNavItems: Map<string, EntityNavItem>
  ) => void;
  confirmInterleaved: () => void;
  cancelInterleaved: () => void;
  closeInterleaved: () => void;
}

type InterleavedSetFn = (fn: (s: InterleavedAnnotationStore) => Partial<InterleavedAnnotationStore>) => void;

interface InterleavedCaches {
  corpusStrength: { runId: string | null; strength: Map<string, number> | null };
  voiceDigest: CorpusVoiceDigestCache;
  reinforcement: ReinforcementCache;
}

async function createAndRunReview(config: HistorianReviewConfig): Promise<{ notes: any[]; prompts?: any; cost: number } | null> {
  const runId = generateHistorianRunId();
  const now = Date.now();
  await createHistorianRun({
    runId, projectId: config.projectId, simulationRunId: config.simulationRunId,
    status: "pending", tone: config.tone, targetType: config.targetType,
    targetId: config.targetId, targetName: config.targetName, sourceText: config.sourceText,
    notes: [], noteDecisions: {}, contextJson: config.contextJson,
    previousNotesJson: config.previousNotesJson,
    historianConfigJson: JSON.stringify(config.historianConfig),
    inputTokens: 0, outputTokens: 0, actualCost: 0, createdAt: now, updatedAt: now,
  });
  dispatchReviewTask(runId);
  return pollReviewCompletion(runId, isCancelled);
}

async function processChronicleItem(
  item: InterleavedWorkItem & { type: "chronicle" },
  caches: InterleavedCaches,
  maxNotesOverride: number | undefined
): Promise<number> {
  const config = await buildChronicleReviewContext(item.chronicleId, item.tone, caches.corpusStrength, caches.voiceDigest, caches.reinforcement, maxNotesOverride);
  if (!config) return 0;

  const result = await createAndRunReview(config);
  if (cancelledFlag || !result) return -1; // signal break

  if (result.notes.length > 0) {
    const reinforcedFacts = extractReinforcedFactIds(config.contextJson);
    await updateChronicleHistorianNotes(item.chronicleId, result.notes, result.prompts, reinforcedFacts);
    caches.reinforcement.runId = null;
    caches.reinforcement.data = null;
  }
  caches.voiceDigest.runId = null;
  caches.voiceDigest.digest = null;
  return result.cost;
}

async function processEntityItem(
  item: InterleavedWorkItem & { type: "entity" },
  caches: InterleavedCaches,
  maxNotesOverride: number | undefined
): Promise<number> {
  const config = await buildHistorianReviewContext(item.entityId, item.tone, caches.voiceDigest, maxNotesOverride);
  if (!config) return 0;

  const result = await createAndRunReview(config);
  if (cancelledFlag || !result) return -1;

  if (result.notes.length > 0) await setHistorianNotes(item.entityId, result.notes);
  await reloadEntities([item.entityId]);
  caches.voiceDigest.runId = null;
  caches.voiceDigest.digest = null;
  return result.cost;
}

async function runInterleavedAnnotation(
  workItems: InterleavedWorkItem[],
  set: InterleavedSetFn
): Promise<void> {
  try {
    let globalProcessed = 0, globalCost = 0, processedChronicles = 0, processedEntities = 0;
    const failedItems: Array<{ item: InterleavedWorkItem; error: string }> = [];
    const caches: InterleavedCaches = {
      corpusStrength: { runId: null, strength: null },
      voiceDigest: { runId: null, digest: null },
      reinforcement: { runId: null, data: null },
    };

    for (let itemIndex = 0; itemIndex < workItems.length; itemIndex++) {
      const item = workItems[itemIndex];
      if (cancelledFlag) break;
      set((s) => ({ progress: { ...s.progress, currentItem: item } }));

      try {
        const maxNotes = computeNotesMaxOverride(itemIndex);
        let cost: number;
        if (item.type === "chronicle") {
          cost = await processChronicleItem(item as InterleavedWorkItem & { type: "chronicle" }, caches, maxNotes);
          if (cost < 0) break;
          processedChronicles++;
        } else {
          cost = await processEntityItem(item as InterleavedWorkItem & { type: "entity" }, caches, maxNotes);
          if (cost < 0) break;
          processedEntities++;
        }
        globalCost += cost;
        globalProcessed++;
        set((s) => ({ progress: { ...s.progress, processedItems: globalProcessed, processedChronicles, processedEntities, totalCost: globalCost, failedItems: [...failedItems] } }));
      } catch (err) {
        const label = item.type === "chronicle" ? `Chronicle "${(item as any).title}"` : `Entity "${(item as any).entityName}"`;
        console.error(`[Interleaved Annotation] ${label} failed:`, err);
        globalProcessed++;
        if (item.type === "chronicle") processedChronicles++; else processedEntities++;
        failedItems.push({ item, error: err instanceof Error ? err.message : String(err) });
        set((s) => ({ progress: { ...s.progress, processedItems: globalProcessed, processedChronicles, processedEntities, totalCost: globalCost, failedItems: [...failedItems] } }));
      }
    }

    await useChronicleStore.getState().refreshAll();
    await reloadEntities();
    const finalStatus = cancelledFlag ? "cancelled" : "complete";
    set((s) => ({ progress: { ...s.progress, status: finalStatus, currentItem: undefined } }));
  } catch (err) {
    console.error("[Interleaved Annotation] Fatal error:", err);
    set((s) => ({ progress: { ...s.progress, status: "failed", currentItem: undefined, error: err instanceof Error ? err.message : String(err) } }));
  }
}

export const useInterleavedAnnotationStore = create<InterleavedAnnotationStore>((set) => ({
  progress: IDLE_PROGRESS,

  prepareInterleaved(chronicleItems, entityNavItems) {
    if (activeFlag) return;

    const workItems = buildInterleavedWorkList(chronicleItems, entityNavItems);
    if (workItems.length === 0) return;

    scanData = workItems;

    const chronicleCount = workItems.filter((w) => w.type === "chronicle").length;
    const entityCount = workItems.filter((w) => w.type === "entity").length;

    set({
      progress: {
        status: "confirming",
        workItems,
        totalItems: workItems.length,
        processedItems: 0,
        totalCost: 0,
        failedItems: [],
        chronicleCount,
        entityCount,
        processedChronicles: 0,
        processedEntities: 0,
      },
    });
  },

  confirmInterleaved() {
    if (!scanData || activeFlag) return;

    activeFlag = true;
    cancelledFlag = false;
    const workItems = scanData;

    set((s) => ({ progress: { ...s.progress, status: "running" } }));

    void runInterleavedAnnotation(workItems, set)
      .finally(() => { activeFlag = false; scanData = null; });
  },

  cancelInterleaved() {
    cancelledFlag = true;
    scanData = null;
    set((s) => {
      if (s.progress.status === "confirming") return { progress: IDLE_PROGRESS };
      return s;
    });
  },

  closeInterleaved() {
    if (!activeFlag) {
      scanData = null;
      set({ progress: IDLE_PROGRESS });
    }
  },
}));
