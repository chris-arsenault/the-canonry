/**
 * Fact Coverage Analysis Worker Task
 *
 * Sends a chronicle's narrative text + all canon facts to Haiku,
 * gets per-fact presence ratings (missing/mentioned/prevalent/integral),
 * and writes results to the chronicle record.
 *
 * Payload is JSON-serialized in the prompt field.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type {
  FactCoverageEntry,
  FactCoverageRating,
  FactCoverageReport,
} from "../../lib/chronicleTypes";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { getChronicle, updateChronicleFactCoverage } from "../../lib/db/chronicleRepository";

// ============================================================================
// Payload type (JSON in prompt field)
// ============================================================================

interface FactCoveragePayload {
  chronicleId: string;
  narrativeText: string;
  facts: Array<{ id: string; text: string }>;
}

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a literary analyst assessing how thoroughly a narrative text incorporates specific world-building facts. For each fact, rate its presence in the text.

Ratings:
- **missing**: The fact is not referenced, implied, or reflected in the text at all.
- **mentioned**: The fact is briefly touched on, alluded to indirectly, or present only as background assumption. A careful reader might notice it.
- **prevalent**: The fact meaningfully shapes part of the narrative — it influences events, character behavior, or setting details in a visible way.
- **integral**: The fact is central to the narrative. Remove it and the story would not work.

Rules:
- Judge based on the narrative content, not what you think should be there.
- A fact can be "prevalent" even if the exact wording never appears — what matters is whether the concept drives the text.
- Be precise in your evidence: quote or reference specific passages.
- Return ONLY a JSON array of objects with "factId" (string), "rating" (string), and "evidence" (string, 1 sentence max). No other text.`;

function buildUserPrompt(
  facts: Array<{ id: string; text: string }>,
  narrativeText: string
): string {
  const factLines = facts.map((f, i) => `[${i + 1}] ${f.id}: ${f.text}`);
  return `=== FACTS TO ASSESS ===\n${factLines.join("\n")}\n\n=== NARRATIVE TEXT ===\n${narrativeText}`;
}

const VALID_RATINGS = new Set<FactCoverageRating>([
  "missing",
  "mentioned",
  "prevalent",
  "integral",
]);

// ============================================================================
// Task Handler
// ============================================================================

export const factCoverageTask = {
  type: "factCoverage" as const,

  async execute(task: WorkerTask, context: TaskContext): Promise<TaskResult> {
    const callConfig = getCallConfig(context.config, "chronicle.factCoverage");

    let payload: FactCoveragePayload;
    try {
      payload = JSON.parse(task.prompt);
    } catch {
      return { success: false, error: "Invalid fact coverage payload" };
    }

    if (!payload.chronicleId || !payload.narrativeText || !payload.facts?.length) {
      return { success: false, error: "Missing required fields in fact coverage payload" };
    }

    const userPrompt = buildUserPrompt(payload.facts, payload.narrativeText);

    const { result, usage } = await runTextCall({
      llmClient: context.llmClient,
      callType: "chronicle.factCoverage",
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    // Parse the JSON response
    const responseText = result.text.trim();
    const jsonText = responseText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

    let rawEntries: Array<{ factId: string; rating: string; evidence: string }>;
    try {
      rawEntries = JSON.parse(jsonText);
      if (!Array.isArray(rawEntries)) throw new Error("Expected array");
    } catch {
      return {
        success: false,
        error: `Failed to parse LLM response as JSON: ${responseText.slice(0, 200)}`,
      };
    }

    // Load chronicle to check which facts were in the faceted set
    const chronicle = await getChronicle(payload.chronicleId);
    const facetedIds = new Set(
      (chronicle?.perspectiveSynthesis?.facets ?? []).map((f: { factId: string }) => f.factId)
    );

    // Build fact lookup for text
    const factTextMap = new Map(payload.facts.map((f) => [f.id, f.text]));

    // Validate and enrich entries
    const entries: FactCoverageEntry[] = rawEntries
      .filter((e) => e.factId && VALID_RATINGS.has(e.rating as FactCoverageRating))
      .map((e) => ({
        factId: e.factId,
        factText: factTextMap.get(e.factId) ?? "",
        rating: e.rating as FactCoverageRating,
        evidence: e.evidence || "",
        wasFaceted: facetedIds.has(e.factId),
      }));

    const report: FactCoverageReport = {
      entries,
      model: callConfig.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      actualCost: usage.actualCost,
    };

    // Write to chronicle record
    await updateChronicleFactCoverage(payload.chronicleId, report);

    return {
      success: true,
      result: {
        description: JSON.stringify({ entriesCount: entries.length }),
        generatedAt: Date.now(),
        model: callConfig.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        actualCost: usage.actualCost,
      },
    };
  },
};
