import type {
  WorkerTask,
} from '../../lib/enrichmentTypes';
import type {
  ChronicleGenerationContext,
  ChronicleImageRefs,
  ChronicleImageRef,
  EntityImageRef,
  PromptRequestRef,
  ChronicleImageSize,
} from '../../lib/chronicleTypes';
import { analyzeConstellation, type EntityConstellation } from '../../lib/constellationAnalyzer';
import {
  synthesizePerspective,
  type PerspectiveSynthesisResult,
} from '../../lib/perspectiveSynthesizer';
import type { PerspectiveSynthesisRecord } from '../../lib/chronicleTypes';
import type { ChronicleCoverImage } from '../../lib/chronicleTypes';
import { getCoverImageConfig, getScenePromptTemplate } from '../../lib/coverImageStyles';
import {
  createChronicle,
  type ChronicleRecord,
  regenerateChronicleAssembly,
  updateChronicleComparisonReport,
  updateChronicleSummary,
  updateChronicleTitle,
  updateChronicleImageRefs,
  updateChronicleImageRef,
  updateChronicleCoverImage,
  updateChronicleCoverImageStatus,
  updateChronicleFailure,
  getChronicle,
} from '../../lib/db/chronicleRepository';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';
import { resolveAnchorPhrase } from '../../lib/fuzzyAnchor';
import {
  selectEntitiesV2,
  buildV2Prompt,
  getMaxTokensFromStyle,
  getV2SystemPrompt,
  DEFAULT_V2_CONFIG,
} from '../../lib/chronicle/v2';
import type { NarrativeStyle } from '@canonry/world-schema';
import { runTextCall } from '../../lib/llmTextCall';
import { getCallConfig } from './llmCallConfig';
import { stripLeadingWrapper, parseJsonObject } from './textParsing';
import type { TaskHandler, TaskContext } from './taskTypes';
import type { TaskResult } from '../types';

// ============================================================================
// Chronicle Task Execution
// ============================================================================

async function markChronicleFailure(
  chronicleId: string,
  step: string,
  reason: string
): Promise<void> {
  await updateChronicleFailure(chronicleId, step, reason);
}

/**
 * Execute a SINGLE step of chronicle generation.
 * Each step pauses for user review before proceeding to the next.
 */
async function executeEntityChronicleTask(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!llmClient.isEnabled()) {
    return { success: false, error: 'Text generation not configured - missing Anthropic API key' };
  }

  const step = task.chronicleStep || 'generate_v2';
  console.log(`[Worker] Chronicle step=${step} for entity=${task.entityId}`);

  // V2 single-shot generation - primary generation path
  if (step === 'generate_v2') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for generate_v2 step' };
    }
    return executeV2GenerationStep(task, context);
  }

  // For post-generation steps, we need the existing chronicle
  if (!task.chronicleId) {
    return { success: false, error: `chronicleId required for ${step} step` };
  }

  const chronicleRecord = await getChronicle(task.chronicleId);
  if (!chronicleRecord) {
    return { success: false, error: `Chronicle ${task.chronicleId} not found` };
  }

  if (step === 'regenerate_temperature') {
    return executeTemperatureRegenerationStep(task, chronicleRecord, context);
  }

  if (step === 'compare') {
    return executeCompareStep(task, chronicleRecord, context);
  }

  if (step === 'combine') {
    return executeCombineStep(task, chronicleRecord, context);
  }

  if (step === 'summary') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for summary step' };
    }
    return executeSummaryStep(task, chronicleRecord, context);
  }

  if (step === 'title') {
    return executeTitleStep(task, chronicleRecord, context);
  }

  if (step === 'image_refs') {
    if (!task.chronicleContext) {
      return { success: false, error: 'Chronicle context required for image refs step' };
    }
    return executeImageRefsStep(task, chronicleRecord, context);
  }

  if (step === 'cover_image_scene') {
    return executeCoverImageSceneStep(task, chronicleRecord, context);
  }

  if (step === 'regenerate_scene_description') {
    return executeRegenerateSceneDescriptionStep(task, chronicleRecord, context);
  }

  if (step === 'cover_image') {
    return executeCoverImageStep(task, chronicleRecord, context);
  }

  return { success: false, error: `Unknown step: ${step}` };
}

function resolveTargetVersionContent(record: ChronicleRecord): { versionId: string; content: string } {
  const currentVersionId = `current_${record.assembledAt ?? record.createdAt}`;
  const activeVersionId = record.activeVersionId || currentVersionId;

  if (activeVersionId === currentVersionId) {
    return { versionId: activeVersionId, content: record.assembledContent || '' };
  }

  const match = record.generationHistory?.find((version) => version.versionId === activeVersionId);
  if (match) {
    return { versionId: match.versionId, content: match.content };
  }

  return { versionId: currentVersionId, content: record.assembledContent || '' };
}

/**
 * Regenerate chronicle content with a temperature override (no perspective synthesis).
 * Reuses stored prompts from the previous generation.
 */
