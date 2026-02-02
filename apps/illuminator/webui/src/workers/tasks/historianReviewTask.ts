/**
 * Historian Review Worker Task
 *
 * Reads run state from IndexedDB, assembles context from entity description
 * or chronicle narrative, makes one LLM call for scholarly annotation,
 * and writes the resulting notes back to IndexedDB.
 *
 * Produces anchored annotations — resigned commentary, corrections, weary
 * tangents, skepticism, pedantic observations — in a consistent historian voice.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type {
  HistorianConfig,
  HistorianNote,
  HistorianNoteType,
  HistorianLLMResponse,
  HistorianTargetType,
  HistorianTone,
} from '../../lib/historianTypes';
import { getHistorianRun, updateHistorianRun } from '../../lib/db/historianRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';

// ============================================================================
// Tone Descriptions
// ============================================================================

const TONE_DESCRIPTIONS: Record<HistorianTone, string> = {
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

  sections.push(`You are ${historianConfig.name}, annotating a collection of historical and cultural texts for a forthcoming scholarly edition.

${TONE_DESCRIPTIONS[tone]}

## Your Identity

${historianConfig.background}

**Personality:** ${historianConfig.personalityTraits.join(', ')}
**Known biases:** ${historianConfig.biases.join(', ')}
**Your stance toward this material:** ${historianConfig.stance}`);

  if (historianConfig.privateFacts.length > 0) {
    sections.push(`## Private Knowledge (things you know that the texts don't always reflect)

${historianConfig.privateFacts.map((f) => `- ${f}`).join('\n')}`);
  }

  if (historianConfig.runningGags.length > 0) {
    sections.push(`## Recurring Preoccupations (these surface in your annotations unbidden — not every time, but often enough)

${historianConfig.runningGags.map((g) => `- ${g}`).join('\n')}`);
  }

  sections.push(`## Note Types

You produce annotations of these types:

- **commentary**: General observations — things you notice, admire, or find worth remarking upon. These reflect your current mood and personality.
- **correction**: Factual inconsistencies, inaccuracies, or contradictions you've identified. The record must be accurate. Be specific about what's wrong.
- **tangent**: Personal digressions — a memory that surfaces, a parallel you can't help drawing, an aside that reveals your character. These show who you are.
- **skepticism**: You dispute or question the account. Other sources disagree, the numbers don't add up, or the story has been polished beyond recognition.
- **pedantic**: Scholarly corrections of names, dates, terminology, cultural usage. Someone has to get these right.

## Output Format

Output ONLY valid JSON:

{
  "notes": [
    {
      "anchorPhrase": "exact substring from the text",
      "text": "Your annotation here.",
      "type": "commentary"
    }
  ]
}

## Rules

1. **Anchor phrases must be EXACT substrings** of the source text. Copy them character-for-character. If you can't find a good anchor, use the first few words of the relevant sentence.
2. **For entity descriptions**: produce 3–8 notes. For chronicle narratives: produce 5–15 notes.
3. **Mix note types.** Don't produce all the same type. A real scholar's marginalia shifts between correction, digression, and observation.
4. **Stay in character.** You are writing scholarly marginalia, not a book report. Let your current mood shape every note. Reference your biases and personality. The reader should feel they know you.
5. **Annotations should add value.** Don't just restate what the text says. Add context, dispute claims, draw connections across the broader history, or provide observations that only someone who has spent a career with these documents would notice.
6. **Keep annotations concise.** One to three sentences each. Occasionally a longer digression is permitted for tangents.
7. **Never break the fourth wall.** You are a historian in this world, not an AI. Never reference being an AI, prompts, or generation.`);

  return sections.join('\n\n');
}

// ============================================================================
// User Prompt
// ============================================================================

interface EntityContext {
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype?: string;
  entityCulture?: string;
  entityProminence?: string;
  summary?: string;
  relationships?: Array<{ kind: string; targetName: string; targetKind: string }>;
  neighborSummaries?: Array<{ name: string; kind: string; summary: string }>;
}

interface ChronicleContext {
  chronicleId: string;
  title: string;
  format: string;
  narrativeStyleId?: string;
  cast?: Array<{ entityName: string; role: string; kind: string }>;
  castSummaries?: Array<{ name: string; kind: string; summary: string }>;
}

interface WorldContext {
  canonFacts?: string[];
  worldDynamics?: string[];
}

interface PreviousNote {
  targetName: string;
  anchorPhrase: string;
  text: string;
  type: HistorianNoteType;
}

function buildEntityUserPrompt(
  description: string,
  entity: EntityContext,
  world: WorldContext,
  previousNotes: PreviousNote[],
): string {
  const sections: string[] = [];

  // Entity identity
  const identParts: string[] = [];
  identParts.push(`Name: ${entity.entityName}`);
  identParts.push(`Kind: ${entity.entityKind}${entity.entitySubtype ? ` / ${entity.entitySubtype}` : ''}`);
  if (entity.entityCulture) identParts.push(`Culture: ${entity.entityCulture}`);
  if (entity.entityProminence) identParts.push(`Prominence: ${entity.entityProminence}`);
  sections.push(`=== ENTITY ===\n${identParts.join('\n')}`);

  // Summary
  if (entity.summary) {
    sections.push(`=== SUMMARY (for context) ===\n${entity.summary}`);
  }

  // Relationships
  if (entity.relationships && entity.relationships.length > 0) {
    const relLines = entity.relationships.map(
      (r) => `  - ${r.kind} → ${r.targetName} (${r.targetKind})`
    );
    sections.push(`=== RELATIONSHIPS ===\n${relLines.join('\n')}`);
  }

  // Neighbor summaries (for cross-entity references)
  if (entity.neighborSummaries && entity.neighborSummaries.length > 0) {
    const neighborLines = entity.neighborSummaries.map(
      (n) => `  [${n.kind}] ${n.name}: ${n.summary}`
    );
    sections.push(`=== RELATED ENTITIES (for cross-references) ===\n${neighborLines.join('\n')}`);
  }

  // World context
  if (world.canonFacts && world.canonFacts.length > 0) {
    sections.push(`=== CANON FACTS ===\n${world.canonFacts.map((f) => `- ${f}`).join('\n')}`);
  }
  if (world.worldDynamics && world.worldDynamics.length > 0) {
    sections.push(`=== WORLD DYNAMICS ===\n${world.worldDynamics.map((d) => `- ${d}`).join('\n')}`);
  }

  // Previous notes (for voice continuity)
  if (previousNotes.length > 0) {
    const noteLines = previousNotes.map(
      (n) => `  [${n.type}] on "${n.targetName}": "${n.text}"`
    );
    sections.push(`=== YOUR PREVIOUS ANNOTATIONS (maintain continuity) ===\n${noteLines.join('\n')}`);
  }

  // The description to annotate
  sections.push(`=== DESCRIPTION TO ANNOTATE ===\n${description}`);

  sections.push(`=== YOUR TASK ===
Annotate the description above with your scholarly margin notes. You are reviewing this entry for the forthcoming edition. Let your current mood guide your pen.

Entity: ${entity.entityName} (${entity.entityKind})`);

  return sections.join('\n\n');
}

function buildChronicleUserPrompt(
  narrative: string,
  chronicle: ChronicleContext,
  world: WorldContext,
  previousNotes: PreviousNote[],
): string {
  const sections: string[] = [];

  // Chronicle identity
  const identParts: string[] = [];
  identParts.push(`Title: ${chronicle.title}`);
  identParts.push(`Format: ${chronicle.format}`);
  if (chronicle.narrativeStyleId) identParts.push(`Style: ${chronicle.narrativeStyleId}`);
  sections.push(`=== CHRONICLE ===\n${identParts.join('\n')}`);

  // Cast
  if (chronicle.cast && chronicle.cast.length > 0) {
    const castLines = chronicle.cast.map(
      (c) => `  - ${c.entityName} (${c.kind}) — role: ${c.role}`
    );
    sections.push(`=== CAST ===\n${castLines.join('\n')}`);
  }

  // Cast summaries
  if (chronicle.castSummaries && chronicle.castSummaries.length > 0) {
    const summaryLines = chronicle.castSummaries.map(
      (s) => `  [${s.kind}] ${s.name}: ${s.summary}`
    );
    sections.push(`=== CAST DETAILS (for cross-references) ===\n${summaryLines.join('\n')}`);
  }

  // World context
  if (world.canonFacts && world.canonFacts.length > 0) {
    sections.push(`=== CANON FACTS ===\n${world.canonFacts.map((f) => `- ${f}`).join('\n')}`);
  }
  if (world.worldDynamics && world.worldDynamics.length > 0) {
    sections.push(`=== WORLD DYNAMICS ===\n${world.worldDynamics.map((d) => `- ${d}`).join('\n')}`);
  }

  // Previous notes
  if (previousNotes.length > 0) {
    const noteLines = previousNotes.map(
      (n) => `  [${n.type}] on "${n.targetName}": "${n.text}"`
    );
    sections.push(`=== YOUR PREVIOUS ANNOTATIONS (maintain continuity) ===\n${noteLines.join('\n')}`);
  }

  // The narrative to annotate
  sections.push(`=== NARRATIVE TO ANNOTATE ===\n${narrative}`);

  sections.push(`=== YOUR TASK ===
Annotate the chronicle above with your scholarly margin notes. This is a ${chronicle.format} — review it for accuracy and add whatever observations you cannot keep to yourself.

Chronicle: "${chronicle.title}"`);

  return sections.join('\n\n');
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeHistorianReviewTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: 'runId (chronicleId) required for historian review task' };
  }

  // Read current run state
  const run = await getHistorianRun(runId);
  if (!run) {
    return { success: false, error: `Historian run ${runId} not found` };
  }

  // Mark as generating
  await updateHistorianRun(runId, { status: 'generating' });

  // Parse historian config
  let historianConfig: HistorianConfig;
  try {
    historianConfig = JSON.parse(run.historianConfigJson);
  } catch {
    await updateHistorianRun(runId, { status: 'failed', error: 'Failed to parse historian config' });
    return { success: false, error: 'Failed to parse historian config' };
  }

  // Parse context
  let parsedContext: Record<string, unknown>;
  try {
    parsedContext = JSON.parse(run.contextJson);
  } catch {
    await updateHistorianRun(runId, { status: 'failed', error: 'Failed to parse context JSON' });
    return { success: false, error: 'Failed to parse context JSON' };
  }

  // Parse previous notes
  let previousNotes: PreviousNote[] = [];
  try {
    if (run.previousNotesJson) {
      previousNotes = JSON.parse(run.previousNotesJson);
    }
  } catch {
    // Non-fatal: proceed without previous notes
  }

  const sourceText = run.sourceText;
  if (!sourceText) {
    await updateHistorianRun(runId, { status: 'failed', error: 'No source text to annotate' });
    return { success: false, error: 'No source text to annotate' };
  }

  const targetType = run.targetType as HistorianTargetType;
  const callType = targetType === 'entity' ? 'historian.entityReview' : 'historian.chronicleReview';
  const callConfig = getCallConfig(config, callType);

  // Build prompts
  const tone = (run.tone || 'weary') as HistorianTone;
  const systemPrompt = buildSystemPrompt(historianConfig, tone);

  let userPrompt: string;
  const worldCtx: WorldContext = {
    canonFacts: parsedContext.canonFacts as string[] | undefined,
    worldDynamics: parsedContext.worldDynamics as string[] | undefined,
  };

  if (targetType === 'entity') {
    userPrompt = buildEntityUserPrompt(
      sourceText,
      parsedContext as unknown as EntityContext,
      worldCtx,
      previousNotes,
    );
  } else {
    userPrompt = buildChronicleUserPrompt(
      sourceText,
      parsedContext as unknown as ChronicleContext,
      worldCtx,
      previousNotes,
    );
  }

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
      await updateHistorianRun(runId, { status: 'failed', error: 'Task aborted' });
      return { success: false, error: 'Task aborted' };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
      await updateHistorianRun(runId, { status: 'failed', error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: HistorianLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.notes)) throw new Error('Missing notes array');
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      await updateHistorianRun(runId, { status: 'failed', error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Assign note IDs and validate
    const validTypes = new Set<HistorianNoteType>(['commentary', 'correction', 'tangent', 'skepticism', 'pedantic']);
    const notes: HistorianNote[] = parsed.notes
      .filter((n) => n.anchorPhrase && n.text && validTypes.has(n.type))
      .map((n, i) => ({
        noteId: `note_${Date.now()}_${i}`,
        anchorPhrase: n.anchorPhrase,
        text: n.text,
        type: n.type,
        display: 'full' as const,
      }));

    // Write notes to run, mark as reviewing
    await updateHistorianRun(runId, {
      status: 'reviewing',
      notes,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    });

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: targetType === 'entity' ? run.targetId : undefined,
      entityName: targetType === 'entity' ? run.targetName : undefined,
      entityKind: targetType === 'entity' ? (parsedContext as EntityContext).entityKind : undefined,
      chronicleId: targetType === 'chronicle' ? run.targetId : undefined,
      type: 'historianReview' as CostType,
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
    await updateHistorianRun(runId, { status: 'failed', error: errorMsg });
    return { success: false, error: `Historian review failed: ${errorMsg}` };
  }
}

export const historianReviewTask = {
  type: 'historianReview' as const,
  execute: executeHistorianReviewTask,
};
