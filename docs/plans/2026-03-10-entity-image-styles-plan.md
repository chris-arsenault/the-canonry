# Entity Image Style Assignment & Curation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the chronicle image style pipeline (LLM tagging → deterministic assignment → bulk generation → curation) to entity images, emphasizing unused style coverage.

**Architecture:** Add `imageStyle` to `EntityEnrichment` for ranked/assigned style IDs. New LLM tagging worker task batch-tags entities. Reuse `assignImageStyles()` and `assignSecondaryStyles()` from `imageStyleAssignment.ts`. New bulk operations hook drives the pipeline. New curation tab with kind/culture grouping for image review and primary selection.

**Tech Stack:** React, TypeScript, Dexie (IndexedDB), Web Workers, existing LLM client infrastructure.

---

### Task 1: Add `imageStyle` to EntityEnrichment

**Files:**
- Modify: `apps/illuminator/webui/src/lib/enrichmentTypes.ts`

**Step 1: Add the imageStyle block to EntityEnrichment**

In `enrichmentTypes.ts`, add after the `image?` block (after the closing `};` of `image`):

```typescript
  /** Style assignment for image generation — LLM-ranked + deterministic distribution */
  imageStyle?: {
    rankedArtisticStyleIds: string[];
    rankedCompositionStyleIds: string[];
    rankedColorPaletteIds: string[];
    visualTags: string[];
    suggestedArtisticStyleId: string;
    suggestedCompositionStyleId: string;
    suggestedColorPaletteId: string;
    secondaryArtisticStyleId?: string;
    secondaryCompositionStyleId?: string;
    secondaryColorPaletteId?: string;
  };
```

**Step 2: Add `hasImageStyle` to EntityNavItem**

In `apps/illuminator/webui/src/lib/db/entityNav.ts`:

Add to `EntityNavItem` interface:
```typescript
  hasImageStyle: boolean;
```

Add to `buildEntityNavItem` return object:
```typescript
  hasImageStyle: !!entity.enrichment?.imageStyle?.suggestedArtisticStyleId,
```

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/lib/enrichmentTypes.ts apps/illuminator/webui/src/lib/db/entityNav.ts
git commit -m "feat: add imageStyle block to EntityEnrichment and nav item flag"
```

---

### Task 2: Add entity image style DB operations

**Files:**
- Modify: `apps/illuminator/webui/src/lib/db/entityRepository.ts`

**Step 1: Add `applyImageStyleResult` function**

Follow the pattern of `applyImageResult`. Add to `entityRepository.ts`:

```typescript
export async function applyImageStyleResult(
  entityId: string,
  imageStyle: EntityEnrichment["imageStyle"]
): Promise<void> {
  const entity = await db.entities.get(entityId);
  if (!entity) return;
  await db.entities.update(entityId, {
    enrichment: { ...entity.enrichment, imageStyle },
  });
}
```

**Step 2: Add `clearEntityImage` function**

```typescript
export async function clearEntityImage(entityId: string): Promise<void> {
  const entity = await db.entities.get(entityId);
  if (!entity) return;
  const enrichment = { ...entity.enrichment };
  delete enrichment.image;
  await db.entities.update(entityId, { enrichment });
}
```

**Step 3: Add `getImagesForEntity` to imageRepository**

In `apps/illuminator/webui/src/lib/db/imageRepository.ts`, add:

```typescript
export async function getImagesForEntity(
  entityId: string
): Promise<Array<Omit<ImageRecord, "blob">>> {
  const records = await db.images.where("entityId").equals(entityId).toArray();
  return records
    .map(({ blob: _blob, ...rest }) => rest)
    .sort((a, b) => (b.generatedAt || 0) - (a.generatedAt || 0));
}
```

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/lib/db/entityRepository.ts apps/illuminator/webui/src/lib/db/imageRepository.ts
git commit -m "feat: add entity image style and clear DB operations"
```

---

### Task 3: Create LLM entity image style tagging task

**Files:**
- Create: `apps/illuminator/webui/src/workers/tasks/entityTagImageStylesTask.ts`

**Step 1: Create the task file**

Model on `chronicleTagImageRefsTask.ts`. Key differences from chronicle version:
- Input is entities (visual thesis + traits + kind/subtype) instead of scene descriptions
- No composition kind-matching — encourage unexpected pairings
- Stronger coverage emphasis

