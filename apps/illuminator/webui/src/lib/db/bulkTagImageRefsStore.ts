/**
 * bulkTagImageRefsStore — Zustand store for sequential bulk image ref tagging.
 *
 * Runs LLM tagging batches sequentially in the main browser thread (no worker).
 * Same pattern as bulkChronicleAnnotationStore: prepare → confirm → sequential
 * async loop with progress tracking. Cancellation via module-level flags.
 */

import { create } from "zustand";
import type { ChronicleNavItem } from "./chronicleNav";
import type { PromptRequestRef } from "../chronicleTypes";
import type { StyleLibrary } from "@canonry/world-schema";
import { getChronicle } from "./chronicleRepository";
import { saveCostRecordWithDefaults } from "./costRepository";
import { db } from "./illuminatorDb";
import { useChronicleStore } from "./chronicleStore";
import { LLMClient } from "../llmClient";
import { runTextCall } from "../llmTextCall";
import { getCallConfig } from "../llmModelSettings";

// ============================================================================
// Types
// ============================================================================

interface StyleEntry {
  id: string;
  name: string;
  category: string;
}

interface CompositionEntry {
  id: string;
  name: string;
  targetCategory: string;
}

interface PaletteEntry {
  id: string;
  name: string;
  description: string;
  group: string;
}

export interface BulkTagBatchSummary {
  batchIndex: number;
  chronicleIds: string[];
  refCount: number;
}

export interface BulkTagProgress {
  status: "idle" | "confirming" | "running" | "complete" | "cancelled" | "failed";
  batches: BulkTagBatchSummary[];
  totalBatches: number;
  processedBatches: number;
  totalRefs: number;
  taggedRefs: number;
  currentBatchIndex: number;
  totalCost: number;
  error?: string;
  failedBatches: Array<{ batchIndex: number; error: string }>;
}

const IDLE_PROGRESS: BulkTagProgress = {
  status: "idle",
  batches: [],
  totalBatches: 0,
  processedBatches: 0,
  totalRefs: 0,
  taggedRefs: 0,
  currentBatchIndex: -1,
  totalCost: 0,
  failedBatches: [],
};

// ============================================================================
// Module-level flags (survive component unmounts)
// ============================================================================

let activeFlag = false;
let cancelledFlag = false;
let scanData: {
  batches: BulkTagBatchSummary[];
  chronicleIdBatches: string[][];
  artisticStyles: StyleEntry[];
  compositionStyles: CompositionEntry[];
  colorPalettes: PaletteEntry[];
  simulationRunId: string;
  projectId: string;
} | null = null;

// ============================================================================
// Prompt builder (extracted from chronicleTagImageRefsTask)
// ============================================================================

