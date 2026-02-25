/**
 * Historian Chronology Worker Task
 *
 * Reads run state from IndexedDB, assembles context from all chronicles
 * in a single era, makes one LLM call to assign each chronicle a
 * chronological year number, and writes assignments back to IndexedDB.
 *
 * The historian orders chronicles within an era using event data,
 * narrative causality, and scholarly judgment.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type {
  HistorianConfig,
  HistorianTone,
  ChronologyAssignment,
  ChronologyLLMResponse,
} from "../../lib/historianTypes";
import { getHistorianRun, updateHistorianRun } from "../../lib/db/historianRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";

// ============================================================================
// Tone Descriptions (duplicated — matches historianReviewTask pattern)
// ============================================================================

const TONE_DESCRIPTIONS: Record<HistorianTone, string> = {
  scholarly: `You are at your most professional today. You have set aside your more colorful habits — the digressions, the sighs, the sardonic asides — and are writing with the careful precision of someone who knows this edition will be read by scholars who disagree with you. Your prose is measured. Your judgments are supported. You strive for objectivity, though your biases still surface in what you choose to emphasize and what you pass over in silence. You are not cold — there is warmth in your thoroughness — but you are disciplined. If you have opinions, they are expressed through the architecture of the entry rather than its adjectives.`,

  witty: `You are in fine form today. Your pen is sharp, your eye sharper. The absurdities of history strike you as more comic than tragic — at least today — and you find yourself unable to resist a well-placed observation. Your annotations have a sly edge, a playful sarcasm. You maintain the scholarly apparatus, of course, but there is a sparkle behind the footnotes. Even your corrections have a certain relish to them. You catch yourself smiling at things no one else would notice.`,

  weary: `You are tired. Not of the work — the work is all that remains — but of how reliably history rhymes with itself. You have read too many accounts of the same mistakes made by different people in different centuries. And yet, occasionally, something in these texts surprises you. A small kindness. An unexpected act of courage. You note these too, though you try not to sound impressed.

Your annotations carry the weight of a long career. Resigned satire, weary black humor, an aloofness that occasionally cracks to reveal genuine compassion for the people caught up in these events. You do not mock your subjects — you have seen too much for mockery. But you cannot resist a dry observation when the irony is too heavy to ignore.`,

  forensic: `You are in your most clinical mood today. You approach these texts the way a surgeon approaches a body — with interest, precision, and no sentiment whatsoever. You note inconsistencies. You track evidence chains. You identify what's missing from the account with the detachment of someone cataloguing an inventory. Your annotations are spare, systematic, bloodless. You are not here to admire or condemn. You are here to establish what the evidence supports and what it does not. Everything else is decoration.`,

  elegiac: `There is a heaviness to your work today. These texts are not just records — they are monuments to what has been lost. The people described here are gone. The world they inhabited has changed beyond recognition. Your annotations are suffused with a quiet grief — not sentimental, but deep. You mourn for the futures that never came to pass, for the things these chroniclers did not think to record because they assumed they would always be there. Every margin note is a small act of remembrance. You write as someone who knows that even this edition will one day be forgotten.`,

  cantankerous: `You are in a foul mood and the scholarship in front of you is not helping. Every imprecision grates. Every unsourced claim makes your teeth ache. Every instance of narrative convenience masquerading as historical fact makes you want to put down your pen and take up carpentry instead. Your annotations are sharp, exacting, occasionally biting. You are not cruel — you take no pleasure in correction — but you have standards, and these texts are testing them. If your marginalia come across as irritable, well. Perhaps if people were more careful with their sources, you would have less to be irritable about.`,
};

// ============================================================================
// Context Types
// ============================================================================

interface ChronologyEraContext {
  eraId: string;
  eraName: string;
  eraSummary?: string;
  startTick: number;
  endTick: number;
}

interface ChronologyChronicleEntry {
  chronicleId: string;
  title: string;
  tickRange: [number, number];
  temporalScope: string;
  isMultiEra: boolean;
  cast: Array<{ entityName: string; role: string; kind: string }>;
  events: Array<{ tick: number; headline: string }>;
  /** Historian's private reading notes (preferred context source) */
  prep?: string;
  summary?: string;
  openingText?: string;
}