async function executeTemperatureRegenerationStep(
  task: WorkerTask,
  chronicleRecord: ChronicleRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for regeneration' };
  }

  if (chronicleRecord.status === 'complete' || chronicleRecord.finalContent) {
    return { success: false, error: 'Temperature regeneration is only available before acceptance' };
  }

  const systemPrompt = chronicleRecord.generationSystemPrompt;
  const userPrompt = chronicleRecord.generationUserPrompt;
  if (!systemPrompt || !userPrompt) {
    return { success: false, error: 'Stored prompts missing; cannot regenerate this chronicle' };
  }

  const callConfig = getCallConfig(config, 'chronicle.generation');
  const temperatureRaw = typeof task.chronicleTemperature === 'number'
    ? task.chronicleTemperature
    : (chronicleRecord.generationTemperature ?? chronicleRecord.narrativeStyle?.temperature ?? 0.85);
  const temperature = Math.min(1, Math.max(0, temperatureRaw));

  const styleMaxTokens = chronicleRecord.narrativeStyle
    ? getMaxTokensFromStyle(chronicleRecord.narrativeStyle)
    : undefined;

  const generationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature,
    autoMaxTokens: styleMaxTokens,
  });

  const result = generationCall.result;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `Temperature regeneration failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  try {
    await regenerateChronicleAssembly(chronicleRecord.chronicleId, {
      assembledContent: result.text,
      systemPrompt,
      userPrompt,
      model: callConfig.model,
      temperature,
      cost: {
        estimated: generationCall.estimate.estimatedCost,
        actual: generationCall.usage.actualCost,
        inputTokens: generationCall.usage.inputTokens,
        outputTokens: generationCall.usage.outputTokens,
      },
    });
  } catch (err) {
    return { success: false, error: `Failed to save regenerated chronicle: ${err}` };
  }

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId: chronicleRecord.chronicleId,
    type: 'chronicleV2',
    model: callConfig.model,
    estimatedCost: generationCall.estimate.estimatedCost,
    actualCost: generationCall.usage.actualCost,
    inputTokens: generationCall.usage.inputTokens,
    outputTokens: generationCall.usage.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId: chronicleRecord.chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: generationCall.estimate.estimatedCost,
      actualCost: generationCall.usage.actualCost,
      inputTokens: generationCall.usage.inputTokens,
      outputTokens: generationCall.usage.outputTokens,
    },
    debug: result.debug,
  };
}

/**
 * V2 Single-Shot Generation
 * One LLM call to generate the complete narrative, with deterministic post-processing.
 */
async function executeV2GenerationStep(
  task: WorkerTask,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;
  let chronicleContext = task.chronicleContext!;
  const narrativeStyle = chronicleContext.narrativeStyle;

  if (!narrativeStyle) {
    return { success: false, error: 'Narrative style is required for V2 generation' };
  }

  if (!task.chronicleId) {
    return { success: false, error: 'chronicleId required for generate_v2 step' };
  }

  const callConfig = getCallConfig(config, 'chronicle.generation');
  const chronicleId = task.chronicleId;
  console.log(`[Worker] V2 generation for chronicle=${chronicleId}, style="${narrativeStyle.name}", model=${callConfig.model}`);

  // ==========================================================================
  // PERSPECTIVE SYNTHESIS (REQUIRED)
  // ==========================================================================
  // Perspective synthesis is the ONLY code path. It:
  // 1. Analyzes entity constellation (culture mix, kind focus, themes)
  // 2. LLM selects relevant facts and provides faceted interpretations
  // 3. Assembles tone from fragments based on constellation
  // 4. Builds the final tone (assembled + brief + motifs) and facts for generation
  // ==========================================================================
  if (!chronicleContext.toneFragments || !chronicleContext.canonFactsWithMetadata) {
    return {
      success: false,
      error: 'Perspective synthesis requires toneFragments and canonFactsWithMetadata. Configure world context with structured tone and facts.',
    };
  }

  let perspectiveResult: PerspectiveSynthesisResult;
  let perspectiveRecord: PerspectiveSynthesisRecord;
  let constellation: EntityConstellation;

  {
    console.log('[Worker] Running perspective synthesis...');
    const perspectiveConfig = getCallConfig(config, 'perspective.synthesis');

    // Analyze entity constellation
    constellation = analyzeConstellation({
      entities: chronicleContext.entities,
      relationships: chronicleContext.relationships,
      events: chronicleContext.events,
      focalEra: chronicleContext.era,
    });
    console.log(`[Worker] Constellation: ${constellation.focusSummary}`);

    try {
      perspectiveResult = await synthesizePerspective(
        {
          constellation,
          entities: chronicleContext.entities,
          focalEra: chronicleContext.era,
          factsWithMetadata: chronicleContext.canonFactsWithMetadata,
          toneFragments: chronicleContext.toneFragments,
          culturalIdentities: chronicleContext.culturalIdentities,
          narrativeStyle, // Pass narrative style to weight perspective
          proseHints: chronicleContext.proseHints, // Pass prose hints for entity directives
          worldDynamics: chronicleContext.worldDynamics, // Higher-level narrative context
        },
        llmClient,
        perspectiveConfig
      );

      // Build record for storage (includes both INPUT and OUTPUT for debugging)
      perspectiveRecord = {
        generatedAt: Date.now(),
        model: perspectiveConfig.model,

        // OUTPUT (LLM response)
        brief: perspectiveResult.synthesis.brief,
        facets: perspectiveResult.synthesis.facets,
        suggestedMotifs: perspectiveResult.synthesis.suggestedMotifs,
        narrativeVoice: perspectiveResult.synthesis.narrativeVoice,
        entityDirectives: perspectiveResult.synthesis.entityDirectives,

        // INPUT (what was sent to LLM)
        constellationSummary: constellation.focusSummary,
        constellation: {
          cultures: constellation.cultures,
          kinds: constellation.kinds,
          prominentTags: constellation.prominentTags,
          dominantCulture: constellation.dominantCulture,
          cultureBalance: constellation.cultureBalance,
          relationshipKinds: constellation.relationshipKinds,
        },
        coreTone: chronicleContext.toneFragments?.core,
        narrativeStyleId: narrativeStyle.id,
        narrativeStyleName: narrativeStyle.name,
        inputFacts: chronicleContext.canonFactsWithMetadata?.map((f) => ({
          id: f.id,
          text: f.text,
          type: f.type,
        })),
        inputCulturalIdentities: chronicleContext.culturalIdentities,
        inputEntities: chronicleContext.entities.slice(0, 15).map((e) => ({
          name: e.name,
          kind: e.kind,
          culture: e.culture,
          summary: e.summary,
        })),

        // Cost
        inputTokens: perspectiveResult.usage.inputTokens,
        outputTokens: perspectiveResult.usage.outputTokens,
        actualCost: perspectiveResult.usage.actualCost,
      };

      // Build perspective section with brief and motifs
      const motifSection = perspectiveResult.synthesis.suggestedMotifs.length > 0
        ? `\n\nSUGGESTED MOTIFS (phrases that might echo through this chronicle):\n${perspectiveResult.synthesis.suggestedMotifs.map(m => `- "${m}"`).join('\n')}`
        : '';

      // Update context with synthesized perspective
      chronicleContext = {
        ...chronicleContext,
        // Replace tone with assembled tone + perspective brief + motifs
        tone:
          perspectiveResult.assembledTone +
          '\n\nPERSPECTIVE FOR THIS CHRONICLE:\n' +
          perspectiveResult.synthesis.brief +
          motifSection,
        // Replace facts with faceted facts (core truths with interpretations + contextual)
        canonFacts: perspectiveResult.facetedFacts,
        // Add synthesized narrative voice and entity directives
        narrativeVoice: perspectiveResult.synthesis.narrativeVoice,
        entityDirectives: perspectiveResult.synthesis.entityDirectives,
      };

      console.log(`[Worker] Perspective synthesis complete: ${perspectiveResult.facetedFacts.length} faceted facts, ${perspectiveResult.synthesis.suggestedMotifs.length} motifs`);
    } catch (err) {
      // Per user requirement: if LLM fails, stop the process
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[Worker] Perspective synthesis failed:', errorMessage);
      return { success: false, error: `Perspective synthesis failed: ${errorMessage}` };
    }
  }

  // Simple entity/event selection from 2-hop neighborhood
  const selection = selectEntitiesV2(chronicleContext, DEFAULT_V2_CONFIG);
  console.log(`[Worker] V2 selected ${selection.entities.length} entities, ${selection.events.length} events, ${selection.relationships.length} relationships`);

  // Build single-shot prompt
  const prompt = buildV2Prompt(chronicleContext, narrativeStyle, selection);
  const styleMaxTokens = getMaxTokensFromStyle(narrativeStyle);
  const systemPrompt = getV2SystemPrompt(narrativeStyle);
    const generationCall = await runTextCall({
      llmClient,
      callType: 'chronicle.generation',
      callConfig,
      systemPrompt,
      prompt,
      temperature: task.chronicleTemperature ?? narrativeStyle.temperature ?? 0.85,
      autoMaxTokens: styleMaxTokens,
    });
  const result = generationCall.result;

  console.log(`[Worker] V2 prompt length: ${prompt.length} chars, maxTokens: ${generationCall.budget.totalMaxTokens}`);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `V2 generation failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  // Note: Wikilinks are NOT applied here - they are applied once at acceptance time
  // (in useChronicleGeneration.ts acceptChronicle) to avoid double-bracketing issues.

  // Calculate cost (always includes perspective synthesis)
  const cost = {
    estimated: generationCall.estimate.estimatedCost + perspectiveResult.usage.actualCost,
    actual: generationCall.usage.actualCost + perspectiveResult.usage.actualCost,
    inputTokens: generationCall.usage.inputTokens + perspectiveResult.usage.inputTokens,
    outputTokens: generationCall.usage.outputTokens + perspectiveResult.usage.outputTokens,
  };

  // Save chronicle directly to assembled state (single-shot generation)
  try {
    const focus = chronicleContext.focus;
    const existingChronicle = await getChronicle(chronicleId);
    const roleAssignments = existingChronicle?.roleAssignments ?? focus?.roleAssignments ?? [];
    const selectedEntityIds = existingChronicle?.selectedEntityIds ?? focus?.selectedEntityIds ?? [];
    const selectedEventIds = existingChronicle?.selectedEventIds ?? focus?.selectedEventIds ?? [];
    const selectedRelationshipIds = existingChronicle?.selectedRelationshipIds ?? focus?.selectedRelationshipIds ?? [];
    // Prefer the context used to build the prompt so stored focal era matches generation.
    const temporalContext = chronicleContext.temporalContext ?? existingChronicle?.temporalContext;

    await createChronicle(chronicleId, {
      projectId: task.projectId,
      simulationRunId: task.simulationRunId,
      model: callConfig.model,
      title: existingChronicle?.title,
      format: existingChronicle?.format || narrativeStyle.format,
      narrativeStyleId: existingChronicle?.narrativeStyleId || narrativeStyle.id,
      narrativeStyle: existingChronicle?.narrativeStyle || narrativeStyle,
      roleAssignments,
      lens: existingChronicle?.lens ?? focus?.lens,
      selectedEntityIds,
      selectedEventIds,
      selectedRelationshipIds,
      entrypointId: existingChronicle?.entrypointId,
      temporalContext,
      assembledContent: result.text,
      // Store the ACTUAL prompts sent to the LLM (canonical source of truth)
      generationSystemPrompt: systemPrompt,
      generationUserPrompt: prompt,
      generationTemperature: narrativeStyle.temperature ?? 0.85,
      // Store the generation context snapshot (post-perspective synthesis)
      // This is what was actually used to build the prompt
      generationContext: {
        worldName: chronicleContext.worldName,
        worldDescription: chronicleContext.worldDescription,
        tone: chronicleContext.tone, // Final tone (assembled + brief + motifs)
        canonFacts: chronicleContext.canonFacts, // Faceted facts
        nameBank: chronicleContext.nameBank,
        narrativeVoice: chronicleContext.narrativeVoice,
        entityDirectives: chronicleContext.entityDirectives,
      },
      selectionSummary: {
        entityCount: selection.entities.length,
        eventCount: selection.events.length,
        relationshipCount: selection.relationships.length,
      },
      perspectiveSynthesis: perspectiveRecord,
      cost,
    });
    console.log(`[Worker] Chronicle saved: ${chronicleId}`);
  } catch (err) {
    return { success: false, error: `Failed to save chronicle: ${err}` };
  }

  // Record perspective synthesis cost
  const perspectiveConfig = getCallConfig(config, 'perspective.synthesis');
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chroniclePerspective',
    model: perspectiveConfig.model,
    estimatedCost: perspectiveResult.usage.actualCost,
    actualCost: perspectiveResult.usage.actualCost,
    inputTokens: perspectiveResult.usage.inputTokens,
    outputTokens: perspectiveResult.usage.outputTokens,
  });

  // Record generation cost
  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleV2',
    model: callConfig.model,
    estimatedCost: generationCall.estimate.estimatedCost,
    actualCost: generationCall.usage.actualCost,
    inputTokens: generationCall.usage.inputTokens,
    outputTokens: generationCall.usage.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: cost.estimated,
      actualCost: cost.actual,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
    },
    debug: result.debug,
  };
}