function buildBatchTagPrompt(
  refs: Array<{ chronicleId: string; ref: PromptRequestRef }>,
  artisticStyles: StyleEntry[],
  compositionStyles: CompositionEntry[],
  colorPalettes: PaletteEntry[],
): string {
  const stylesByCategory = new Map<string, StyleEntry[]>();
  for (const s of artisticStyles) {
    const list = stylesByCategory.get(s.category) || [];
    list.push(s);
    stylesByCategory.set(s.category, list);
  }
  const styleList = [...stylesByCategory.entries()]
    .map(([cat, styles]) =>
      `### ${cat}\n${styles.map((s) => `  ${s.id} | ${s.name}`).join("\n")}`,
    )
    .join("\n");

  const compsByCategory = new Map<string, CompositionEntry[]>();
  for (const s of compositionStyles) {
    const cat = s.targetCategory || "universal";
    const list = compsByCategory.get(cat) || [];
    list.push(s);
    compsByCategory.set(cat, list);
  }
  const compList = [...compsByCategory.entries()]
    .map(([cat, styles]) =>
      `### ${cat}\n${styles.map((s) => `  ${s.id} | ${s.name}`).join("\n")}`,
    )
    .join("\n");

  const palettesByGroup = new Map<string, PaletteEntry[]>();
  for (const p of colorPalettes) {
    const list = palettesByGroup.get(p.group) || [];
    list.push(p);
    palettesByGroup.set(p.group, list);
  }
  const paletteList = [...palettesByGroup.entries()]
    .map(([group, palettes]) =>
      `### ${group}\n${palettes.map((p) => `  ${p.id} | ${p.name} | ${p.description}`).join("\n")}`,
    )
    .join("\n");

  const scenes = refs
    .map((r) => `[${r.ref.refId}] (${r.ref.size}) ${r.ref.sceneDescription}`)
    .join("\n");

  const artisticCount = artisticStyles.length;
  const compositionCount = compositionStyles.length;
  const paletteCount = colorPalettes.length;

  return `You are a visual art director assigning rendering styles to ${refs.length} scene illustrations across a set of chronicles in an illustrated history book.

Your goal is to produce visually DIVERSE illustrations. The reader will see these images together — if every scene uses the same style, it looks monotonous.

For EACH scene, assign:

1. **tags**: 2-4 visual/atmospheric tags (lowercase, hyphenated) describing MOOD, LIGHTING, or VISUAL CHARACTER. Examples: intimate, dramatic-lighting, wide-vista, action, somber, crowded, isolated, mystical, violent, ceremonial, tender, ominous, serene, chaotic, regal, decrepit, lush, barren, nocturnal, golden-hour, ethereal, gritty, monumental, claustrophobic, pastoral, fiery, frozen, mournful, triumphant

2. **artisticStyleIds**: Top 3 ranked artistic style IDs, best fit first. You MUST pick from at least 2 different categories (shown as ### headers below).

3. **compositionStyleIds**: Top 3 ranked composition style IDs, best fit first. You MUST pick from at least 2 different categories (shown as ### headers below).

4. **colorPaletteIds**: Top 3 ranked color palette IDs, best fit first. You MUST pick from at least 2 different groups (shown as ### headers below).

## COVERAGE RULES — CRITICAL
There are ${artisticCount} artistic styles, ${compositionCount} composition styles, and ${paletteCount} color palettes available. A downstream algorithm will pick from your ranked lists, so every style that appears ANYWHERE in your top-3 lists becomes a candidate.
- **Every style/composition/palette in the library MUST appear in at least one scene's top 3 across this batch.** No exceptions. Before finalizing, verify each ID appears at least once.
- Actively look for scenes that match niche styles. Map views suit geographic/territorial scenes. Treasure hoards suit discovery/artifact scenes. Bold high-contrast palettes suit action/confrontation scenes. Pixel art and low-poly suit whimsical or abstracted scenes. Tilt-shift suits urban overviews. Experimental styles suit surreal or dreamlike moments. Logo/badge compositions suit emblems, seals, or insignia scenes.
- Do NOT default to the same safe picks for every scene. If you notice you keep reaching for the same favorites, stop and deliberately choose differently.
- Your 3 picks should span a range — don't pick 3 variations of the same aesthetic.

## SPREAD RULES
Look at ALL ${refs.length} scenes together before assigning:
- No single style should appear as #1 pick for more than ~20% of scenes
- Match scene content to category: character close-ups need portrait/bust compositions, landscapes need landscape compositions, groups need collective compositions, etc.

## Artistic Styles (grouped by category)
${styleList}

## Composition Styles (grouped by category)
${compList}

## Color Palettes (grouped by group)
${paletteList}

## Scenes
${scenes}

Respond with ONLY a JSON array, no markdown fences:
[{"refId":"...","tags":["..."],"artisticStyleIds":["id1","id2","id3"],"compositionStyleIds":["id1","id2","id3"],"colorPaletteIds":["id1","id2","id3"]},...]`;
}

// ============================================================================
// Response parser
// ============================================================================

interface TagResult {
  refId: string;
  tags: string[];
  artisticStyleIds: string[];
  compositionStyleIds: string[];
  colorPaletteIds: string[];
}

function parseTagResponse(text: string): TagResult[] {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  }

  const parsed = JSON.parse(cleaned) as unknown;
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(
    (item): item is TagResult =>
      typeof item === "object" &&
      item !== null &&
      typeof item.refId === "string" &&
      Array.isArray(item.tags) &&
      Array.isArray(item.artisticStyleIds) &&
      Array.isArray(item.compositionStyleIds) &&
      Array.isArray(item.colorPaletteIds),
  );
}

// ============================================================================
// Sequential batch runner
// ============================================================================

type SetFn = (fn: (s: BulkTagImageRefsStore) => Partial<BulkTagImageRefsStore>) => void;

function createLLMClient(): LLMClient {
  const apiKey = localStorage.getItem("illuminator:anthropicApiKey") || "";
  return new LLMClient({
    enabled: Boolean(apiKey),
    apiKey,
    model: "claude-sonnet-4-6",
  });
}

