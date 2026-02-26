/**
 * Visual Thesis Task — runs steps 2+3 of the description chain only.
 *
 * Reads the entity's existing description from IndexedDB, then generates
 * a fresh visual thesis and visual traits. Does NOT touch summary/description.
 *
 * Use case: re-derive visual identity after a description edit, or generate
 * visual data for entities that were created manually without enrichment.
 */

import type { WorkerTask, DescriptionChainDebug } from "../../lib/enrichmentTypes";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";
import {
  getTraitGuidance,
  registerUsedTraits,
  incrementPaletteUsage,
  type TraitGuidance,
} from "../../lib/db/traitRepository";
import { getEntity } from "../../lib/db/entityRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import type { TaskHandler } from "./taskTypes";

// ---------------------------------------------------------------------------
// Prompts (same as descriptionTask steps 2+3)
// ---------------------------------------------------------------------------

function buildVisualThesisPrompt(kindInstructions: string, visualAvoid?: string): string {
  let prompt = `You distill descriptions into dominant visual signals. Your prompt contains:

- Visual Context: Entity basics and culture
- Description: Source material
- Per-Kind Guidance: What to emphasize

Output ONE sentence. Shape only - no color, texture, or suggestive language ("as if", "suggesting").`;

  if (visualAvoid) {
    prompt += `\n\nAVOID: ${visualAvoid}`;
  }

  prompt += `\n\n${kindInstructions}`;

  return prompt;
}

