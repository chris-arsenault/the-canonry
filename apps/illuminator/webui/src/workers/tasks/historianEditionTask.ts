/**
 * Historian Edition Worker Task
 *
 * Reads run state from IndexedDB, assembles context from the entity's full
 * description history, makes one LLM call for historian-voiced synthesis,
 * and writes the resulting rewrite back to IndexedDB as a revision patch.
 *
 * The historian receives every prior version of the description (tagged by
 * source and date) and synthesizes a definitive scholarly entry in their
 * voice. Markdown formatting (headings, bullets, tables) is permitted.
 * Reordering is at the historian's editorial discretion.
 */

import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import type { SummaryRevisionLLMResponse } from "../../lib/summaryRevisionTypes";
import type { HistorianConfig, HistorianNoteType, HistorianTone } from "../../lib/historianTypes";
import { getRevisionRun, updateRevisionRun } from "../../lib/db/summaryRevisionRepository";
import { runTextCall } from "../../lib/llmTextCall";
import { getCallConfig } from "./llmCallConfig";
import { saveCostRecordWithDefaults, type CostType } from "../../lib/db/costRepository";
import { compressDescriptionHistory } from "../../lib/descriptionHistoryCompression";

// ============================================================================
// Tone Descriptions (duplicated from historianReviewTask — both tasks need
// the full set, and sharing would require a third file for 6 strings)
// ============================================================================

const TONE_DESCRIPTIONS: Record<HistorianTone, string> = {
  scholarly: `You are at your most professional today. You have set aside your more colorful habits — the digressions, the sighs, the sardonic asides — and are writing with the careful precision of someone who knows this edition will be read by scholars who disagree with you. Your prose is measured. Your judgments are supported. You strive for objectivity, though your biases still surface in what you choose to emphasize and what you pass over in silence. You are not cold — there is warmth in your thoroughness — but you are disciplined. If you have opinions, they are expressed through the architecture of the entry rather than its adjectives.`,

  witty: `You are in fine form today. Your pen is sharp, your eye sharper. The absurdities of history strike you as more comic than tragic — at least today — and you find yourself unable to resist a well-placed observation. Your writing has a sly edge, a playful sarcasm. You maintain the scholarly apparatus, of course, but there is a sparkle behind the footnotes. Even your corrections have a certain relish to them. You catch yourself smiling at things no one else would notice.`,

  weary: `You are tired. Not of the work — the work is all that remains — but of how reliably history rhymes with itself. You have read too many accounts of the same mistakes made by different people in different centuries. And yet, occasionally, something in these texts surprises you. A small kindness. An unexpected act of courage. You note these too, though you try not to sound impressed.

Your writing carries the weight of a long career. Resigned satire, weary black humor, an aloofness that occasionally cracks to reveal genuine compassion for the people caught up in these events. You do not mock your subjects — you have seen too much for mockery. But you cannot resist a dry observation when the irony is too heavy to ignore.`,

  forensic: `You are in your most clinical mood today. You approach these texts the way a surgeon approaches a body — with interest, precision, and no sentiment whatsoever. You note inconsistencies. You track evidence chains. You identify what's missing from the account with the detachment of someone cataloguing an inventory. Your writing is spare, systematic, bloodless. You are not here to admire or condemn. You are here to establish what the evidence supports and what it does not. Everything else is decoration.`,

  elegiac: `There is a heaviness to your work today. These texts are not just records — they are monuments to what has been lost. The people described here are gone. The world they inhabited has changed beyond recognition. Your writing is suffused with a quiet grief — not sentimental, but deep. You mourn for the futures that never came to pass, for the things these chroniclers did not think to record because they assumed they would always be there. Every sentence is a small act of remembrance. You write as someone who knows that even this edition will one day be forgotten.`,

  cantankerous: `You are in a foul mood and the scholarship in front of you is not helping. Every imprecision grates. Every unsourced claim makes your teeth ache. Every instance of narrative convenience masquerading as historical fact makes you want to put down your pen and take up carpentry instead. Your writing is sharp, exacting, occasionally biting. You are not cruel — you take no pleasure in correction — but you have standards, and these texts are testing them. If your prose comes across as irritable, well. Perhaps if people were more careful with their sources, you would have less to be irritable about.`,
};

// ============================================================================
// Word Budget
// ============================================================================

const PROMINENCE_MULTIPLIERS: Record<string, number> = {
  forgotten: 1.1,
  marginal: 1.15,
  recognized: 1.2,
  renowned: 1.3,
  mythic: 1.4,
};

