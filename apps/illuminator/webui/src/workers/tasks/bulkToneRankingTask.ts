/**
 * Bulk Tone Ranking Worker Task
 *
 * Splits chronicles into batches of ~40 and makes one LLM call per batch.
 * Each batch is self-contained — the model sees ~40 chronicles and ranks
 * tones with awareness of how they compare to each other within the batch.
 *
 * Results are written to IndexedDB after each batch completes, so the UI
 * can track incremental progress via polling.
 *
 * Payload is JSON-serialized in the prompt field: an array of chronicle entries.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type { HistorianTone } from "../../lib/historianTypes";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { updateChronicleToneRanking } from "../../lib/db/chronicleRepository";

// ============================================================================
// Payload type
// ============================================================================

interface BulkChronicleEntry {
  chronicleId: string;
  title: string;
  format: string;
  narrativeStyleName?: string;
  summary: string;
  brief?: string;
}

const VALID_TONES = new Set<HistorianTone>([
  "witty",
  "weary",
  "elegiac",
  "cantankerous",
  "rueful",
  "conspiratorial",
  "bemused",
]);

const BATCH_TARGET_MIN = 35;
const BATCH_TARGET_MAX = 45;

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are an editor assigning annotation voices to a collection of chronicles. A historian will write margin notes on each chronicle — you are choosing which voice the historian uses for each one.

You have 7 voices. Each responds to a different quality in the text:

- **witty**: The text is funnier than it realizes.
- **weary**: This story has happened before in different names.
- **elegiac**: Something specific is gone forever.
- **cantankerous**: The text is wrong about something.
- **rueful**: Someone is making a mistake they cannot see.
- **conspiratorial**: The text is hiding something specific.
- **bemused**: This is genuinely weird.

## Assignment rules

For each chronicle, read its summary and brief, identify which quality is strongest in that specific text, and assign the voice that responds to it. Rank the top 3 voices.

**Account for every chronicle by number.** Your output must contain exactly one entry per input chronicle, in order. Do not skip any.

## Avoiding gravitational tones

In a dark setting, loss is universal, patterns repeat, people make mistakes, and everyone has secrets — so elegiac, weary, rueful, and conspiratorial are always partially true. They are the easiest assignments, not the best ones. Your job is to find what distinguishes each chronicle from the general atmosphere.

No single voice may appear as the primary (first-ranked) tone for more than 20% of the batch. If your first pass clusters on any tone, reread those chronicles and find what else is actually driving the text. Prefer witty, bemused, and cantankerous where they genuinely fit — they are underused because they require more specific observation.

A chronicle's format does not determine its voice. A broadsheet can be elegiac. An epic drama can be bemused. A creation myth can be witty. Read the content, not the genre.

## Thinking vs. output

Do your full analytical work in your thinking/reasoning. The JSON output is a record of your decisions, not an explanation of them.

Give equal analytical attention to the last chronicle as the first. If your reasoning is getting shorter or more formulaic toward the end, slow down and reread.

## Output format

Respond with ONLY a JSON array, one object per chronicle in input order. Each rationale is a **brief evidence tag** (5-15 words) naming the specific character, object, or structural device that drove the assignment — not an explanation.

[{ "id": 1, "ranking": ["tone1", "tone2", "tone3"], "rationales": { "tone1": "brief evidence tag", "tone2": "brief evidence tag", "tone3": "brief evidence tag" } }, ...]

Example rationale: "The Mask's bureaucratic sincerity treating body count as throughput"
NOT: "The Mask is funnier than it realizes because its absolute bureaucratic sincerity — cross-referencing grief profiles, noting deaths as an incidental data point — makes the body count a quality-assurance outcome. The comedy peaks when..."`;

function buildUserPrompt(entries: BulkChronicleEntry[]): string {
  const lines: string[] = [];
  lines.push(`${entries.length} chronicles:\n`);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    lines.push(`--- Chronicle ${i + 1}: ${e.title} ---`);
    lines.push(
      `Format: ${e.format}${e.narrativeStyleName ? " | Style: " + e.narrativeStyleName : ""}`
    );
    lines.push(`Summary: ${e.summary}`);
    if (e.brief) {
      lines.push(`Brief: ${e.brief}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Split an array into chunks of the given size */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Parse one batch response and write results to IndexedDB */