// ============================================================================
// Compare Versions Step (user-triggered, produces report only)
// ============================================================================

function collectAllVersionTexts(
  chronicleRecord: NonNullable<Awaited<ReturnType<typeof getChronicle>>>
): Array<{ label: string; content: string; temperature?: number; wordCount: number }> {
  const versions: Array<{ label: string; content: string; temperature?: number; wordCount: number }> = [];

  // History versions
  const history = chronicleRecord.generationHistory || [];
  for (let i = 0; i < history.length; i++) {
    versions.push({
      label: `Version ${i + 1} (T=${history[i].temperature ?? '?'})`,
      content: history[i].content,
      temperature: history[i].temperature,
      wordCount: history[i].wordCount,
    });
  }

  // Current assembled content
  if (chronicleRecord.assembledContent) {
    versions.push({
      label: `Current (T=${chronicleRecord.generationTemperature ?? '?'})`,
      content: chronicleRecord.assembledContent,
      temperature: chronicleRecord.generationTemperature,
      wordCount: chronicleRecord.assembledContent.split(/\s+/).length,
    });
  }

  return versions;
}

async function executeCompareStep(
  task: WorkerTask,
  chronicleRecord: NonNullable<Awaited<ReturnType<typeof getChronicle>>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const chronicleId = chronicleRecord.chronicleId;
  const versions = collectAllVersionTexts(chronicleRecord);

  if (versions.length < 2) {
    return { success: false, error: 'At least 2 versions required for comparison' };
  }

  const callConfig = getCallConfig(config, 'chronicle.compare');
  console.log(`[Worker] Comparing ${versions.length} versions, model=${callConfig.model}...`);

  const narrativeStyle = chronicleRecord.narrativeStyle;
  const narrativeStyleName = narrativeStyle?.name || chronicleRecord.narrativeStyleId || 'unknown';

  // Build narrative style context block for the comparison agent
  let narrativeStyleBlock = '';
  if (narrativeStyle) {
    const parts: string[] = [`**${narrativeStyle.name}** (${narrativeStyle.format})`];
    if (narrativeStyle.description) parts.push(narrativeStyle.description);
    if ('narrativeInstructions' in narrativeStyle && narrativeStyle.narrativeInstructions) {
      parts.push(`Structure: ${(narrativeStyle.narrativeInstructions as string).slice(0, 500)}`);
    }
    if ('proseInstructions' in narrativeStyle && narrativeStyle.proseInstructions) {
      parts.push(`Prose: ${(narrativeStyle.proseInstructions as string).slice(0, 500)}`);
    }
    if ('documentInstructions' in narrativeStyle && narrativeStyle.documentInstructions) {
      parts.push(`Document: ${(narrativeStyle.documentInstructions as string).slice(0, 500)}`);
    }
    narrativeStyleBlock = parts.join('\n');
  }

  const versionsBlock = versions.map((v) =>
    `## ${v.label}\nWord count: ${v.wordCount}\n\n${v.content}`
  ).join('\n\n---\n\n');

  const comparePrompt = `You are comparing ${versions.length} versions of the same chronicle. Each was generated from the same prompt and narrative style (${narrativeStyleName}) but at different temperatures (creative latitude).
${narrativeStyleBlock ? `\n## Narrative Style Reference\n${narrativeStyleBlock}\n` : ''}
Your output must have THREE sections in this exact order. Keep the total output under 800 words.

## Comparative Analysis

Cover each dimension in 2-3 sentences, naming the stronger version with one specific example:

1. **Prose Quality**: Which has more natural, engaging prose? Where does each feel templated or forced?
2. **Structural Choices**: How do versions differ in scene ordering, POV, pacing? Which makes more surprising or effective choices?
3. **World-Building Detail**: Which invents richer names, places, customs, sensory details? Which feels more grounded?
4. **Narrative Style Adherence (${narrativeStyleName})**: Evaluate against the narrative style above — its required structure, prose techniques, and specific instructions. Which better fulfills these? Which better follows entity directives?
5. **Emotional Range**: Which has more varied emotional registers vs. falling into a single mood?
6. **Perspective Integration**: Which better integrates the perspective synthesis outputs — narrative voice (synthesized prose guidance), entity directives (per-character writing guidance), faceted facts (world truths with chronicle-specific interpretations), and cultural identities? Which feels inhabited vs. described from outside?

## Recommendation

State one of: **Keep Version [X]** (one version is clearly superior), or **Combine** (each version has distinct strengths worth merging). Explain why in 2-3 sentences.

## Combine Instructions

Write a SHORT paragraph (4-6 sentences) of revision guidance for a creative LLM that will combine these versions. This is not a merge spec — it is editorial direction for a skilled writer.

Name the base version and its key strengths (structure, tone, arc). Name what the other version does better and should be drawn from (details, names, world-building, specific scenes). Note any tonal qualities from the base that should not be lost. Trust the writer to make specific decisions — do not prescribe line-by-line changes or integration points.

## Chronicle Versions

${versionsBlock}`;

  const compareCall = await runTextCall({
    llmClient,
    callType: 'chronicle.compare',
    callConfig,
    systemPrompt: 'You are a narrative editor providing a comparative analysis of chronicle drafts. Be specific and cite examples from the text.',
    prompt: comparePrompt,
    temperature: 0.3,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: compareCall.result.debug };
  }

  if (compareCall.result.error || !compareCall.result.text) {
    return {
      success: false,
      error: `Compare failed: ${compareCall.result.error || 'No text returned'}`,
      debug: compareCall.result.debug,
    };
  }

  // Parse out combine instructions from the report
  // Fuzzy match: any heading level (#, ##, ###), case-insensitive, optional colon
  const fullReport = compareCall.result.text;
  const combineHeaderMatch = fullReport.match(/^#{1,4}\s+combine\s+instructions:?\s*$/im);
  let combineInstructions: string | undefined;
  if (combineHeaderMatch && combineHeaderMatch.index != null) {
    combineInstructions = fullReport.slice(combineHeaderMatch.index + combineHeaderMatch[0].length).trim();
  }

  // Store the report and combine instructions on the chronicle record
  await updateChronicleComparisonReport(chronicleId, fullReport, combineInstructions);

  const compareCost = {
    estimated: compareCall.estimate.estimatedCost,
    actual: compareCall.usage.actualCost,
    inputTokens: compareCall.usage.inputTokens,
    outputTokens: compareCall.usage.outputTokens,
  };

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleV2',
    model: callConfig.model,
    estimatedCost: compareCost.estimated,
    actualCost: compareCost.actual,
    inputTokens: compareCost.inputTokens,
    outputTokens: compareCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: compareCost.estimated,
      actualCost: compareCost.actual,
      inputTokens: compareCost.inputTokens,
      outputTokens: compareCost.outputTokens,
    },
    debug: compareCall.result.debug,
  };
}

// ============================================================================
// Combine Versions Step (user-triggered, produces new draft)
// ============================================================================

async function executeCombineStep(
  task: WorkerTask,
  chronicleRecord: NonNullable<Awaited<ReturnType<typeof getChronicle>>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const chronicleId = chronicleRecord.chronicleId;
  const versions = collectAllVersionTexts(chronicleRecord);

  if (versions.length < 2) {
    return { success: false, error: 'At least 2 versions required for combining' };
  }

  const callConfig = getCallConfig(config, 'chronicle.combine');
  console.log(`[Worker] Combining ${versions.length} versions, model=${callConfig.model}...`);

  const versionsBlock = versions.map((v) =>
    `## ${v.label}\n\n${v.content}`
  ).join('\n\n---\n\n');

  const systemPrompt = chronicleRecord.generationSystemPrompt || '';
  const narrativeStyle = chronicleRecord.narrativeStyle;
  const styleName = narrativeStyle ? `${narrativeStyle.name} (${narrativeStyle.format})` : 'unknown';

  // Check for combine instructions from a prior compare step
  const hasCombineInstructions = !!chronicleRecord.combineInstructions;

  const combinePrompt = `You are a narrative editor combining ${versions.length} versions of the same chronicle into a single final version. All versions follow the same prompt and narrative style — they differ in temperature (creative latitude).

Your job is NOT to merge or average. Your job is to CHOOSE and REWRITE: take the stronger elements from each version and produce one polished chronicle.
${hasCombineInstructions ? `
## Revision Guidance from Comparative Analysis