async function runBatch(
  batchIndex: number,
  chronicleIds: string[],
  artisticStyles: StyleEntry[],
  compositionStyles: CompositionEntry[],
  colorPalettes: PaletteEntry[],
  simulationRunId: string,
  projectId: string,
  llmClient: LLMClient,
  set: SetFn,
  state: { tagged: number; cost: number; failed: Array<{ batchIndex: number; error: string }> },
): Promise<void> {
  // Load all refs from this batch
  const allRefs: Array<{ chronicleId: string; ref: PromptRequestRef }> = [];
  for (const cid of chronicleIds) {
    const record = await getChronicle(cid);
    if (!record?.imageRefs?.refs) continue;
    for (const ref of record.imageRefs.refs) {
      if (ref.type === "prompt_request") {
        allRefs.push({ chronicleId: cid, ref });
      }
    }
  }

  if (allRefs.length === 0) return;

  const prompt = buildBatchTagPrompt(allRefs, artisticStyles, compositionStyles, colorPalettes);
  const callConfig = getCallConfig("chronicle.batchTagImageRefs");

  const call = await runTextCall({
    llmClient,
    callType: "chronicle.batchTagImageRefs",
    callConfig,
    systemPrompt:
      "You are a visual art director for an illustrated history book. " +
      "Think carefully about visual variety before assigning styles. " +
      "Respond only with the requested JSON.",
    prompt,
    temperature: 0.5,
  });

  if (call.result.error || !call.result.text) {
    throw new Error(call.result.error || "No response from LLM");
  }

  const results = parseTagResponse(call.result.text);

  // Apply tags
  const tagMap = new Map(results.map((r) => [r.refId, r]));
  const affectedChronicleIds = new Set(allRefs.map((r) => r.chronicleId));
  let batchTagged = 0;

  for (const cid of affectedChronicleIds) {
    const freshRecord = await getChronicle(cid);
    if (!freshRecord?.imageRefs) continue;

    let changed = false;
    for (const ref of freshRecord.imageRefs.refs) {
      if (ref.type !== "prompt_request") continue;
      const tags = tagMap.get(ref.refId);
      if (!tags) continue;
      ref.visualTags = tags.tags;
      ref.suggestedArtisticStyleId = tags.artisticStyleIds[0] || "";
      ref.suggestedCompositionStyleId = tags.compositionStyleIds[0] || "";
      ref.suggestedColorPaletteId = tags.colorPaletteIds[0] || "";
      ref.rankedArtisticStyleIds = tags.artisticStyleIds;
      ref.rankedCompositionStyleIds = tags.compositionStyleIds;
      ref.rankedColorPaletteIds = tags.colorPaletteIds;
      batchTagged++;
      changed = true;
    }

    if (changed) {
      freshRecord.updatedAt = Date.now();
      await db.chronicles.put(freshRecord);
    }
  }

  state.tagged += batchTagged;
  state.cost += call.usage.actualCost;

  // Save cost record
  await saveCostRecordWithDefaults({
    projectId,
    simulationRunId,
    entityId: "bulk-tag-image-refs",
    entityName: "Bulk Tag Image Refs",
    entityKind: "chronicle",
    type: "chronicleTagImageRefs",
    model: callConfig.model,
    estimatedCost: call.estimate.estimatedCost,
    actualCost: call.usage.actualCost,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
  });

  set((s) => ({
    progress: {
      ...s.progress,
      taggedRefs: state.tagged,
      totalCost: state.cost,
    },
  }));
}

async function runAllBatches(
  chronicleIdBatches: string[][],
  artisticStyles: StyleEntry[],
  compositionStyles: CompositionEntry[],
  colorPalettes: PaletteEntry[],
  simulationRunId: string,
  projectId: string,
  set: SetFn,
): Promise<void> {
  const llmClient = createLLMClient();
  const state = {
    tagged: 0,
    cost: 0,
    failed: [] as Array<{ batchIndex: number; error: string }>,
  };

  try {
    for (let i = 0; i < chronicleIdBatches.length; i++) {
      if (cancelledFlag) break;

      set((s) => ({
        progress: {
          ...s.progress,
          currentBatchIndex: i,
          processedBatches: i,
        },
      }));

      try {
        await runBatch(
          i, chronicleIdBatches[i],
          artisticStyles, compositionStyles, colorPalettes,
          simulationRunId, projectId, llmClient, set, state,
        );
      } catch (err) {
        console.error(`[Bulk Tag] Batch ${i + 1} failed:`, err);
        state.failed.push({
          batchIndex: i,
          error: err instanceof Error ? err.message : String(err),
        });
        set((s) => ({
          progress: {
            ...s.progress,
            failedBatches: [...state.failed],
          },
        }));
      }
    }

    await useChronicleStore.getState().refreshAll();
    const finalStatus = cancelledFlag ? "cancelled" : "complete";
    set((s) => ({
      progress: {
        ...s.progress,
        status: finalStatus,
        currentBatchIndex: -1,
        processedBatches: chronicleIdBatches.length,
      },
    }));
  } catch (err) {
    console.error("[Bulk Tag] Fatal error:", err);
    set((s) => ({
      progress: {
        ...s.progress,
        status: "failed",
        currentBatchIndex: -1,
        error: err instanceof Error ? err.message : String(err),
      },
    }));
  }
}