```typescript
/**
 * Entity Image Style Tagging Task (Batch)
 *
 * Tags entities with:
 * - Top 3 ranked artistic styles (from 2+ categories)
 * - Top 3 ranked composition styles (from 2+ categories, NO kind matching)
 * - Top 3 ranked color palettes (from 2+ groups)
 * - 2-4 visual/atmospheric tags
 *
 * Coverage is the primary goal — every style must appear somewhere.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import { getEntitiesForRun } from "../../lib/db/entityRepository";
import { applyImageStyleResult } from "../../lib/db/entityRepository";
import { saveCostRecordWithDefaults } from "../../lib/db/costRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";

interface StyleEntry { id: string; name: string; category: string; }
interface CompositionEntry { id: string; name: string; targetCategory: string; }
interface PaletteEntry { id: string; name: string; description: string; group: string; }

interface EntityInput {
  entityId: string;
  kind: string;
  subtype: string;
  visualThesis: string;
  visualTraits: string[];
}

function buildBatchTagPrompt(
  entities: EntityInput[],
  artisticStyles: StyleEntry[],
  compositionStyles: CompositionEntry[],
  colorPalettes: PaletteEntry[],
): string {
  // Group styles by category
  const stylesByCategory = new Map<string, StyleEntry[]>();
  for (const s of artisticStyles) {
    const list = stylesByCategory.get(s.category) || [];
    list.push(s);
    stylesByCategory.set(s.category, list);
  }
  const styleList = [...stylesByCategory.entries()]
    .map(([cat, styles]) =>
      `### ${cat}\n${styles.map((s) => `  ${s.id} | ${s.name}`).join("\n")}`)
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
      `### ${cat}\n${styles.map((s) => `  ${s.id} | ${s.name}`).join("\n")}`)
    .join("\n");

  const palettesByGroup = new Map<string, PaletteEntry[]>();
  for (const p of colorPalettes) {
    const list = palettesByGroup.get(p.group) || [];
    list.push(p);
    palettesByGroup.set(p.group, list);
  }
  const paletteList = [...palettesByGroup.entries()]
    .map(([group, palettes]) =>
      `### ${group}\n${palettes.map((p) => `  ${p.id} | ${p.name} | ${p.description}`).join("\n")}`)
    .join("\n");

  const entityLines = entities
    .map((e) => {
      const traits = e.visualTraits.length > 0 ? ` | ${e.visualTraits.join(", ")}` : "";
      return `[${e.entityId}] (${e.kind}/${e.subtype}) ${e.visualThesis}${traits}`;
    })
    .join("\n");

  const artisticCount = artisticStyles.length;
  const compositionCount = compositionStyles.length;
  const paletteCount = colorPalettes.length;

  return `You are a visual art director assigning rendering styles to ${entities.length} entity illustrations for an illustrated encyclopedia of a fictional world.

Your goal is MAXIMUM VISUAL VARIETY. These images will be viewed together — monotony is the enemy.

For EACH entity, assign:

1. **tags**: 2-4 visual/atmospheric tags (lowercase, hyphenated) describing MOOD, LIGHTING, or VISUAL CHARACTER of the ideal image. Examples: intimate, dramatic-lighting, wide-vista, action, somber, crowded, isolated, mystical, violent, ceremonial, tender, ominous, serene, chaotic, regal, decrepit, lush, barren, nocturnal, golden-hour, ethereal, gritty, monumental, claustrophobic, pastoral, fiery, frozen, mournful, triumphant

2. **artisticStyleIds**: Top 3 ranked artistic style IDs, best fit first. Pick from at least 2 different categories.

3. **compositionStyleIds**: Top 3 ranked composition style IDs, best fit first. Pick from at least 2 different categories. DO NOT match composition to entity kind — a character in a sweeping landscape, a faction shown as a symbolic object study, a location as an intimate portrait detail are all encouraged. Surprising compositions create visual interest.

4. **colorPaletteIds**: Top 3 ranked color palette IDs, best fit first. Pick from at least 2 different groups.

## COVERAGE RULES — CRITICAL
There are ${artisticCount} artistic styles, ${compositionCount} composition styles, and ${paletteCount} color palettes available. A downstream algorithm will pick from your ranked lists, so every style that appears ANYWHERE in your top-3 lists becomes a candidate.
- **Every style/composition/palette in the library MUST appear in at least one entity's top 3 across this batch.** No exceptions. Before finalizing, verify each ID appears at least once.
- Actively look for entities that match niche styles. Factions suit map compositions. Artifacts suit object-study styles. Locations suit landscape or tilt-shift. Characters suit experimental styles like pixel-art or datamosh for variety. Search for an excuse to use every style.
- Do NOT default to the same safe picks for every entity. If you notice you keep reaching for the same favorites, stop and deliberately choose differently.
- Your 3 picks should span a range — don't pick 3 variations of the same aesthetic.

## SPREAD RULES
Look at ALL ${entities.length} entities together before assigning:
- No single style should appear as #1 pick for more than ~15% of entities
- Composition choices should be DELIBERATELY VARIED — resist the urge to give characters portrait compositions and places landscape compositions. The unexpected is the goal.

## Artistic Styles (grouped by category)
${styleList}

## Composition Styles (grouped by category)
${compList}

## Color Palettes (grouped by group)
${paletteList}

## Entities
${entityLines}

Respond with ONLY a JSON array, no markdown fences:
[{"entityId":"...","tags":["..."],"artisticStyleIds":["id1","id2","id3"],"compositionStyleIds":["id1","id2","id3"],"colorPaletteIds":["id1","id2","id3"]},...]`;
}

interface TagResult {
  entityId: string;
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
      typeof item.entityId === "string" &&
      Array.isArray(item.tags) &&
      Array.isArray(item.artisticStyleIds) &&
      Array.isArray(item.compositionStyleIds) &&
      Array.isArray(item.colorPaletteIds),
  );
}