A prior analysis compared these versions and produced specific instructions for combining them. Follow this guidance closely — it identifies which version handles each section better and which specific elements to preserve:

${chronicleRecord.combineInstructions}
` : `
## Selection Criteria

Prefer whichever version has:
- **Richer world-building details** — invented names, places, customs that feel grounded
- **More surprising structural choices** — non-obvious scene ordering, interesting POV decisions
- **More natural prose** — sentences that flow without feeling templated
- **Better adherence to the narrative voice and entity directives**
- **Stronger emotional range** — not every beat should feel the same

If one version has a better opening and another has a better middle, use each. If versions handle the same beat differently, pick the one that reads more naturally.
`}
## Original System Prompt Context
${systemPrompt}

Style: ${styleName}

## Chronicle Versions

${versionsBlock}

## YOUR TASK

Produce the final chronicle by selecting the strongest elements from each version. Output ONLY the chronicle text — no commentary, no labels, no preamble.`;

  const combineCall = await runTextCall({
    llmClient,
    callType: 'chronicle.combine',
    callConfig,
    systemPrompt: 'You are a narrative editor producing the definitive version of a chronicle from multiple drafts. Output only the final chronicle text.',
    prompt: combinePrompt,
    temperature: 0.4,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: combineCall.result.debug };
  }

  if (combineCall.result.error || !combineCall.result.text) {
    return {
      success: false,
      error: `Combine failed: ${combineCall.result.error || 'No text returned'}`,
      debug: combineCall.result.debug,
    };
  }

  // Save as a new version (snapshots current into history)
  await regenerateChronicleAssembly(chronicleId, {
    assembledContent: combineCall.result.text,
    systemPrompt: chronicleRecord.generationSystemPrompt || '',
    userPrompt: chronicleRecord.generationUserPrompt || '',
    model: callConfig.model,
    cost: {
      estimated: combineCall.estimate.estimatedCost,
      actual: combineCall.usage.actualCost,
      inputTokens: combineCall.usage.inputTokens,
      outputTokens: combineCall.usage.outputTokens,
    },
  });

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleV2',
    model: callConfig.model,
    estimatedCost: combineCall.estimate.estimatedCost,
    actualCost: combineCall.usage.actualCost,
    inputTokens: combineCall.usage.inputTokens,
    outputTokens: combineCall.usage.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: combineCall.estimate.estimatedCost,
      actualCost: combineCall.usage.actualCost,
      inputTokens: combineCall.usage.inputTokens,
      outputTokens: combineCall.usage.outputTokens,
    },
    debug: combineCall.result.debug,
  };
}

// ============================================================================
// Summary + Image Refs Steps
// ============================================================================

function buildSummaryPrompt(content: string): string {
  return `Generate a summary for the chronicle below.

Rules:
- Summary: 2-4 sentences summarizing the key events and outcome
- Keep it factual and faithful to the chronicle
- Mention key entities by name

Chronicle:
${content}

Return ONLY valid JSON in this exact format:
{"summary": "..."}`;
}

// Words that stay lowercase in title case (unless first word)
const TITLE_CASE_MINOR = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'to', 'by', 'of', 'up', 'as', 'if', 'off',
  'per', 'via', 'from', 'into', 'with', 'over', 'near', 'upon',
  'than', 'that', 'when', 'where', 'who',
]);