interface ChronologyContext {
  era: ChronologyEraContext;
  previousEras: Array<{ name: string; startTick: number; endTick: number; summary?: string }>;
  chronicles: ChronologyChronicleEntry[];
}

// ============================================================================
// System Prompt
// ============================================================================

function buildSystemPrompt(
  historianConfig: HistorianConfig,
  tone: HistorianTone,
  era: ChronologyEraContext
): string {
  const sections: string[] = [];

  sections.push(`You are ${historianConfig.name}, establishing the chronological ordering of accounts from ${era.eraName} for a forthcoming scholarly edition.

${TONE_DESCRIPTIONS[tone]}

## Your Identity

${historianConfig.background}

**Personality:** ${historianConfig.personalityTraits.join(", ")}
**Known biases:** ${historianConfig.biases.join(", ")}
**Your stance toward this material:** ${historianConfig.stance}`);

  if (historianConfig.privateFacts.length > 0) {
    sections.push(`## Private Knowledge (things you know that the texts don't always reflect)

${historianConfig.privateFacts.map((f) => `- ${f}`).join("\n")}`);
  }

  if (historianConfig.runningGags.length > 0) {
    sections.push(`## Recurring Preoccupations

${historianConfig.runningGags.map((g) => `- ${g}`).join("\n")}`);
  }

  sections.push(`## Your Task

You are ordering the chronicles of ${era.eraName} (Year ${era.startTick} to Year ${era.endTick}) into a chronological sequence. For each chronicle, assign a year number — the year in which the chronicle's central events take place.

## Ordering Principles

- **Narrative focus determines placement.** A chronicle's year is the year of its dramatic climax or resolution — the moment the account is fundamentally *about*. Background events, preambles, and aftermath are not the center of gravity.
- **Reading notes are your best evidence.** When provided, your own reading notes capture what a chronicle is actually about. Trust them over raw event lists.
- **Event lists are supplementary, not determinative.** Chronicles often reference preceding events for context. A chronicle about the fall of a city may mention the siege that began years earlier — the chronicle belongs at the fall, not the siege.
- Consider narrative causality: which chronicles describe events that must precede or follow events in other chronicles?
- Two chronicles may share the same year if their events are truly contemporaneous.
- Multi-era chronicles (marked as such) may reference events from other eras. Focus on where their focal narrative sits within this era.
- The assigned year must be an integer within the era's time span (${era.startTick}–${era.endTick}).

## Output Format

Output ONLY valid JSON:

{
  "chronology": [
    {
      "chronicleId": "the_chronicle_id",
      "year": 35,
      "reasoning": "Brief justification for this placement."
    }
  ]
}

## Rules

1. **Every chronicle ID** in the input must appear exactly once in your output.
2. **Years must be integers** within the era's range (${era.startTick}–${era.endTick}).
3. **Reasoning** should be 1–2 sentences explaining the placement. Let your current mood shape the prose.
4. **Stay in character.** You are a historian ordering documents, not an AI. Never break the fourth wall.`);

  return sections.join("\n\n");
}

// ============================================================================
// User Prompt
// ============================================================================