export async function executeEntityTagImageStylesStep(
  task: WorkerTask,
  context: TaskContext,
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const entityIds: string[] = (task as Record<string, unknown>).entityIds as string[] || [];
  if (entityIds.length === 0) {
    return { success: false, error: "No entityIds on task" };
  }

  // Load entities and collect those with visual theses
  const allEntities = await getEntitiesForRun(task.simulationRunId);
  const entityMap = new Map(allEntities.map((e) => [e.id, e]));
  const inputs: EntityInput[] = [];
  for (const id of entityIds) {
    const entity = entityMap.get(id);
    if (!entity?.enrichment?.text?.visualThesis) continue;
    inputs.push({
      entityId: entity.id,
      kind: entity.kind,
      subtype: entity.subtype,
      visualThesis: entity.enrichment.text.visualThesis,
      visualTraits: entity.enrichment.text.visualTraits || [],
    });
  }

  if (inputs.length === 0) {
    return { success: true, result: { tagged: 0 } };
  }

  const artisticStyles: StyleEntry[] = (task as Record<string, unknown>).artisticStyles as StyleEntry[] || [];
  const compositionStyles: CompositionEntry[] = (task as Record<string, unknown>).compositionStyles as CompositionEntry[] || [];
  const colorPalettes: PaletteEntry[] = (task as Record<string, unknown>).colorPalettes as PaletteEntry[] || [];

  if (artisticStyles.length === 0 || compositionStyles.length === 0) {
    return { success: false, error: "No styles/compositions provided on task" };
  }

  const prompt = buildBatchTagPrompt(inputs, artisticStyles, compositionStyles, colorPalettes);
  const callConfig = getCallConfig(config, "entity.batchTagImageStyles");

  if (isAborted()) return { success: false, error: "Task aborted" };

  const call = await runTextCall({
    llmClient,
    callType: "entity.batchTagImageStyles",
    callConfig,
    systemPrompt:
      "You are a visual art director for an illustrated encyclopedia. " +
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

  // Write results to entity enrichment
  let tagged = 0;
  for (const result of results) {
    const entity = entityMap.get(result.entityId);
    if (!entity) continue;
    await applyImageStyleResult(result.entityId, {
      rankedArtisticStyleIds: result.artisticStyleIds,
      rankedCompositionStyleIds: result.compositionStyleIds,
      rankedColorPaletteIds: result.colorPaletteIds,
      visualTags: result.tags,
      suggestedArtisticStyleId: result.artisticStyleIds[0] || "",
      suggestedCompositionStyleId: result.compositionStyleIds[0] || "",
      suggestedColorPaletteId: result.colorPaletteIds[0] || "",
    });
    tagged++;
  }

  // Save cost
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    type: "entityTagImageStyles",
    model: callConfig.model,
    estimatedCost: call.estimate.estimatedCost,
    actualCost: call.usage.actualCost,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
  });

  return { success: true, result: { tagged, entities: entityIds.length } };
}
```

**Step 2: Register in llmCallConfig**

In `apps/illuminator/webui/src/workers/tasks/llmCallConfig.ts`, find where call types are registered and add `"entity.batchTagImageStyles"` following the pattern of `"chronicle.batchTagImageRefs"`. Use the same model/thinking config (Sonnet with thinking).

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/workers/tasks/entityTagImageStylesTask.ts apps/illuminator/webui/src/workers/tasks/llmCallConfig.ts
git commit -m "feat: add LLM entity image style batch tagging task"
```

---

### Task 4: Create entity bulk image operations hook

**Files:**
- Create: `apps/illuminator/webui/src/hooks/useEntityBulkImageOperations.ts`

**Step 1: Create the hook**

This hook provides all entity image bulk operations. It reads entities from the entity store, uses `assignImageStyles()` and `assignSecondaryStyles()` from `imageStyleAssignment.ts`, and writes results via `applyImageStyleResult()` and `clearEntityImage()`.