function toTitleCase(title: string): string {
  return title
    .split(/(\s+|-)/  )
    .map((segment, i) => {
      // Preserve whitespace and hyphens as-is
      if (/^[\s-]+$/.test(segment)) return segment;
      const lower = segment.toLowerCase();
      // First word and last word are always capitalized
      if (i === 0) return segment.charAt(0).toUpperCase() + segment.slice(1);
      if (TITLE_CASE_MINOR.has(lower)) return lower;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join('');
}

const STORY_TITLE_NUDGES = [
  'One candidate should reference a key place or landmark from the chronicle.',
  'One candidate should use a thematic tension or contrast (like "Pride and Prejudice", "War and Peace").',
  'One candidate should reference a pivotal event or turning point from the chronicle.',
  'One candidate should evoke the tone or mood of the story (like "A Farewell to Arms", "The Sound and the Fury").',
  'One candidate should reference a symbolic object, title, or role from the chronicle.',
  'One candidate should frame the central relationship or conflict.',
  'One candidate should capture what changed or what was lost.',
];

const DOCUMENT_TITLE_NUDGES = [
  'One candidate should use a formal document heading style (like "A Treatise on...", "Concerning...").',
  'One candidate should name the subject matter directly (like "The Art of War", "Poetics").',
  'One candidate should reference the document\'s origin or author context.',
  'One candidate should use a declarative or topical style (like "On Liberty", "Common Sense").',
  'One candidate should reference the key institution, place, or authority involved.',
  'One candidate should capture the document\'s purpose or occasion.',
  'One candidate should use a formal chronicle or record style.',
];

function pickNudge(format: 'story' | 'document'): string {
  const nudges = format === 'document' ? DOCUMENT_TITLE_NUDGES : STORY_TITLE_NUDGES;
  return nudges[Math.floor(Math.random() * nudges.length)];
}

function buildStyleContext(
  format: 'story' | 'document',
  narrativeStyleName?: string,
  narrativeStyleDescription?: string,
  narrativeInstructions?: string,
  proseInstructions?: string,
  documentInstructions?: string,
): string {
  if (!narrativeStyleName) return '';

  let ctx = `\nNarrative style: "${narrativeStyleName}"`;
  if (narrativeStyleDescription) ctx += ` — ${narrativeStyleDescription}`;

  if (format === 'story') {
    if (proseInstructions) {
      // Prose instructions give the best sense of tone/register for titling
      ctx += `\n\nProse style guidance (for tone reference):\n${proseInstructions}`;
    }
    if (narrativeInstructions) {
      // First ~300 chars of narrative instructions give structural context
      const truncated = narrativeInstructions.length > 400
        ? narrativeInstructions.slice(0, 400) + '...'
        : narrativeInstructions;
      ctx += `\n\nNarrative structure (for context):\n${truncated}`;
    }
  } else {
    if (documentInstructions) {
      const truncated = documentInstructions.length > 500
        ? documentInstructions.slice(0, 500) + '...'
        : documentInstructions;
      ctx += `\n\nDocument style guidance:\n${truncated}`;
    }
  }

  return ctx + '\n';
}

interface TitlePromptContext {
  format: 'story' | 'document';
  narrativeStyleName?: string;
  narrativeStyleDescription?: string;
  narrativeInstructions?: string;
  proseInstructions?: string;
  documentInstructions?: string;
}

function buildTitleCandidatesPrompt(content: string, ctx: TitlePromptContext): string {
  const styleContext = buildStyleContext(
    ctx.format,
    ctx.narrativeStyleName,
    ctx.narrativeStyleDescription,
    ctx.narrativeInstructions,
    ctx.proseInstructions,
    ctx.documentInstructions,
  );

  if (ctx.format === 'document') {
    return `Generate 5 candidate titles for the in-universe document below.
${styleContext}
Great document titles are concise and authoritative. They use varied approaches:
- Subject-focused: "The Art of War", "Poetics", "The Republic", "Leviathan"
- Formal heading: "A Treatise on Power", "Concerning the Nature of...", "The Chronicle of..."
- Topical: "On Liberty", "Common Sense", "The Rights of Man"
- Named reference: "The Prince", "Letters from a Stoic", "The Annals"

The title should sound like a real historical document, treatise, or text — authoritative and specific to its subject matter.

Rules:
- Each title: 2-7 words
- Title Case capitalization
- Each candidate must use a DIFFERENT structural approach
- Match the formality and genre of the document type
- Titles must be specific to the document's actual subject, not generic
- ${pickNudge('document')}

Document:
${content}

Return ONLY valid JSON in this exact format:
{"titles": ["...", "...", "...", "...", "..."]}`;
  }

  return `Generate 5 candidate titles for the story below.
${styleContext}
Great titles are concise and evocative. They range from 2-6 words and use varied approaches:
- Thematic: "Pride and Prejudice", "A Farewell to Arms", "The Sound and the Fury"
- Place/setting: "Wuthering Heights", "The Tower of Babel", "Dune"
- Character + context: "The Great Gatsby", "The Once and Future King"
- Event/image: "A Storm of Swords", "The Fall of Gondolin", "Blood Meridian"
- Symbolic: "The Bell Jar", "Brave New World", "The Long Dark"

The title should capture the ESSENCE of the chronicle — its central tension, setting, or theme — in a way that intrigues. It should NOT be a bare entity name or a plot summary.

Rules:
- Each title: 2-6 words
- Title Case capitalization
- Each candidate must use a DIFFERENT structural approach (thematic, place-based, event-based, symbolic, character-focused)
- Do NOT use bare character or entity names alone as titles — a name needs context (e.g. "Macbeth" works because it's a famous play, but "Aerirei" alone means nothing to a reader)
- Titles must be meaningful and evocative even to someone who hasn't read the chronicle
- At most ONE title may start with "The"
- ${pickNudge('story')}

Story:
${content}

Return ONLY valid JSON in this exact format:
{"titles": ["...", "...", "...", "...", "..."]}`;
}

function buildTitleSynthesisPrompt(
  candidates: string[],
  content: string,
  ctx: TitlePromptContext,
): string {
  const styleContext = ctx.narrativeStyleName
    ? `\nNarrative style: "${ctx.narrativeStyleName}"${ctx.narrativeStyleDescription ? ` — ${ctx.narrativeStyleDescription}` : ''}\n`
    : '';

  const candidateList = candidates.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const formatLabel = ctx.format === 'document' ? 'document' : 'story';

  return `Here are 5 candidate titles for a ${formatLabel}:

${candidateList}
${styleContext}
Your job: create the BEST possible title. You may pick one candidate if it's already excellent, or synthesize something new by combining the strongest elements. The result must sound like a real ${ctx.format === 'document' ? 'document or text name' : 'book title'} — concise, evocative, and meaningful.

Rules:
- 2-${ctx.format === 'document' ? '7' : '6'} words
- Title Case capitalization
- Must be meaningful and evocative even to someone unfamiliar with the content
- Do NOT use bare entity names alone — names need context to work as titles

${ctx.format === 'story' ? 'Story' : 'Document'} (for reference):
${content}

Return ONLY valid JSON in this exact format:
{"title": "..."}`;
}

function formatImageRefEntities(
  chronicleContext: ChronicleGenerationContext,
  visualIdentities?: Record<string, string>
): string {
  if (chronicleContext.entities.length === 0) return '(none)';

  return chronicleContext.entities
    .map((entity) => {
      let line = `- ${entity.id}: ${entity.name} (${entity.kind})`;
      const visual = visualIdentities?.[entity.id];
      if (visual) {
        line += `\n  Visual: ${visual}`;
      }
      return line;
    })
    .join('\n');
}

/**
 * Split content into roughly equal chunks for distributed image placement.
 * Splits at whitespace boundaries to avoid cutting words.
 * Returns 3-7 chunks, weighted by content length (longer = more chunks).
 */
function splitIntoChunks(content: string): Array<{ index: number; text: string; startOffset: number }> {
  // Estimate word count for chunk calculation
  const wordCount = content.split(/\s+/).length;

  // Calculate chunk count: 3-7, weighted by length
  // Under 500 words: 3 chunks, 500-1000: 4, 1000-2000: 5, 2000-3000: 6, 3000+: 7
  let baseChunkCount: number;
  if (wordCount < 500) baseChunkCount = 3;
  else if (wordCount < 1000) baseChunkCount = 4;
  else if (wordCount < 2000) baseChunkCount = 5;
  else if (wordCount < 3000) baseChunkCount = 6;
  else baseChunkCount = 7;

  // Add slight randomness: +/-1 chunk
  const randomOffset = Math.random() < 0.3 ? -1 : (Math.random() > 0.7 ? 1 : 0);
  const chunkCount = Math.max(3, Math.min(7, baseChunkCount + randomOffset));

  const targetChunkSize = Math.ceil(content.length / chunkCount);
  const chunks: Array<{ index: number; text: string; startOffset: number }> = [];

  let currentStart = 0;
  for (let i = 0; i < chunkCount; i++) {
    const targetEnd = Math.min(currentStart + targetChunkSize, content.length);

    // Find next whitespace after target end (don't cut words)
    let actualEnd = targetEnd;
    if (targetEnd < content.length) {
      // Look for whitespace within 50 chars after target
      const searchEnd = Math.min(targetEnd + 50, content.length);
      for (let j = targetEnd; j < searchEnd; j++) {
        if (/\s/.test(content[j])) {
          actualEnd = j;
          break;
        }
      }
      // If no whitespace found, use target (rare edge case)
      if (actualEnd === targetEnd && targetEnd < content.length) {
        actualEnd = targetEnd;
      }
    }

    chunks.push({
      index: i,
      text: content.substring(currentStart, actualEnd),
      startOffset: currentStart,
    });

    currentStart = actualEnd;

    // Skip leading whitespace for next chunk
    while (currentStart < content.length && /\s/.test(content[currentStart])) {
      currentStart++;
    }

    // If we've consumed all content, stop
    if (currentStart >= content.length) break;
  }

  return chunks;
}

function buildImageRefsPrompt(
  content: string,
  chronicleContext: ChronicleGenerationContext,
  visualIdentities?: Record<string, string>
): string {
  const entityList = formatImageRefEntities(chronicleContext, visualIdentities);
  const chunks = splitIntoChunks(content);

  // Build chunk display with markers (full text, no truncation)
  const chunksDisplay = chunks.map((chunk, i) => {
    return `### CHUNK ${i + 1} of ${chunks.length}
${chunk.text}
---`;
  }).join('\n\n');

  return `You are adding image references to a chronicle. Your task is to identify optimal placement points for images that enhance the narrative.

## Available Entities
${entityList}

## Instructions
The chronicle has been divided into ${chunks.length} chunks. For EACH chunk, decide whether it deserves an image (0 or 1 per chunk). This ensures images are distributed throughout the narrative.

For each image, choose one type:

1. **Entity Reference** (type: "entity_ref") - Use when a specific entity is prominently featured
   - Best for: Introductions, key moments focused on a single entity

2. **Prompt Request** (type: "prompt_request") - Use for scenes involving multiple entities or environments
   - Best for: Multi-entity scenes, locations, action moments, atmospheric shots
   - REQUIRED: Include involvedEntityIds with at least one entity that appears in the scene
   - In sceneDescription, incorporate the Visual identity of involved entities so the image generator knows what figures look like

## Output Format
Return a JSON object. For each image placement, provide an entry with anchorText from the relevant chunk:
{
  "imageRefs": [
    {
      "type": "entity_ref",
      "entityId": "<entity id from list above>",
      "anchorText": "<exact 5-15 word phrase from the chronicle>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    },
    {
      "type": "prompt_request",
      "sceneDescription": "<vivid 1-2 sentence scene description>",
      "involvedEntityIds": ["<entity-id-1>", "<entity-id-2>"],
      "anchorText": "<exact 5-15 word phrase from the chronicle>",
      "size": "small|medium|large|full-width",
      "caption": "<optional>"
    }
  ]
}

## Size Guidelines
- small: 150px, supplementary/margin images
- medium: 300px, standard single-entity images
- large: 450px, key scenes
- full-width: 100%, establishing shots

## Rules
- Suggest 0 or 1 image per chunk (total 2-5 images for the whole chronicle)
- anchorText MUST be an exact phrase from that chunk's text
- entityId and involvedEntityIds MUST use IDs from the Available Entities list
- For prompt_request, involvedEntityIds MUST contain at least one entity ID
- Return valid JSON only, no markdown

## Chronicle Chunks
${chunksDisplay}`;
}

/**
 * Parse the LLM response for image refs into structured ChronicleImageRef array
 */
function parseImageRefsResponse(text: string): ChronicleImageRef[] {
  const parsed = parseJsonObject<Record<string, unknown>>(text, 'image refs response');
  const rawRefs = parsed.imageRefs;

  if (!rawRefs || !Array.isArray(rawRefs)) {
    throw new Error('imageRefs array not found in response');
  }

  const validSizes: ChronicleImageSize[] = ['small', 'medium', 'large', 'full-width'];

  return rawRefs.map((ref: Record<string, unknown>, index: number) => {
    const refId = `imgref_${Date.now()}_${index}`;
    const anchorText = typeof ref.anchorText === 'string' ? ref.anchorText : '';
    const rawSize = typeof ref.size === 'string' ? ref.size : 'medium';
    const size: ChronicleImageSize = validSizes.includes(rawSize as ChronicleImageSize)
      ? (rawSize as ChronicleImageSize)
      : 'medium';
    const caption = typeof ref.caption === 'string' ? ref.caption : undefined;

    if (ref.type === 'entity_ref') {
      const entityId = typeof ref.entityId === 'string' ? ref.entityId : '';
      if (!entityId) {
        throw new Error(`entity_ref at index ${index} missing entityId`);
      }
      return {
        refId,
        type: 'entity_ref',
        entityId,
        anchorText,
        size,
        caption,
      } as EntityImageRef;
    } else if (ref.type === 'prompt_request') {
      const sceneDescription = typeof ref.sceneDescription === 'string' ? ref.sceneDescription : '';
      if (!sceneDescription) {
        throw new Error(`prompt_request at index ${index} missing sceneDescription`);
      }
      // Parse involvedEntityIds - can be array of strings or empty
      let involvedEntityIds: string[] | undefined;
      if (Array.isArray(ref.involvedEntityIds)) {
        involvedEntityIds = ref.involvedEntityIds
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (involvedEntityIds.length === 0) {
          involvedEntityIds = undefined;
        }
      }
      return {
        refId,
        type: 'prompt_request',
        sceneDescription,
        involvedEntityIds,
        anchorText,
        size,
        caption,
        status: 'pending',
      } as PromptRequestRef;
    } else {
      throw new Error(`Unknown image ref type at index ${index}: ${ref.type}`);
    }
  });
}

async function executeSummaryStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for summary' };
  }
  const { versionId: summaryVersionId, content: summaryContent } = resolveTargetVersionContent(chronicleRecord);
  if (!summaryContent) {
    return { success: false, error: 'Chronicle has no assembled content to summarize' };
  }

  const callConfig = getCallConfig(config, 'chronicle.summary');
  const chronicleId = chronicleRecord.chronicleId;

  const summaryPrompt = buildSummaryPrompt(summaryContent);
  const summaryCall = await runTextCall({
    llmClient,
    callType: 'chronicle.summary',
    callConfig,
    systemPrompt: 'You are a careful editor who writes concise, faithful summaries. Always respond with valid JSON.',
    prompt: summaryPrompt,
    temperature: 0.3,
  });
  const debug = summaryCall.result.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (summaryCall.result.error || !summaryCall.result.text) {
    return { success: false, error: `Summary failed: ${summaryCall.result.error || 'Empty response'}`, debug };
  }

  let summaryText: string;
  try {
    const parsed = parseJsonObject<Record<string, unknown>>(summaryCall.result.text, 'summary response');
    summaryText = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!summaryText) {
      return { success: false, error: 'Summary response missing summary field', debug };
    }
  } catch {
    summaryText = stripLeadingWrapper(summaryCall.result.text).replace(/\s+/g, ' ').trim();
    if (!summaryText) {
      return { success: false, error: 'Summary response empty', debug };
    }
  }

  const summaryCost = {
    estimated: summaryCall.estimate.estimatedCost,
    actual: summaryCall.usage.actualCost,
    inputTokens: summaryCall.usage.inputTokens,
    outputTokens: summaryCall.usage.outputTokens,
  };

  await updateChronicleSummary(chronicleId, summaryText, summaryCost, callConfig.model, summaryVersionId);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleSummary' as CostType,
    model: callConfig.model,
    estimatedCost: summaryCost.estimated,
    actualCost: summaryCost.actual,
    inputTokens: summaryCost.inputTokens,
    outputTokens: summaryCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: summaryCost.estimated,
      actualCost: summaryCost.actual,
      inputTokens: summaryCost.inputTokens,
      outputTokens: summaryCost.outputTokens,
    },
    debug,
  };
}

