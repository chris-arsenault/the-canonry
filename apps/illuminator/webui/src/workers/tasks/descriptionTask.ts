import type { WorkerTask, DescriptionChainDebug } from '../../lib/enrichmentTypes';
import type { EraTemporalInfo } from '../../lib/chronicleTypes';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';
import {
  getTraitGuidance,
  registerUsedTraits,
  incrementPaletteUsage,
  type TraitGuidance,
} from '../../lib/db/traitRepository';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { parseJsonObject } from './textParsing';
import type { TaskHandler } from './taskTypes';

// ============================================================================
// Era Timeline Helpers (same format as chronicle prompts)
// ============================================================================

/**
 * Add "the" article to an era name, handling names that already start with "The".
 */
function withArticle(name: string): string {
  if (name.startsWith('The ')) {
    return 'the ' + name.slice(4);
  }
  return 'the ' + name;
}

/**
 * Build a natural language world timeline.
 * E.g., "The world passed through the Dawn Age, then the Age of Expansion. It now exists in the Clever Ice Age."
 */
function buildWorldTimeline(eras: EraTemporalInfo[], focalEraId: string): string {
  const sorted = [...eras].sort((a, b) => a.order - b.order);
  const focalIndex = sorted.findIndex(e => e.id === focalEraId);

  if (focalIndex === -1) return '';

  const past = sorted.slice(0, focalIndex);
  const current = sorted[focalIndex];
  const future = sorted.slice(focalIndex + 1);

  const parts: string[] = [];

  if (past.length > 0) {
    const pastNames = past.map(e => withArticle(e.name)).join(', then ');
    parts.push(`The world passed through ${pastNames}.`);
  }

  parts.push(`It now exists in ${withArticle(current.name)}.`);

  if (future.length > 0) {
    const futureNames = future.map(e => withArticle(e.name)).join(', then ');
    parts.push(`${futureNames} ${future.length === 1 ? 'lies' : 'lie'} ahead.`);
  }

  return parts.join(' ');
}

/**
 * Build the historical context section for description prompts.
 * Includes focal era name, summary, and world timeline.
 */
function buildHistoricalContext(focalEra: EraTemporalInfo | undefined, allEras: EraTemporalInfo[] | undefined): string {
  if (!focalEra || !allEras || allEras.length === 0) return '';

  const lines: string[] = ['HISTORICAL CONTEXT:'];

  // Focal era name and summary
  lines.push(`Era: ${focalEra.name}`);
  if (focalEra.summary) {
    lines.push(focalEra.summary);
  }

  // World timeline (natural language)
  lines.push('');
  lines.push(buildWorldTimeline(allEras, focalEra.id));

  return lines.join('\n');
}

// ============================================================================
// Chain Prompts: Narrative -> Visual Thesis -> Visual Traits
// ============================================================================

/**
 * Step 1: Narrative prompt - rich description, summary, aliases
 *
 * @param narrativeHint - Narrative fragment to guide description generation
 * @param lockedSummary - If true, summary is locked and should not be generated
 */
function buildNarrativePrompt(narrativeHint?: string, lockedSummary?: boolean): string {
  const hintBlock = narrativeHint
    ? `NARRATIVE HINT (do not contradict):\n"${narrativeHint}"\n\n`
    : '';

  if (lockedSummary) {
    // Mode: Expand narrative hint into description
    return `You expand narrative hints into rich descriptions. Your prompt contains:

${hintBlock}WORLD DATA:
- Historical Context: Era and world timeline
- Entity: Core identity (kind, status, prominence, culture)
- Relationships: Connections with strength markers
- Cultural Identity: How this culture thinks, speaks, acts

TASK DATA:
- Output: JSON with description, aliases

Expand and enrich. Don't paraphrase the hint.`;
  }

  // Standard mode: Generate both summary and description
  return `You are a creative writer building world lore. Your prompt contains:

${hintBlock}WORLD DATA:
- Historical Context: Era and world timeline
- Entity: Core identity (kind, status, prominence, culture)
- Relationships: Connections with strength markers
- Cultural Identity: How this culture thinks, speaks, acts

TASK DATA:
- Output: JSON with summary, description, aliases

Write personality over plot. One [strong] relationship anchors the narrative.

USING EVENTS: Notable events are SOURCE MATERIAL, not a checklist. Pick 1-2 evocative moments to weave deeply into the description. Leave most events implied or unmentioned. The description is a narrative impression, not a timeline.`;
}

