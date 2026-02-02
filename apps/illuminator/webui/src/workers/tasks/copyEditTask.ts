/**
 * Copy Edit Worker Task
 *
 * Reads run state from IndexedDB, assembles context from entity description,
 * metadata, and relationships, makes one LLM call for readability copy editing,
 * and writes the resulting patch back to IndexedDB.
 *
 * Fixes: pronoun ambiguity, unexplained noun introductions, dense prose,
 * narrative bleed from chronicles into wiki-style descriptions.
 * Does NOT add new lore or check narrative consistency.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type { SummaryRevisionLLMResponse } from '../../lib/summaryRevisionTypes';
import { getRevisionRun, updateRevisionRun } from '../../lib/db/summaryRevisionRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a copy editor for a world-building wiki. You receive one entity's description along with its metadata, relationships, and editorial guidance. Your job is to improve readability without changing any facts.

## What You Fix

**1. Pronoun ambiguity.** When multiple entities or groups are referenced, reintroduce the entity's proper name at paragraph starts and after references to other entities or groups. A reader should never wonder who "they" refers to.

**2. Unexplained references.** Every entity, event, artifact, or place mentioned in the description must have an identifying clause on first mention. Use the entity's relationships to write these introductions. For example:
- BAD: "The harp showed them futures."
- GOOD: "The Radiant Aurora-harp, a memory-singing instrument held by the Pinnacle, showed them futures."

If a reference appears in the description but is NOT in the relationships list and you cannot confidently identify it, wrap it in a marker: \`[NEEDS CONTEXT: the harp]\`. Do not fabricate introductions.

**3. Dense prose.** Break sentences longer than ~40 words into shorter ones. Add paragraph breaks at natural topic boundaries. Descriptions should read as wiki articles, not as prose blocks.

**4. Narrative bleed.** If the description contains chronicle-style narration (atmospheric language, emotional imagery, reconstructed scenes, quoted dialogue), compress it to its factual core in the world's voice. Paraphrase dialogue. State what happened, not how it felt.

## What You Preserve

- **Every fact.** Do not add, remove, or alter any semantic content. Every claim in the original must appear in your output.
- **The world's voice and tone.** These descriptions have personality. Maintain the distinctive phrasing and register — just make it clearer.
- **The visual thesis.** Do not contradict it.
- **Paragraph structure.** Preserve existing paragraph boundaries unless splitting a dense paragraph improves readability. Do not merge paragraphs.

## Output Format

Output ONLY valid JSON:

{
  "patches": [
    {
      "entityId": "entity_id_here",
      "entityName": "Entity Name",
      "entityKind": "npc",
      "description": [
        "First paragraph.",
        "Second paragraph.",
        "Third paragraph."
      ]
    }
  ]
}

Rules:
- Output exactly ONE patch for the entity.
- The description field is an ARRAY OF STRINGS — each string is one paragraph.
- Output the COMPLETE description — not a diff.
- Do not include a summary field (summaries are not copy-edited).
- Do not include an anchorPhrase field.
- If the description needs no changes, output it unchanged.`;

// ============================================================================
// Context Assembly
// ============================================================================

interface CopyEditEntityMeta {
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype?: string;
  entityCulture?: string;
  entityProminence?: string;
  kindFocus?: string;
  visualThesis?: string;
  summary?: string;
  relationships?: Array<{ kind: string; targetName: string; targetKind: string }>;
}

function buildUserPrompt(
  description: string,
  meta: CopyEditEntityMeta,
): string {
  const sections: string[] = [];

  // Entity identity
  const identParts: string[] = [];
  identParts.push(`Name: ${meta.entityName}`);
  identParts.push(`Kind: ${meta.entityKind}${meta.entitySubtype ? ` / ${meta.entitySubtype}` : ''}`);
  if (meta.entityCulture) identParts.push(`Culture: ${meta.entityCulture}`);
  if (meta.entityProminence) identParts.push(`Prominence: ${meta.entityProminence}`);
  sections.push(`=== ENTITY ===\n${identParts.join('\n')}`);

  // Kind-specific focus
  if (meta.kindFocus) {
    sections.push(`=== DESCRIPTION FOCUS (${meta.entityKind}) ===\n${meta.kindFocus}`);
  }

  // Summary (context only)
  if (meta.summary) {
    sections.push(`=== SUMMARY (context only — do not edit) ===\n${meta.summary}`);
  }

  // Visual thesis
  if (meta.visualThesis) {
    sections.push(`=== VISUAL THESIS (do not contradict) ===\n${meta.visualThesis}`);
  }

  // Relationships
  if (meta.relationships && meta.relationships.length > 0) {
    const relLines = meta.relationships.map(
      (r) => `  - ${r.kind} → ${r.targetName} (${r.targetKind})`
    );
    sections.push(`=== RELATIONSHIPS (use for introducing referenced entities) ===\n${relLines.join('\n')}`);
  }

  // Current description (numbered paragraphs)
  const paragraphs = description.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length > 1) {
    const numbered = paragraphs.map((p, i) => `  [${i + 1}] ${p.trim()}`).join('\n');
    sections.push(`=== CURRENT DESCRIPTION (${paragraphs.length} paragraphs) ===\n${numbered}`);
  } else {
    sections.push(`=== CURRENT DESCRIPTION ===\n${description}`);
  }

  sections.push(`=== YOUR TASK ===
Copy-edit the description for readability. Fix pronoun ambiguity, introduce unexplained references using the relationships above, break dense sentences, and compress any narrative bleed. Preserve every fact and the world's voice.

Entity: ${meta.entityName} (${meta.entityKind})
ID: ${meta.entityId}`);

  return sections.join('\n\n');
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeCopyEditTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: 'runId (chronicleId) required for copy edit task' };
  }

  // Read current run state
  const run = await getRevisionRun(runId);
  if (!run) {
    return { success: false, error: `Copy edit run ${runId} not found` };
  }

  // Single batch (index 0)
  const batchIndex = run.currentBatchIndex;
  const batch = run.batches[batchIndex];
  if (!batch || batch.status !== 'pending') {
    return { success: false, error: `No pending batch at index ${batchIndex}` };
  }

  // Mark batch as generating
  const updatedBatches = [...run.batches];
  updatedBatches[batchIndex] = { ...batch, status: 'generating' };
  await updateRevisionRun(runId, { status: 'generating', batches: updatedBatches });

  // Entity metadata is stored in staticPagesContext (repurposed) as JSON
  let meta: CopyEditEntityMeta;
  try {
    meta = JSON.parse(run.staticPagesContext);
  } catch {
    const errorMsg = 'Failed to parse entity metadata from staticPagesContext';
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'failed', batches: updatedBatches });
    return { success: false, error: errorMsg };
  }

  // Description is stored in worldDynamicsContext (repurposed)
  const description = run.worldDynamicsContext;
  if (!description) {
    const errorMsg = 'No description found in worldDynamicsContext';
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'failed', batches: updatedBatches });
    return { success: false, error: errorMsg };
  }

  const callConfig = getCallConfig(config, 'description.copyEdit');
  const userPrompt = buildUserPrompt(description, meta);

  try {
    const callResult = await runTextCall({
      llmClient,
      callType: 'description.copyEdit',
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
    });

    if (isAborted()) {
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: 'Task aborted' };
      await updateRevisionRun(runId, { status: 'failed', batches: updatedBatches });
      return { success: false, error: 'Task aborted' };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
      await updateRevisionRun(runId, { status: 'run_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: SummaryRevisionLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.patches)) throw new Error('Missing patches array');

      // Normalize description: LLM returns string[] (paragraphs), join to single string
      for (const patch of parsed.patches) {
        if (Array.isArray(patch.description)) {
          patch.description = patch.description.join('\n\n');
        }
      }
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
      await updateRevisionRun(runId, { status: 'run_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Update batch with patches — single batch so always run_reviewing
    updatedBatches[batchIndex] = {
      ...batch,
      status: 'complete',
      patches: parsed.patches,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    };

    await updateRevisionRun(runId, {
      status: 'run_reviewing',
      batches: updatedBatches,
      totalInputTokens: run.totalInputTokens + callResult.usage.inputTokens,
      totalOutputTokens: run.totalOutputTokens + callResult.usage.outputTokens,
      totalActualCost: run.totalActualCost + callResult.usage.actualCost,
    });

    // Record cost
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: 'copyEdit' as CostType,
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
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'run_reviewing', batches: updatedBatches });
    return { success: false, error: `Copy edit failed: ${errorMsg}` };
  }
}

export const copyEditTask = {
  type: 'copyEdit' as const,
  execute: executeCopyEditTask,
};
