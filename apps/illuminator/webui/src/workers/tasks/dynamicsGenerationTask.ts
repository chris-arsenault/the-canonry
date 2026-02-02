/**
 * Dynamics Generation Worker Task
 *
 * Reads run state from IndexedDB, assembles context (static pages + schema
 * + conversation history + search results), makes one LLM call, and writes
 * the response back to IndexedDB.
 *
 * Each invocation handles a single LLM turn. The UI re-dispatches for
 * subsequent turns after search execution or user feedback.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type {
  DynamicsLLMResponse,
  DynamicsMessage,
} from '../../lib/dynamicsGenerationTypes';
import { getDynamicsRun, updateDynamicsRun } from '../../lib/db/dynamicsRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are a world dynamics analyst for a procedural fantasy world generation system. You produce world-state statements that describe the forces, tensions, and relationships between groups that shape this world. These statements will be provided as context to an LLM chronicle writer.

You will receive:
1. LORE BIBLE: Static pages — the canonical source of world lore, culture, history, and mechanics
2. SCHEMA: Entity kinds, relationship kinds, and culture definitions
3. WORLD STATE: All entity summaries (grouped by kind), relationship patterns, and era data from the simulation
4. CONVERSATION HISTORY: Previous turns and user feedback (on refinement turns)

## How Dynamics Are Used

Dynamics are injected into a chronicle generation prompt ALONGSIDE these other context layers:
- **World facts**: Canonical truths about the world (e.g., treaty names, geographic features, rules of magic). Already present.
- **Cultural identities**: Per-culture trait bundles (speech patterns, values, fears, taboos). Already present.
- **Tone fragments**: Voice, mood, irony, behavioral/psychological guidance for how characters act and feel. Already present.
- **World dynamics**: YOUR OUTPUT — the current state of forces between groups, ongoing conflicts, active threats, and situational truths that change across eras.

World facts are static and timeless. Tone covers how characters behave and how prose should read. Cultural identities cover what each culture values.

Your job is to describe **what is happening in the world** at a macro level — the active forces, conflicts, alliances, and situational truths that the chronicle writer needs to know about but that don't fit in static facts or tone guidance.

## What Dynamics Are

A dynamic describes a force or condition operating in the world. Think of them as era-aware world facts — statements about the state of things between groups, regions, or forces that the chronicle writer should account for.

Dynamics should be:
- **Concise**: 1-3 sentences. State the force clearly without literary embellishment.
- **About the world, not characters**: Describe what's happening between groups, cultures, forces — not what individuals feel or fear. Tone and cultural identity handle character psychology.
- **Not redundant with world facts**: World facts cover static truths. Dynamics cover things that shift across eras or describe active tensions/forces that static facts don't capture.
- **Actionable for a writer**: A chronicle writer reading this should understand what backdrop forces are at play when writing about the relevant cultures/kinds.

## Era Overrides

Dynamics change across eras — that's what makes them dynamic rather than static facts. Use era overrides to describe how the force or condition changes in a specific era.

Use the era entity IDs from the WORLD STATE section to key your overrides.

Era override modes:
- \`"replace": true\` — This era's text REPLACES the base dynamic entirely. Use when the force is suspended, inverted, or fundamentally different.
- \`"replace": false\` — This era's text is APPENDED as additional context. Use when the era adds a specific dimension.

Keep era override text concise — 1-2 sentences. Only include overrides where the force genuinely changes. Not every dynamic needs overrides for every era.

## Output Format

Output ONLY valid JSON:
{
  "dynamics": [
    {
      "text": "Concise statement of the world force or condition",
      "cultures": ["culture1"],
      "kinds": ["kind1"],
      "eraOverrides": {
        "era_id_here": { "text": "How this force changes in this era", "replace": false },
        "era_id_here": { "text": "In this era, this force is suspended/replaced by...", "replace": true }
      }
    }
  ],
  "reasoning": "Your analysis of what forces you identified and why they matter for chronicle generation",
  "complete": false
}

## Guidelines

- **Do not restate world facts.** Static truths are already provided. Focus on active forces and tensions.
- **Do not write character psychology.** Tone and cultural identities handle how characters think, feel, and behave. Dynamics describe the world they operate in.
- **Do not write prose.** Keep statements direct and factual in register. No dramatic kickers or literary flourishes.
- **Do not describe mechanics.** How systems work (magic costs, corruption spread, huddle logistics) are rules, not dynamics.
- **Ground dynamics in specific entities.** Reference factions, locations, artifacts, and NPCs by name where they're central to the force you're describing. A dynamic about inter-colony trade tension should name the colonies and the trade route, not describe it abstractly.
- Aim for 6-10 dynamics. Fewer, sharper statements are better than many overlapping ones.
- Cultures and kinds filters scope when the dynamic is relevant. Omit for universal dynamics.
- Set "complete": true when you believe the set is sufficient.`;

// ============================================================================
// Context Assembly
// ============================================================================

function buildUserPrompt(run: { messages: DynamicsMessage[]; userFeedback?: string }): string {
  const sections: string[] = [];

  // Rebuild conversation from messages
  for (const msg of run.messages) {
    if (msg.role === 'system') {
      sections.push(msg.content);
    } else if (msg.role === 'assistant') {
      sections.push(`=== YOUR PREVIOUS RESPONSE ===\n${msg.content}`);
    } else if (msg.role === 'user') {
      sections.push(`=== USER FEEDBACK ===\n${msg.content}`);
    }
  }

  // Add user feedback if present
  if (run.userFeedback) {
    sections.push(`=== USER FEEDBACK ===\n${run.userFeedback}`);
  }

  // Add task instruction
  const isFirstTurn = run.messages.filter((m) => m.role === 'assistant').length === 0;
  if (isFirstTurn) {
    sections.push(`=== YOUR TASK ===
Based on the lore bible, schema, and world state above, identify the world dynamics — the macro-level forces, tensions, alliances, and behavioral patterns that drive stories in this world.

Use the entity summaries and relationship data to ground your dynamics in the actual simulation state.`);
  } else {
    sections.push(`=== YOUR TASK ===
Continue refining the world dynamics based on user feedback. Propose updated dynamics.`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Task Execution
// ============================================================================

async function executeDynamicsGenerationTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const runId = task.chronicleId; // Repurposing chronicleId field for runId
  if (!runId) {
    return { success: false, error: 'runId (chronicleId) required for dynamics generation' };
  }

  // Read current run state
  const run = await getDynamicsRun(runId);
  if (!run) {
    return { success: false, error: `Dynamics run ${runId} not found` };
  }

  // Mark as generating
  await updateDynamicsRun(runId, { status: 'generating' });

  const callConfig = getCallConfig(config, 'dynamics.generation');
  const userPrompt = buildUserPrompt(run);

  try {
    const callResult = await runTextCall({
      llmClient,
      callType: 'dynamics.generation',
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.7,
    });

    if (isAborted()) {
      await updateDynamicsRun(runId, { status: 'failed', error: 'Task aborted' });
      return { success: false, error: 'Task aborted' };
    }

    const resultText = callResult.result.text?.trim();
    if (callResult.result.error || !resultText) {
      const errorMsg = `LLM call failed: ${callResult.result.error || 'No text returned'}`;
      await updateDynamicsRun(runId, { status: 'failed', error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Parse LLM response
    let parsed: DynamicsLLMResponse;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON object found');
      parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.dynamics)) throw new Error('Missing dynamics array');
      if (typeof parsed.reasoning !== 'string') parsed.reasoning = '';
      if (typeof parsed.complete !== 'boolean') parsed.complete = false;
    } catch (err) {
      const errorMsg = `Failed to parse LLM response: ${err instanceof Error ? err.message : String(err)}`;
      await updateDynamicsRun(runId, { status: 'failed', error: errorMsg });
      return { success: false, error: errorMsg };
    }

    // Build updated messages
    const newMessages: DynamicsMessage[] = [...run.messages];

    // Add user feedback as a message if provided
    if (run.userFeedback) {
      newMessages.push({ role: 'user', content: run.userFeedback, timestamp: Date.now() });
    }

    // Add assistant response
    newMessages.push({ role: 'assistant', content: resultText, timestamp: Date.now() });

    // Update run
    await updateDynamicsRun(runId, {
      status: 'awaiting_review',
      messages: newMessages,
      proposedDynamics: parsed.dynamics,
      userFeedback: undefined,  // Clear consumed feedback
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
      type: 'dynamicsGeneration' as CostType,
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
    await updateDynamicsRun(runId, { status: 'failed', error: errorMsg });
    return { success: false, error: `Dynamics generation failed: ${errorMsg}` };
  }
}

export const dynamicsGenerationTask = {
  type: 'dynamicsGeneration' as const,
  execute: executeDynamicsGenerationTask,
};
