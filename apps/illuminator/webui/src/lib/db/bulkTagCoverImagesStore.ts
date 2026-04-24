/**
 * bulkTagCoverImagesStore — Zustand store for sequential bulk cover image tagging.
 *
 * Same pattern as bulkTagImageRefsStore: prepare → confirm → sequential
 * async loop with progress tracking. Operates on cover image scene descriptions
 * instead of image ref scene descriptions.
 */

import { create } from "zustand";
import type { ChronicleNavItem } from "./chronicleNav";
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

interface CoverScene {
  chronicleId: string;
  sceneDescription: string;
}

export interface BulkTagCoverBatchSummary {
  batchIndex: number;
  chronicleIds: string[];
  sceneCount: number;
}

export interface BulkTagCoverProgress {
  status: "idle" | "confirming" | "running" | "complete" | "cancelled" | "failed";
  batches: BulkTagCoverBatchSummary[];
  totalBatches: number;
  processedBatches: number;
  totalScenes: number;
  taggedScenes: number;
  currentBatchIndex: number;
  totalCost: number;
  error?: string;
  failedBatches: Array<{ batchIndex: number; error: string }>;
}

const IDLE_PROGRESS: BulkTagCoverProgress = {
  status: "idle",
  batches: [],
  totalBatches: 0,
  processedBatches: 0,
  totalScenes: 0,
  taggedScenes: 0,
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
  batches: BulkTagCoverBatchSummary[];
  chronicleIdBatches: string[][];
  artisticStyles: StyleEntry[];
  compositionStyles: CompositionEntry[];
  colorPalettes: PaletteEntry[];
  simulationRunId: string;
  projectId: string;
} | null = null;

// ============================================================================
// Prompt builder
// ============================================================================

function buildBatchTagPrompt(
  scenes: CoverScene[],
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

  const sceneList = scenes
    .map((s) => `[${s.chronicleId}] ${s.sceneDescription}`)
    .join("\n");

  const artisticCount = artisticStyles.length;
  const compositionCount = compositionStyles.length;
  const paletteCount = colorPalettes.length;

  return `You are a visual art director assigning rendering styles to ${scenes.length} chronicle COVER IMAGES in an illustrated history book.

Cover images are cinematic montage compositions — they depict the overall theme or key moment of each chronicle. Your style assignments should emphasize dramatic, poster-quality aesthetics.

For EACH cover scene, assign:

1. **tags**: 2-4 visual/atmospheric tags (lowercase, hyphenated) describing MOOD, LIGHTING, or VISUAL CHARACTER. Examples: intimate, dramatic-lighting, wide-vista, action, somber, crowded, isolated, mystical, violent, ceremonial, tender, ominous, serene, chaotic, regal, decrepit, lush, barren, nocturnal, golden-hour, ethereal, gritty, monumental, claustrophobic, pastoral, fiery, frozen, mournful, triumphant

2. **artisticStyleIds**: Top 3 ranked artistic style IDs, best fit first. You MUST pick from at least 2 different categories (shown as ### headers below).

3. **compositionStyleIds**: Top 3 ranked composition style IDs, best fit first. You MUST pick from at least 2 different categories (shown as ### headers below).

4. **colorPaletteIds**: Top 3 ranked color palette IDs, best fit first. You MUST pick from at least 2 different groups (shown as ### headers below).

## COVERAGE RULES — CRITICAL
There are ${artisticCount} artistic styles, ${compositionCount} composition styles, and ${paletteCount} color palettes available.
- **Every style/composition/palette in the library MUST appear in at least one scene's top 3 across this batch.** No exceptions.
- Do NOT default to the same safe picks for every scene.
- Your 3 picks should span a range — don't pick 3 variations of the same aesthetic.

## SPREAD RULES
Look at ALL ${scenes.length} scenes together before assigning:
- No single style should appear as #1 pick for more than ~20% of scenes
- Cover images are inherently dramatic — lean into bold, cinematic styles

## Artistic Styles (grouped by category)
${styleList}

## Composition Styles (grouped by category)
${compList}

## Color Palettes (grouped by group)
${paletteList}

## Cover Scenes
${sceneList}

Respond with ONLY a JSON array, no markdown fences:
[{"chronicleId":"...","tags":["..."],"artisticStyleIds":["id1","id2","id3"],"compositionStyleIds":["id1","id2","id3"],"colorPaletteIds":["id1","id2","id3"]},...]`;
}