```typescript
/**
 * useEntityBulkImageOperations — Bulk image style operations for entities.
 *
 * Provides: tag styles (LLM), assign primary, assign secondary,
 * bulk clear images, bulk generate with primary/secondary toggle.
 */

import { useState, useCallback } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import type { EntityNavItem } from "../lib/db/entityNav";
import { assignImageStyles, assignSecondaryStyles, type ImageRefRanking } from "../lib/imageStyleAssignment";
import { applyImageStyleResult, clearEntityImage, getEntitiesForRun } from "../lib/db/entityRepository";
import { buildImagePromptFromGuidance } from "../lib/promptBuilders";
import { getSizeForAspect } from "../lib/imageSettings";
import { db } from "../lib/db/illuminatorDb";

interface OperationResult {
  success: boolean;
  count: number;
  error?: string;
}

export function useEntityBulkImageOperations({
  entityNavItems,
  simulationRunId,
  styleLibrary,
  imageModel,
  onEnqueue,
  worldContext,
  entityGuidance,
  cultureIdentities,
  imageGenSettings,
  refresh,
}: {
  entityNavItems: EntityNavItem[];
  simulationRunId: string;
  styleLibrary: StyleLibrary | null;
  imageModel: string;
  onEnqueue: (items: Array<Record<string, unknown>>) => void;
  worldContext: Record<string, unknown>;
  entityGuidance: Record<string, unknown>;
  cultureIdentities: Record<string, unknown>;
  imageGenSettings: { imageSize: string; imageQuality: string };
  refresh: () => Promise<void>;
}) {
  const [useSecondaryStyles, setUseSecondaryStyles] = useState(false);
  const [tagResult, setTagResult] = useState<OperationResult | null>(null);
  const [assignResult, setAssignResult] = useState<OperationResult | null>(null);
  const [assignSecondaryResult, setAssignSecondaryResult] = useState<OperationResult | null>(null);
  const [clearResult, setClearResult] = useState<OperationResult | null>(null);

  // ── Tag Styles (enqueue LLM task) ──

  const handleTagStyles = useCallback(async () => {
    // Collect eligible entities: have visual thesis, no style tags yet
    const eligible = entityNavItems.filter((e) => e.hasVisualThesis);
    if (eligible.length === 0 || !styleLibrary) {
      setTagResult({ success: true, count: 0 });
      setTimeout(() => setTagResult(null), 4000);
      return;
    }

    // Build style catalogs from library
    const artisticStyles = styleLibrary.artisticStyles.map((s) => ({
      id: s.id, name: s.name, category: s.category,
    }));
    const compositionStyles = styleLibrary.compositionStyles.map((s) => ({
      id: s.id, name: s.name, targetCategory: s.targetCategory || "",
    }));
    const colorPalettes = styleLibrary.colorPalettes.map((p) => ({
      id: p.id, name: p.name, description: p.description, group: p.group,
    }));

    // Enqueue as a special task — the worker will call executeEntityTagImageStylesStep
    const entityIds = eligible.map((e) => e.id);
    onEnqueue([{
      entity: { id: entityIds[0], name: "Batch Tag", kind: "system", subtype: "" },
      type: "entityTagImageStyles",
      prompt: "",
      entityIds,
      artisticStyles,
      compositionStyles,
      colorPalettes,
    }]);

    setTagResult({ success: true, count: eligible.length });
    setTimeout(() => setTagResult(null), 4000);
  }, [entityNavItems, styleLibrary, onEnqueue]);

  // ── Assign Primary Styles (deterministic distribution) ──

  const handleAssignPrimaryStyles = useCallback(async () => {
    const allEntities = await getEntitiesForRun(simulationRunId);
    const rankings: ImageRefRanking[] = [];

    for (const entity of allEntities) {
      const style = entity.enrichment?.imageStyle;
      if (!style?.rankedArtisticStyleIds?.length) continue;
      rankings.push({
        chronicleId: entity.id,
        refId: entity.id,
        rankedArtisticStyleIds: style.rankedArtisticStyleIds,
        rankedCompositionStyleIds: style.rankedCompositionStyleIds,
        rankedColorPaletteIds: style.rankedColorPaletteIds,
      });
    }

    if (rankings.length === 0) {
      setAssignResult({ success: true, count: 0 });
      setTimeout(() => setAssignResult(null), 4000);
      return;
    }

    const result = assignImageStyles(rankings, styleLibrary);

    for (const entry of result.entries) {
      const entity = allEntities.find((e) => e.id === entry.chronicleId);
      if (!entity?.enrichment?.imageStyle) continue;
      await applyImageStyleResult(entity.id, {
        ...entity.enrichment.imageStyle,
        suggestedArtisticStyleId: entry.assignedArtisticStyleId,
        suggestedCompositionStyleId: entry.assignedCompositionStyleId,
        suggestedColorPaletteId: entry.assignedColorPaletteId,
      });
    }

    await refresh();
    const shifted = result.entries.filter((e) => e.artisticShifted || e.compositionShifted || e.paletteShifted).length;
    setAssignResult({ success: true, count: rankings.length });
    console.log(`[AssignEntityStyles] Assigned ${rankings.length} entities, ${shifted} shifted`);
    setTimeout(() => setAssignResult(null), 4000);
  }, [simulationRunId, styleLibrary, refresh]);

  // ── Assign Secondary Styles (pair-novelty greedy) ──

  const handleAssignSecondaryStyles = useCallback(async () => {
    const allEntities = await getEntitiesForRun(simulationRunId);
    const rankings: ImageRefRanking[] = [];
    const primaryAssignments: Array<{
      chronicleId: string;
      refId: string;
      artisticStyleId: string;
      compositionStyleId: string;
      colorPaletteId: string;
    }> = [];

    for (const entity of allEntities) {
      const style = entity.enrichment?.imageStyle;
      if (!style?.rankedArtisticStyleIds?.length) continue;
      if (!style.suggestedArtisticStyleId) continue;
      rankings.push({
        chronicleId: entity.id,
        refId: entity.id,
        rankedArtisticStyleIds: style.rankedArtisticStyleIds,
        rankedCompositionStyleIds: style.rankedCompositionStyleIds,
        rankedColorPaletteIds: style.rankedColorPaletteIds,
      });
      primaryAssignments.push({
        chronicleId: entity.id,
        refId: entity.id,
        artisticStyleId: style.suggestedArtisticStyleId,
        compositionStyleId: style.suggestedCompositionStyleId,
        colorPaletteId: style.suggestedColorPaletteId,
      });
    }

    if (rankings.length === 0) {
      setAssignSecondaryResult({ success: true, count: 0 });
      setTimeout(() => setAssignSecondaryResult(null), 4000);
      return;
    }

    const result = assignSecondaryStyles(rankings, primaryAssignments);

    for (const entry of result.entries) {
      const entity = allEntities.find((e) => e.id === entry.chronicleId);
      if (!entity?.enrichment?.imageStyle) continue;
      await applyImageStyleResult(entity.id, {
        ...entity.enrichment.imageStyle,
        secondaryArtisticStyleId: entry.secondaryArtisticStyleId,
        secondaryCompositionStyleId: entry.secondaryCompositionStyleId,
        secondaryColorPaletteId: entry.secondaryColorPaletteId,
      });
    }

    await refresh();
    setAssignSecondaryResult({ success: true, count: result.entries.length });
    console.log(`[AssignEntitySecondaryStyles] ${result.entries.length} secondary combos, ${result.novelPairs}/${result.totalPairs} novel`);
    setTimeout(() => setAssignSecondaryResult(null), 4000);
  }, [simulationRunId, refresh]);

  // ── Bulk Clear Images ──

  const handleBulkClearImages = useCallback(async () => {
    const withImages = entityNavItems.filter((e) => e.imageId);
    for (const nav of withImages) {
      await clearEntityImage(nav.id);
    }
    await refresh();
    setClearResult({ success: true, count: withImages.length });
    setTimeout(() => setClearResult(null), 4000);
  }, [entityNavItems, refresh]);

  // ── Bulk Generate Images ──

  const handleBulkGenerateImages = useCallback(async () => {
    if (!styleLibrary) return;

    const artisticMap = new Map(styleLibrary.artisticStyles.map((s) => [s.id, s]));
    const compositionMap = new Map(styleLibrary.compositionStyles.map((s) => [s.id, s]));
    const paletteMap = new Map(styleLibrary.colorPalettes.map((s) => [s.id, s]));

    const allEntities = await getEntitiesForRun(simulationRunId);
    const entityMap = new Map(allEntities.map((e) => [e.id, e]));

    // Only generate for entities with style assignments and no current image
    const eligible = entityNavItems.filter((e) => !e.imageId && e.hasImageStyle);
    const items: Array<Record<string, unknown>> = [];

    for (const nav of eligible) {
      const entity = entityMap.get(nav.id);
      if (!entity?.enrichment?.imageStyle) continue;
      const style = entity.enrichment.imageStyle;

      const artId = useSecondaryStyles ? style.secondaryArtisticStyleId : style.suggestedArtisticStyleId;
      const compId = useSecondaryStyles ? style.secondaryCompositionStyleId : style.suggestedCompositionStyleId;
      const palId = useSecondaryStyles ? style.secondaryColorPaletteId : style.suggestedColorPaletteId;
      if (!artId || !compId || !palId) continue;

      const artistic = artisticMap.get(artId);
      const composition = compositionMap.get(compId);
      const palette = paletteMap.get(palId);
      if (!artistic || !composition) continue;

      const styleInfo = {
        artisticPromptFragment: artistic.promptFragment,
        compositionPromptFragment: composition.promptFragment,
        colorPalettePromptFragment: palette?.promptFragment,
        colorPaletteSwatchColors: palette?.swatchColors,
        artisticNegativePrompt: artistic.negativePrompt,
        artistExemplar: artistic.artistExemplar,
      };

      const prompt = buildImagePromptFromGuidance(
        entityGuidance,
        cultureIdentities,
        worldContext,
        {
          id: entity.id,
          name: entity.name,
          kind: entity.kind,
          subtype: entity.subtype,
          culture: entity.culture,
          summary: entity.summary,
          visualThesis: entity.enrichment?.text?.visualThesis,
          visualTraits: entity.enrichment?.text?.visualTraits,
        },
        styleInfo,
        imageModel,
      );

      items.push({
        entity,
        type: "image",
        prompt,
        imageSize: getSizeForAspect(imageModel, composition.defaultImageAspect || "square"),
        imageQuality: imageGenSettings.imageQuality,
        artisticStyleId: artId,
        compositionStyleId: compId,
        colorPaletteId: palId,
        tags: style.visualTags,
      });
    }

    if (items.length > 0) {
      // Enqueue with delay between items (same pattern as chronicle bulk generation)
      for (const item of items) {
        onEnqueue([item]);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  }, [entityNavItems, simulationRunId, styleLibrary, useSecondaryStyles, imageModel, imageGenSettings, worldContext, entityGuidance, cultureIdentities, onEnqueue, refresh]);

  return {
    useSecondaryStyles,
    setUseSecondaryStyles,
    handleTagStyles,
    handleAssignPrimaryStyles,
    handleAssignSecondaryStyles,
    handleBulkClearImages,
    handleBulkGenerateImages,
    tagResult,
    assignResult,
    assignSecondaryResult,
    clearResult,
  };
}
```