async function processBatchResponse(
  responseText: string,
  batchEntries: BulkChronicleEntry[],
  costPerChronicle: number
): Promise<{ successCount: number; failCount: number }> {
  /* eslint-disable sonarjs/slow-regex -- bounded LLM response text, stripping code fences */
  const jsonText = responseText
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  /* eslint-enable sonarjs/slow-regex */

  let parsed: Array<{ id: number; ranking: string[]; rationales?: Record<string, string> }>;
  try {
    parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error("Expected array");
  } catch {
    console.error("[BulkToneRanking] Failed to parse batch response:", responseText.slice(0, 500));
    return { successCount: 0, failCount: batchEntries.length };
  }

  let successCount = 0;
  let failCount = 0;

  for (const item of parsed) {
    const idx = (item.id ?? 0) - 1;
    const entry = batchEntries[idx];
    if (!entry) {
      failCount++;
      continue;
    }

    const validRanking = (item.ranking || []).filter((t) => VALID_TONES.has(t as HistorianTone));
    if (validRanking.length < 3) {
      failCount++;
      continue;
    }

    const ranking = validRanking.slice(0, 3) as [string, string, string];
    const rationales = item.rationales || {};
    const rationale = rationales[ranking[0]] || "";

    try {
      await updateChronicleToneRanking(
        entry.chronicleId,
        ranking,
        rationale,
        costPerChronicle,
        rationales
      );
      successCount++;
    } catch (err) {
      console.error(`[BulkToneRanking] Failed to write ${entry.chronicleId}:`, err);
      failCount++;
    }
  }

  return { successCount, failCount };
}

// ============================================================================
// Task Handler
// ============================================================================

export const bulkToneRankingTask = {
  type: "bulkToneRanking" as const,

  async execute(task: WorkerTask, context: TaskContext): Promise<TaskResult> {
    const callConfig = getCallConfig(context.config, "chronicle.bulkToneRanking");

    let entries: BulkChronicleEntry[];
    try {
      entries = JSON.parse(task.prompt);
      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error("Expected non-empty array");
      }
    } catch {
      return { success: false, error: "Invalid bulk tone ranking payload" };
    }

    // Dynamic batch size: pick n batches so each has 35-45 entries
    const n = Math.max(1, Math.round(entries.length / ((BATCH_TARGET_MIN + BATCH_TARGET_MAX) / 2)));
    const batchSize = Math.ceil(entries.length / n);
    const batches = chunk(entries, batchSize);
    let totalSuccess = 0;
    let totalFail = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    console.log(
      `[BulkToneRanking] Processing ${entries.length} chronicles in ${batches.length} batch(es) of ~${batchSize}`
    );

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      if (context.isAborted()) {
        return {
          success: true,
          result: {
            description: `Aborted after ${totalSuccess} chronicles (batch ${batchIdx}/${batches.length})`,
            generatedAt: Date.now(),
            model: callConfig.model,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            actualCost: totalCost,
          },
        };
      }

      const batch = batches[batchIdx];
      console.log(
        `[BulkToneRanking] Batch ${batchIdx + 1}/${batches.length}: ${batch.length} chronicles`
      );

      const userPrompt = buildUserPrompt(batch);

      const { result, usage } = await runTextCall({
        llmClient: context.llmClient,
        callType: "chronicle.bulkToneRanking",
        callConfig,
        systemPrompt: SYSTEM_PROMPT,
        prompt: userPrompt,
      });

      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCost += usage.actualCost;

      const costPerChronicle = usage.actualCost / batch.length;
      const batchResult = await processBatchResponse(result.text, batch, costPerChronicle);

      totalSuccess += batchResult.successCount;
      totalFail += batchResult.failCount;

      console.log(
        `[BulkToneRanking] Batch ${batchIdx + 1} done: ${batchResult.successCount} success, ${batchResult.failCount} failed`
      );
    }

    return {
      success: true,
      result: {
        description: `Ranked ${totalSuccess}/${entries.length} chronicles in ${batches.length} batch(es) (${totalFail} failed)`,
        generatedAt: Date.now(),
        model: callConfig.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        actualCost: totalCost,
      },
    };
  },
};