// ============================================================================
// Response parser
// ============================================================================

interface TagResult {
  chronicleId: string;
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
      typeof item.chronicleId === "string" &&
      Array.isArray(item.tags) &&
      Array.isArray(item.artisticStyleIds) &&
      Array.isArray(item.compositionStyleIds) &&
      Array.isArray(item.colorPaletteIds),
  );
}

// ============================================================================
// Sequential batch runner
// ============================================================================

type SetFn = (fn: (s: BulkTagCoverImagesStore) => Partial<BulkTagCoverImagesStore>) => void;

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
  // Load cover scenes from this batch
  const coverScenes: CoverScene[] = [];
  for (const cid of chronicleIds) {
    const record = await getChronicle(cid);
    if (!record?.coverImage?.sceneDescription) continue;
    coverScenes.push({ chronicleId: cid, sceneDescription: record.coverImage.sceneDescription });
  }

  if (coverScenes.length === 0) return;

  const prompt = buildBatchTagPrompt(coverScenes, artisticStyles, compositionStyles, colorPalettes);
  const callConfig = getCallConfig("chronicle.batchTagCoverImages");

  const call = await runTextCall({
    llmClient,
    callType: "chronicle.batchTagCoverImages",
    callConfig,
    systemPrompt:
      "You are a visual art director for an illustrated history book. " +
      "Think carefully about visual variety before assigning styles to cover images. " +
      "Respond only with the requested JSON.",
    prompt,
    temperature: 0.5,
  });

  if (call.result.error || !call.result.text) {
    throw new Error(call.result.error || "No response from LLM");
  }

  const results = parseTagResponse(call.result.text);

  // Apply tags to cover images
  const tagMap = new Map(results.map((r) => [r.chronicleId, r]));
  let batchTagged = 0;

  for (const scene of coverScenes) {
    const tags = tagMap.get(scene.chronicleId);
    if (!tags) continue;

    const record = await getChronicle(scene.chronicleId);
    if (!record?.coverImage) continue;

    record.coverImage.visualTags = tags.tags;
    record.coverImage.suggestedArtisticStyleId = tags.artisticStyleIds[0] || "";
    record.coverImage.suggestedCompositionStyleId = tags.compositionStyleIds[0] || "";
    record.coverImage.suggestedColorPaletteId = tags.colorPaletteIds[0] || "";
    record.coverImage.rankedArtisticStyleIds = tags.artisticStyleIds;
    record.coverImage.rankedCompositionStyleIds = tags.compositionStyleIds;
    record.coverImage.rankedColorPaletteIds = tags.colorPaletteIds;
    record.updatedAt = Date.now();
    await db.chronicles.put(record);
    batchTagged++;
  }

  state.tagged += batchTagged;
  state.cost += call.usage.actualCost;

  // Save cost record
  await saveCostRecordWithDefaults({
    projectId,
    simulationRunId,
    entityId: "bulk-tag-cover-images",
    entityName: "Bulk Tag Cover Images",
    entityKind: "chronicle",
    type: "chronicleTagCoverImages",
    model: callConfig.model,
    estimatedCost: call.estimate.estimatedCost,
    actualCost: call.usage.actualCost,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
  });

  set((s) => ({
    progress: {
      ...s.progress,
      taggedScenes: state.tagged,
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
        console.error(`[Bulk Tag Cover] Batch ${i + 1} failed:`, err);
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
    console.error("[Bulk Tag Cover] Fatal error:", err);
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

interface BulkTagCoverImagesStore {
  progress: BulkTagCoverProgress;
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

export const useBulkTagCoverImagesStore = create<BulkTagCoverImagesStore>((set) => ({
  progress: IDLE_PROGRESS,

  prepareTag(chronicleItems, styleLibrary, simulationRunId, projectId) {
    if (activeFlag) return;

    const eligible = chronicleItems.filter(
      (c) => c.status === "complete" || c.status === "assembly_ready",
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

    const batches: BulkTagCoverBatchSummary[] = chronicleIdBatches.map((ids, idx) => ({
      batchIndex: idx,
      chronicleIds: ids,
      sceneCount: ids.length,
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
        totalScenes: eligible.length,
        taggedScenes: 0,
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
