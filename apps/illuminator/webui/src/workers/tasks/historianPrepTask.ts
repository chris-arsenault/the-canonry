/**
 * Historian Prep Worker Task
 *
 * Generates private reading notes for a chronicle in the historian's voice.
 * These are the notes a scholar makes while preparing to write a larger work —
 * key observations, thematic threads, cast dynamics, notable tensions.
 *
 * Output is plain text (300-500 words), stored directly on ChronicleRecord.
 * No review workflow — writes directly like summary generation.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type { HistorianConfig, HistorianTone } from "../../lib/historianTypes";
import { isNoteActive } from "../../lib/historianTypes";
import { getChronicle, updateChronicleHistorianPrep } from "../../lib/db/chronicleRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";

// ============================================================================
// Tone Descriptions (duplicated — locality over DRY, matches other historian tasks)
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
// System Prompt
// ============================================================================

function buildSystemPrompt(historianConfig: HistorianConfig, tone: HistorianTone): string {
  const sections: string[] = [];

  sections.push(`You are ${historianConfig.name}, preparing reading notes for your personal files. These are NOT for publication — they are the private notes a scholar makes while working through source material in preparation for a larger work.

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

Write private reading notes for the chronicle below. These are the jottings you make in the margins of your own working copy — observations you want to remember when you sit down to write a broader narrative history of this era.

**What to include:**
- Key thematic threads and how they connect to the era's larger story
- Cast dynamics — who drives the action, who is acted upon, who is absent but felt
- Notable tensions, ironies, or contradictions worth remembering
- Details that surprised you, moved you, or struck you as significant
- Connections to other chronicles you've read (if they come to mind naturally)
- Things the chronicler got wrong, or right, or failed to notice

**What NOT to include:**
- Plot summary (you have the chronicle itself for that)
- Formal annotations or footnotes (you've already written those separately)
- Anything performative — no one will read these but you

**Format:** Plain prose, 300-500 words. Write as you actually think — shorthand is fine, incomplete sentences are fine, personal asides are fine. These are notes, not an essay.

**Stay in character.** You are a historian reviewing primary sources. Never break the fourth wall.`);

  return sections.join("\n\n");
}

// ============================================================================
// User Prompt
// ============================================================================

function buildUserPrompt(chronicle: {
  title: string;
  format: string;
  focalEraName?: string;
  eraYear?: number;
  content: string;
  summary?: string;
  roleAssignments: Array<{
    entityName: string;
    isPrimary: boolean;
    roleName?: string;
    entityKind?: string;
  }>;
  historianNotes?: Array<{ text: string; enabled?: boolean; resolvedAt?: number }>;
}): string {
  const sections: string[] = [];

  // Chronicle identity
  const eraInfo = chronicle.focalEraName
    ? ` | Era: ${chronicle.focalEraName}${chronicle.eraYear ? ` (Year ${chronicle.eraYear})` : ""}`
    : "";
  sections.push(`=== CHRONICLE ===
Title: "${chronicle.title}"
Format: ${chronicle.format}${eraInfo}`);

  // Cast
  if (chronicle.roleAssignments.length > 0) {
    const castLines = chronicle.roleAssignments.map((r) => {
      const role = r.roleName || (r.isPrimary ? "primary" : "supporting");
      return `- ${r.entityName} (${role}${r.entityKind ? `, ${r.entityKind}` : ""})`;
    });
    sections.push(`=== CAST ===\n${castLines.join("\n")}`);
  }

  // Summary
  if (chronicle.summary) {
    sections.push(`=== SUMMARY ===\n${chronicle.summary}`);
  }

  // Content (truncated if very long)
  const maxContentWords = 3000;
  const words = chronicle.content.split(/\s+/);
  const truncated = words.length > maxContentWords;
  const contentText = truncated
    ? words.slice(0, maxContentWords).join(" ") + "\n\n[... remainder truncated for brevity ...]"
    : chronicle.content;
  sections.push(
    `=== CHRONICLE TEXT${truncated ? ` (first ~${maxContentWords} words of ${words.length})` : ""} ===\n${contentText}`
  );

  // Historian notes (if any accepted ones exist)
  const activeNotes = (chronicle.historianNotes || []).filter(isNoteActive);
  if (activeNotes.length > 0) {
    const noteLines = activeNotes.map((n) => `- ${n.text}`);
    sections.push(`=== YOUR PREVIOUS MARGIN NOTES ON THIS CHRONICLE ===\n${noteLines.join("\n")}`);
  }

  sections.push(`=== YOUR TASK ===
Write your private reading notes for this chronicle. 300-500 words.`);

  return sections.join("\n\n");
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeHistorianPrepTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: "Text generation not configured - missing Anthropic API key" };
  }

  const chronicleId = task.chronicleId;
  if (!chronicleId) {
    return { success: false, error: "chronicleId required for historian prep task" };
  }

  // Read chronicle record
  const chronicle = await getChronicle(chronicleId);
  if (!chronicle) {
    return { success: false, error: `Chronicle ${chronicleId} not found` };
  }

  const content = chronicle.finalContent || chronicle.assembledContent || "";
  if (!content) {
    return { success: false, error: "Chronicle has no content to prep" };
  }

  // Parse historian config from task prompt (JSON-encoded)
  let historianConfig: HistorianConfig;
  let tone: HistorianTone;
  try {
    const prepConfig = JSON.parse(task.prompt);
    historianConfig = prepConfig.historianConfig;
    tone = prepConfig.tone || "weary";
  } catch {
    return { success: false, error: "Failed to parse historian prep config from task prompt" };
  }

  const callType = "historian.prep" as const;
  const callConfig = getCallConfig(config, callType);

  const systemPrompt = buildSystemPrompt(historianConfig, tone);
  const userPrompt = buildUserPrompt({
    title: chronicle.title,
    format: chronicle.format,
    focalEraName: chronicle.temporalContext?.focalEra?.name,
    eraYear: chronicle.eraYear,
    content,
    summary: chronicle.summary,
    roleAssignments: chronicle.roleAssignments || [],
    historianNotes: chronicle.historianNotes,
  });

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
      return { success: false, error: "Task aborted" };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      return {
        success: false,
        error: `LLM call failed: ${callResult.result.error || "No text returned"}`,
      };
    }

    // Write directly to chronicle record
    await updateChronicleHistorianPrep(chronicleId, resultText);

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      chronicleId,
      type: "historianPrep" as CostType,
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
    return { success: false, error: `Historian prep failed: ${errorMsg}` };
  }
}

export const historianPrepTask = {
  type: "historianPrep" as const,
  execute: executeHistorianPrepTask,
};