**Notes for the implementer:**
- The `buildImagePromptFromGuidance` call signature may need adjustment — check the actual function in `promptBuilders.ts` for exact param types. The shape shown here is representative.
- The `handleTagStyles` enqueues a special task type `"entityTagImageStyles"`. This needs to be handled in the worker dispatch — see Task 5.
- The `onEnqueue` shim wraps items with an `entity` field matching `EnqueueItem`. For the tag task, the entity is a dummy since it's a batch operation.

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/hooks/useEntityBulkImageOperations.ts
git commit -m "feat: add entity bulk image operations hook"
```

---

### Task 5: Wire tagging task into worker dispatch

**Files:**
- Modify: `apps/illuminator/webui/src/workers/enrichment.worker.ts` (or equivalent worker file)
- Modify: `apps/illuminator/webui/src/lib/enrichmentTypes.ts`

**Step 1: Add task type to EnrichmentType union**

In `enrichmentTypes.ts`, add to the `EnrichmentType` union:
```typescript
  | "entityTagImageStyles"
```

**Step 2: Import and dispatch in worker**

In the worker file, import the new task executor:
```typescript
import { executeEntityTagImageStylesStep } from "./tasks/entityTagImageStylesTask";
```

Add to the task execution switch/dispatch (follow the pattern of existing task types):
```typescript
if (task.type === "entityTagImageStyles") {
  return await executeEntityTagImageStylesStep(task, context);
}
```

The `persistResult` function does NOT need a new branch — the tagging task writes directly to DB via `applyImageStyleResult` within the task itself (same pattern as `chronicleTagImageRefsTask`).

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/workers/enrichment.worker.ts apps/illuminator/webui/src/lib/enrichmentTypes.ts
git commit -m "feat: wire entity image style tagging into worker dispatch"
```

---

### Task 6: Add entity image bulk actions UI

**Files:**
- Create: `apps/illuminator/webui/src/components/EntityImageBulkActions.tsx`

**Step 1: Create the component**

Follow the pattern of `ChronicleBulkActions.tsx`. Buttons for each operation, primary/secondary toggle checkbox, toast results.