function buildVisualTraitsPrompt(
  kindInstructions: string,
  guidance?: TraitGuidance,
  subtype?: string
): string {
  let prompt = `You expand visual theses with supporting details. Your prompt contains:

- Thesis: Primary visual signal (don't repeat)
- Visual Context: Entity basics and culture
- Description: Source for additional features
- Palette Guidance: Required directions (if provided)

Output 2-4 traits, one per line. Each 3-8 words, adding something NEW.`;

  prompt += `\n\n${kindInstructions}`;

  if (subtype) {
    prompt += `\n\nSUBTYPE: ${subtype}`;
  }

  if (guidance && guidance.assignedCategories.length > 0) {
    prompt += `\n\nREQUIRED DIRECTIONS (address at least one):`;
    for (const p of guidance.assignedCategories) {
      prompt += `\n- ${p.category}: ${p.description} (e.g., ${p.examples.slice(0, 2).join(", ")})`;
    }
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Task Handler
// ---------------------------------------------------------------------------

export const visualThesisTask = {
  type: "visualThesis",
  async execute(task, context) {
    const { config, llmClient, isAborted } = context;

    if (!llmClient.isEnabled()) {
      return {
        success: false,
        error: "Text generation not configured - missing Anthropic API key",
      };
    }

    // Read the entity's current description from IndexedDB
    const entity = await getEntity(task.entityId);
    if (!entity) {
      return { success: false, error: `Entity not found: ${task.entityId}` };
    }
    if (!entity.description) {
      return {
        success: false,
        error: "Entity has no description — run description enrichment first",
      };
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalActualCost = 0;
    const chainDebug: DescriptionChainDebug = {};

    // Build visual context (same as descriptionTask)
    const entityContext = task.prompt || "";
    const visualIdentityMatch = entityContext.match(
      /CULTURAL VISUAL IDENTITY[^:]*:\n((?:- [A-Z_]+: .+\n?)+)/
    );
    const visualIdentityContext = visualIdentityMatch ? visualIdentityMatch[0].trim() : "";

    const thesisIdentitySuffix = visualIdentityContext ? "\n\n" + visualIdentityContext : "";
    const visualContext = `Entity: ${task.entityName} (${task.entityKind})
Culture: ${task.entityCulture || "unaffiliated"}${thesisIdentitySuffix}`;

    // ========================================================================
    // Step 1: Visual Thesis
    // ========================================================================
    console.log("[Worker] Visual thesis task step 1: Visual Thesis");

    const thesisConfig = getCallConfig(config, "description.visualThesis");

    if (!task.visualThesisInstructions) {
      return {
        success: false,
        error: `Missing visualThesisInstructions for entity kind '${task.entityKind}'`,
      };
    }

    const thesisFraming = task.visualThesisFraming || "";
    const thesisPrompt = `${thesisFraming ? thesisFraming + "\n\n" : ""}${visualContext}

DESCRIPTION (extract visual elements from this):
${entity.description}

Generate the visual thesis.`;

    const thesisSystemPrompt = buildVisualThesisPrompt(
      task.visualThesisInstructions,
      task.visualAvoid
    );

    const thesisCall = await runTextCall({
      llmClient,
      callType: "description.visualThesis",
      callConfig: thesisConfig,
      systemPrompt: thesisSystemPrompt,
      prompt: thesisPrompt,
      temperature: 0.7,
    });
    const thesisResult = thesisCall.result;
    chainDebug.thesis = thesisResult.debug;

    if (isAborted()) {
      return { success: false, error: "Task aborted", debug: thesisResult.debug };
    }

    if (thesisResult.error || !thesisResult.text) {
      return {
        success: false,
        error: `Visual thesis step failed: ${thesisResult.error || "Empty response"}`,
        debug: thesisResult.debug,
      };
    }

    const visualThesis = thesisResult.text.trim();
    if (!visualThesis) {
      return {
        success: false,
        error: "Visual thesis step returned empty response",
        debug: thesisResult.debug,
      };
    }

    totalInputTokens += thesisCall.usage.inputTokens;
    totalOutputTokens += thesisCall.usage.outputTokens;
    totalActualCost += thesisCall.usage.actualCost;

    // ========================================================================
    // Step 2: Visual Traits
    // ========================================================================
    console.log("[Worker] Visual thesis task step 2: Visual Traits");

    const traitsConfig = getCallConfig(config, "description.visualTraits");

    let traitGuidance: TraitGuidance | undefined;
    try {
      if (task.projectId && task.simulationRunId && task.entityKind) {
        traitGuidance = await getTraitGuidance(
          task.projectId,
          task.simulationRunId,
          task.entityKind,
          task.entitySubtype,
          task.entityEraId
        );
      }
    } catch (err) {
      console.warn("[Worker] Failed to fetch trait guidance:", err);
    }

    if (!task.visualTraitsInstructions) {
      return {
        success: false,
        error: `Missing visualTraitsInstructions for entity kind '${task.entityKind}'`,
      };
    }

    const traitsFraming = task.visualTraitsFraming || "";
    const traitsPrompt = `${traitsFraming ? traitsFraming + "\n\n" : ""}THESIS (the primary silhouette - don't repeat, expand):
${visualThesis}

${visualContext}

DESCRIPTION (source material for additional distinctive features):
${entity.description}

Generate 2-4 visual traits that ADD to the thesis - features it didn't cover.`;

    const traitsSystemPrompt = buildVisualTraitsPrompt(
      task.visualTraitsInstructions,
      traitGuidance,
      task.entitySubtype
    );

    const traitsCall = await runTextCall({
      llmClient,
      callType: "description.visualTraits",
      callConfig: traitsConfig,
      systemPrompt: traitsSystemPrompt,
      prompt: traitsPrompt,
      temperature: 0.7,
    });
    const traitsResult = traitsCall.result;
    chainDebug.traits = traitsResult.debug;

    if (isAborted()) {
      return { success: false, error: "Task aborted", debug: traitsResult.debug };
    }

    if (traitsResult.error || !traitsResult.text) {
      return {
        success: false,
        error: `Visual traits step failed: ${traitsResult.error || "Empty response"}`,
        debug: traitsResult.debug,
      };
    }

    const visualTraits = traitsResult.text
      .split("\n")
      .map((line) => line.replace(/^[-*\u2022]\s*/, "").trim())
      .filter((line) => line.length > 0);

    totalInputTokens += traitsCall.usage.inputTokens;
    totalOutputTokens += traitsCall.usage.outputTokens;
    totalActualCost += traitsCall.usage.actualCost;

    // ========================================================================
    // Register traits and save cost record
    // ========================================================================

    try {
      if (task.projectId && task.simulationRunId && task.entityKind && visualTraits.length > 0) {
        await registerUsedTraits(
          task.projectId,
          task.simulationRunId,
          task.entityKind,
          task.entityId,
          task.entityName,
          visualTraits
        );
        await incrementPaletteUsage(task.projectId, task.entityKind, visualTraits);
      }
    } catch (err) {
      console.warn("[Worker] Failed to register traits:", err);
    }

    const estimatedTotals = {
      estimatedCost: thesisCall.estimate.estimatedCost + traitsCall.estimate.estimatedCost,
      inputTokens: thesisCall.estimate.inputTokens + traitsCall.estimate.inputTokens,
      outputTokens: thesisCall.estimate.outputTokens + traitsCall.estimate.outputTokens,
    };

    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: "description" as CostType,
      model: thesisConfig.model,
      estimatedCost: estimatedTotals.estimatedCost,
      actualCost: totalActualCost,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });

    console.log(
      `[Worker] Visual thesis chain complete: ${totalInputTokens} in / ${totalOutputTokens} out, $${totalActualCost.toFixed(4)}`
    );

    return {
      success: true,
      result: {
        visualThesis,
        visualTraits,
        generatedAt: Date.now(),
        model: thesisConfig.model,
        estimatedCost: estimatedTotals.estimatedCost,
        actualCost: totalActualCost,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        chainDebug,
      },
      debug: traitsResult.debug,
    };
  },
} satisfies TaskHandler<WorkerTask & { type: "visualThesis" }>;