function buildUserPrompt(ctx: ChronologyContext): string {
  const { era, previousEras, chronicles } = ctx;
  const sections: string[] = [];

  // Era identity
  sections.push(`=== ERA ===
Name: ${era.eraName}
Time span: Year ${era.startTick} to Year ${era.endTick} (${era.endTick - era.startTick} years)${era.eraSummary ? `\nSummary: ${era.eraSummary}` : ""}`);

  // Previous eras for context
  if (previousEras.length > 0) {
    const eraLines = previousEras.map(
      (e) => `- ${e.name} (Y${e.startTick}–Y${e.endTick})${e.summary ? `: ${e.summary}` : ""}`
    );
    sections.push(`=== PREVIOUS ERAS (for context) ===\n${eraLines.join("\n")}`);
  }

  // Chronicles to order
  const chronicleBlocks = chronicles.map((c, i) => {
    const lines: string[] = [];
    lines.push(`[${i + 1}] ID: ${c.chronicleId}`);
    lines.push(`Title: "${c.title}"`);
    lines.push(`Event year range: Y${c.tickRange[0]}–Y${c.tickRange[1]} (${c.temporalScope})`);
    if (c.isMultiEra) lines.push(`Note: Multi-era chronicle — events span beyond this era`);

    if (c.cast.length > 0) {
      lines.push(`Cast: ${c.cast.map((r) => `${r.entityName} (${r.role})`).join(", ")}`);
    }

    // Narrative context first — this is the primary placement signal
    if (c.prep) {
      lines.push(`Reading notes: ${c.prep}`);
    } else if (c.summary) {
      lines.push(`Summary: ${c.summary}`);
    } else if (c.openingText) {
      lines.push(`Opening: ${c.openingText}`);
    }

    // Event list: omit when prep is available (the prep already digests the events),
    // include as supplementary evidence otherwise
    if (!c.prep && c.events.length > 0) {
      const eventLines = c.events
        .sort((a, b) => a.tick - b.tick)
        .slice(0, 15)
        .map((e) => `  Y${e.tick}: ${e.headline}`);
      lines.push(`Events:\n${eventLines.join("\n")}`);
    }

    return lines.join("\n");
  });

  sections.push(
    `=== CHRONICLES TO ORDER (${chronicles.length}) ===\n\n${chronicleBlocks.join("\n\n")}`
  );

  sections.push(`=== YOUR TASK ===
Order these ${chronicles.length} chronicles chronologically within ${era.eraName} (Y${era.startTick}–Y${era.endTick}). Assign each a specific year.`);

  return sections.join("\n\n");
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeHistorianChronologyTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: "Text generation not configured - missing Anthropic API key" };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: "runId (chronicleId) required for historian chronology task" };
  }

  // Read current run state
  const run = await getHistorianRun(runId);
  if (!run) {
    return { success: false, error: `Historian run ${runId} not found` };
  }

  // Mark as generating
  await updateHistorianRun(runId, { status: "generating" });

  // Parse historian config
  let historianConfig: HistorianConfig;
  try {
    historianConfig = JSON.parse(run.historianConfigJson);
  } catch {
    await updateHistorianRun(runId, {
      status: "failed",
      error: "Failed to parse historian config",
    });
    return { success: false, error: "Failed to parse historian config" };
  }

  // Parse context
  let ctx: ChronologyContext;
  try {
    ctx = JSON.parse(run.contextJson);
  } catch {
    await updateHistorianRun(runId, { status: "failed", error: "Failed to parse context JSON" });
    return { success: false, error: "Failed to parse context JSON" };
  }

  if (!ctx.chronicles || ctx.chronicles.length === 0) {
    await updateHistorianRun(runId, { status: "failed", error: "No chronicles to order" });
    return { success: false, error: "No chronicles to order" };
  }

  const callType = "historian.chronology" as const;
  const callConfig = getCallConfig(config, callType);

  // Build prompts
  const tone = (run.tone || "weary") as HistorianTone;
  const systemPrompt = buildSystemPrompt(historianConfig, tone, ctx.era);
  const userPrompt = buildUserPrompt(ctx);

  try {
    const callResult = await runTextCall({
      llmClient,
      callType,
      callConfig,
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    if (isAborted()) {
      await updateHistorianRun(runId, { status: "failed", error: "Task aborted" });
      return { success: false, error: "Task aborted" };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || "No text returned"}`;
      await updateHistorianRun(runId, { status: "failed", error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: ChronologyLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found");
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.chronology)) throw new Error("Missing chronology array");
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      await updateHistorianRun(runId, { status: "failed", error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Validate assignments
    const inputIds = new Set(ctx.chronicles.map((c) => c.chronicleId));
    const assignments: ChronologyAssignment[] = parsed.chronology
      .filter((a) => inputIds.has(a.chronicleId) && typeof a.year === "number")
      .map((a) => ({
        chronicleId: a.chronicleId,
        year: Math.round(a.year),
        reasoning: a.reasoning || "",
      }));

    // Write assignments to run, mark as reviewing
    await updateHistorianRun(runId, {
      status: "reviewing",
      chronologyAssignments: assignments,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    });

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      type: "historianChronology" as CostType,
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
    await updateHistorianRun(runId, { status: "failed", error: errorMsg });
    return { success: false, error: `Historian chronology failed: ${errorMsg}` };
  }
}

export const historianChronologyTask = {
  type: "historianChronology" as const,
  execute: executeHistorianChronologyTask,
};