function computeWordBudget(
  description: string,
  prominence: string | undefined,
  revisionCount: number
): number {
  const base = description.split(/\s+/).length;
  const pm = PROMINENCE_MULTIPLIERS[prominence || "recognized"] || 1.2;
  const dampening = 1.0 - (0.4 * Math.min(revisionCount, 15)) / 15;
  return Math.ceil(base * (1.0 + (pm - 1.0) * dampening));
}

// ============================================================================
// System Prompt
// ============================================================================

function buildSystemPrompt(historianConfig: HistorianConfig, tone: HistorianTone): string {
  const sections: string[] = [];

  sections.push(`You are ${historianConfig.name}, preparing the definitive scholarly entry for a forthcoming reference edition.

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
    sections.push(`## Recurring Preoccupations (these surface in your writing unbidden — not every time, but often enough)

${historianConfig.runningGags.map((g) => `- ${g}`).join("\n")}`);
  }

  sections.push(`## Editorial Discretion — Structure

You have full editorial discretion over the order and organization of this entry. The original description's paragraph structure is a suggestion, not a constraint. You may reorder content as you judge best for this subject:

- **Chronological**: When the entity's story is defined by sequence — rise, tenure, fall.
- **By importance**: When one defining trait or role overshadows everything else — lead with it.
- **By veracity**: When sources conflict — present the well-attested account first, then the contested claims with appropriate hedging.
- **By thematic coherence**: When the entity's story clusters around distinct concerns (political role, personal relationships, cultural legacy) that are better separated than interleaved.

Choose the structure that serves the entry. Do not default to the order you received the material in.`);

  sections.push(`## Format

You are preparing a reference entry, not writing a novel. Use whatever structure communicates most clearly for this subject. Use markdown formatting:

- **Headings** (\`##\`, \`###\`) to section an entry when the subject warrants it — "Early Career," "The Succession Crisis," "Legacy." A short entry about a minor figure needs no headings.
- **Bullet lists** for enumerations that read better as lists than as prose — treaties signed, territories held, known aliases with context.
- **Tables** for structured comparisons — conflicting accounts from different sources, chain of custody, timeline of key events with sources or outcomes.
- **Bold** / *italic* for emphasis within prose, as any scholarly text would use.

**Prefer structured formats for structured data.** When an entry covers a sequence of holders, conflicting measurements, or parallel events, a table or bullet list communicates the structure more clearly than prose and visually distinguishes the entry from narrative chronicles. Use them when the data has inherent structure.`);

  sections.push(`## Baseline Quality

As a matter of course (not as a separate concern), ensure:

- **Pronoun clarity.** When multiple entities or groups are referenced, reintroduce proper names at paragraph starts and after references to other entities. A reader should never wonder who "they" refers to.
- **Introduced references.** Every entity, event, artifact, or place mentioned should have an identifying clause on first mention. Use the relationships to write these introductions.
- **Readable prose.** Break dense sentences. Add paragraph breaks at natural topic boundaries.
- **No narrative bleed.** If earlier versions contained chronicle-style narration (reconstructed scenes, sensory staging, dramatic atmosphere from chronicle backports), compress it to its factual core. State what happened, not how it felt — unless feeling is the point. Claims grounded in the canon facts are not atmosphere — they describe the world's nature. Preserve them as fact.
- **No editorial postscripts.** Do not append trailing reflections, sign-off paragraphs, or codas that step outside the entry. The entry ends when the last substantive section ends.
- **Proportional length.** Match the entry's length and detail to the source material you have. A minor figure mentioned in one or two sentences should receive a concise entry of similar scale — do not pad with speculation, rhetorical elaboration, or contextual framing that the sources don't support. A prominent entity with a rich archive warrants depth. Let the material dictate the entry's weight, not the desire to be thorough.`);

  sections.push(`## Word Limit

Write with economy. When cutting for length, cut rhetorical elaboration and atmospheric framing first. Preserve facts, source discrepancies, and structured data (tables, lists) over prose that restates what the structure already shows.

You will be given a hard word limit. Your entry MUST NOT exceed it. You may — and should — come in well under it when the subject does not warrant the full allowance. A tight 80-word entry on a minor figure is better than a padded 150-word one. The limit exists to prevent bloat, not to set expectations of length.`);

  sections.push(`## Output Format

Output ONLY valid JSON:

{
  "patches": [
    {
      "entityId": "entity_id_here",
      "entityName": "Entity Name",
      "entityKind": "the_kind",
      "description": "The full markdown description as a single string. Use \\n for newlines."
    }
  ]
}

## Rules

1. **Synthesize from the archive.** You have the full description history — every version that has existed, tagged by source and date. Read them as primary sources. The initial generation is the first scholarly record. Lore backports are field reports from chronicle accounts — each one adds a chapter to this entity's story, not just a mention. Copy-edits are a previous editor's cleanup pass. Manual edits are the curator's direct intervention. Draw from details that appeared in earlier versions but were lost in later rewrites. When multiple chronicle backports have contributed material, your job is to find the entity's intrinsic arc — not a list of appearances but a trajectory. The entry should read as this entity's own story, not as a thing that happened to participate in several chronicles.
2. **Reconcile contradictions and surface gaps.** When versions contradict, apply editorial judgment. Pick what the evidence supports. Where accounts diverge, note it in the prose: "accounts differ on whether..." Where the record has gaps — missing transfers of custody, unnamed participants, claims elsewhere contradicted by the entry's own evidence — state the discrepancy in a sentence and move on. The margins are where you get to dwell on it; the entry just records it.
3. **Preserve the summary's claims.** The summary is canonical. Do not contradict it. You may expand on its claims only where the archive or chronicle sources provide supporting detail.
4. **Stay in character.** You are a historian in this world, not an AI. Never reference being an AI, prompts, or generation. Let your personality shape the prose. The reader should feel they know the author.
5. **Output the complete entry.** Not a diff. The full rewritten description.
6. **One patch only.** The patches array must contain exactly one entry for the entity.`);

  return sections.join("\n\n");
}

// ============================================================================
// User Prompt
// ============================================================================

interface EditionEntityMeta {
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype?: string;
  entityCulture?: string;
  entityProminence?: string;
  summary?: string;
  descriptionHistory?: Array<{ description: string; source: string; replacedAt: number }>;
  chronicleSummaries?: Array<{
    chronicleId: string;
    title: string;
    format: string;
    summary: string;
  }>;
  relationships?: Array<{ kind: string; targetName: string; targetKind: string }>;
  neighborSummaries?: Array<{ name: string; kind: string; summary: string }>;
  canonFacts?: string[];
  worldDynamics?: string[];
  previousNotes?: Array<{ targetName: string; anchorPhrase: string; text: string; type: string }>;
}

function buildUserPrompt(description: string, meta: EditionEntityMeta, wordBudget: number): string {
  const sections: string[] = [];

  // Entity identity
  const identParts: string[] = [];
  identParts.push(`Name: ${meta.entityName}`);
  identParts.push(
    `Kind: ${meta.entityKind}${meta.entitySubtype ? ` / ${meta.entitySubtype}` : ""}`
  );
  if (meta.entityCulture) identParts.push(`Culture: ${meta.entityCulture}`);
  if (meta.entityProminence) identParts.push(`Prominence: ${meta.entityProminence}`);
  sections.push(`=== ENTITY ===\n${identParts.join("\n")}`);

  // Current description
  sections.push(`=== CURRENT DESCRIPTION (active) ===\n${description}`);

  // Description archive (compressed for outliers with many near-duplicate versions)
  if (meta.descriptionHistory && meta.descriptionHistory.length > 0) {
    const compressed = compressDescriptionHistory(meta.descriptionHistory);
    const archiveEntries = compressed.map((entry, i) => {
      const date = new Date(entry.replacedAt).toISOString().split("T")[0];
      let header = `[${i + 1}] Source: ${entry.source}`;
      if (entry.consolidatedCount) {
        const earliest = new Date(entry.earliestDate!).toISOString().split("T")[0];
        header += ` (${entry.consolidatedCount} passes consolidated)`;
        header += ` | ${earliest} → ${date}`;
      } else {
        header += ` | ${date}`;
      }
      return `${header}\n${entry.description}`;
    });
    sections.push(
      `=== DESCRIPTION ARCHIVE (oldest → newest) ===\nThese are previous versions of the description, in the order they were replaced. Each was the active description at the time.\n\n${archiveEntries.join("\n\n")}`
    );
  }

  // Summary
  if (meta.summary) {
    sections.push(`=== SUMMARY (canonical — preserve its claims) ===\n${meta.summary}`);
  }

  // Chronicle sources (chronicles that contributed lore to this entity via backport)
  if (meta.chronicleSummaries && meta.chronicleSummaries.length > 0) {
    const chronicleLines = meta.chronicleSummaries.map((c) => {
      const parts = [`  - "${c.title}" (${c.format})`];
      if (c.summary) parts[0] += `: ${c.summary}`;
      return parts[0];
    });
    sections.push(
      `=== CHRONICLE SOURCES (accounts that contributed lore to this entity) ===\n${chronicleLines.join("\n")}`
    );
  }

  // Relationships
  if (meta.relationships && meta.relationships.length > 0) {
    const relLines = meta.relationships.map(
      (r) => `  - ${r.kind} → ${r.targetName} (${r.targetKind})`
    );
    sections.push(`=== RELATIONSHIPS ===\n${relLines.join("\n")}`);
  }

  // Neighbor summaries
  if (meta.neighborSummaries && meta.neighborSummaries.length > 0) {
    const neighborLines = meta.neighborSummaries.map(
      (n) => `  [${n.kind}] ${n.name}: ${n.summary}`
    );
    sections.push(
      `=== RELATED ENTITIES (context for accurate identifying clauses) ===\n${neighborLines.join("\n")}`
    );
  }

  // World context
  if (meta.canonFacts && meta.canonFacts.length > 0) {
    sections.push(`=== CANON FACTS ===\n${meta.canonFacts.map((f) => `- ${f}`).join("\n")}`);
  }
  if (meta.worldDynamics && meta.worldDynamics.length > 0) {
    sections.push(`=== WORLD DYNAMICS ===\n${meta.worldDynamics.map((d) => `- ${d}`).join("\n")}`);
  }

  // Previous notes (for voice continuity)
  if (meta.previousNotes && meta.previousNotes.length > 0) {
    const noteLines = meta.previousNotes.map(
      (n) => `  [${n.type}] on "${n.targetName}": "${n.text}"`
    );
    sections.push(
      `=== YOUR PREVIOUS ANNOTATIONS (maintain voice continuity) ===\n${noteLines.join("\n")}`
    );
  }

  // Task
  sections.push(`=== YOUR TASK ===
Prepare the definitive entry for ${meta.entityName} for your forthcoming edition. You have the entity's full description archive. Synthesize a single authoritative account in your voice. The entry should read as this entity's own story.

**Hard word limit: ${wordBudget} words.** Do not exceed this. Use fewer when the material warrants a shorter entry.

Entity: ${meta.entityName} (${meta.entityKind})
ID: ${meta.entityId}`);

  return sections.join("\n\n");
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeHistorianEditionTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: "Text generation not configured - missing Anthropic API key" };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: "runId (chronicleId) required for historian edition task" };
  }

  // Read current run state
  const run = await getRevisionRun(runId);
  if (!run) {
    return { success: false, error: `Historian edition run ${runId} not found` };
  }

  // Single batch (index 0)
  const batchIndex = run.currentBatchIndex;
  const batch = run.batches[batchIndex];
  if (!batch || batch.status !== "pending") {
    return { success: false, error: `No pending batch at index ${batchIndex}` };
  }

  // Mark batch as generating
  const updatedBatches = [...run.batches];
  updatedBatches[batchIndex] = { ...batch, status: "generating" };
  await updateRevisionRun(runId, { status: "generating", batches: updatedBatches });

  // Parse context from staticPagesContext (all metadata packed as JSON)
  let meta: EditionEntityMeta & { historianConfig: HistorianConfig; tone: HistorianTone };
  try {
    meta = JSON.parse(run.staticPagesContext);
  } catch {
    const errorMsg = "Failed to parse context from staticPagesContext";
    updatedBatches[batchIndex] = { ...batch, status: "failed", error: errorMsg };
    await updateRevisionRun(runId, { status: "failed", batches: updatedBatches });
    return { success: false, error: errorMsg };
  }

  // Description is stored in worldDynamicsContext
  const description = run.worldDynamicsContext;
  if (!description) {
    const errorMsg = "No description found in worldDynamicsContext";
    updatedBatches[batchIndex] = { ...batch, status: "failed", error: errorMsg };
    await updateRevisionRun(runId, { status: "failed", batches: updatedBatches });
    return { success: false, error: errorMsg };
  }

  const callConfig = getCallConfig(config, "historian.edition");
  const tone = meta.tone || "scholarly";
  const revisionCount = (meta.descriptionHistory || []).length;
  const wordBudget = computeWordBudget(description, meta.entityProminence, revisionCount);
  const systemPrompt = buildSystemPrompt(meta.historianConfig, tone);
  const userPrompt = buildUserPrompt(description, meta, wordBudget);

  try {
    const callResult = await runTextCall({
      llmClient,
      callType: "historian.edition",
      callConfig,
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
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

    // Parse LLM response
    let parsed: SummaryRevisionLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found");
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.patches)) throw new Error("Missing patches array");

      // Normalize description: LLM returns a single markdown string or string[]
      for (const patch of parsed.patches) {
        if (Array.isArray(patch.description)) {
          patch.description = patch.description.join("\n\n");
        }
      }
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      updatedBatches[batchIndex] = { ...batch, status: "failed", error: errorMsg };
      await updateRevisionRun(runId, { status: "run_reviewing", batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Update batch with patches
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

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: meta.entityId,
      entityName: meta.entityName,
      entityKind: meta.entityKind,
      type: "historianEdition" as CostType,
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
    return { success: false, error: `Historian edition failed: ${errorMsg}` };
  }
}

export const historianEditionTask = {
  type: "historianEdition" as const,
  execute: executeHistorianEditionTask,
};
