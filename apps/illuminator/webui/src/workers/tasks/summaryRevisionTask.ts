/**
 * Summary Revision Worker Task
 *
 * Reads run state from IndexedDB, assembles context for the current batch
 * (world dynamics + lore + entity data), makes one LLM call per batch,
 * and writes the resulting patches back to IndexedDB.
 *
 * Each invocation handles a single batch. The UI dispatches the next batch
 * after the user reviews the current one.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type {
  SummaryRevisionLLMResponse,
  RevisionEntityContext,
} from '../../lib/summaryRevisionTypes';
import { getRevisionRun, updateRevisionRun } from '../../lib/db/summaryRevisionRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are rewriting entity summaries and descriptions for a procedural fantasy world generation system. You receive the current text as reference for each entity's identity, role, and narrative intent. Write new text that preserves this intent but integrates world dynamics, lore context, and culture-specific voice naturally.

## Your Role

These entities were originally written one at a time with only their relationships and tags as context. You now have the full picture — world dynamics, lore, and the other entities in the same culture. Write as if you had all this context from the beginning.

The current text tells you WHO this entity is and WHAT they do. Your rewrite should tell the same story but with awareness of the world they live in.

## What You Receive

1. WORLD DYNAMICS: Era-aware world facts — the active forces, tensions, and alliances operating in this world
2. LORE BIBLE: Static pages of canonical world lore
3. SCHEMA: Entity kinds and relationship kinds
4. BATCH ENTITIES: A group of entities from the same culture, each with current summary, description, visual thesis, and relationships

## Rewrite Guidelines

### CRITICAL: Visual Thesis Preservation
Each entity has a visual thesis used for image generation. Your rewrites MUST NOT contradict it. If the thesis says "a scarred penguin clutching a cracked shield," keep references to scarring and the shield.

### How to Rewrite

**Preserve the intent, change the telling.** You are not inventing new entities or changing what they do. You are retelling their story with fuller awareness of their world.

**Let dynamics inform the narrative, not decorate it.** Do NOT insert faction names or dynamics references as addenda to existing sentences. If a dynamic is relevant to an entity, it should shape how you frame that entity's situation — their motivations, their constraints, their position relative to other forces. The reader should feel the world pressing in on the entity without seeing a list of faction names bolted on.

**Bad example:** "She controls the trade route, though the rise of Qingfu'spire has shifted power away from merchant display toward political consolidation."
**Good example:** "She controls the trade route — or did, before the councils began demanding taxes she'd never been asked to pay. The merchants who once competed for her favor now compete for seats."

**Vary the emotional register.** Not every entity should feel anxious, wounded, or haunted. Use the full range: pragmatic, ambitious, curious, resigned, defiant, indifferent, obsessive.

**Strengthen culture-specific voice:**
- Aurora Stack: astronomical/measurement metaphors, political accountability, aurora-light sensory details
- Nightshelf: guild/transaction language, fire-core mechanics, tunnel/depth imagery
- Orca: predatory/sensory language, whale-song, pressure-depth, alien perspective

**Ensure diversity across the batch.** Read all entities before writing. Avoid repeating the same metaphors, sentence structures, or emotional beats across entities.

### Constraints
- Preserve the entity's fundamental identity, role, and status
- Do not contradict the visual thesis
- Do not add information unsupported by relationships or world context
- Do not add poetic flourishes beyond what already exists in the current text
- Rewrite every entity in the batch — these were all written without world context

## Output Format

Output ONLY valid JSON:
{
  "patches": [
    {
      "entityId": "entity_id_here",
      "entityName": "Entity Name",
      "entityKind": "npc",
      "summary": "Complete rewritten summary text",
      "description": "Complete rewritten description text"
    }
  ]
}

Rules:
- Include EVERY entity in the batch. Each was written without world dynamics and needs a rewrite.
- Output BOTH summary and description for each entity.
- Output the complete rewritten text for each field, not a diff.`;

// ============================================================================
// Context Assembly
// ============================================================================

function buildUserPrompt(
  entities: RevisionEntityContext[],
  worldDynamicsContext: string,
  staticPagesContext: string,
  schemaContext: string,
  revisionGuidance: string,
  culture: string,
): string {
  const sections: string[] = [];

  // World dynamics
  if (worldDynamicsContext) {
    sections.push(`=== WORLD DYNAMICS ===\n${worldDynamicsContext}`);
  }

  // Lore bible (excerpt)
  if (staticPagesContext) {
    sections.push(`=== LORE BIBLE (excerpts) ===\n${staticPagesContext}`);
  }

  // Schema
  if (schemaContext) {
    sections.push(`=== SCHEMA ===\n${schemaContext}`);
  }

  // Additional revision guidance (user-editable)
  if (revisionGuidance) {
    sections.push(`=== ADDITIONAL REVISION GUIDANCE ===\n${revisionGuidance}`);
  }

  // Batch entities
  const entityLines: string[] = [];
  for (const e of entities) {
    const parts: string[] = [];
    parts.push(`### ${e.name} (${e.kind}${e.subtype ? ` / ${e.subtype}` : ''})`);
    parts.push(`ID: ${e.id}`);
    parts.push(`Prominence: ${e.prominence} | Culture: ${e.culture} | Status: ${e.status}`);

    if (e.visualThesis) {
      parts.push(`Visual Thesis (DO NOT CONTRADICT): ${e.visualThesis}`);
    }

    if (e.relationships.length > 0) {
      const relLines = e.relationships.map(
        (r) => `  - ${r.kind} → ${r.targetName} (${r.targetKind})`
      );
      parts.push(`Relationships:\n${relLines.join('\n')}`);
    }

    parts.push(`Summary: ${e.summary}`);
    parts.push(`Description: ${e.description}`);

    entityLines.push(parts.join('\n'));
  }

  sections.push(`=== BATCH: ${culture} (${entities.length} entities) ===\n\n${entityLines.join('\n\n---\n\n')}`);

  // Task instruction
  sections.push(`=== YOUR TASK ===
Rewrite the ${entities.length} entities above from the "${culture}" culture. These were written without world dynamics or lore context.

For each entity: read the current text to understand the entity's identity, role, and narrative intent. Then rewrite both summary and description as if you had all the world context from the beginning. The story should be the same — the telling should be richer.

Rewrite every entity. Preserve visual thesis. Output complete rewritten text for both fields.`);

  return sections.join('\n\n');
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeSummaryRevisionTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: 'runId (chronicleId) required for summary revision' };
  }

  // Read current run state
  const run = await getRevisionRun(runId);
  if (!run) {
    return { success: false, error: `Revision run ${runId} not found` };
  }

  // Find the current batch
  const batchIndex = run.currentBatchIndex;
  const batch = run.batches[batchIndex];
  if (!batch || batch.status !== 'pending') {
    return { success: false, error: `No pending batch at index ${batchIndex}` };
  }

  // Mark batch as generating
  const updatedBatches = [...run.batches];
  updatedBatches[batchIndex] = { ...batch, status: 'generating' };
  await updateRevisionRun(runId, { status: 'generating', batches: updatedBatches });

  // Entity data is passed via the task prompt field as JSON
  let entities: RevisionEntityContext[];
  try {
    entities = JSON.parse(task.prompt);
  } catch {
    const errorMsg = 'Failed to parse entity context from task prompt';
    updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
    await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
    return { success: false, error: errorMsg };
  }

  const callConfig = getCallConfig(config, 'revision.summary');
  const userPrompt = buildUserPrompt(
    entities,
    run.worldDynamicsContext,
    run.staticPagesContext,
    run.schemaContext,
    run.revisionGuidance,
    batch.culture,
  );

  try {
    const callResult = await runTextCall({
      llmClient,
      callType: 'revision.summary',
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.5,
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
      await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: SummaryRevisionLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.patches)) throw new Error('Missing patches array');
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      updatedBatches[batchIndex] = { ...batch, status: 'failed', error: errorMsg };
      await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
      return { success: false, error: errorMsg };
    }

    // Update batch with patches
    updatedBatches[batchIndex] = {
      ...batch,
      status: 'complete',
      patches: parsed.patches,
      inputTokens: callResult.usage.inputTokens,
      outputTokens: callResult.usage.outputTokens,
      actualCost: callResult.usage.actualCost,
    };

    // Check if all batches are complete
    const allComplete = updatedBatches.every(
      (b) => b.status === 'complete' || b.status === 'failed'
    );

    await updateRevisionRun(runId, {
      status: allComplete ? 'run_reviewing' : 'batch_reviewing',
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
      type: 'summaryRevision' as CostType,
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
    await updateRevisionRun(runId, { status: 'batch_reviewing', batches: updatedBatches });
    return { success: false, error: `Summary revision failed: ${errorMsg}` };
  }
}

export const summaryRevisionTask = {
  type: 'summaryRevision' as const,
  execute: executeSummaryRevisionTask,
};