/**
 * Step 2: Visual thesis prompt - ONE sentence describing the dominant visual feature
 *
 * @param kindInstructions - REQUIRED per-kind domain instructions (VFX, environment, character)
 * @param visualAvoid - Optional project-specific elements to avoid
 */
function buildVisualThesisPrompt(
  kindInstructions: string,
  visualAvoid?: string
): string {
  let prompt = `You distill descriptions into dominant visual signals. Your prompt contains:

- Visual Context: Entity basics and culture
- Description: Source material
- Per-Kind Guidance: What to emphasize

Output ONE sentence. Shape only - no color, texture, or suggestive language ("as if", "suggesting").`;

  if (visualAvoid) {
    prompt += `\n\nAVOID: ${visualAvoid}`;
  }

  prompt += `\n\n${kindInstructions}`;

  return prompt;
}

/**
 * Step 3: Visual traits prompt - 2-4 traits EXPANDING the visual identity
 *
 * @param kindInstructions - REQUIRED per-kind domain instructions
 * @param guidance - Optional palette guidance for diversity
 * @param subtype - Optional entity subtype for context
 */
function buildVisualTraitsPrompt(
  kindInstructions: string,
  guidance?: TraitGuidance,
  subtype?: string
): string {
  let prompt = `You expand visual theses with supporting details. Your prompt contains:

- Thesis: Primary visual signal (don't repeat)
- Visual Context: Entity basics and culture
- Description: Source for additional features
- Palette Guidance: Required directions (if provided)

Output 2-4 traits, one per line. Each 3-8 words, adding something NEW.`;

  prompt += `\n\n${kindInstructions}`;

  if (subtype) {
    prompt += `\n\nSUBTYPE: ${subtype}`;
  }

  if (guidance && guidance.assignedCategories.length > 0) {
    prompt += `\n\nREQUIRED DIRECTIONS (address at least one):`;
    for (const p of guidance.assignedCategories) {
      prompt += `\n- ${p.category}: ${p.description} (e.g., ${p.examples.slice(0, 2).join(', ')})`;
    }
  }

  return prompt;
}