// ============================================================================
// Store
// ============================================================================

interface BulkTagImageRefsStore {
  progress: BulkTagProgress;
  prepareTag: (
    chronicleItems: ChronicleNavItem[],
    styleLibrary: StyleLibrary,
    simulationRunId: string,
    projectId: string,
  ) => void;
  confirmTag: () => void;
  cancelTag: () => void;
  closeTag: () => void;
}

const BATCH_SIZE = 30;

export const useBulkTagImageRefsStore = create<BulkTagImageRefsStore>((set) => ({
  progress: IDLE_PROGRESS,

  prepareTag(chronicleItems, styleLibrary, simulationRunId, projectId) {
    if (activeFlag) return;

    const eligible = chronicleItems.filter(
      (c) =>
        (c.imageRefTotalCount ?? 0) > 0 &&
        (c.status === "complete" || c.status === "assembly_ready"),
    );
    if (eligible.length === 0) return;

    // Build style catalogs
    const artisticStyles: StyleEntry[] = styleLibrary.artisticStyles.map((s) => ({
      id: s.id, name: s.name, category: s.category,
    }));
    const compositionStyles: CompositionEntry[] = styleLibrary.compositionStyles
      .filter((s) => !s.id.startsWith("chronicle-"))
      .map((s) => ({
        id: s.id, name: s.name, targetCategory: s.targetCategory,
      }));
    const colorPalettes: PaletteEntry[] = styleLibrary.colorPalettes.map((p) => ({
      id: p.id, name: p.name, description: p.description,
      group: (p as Record<string, unknown>).group as string || "other",
    }));

    // Build batches
    const chronicleIdBatches: string[][] = [];
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      chronicleIdBatches.push(eligible.slice(i, i + BATCH_SIZE).map((c) => c.chronicleId));
    }

    // Count total refs (approximate from nav items)
    const totalRefs = eligible.reduce((sum, c) => sum + (c.imageRefTotalCount ?? 0), 0);

    const batches: BulkTagBatchSummary[] = chronicleIdBatches.map((ids, idx) => ({
      batchIndex: idx,
      chronicleIds: ids,
      refCount: eligible
        .filter((c) => ids.includes(c.chronicleId))
        .reduce((sum, c) => sum + (c.imageRefTotalCount ?? 0), 0),
    }));

    scanData = {
      batches,
      chronicleIdBatches,
      artisticStyles,
      compositionStyles,
      colorPalettes,
      simulationRunId,
      projectId,
    };

    set({
      progress: {
        status: "confirming",
        batches,
        totalBatches: batches.length,
        processedBatches: 0,
        totalRefs,
        taggedRefs: 0,
        currentBatchIndex: -1,
        totalCost: 0,
        failedBatches: [],
      },
    });
  },

  confirmTag() {
    if (!scanData || activeFlag) return;

    activeFlag = true;
    cancelledFlag = false;
    const { chronicleIdBatches, artisticStyles, compositionStyles, colorPalettes, simulationRunId, projectId } = scanData;

    set((s) => ({ progress: { ...s.progress, status: "running" } }));

    void runAllBatches(chronicleIdBatches, artisticStyles, compositionStyles, colorPalettes, simulationRunId, projectId, set)
      .finally(() => { activeFlag = false; scanData = null; });
  },

  cancelTag() {
    cancelledFlag = true;
    scanData = null;
    set((s) => {
      if (s.progress.status === "confirming") return { progress: IDLE_PROGRESS };
      return s;
    });
  },

  closeTag() {
    if (!activeFlag) {
      scanData = null;
      set({ progress: IDLE_PROGRESS });
    }
  },
}));