```typescript
/**
 * EntityImageBulkActions — Bulk image style operations toolbar for entities.
 */

import React from "react";

interface EntityImageBulkActionsProps {
  onTagStyles: () => void;
  onAssignPrimary: () => void;
  onAssignSecondary: () => void;
  onBulkClear: () => void;
  onBulkGenerate: () => void;
  useSecondaryStyles: boolean;
  onSetUseSecondaryStyles: (value: boolean) => void;
  tagResult: { success: boolean; count: number } | null;
  assignResult: { success: boolean; count: number } | null;
  assignSecondaryResult: { success: boolean; count: number } | null;
  clearResult: { success: boolean; count: number } | null;
  entityCount: number;
  taggedCount: number;
  imageCount: number;
}

export default function EntityImageBulkActions({
  onTagStyles,
  onAssignPrimary,
  onAssignSecondary,
  onBulkClear,
  onBulkGenerate,
  useSecondaryStyles,
  onSetUseSecondaryStyles,
  tagResult,
  assignResult,
  assignSecondaryResult,
  clearResult,
  entityCount,
  taggedCount,
  imageCount,
}: Readonly<EntityImageBulkActionsProps>) {
  return (
    <div className="eib-actions">
      <div className="eib-section">
        <div className="eib-section-title">Style Assignment</div>
        <div className="eib-stats">
          {taggedCount}/{entityCount} tagged · {imageCount} images
        </div>
        <div className="eib-button-row">
          <button onClick={onTagStyles} className="eib-btn">Tag Styles</button>
          <button onClick={onAssignPrimary} className="eib-btn">Assign Primary</button>
          <button onClick={onAssignSecondary} className="eib-btn">Assign Secondary</button>
        </div>
        {tagResult && (
          <div className="eib-toast">{tagResult.count} entities queued for tagging</div>
        )}
        {assignResult && (
          <div className="eib-toast">{assignResult.count} primary assignments</div>
        )}
        {assignSecondaryResult && (
          <div className="eib-toast">{assignSecondaryResult.count} secondary assignments</div>
        )}
      </div>
      <div className="eib-section">
        <div className="eib-section-title">Generation</div>
        <div className="eib-button-row">
          <button onClick={onBulkClear} className="eib-btn eib-btn-danger">Clear All Images</button>
          <button onClick={onBulkGenerate} className="eib-btn eib-btn-primary">Generate All</button>
        </div>
        <label className="eib-toggle-label">
          <input
            type="checkbox"
            checked={useSecondaryStyles}
            onChange={(e) => onSetUseSecondaryStyles(e.target.checked)}
          />
          Use secondary styles
        </label>
        {clearResult && (
          <div className="eib-toast">{clearResult.count} images cleared</div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create CSS**

Create `apps/illuminator/webui/src/components/EntityImageBulkActions.css` with styles matching the chronicle bulk actions pattern (`.chron-bulk-*` → `.eib-*`).

**Step 3: Wire into the Entities tab**

In `EntityBrowser.tsx` (or wherever the entities tab content lives), import and render `EntityImageBulkActions` alongside the existing entity list. Connect it to the `useEntityBulkImageOperations` hook.

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/EntityImageBulkActions.tsx apps/illuminator/webui/src/components/EntityImageBulkActions.css apps/illuminator/webui/src/components/EntityBrowser.tsx
git commit -m "feat: add entity image bulk actions UI"
```

---

### Task 7: Create entity image curation panel

**Files:**
- Create: `apps/illuminator/webui/src/components/entity-curation/EntityCurationPanel.tsx`
- Create: `apps/illuminator/webui/src/components/entity-curation/EntityCurationPanel.css`
- Create: `apps/illuminator/webui/src/components/entity-curation/EntityCurationNavigator.tsx`
- Create: `apps/illuminator/webui/src/components/entity-curation/EntityCurationNavigator.css`
- Create: `apps/illuminator/webui/src/components/entity-curation/EntityCurationGrid.tsx`
- Create: `apps/illuminator/webui/src/components/entity-curation/EntityCurationGrid.css`

**Step 1: Create EntityCurationNavigator**

Left nav grouped by kind → culture. Follow `CurationNavigator.tsx` pattern but group by `kind` then `culture` instead of era.

```typescript
/**
 * EntityCurationNavigator — Kind/culture-grouped entity list.
 *
 * Groups entities by kind (top level), then culture (sub-groups).
 * Shows image coverage count per group.
 */

import React, { useMemo, useState } from "react";
import type { EntityNavItem } from "../../lib/db/entityNav";
import "./EntityCurationNavigator.css";

interface KindGroup {
  kind: string;
  cultures: CultureGroup[];
  totalCount: number;
  imageCount: number;
}

interface CultureGroup {
  culture: string;
  items: EntityNavItem[];
  imageCount: number;
}

interface Props {
  entityNavItems: EntityNavItem[];
  selectedKind: string | null;
  selectedCulture: string | null;
  onSelect: (kind: string | null, culture: string | null) => void;
}

export default function EntityCurationNavigator({
  entityNavItems, selectedKind, selectedCulture, onSelect,
}: Readonly<Props>) {
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(() => new Set());

  const kindGroups = useMemo((): KindGroup[] => {
    const byKind = new Map<string, Map<string, EntityNavItem[]>>();
    for (const entity of entityNavItems) {
      if (!byKind.has(entity.kind)) byKind.set(entity.kind, new Map());
      const cultureMap = byKind.get(entity.kind)!;
      if (!cultureMap.has(entity.culture)) cultureMap.set(entity.culture, []);
      cultureMap.get(entity.culture)!.push(entity);
    }

    return Array.from(byKind.entries())
      .map(([kind, cultureMap]) => {
        const cultures: CultureGroup[] = Array.from(cultureMap.entries())
          .map(([culture, items]) => ({
            culture,
            items: items.sort((a, b) => a.name.localeCompare(b.name)),
            imageCount: items.filter((e) => e.imageId).length,
          }))
          .sort((a, b) => a.culture.localeCompare(b.culture));
        return {
          kind,
          cultures,
          totalCount: cultures.reduce((sum, c) => sum + c.items.length, 0),
          imageCount: cultures.reduce((sum, c) => sum + c.imageCount, 0),
        };
      })
      .sort((a, b) => a.kind.localeCompare(b.kind));
  }, [entityNavItems]);

  const toggleKind = (kind: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <div className="ecn-navigator">
      <button
        className={`ecn-all-btn ${!selectedKind ? "ecn-selected" : ""}`}
        onClick={() => onSelect(null, null)}
      >
        All ({entityNavItems.length})
      </button>
      {kindGroups.map((group) => (
        <div key={group.kind} className="ecn-kind-group">
          <button
            className={`ecn-kind-header ${selectedKind === group.kind && !selectedCulture ? "ecn-selected" : ""}`}
            onClick={() => {
              onSelect(group.kind, null);
              if (!expandedKinds.has(group.kind)) toggleKind(group.kind);
            }}
          >
            <span className="ecn-expand" onClick={(e) => { e.stopPropagation(); toggleKind(group.kind); }}>
              {expandedKinds.has(group.kind) ? "▾" : "▸"}
            </span>
            {group.kind} ({group.imageCount}/{group.totalCount})
          </button>
          {expandedKinds.has(group.kind) && group.cultures.map((culture) => (
            <button
              key={culture.culture}
              className={`ecn-culture-item ${selectedKind === group.kind && selectedCulture === culture.culture ? "ecn-selected" : ""}`}
              onClick={() => onSelect(group.kind, culture.culture)}
            >
              {culture.culture} ({culture.imageCount}/{culture.items.length})
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create EntityCurationGrid**

Grid of entity cards with thumbnails. Click to open image selection.

```typescript
/**
 * EntityCurationGrid — Grid of entity image cards for curation.
 *
 * Shows entity thumbnail, name, subtype, style indicators.
 * Click to open image history for that entity.
 */

