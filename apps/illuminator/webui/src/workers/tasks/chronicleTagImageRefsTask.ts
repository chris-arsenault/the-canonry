/**
 * Chronicle Image Refs Tagging Task (Batch)
 *
 * Tags prompt_request image refs across multiple chronicles with:
 * - Top 5 ranked artistic styles (from 3+ different categories)
 * - Top 5 ranked composition styles (from 3+ different categories)
 * - Top 5 ranked color palettes (from 3+ different groups)
 * - 2-4 visual/atmospheric tags
 *
 * Uses Sonnet with thinking budget for better distribution.
 * Processes all refs in a batch of chronicles in one LLM call.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type { PromptRequestRef } from "../../lib/chronicleTypes";
import { getChronicle } from "../../lib/db/chronicleRepository";
import { saveCostRecordWithDefaults } from "../../lib/db/costRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { db } from "../../lib/db/illuminatorDb";

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

// ============================================================================
// Prompt builder
// ============================================================================

function buildBatchTagPrompt(
  refs: Array<{ chronicleId: string; ref: PromptRequestRef }>,
  artisticStyles: StyleEntry[],
  compositionStyles: CompositionEntry[],
  colorPalettes: PaletteEntry[],
): string {
  // Group styles by category for the prompt
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
// Step executor
// ============================================================================

export async function executeTagImageRefsStep(
  task: WorkerTask,
  context: TaskContext,
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  // Support both single chronicleId and batch chronicleIds
  const chronicleIds: string[] = (task as Record<string, unknown>).chronicleIds as string[] || [];
  if (task.chronicleId && !chronicleIds.includes(task.chronicleId)) {
    chronicleIds.push(task.chronicleId);
  }
  if (chronicleIds.length === 0) {
    return { success: false, error: "No chronicleId(s) on task" };
  }

  // Load all chronicles and collect prompt_request refs
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

  if (allRefs.length === 0) {
    return { success: true, result: { tagged: 0 } };
  }

  // Build style/composition/palette catalogs from the task payload
  const artisticStyles: StyleEntry[] = (task as Record<string, unknown>).artisticStyles as StyleEntry[] || [];
  const compositionStyles: CompositionEntry[] = (task as Record<string, unknown>).compositionStyles as CompositionEntry[] || [];
  const colorPalettes: PaletteEntry[] = (task as Record<string, unknown>).colorPalettes as PaletteEntry[] || [];

  if (artisticStyles.length === 0 || compositionStyles.length === 0) {
    return { success: false, error: "No styles/compositions provided on task" };
  }

  const prompt = buildBatchTagPrompt(allRefs, artisticStyles, compositionStyles, colorPalettes);
  const callConfig = getCallConfig(config, "chronicle.batchTagImageRefs");

  if (isAborted()) return { success: false, error: "Task aborted" };

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

  if (isAborted()) return { success: false, error: "Task aborted" };

  if (call.result.error || !call.result.text) {
    return { success: false, error: call.result.error || "No response from LLM" };
  }

  let results: TagResult[];
  try {
    results = parseTagResponse(call.result.text);
  } catch (err) {
    return { success: false, error: `Failed to parse response: ${err}` };
  }

  // Apply tags — group results by chronicle for batch DB writes
  const tagMap = new Map(results.map((r) => [r.refId, r]));
  const affectedChronicleIds = new Set(allRefs.map((r) => r.chronicleId));
  let tagged = 0;

  for (const cid of affectedChronicleIds) {
    const freshRecord = await getChronicle(cid);
    if (!freshRecord?.imageRefs) continue;

    let changed = false;
    for (const ref of freshRecord.imageRefs.refs) {
      if (ref.type !== "prompt_request") continue;
      const tags = tagMap.get(ref.refId);
      if (!tags) continue;
      ref.visualTags = tags.tags;
      // Store the top-ranked pick as the primary suggestion (backwards compat)
      ref.suggestedArtisticStyleId = tags.artisticStyleIds[0] || "";
      ref.suggestedCompositionStyleId = tags.compositionStyleIds[0] || "";
      ref.suggestedColorPaletteId = tags.colorPaletteIds[0] || "";
      // Store full ranked lists
      ref.rankedArtisticStyleIds = tags.artisticStyleIds;
      ref.rankedCompositionStyleIds = tags.compositionStyleIds;
      ref.rankedColorPaletteIds = tags.colorPaletteIds;
      tagged++;
      changed = true;
    }

    if (changed) {
      freshRecord.updatedAt = Date.now();
      await db.chronicles.put(freshRecord);
    }
  }

  // Save cost
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    type: "chronicleTagImageRefs",
    model: callConfig.model,
    estimatedCost: call.estimate.estimatedCost,
    actualCost: call.usage.actualCost,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
  });

  return { success: true, result: { tagged, chronicles: chronicleIds.length } };
}
