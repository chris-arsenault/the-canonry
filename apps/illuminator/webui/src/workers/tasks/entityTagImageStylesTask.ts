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

interface EntityInput {
  entityId: string;
  kind: string;
  subtype: string;
  visualThesis: string;
  visualTraits: string[];
}

interface TagResult {
  entityId: string;
  tags: string[];
  artisticStyleIds: string[];
  compositionStyleIds: string[];
  colorPaletteIds: string[];
}

// ============================================================================
// Prompt builder
// ============================================================================

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
    .map(
      ([cat, styles]) =>
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
    .map(
      ([cat, styles]) =>
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
    .map(
      ([group, palettes]) =>
        `### ${group}\n${palettes.map((p) => `  ${p.id} | ${p.name} | ${p.description}`).join("\n")}`,
    )
    .join("\n");

  const entityLines = entities
    .map((e) => {
      const traits =
        e.visualTraits.length > 0 ? ` | ${e.visualTraits.join(", ")}` : "";
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

// ============================================================================
// Response parser
// ============================================================================

function parseTagResponse(text: string): TagResult[] {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/, "")
      .replace(/```\s*$/, "")
      .trim();
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

// ============================================================================
// Task executor
// ============================================================================

export async function executeEntityTagImageStylesStep(
  task: WorkerTask,
  context: TaskContext,
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const entityIds: string[] =
    ((task as Record<string, unknown>).entityIds as string[]) || [];
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

  const artisticStyles: StyleEntry[] =
    ((task as Record<string, unknown>).artisticStyles as StyleEntry[]) || [];
  const compositionStyles: CompositionEntry[] =
    ((task as Record<string, unknown>).compositionStyles as
      CompositionEntry[]) || [];
  const colorPalettes: PaletteEntry[] =
    ((task as Record<string, unknown>).colorPalettes as PaletteEntry[]) || [];

  if (artisticStyles.length === 0 || compositionStyles.length === 0) {
    return {
      success: false,
      error: "No styles/compositions provided on task",
    };
  }

  const prompt = buildBatchTagPrompt(
    inputs,
    artisticStyles,
    compositionStyles,
    colorPalettes,
  );
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
    return {
      success: false,
      error: call.result.error || "No response from LLM",
    };
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

// ============================================================================
// Task Handler
// ============================================================================

export const entityTagImageStylesTask = {
  type: "entityTagImageStyles" as const,

  async execute(task: WorkerTask, context: TaskContext): Promise<TaskResult> {
    return executeEntityTagImageStylesStep(task, context);
  },
};