import React from "react";
import { useLazyImageUrl } from "../ChronicleImagePanelCards";
import type { EntityNavItem } from "../../lib/db/entityNav";
import "./EntityCurationGrid.css";

interface Props {
  entities: EntityNavItem[];
  onSelectEntity: (entityId: string) => void;
  selectedEntityId: string | null;
  styleNames: {
    artistic: Map<string, string>;
    composition: Map<string, string>;
    palette: Map<string, string>;
  };
}

function EntityCard({
  entity,
  isSelected,
  onClick,
}: Readonly<{ entity: EntityNavItem; isSelected: boolean; onClick: () => void }>) {
  const { containerRef, url } = useLazyImageUrl(entity.imageId);
  return (
    <div
      ref={containerRef}
      className={`ecg-card ${isSelected ? "ecg-card-selected" : ""} ${entity.imageId ? "" : "ecg-card-missing"}`}
      onClick={onClick}
    >
      <div className="ecg-thumb">
        {url ? <img src={url} alt={entity.name} /> : <div className="ecg-placeholder" />}
      </div>
      <div className="ecg-info">
        <div className="ecg-name">{entity.name}</div>
        <div className="ecg-subtype">{entity.subtype}</div>
      </div>
    </div>
  );
}

export default function EntityCurationGrid({
  entities, onSelectEntity, selectedEntityId,
}: Readonly<Props>) {
  return (
    <div className="ecg-grid">
      {entities.map((entity) => (
        <EntityCard
          key={entity.id}
          entity={entity}
          isSelected={entity.id === selectedEntityId}
          onClick={() => onSelectEntity(entity.id)}
        />
      ))}
    </div>
  );
}
```

**Step 3: Create EntityCurationPanel (main wrapper)**

```typescript
/**
 * EntityCurationPanel — Three-rail entity image curation workspace.
 *
 * Left: EntityCurationNavigator (kind/culture groups)
 * Center: EntityCurationGrid (entity image cards)
 * Right: Image history for selected entity (select primary)
 */

import React, { useState, useMemo, useCallback } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import type { EntityNavItem } from "../../lib/db/entityNav";
import { useEntityStore } from "../../lib/db/entityStore";
import { getImagesForEntity } from "../../lib/db/imageRepository";
import { applyImageResult } from "../../lib/db/entityRepository";
import EntityCurationNavigator from "./EntityCurationNavigator";
import EntityCurationGrid from "./EntityCurationGrid";
import { useImageUrl } from "@the-canonry/image-store";
import "./EntityCurationPanel.css";

interface Props {
  styleLibrary?: StyleLibrary | null;
  simulationRunId: string;
}

