/**
 * Motif Variation Worker Task
 *
 * Two modes:
 *   - **vary** (default): Rewrite annotation clauses containing overused phrases
 *   - **weave**: Rewrite sentences in descriptions to incorporate a target phrase
 *
 * The task payload's `prompt` field carries a JSON-serialized payload.
 * Results are returned as JSON in the EnrichmentResult.description field.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";

// ============================================================================
// Types — Vary mode (rewrite sentences containing overused phrases)
// ============================================================================

export interface MotifInstance {
  index: number;
  entityName: string;
  noteId: string;
  /** Full annotation text */
  annotationText: string;
  /** The exact phrase to vary */
  matchedPhrase: string;
}

export interface MotifVariationPayload {
  mode?: "vary";
  motifLabel: string;
  instances: MotifInstance[];
}

// ============================================================================
// Types — Weave mode (incorporate target phrase into sentences)
// ============================================================================

export interface MotifWeaveInstance {
  index: number;
  entityName: string;
  sentence: string;
  surroundingContext: string;
}

export interface MotifWeavePayload {
  mode: "weave";
  targetPhrase: string;
  instances: MotifWeaveInstance[];
}

// ============================================================================
// Shared result type
// ============================================================================

export interface MotifVariationResult {
  index: number;
  variant: string;
}

// ============================================================================
// Vary mode prompts
// ============================================================================

function buildVarySystemPrompt(motifLabel: string): string {
  return `You are a copy-editor revising a historian's encyclopedia margin annotations. The historian — a frost-scarred archivist working alone in Foundation Depths ice — has overused the phrase "${motifLabel}" across many entries. You receive the FULL annotation text for each instance so you can hear the historian's voice and understand the rhetorical flow.

Your job: rewrite ONLY the clause or sentence containing "${motifLabel}" so the phrase is gone but the meaning, rhythm, and voice survive. The rest of the annotation must remain unchanged.

Rules:
- Return the FULL annotation text with only the clause around "${motifLabel}" rewritten. Every other word stays exactly as written.
- The rewrite must read as if the historian wrote it this way originally. Match his cadence, his precision, his habit of self-interruption.
- Do NOT absorb, merge, or duplicate content from surrounding sentences into the rewritten clause. The adjacent sentences are staying — do not repeat them.
- Do NOT use generic duration substitutes ("enough time", "my tenure", "my career"). These are bureaucratic; the historian is not.
- Vary aggressively — never reuse the same approach across instances.
- Return ONLY a JSON array of objects with "index" (number) and "variant" (string), where variant is the full rewritten annotation. No other text.`;
}

function buildVaryUserPrompt(instances: MotifInstance[]): string {
  const lines = instances.map((inst) => {
    return `[${inst.index}] Entity: ${inst.entityName}\nPhrase to replace: "${inst.matchedPhrase}"\nFull annotation:\n${inst.annotationText}`;
  });
  return lines.join("\n\n---\n\n");
}

// ============================================================================
// Weave mode prompts
// ============================================================================

function buildWeaveSystemPrompt(targetPhrase: string): string {
  return `You are an editor reintroducing a thematic motif into a historian's encyclopedia entries. The phrase "${targetPhrase}" is the title motif of this work. It was editorially stripped during a revision pass and needs to be woven back into select sentences.

Rules:
- Rewrite each sentence to naturally incorporate the exact phrase "${targetPhrase}".
- The phrase should feel organic, not forced. If it reads as inserted, you have failed.
- Preserve the historian's voice: weary, precise, scholarly.
- Preserve the factual content of the original sentence.
- Keep roughly the same sentence length.
- Return ONLY a JSON array of objects with "index" (number) and "variant" (string). No other text.`;
}

function buildWeaveUserPrompt(instances: MotifWeaveInstance[]): string {
  const lines = instances.map((inst) => {
    const ctxTruncated =
      inst.surroundingContext.length > 300
        ? inst.surroundingContext.slice(0, 300) + "…"
        : inst.surroundingContext;
    return `[${inst.index}] Entity: ${inst.entityName}\nSentence: "${inst.sentence}"\nSurrounding context: ${ctxTruncated}`;
  });
  return lines.join("\n\n");
}

// ============================================================================
// Task Handler
// ============================================================================

function isWeavePayload(p: unknown): p is MotifWeavePayload {
  return typeof p === "object" && p !== null && (p as Record<string, unknown>).mode === "weave";
}

export const motifVariationTask = {
  type: "motifVariation" as const,

  async execute(task: WorkerTask, context: TaskContext): Promise<TaskResult> {
    const callConfig = getCallConfig(context.config, "historian.motifVariation");

    let payload: MotifVariationPayload | MotifWeavePayload;
    try {
      payload = JSON.parse(task.prompt);
    } catch {
      return { success: false, error: "Invalid motif variation payload" };
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (isWeavePayload(payload)) {
      if (!payload.instances || payload.instances.length === 0) {
        return { success: false, error: "No instances to weave" };
      }
      systemPrompt = buildWeaveSystemPrompt(payload.targetPhrase);
      userPrompt = buildWeaveUserPrompt(payload.instances);
    } else {
      if (!payload.instances || payload.instances.length === 0) {
        return { success: false, error: "No instances to vary" };
      }
      systemPrompt = buildVarySystemPrompt(payload.motifLabel);
      userPrompt = buildVaryUserPrompt(payload.instances);
    }

    const { result, usage } = await runTextCall({
      llmClient: context.llmClient,
      callType: "historian.motifVariation",
      callConfig,
      systemPrompt,
      prompt: userPrompt,
    });

    // Parse the JSON response
    const responseText = result.text.trim();
    // Strip markdown code fences if present
    // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text, stripping code fences
    const jsonText = responseText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

    let variants: MotifVariationResult[];
    try {
      variants = JSON.parse(jsonText);
    } catch {
      return {
        success: false,
        error: `Failed to parse LLM response as JSON: ${responseText.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      result: {
        description: JSON.stringify(variants),
        generatedAt: Date.now(),
        model: callConfig.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        actualCost: usage.actualCost,
      },
    };
  },
};