export const descriptionTask = {
  type: 'description',
  async execute(task, context) {
    const { config, llmClient, isAborted } = context;

    if (!llmClient.isEnabled()) {
      return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
    }

    // Track cumulative costs across all chain steps
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalActualCost = 0;

    // Track debug info for all steps
    const chainDebug: DescriptionChainDebug = {};

    // ============================================================================
    // Step 1: Narrative (description, summary, aliases)
    // ============================================================================
    console.log('[Worker] Description chain step 1: Narrative');

    const narrativeConfig = getCallConfig(config, 'description.narrative');

    // Strip output format instructions from task.prompt - each step has its own format
    const baseEntityContext = task.prompt
      .replace(/OUTPUT FORMAT.*$/s, '')
      .replace(/FORMAT:\s*\n.*$/s, '')
      .trim();

    // Build historical context (era timeline) if era info is available
    const historicalContext = buildHistoricalContext(task.entityFocalEra, task.entityAllEras);

    // Combine historical context with entity context
    const entityContext = historicalContext
      ? `${historicalContext}\n\n---\n\n${baseEntityContext}`
      : baseEntityContext;

    // Use narrative hint as input (summary remains locked if provided)
    const narrativeHint = task.entityNarrativeHintText;
    const lockedSummary = task.entityLockedSummaryText;

    const narrativeCall = await runTextCall({
      llmClient,
      callType: 'description.narrative',
      callConfig: narrativeConfig,
      systemPrompt: buildNarrativePrompt(narrativeHint, Boolean(lockedSummary)),
      prompt: entityContext,
      temperature: 0.7,
    });
    const narrativeResult = narrativeCall.result;
    chainDebug.narrative = narrativeResult.debug;

    if (isAborted()) {
      return { success: false, error: 'Task aborted', debug: narrativeResult.debug };
    }

    if (narrativeResult.error || !narrativeResult.text) {
      return { success: false, error: `Narrative step failed: ${narrativeResult.error || 'Empty response'}`, debug: narrativeResult.debug };
    }

    // Parse narrative response
    let narrativePayload: { summary: string; description: string; aliases: string[] };
    try {
      const parsed = parseJsonObject<Record<string, unknown>>(narrativeResult.text, 'description');
      const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
      const aliases = Array.isArray(parsed.aliases)
        ? parsed.aliases.filter((a): a is string => typeof a === 'string').map(a => a.trim()).filter(Boolean)
        : [];

      if (lockedSummary) {
        // Locked summary mode: use canonical summary, only description from LLM
        if (!description) {
          throw new Error('Missing description');
        }
        narrativePayload = {
          summary: lockedSummary,
          description,
          aliases,
        };
      } else {
        // Standard mode: parse both summary and description from LLM
        const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
        if (!summary || !description) {
          throw new Error('Missing summary or description');
        }
        narrativePayload = {
          summary,
          description,
          aliases,
        };
      }
    } catch (err) {
      return {
        success: false,
        error: `Narrative parse failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        debug: narrativeResult.debug,
      };
    }

    totalInputTokens += narrativeCall.usage.inputTokens;
    totalOutputTokens += narrativeCall.usage.outputTokens;
    totalActualCost += narrativeCall.usage.actualCost;

    // ============================================================================
    // Step 2: Visual Thesis (given description)
    // ============================================================================
    console.log('[Worker] Description chain step 2: Visual Thesis');

    const thesisConfig = getCallConfig(config, 'description.visualThesis');

    // Build slimmed down visual context - remove noise that doesn't inform silhouette
    // Extract: entity basics and CULTURAL VISUAL IDENTITY (for visual thesis/traits)
    // NOTE: World description removed - it's noise for silhouette decisions. Culture identity has the visual signal.
    const visualIdentityMatch = entityContext.match(/CULTURAL VISUAL IDENTITY[^:]*:\n((?:- [A-Z_]+: .+\n?)+)/);
    const visualIdentityContext = visualIdentityMatch ? visualIdentityMatch[0].trim() : '';

    const visualContext = `Entity: ${task.entityName} (${task.entityKind})
Culture: ${task.entityCulture || 'unaffiliated'}${visualIdentityContext ? `\n\n${visualIdentityContext}` : ''}`;

    // Validate instructions are provided (from defaults or per-kind override)
    if (!task.visualThesisInstructions) {
      return {
        success: false,
        error: `Missing visualThesisInstructions for entity kind '${task.entityKind}'. Configure in entityGuidance.${task.entityKind}.visualThesis`,
      };
    }

    // Build thesis prompt - use per-kind framing if provided
    const thesisFraming = task.visualThesisFraming || '';
    const thesisPrompt = `${thesisFraming ? thesisFraming + '\n\n' : ''}${visualContext}

DESCRIPTION (extract visual elements from this):
${narrativePayload.description}

Generate the visual thesis.`;

    // Build system prompt with per-kind instructions
    const thesisSystemPrompt = buildVisualThesisPrompt(task.visualThesisInstructions, task.visualAvoid);

    const thesisCall = await runTextCall({
      llmClient,
      callType: 'description.visualThesis',
      callConfig: thesisConfig,
      systemPrompt: thesisSystemPrompt,
      prompt: thesisPrompt,
      temperature: 0.7,
    });
    const thesisResult = thesisCall.result;
    chainDebug.thesis = thesisResult.debug;

    if (isAborted()) {
      return { success: false, error: 'Task aborted', debug: thesisResult.debug };
    }

    if (thesisResult.error || !thesisResult.text) {
      return { success: false, error: `Visual thesis step failed: ${thesisResult.error || 'Empty response'}`, debug: thesisResult.debug };
    }

    // Parse thesis response - plain text, just trim
    const visualThesis = thesisResult.text.trim();
    if (!visualThesis) {
      return {
        success: false,
        error: 'Visual thesis step returned empty response',
        debug: thesisResult.debug,
      };
    }

    totalInputTokens += thesisCall.usage.inputTokens;
    totalOutputTokens += thesisCall.usage.outputTokens;
    totalActualCost += thesisCall.usage.actualCost;

    // ============================================================================
    // Step 3: Visual Traits (given thesis + palette guidance)
    // ============================================================================
    console.log('[Worker] Description chain step 3: Visual Traits');

    const traitsConfig = getCallConfig(config, 'description.visualTraits');

    // Fetch trait guidance for diversity (run-scoped avoidance, project-scoped palette)
    // Pass subtype and era to filter categories relevant to this entity
    let traitGuidance: TraitGuidance | undefined;
    try {
      if (task.projectId && task.simulationRunId && task.entityKind) {
        traitGuidance = await getTraitGuidance(
          task.projectId,
          task.simulationRunId,
          task.entityKind,
          task.entitySubtype,
          task.entityEraId
        );
      }
    } catch (err) {
      // Non-fatal - continue without guidance
      console.warn('[Worker] Failed to fetch trait guidance:', err);
    }

    // Validate instructions are provided (from defaults or per-kind override)
    if (!task.visualTraitsInstructions) {
      return {
        success: false,
        error: `Missing visualTraitsInstructions for entity kind '${task.entityKind}'. Configure in entityGuidance.${task.entityKind}.visualTraits`,
      };
    }

    // Build traits prompt - use per-kind framing if provided
    const traitsFraming = task.visualTraitsFraming || '';
    const traitsPrompt = `${traitsFraming ? traitsFraming + '\n\n' : ''}THESIS (the primary silhouette - don't repeat, expand):
${visualThesis}

${visualContext}

DESCRIPTION (source material for additional distinctive features):
${narrativePayload.description}

Generate 2-4 visual traits that ADD to the thesis - features it didn't cover.`;

    // Build system prompt with per-kind instructions (include subtype for context)
    const traitsSystemPrompt = buildVisualTraitsPrompt(task.visualTraitsInstructions, traitGuidance, task.entitySubtype);

    const traitsCall = await runTextCall({
      llmClient,
      callType: 'description.visualTraits',
      callConfig: traitsConfig,
      systemPrompt: traitsSystemPrompt,
      prompt: traitsPrompt,
      temperature: 0.7,
    });
    const traitsResult = traitsCall.result;
    chainDebug.traits = traitsResult.debug;

    if (isAborted()) {
      return { success: false, error: 'Task aborted', debug: traitsResult.debug };
    }

    if (traitsResult.error || !traitsResult.text) {
      return { success: false, error: `Visual traits step failed: ${traitsResult.error || 'Empty response'}`, debug: traitsResult.debug };
    }

    // Parse traits response - one trait per line
  const visualTraits = traitsResult.text
    .split('\n')
    .map(line => line.replace(/^[-*\u2022]\s*/, '').trim())  // Strip bullet markers
    .filter(line => line.length > 0);  // Filter empty lines

    totalInputTokens += traitsCall.usage.inputTokens;
    totalOutputTokens += traitsCall.usage.outputTokens;
    totalActualCost += traitsCall.usage.actualCost;

    // ============================================================================
    // Register traits and save cost record
    // ============================================================================

    // Register generated traits for future diversity guidance
    try {
      if (task.projectId && task.simulationRunId && task.entityKind && visualTraits.length > 0) {
        await registerUsedTraits(
          task.projectId,
          task.simulationRunId,
          task.entityKind,
          task.entityId,
          task.entityName,
          visualTraits
        );
        // Increment palette category usage counters (for weighted selection)
        await incrementPaletteUsage(task.projectId, task.entityKind, visualTraits);
      }
    } catch (err) {
      // Non-fatal - continue without registration
      console.warn('[Worker] Failed to register traits:', err);
    }

    const estimatedTotals = {
      estimatedCost: narrativeCall.estimate.estimatedCost + thesisCall.estimate.estimatedCost + traitsCall.estimate.estimatedCost,
      inputTokens: narrativeCall.estimate.inputTokens + thesisCall.estimate.inputTokens + traitsCall.estimate.inputTokens,
      outputTokens: narrativeCall.estimate.outputTokens + thesisCall.estimate.outputTokens + traitsCall.estimate.outputTokens,
    };

    // Save cost record with combined totals (use narrative model as primary for record)
    await saveCostRecordWithDefaults({
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      entityId: task.entityId,
      entityName: task.entityName,
      entityKind: task.entityKind,
      type: 'description' as CostType,
      model: narrativeConfig.model,
      estimatedCost: estimatedTotals.estimatedCost,
      actualCost: totalActualCost,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    });

    console.log(`[Worker] Description chain complete: ${totalInputTokens} in / ${totalOutputTokens} out, $${totalActualCost.toFixed(4)}`);

    return {
      success: true,
      result: {
        summary: narrativePayload.summary,
        description: narrativePayload.description,
        aliases: narrativePayload.aliases,
        visualThesis,
        visualTraits,
        generatedAt: Date.now(),
        model: narrativeConfig.model,  // Primary model for display
        estimatedCost: estimatedTotals.estimatedCost,
        actualCost: totalActualCost,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        // Include chain debug for all 3 steps
        chainDebug,
      },
      // Legacy single debug field for error reporting
      debug: traitsResult.debug,
    };
  },
} satisfies TaskHandler<WorkerTask & { type: 'description' }>;