export default function EntityCurationPanel({ styleLibrary, simulationRunId }: Readonly<Props>) {
  const entityNavItems = useEntityStore((s) => Object.values(s.navItems));

  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [selectedCulture, setSelectedCulture] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [entityImages, setEntityImages] = useState<Array<{ imageId: string; generatedAt: number; model: string }>>([]);

  const styleNames = useMemo(() => {
    const artistic = new Map<string, string>();
    const composition = new Map<string, string>();
    const palette = new Map<string, string>();
    if (styleLibrary) {
      for (const s of styleLibrary.artisticStyles) artistic.set(s.id, s.name);
      for (const s of styleLibrary.compositionStyles) composition.set(s.id, s.name);
      for (const p of styleLibrary.colorPalettes) palette.set(p.id, p.name);
    }
    return { artistic, composition, palette };
  }, [styleLibrary]);

  // Filter entities by kind/culture selection
  const filteredEntities = useMemo(() => {
    let items = entityNavItems;
    if (selectedKind) items = items.filter((e) => e.kind === selectedKind);
    if (selectedCulture) items = items.filter((e) => e.culture === selectedCulture);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [entityNavItems, selectedKind, selectedCulture]);

  const handleSelectGroup = useCallback((kind: string | null, culture: string | null) => {
    setSelectedKind(kind);
    setSelectedCulture(culture);
    setSelectedEntityId(null);
  }, []);

  const handleSelectEntity = useCallback(async (entityId: string) => {
    setSelectedEntityId(entityId);
    const images = await getImagesForEntity(entityId);
    setEntityImages(images.map((img) => ({
      imageId: img.imageId,
      generatedAt: img.generatedAt || 0,
      model: img.model || "",
    })));
  }, []);

  const handleSetPrimary = useCallback(async (imageId: string) => {
    if (!selectedEntityId) return;
    const img = entityImages.find((i) => i.imageId === imageId);
    if (!img) return;
    await applyImageResult(selectedEntityId, {
      imageId,
      generatedAt: img.generatedAt,
      model: img.model,
    });
    // Refresh entity store to reflect change
    // (the store should re-read from DB)
  }, [selectedEntityId, entityImages]);

  return (
    <div className="illuminator-content">
      <div className="ecp-workspace">
        <div className="ecp-left-rail">
          <EntityCurationNavigator
            entityNavItems={entityNavItems}
            selectedKind={selectedKind}
            selectedCulture={selectedCulture}
            onSelect={handleSelectGroup}
          />
        </div>
        <div className="ecp-center-rail">
          <EntityCurationGrid
            entities={filteredEntities}
            onSelectEntity={handleSelectEntity}
            selectedEntityId={selectedEntityId}
            styleNames={styleNames}
          />
        </div>
        <div className="ecp-right-rail">
          {selectedEntityId && entityImages.length > 0 ? (
            <div className="ecp-image-history">
              <div className="ecp-history-title">Image History</div>
              {entityImages.map((img) => (
                <ImageHistoryCard
                  key={img.imageId}
                  imageId={img.imageId}
                  generatedAt={img.generatedAt}
                  model={img.model}
                  isActive={entityNavItems.find((e) => e.id === selectedEntityId)?.imageId === img.imageId}
                  onSetPrimary={() => handleSetPrimary(img.imageId)}
                />
              ))}
            </div>
          ) : selectedEntityId ? (
            <div className="ecp-empty-state">No images generated for this entity</div>
          ) : (
            <div className="ecp-empty-state">Select an entity to view image history</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageHistoryCard({
  imageId, generatedAt, model, isActive, onSetPrimary,
}: Readonly<{
  imageId: string;
  generatedAt: number;
  model: string;
  isActive: boolean;
  onSetPrimary: () => void;
}>) {
  const { url } = useImageUrl(imageId);
  return (
    <div className={`ecp-history-card ${isActive ? "ecp-history-active" : ""}`}>
      <div className="ecp-history-thumb">
        {url ? <img src={url} alt="" /> : <div className="ecp-history-placeholder" />}
      </div>
      <div className="ecp-history-meta">
        <div className="ecp-history-model">{model}</div>
        <div className="ecp-history-date">{new Date(generatedAt).toLocaleDateString()}</div>
        {isActive ? (
          <span className="ecp-history-active-badge">Active</span>
        ) : (
          <button onClick={onSetPrimary} className="ecp-history-set-btn">Set as Primary</button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Create CSS files**

Create CSS for all three components following existing patterns:
- `EntityCurationPanel.css` — three-rail layout (copy from `CurationTab.css`, rename `.cur-` → `.ecp-`)
- `EntityCurationNavigator.css` — collapsible groups (copy from `CurationNavigator.css`, rename)
- `EntityCurationGrid.css` — responsive card grid

**Step 5: Commit**

```bash
git add apps/illuminator/webui/src/components/entity-curation/
git commit -m "feat: add entity image curation panel with kind/culture grouping"
```

---

### Task 8: Wire curation panel into tab system

**Files:**
- Modify: `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx`
- Modify: `apps/illuminator/webui/src/components/IlluminatorSidebar.jsx` (or wherever tab nav is defined)

**Step 1: Add tab to IlluminatorTabContent**

Import and register the new panel:
```typescript
import EntityCurationPanel from "./entity-curation/EntityCurationPanel";

function EntityCurationTab({ styleLibrary, simulationRunId }) {
  return <EntityCurationPanel styleLibrary={styleLibrary} simulationRunId={simulationRunId} />;
}
```

Add to `TAB_COMPONENTS`:
```typescript
  entitycuration: EntityCurationTab,
```

**Step 2: Add sidebar nav entry**

In the sidebar component, add a nav item for the entity curation tab. Place it near "curation" (chronicle curation) so they're grouped logically:
```typescript
{ id: "entitycuration", label: "Entity Images" }
```

**Step 3: Commit**

```bash
git add apps/illuminator/webui/src/components/IlluminatorTabContent.jsx apps/illuminator/webui/src/components/IlluminatorSidebar.jsx
git commit -m "feat: wire entity image curation tab into sidebar and tab system"
```

---

### Task 9: Integration testing

**Step 1: Verify the full pipeline manually**

1. Load a simulation with entities that have visual theses
2. Go to Entities tab → click "Tag Styles" → verify enrichment.imageStyle appears in DB
3. Click "Assign Primary" → verify suggestedXxxId fields are set
4. Click "Assign Secondary" → verify secondaryXxxId fields are set
5. Click "Generate All" with primary toggle → verify images generate with correct styles
6. Toggle "Use secondary" → click "Generate All" → verify different styles are used
7. Go to Entity Images tab → verify kind/culture grouping
8. Click an entity → verify image history shows
9. Click "Set as Primary" on a non-active image → verify it becomes the active image

**Step 2: Verify style coverage**

After "Assign Primary", check that the distribution across artistic/composition/palette styles is balanced (no style appears more than ~20% more than another). The console log from the hook reports shift counts.

**Step 3: Commit any fixes**

```bash
git commit -m "fix: integration testing adjustments for entity image styles"
```
