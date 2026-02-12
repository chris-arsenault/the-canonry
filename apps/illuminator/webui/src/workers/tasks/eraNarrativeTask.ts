/**
 * Era Narrative Worker Task
 *
 * Step-based execution for multi-chapter era narrative generation.
 * Routes on EraNarrativeRecord.currentStep to execute the appropriate
 * pipeline stage: threads → chapter → chapter_edit → title.
 *
 * Each step: mark 'generating' → LLM call → write result → mark 'step_complete'.
 * The hook advances to the next step on user action (with pauses between).
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type { HistorianConfig, HistorianTone } from '../../lib/historianTypes';
import type {
  EraNarrativeRecord,
  EraNarrativeThreadSynthesis,
  EraNarrativeChapter,
} from '../../lib/eraNarrativeTypes';
import { getEraNarrative, updateEraNarrative } from '../../lib/db/eraNarrativeRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';

// ============================================================================
// Tone Descriptions (duplicated — locality over DRY)
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
// Thread Synthesis Step
// ============================================================================

function buildThreadsSystemPrompt(historianConfig: HistorianConfig, tone: HistorianTone, eraName: string): string {
  return `You are ${historianConfig.name}, planning the structure of your magnum opus — a narrative history of ${eraName}. You have spent years collecting and annotating the primary chronicles. Now you must identify the threads that connect them and plan the chapters of your book.

${TONE_DESCRIPTIONS[tone]}

## Your Identity

${historianConfig.background}

**Personality:** ${historianConfig.personalityTraits.join(', ')}
**Known biases:** ${historianConfig.biases.join(', ')}
**Your stance toward this material:** ${historianConfig.stance}
${historianConfig.privateFacts.length > 0 ? `\n**Private knowledge:** ${historianConfig.privateFacts.join('; ')}` : ''}
${historianConfig.runningGags.length > 0 ? `\n**Recurring preoccupations:** ${historianConfig.runningGags.join('; ')}` : ''}

## Your Task

Analyze the prep briefs from your reading notes and identify:

1. **Narrative threads** — recurring themes, character arcs, political dynamics, cultural shifts that connect multiple chronicles
2. **Chapter plan** — how to organize the era's story into chapters (typically 2-6), each covering a coherent portion of the era's timeline
3. **Thesis** — what is the defining story of this era? What argument will your book make?
4. **Motifs** — recurring images, phrases, or ideas that will give the work cohesion
5. **Opening and closing images** — the first and last things the reader sees

## Output Format

Output ONLY valid JSON:

{
  "threads": [
    {
      "threadId": "thread_1",
      "name": "Thread name",
      "description": "What this thread is about",
      "chronicleIds": ["chr_1", "chr_2"],
      "keyCharacters": ["Name1", "Name2"],
      "arc": "How this thread develops across the era"
    }
  ],
  "chapterPlan": [
    {
      "chapterIndex": 0,
      "title": "Chapter title",
      "yearRange": [10, 25],
      "chronicleIds": ["chr_1"],
      "threadIds": ["thread_1"],
      "beats": "Key narrative beats for this chapter",
      "historianAngle": "Your particular take on these events — what makes your telling distinct"
    }
  ],
  "thesis": "The central argument of this work",
  "motifs": ["motif1", "motif2"],
  "openingImage": "The scene or image that opens the work",
  "closingImage": "The scene or image that closes the work"
}

## Rules

1. Every chronicle should appear in at least one chapter.
2. Chapters should be in chronological order.
3. Thread IDs should be simple slugs (thread_1, thread_2, etc.).
4. Stay in character. You are planning YOUR book, not describing an AI pipeline.`;
}

function buildThreadsUserPrompt(record: EraNarrativeRecord): string {
  const sections: string[] = [];

  sections.push(`=== ERA: ${record.eraName} ===`);

  // Sort briefs by eraYear
  const sorted = [...record.prepBriefs].sort((a, b) => (a.eraYear || 0) - (b.eraYear || 0));

  sections.push(`=== READING NOTES (${sorted.length} chronicles) ===`);
  for (const brief of sorted) {
    const yearLabel = brief.eraYear ? ` [Year ${brief.eraYear}]` : '';
    sections.push(`--- ${brief.chronicleTitle}${yearLabel} (${brief.chronicleId}) ---\n${brief.prep}`);
  }

  sections.push(`=== YOUR TASK ===
Plan the structure of your narrative history of ${record.eraName}. Identify threads, plan chapters, articulate your thesis.`);

  return sections.join('\n\n');
}

// ============================================================================
// Chapter Generation Step
// ============================================================================

function buildChapterSystemPrompt(
  historianConfig: HistorianConfig,
  tone: HistorianTone,
  eraName: string
): string {
  return `You are ${historianConfig.name}, writing your narrative history of ${eraName}. This is not annotation work — this is the book itself. You are writing proper narrative prose: dramatic, historically grounded, shaped by your distinctive voice and scholarly perspective.

${TONE_DESCRIPTIONS[tone]}

## Your Identity

${historianConfig.background}

**Personality:** ${historianConfig.personalityTraits.join(', ')}
**Known biases:** ${historianConfig.biases.join(', ')}
**Your stance toward this material:** ${historianConfig.stance}
${historianConfig.privateFacts.length > 0 ? `\n**Private knowledge:** ${historianConfig.privateFacts.join('; ')}` : ''}
${historianConfig.runningGags.length > 0 ? `\n**Recurring preoccupations:** ${historianConfig.runningGags.join('; ')}` : ''}

## Writing Guidelines

- **Narrative prose**, not annotations. You are telling the story, not commenting on it.
- **Historically grounded dramatization.** You may dramatize scenes but never invent facts.
- **Your voice.** Your biases, private knowledge, and recurring preoccupations should surface naturally — not as footnotes but woven into how you tell the story.
- **Synthesis, not summary.** You are creating something new from the source material, not repeating it. Find connections the chroniclers missed. Draw parallels they didn't see. Let your years of study show.
- **Aim for 4,000-5,000 words.** This is a substantial chapter.

## Output Format

Write the chapter as plain prose. No JSON. No markdown headers (the chapter title is provided separately). Just the narrative text itself.`;
}

function buildChapterUserPrompt(
  record: EraNarrativeRecord,
  chapterIndex: number
): string {
  const synthesis = record.threadSynthesis!;
  const plan = synthesis.chapterPlan[chapterIndex];
  const sections: string[] = [];

  // Chapter identity
  sections.push(`=== CHAPTER ${chapterIndex + 1}: "${plan.title}" ===
Year range: ${plan.yearRange[0]}–${plan.yearRange[1]}
Your angle: ${plan.historianAngle}
Key beats: ${plan.beats}`);

  // Relevant threads
  const relevantThreads = synthesis.threads.filter((t) => plan.threadIds.includes(t.threadId));
  if (relevantThreads.length > 0) {
    const threadLines = relevantThreads.map((t) => `- ${t.name}: ${t.arc}`);
    sections.push(`=== ACTIVE THREADS ===\n${threadLines.join('\n')}`);
  }

  // Thesis and motifs
  sections.push(`=== WORK THESIS ===\n${synthesis.thesis}\n\nMotifs: ${synthesis.motifs.join(', ')}`);

  // Relevant prep briefs
  const relevantBriefs = record.prepBriefs.filter((b) => plan.chronicleIds.includes(b.chronicleId));
  const sortedBriefs = [...relevantBriefs].sort((a, b) => (a.eraYear || 0) - (b.eraYear || 0));
  if (sortedBriefs.length > 0) {
    sections.push(`=== SOURCE MATERIAL (your reading notes) ===`);
    for (const brief of sortedBriefs) {
      const yearLabel = brief.eraYear ? ` [Year ${brief.eraYear}]` : '';
      sections.push(`--- ${brief.chronicleTitle}${yearLabel} ---\n${brief.prep}`);
    }
  }

  // Previous chapter ending for continuity
  if (chapterIndex > 0) {
    const prevChapter = record.chapters[chapterIndex - 1];
    if (prevChapter) {
      const prevContent = prevChapter.editedContent || prevChapter.content;
      const lastWords = prevContent.split(/\s+/).slice(-300).join(' ');
      sections.push(`=== PREVIOUS CHAPTER ENDING (for continuity) ===\n...${lastWords}`);
    }
  } else {
    // First chapter — use the opening image
    sections.push(`=== OPENING IMAGE ===\n${synthesis.openingImage}`);
  }

  // Last chapter — use the closing image
  if (chapterIndex === synthesis.chapterPlan.length - 1) {
    sections.push(`=== CLOSING IMAGE (for the final paragraphs) ===\n${synthesis.closingImage}`);
  }

  sections.push(`=== YOUR TASK ===
Write chapter ${chapterIndex + 1} of your narrative history. 4,000-5,000 words of narrative prose.`);

  return sections.join('\n\n');
}

// ============================================================================
// Chapter Edit Step
// ============================================================================

function buildChapterEditSystemPrompt(historianConfig: HistorianConfig): string {
  return `You are a senior editor polishing ${historianConfig.name}'s prose for his narrative history. Your job is to preserve his distinctive voice while smoothing rough edges.

## Editing Guidelines

- **Preserve voice.** ${historianConfig.name}'s personality, biases, and style are features, not bugs. Do not flatten them.
- **Smooth repetition.** Where the same point is made twice, keep the better phrasing.
- **Tighten prose.** Remove filler words, redundant phrases, unnecessary hedging. Every sentence should earn its place.
- **Fix consistency.** Names, dates, and facts should be consistent throughout.
- **Maintain rhythm.** ${historianConfig.name}'s prose has a distinctive rhythm — long sentences that build, short ones that punctuate. Preserve this.

## Output Format

Output the polished chapter text. No commentary, no notes — just the improved prose.`;
}

function buildChapterEditUserPrompt(
  record: EraNarrativeRecord,
  chapterIndex: number
): string {
  const synthesis = record.threadSynthesis!;
  const chapter = record.chapters[chapterIndex];

  return `=== CHAPTER: "${chapter.title}" ===

Thesis of the larger work: ${synthesis.thesis}
Motifs: ${synthesis.motifs.join(', ')}

=== TEXT TO EDIT ===

${chapter.content}

=== YOUR TASK ===
Polish this chapter. Preserve the historian's voice. Smooth, tighten, fix.`;
}

// ============================================================================
// Title Step (two-phase)
// ============================================================================

function buildTitleFragmentSystemPrompt(historianConfig: HistorianConfig): string {
  return `You are mining ${historianConfig.name}'s draft narrative history for title material. Extract distinctive phrases, images, and motifs that could serve as fragments for a book title.

Output ONLY a JSON array of 8-12 strings:
["fragment one", "fragment two", ...]

Look for: striking images, recurring motifs, the historian's most memorable phrases, the era's defining tensions.`;
}

function buildTitleFragmentUserPrompt(record: EraNarrativeRecord): string {
  const synthesis = record.threadSynthesis!;
  const sections: string[] = [];

  sections.push(`Thesis: ${synthesis.thesis}`);
  sections.push(`Motifs: ${synthesis.motifs.join(', ')}`);
  sections.push(`Opening image: ${synthesis.openingImage}`);
  sections.push(`Closing image: ${synthesis.closingImage}`);

  // Chapter openings (first ~200 words each)
  for (const chapter of record.chapters) {
    const opening = (chapter.editedContent || chapter.content).split(/\s+/).slice(0, 200).join(' ');
    sections.push(`Chapter "${chapter.title}" opening:\n${opening}`);
  }

  return sections.join('\n\n');
}

function buildTitleShapingSystemPrompt(historianConfig: HistorianConfig, tone: HistorianTone): string {
  return `You are ${historianConfig.name}, choosing a title for your narrative history.

${TONE_DESCRIPTIONS[tone]}

Shape the fragments below into 5 title candidates. The title should:
- Reflect YOUR voice and sensibility as a historian
- Capture the era's central tension or defining quality
- Be evocative rather than descriptive
- Work as a book title (not too long, not too generic)

Output ONLY a JSON array of 5 strings:
["Title Candidate One", "Title Candidate Two", ...]`;
}

function buildTitleShapingUserPrompt(fragments: string[], record: EraNarrativeRecord): string {
  const synthesis = record.threadSynthesis!;
  return `Era: ${record.eraName}
Thesis: ${synthesis.thesis}

Title fragments:
${fragments.map((f) => `- ${f}`).join('\n')}`;
}

// ============================================================================
// Step Execution
// ============================================================================

async function executeThreadsStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const historianConfig: HistorianConfig = JSON.parse(record.historianConfigJson);
  const tone = record.tone || 'weary';
  const callType = 'historian.eraNarrative' as const;
  const callConfig = getCallConfig(config, callType);

  const systemPrompt = buildThreadsSystemPrompt(historianConfig, tone, record.eraName);
  const userPrompt = buildThreadsUserPrompt(record);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature: 0.7,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: 'Task aborted' });
    return { success: false, error: 'Task aborted' };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    const err = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: err });
    return { success: false, error: err };
  }

  // Parse thread synthesis JSON
  let parsed: Omit<EraNarrativeThreadSynthesis, 'generatedAt' | 'model' | 'systemPrompt' | 'userPrompt' | 'inputTokens' | 'outputTokens' | 'actualCost'>;
  try {
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found');
    parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.threads)) throw new Error('Missing threads array');
    if (!Array.isArray(parsed.chapterPlan)) throw new Error('Missing chapterPlan array');
  } catch (err) {
    const errorMsg = `Failed to parse thread synthesis: ${err instanceof Error ? err.message : String(err)}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: errorMsg });
    return { success: false, error: errorMsg };
  }

  const threadSynthesis: EraNarrativeThreadSynthesis = {
    ...parsed,
    generatedAt: Date.now(),
    model: callConfig.model,
    systemPrompt,
    userPrompt,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
    actualCost: callResult.usage.actualCost,
  };

  await updateEraNarrative(record.narrativeId, {
    status: 'step_complete',
    threadSynthesis,
    totalInputTokens: record.totalInputTokens + callResult.usage.inputTokens,
    totalOutputTokens: record.totalOutputTokens + callResult.usage.outputTokens,
    totalActualCost: record.totalActualCost + callResult.usage.actualCost,
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: 'eraNarrative' as CostType,
    model: callConfig.model,
    estimatedCost: callResult.estimate.estimatedCost,
    actualCost: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

async function executeChapterStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!record.threadSynthesis) {
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: 'Thread synthesis required before chapter generation' });
    return { success: false, error: 'Thread synthesis required' };
  }

  const historianConfig: HistorianConfig = JSON.parse(record.historianConfigJson);
  const tone = record.tone || 'weary';
  const chapterIndex = record.currentChapterIndex;
  const callType = 'historian.eraNarrative' as const;
  const callConfig = getCallConfig(config, callType);

  const systemPrompt = buildChapterSystemPrompt(historianConfig, tone, record.eraName);
  const userPrompt = buildChapterUserPrompt(record, chapterIndex);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature: 0.8,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: 'Task aborted' });
    return { success: false, error: 'Task aborted' };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    const err = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: err });
    return { success: false, error: err };
  }

  const plan = record.threadSynthesis.chapterPlan[chapterIndex];
  const chapter: EraNarrativeChapter = {
    chapterIndex,
    title: plan.title,
    content: resultText,
    wordCount: resultText.split(/\s+/).filter(Boolean).length,
    generatedAt: Date.now(),
    model: callConfig.model,
    systemPrompt,
    userPrompt,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
    actualCost: callResult.usage.actualCost,
  };

  // Add or replace chapter in array
  const chapters = [...record.chapters];
  const existingIdx = chapters.findIndex((c) => c.chapterIndex === chapterIndex);
  if (existingIdx >= 0) {
    chapters[existingIdx] = chapter;
  } else {
    chapters.push(chapter);
  }
  chapters.sort((a, b) => a.chapterIndex - b.chapterIndex);

  await updateEraNarrative(record.narrativeId, {
    status: 'step_complete',
    chapters,
    totalInputTokens: record.totalInputTokens + callResult.usage.inputTokens,
    totalOutputTokens: record.totalOutputTokens + callResult.usage.outputTokens,
    totalActualCost: record.totalActualCost + callResult.usage.actualCost,
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: 'eraNarrative' as CostType,
    model: callConfig.model,
    estimatedCost: callResult.estimate.estimatedCost,
    actualCost: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

async function executeChapterEditStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const historianConfig: HistorianConfig = JSON.parse(record.historianConfigJson);
  const chapterIndex = record.currentChapterIndex;
  const chapter = record.chapters.find((c) => c.chapterIndex === chapterIndex);
  if (!chapter) {
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: `Chapter ${chapterIndex} not found` });
    return { success: false, error: `Chapter ${chapterIndex} not found` };
  }

  const callType = 'historian.eraNarrative' as const;
  const callConfig = getCallConfig(config, callType);

  const systemPrompt = buildChapterEditSystemPrompt(historianConfig);
  const userPrompt = buildChapterEditUserPrompt(record, chapterIndex);

  const callResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: 'Task aborted' });
    return { success: false, error: 'Task aborted' };
  }

  const resultText = callResult.result.text?.trim();
  if (callResult.result.error || !resultText) {
    const err = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: err });
    return { success: false, error: err };
  }

  // Update chapter with edited content
  const chapters = record.chapters.map((c) =>
    c.chapterIndex === chapterIndex
      ? {
          ...c,
          editedContent: resultText,
          editedWordCount: resultText.split(/\s+/).filter(Boolean).length,
          editedAt: Date.now(),
          editSystemPrompt: systemPrompt,
          editUserPrompt: userPrompt,
          editInputTokens: callResult.usage.inputTokens,
          editOutputTokens: callResult.usage.outputTokens,
          editActualCost: callResult.usage.actualCost,
        }
      : c
  );

  await updateEraNarrative(record.narrativeId, {
    status: 'step_complete',
    chapters,
    totalInputTokens: record.totalInputTokens + callResult.usage.inputTokens,
    totalOutputTokens: record.totalOutputTokens + callResult.usage.outputTokens,
    totalActualCost: record.totalActualCost + callResult.usage.actualCost,
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: 'eraNarrative' as CostType,
    model: callConfig.model,
    estimatedCost: callResult.estimate.estimatedCost,
    actualCost: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

async function executeTitleStep(
  task: WorkerTask,
  record: EraNarrativeRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const historianConfig: HistorianConfig = JSON.parse(record.historianConfigJson);
  const tone = record.tone || 'weary';
  const callType = 'historian.eraNarrative' as const;
  const callConfig = getCallConfig(config, callType);

  // Phase 1: Fragment extraction
  const fragmentSystemPrompt = buildTitleFragmentSystemPrompt(historianConfig);
  const fragmentUserPrompt = buildTitleFragmentUserPrompt(record);

  const fragmentResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt: fragmentSystemPrompt,
    prompt: fragmentUserPrompt,
    temperature: 0.85,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: 'Task aborted' });
    return { success: false, error: 'Task aborted' };
  }

  const fragmentText = fragmentResult.result.text?.trim();
  if (fragmentResult.result.error || !fragmentText) {
    const err = `Fragment extraction failed: ${fragmentResult.result.error || 'No text returned'}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: err });
    return { success: false, error: err };
  }

  let fragments: string[];
  try {
    const jsonMatch = fragmentText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    fragments = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(fragments)) throw new Error('Not an array');
  } catch (err) {
    const errorMsg = `Failed to parse fragments: ${err instanceof Error ? err.message : String(err)}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: errorMsg });
    return { success: false, error: errorMsg };
  }

  // Phase 2: Title shaping
  const titleSystemPrompt = buildTitleShapingSystemPrompt(historianConfig, tone);
  const titleUserPrompt = buildTitleShapingUserPrompt(fragments, record);

  const titleResult = await runTextCall({
    llmClient,
    callType,
    callConfig,
    systemPrompt: titleSystemPrompt,
    prompt: titleUserPrompt,
    temperature: 0.7,
  });

  if (isAborted()) {
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: 'Task aborted' });
    return { success: false, error: 'Task aborted' };
  }

  const titleText = titleResult.result.text?.trim();
  if (titleResult.result.error || !titleText) {
    const err = `Title shaping failed: ${titleResult.result.error || 'No text returned'}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: err });
    return { success: false, error: err };
  }

  let candidates: string[];
  try {
    const jsonMatch = titleText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    candidates = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(candidates)) throw new Error('Not an array');
  } catch (err) {
    const errorMsg = `Failed to parse title candidates: ${err instanceof Error ? err.message : String(err)}`;
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: errorMsg });
    return { success: false, error: errorMsg };
  }

  const totalInput = fragmentResult.usage.inputTokens + titleResult.usage.inputTokens;
  const totalOutput = fragmentResult.usage.outputTokens + titleResult.usage.outputTokens;
  const totalCost = fragmentResult.usage.actualCost + titleResult.usage.actualCost;

  await updateEraNarrative(record.narrativeId, {
    status: 'step_complete',
    titleFragments: fragments,
    titleCandidates: candidates,
    totalInputTokens: record.totalInputTokens + totalInput,
    totalOutputTokens: record.totalOutputTokens + totalOutput,
    totalActualCost: record.totalActualCost + totalCost,
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    type: 'eraNarrative' as CostType,
    model: callConfig.model,
    estimatedCost: fragmentResult.estimate.estimatedCost + titleResult.estimate.estimatedCost,
    actualCost: totalCost,
    inputTokens: totalInput,
    outputTokens: totalOutput,
  });

  return { success: true, result: { generatedAt: Date.now(), model: callConfig.model } };
}

// ============================================================================
// Task Router
// ============================================================================

async function executeEraNarrativeTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { llmClient } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const narrativeId = task.chronicleId; // Repurposed field
  if (!narrativeId) {
    return { success: false, error: 'narrativeId (chronicleId) required for era narrative task' };
  }

  const record = await getEraNarrative(narrativeId);
  if (!record) {
    return { success: false, error: `Era narrative ${narrativeId} not found` };
  }

  // Mark as generating
  await updateEraNarrative(record.narrativeId, { status: 'generating' });

  try {
    switch (record.currentStep) {
      case 'threads':
        return await executeThreadsStep(task, record, context);
      case 'chapter':
        return await executeChapterStep(task, record, context);
      case 'chapter_edit':
        return await executeChapterEditStep(task, record, context);
      case 'title':
        return await executeTitleStep(task, record, context);
      default:
        await updateEraNarrative(record.narrativeId, { status: 'failed', error: `Unknown step: ${record.currentStep}` });
        return { success: false, error: `Unknown step: ${record.currentStep}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateEraNarrative(record.narrativeId, { status: 'failed', error: errorMsg });
    return { success: false, error: `Era narrative failed: ${errorMsg}` };
  }
}

export const eraNarrativeTask = {
  type: 'eraNarrative' as const,
  execute: executeEraNarrativeTask,
};
