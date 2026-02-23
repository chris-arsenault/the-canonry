/**
 * Tone Ranking Worker Task
 *
 * Sends a chronicle's summary to Haiku, gets a ranked top-3 tone selection
 * for historian annotations, and writes results to the chronicle record.
 *
 * Payload is JSON-serialized in the prompt field.
 */

import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import type { HistorianTone } from '../../lib/historianTypes';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { updateChronicleToneRanking } from '../../lib/db/chronicleRepository';

// ============================================================================
// Payload type (JSON in prompt field)
// ============================================================================

interface ToneRankingPayload {
  chronicleId: string;
  summary: string;
  format: string;
  narrativeStyleName?: string;
  /** Perspective synthesis brief — the chronicle's interpretive thesis */
  brief?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VALID_TONES = new Set<HistorianTone>(['witty', 'weary', 'elegiac', 'cantankerous', 'rueful', 'conspiratorial', 'bemused']);

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You will receive a chronicle summary. Determine which historian annotation tone will resonate best with the material.

For each of the 7 tones below, answer its question about the chronicle:

- **witty**: Is this text funnier than it realizes?
- **weary**: Have I read this story before in different names?
- **elegiac**: Is something specific gone forever?
- **cantankerous**: Is the text wrong about something?
- **rueful**: Is someone making a mistake they can't see?
- **conspiratorial**: Is the text hiding something specific?
- **bemused**: Is this genuinely weird?

Rank the 3 tones that get the strongest "yes." For each, state what in the text answers that question.

You must respond with ONLY a JSON object in this exact format, no other text:
{ "ranking": ["tone1", "tone2", "tone3"], "rationales": { "tone1": "answer...", "tone2": "answer...", "tone3": "answer..." } }`;

function buildUserPrompt(payload: ToneRankingPayload): string {
  const lines: string[] = [];
  lines.push('Evaluate this chronicle:');
  lines.push('');
  lines.push(`Format: ${payload.format}`);
  if (payload.narrativeStyleName) {
    lines.push(`Style: ${payload.narrativeStyleName}`);
  }
  lines.push(`Summary: ${payload.summary}`);
  if (payload.brief) {
    lines.push(`Perspective brief: ${payload.brief}`);
  }
  return lines.join('\n');
}

// ============================================================================
// Task Handler
// ============================================================================

export const toneRankingTask = {
  type: 'toneRanking' as const,

  async execute(task: WorkerTask, context: TaskContext): Promise<TaskResult> {
    const callConfig = getCallConfig(context.config, 'chronicle.toneRanking');

    let payload: ToneRankingPayload;
    try {
      payload = JSON.parse(task.prompt);
    } catch {
      return { success: false, error: 'Invalid tone ranking payload' };
    }

    if (!payload.chronicleId || !payload.summary) {
      return { success: false, error: 'Missing required fields in tone ranking payload' };
    }

    const userPrompt = buildUserPrompt(payload);

    const { result, usage } = await runTextCall({
      llmClient: context.llmClient,
      callType: 'chronicle.toneRanking',
      callConfig,
      systemPrompt: SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    // Parse the JSON response
    const responseText = result.text.trim();
    const jsonText = responseText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

    let parsed: { ranking: string[]; rationales?: Record<string, string>; rationale?: string };
    try {
      parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed.ranking)) throw new Error('Expected ranking array');
    } catch {
      return { success: false, error: `Failed to parse LLM response as JSON: ${responseText.slice(0, 200)}` };
    }

    // Validate exactly 3 valid tones
    const validRanking = parsed.ranking.filter((t) => VALID_TONES.has(t as HistorianTone));
    if (validRanking.length < 3) {
      return { success: false, error: `Expected 3 valid tones, got ${validRanking.length}: ${parsed.ranking.join(', ')}` };
    }

    const ranking = validRanking.slice(0, 3) as [string, string, string];
    // Support both new per-tone rationales and legacy single rationale
    const rationales = parsed.rationales || {};
    const rationale = parsed.rationale || rationales[ranking[0]] || '';

    // Write to chronicle record
    await updateChronicleToneRanking(payload.chronicleId, ranking, rationale, usage.actualCost, rationales);

    return {
      success: true,
      result: {
        description: JSON.stringify({ ranking, rationale }),
        generatedAt: Date.now(),
        model: callConfig.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        actualCost: usage.actualCost,
      },
    };
  },
};