async function executeTitleStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for title' };
  }

  // Use finalContent for published chronicles, assembled content for drafts
  const content = chronicleRecord.finalContent || chronicleRecord.assembledContent;
  if (!content) {
    return { success: false, error: 'Chronicle has no content to generate title from' };
  }

  const callConfig = getCallConfig(config, 'chronicle.title');
  const chronicleId = chronicleRecord.chronicleId;
  const narrativeStyle = chronicleRecord.narrativeStyle;
  const format = chronicleRecord.format || 'story';

  const titleCtx: TitlePromptContext = {
    format,
    narrativeStyleName: narrativeStyle?.name,
    narrativeStyleDescription: narrativeStyle?.description,
    narrativeInstructions: narrativeStyle?.format === 'story' ? (narrativeStyle as any).narrativeInstructions : undefined,
    proseInstructions: narrativeStyle?.format === 'story' ? (narrativeStyle as any).proseInstructions : undefined,
    documentInstructions: narrativeStyle?.format === 'document' ? (narrativeStyle as any).documentInstructions : undefined,
  };

  // --- Pass 1: Generate candidates ---
  const candidatesPrompt = buildTitleCandidatesPrompt(content, titleCtx);
  const candidatesCall = await runTextCall({
    llmClient,
    callType: 'chronicle.title',
    callConfig,
    systemPrompt: 'You are a creative title writer. Always respond with valid JSON.',
    prompt: candidatesPrompt,
    temperature: 0.75,
  });

  const debugParts: string[] = [];
  if (candidatesCall.result.debug) debugParts.push(candidatesCall.result.debug);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: debugParts.join('\n---\n') || undefined };
  }

  let candidates: string[] = [];
  if (!candidatesCall.result.error && candidatesCall.result.text) {
    try {
      const parsed = parseJsonObject<Record<string, unknown>>(candidatesCall.result.text, 'title candidates response');
      if (Array.isArray(parsed.titles)) {
        candidates = parsed.titles.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map(t => t.trim());
      }
    } catch {
      // Candidates parse failed
    }
  }

  if (candidates.length === 0) {
    return { success: false, error: 'Title generation produced no candidates', debug: debugParts.join('\n---\n') || undefined };
  }

  // --- Pass 2: Synthesize final title ---
  let title: string;
  let synthesisCall: Awaited<ReturnType<typeof runTextCall>> | undefined;

  if (candidates.length >= 2) {
    const synthesisPrompt = buildTitleSynthesisPrompt(candidates, content, titleCtx);
    synthesisCall = await runTextCall({
      llmClient,
      callType: 'chronicle.title',
      callConfig,
      systemPrompt: 'You are a creative title writer. Always respond with valid JSON.',
      prompt: synthesisPrompt,
      temperature: 0.6,
    });
    if (synthesisCall.result.debug) debugParts.push(synthesisCall.result.debug);

    if (isAborted()) {
      return { success: false, error: 'Task aborted', debug: debugParts.join('\n---\n') || undefined };
    }

    title = candidates[0]; // fallback
    if (!synthesisCall.result.error && synthesisCall.result.text) {
      try {
        const parsed = parseJsonObject<Record<string, unknown>>(synthesisCall.result.text, 'title synthesis response');
        if (typeof parsed.title === 'string' && parsed.title.trim()) {
          title = parsed.title.trim();
        }
      } catch {
        // Synthesis parse failed — use first candidate
      }
    }
  } else {
    title = candidates[0];
  }

  // Enforce title case
  title = toTitleCase(title);

  // Combine costs
  const allCalls = [candidatesCall, ...(synthesisCall ? [synthesisCall] : [])];
  const totalCost = {
    estimated: allCalls.reduce((sum, c) => sum + c.estimate.estimatedCost, 0),
    actual: allCalls.reduce((sum, c) => sum + c.usage.actualCost, 0),
    inputTokens: allCalls.reduce((sum, c) => sum + c.usage.inputTokens, 0),
    outputTokens: allCalls.reduce((sum, c) => sum + c.usage.outputTokens, 0),
  };

  const debug = debugParts.length > 0 ? debugParts.join('\n---\n') : undefined;

  await updateChronicleTitle(chronicleId, title, candidates, totalCost, callConfig.model);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleSummary' as CostType,
    model: callConfig.model,
    estimatedCost: totalCost.estimated,
    actualCost: totalCost.actual,
    inputTokens: totalCost.inputTokens,
    outputTokens: totalCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      title,
      candidates,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: totalCost.estimated,
      actualCost: totalCost.actual,
      inputTokens: totalCost.inputTokens,
      outputTokens: totalCost.outputTokens,
    },
    debug,
  };
}

