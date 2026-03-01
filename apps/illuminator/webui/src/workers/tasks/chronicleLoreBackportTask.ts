/**
 * Chronicle Lore Backport Worker Task
 *
 * Reads run state from IndexedDB, assembles context from the chronicle text
 * and perspective synthesis, makes one LLM call for the cast batch, and
 * writes the resulting patches back to IndexedDB.
 *
 * Extracts new lore from a published chronicle and proposes small updates
 * to cast member summaries and descriptions.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type {
  SummaryRevisionLLMResponse,
  SummaryRevisionBatch,
  RevisionEntityContext,
} from "../../lib/summaryRevisionTypes";
import {
  type ProminenceScale,
  buildProminenceScale,
  DEFAULT_PROMINENCE_DISTRIBUTION,
  prominenceLabelFromScale,
} from "@canonry/world-schema";
import { getRevisionRun, updateRevisionRun } from "../../lib/db/summaryRevisionRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";

// ============================================================================
// Perspective Synthesis Types
// ============================================================================

interface SynthesisFacet {
  factId: string;
  interpretation: string;
}

interface SynthesisEntityDirective {
  entityName: string;
  directive: string;
}

interface PerspectiveSynthesis {
  chronicleFormat?: string;
  brief?: string;
  facets?: SynthesisFacet[];
  narrativeVoice?: Record<string, string>;
  entityDirectives?: SynthesisEntityDirective[];
  suggestedMotifs?: string[];
  narrativeDirection?: string;
}

// ============================================================================
// System Prompt (imported from separate constant to keep file within line limit)
// ============================================================================

import { LORE_BACKPORT_SYSTEM_PROMPT } from "./chronicleLoreBackportSystemPrompt";

// ============================================================================
// Context Assembly Helpers
// ============================================================================

function resolveProminenceLabel(
  value: RevisionEntityContext["prominence"] | number | undefined,
  scale: ProminenceScale
): string {
  if (value == null) return "unknown";
  if (typeof value === "number") {
    return prominenceLabelFromScale(value, scale);
  }
  const trimmed = String(value).trim();
  if (!trimmed) return "unknown";
  if (scale.labels.includes(trimmed)) return trimmed;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return prominenceLabelFromScale(numeric, scale);
  }
  return trimmed;
}

function formatPerspectiveSynthesis(perspectiveSynthesisJson: string): {
  sections: string[];
  chronicleFormat: string;
} {
  const sections: string[] = [];
  let chronicleFormat = "";

  try {
    const synthesis: PerspectiveSynthesis = JSON.parse(perspectiveSynthesisJson);
    chronicleFormat = synthesis.chronicleFormat ?? "";
    const synthParts: string[] = [];

    if (synthesis.brief) {
      synthParts.push(`Brief: ${synthesis.brief}`);
    }
    if (synthesis.facets?.length) {
      const facetLines = synthesis.facets
        .map((f) => `  - [${f.factId}] ${f.interpretation}`)
        .join("\n");
      synthParts.push(`Faceted Facts:\n${facetLines}`);
    }
    if (synthesis.narrativeVoice && Object.keys(synthesis.narrativeVoice).length) {
      synthParts.push(
        `Narrative Voice:\n${Object.entries(synthesis.narrativeVoice)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n")}`
      );
    }
    if (synthesis.entityDirectives?.length) {
      const directiveLines = synthesis.entityDirectives
        .map((d) => `  - ${d.entityName}: ${d.directive}`)
        .join("\n");
      synthParts.push(`Entity Directives:\n${directiveLines}`);
    }
    if (synthesis.suggestedMotifs?.length) {
      synthParts.push(`Motifs: ${synthesis.suggestedMotifs.join(", ")}`);
    }

    if (synthParts.length > 0) {
      sections.push(`=== PERSPECTIVE SYNTHESIS ===\n${synthParts.join("\n\n")}`);
    }

    if (synthesis.narrativeDirection) {
      sections.push(
        `=== NARRATIVE DIRECTION ===\nThis chronicle was written with a specific narrative direction: "${synthesis.narrativeDirection}"\nConsider this when evaluating which details are chronicle-specific framing vs. durable lore worth backporting.`
      );
    }
  } catch {
    sections.push(`=== PERSPECTIVE SYNTHESIS ===\n${perspectiveSynthesisJson}`);
  }

  return { sections, chronicleFormat };
}

function formatEntityBlock(
  e: RevisionEntityContext,
  prominenceScale: ProminenceScale
): string {
  const parts: string[] = [];
  const displayName = e.chronicleName || e.name;
  const lensTag = e.isLens ? " [NARRATIVE LENS]" : "";
  const primaryTag = e.isPrimary ? " [PRIMARY]" : "";
  const entityKindLabel = e.subtype ? `${e.kind} / ${e.subtype}` : e.kind;
  parts.push(`### ${displayName} (${entityKindLabel})${lensTag}${primaryTag}`);
  if (e.chronicleName && e.chronicleName !== e.name) {
    parts.push(`Canonical name: ${e.name}`);
  }
  if (e.aliases?.length) {
    parts.push(`Also known as: ${e.aliases.join(", ")}`);
  }
  parts.push(`ID: ${e.id}`);
  const chronicleRole = e.isPrimary ? "primary" : "supporting";
  parts.push(
    `Prominence: ${resolveProminenceLabel(e.prominence, prominenceScale)} | Chronicle Role: ${chronicleRole} | Culture: ${e.culture} | Status: ${e.status}`
  );

  if (e.kindFocus) {
    parts.push(`Description Focus (${e.kind}): ${e.kindFocus}`);
  }
  if (e.visualThesis) {
    parts.push(`Visual Thesis (DO NOT CONTRADICT): ${e.visualThesis}`);
  }
  if (e.relationships.length > 0) {
    const relLines = e.relationships.map(
      (r) => `  - ${r.kind} → ${r.targetName} (${r.targetKind})`
    );
    parts.push(`Relationships:\n${relLines.join("\n")}`);
  }

  parts.push(`Summary: ${e.summary}`);

  const descParagraphs = e.description
    ? e.description.split(/\n\n+/).filter((p: string) => p.trim())
    : [];
  if (descParagraphs.length > 1) {
    parts.push(`Description (${descParagraphs.length} paragraphs):`);
    descParagraphs.forEach((p: string, i: number) => {
      parts.push(`  [${i + 1}] ${p.trim()}`);
    });
  } else {
    parts.push(`Description: ${e.description}`);
  }

  if (e.existingAnchorPhrases?.length) {
    const anchorLines = e.existingAnchorPhrases.map((a: string) => `  - "${a}"`).join("\n");
    parts.push(`Existing Anchor Phrases (PRESERVE in description):\n${anchorLines}`);
  }

  return parts.join("\n");
}

function buildEntityTaskBlock(e: RevisionEntityContext, criticalNote: string): string {
  if (e.isLens) {
    return `--- UPDATE: ${e.name} (${e.kind}) [NARRATIVE LENS] ---
This entity was the narrative lens — contextual framing, not a cast member. It was referenced or invoked but did not act as a character. Apply a HIGH BAR for changes.

For ${e.name}, ask:
1. Does the chronicle reveal a genuinely new fact about ${e.name} itself — a consequence, a new aspect, a status change, or a previously unknown property?
2. Merely being referenced, invoked, or serving as backdrop is NOT new lore. Skip those.
3. If there IS new lore: compress into 1 sentence. Most lens entities need NO update.
4. Final check: would this change make sense without knowing this chronicle used ${e.name} as a lens?${criticalNote}`;
  }
  return `--- UPDATE: ${e.name} (${e.kind}) ---
You are writing the standalone wiki article for ${e.name}. A reader may arrive at this page knowing nothing about this chronicle. Every sentence must be about ${e.name}. Every reference to another entity, event, or artifact must be introduced with a brief identifying clause or omitted.

For ${e.name}, follow the thinking steps:
1. What genuinely new facts does the chronicle reveal about ${e.name} specifically?
2. Does each new fact already appear in the existing description? If so, skip it.
3. For each new fact: is it a detail refinement (edit existing sentence) or a new fact (add content)?
4. Compress: 1-2 sentences per new fact. No atmospheric verbs, no scene reconstruction. Scale length to prominence and chronicle role—low-prominence primary entities may warrant more; high-prominence or supporting entities need less.
5. Match the existing description's tense. Use past tense for chronicle actions, present tense for lasting consequences. Never use "currently," "now," or "remains" for chronicle-sourced states.
6. Avoid resolution language — no adverbs or phrases that signal arc completion, personal growth, or thematic conclusions.
7. Final check: would every sentence make sense to someone who has never read this chronicle?${criticalNote}`;
}

// ============================================================================
// User Prompt Assembly
// ============================================================================

function buildUserPrompt(
  entities: RevisionEntityContext[],
  chronicleText: string,
  perspectiveSynthesisJson: string,
  customInstructions?: string
): string {
  const sections: string[] = [];
  const prominenceScale = buildProminenceScale(
    entities.map((e) => Number(e.prominence)).filter((value) => Number.isFinite(value)),
    { distribution: DEFAULT_PROMINENCE_DISTRIBUTION }
  );

  sections.push(`=== CHRONICLE TEXT ===\n${chronicleText}`);

  let chronicleFormat = "";
  if (perspectiveSynthesisJson) {
    const synthResult = formatPerspectiveSynthesis(perspectiveSynthesisJson);
    sections.push(...synthResult.sections);
    chronicleFormat = synthResult.chronicleFormat;
  }

  const castEntities = entities.filter((e) => !e.isLens);
  const lensEntities = entities.filter((e) => e.isLens);

  const castLines = castEntities.map((e) => formatEntityBlock(e, prominenceScale));
  sections.push(
    `=== CAST (${castEntities.length} entities) ===\n\n${castLines.join("\n\n---\n\n")}`
  );

  if (lensEntities.length > 0) {
    const lensLines = lensEntities.map((e) => formatEntityBlock(e, prominenceScale));
    sections.push(
      `=== NARRATIVE LENS (${lensEntities.length} ${lensEntities.length === 1 ? "entity" : "entities"}) ===\nThese entities provided contextual framing for the chronicle — they are not cast members. Apply a higher bar: only update if the chronicle reveals genuinely new facts about the entity itself.\n\n${lensLines.join("\n\n---\n\n")}`
    );
  }

  const documentFormatNote =
    chronicleFormat === "document"
      ? `\nThis chronicle is written in document format — it reports events and outcomes factually. Extract institutional outcomes, status changes, and territorial shifts. Attribute each fact to the entity that owns it.`
      : "";

  const criticalNote = customInstructions
    ? `\nCRITICAL — USER INSTRUCTIONS: ${customInstructions}`
    : "";

  const entityTaskBlocks = entities
    .map((e) => buildEntityTaskBlock(e, criticalNote))
    .join("\n\n");

  const criticalSection = customInstructions
    ? `\n\n## CRITICAL — User Instructions\n\nThe following user-provided instructions override default behavior. Apply them to EVERY entity update:\n\n${customInstructions}\n`
    : "";

  sections.push(`=== YOUR TASK ===${criticalSection}
Process each entity below independently. For each one, reset your focus — you are writing that entity's wiki article, not summarizing the chronicle.${documentFormatNote}

General rules:
- Summary: append 0-1 sentences. Most entities need no summary change.
- Description: output as an array of paragraph strings. Integrate detail refinements into existing sentences. Add new lore as new content. Preserve all existing information.
- Zero overlap: never restate a fact already in the description.
- Cross-entity overlap: each fact belongs to one entity. Do not duplicate facts across entities.
- Preserve visual thesis.

${entityTaskBlocks}`);

  return sections.join("\n\n");
}

// ============================================================================
// Response Parsing Helpers
// ============================================================================

function parseEntitiesFromPrompt(taskPrompt: string): RevisionEntityContext[] {
  return JSON.parse(taskPrompt) as RevisionEntityContext[];
}

function parseLlmPatchResponse(resultText: string): SummaryRevisionLLMResponse {
  // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found");
  const parsed = JSON.parse(jsonMatch[0]) as SummaryRevisionLLMResponse;
  if (!Array.isArray(parsed.patches)) throw new Error("Missing patches array");

  for (const patch of parsed.patches) {
    if (Array.isArray(patch.description)) {
      patch.description = patch.description.join("\n\n");
    }
  }
  return parsed;
}

function markBatchFailed(
  batches: SummaryRevisionBatch[],
  batchIndex: number,
  batch: SummaryRevisionBatch,
  errorMsg: string
): SummaryRevisionBatch[] {
  const updated = [...batches];
  updated[batchIndex] = { ...batch, status: "failed", error: errorMsg };
  return updated;
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeChronicleLoreBackportTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: "Text generation not configured - missing Anthropic API key" };
  }

  const runId = task.chronicleId;
  if (!runId) {
    return { success: false, error: "runId (chronicleId) required for chronicle lore backport" };
  }

  const run = await getRevisionRun(runId);
  if (!run) {
    return { success: false, error: `Lore backport run ${runId} not found` };
  }

  const batchIndex = run.currentBatchIndex;
  const batch = run.batches[batchIndex];
  if (!batch || batch.status !== "pending") {
    return { success: false, error: `No pending batch at index ${batchIndex}` };
  }

  const updatedBatches = [...run.batches];
  updatedBatches[batchIndex] = { ...batch, status: "generating" };
  await updateRevisionRun(runId, { status: "generating", batches: updatedBatches });

  let entities: RevisionEntityContext[];
  try {
    entities = parseEntitiesFromPrompt(task.prompt);
  } catch {
    const errorMsg = "Failed to parse entity context from task prompt";
    await updateRevisionRun(runId, {
      status: "failed",
      batches: markBatchFailed(run.batches, batchIndex, batch, errorMsg),
    });
    return { success: false, error: errorMsg };
  }

  const callConfig = getCallConfig(config, "revision.loreBackport");
  const customInstructions = run.revisionGuidance || undefined;
  const userPrompt = buildUserPrompt(
    entities,
    run.worldDynamicsContext,
    run.staticPagesContext,
    customInstructions
  );

  return runLlmAndWritePatches(
    task, run, batch, batchIndex, updatedBatches, userPrompt, callConfig, llmClient, isAborted, runId
  );
}

async function runLlmAndWritePatches(
  task: WorkerTask,
  run: { totalInputTokens: number; totalOutputTokens: number; totalActualCost: number },
  batch: SummaryRevisionBatch,
  batchIndex: number,
  updatedBatches: SummaryRevisionBatch[],
  userPrompt: string,
  callConfig: ReturnType<typeof getCallConfig>,
  llmClient: TaskContext["llmClient"],
  isAborted: TaskContext["isAborted"],
  runId: string
): Promise<TaskResult> {
  try {
    const callResult = await runTextCall({
      llmClient,
      callType: "revision.loreBackport",
      callConfig,
      systemPrompt: LORE_BACKPORT_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.5,
    });

    if (isAborted()) {
      updatedBatches[batchIndex] = { ...batch, status: "failed", error: "Task aborted" };
      await updateRevisionRun(runId, { status: "failed", batches: updatedBatches });
      return { success: false, error: "Task aborted" };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || "No text returned"}`;
      updatedBatches[batchIndex] = { ...batch, status: "failed", error: errorMsg };
      await updateRevisionRun(runId, { status: "run_reviewing", batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    let parsed: SummaryRevisionLLMResponse;
    try {
      parsed = parseLlmPatchResponse(resultText);
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      updatedBatches[batchIndex] = { ...batch, status: "failed", error: errorMsg };
      await updateRevisionRun(runId, { status: "run_reviewing", batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    updatedBatches[batchIndex] = {
      ...batch,
      status: "complete",
      patches: parsed.patches,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    };

    await updateRevisionRun(runId, {
      status: "run_reviewing",
      batches: updatedBatches,
      totalInputTokens: run.totalInputTokens + callResult.usage.inputTokens,
      totalOutputTokens: run.totalOutputTokens + callResult.usage.outputTokens,
      totalActualCost: run.totalActualCost + callResult.usage.actualCost,
    });

    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: "chronicleLoreBackport" as CostType,
      model: callConfig.model,
      estimatedCost: callResult.estimate.estimatedCost,
      actualCost: callResult.usage.actualCost,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
    });

    return {
      success: true,
      result: {
        generatedAt: Date.now(),
        model: callConfig.model,
        estimatedCost: callResult.estimate.estimatedCost,
        actualCost: callResult.usage.actualCost,
        inputTokens: callResult.usage.inputTokens,
        outputTokens: callResult.usage.outputTokens,
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    updatedBatches[batchIndex] = { ...batch, status: "failed", error: errorMsg };
    await updateRevisionRun(runId, { status: "run_reviewing", batches: updatedBatches });
    return { success: false, error: `Chronicle lore backport failed: ${errorMsg}` };
  }
}

export const chronicleLoreBackportTask = {
  type: "chronicleLoreBackport" as const,
  execute: executeChronicleLoreBackportTask,
};