async function executeImageRefsStep(
  task: WorkerTask,
  chronicleRecord: Awaited<ReturnType<typeof getChronicle>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for image refs' };
  }
  const { versionId: imageRefsVersionId, content: imageRefsContent } = resolveTargetVersionContent(chronicleRecord);
  if (!imageRefsContent) {
    return { success: false, error: 'Chronicle has no assembled content for image refs' };
  }

  const callConfig = getCallConfig(config, 'chronicle.imageRefs');
  const chronicleId = chronicleRecord.chronicleId;
  const chronicleContext = task.chronicleContext!;
  const imageRefsPrompt = buildImageRefsPrompt(imageRefsContent, chronicleContext, task.visualIdentities);
  const imageRefsCall = await runTextCall({
    llmClient,
    callType: 'chronicle.imageRefs',
    callConfig,
    systemPrompt: 'You are planning draft image placements for a chronicle.',
    prompt: imageRefsPrompt,
    temperature: 0.4,
  });
  const imageRefsResult = imageRefsCall.result;
  const debug = imageRefsResult.debug;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug };
  }

  if (imageRefsResult.error || !imageRefsResult.text) {
    return { success: false, error: `Image refs failed: ${imageRefsResult.error || 'Empty response'}`, debug };
  }

  // Parse the response into structured image refs
  let parsedRefs: ChronicleImageRef[];
  try {
    parsedRefs = parseImageRefsResponse(imageRefsResult.text);
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse image refs: ${e instanceof Error ? e.message : 'Unknown error'}`,
      debug,
    };
  }

  if (parsedRefs.length === 0) {
    return { success: false, error: 'No image refs found in response', debug };
  }

  // Calculate anchorIndex for each ref based on position in assembled content
  const assembledContent = imageRefsContent;
  for (const ref of parsedRefs) {
    if (ref.anchorText) {
      const resolved = resolveAnchorPhrase(ref.anchorText, assembledContent);
      if (resolved) {
        // Use the verbatim phrase from the text and its index
        ref.anchorText = resolved.phrase;
        ref.anchorIndex = resolved.index;
      }
    }
  }

  // Create structured ChronicleImageRefs object
  const imageRefs: ChronicleImageRefs = {
    refs: parsedRefs,
    generatedAt: Date.now(),
    model: callConfig.model,
  };

  const imageRefsCost = {
    estimated: imageRefsCall.estimate.estimatedCost,
    actual: imageRefsCall.usage.actualCost,
    inputTokens: imageRefsCall.usage.inputTokens,
    outputTokens: imageRefsCall.usage.outputTokens,
  };

  await updateChronicleImageRefs(chronicleId, imageRefs, imageRefsCost, callConfig.model, imageRefsVersionId);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleImageRefs' as CostType,
    model: callConfig.model,
    estimatedCost: imageRefsCost.estimated,
    actualCost: imageRefsCost.actual,
    inputTokens: imageRefsCost.inputTokens,
    outputTokens: imageRefsCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: imageRefsCost.estimated,
      actualCost: imageRefsCost.actual,
      inputTokens: imageRefsCost.inputTokens,
      outputTokens: imageRefsCost.outputTokens,
    },
    debug,
  };
}

// ============================================================================
// Cover Image Scene Step (LLM generates scene description for cover image)
// ============================================================================

function buildCoverImageScenePrompt(
  content: string,
  title: string,
  roleAssignments: Array<{ entityId: string; entityName: string; entityKind: string; role: string; isPrimary: boolean }>,
  sceneFraming: string,
  sceneInstructions: string,
  visualIdentities?: Record<string, string>
): string {
  const castList = roleAssignments
    .map((r) => {
      let line = `- ${r.entityName} (${r.entityKind}, ${r.role}${r.isPrimary ? ', primary' : ''})`;
      const visual = visualIdentities?.[r.entityId];
      if (visual) {
        line += `\n  Visual: ${visual}`;
      }
      return line;
    })
    .join('\n');

  return `${sceneFraming}

## Chronicle Title
${title}

## Cast
${castList}

## Chronicle Content
${content}

## Instructions
${sceneInstructions}

Weave the visual identity of each cast member into the scene description so their appearance is clear without separate lookups.

IMPORTANT: Keep the scene description to 100-150 words. Be vivid but concise — every word should carry visual weight. This description will be combined with style, composition, and color directives, so focus on WHAT TO SHOW, not how to render it.

Return ONLY valid JSON:
{"coverImageScene": "..."}`;
}

async function executeCoverImageSceneStep(
  task: WorkerTask,
  chronicleRecord: ChronicleRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const { content } = resolveTargetVersionContent(chronicleRecord);
  if (!content) {
    return { success: false, error: 'Chronicle has no assembled content for cover image scene' };
  }

  const callConfig = getCallConfig(config, 'chronicle.coverImageScene');
  const chronicleId = chronicleRecord.chronicleId;

  const narrativeStyleId = task.chronicleContext?.narrativeStyle?.id || 'epic-drama';
  const coverConfig = getCoverImageConfig(narrativeStyleId);
  const sceneTemplate = getScenePromptTemplate(coverConfig.scenePromptId);

  const scenePrompt = buildCoverImageScenePrompt(
    content,
    chronicleRecord.title,
    chronicleRecord.roleAssignments,
    sceneTemplate.framing,
    sceneTemplate.instructions,
    task.visualIdentities
  );

  const sceneCall = await runTextCall({
    llmClient,
    callType: 'chronicle.coverImageScene',
    callConfig,
    systemPrompt: 'You are a visual art director creating cover image compositions. Always respond with valid JSON.',
    prompt: scenePrompt,
    temperature: 0.5,
  });

  const sceneResult = sceneCall.result;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: sceneResult.debug };
  }

  if (sceneResult.error || !sceneResult.text) {
    return { success: false, error: `Cover image scene failed: ${sceneResult.error || 'Empty response'}`, debug: sceneResult.debug };
  }

  let sceneDescription: string;

  try {
    const parsed = parseJsonObject<Record<string, unknown>>(sceneResult.text, 'cover image scene response');
    sceneDescription = typeof parsed.coverImageScene === 'string' ? parsed.coverImageScene.trim() : '';
    if (!sceneDescription) {
      return { success: false, error: 'Cover image scene response missing coverImageScene field', debug: sceneResult.debug };
    }
  } catch {
    return { success: false, error: 'Failed to parse cover image scene response', debug: sceneResult.debug };
  }

  // Use all primary role assignments for involvedEntityIds (visual identity is now in the scene description)
  const involvedEntityIds = chronicleRecord.roleAssignments
    .filter((r) => r.isPrimary)
    .map((r) => r.entityId);

  const coverImage: ChronicleCoverImage = {
    sceneDescription,
    involvedEntityIds,
    status: 'pending',
  };

  const sceneCost = {
    estimated: sceneCall.estimate.estimatedCost,
    actual: sceneCall.usage.actualCost,
    inputTokens: sceneCall.usage.inputTokens,
    outputTokens: sceneCall.usage.outputTokens,
  };

  await updateChronicleCoverImage(chronicleId, coverImage, sceneCost, callConfig.model);

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleCoverImageScene' as CostType,
    model: callConfig.model,
    estimatedCost: sceneCost.estimated,
    actualCost: sceneCost.actual,
    inputTokens: sceneCost.inputTokens,
    outputTokens: sceneCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: sceneCost.estimated,
      actualCost: sceneCost.actual,
      inputTokens: sceneCost.inputTokens,
      outputTokens: sceneCost.outputTokens,
    },
    debug: sceneResult.debug,
  };
}

// ============================================================================
// Cover Image Generation Step
// ============================================================================
// Note: Cover image generation is dispatched from the UI as a standard image
// task (same pipeline as prompt_request images in ChronicleImagePanel).
// The cover_image step is reserved for future use if server-side generation
// is needed. For now, the UI handles: build prompt → dispatch image task →
// update cover image status via updateChronicleCoverImageStatus.

async function executeCoverImageStep(
  _task: WorkerTask,
  chronicleRecord: ChronicleRecord,
  _context: TaskContext
): Promise<TaskResult> {
  if (!chronicleRecord.coverImage) {
    return { success: false, error: 'Chronicle has no cover image scene description' };
  }
  return { success: false, error: 'Cover image generation is handled via the image task pipeline from the UI' };
}

// ============================================================================
// Regenerate Scene Description Step (single image ref)
// ============================================================================

function buildRegenerateSceneDescriptionPrompt(
  chunk: string,
  anchorText: string,
  involvedEntities: Array<{ id: string; name: string; kind: string }>,
  visualIdentities?: Record<string, string>,
  originalDescription?: string,
  originalCaption?: string
): string {
  const entityList = involvedEntities
    .map((e) => {
      let line = `- ${e.name} (${e.kind})`;
      const visual = visualIdentities?.[e.id];
      if (visual) {
        line += `\n  Visual: ${visual}`;
      }
      return line;
    })
    .join('\n');

  return `You are rewriting a scene description for an image that will be placed in a chronicle.

## Context (excerpt from chronicle)
${chunk}

## Anchor Point
The image appears near: "${anchorText}"

## Involved Entities
${entityList || '(none specified)'}

## Previous Description
${originalDescription || '(none)'}

## Previous Caption
${originalCaption || '(none)'}

## Instructions
Write a vivid 1-2 sentence scene description for this image placement. The description should:
- Capture the dramatic moment or atmosphere at this point in the narrative
- Reference the involved entities by their visual appearance (use their Visual identity)
- Be specific enough for an image generator to create a compelling scene
- Describe what figures LOOK LIKE, not just what they're doing

Also write a short caption (a few words to a brief sentence) suitable for display beneath the image. The caption should identify the scene or moment, not describe the image.

Return ONLY valid JSON:
{"sceneDescription": "...", "caption": "..."}`;
}

async function executeRegenerateSceneDescriptionStep(
  task: WorkerTask,
  chronicleRecord: ChronicleRecord | undefined,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing' };
  }
  if (!task.imageRefId) {
    return { success: false, error: 'imageRefId required for scene description regeneration' };
  }

  const { content } = resolveTargetVersionContent(chronicleRecord);
  if (!content) {
    return { success: false, error: 'Chronicle has no content' };
  }

  // Find the target ref
  const ref = chronicleRecord.imageRefs?.refs.find((r) => r.refId === task.imageRefId);
  if (!ref || ref.type !== 'prompt_request') {
    return { success: false, error: `Prompt request ref ${task.imageRefId} not found` };
  }

  // Extract ~2000 chars around the anchor point
  const anchorIndex = ref.anchorIndex ?? 0;
  const CONTEXT_CHARS = 2000;
  const start = Math.max(0, anchorIndex - CONTEXT_CHARS / 2);
  const end = Math.min(content.length, anchorIndex + CONTEXT_CHARS / 2);
  const chunk = content.substring(start, end);

  // Resolve involved entities from chronicleContext
  const involvedEntities = (ref.involvedEntityIds || [])
    .map((id) => task.chronicleContext?.entities.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => e != null)
    .map((e) => ({ id: e.id, name: e.name, kind: e.kind }));

  const prompt = buildRegenerateSceneDescriptionPrompt(
    chunk,
    ref.anchorText,
    involvedEntities,
    task.visualIdentities,
    ref.sceneDescription,
    ref.caption
  );

  const callConfig = getCallConfig(config, 'chronicle.imageRefs');
  const call = await runTextCall({
    llmClient,
    callType: 'chronicle.imageRefs',
    callConfig,
    systemPrompt: 'You are rewriting a scene description for a chronicle image. Always respond with valid JSON.',
    prompt,
    temperature: 0.6,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: call.result.debug };
  }

  if (call.result.error || !call.result.text) {
    return { success: false, error: `Scene description failed: ${call.result.error || 'Empty response'}`, debug: call.result.debug };
  }

  let newDescription: string;
  let newCaption: string | undefined;
  try {
    const parsed = parseJsonObject<{ sceneDescription: string; caption?: string }>(call.result.text, 'scene description');
    newDescription = typeof parsed.sceneDescription === 'string' ? parsed.sceneDescription.trim() : '';
    if (!newDescription) {
      return { success: false, error: 'No sceneDescription in response', debug: call.result.debug };
    }
    newCaption = typeof parsed.caption === 'string' ? parsed.caption.trim() || undefined : undefined;
  } catch {
    return { success: false, error: 'Failed to parse scene description response', debug: call.result.debug };
  }

  // Update the ref in storage — scene description + caption
  const refUpdates: Parameters<typeof updateChronicleImageRef>[2] = {
    sceneDescription: newDescription,
    status: 'pending' as const,
  };
  if (newCaption) {
    refUpdates.caption = newCaption;
  }
  await updateChronicleImageRef(chronicleRecord.chronicleId, task.imageRefId, refUpdates);

  const cost = {
    estimated: call.estimate.estimatedCost,
    actual: call.usage.actualCost,
    inputTokens: call.usage.inputTokens,
    outputTokens: call.usage.outputTokens,
  };

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId: chronicleRecord.chronicleId,
    type: 'chronicleImageRefRegen' as CostType,
    model: callConfig.model,
    estimatedCost: cost.estimated,
    actualCost: cost.actual,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId: chronicleRecord.chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: cost.estimated,
      actualCost: cost.actual,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
    },
    debug: call.result.debug,
  };
}

export const chronicleTask = {
  type: 'entityChronicle',
  execute: executeEntityChronicleTask,
} satisfies TaskHandler<WorkerTask & { type: 'entityChronicle' }>;
