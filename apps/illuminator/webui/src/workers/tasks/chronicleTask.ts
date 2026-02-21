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
  ChronicleSampling,
  QuickCheckReport,
} from '../../lib/chronicleTypes';
import { CHRONICLE_SAMPLING_TOP_P } from '../../lib/chronicleTypes';
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
  updateChronicleTemporalCheckReport,
  updateChronicleQuickCheckReport,
  updateChronicleSummary,
  updateChronicleTitle,
  updateChronicleImageRefs,
  updateChronicleImageRef,
  updateChronicleCoverImage,
  updateChronicleCoverImageStatus,
  updateChronicleFailure,
  getChronicle,
  putChronicle,
} from '../../lib/db/chronicleRepository';
import { saveCostRecordWithDefaults, type CostType } from '../../lib/db/costRepository';
import { resolveAnchorPhrase } from '../../lib/fuzzyAnchor';
import {
  selectEntitiesV2,
  buildV2Prompt,
  getMaxTokensFromStyle,
  getV2SystemPrompt,
  buildCreativeStoryPrompt,
  getCreativeSystemPrompt,
  DEFAULT_V2_CONFIG,
} from '../../lib/chronicle/v2';
import type { NarrativeStyle } from '@canonry/world-schema';
import { getStyleLibrary } from '../../lib/db/styleRepository';
import { buildCopyEditSystemPrompt, buildCopyEditUserPrompt } from '../../lib/chronicle/v2/copyEditPrompt';
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
    return executeSamplingRegenerationStep(task, chronicleRecord, context);
  }

  if (step === 'regenerate_full') {
    return executeFullRegenerationStep(task, chronicleRecord, context);
  }

  if (step === 'regenerate_creative') {
    return executeCreativeRegenerationStep(task, chronicleRecord, context);
  }

  if (step === 'compare') {
    return executeCompareStep(task, chronicleRecord, context);
  }

  if (step === 'combine') {
    return executeCombineStep(task, chronicleRecord, context);
  }

  if (step === 'copy_edit') {
    return executeCopyEditStep(task, chronicleRecord, context);
  }

  if (step === 'temporal_check') {
    return executeTemporalCheckStep(task, chronicleRecord, context);
  }

  if (step === 'quick_check') {
    return executeQuickCheckStep(task, chronicleRecord, context);
  }

  if (step === 'summary') {
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
  const versions = record.generationHistory || [];
  const latest = versions.reduce(
    (acc, v) => (acc && acc.generatedAt > v.generatedAt ? acc : v),
    versions[0]
  );
  const activeVersionId = record.activeVersionId || latest?.versionId;
  const match = versions.find((version) => version.versionId === activeVersionId);
  if (match) {
    return { versionId: match.versionId, content: match.content };
  }
  if (latest) {
    return { versionId: latest.versionId, content: latest.content };
  }
  return { versionId: activeVersionId || 'unknown', content: record.assembledContent || '' };
}

/**
 * Resolve sampling parameters from LLM call config.
 * Sampling is now controlled globally via LLM config (topP: 1.0 = normal, 0.95 = low).
 */
function resolveChronicleSamplingParams(
  callConfig: ReturnType<typeof getCallConfig>
): { temperature?: number; topP?: number } {
  const hasThinking = callConfig.thinkingBudget > 0;
  if (hasThinking) {
    // Use topP from config (1.0 = normal, 0.95 = low)
    return { topP: callConfig.topP ?? CHRONICLE_SAMPLING_TOP_P.normal };
  }

  if (callConfig.temperature !== undefined) {
    return { temperature: callConfig.temperature };
  }

  return {};
}

/**
 * Derive ChronicleSampling value from config for storage/history.
 */
function deriveSamplingFromConfig(callConfig: ReturnType<typeof getCallConfig>): ChronicleSampling {
  const topP = callConfig.topP ?? CHRONICLE_SAMPLING_TOP_P.normal;
  return topP <= 0.95 ? 'low' : 'normal';
}

/**
 * Regenerate chronicle content with a sampling override (no perspective synthesis).
 * Reuses stored prompts from the previous generation.
 */
async function executeSamplingRegenerationStep(
  task: WorkerTask,
  chronicleRecord: ChronicleRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!chronicleRecord) {
    return { success: false, error: 'Chronicle record missing for regeneration' };
  }

  if (chronicleRecord.status === 'complete' || chronicleRecord.finalContent) {
    return { success: false, error: 'Sampling regeneration is only available before acceptance' };
  }

  const systemPrompt = chronicleRecord.generationSystemPrompt;
  const userPrompt = chronicleRecord.generationUserPrompt;
  if (!systemPrompt || !userPrompt) {
    return { success: false, error: 'Stored prompts missing; cannot regenerate this chronicle' };
  }

  const callConfig = getCallConfig(config, 'chronicle.generation');
  const samplingParams = resolveChronicleSamplingParams(callConfig);
  const sampling = deriveSamplingFromConfig(callConfig);

  const styleMaxTokens = chronicleRecord.narrativeStyle
    ? getMaxTokensFromStyle(chronicleRecord.narrativeStyle)
    : undefined;

  const generationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    ...samplingParams,
    autoMaxTokens: styleMaxTokens,
  });

  const result = generationCall.result;

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `Sampling regeneration failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  try {
    await regenerateChronicleAssembly(chronicleRecord.chronicleId, {
      assembledContent: result.text,
      systemPrompt,
      userPrompt,
      model: callConfig.model,
      sampling,
      step: 'regenerate',
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
 * Full regeneration with new perspective synthesis.
 * Creates a new version by running the complete generation pipeline,
 * snapshotting the current version to history first.
 */
async function executeFullRegenerationStep(
  task: WorkerTask,
  chronicleRecord: ChronicleRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!task.chronicleContext) {
    return { success: false, error: 'Chronicle context required for full regeneration' };
  }

  let chronicleContext = task.chronicleContext!;
  const narrativeStyle = chronicleContext.narrativeStyle;

  if (!narrativeStyle) {
    return { success: false, error: 'Narrative style is required for full regeneration' };
  }

  if (chronicleRecord.status === 'complete' || chronicleRecord.finalContent) {
    return { success: false, error: 'Full regeneration requires unpublishing first' };
  }

  const callConfig = getCallConfig(config, 'chronicle.generation');
  const chronicleId = chronicleRecord.chronicleId;
  console.log(`[Worker] Full regeneration for chronicle=${chronicleId}, style="${narrativeStyle.name}", model=${callConfig.model}`);

  // Validate perspective synthesis inputs
  if (!chronicleContext.toneFragments || !chronicleContext.canonFactsWithMetadata) {
    return {
      success: false,
      error: 'Full regeneration requires toneFragments and canonFactsWithMetadata. Configure world context with structured tone and facts.',
    };
  }

  let perspectiveResult: PerspectiveSynthesisResult;
  let perspectiveRecord: PerspectiveSynthesisRecord;
  let constellation: EntityConstellation;

  // Run perspective synthesis
  {
    console.log('[Worker] Running perspective synthesis for full regeneration...');
    const perspectiveConfig = getCallConfig(config, 'perspective.synthesis');

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
          narrativeStyle,
          proseHints: chronicleContext.proseHints,
          worldDynamics: chronicleContext.worldDynamics,
          factSelection: chronicleContext.factSelection,
          narrativeDirection: chronicleContext.narrativeDirection,
          roleAssignments: chronicleContext.focus?.roleAssignments,
        },
        llmClient,
        perspectiveConfig
      );

      perspectiveRecord = {
        generatedAt: Date.now(),
        model: perspectiveConfig.model,
        brief: perspectiveResult.synthesis.brief,
        facets: perspectiveResult.synthesis.facets,
        suggestedMotifs: perspectiveResult.synthesis.suggestedMotifs,
        narrativeVoice: perspectiveResult.synthesis.narrativeVoice,
        entityDirectives: perspectiveResult.synthesis.entityDirectives,
        temporalNarrative: perspectiveResult.synthesis.temporalNarrative,
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
        factSelectionRange: (() => {
          const requestedMin = chronicleContext.factSelection?.minCount;
          const requestedMax = chronicleContext.factSelection?.maxCount;
          if (
            (typeof requestedMin === 'number' && requestedMin > 0) ||
            (typeof requestedMax === 'number' && requestedMax > 0)
          ) {
            return { min: requestedMin, max: requestedMax };
          }
          return undefined;
        })(),
        inputFacts: chronicleContext.canonFactsWithMetadata?.map((f) => ({
          id: f.id,
          text: f.text,
          type: f.type,
          required: f.required,
          disabled: f.disabled,
        })),
        inputWorldDynamics: perspectiveResult.resolvedWorldDynamics,
        inputCulturalIdentities: chronicleContext.culturalIdentities,
        inputEntities: chronicleContext.entities.slice(0, 15).map((e) => ({
          name: e.name,
          kind: e.kind,
          culture: e.culture,
          summary: e.summary,
        })),
        focalEra: chronicleContext.era ? {
          id: chronicleContext.era.id,
          name: chronicleContext.era.name,
          description: chronicleContext.era.description,
        } : undefined,
        inputTokens: perspectiveResult.usage.inputTokens,
        outputTokens: perspectiveResult.usage.outputTokens,
        actualCost: perspectiveResult.usage.actualCost,
      };

      const motifSection = perspectiveResult.synthesis.suggestedMotifs.length > 0
        ? `\n\nSUGGESTED MOTIFS (phrases that might echo through this chronicle):\n${perspectiveResult.synthesis.suggestedMotifs.map(m => `- "${m}"`).join('\n')}`
        : '';

      // coreTone is excluded from the generation prompt for all formats.
      // It contains world-level prose guidance (SYNTACTIC POETRY, BITTER CAMARADERIE, CLOSING VARIETY, etc.)
      // that conflicts with narrative style proseInstructions — e.g. "dark, war-weary" fights Dreamscape's
      // "hallucinatory, fluid" and introduces competing closing line guidance.
      // PS already receives coreTone as input and incorporates it into its synthesis.
      // The generation prompt gets only: PS brief + motifs + narrative style proseInstructions.
      const toneForGeneration = 'PERSPECTIVE FOR THIS CHRONICLE:\n' +
          perspectiveResult.synthesis.brief +
          motifSection;

      chronicleContext = {
        ...chronicleContext,
        tone: toneForGeneration,
        canonFacts: perspectiveResult.facetedFacts,
        narrativeVoice: perspectiveResult.synthesis.narrativeVoice,
        entityDirectives: perspectiveResult.synthesis.entityDirectives,
        worldDynamicsResolved: perspectiveResult.resolvedWorldDynamics.map((d) => d.text),
        temporalNarrative: perspectiveResult.synthesis.temporalNarrative,
      };

      console.log(`[Worker] Perspective synthesis complete: ${perspectiveResult.facetedFacts.length} faceted facts, ${perspectiveResult.synthesis.suggestedMotifs.length} motifs`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[Worker] Perspective synthesis failed:', errorMessage);
      return { success: false, error: `Perspective synthesis failed: ${errorMessage}` };
    }
  }

  // Generate new content
  const selection = selectEntitiesV2(chronicleContext, DEFAULT_V2_CONFIG);
  console.log(`[Worker] V2 selected ${selection.entities.length} entities, ${selection.events.length} events, ${selection.relationships.length} relationships`);

  const prompt = buildV2Prompt(chronicleContext, narrativeStyle, selection);
  const styleMaxTokens = getMaxTokensFromStyle(narrativeStyle);
  const systemPrompt = getV2SystemPrompt(narrativeStyle);
  const samplingParams = resolveChronicleSamplingParams(callConfig);
  const sampling = deriveSamplingFromConfig(callConfig);
  const generationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt,
    ...samplingParams,
    autoMaxTokens: styleMaxTokens,
  });
  const result = generationCall.result;

  console.log(`[Worker] Full regen prompt length: ${prompt.length} chars, maxTokens: ${generationCall.budget.totalMaxTokens}`);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `Full regeneration failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  // Save as new version (snapshots current to history)
  try {
    await regenerateChronicleAssembly(chronicleId, {
      assembledContent: result.text,
      systemPrompt,
      userPrompt: prompt,
      model: callConfig.model,
      sampling,
      step: 'regenerate',
      cost: {
        estimated: generationCall.estimate.estimatedCost + perspectiveResult.usage.actualCost,
        actual: generationCall.usage.actualCost + perspectiveResult.usage.actualCost,
        inputTokens: generationCall.usage.inputTokens + perspectiveResult.usage.inputTokens,
        outputTokens: generationCall.usage.outputTokens + perspectiveResult.usage.outputTokens,
      },
    });

    // Update perspective synthesis record on the chronicle
    const updatedChronicle = await getChronicle(chronicleId);
    if (updatedChronicle) {
      updatedChronicle.perspectiveSynthesis = perspectiveRecord;
      updatedChronicle.generationContext = {
        worldName: chronicleContext.worldName,
        worldDescription: chronicleContext.worldDescription,
        tone: chronicleContext.tone,
        canonFacts: chronicleContext.canonFacts,
        nameBank: chronicleContext.nameBank,
        narrativeVoice: chronicleContext.narrativeVoice,
        entityDirectives: chronicleContext.entityDirectives,
        temporalNarrative: chronicleContext.temporalNarrative,
      };
      updatedChronicle.updatedAt = Date.now();
      await putChronicle(updatedChronicle);
    }

    console.log(`[Worker] Full regeneration saved for chronicle ${chronicleId}`);
  } catch (err) {
    return { success: false, error: `Failed to save regenerated chronicle: ${err}` };
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

  const totalCost = {
    estimated: generationCall.estimate.estimatedCost + perspectiveResult.usage.actualCost,
    actual: generationCall.usage.actualCost + perspectiveResult.usage.actualCost,
    inputTokens: generationCall.usage.inputTokens + perspectiveResult.usage.inputTokens,
    outputTokens: generationCall.usage.outputTokens + perspectiveResult.usage.outputTokens,
  };

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: totalCost.estimated,
      actualCost: totalCost.actual,
      inputTokens: totalCost.inputTokens,
      outputTokens: totalCost.outputTokens,
    },
    debug: result.debug,
  };
}

/**
 * Creative freedom regeneration.
 * Reuses the EXISTING PS outputs already stored on the chronicle record.
 * Only the generation prompt framing differs: neutral identity, no performance
 * anxiety, softened structure, no craft posture. No new PS call.
 */
async function executeCreativeRegenerationStep(
  task: WorkerTask,
  chronicleRecord: ChronicleRecord,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  if (!task.chronicleContext) {
    return { success: false, error: 'Chronicle context required for creative regeneration' };
  }

  const narrativeStyle = task.chronicleContext.narrativeStyle;

  if (!narrativeStyle) {
    return { success: false, error: 'Narrative style is required for creative regeneration' };
  }

  if (narrativeStyle.format !== 'story') {
    return { success: false, error: 'Creative freedom mode is only available for story format chronicles' };
  }

  if (chronicleRecord.status === 'complete' || chronicleRecord.finalContent) {
    return { success: false, error: 'Creative regeneration requires unpublishing first' };
  }

  // Read stored PS outputs from the chronicle's perspective synthesis record
  const ps = chronicleRecord.perspectiveSynthesis;
  if (!ps) {
    return { success: false, error: 'Creative regeneration requires existing perspective synthesis. Generate a structured version first.' };
  }

  const callConfig = getCallConfig(config, 'chronicle.generation');
  const chronicleId = chronicleRecord.chronicleId;
  console.log(`[Worker] Creative freedom regeneration for chronicle=${chronicleId}, style="${narrativeStyle.name}", model=${callConfig.model}`);

  // Reconstruct tone from PS outputs (same pattern as regenerate_full)
  // coreTone excluded — PS already received it and incorporated it into synthesis.
  // Generation prompt gets only PS brief + motifs + narrative style proseInstructions.
  const motifSection = ps.suggestedMotifs.length > 0
    ? `\n\nSUGGESTED MOTIFS (phrases that might echo through this chronicle):\n${ps.suggestedMotifs.map(m => `- "${m}"`).join('\n')}`
    : '';
  const toneForGeneration = 'PERSPECTIVE FOR THIS CHRONICLE:\n' +
    ps.brief +
    motifSection;

  // Build faceted facts from PS facets
  const facetedFacts = ps.facets.map((f) => `${f.interpretation}`);

  // Build chronicleContext with stored PS outputs injected
  const chronicleContext = {
    ...task.chronicleContext,
    tone: toneForGeneration,
    canonFacts: facetedFacts,
    narrativeVoice: ps.narrativeVoice,
    entityDirectives: ps.entityDirectives,
    temporalNarrative: ps.temporalNarrative,
  };

  // Entity/event selection
  const selection = selectEntitiesV2(chronicleContext, DEFAULT_V2_CONFIG);
  console.log(`[Worker] Creative selected ${selection.entities.length} entities, ${selection.events.length} events, ${selection.relationships.length} relationships`);

  // Build creative prompt (same PS data, different framing)
  const prompt = buildCreativeStoryPrompt(chronicleContext, selection);
  const styleMaxTokens = getMaxTokensFromStyle(narrativeStyle);
  const systemPrompt = getCreativeSystemPrompt();
  const samplingParams = resolveChronicleSamplingParams(callConfig);
  const sampling = deriveSamplingFromConfig(callConfig);

  const generationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt,
    ...samplingParams,
    autoMaxTokens: styleMaxTokens,
  });
  const result = generationCall.result;

  console.log(`[Worker] Creative prompt length: ${prompt.length} chars, maxTokens: ${generationCall.budget.totalMaxTokens}`);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: result.debug };
  }

  if (result.error || !result.text) {
    return {
      success: false,
      error: `Creative regeneration failed: ${result.error || 'No text returned'}`,
      debug: result.debug,
    };
  }

  // Save as new version (snapshots current to history)
  try {
    await regenerateChronicleAssembly(chronicleId, {
      assembledContent: result.text,
      systemPrompt,
      userPrompt: prompt,
      model: callConfig.model,
      sampling,
      step: 'creative',
      cost: {
        estimated: generationCall.estimate.estimatedCost,
        actual: generationCall.usage.actualCost,
        inputTokens: generationCall.usage.inputTokens,
        outputTokens: generationCall.usage.outputTokens,
      },
    });

    console.log(`[Worker] Creative regeneration saved for chronicle ${chronicleId}`);
  } catch (err) {
    return { success: false, error: `Failed to save creative regeneration: ${err}` };
  }

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleV2' as CostType,
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
          factSelection: chronicleContext.factSelection, // Fact selection target + required
          narrativeDirection: chronicleContext.narrativeDirection,
          roleAssignments: chronicleContext.focus?.roleAssignments,
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
        temporalNarrative: perspectiveResult.synthesis.temporalNarrative,

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
        factSelectionRange: (() => {
          const requestedMin = chronicleContext.factSelection?.minCount;
          const requestedMax = chronicleContext.factSelection?.maxCount;
          if (
            (typeof requestedMin === 'number' && requestedMin > 0) ||
            (typeof requestedMax === 'number' && requestedMax > 0)
          ) {
            return { min: requestedMin, max: requestedMax };
          }
          return undefined;
        })(),
        inputFacts: chronicleContext.canonFactsWithMetadata?.map((f) => ({
          id: f.id,
          text: f.text,
          type: f.type,
          required: f.required,
          disabled: f.disabled,
        })),
        inputWorldDynamics: perspectiveResult.resolvedWorldDynamics,
        inputCulturalIdentities: chronicleContext.culturalIdentities,
        inputEntities: chronicleContext.entities.slice(0, 15).map((e) => ({
          name: e.name,
          kind: e.kind,
          culture: e.culture,
          summary: e.summary,
        })),
        focalEra: chronicleContext.era ? {
          id: chronicleContext.era.id,
          name: chronicleContext.era.name,
          description: chronicleContext.era.description,
        } : undefined,

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
      // coreTone excluded — PS already received it and incorporated it into synthesis.
      // See comment in full-regeneration path above.
      const toneForGeneration = 'PERSPECTIVE FOR THIS CHRONICLE:\n' +
          perspectiveResult.synthesis.brief +
          motifSection;

      chronicleContext = {
        ...chronicleContext,
        tone: toneForGeneration,
        canonFacts: perspectiveResult.facetedFacts,
        narrativeVoice: perspectiveResult.synthesis.narrativeVoice,
        entityDirectives: perspectiveResult.synthesis.entityDirectives,
        worldDynamicsResolved: perspectiveResult.resolvedWorldDynamics.map((d) => d.text),
        temporalNarrative: perspectiveResult.synthesis.temporalNarrative,
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
  const samplingParams = resolveChronicleSamplingParams(callConfig);
  const sampling = deriveSamplingFromConfig(callConfig);
  const generationCall = await runTextCall({
    llmClient,
    callType: 'chronicle.generation',
    callConfig,
    systemPrompt,
    prompt,
    ...samplingParams,
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
      generationSampling: sampling,
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
        temporalNarrative: chronicleContext.temporalNarrative,
        narrativeDirection: chronicleContext.narrativeDirection,
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
): Array<{ label: string; content: string; sampling?: ChronicleSampling; wordCount: number }> {
  const versions: Array<{ label: string; content: string; sampling?: ChronicleSampling; wordCount: number }> = [];

  const history = [...(chronicleRecord.generationHistory || [])].sort(
    (a, b) => a.generatedAt - b.generatedAt
  );
  for (let i = 0; i < history.length; i++) {
    const samplingLabel = history[i].sampling ?? 'unspecified';
    const stepLabel = history[i].step ? `, step=${history[i].step}` : '';
    versions.push({
      label: `Version ${i + 1} (sampling=${samplingLabel}${stepLabel})`,
      content: history[i].content,
      sampling: history[i].sampling,
      wordCount: history[i].wordCount,
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
    if ('craftPosture' in narrativeStyle && narrativeStyle.craftPosture) {
      parts.push(`Craft Posture: ${(narrativeStyle.craftPosture as string).slice(0, 300)}`);
    }
    narrativeStyleBlock = parts.join('\n');
  }

  const versionsBlock = versions.map((v) =>
    `## ${v.label}\nWord count: ${v.wordCount}\n\n${v.content}`
  ).join('\n\n---\n\n');

  // Build world facts block from canon facts (these are the faceted interpretations used in generation)
  const canonFacts = chronicleRecord.generationContext?.canonFacts || [];
  const worldFactsBlock = canonFacts.length > 0
    ? `## World Facts (Faceted)\nThese are the world truths provided to the chronicle generator, already interpreted through the chronicle's perspective:\n${canonFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n`
    : '';

  // Narrative direction (optional, from wizard)
  const narrativeDirection = chronicleRecord.narrativeDirection;
  const narrativeDirectionBlock = narrativeDirection
    ? `\n## Narrative Direction\nThe author specified this narrative purpose: "${narrativeDirection}"\nEvaluate how well each version fulfills this specific intent.\n`
    : '';

  const isDocumentFormat = chronicleRecord.narrativeStyle?.format === 'document';

  const comparePrompt = isDocumentFormat
    ? `You are comparing ${versions.length} versions of the same in-universe document. Each was generated from the same prompt and document format (${narrativeStyleName}) but with different sampling modes (normal vs low).
${narrativeStyleBlock ? `\n## Document Format Reference\n${narrativeStyleBlock}\n` : ''}${worldFactsBlock ? `\n${worldFactsBlock}` : ''}${narrativeDirectionBlock}
Your output must have THREE sections in this exact order. Keep the total output under 800 words.

## Comparative Analysis

Cover each dimension in 2-3 sentences, naming the stronger version with one specific example:

1. **In-Universe Believability**: Which reads more like a real ${narrativeStyleName} that exists within this world? Consider the whole artifact — does it feel like something a person in this setting would produce, handle, or encounter? Material texture (stamps, marginalia, wear) counts, but so does getting the tone and purpose right.
2. **World Integration**: Review the World Facts above. Which version better absorbs the world's specifics — names, places, factions, customs, tensions — into the document's fabric? Which makes the world feel lived-in rather than referenced? Are any key facts missing or contradicted?
3. **Voice & Purpose**: Does the document sound like its supposed author? A wanted notice written by a bureaucrat should sound bureaucratic; a folk song collected by a scholar should sound collected. Which version better inhabits its authorial perspective? Note: a document that maintains consistent voice throughout is doing its job — sustained register is a virtue.
4. **Documentary Craft**: Which makes smarter choices about what to include, emphasize, bury, or omit? Documents communicate through structure and editorial choices — what's foregrounded, what's in footnotes, what's conspicuously absent. Which version shows better editorial intelligence?
5. **Specificity & Invention**: Which grounds itself in concrete, plausible details (titles, dates, procedures, citations) rather than generic atmosphere or invented backstory? Which stays within what its author would know and record?

## Recommendation

State one of: **Keep Version [X]** (one version is clearly superior), or **Combine** (each version has distinct strengths worth merging). Explain why in 2-3 sentences.

## Combine Instructions

Write a SHORT paragraph (4-6 sentences) of editorial direction for a writer who will combine these versions. This paragraph will be the ONLY guidance they receive — they will not see your analysis above — so it must carry enough context to stand alone. Ground your instructions in the specific findings from your analysis.

Name which version should serve as the foundation and why — its structure, its information arc, its strongest sections. Then name what the other version does that the foundation draft doesn't: sections it handled better, details it included, structural choices that strengthen the piece. These are the things the combined version shouldn't lose.

Equally important: name what to CUT from the foundation to make room. Every import should displace something weaker, not stack on top. Flag any passages in either version that catalog or list without purpose, repeat the same information in template form, or pad the document without adding substance — these should not survive the combine.

Don't recommend swapping names or terminology between versions. Trust the writer to make specific decisions — do not prescribe line-by-line changes.

## Document Versions

${versionsBlock}`
    : `You are comparing ${versions.length} versions of the same chronicle. Each was generated from the same prompt and narrative style (${narrativeStyleName}) but with different sampling modes (normal vs low).
${narrativeStyleBlock ? `\n## Narrative Style Reference\n${narrativeStyleBlock}\n` : ''}${worldFactsBlock ? `\n${worldFactsBlock}` : ''}${narrativeDirectionBlock}
Your output must have THREE sections in this exact order. Keep the total output under 800 words.

## Comparative Analysis

Cover each dimension in 2-3 sentences, naming the stronger version with one specific example:

1. **Prose Quality**: Which has more natural, engaging prose? Where does each feel templated or forced?
2. **Structural Choices**: How do versions differ in scene ordering, POV, pacing? Which makes more surprising or effective choices?
3. **World-Building Detail**: Which invents richer names, places, customs, sensory details? Which feels more grounded?
4. **Factual Utilization**: Review the World Facts above. Which version better integrates these facts — weaving them naturally into narrative rather than listing them? Which shows facts through action and dialogue vs. exposition? Are any facts missing or contradicted?
5. **Narrative Style Adherence (${narrativeStyleName})**: Evaluate against the narrative style above — its required structure, prose techniques, and specific instructions. Which better fulfills these? Which better follows entity directives?
6. **Emotional Range**: Which has more varied emotional registers vs. falling into a single mood?
7. **Perspective Integration**: Which better integrates the perspective synthesis outputs — narrative voice (synthesized prose guidance), entity directives (per-character writing guidance), and cultural identities? Which feels inhabited vs. described from outside?

## Recommendation

State one of: **Keep Version [X]** (one version is clearly superior), or **Combine** (each version has distinct strengths worth merging). Explain why in 2-3 sentences.

## Combine Instructions

Write a SHORT paragraph (4-6 sentences) of editorial direction for a writer who will combine these versions. This paragraph will be the ONLY guidance they receive — they will not see your analysis above — so it must carry enough context to stand alone. Ground your instructions in the specific findings from your analysis.

Name which version should serve as the foundation and why — its arc, its scenes, its strongest moments. Then name what the other version does that the foundation draft doesn't: scenes it invented, character beats it handled better, details that enrich the world. These are the things the combined version shouldn't lose.

Equally important: name what to CUT from the foundation to make room. Every import should displace something weaker, not stack on top. Flag any passages in either version that catalog or list (names, events, effects in sequence), repeat the same dramatic beat in parallel structure, or read as a report of what happened rather than lived experience — these should not survive the combine.

Don't recommend swapping names or terminology between versions. Trust the writer to make specific decisions — do not prescribe line-by-line changes or integration points.

## Chronicle Versions

${versionsBlock}`;

  const compareSystemPrompt = isDocumentFormat
    ? 'You are an editorial reviewer evaluating drafts of an in-universe document. The core question is: which draft feels more like a real artifact from this world? Assess believability, world integration, and documentary craft. A document that maintains consistent voice is doing its job — sustained register is a strength.'
    : 'You are a narrative editor providing a comparative analysis of chronicle drafts. Be specific and cite examples from the text.';

  const compareCall = await runTextCall({
    llmClient,
    callType: 'chronicle.compare',
    callConfig,
    systemPrompt: compareSystemPrompt,
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

  const generationSystemPrompt = chronicleRecord.generationSystemPrompt || '';
  const narrativeStyle = chronicleRecord.narrativeStyle;
  const styleName = narrativeStyle ? `${narrativeStyle.name} (${narrativeStyle.format})` : 'unknown';
  const craftPosture = narrativeStyle && 'craftPosture' in narrativeStyle ? (narrativeStyle.craftPosture as string | undefined) : undefined;
  const isDocumentFormat = narrativeStyle?.format === 'document';

  // Narrative direction (optional, from wizard)
  const combineNarrativeDirection = chronicleRecord.narrativeDirection;
  const combineNarrativeDirectionBlock = combineNarrativeDirection
    ? `\n## Narrative Direction\nThe author specified this narrative purpose: "${combineNarrativeDirection}"\nThe combined version must fulfill this intent.\n`
    : '';

  // Check for combine instructions from a prior compare step
  const hasCombineInstructions = !!chronicleRecord.combineInstructions;

  const combinePrompt = isDocumentFormat
    ? `You are an editorial reviewer combining ${versions.length} versions of the same in-universe document into a single final version. All versions follow the same prompt and document format — they differ in sampling mode (normal vs low).

You have two drafts of the same in-universe document. Read both. Build your revision from the ground up: which version has the stronger opening? Which handles each section better? Which included details, structure, or framing the other missed? Take the best from each. Where they cover the same ground differently, go with whichever makes the document feel more like a real artifact from its world. Where one draft has something the other lacks entirely, bring it in.

Do not swap names or terminology between versions — keep each draft's choices consistent within the sections you draw from. A polish pass will follow to smooth voice and register; your job is to produce the best possible version of this document.
${hasCombineInstructions ? `
## Editorial Direction

${chronicleRecord.combineInstructions}
` : `
## Selection Criteria

Prefer whichever version:
- **Feels more like a real ${styleName}** — could this artifact exist in this world? Does it read like something its supposed author would produce?
- **Better integrates the world** — names, factions, customs, tensions woven into the document's fabric rather than referenced from outside
- **Inhabits its author's voice** — consistent register that matches who wrote this and why
- **Shows stronger editorial intelligence** — smart choices about what to foreground, bury, or omit
- **Grounds itself in specifics** — concrete details (titles, dates, procedures) over generic atmosphere

If one version has a better opening and another has better closing sections, use each. If versions handle the same section differently, pick the one that feels more like it belongs in this world.
`}${combineNarrativeDirectionBlock}
## Original System Prompt Context
${generationSystemPrompt}

Style: ${styleName}${craftPosture ? `\n\n## Craft Posture\nDensity and restraint constraints for this format:\n${craftPosture}` : ''}

## Document Versions

${versionsBlock}

## YOUR TASK

Produce the final document by selecting the strongest elements from each version. The result should feel like a real artifact from this world. Output ONLY the document text — no commentary, no labels, no preamble.`
    : `You are a narrative editor combining ${versions.length} versions of the same chronicle into a single final version. All versions follow the same prompt and narrative style — they differ in sampling mode (normal vs low).

You have two drafts of the same story. Read both. Build your revision from the ground up: which version has the stronger opening? Which handles the climax better? Which invented scenes, character beats, or details the other missed? Take the best from each. Where they cover the same ground differently, go with whichever makes the better story. Where one draft has something the other lacks entirely, bring it in.

Do not swap names or terminology between versions — keep each draft's choices consistent within the sections you draw from. A polish pass will follow to smooth voice and tone; your job is to produce the best possible version of this story.
${hasCombineInstructions ? `
## Editorial Direction

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
`}${combineNarrativeDirectionBlock}
## Original System Prompt Context
${generationSystemPrompt}

Style: ${styleName}${craftPosture ? `\n\n## Craft Posture\nDensity and restraint constraints for this format:\n${craftPosture}` : ''}

## Chronicle Versions

${versionsBlock}

## YOUR TASK

Produce the final chronicle by selecting the strongest elements from each version. Output ONLY the chronicle text — no commentary, no labels, no preamble.`;

  const combineSystemPrompt = isDocumentFormat
    ? 'You are an editorial reviewer producing the definitive version of an in-universe document from multiple drafts. The result should feel like a real artifact from this world. Maintain consistent voice. Output only the final document text.'
    : 'You are a narrative editor producing the definitive version of a chronicle from multiple drafts. Output only the final chronicle text.';

  const samplingParams = resolveChronicleSamplingParams(callConfig);
  const combineSampling = deriveSamplingFromConfig(callConfig);
  const combineCall = await runTextCall({
    llmClient,
    callType: 'chronicle.combine',
    callConfig,
    systemPrompt: combineSystemPrompt,
    prompt: combinePrompt,
    ...samplingParams,
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
    systemPrompt: combineSystemPrompt,
    userPrompt: combinePrompt,
    model: callConfig.model,
    sampling: combineSampling,
    step: 'combine',
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
// Copy-Edit Step (user-triggered, polishes active version)
// ============================================================================

async function executeCopyEditStep(
  task: WorkerTask,
  chronicleRecord: NonNullable<Awaited<ReturnType<typeof getChronicle>>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const chronicleId = chronicleRecord.chronicleId;
  const { content } = resolveTargetVersionContent(chronicleRecord);

  if (!content) {
    return { success: false, error: 'Chronicle has no content to copy-edit' };
  }

  const narrativeStyle = chronicleRecord.narrativeStyle;
  if (!narrativeStyle) {
    return { success: false, error: 'Chronicle has no narrative style — cannot determine word count target' };
  }

  const callConfig = getCallConfig(config, 'chronicle.copyEdit');
  console.log(`[Worker] Copy-editing chronicle ${chronicleId}, model=${callConfig.model}...`);

  const format = chronicleRecord.format === 'document' ? 'document' : 'story';
  const systemPrompt = buildCopyEditSystemPrompt(format);

  // Pass PS voice textures and motifs so the editor can recognize intentional prose choices
  const ps = chronicleRecord.perspectiveSynthesis;
  const voiceContext = ps ? {
    narrativeVoice: ps.narrativeVoice,
    motifs: ps.suggestedMotifs,
  } : undefined;

  const userPrompt = buildCopyEditUserPrompt(content, narrativeStyle, voiceContext);

  const samplingParams = resolveChronicleSamplingParams(callConfig);
  const sampling = deriveSamplingFromConfig(callConfig);
  const copyEditCall = await runTextCall({
    llmClient,
    callType: 'chronicle.copyEdit',
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    ...samplingParams,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: copyEditCall.result.debug };
  }

  if (copyEditCall.result.error || !copyEditCall.result.text) {
    return {
      success: false,
      error: `Copy-edit failed: ${copyEditCall.result.error || 'No text returned'}`,
      debug: copyEditCall.result.debug,
    };
  }

  // Save as a new version (snapshots current into history)
  // Store the actual copy-edit prompts, not the original generation prompts
  await regenerateChronicleAssembly(chronicleId, {
    assembledContent: copyEditCall.result.text,
    systemPrompt: systemPrompt,
    userPrompt: userPrompt,
    model: callConfig.model,
    sampling,
    step: 'copy_edit',
    cost: {
      estimated: copyEditCall.estimate.estimatedCost,
      actual: copyEditCall.usage.actualCost,
      inputTokens: copyEditCall.usage.inputTokens,
      outputTokens: copyEditCall.usage.outputTokens,
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
    estimatedCost: copyEditCall.estimate.estimatedCost,
    actualCost: copyEditCall.usage.actualCost,
    inputTokens: copyEditCall.usage.inputTokens,
    outputTokens: copyEditCall.usage.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: copyEditCall.estimate.estimatedCost,
      actualCost: copyEditCall.usage.actualCost,
      inputTokens: copyEditCall.usage.inputTokens,
      outputTokens: copyEditCall.usage.outputTokens,
    },
    debug: copyEditCall.result.debug,
  };
}

// ============================================================================
// Temporal Alignment Check Step (user-triggered, produces report)
// ============================================================================

async function executeTemporalCheckStep(
  task: WorkerTask,
  chronicleRecord: NonNullable<Awaited<ReturnType<typeof getChronicle>>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;

  const chronicleId = chronicleRecord.chronicleId;

  // Get the active version content
  const { content } = resolveTargetVersionContent(chronicleRecord);
  if (!content) {
    return { success: false, error: 'No chronicle content available for temporal check' };
  }

  // Get temporal narrative from perspective synthesis
  const temporalNarrative = chronicleRecord.perspectiveSynthesis?.temporalNarrative;
  if (!temporalNarrative) {
    return { success: false, error: 'No temporal narrative available — requires perspective synthesis with world dynamics' };
  }

  // Get focal era info
  const focalEra = chronicleRecord.temporalContext?.focalEra;
  const touchedEraIds = chronicleRecord.temporalContext?.touchedEraIds || [];
  const allEras = chronicleRecord.temporalContext?.allEras || [];
  const temporalScope = chronicleRecord.temporalContext?.temporalScope;
  const temporalDescription = chronicleRecord.temporalContext?.temporalDescription;

  // Build era context block
  const eraContextBlock = allEras.length > 0
    ? allEras.map(era => {
        const isFocal = focalEra?.id === era.id ? ' ← FOCAL ERA' : '';
        const isTouched = touchedEraIds.includes(era.id) ? ' (touched)' : '';
        return `- **${era.name}** (years ${era.startTick}–${era.endTick})${isFocal}${isTouched}${era.summary ? `: ${era.summary}` : ''}`;
      }).join('\n')
    : 'No era information available.';

  // Build era boundary context
  const isMultiEra = chronicleRecord.temporalContext?.isMultiEra || false;
  const tickRange = chronicleRecord.temporalContext?.chronicleTickRange;
  let boundaryBlock = '';

  if (focalEra && allEras.length > 1 && tickRange) {
    const sortedEras = [...allEras].sort((a, b) => a.startTick - b.startTick);
    const focalIdx = sortedEras.findIndex(e => e.id === focalEra.id);
    const adjacentEras: Array<{ era: typeof focalEra; boundary: number; direction: string }> = [];

    // Check previous era
    if (focalIdx > 0) {
      const prev = sortedEras[focalIdx - 1];
      const boundary = focalEra.startTick;
      const distToBoundary = tickRange[0] - boundary;
      if (distToBoundary < focalEra.duration * 0.25 || touchedEraIds.includes(prev.id)) {
        adjacentEras.push({ era: prev, boundary, direction: 'preceding' });
      }
    }

    // Check next era
    if (focalIdx < sortedEras.length - 1) {
      const next = sortedEras[focalIdx + 1];
      const boundary = focalEra.endTick;
      const distToBoundary = boundary - tickRange[1];
      if (distToBoundary < focalEra.duration * 0.25 || touchedEraIds.includes(next.id)) {
        adjacentEras.push({ era: next, boundary, direction: 'following' });
      }
    }

    if (adjacentEras.length > 0 || isMultiEra) {
      const touchedNames = touchedEraIds
        .map(id => allEras.find(e => e.id === id)?.name)
        .filter(Boolean);
      const lines = [`## Era Boundary Analysis`];
      if (isMultiEra) {
        lines.push(`This chronicle touches ${touchedEraIds.length} eras: ${touchedNames.join(', ')}. Focal era: ${focalEra.name}.`);
      }
      for (const { era, boundary, direction } of adjacentEras) {
        lines.push(`The chronicle's year range [${tickRange[0]}–${tickRange[1]}] is near the boundary at year ${boundary} (between ${direction === 'preceding' ? era.name + ' and ' + focalEra.name : focalEra.name + ' and ' + era.name}).`);
        if (era.summary) {
          lines.push(`**${era.name}:** ${era.summary}`);
        }
      }
      lines.push(`\nThis may be a **transition/boundary chronicle** depicting the shift between eras. Elements from adjacent eras may be narratively appropriate if they serve the transition.`);
      boundaryBlock = lines.join('\n') + '\n\n';
    }
  }

  // Get world dynamics if available
  const worldDynamicsResolved = (chronicleRecord as any).generationContext?.worldDynamicsResolved;
  const dynamicsBlock = worldDynamicsResolved && worldDynamicsResolved.length > 0
    ? `## World Dynamics (as provided to generation)\n${worldDynamicsResolved.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}\n`
    : '';

  const callConfig = getCallConfig(config, 'chronicle.compare');
  console.log(`[Worker] Temporal alignment check for chronicle=${chronicleId}, model=${callConfig.model}...`);

  const systemPrompt = `You are an editorial analyst checking whether a chronicle's narrative is temporally grounded in the correct era. You have access to the focal era, the temporal narrative (synthesized stakes), and the chronicle text. Your job is to identify passages where the chronicle's narrative contradicts, ignores, or is misaligned with the temporal context it was supposed to be grounded in. Some chronicles intentionally depict transitions between eras — these should be evaluated for how well they portray the shift, not penalized for containing elements of both eras.`;

  const userPrompt = `## Temporal Context

**Focal Era:** ${focalEra?.name || 'unknown'}${temporalScope ? ` (scope: ${temporalScope})` : ''}
${temporalDescription ? `**Temporal Description:** ${temporalDescription}` : ''}

**Era Timeline:**
${eraContextBlock}

${boundaryBlock}## Temporal Narrative (from Perspective Synthesis)
This is the synthesized narrative grounding — the story-specific stakes derived from world dynamics and era conditions. The chronicle should reflect these conditions:

> ${temporalNarrative}

${dynamicsBlock}
## Chronicle Text

${content}

---

## Task

Analyze the chronicle text against the temporal context above. Look for:

1. **Era Misalignment** — Does the chronicle reference conditions, events, or tensions from a DIFFERENT era than the focal era? Does it describe circumstances that belong to an earlier or later period?

2. **Temporal Narrative Contradictions** — Does the chronicle contradict the synthesized stakes? Are the pressures, conditions, or world dynamics described in the temporal narrative absent, inverted, or replaced with incompatible ones?

3. **Anachronistic Details** — Are there references to entities, places, factions, or customs that wouldn't exist or wouldn't apply during the focal era?

4. **Missing Temporal Grounding** — Does the chronicle feel temporally unanchored — like it could happen in any era? Does it fail to use the specific conditions the temporal narrative establishes?

5. **Era Boundary / Transition Assessment** — If this chronicle touches multiple eras or sits near an era boundary: Does it function as a transition narrative? Does it meaningfully depict the *shift* from one era's conditions to another? Are elements from adjacent eras serving the transition narrative, or do they appear as temporal errors? A chronicle depicting the collapse of one era's certainties into the next era's tensions is doing legitimate narrative work.

## Output Format

For each issue found, cite the specific passage and explain the misalignment. If no issues are found, say so explicitly.

Rate the overall temporal alignment: **Strong**, **Adequate**, **Weak**, or **Misaligned**.

If the chronicle is a boundary/transition chronicle, also rate: **Transition: Strong / Adequate / Weak** — how well does it portray the era shift?

Keep the total output under 800 words.`;

  const checkCall = await runTextCall({
    llmClient,
    callType: 'chronicle.compare',
    callConfig,
    systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: checkCall.result.debug };
  }

  if (checkCall.result.error || !checkCall.result.text) {
    return {
      success: false,
      error: `Temporal check failed: ${checkCall.result.error || 'No text returned'}`,
      debug: checkCall.result.debug,
    };
  }

  await updateChronicleTemporalCheckReport(chronicleId, checkCall.result.text);

  const checkCost = {
    estimated: checkCall.estimate.estimatedCost,
    actual: checkCall.usage.actualCost,
    inputTokens: checkCall.usage.inputTokens,
    outputTokens: checkCall.usage.outputTokens,
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
    estimatedCost: checkCost.estimated,
    actualCost: checkCost.actual,
    inputTokens: checkCost.inputTokens,
    outputTokens: checkCost.outputTokens,
  });

  return {
    success: true,
    result: {
      chronicleId,
      generatedAt: Date.now(),
      model: callConfig.model,
      estimatedCost: checkCost.estimated,
      actualCost: checkCost.actual,
      inputTokens: checkCost.inputTokens,
      outputTokens: checkCost.outputTokens,
    },
    debug: checkCall.result.debug,
  };
}

// ============================================================================
// Quick Check Step (user-triggered, detects unanchored entity references)
// ============================================================================

const QUICK_CHECK_SYSTEM_PROMPT = `You are a continuity checker for fictional narratives. Your job is to find proper-noun-like phrases in the text that do NOT correspond to any known entity in the provided cast list or name bank. These are "unanchored references" — names, titles, place names, or entity references that the author may have invented during generation without grounding them in the world's established entities.

You should NOT flag:
- Common nouns, adjectives, or generic descriptions ("the old captain", "the western shore")
- Titles used as common nouns ("the king", "the council", "the elders")
- Known entities referenced by their full name, alias, partial name, or ID slug
- Name bank names used for minor/invented characters (this is expected and correct)
- Obvious metonyms or descriptive epithets for known entities ("the great beast" for a known creature)
- Pronouns or demonstratives ("he", "she", "this one")

You SHOULD flag:
- Proper nouns that don't match any known name, alias, or ID slug
- Place names not in the cast
- Organization or faction names not in the cast
- Named characters who are not in the cast or name bank
- Abbreviated or partial names that don't clearly correspond to a known entity (e.g. "Aldric" when the known entity is "Aldric the Bold" — this is borderline but worth flagging as low confidence)

Return ONLY valid JSON. No markdown wrapping.`;

function buildQuickCheckUserPrompt(
  chronicleRecord: ChronicleRecord,
  content: string,
): string {
  const sections: string[] = [];

  // Cast list with ID slugs (ID slugs preserve original pre-rename names)
  const roleAssignments = chronicleRecord.roleAssignments || [];
  if (roleAssignments.length > 0) {
    const castLines = roleAssignments.map(ra => {
      const slugName = ra.entityId
        .replace(/-[a-f0-9]{4,}$/, '') // strip trailing hash
        .replace(/-/g, ' ');
      return `- Name: "${ra.entityName}" | ID slug: "${ra.entityId}" (original: "${slugName}") | Kind: ${ra.entityKind} | Role: ${ra.role}`;
    });
    sections.push(`== KNOWN ENTITIES (cast) ==\n${castLines.join('\n')}`);
  }

  // Tertiary cast — entities detected in text but not in the declared cast
  const acceptedTertiary = (chronicleRecord.tertiaryCast || []).filter(e => e.accepted);
  if (acceptedTertiary.length > 0) {
    const tertiaryLines = acceptedTertiary.map(e => `- ${e.name} (${e.kind})`);
    sections.push(`== TERTIARY CAST (detected mentions, not in declared cast — treat as known) ==\n${tertiaryLines.join('\n')}`);
  }

  // Name bank
  const nameBank = chronicleRecord.generationContext?.nameBank;
  if (nameBank && Object.keys(nameBank).length > 0) {
    const nbLines = Object.entries(nameBank).map(
      ([culture, names]) => `${culture}: ${(names as string[]).join(', ')}`
    );
    sections.push(`== NAME BANK (expected invented names) ==\n${nbLines.join('\n')}`);
  }

  // Entity directives (extra name references)
  const directives = chronicleRecord.generationContext?.entityDirectives;
  if (directives && directives.length > 0) {
    const dLines = directives.map(
      d => `- ${d.entityName} (${d.entityId}): ${d.directive}`
    );
    sections.push(`== ENTITY DIRECTIVES ==\n${dLines.join('\n')}`);
  }

  sections.push(`== CHRONICLE TEXT ==\n${content}`);

  sections.push(`== TASK ==
Scan the chronicle text for proper-noun-like phrases that do NOT match any known entity name, alias, ID slug, or name bank entry. For each suspicious reference, provide the exact phrase, a brief snippet of surrounding context, your reasoning, and a confidence level.

Return JSON:
{
  "suspects": [
    {
      "phrase": "the exact phrase as it appears",
      "context": "...brief surrounding sentence or clause...",
      "reasoning": "why this appears to be an unanchored reference",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "assessment": "clean" | "minor" | "flagged",
  "summary": "One sentence summary of findings"
}`);

  return sections.join('\n\n');
}

async function executeQuickCheckStep(
  task: WorkerTask,
  chronicleRecord: NonNullable<Awaited<ReturnType<typeof getChronicle>>>,
  context: TaskContext
): Promise<TaskResult> {
  const { config, llmClient, isAborted } = context;
  const chronicleId = chronicleRecord.chronicleId;

  // Get content — prefer finalContent, fall back to active version
  let content = chronicleRecord.finalContent;
  if (!content) {
    const resolved = resolveTargetVersionContent(chronicleRecord);
    content = resolved.content;
  }
  if (!content) {
    return { success: false, error: 'No chronicle content available for quick check' };
  }

  const callConfig = getCallConfig(config, 'chronicle.quickCheck');
  console.log(`[Worker] Quick check for chronicle=${chronicleId}, model=${callConfig.model}...`);

  const userPrompt = buildQuickCheckUserPrompt(chronicleRecord, content);

  const callResult = await runTextCall({
    llmClient,
    callType: 'chronicle.quickCheck',
    callConfig,
    systemPrompt: QUICK_CHECK_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.2,
  });

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: callResult.result.debug };
  }

  if (callResult.result.error || !callResult.result.text) {
    return {
      success: false,
      error: `Quick check failed: ${callResult.result.error || 'No text returned'}`,
      debug: callResult.result.debug,
    };
  }

  // Parse JSON response
  let report: QuickCheckReport;
  try {
    const parsed = parseJsonObject<QuickCheckReport>(callResult.result.text, 'quickCheck');
    report = {
      suspects: Array.isArray(parsed.suspects) ? parsed.suspects.map(s => ({
        phrase: typeof s.phrase === 'string' ? s.phrase : String(s.phrase ?? ''),
        context: typeof s.context === 'string' ? s.context : String(s.context ?? ''),
        reasoning: typeof s.reasoning === 'string' ? s.reasoning : String(s.reasoning ?? ''),
        confidence: ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'medium',
      })) : [],
      assessment: ['clean', 'minor', 'flagged'].includes(parsed.assessment) ? parsed.assessment : 'minor',
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'Quick check completed.',
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse quick check response: ${err instanceof Error ? err.message : String(err)}`,
      debug: callResult.result.debug,
    };
  }

  await updateChronicleQuickCheckReport(chronicleId, report);

  const cost = {
    estimated: callResult.estimate.estimatedCost,
    actual: callResult.usage.actualCost,
    inputTokens: callResult.usage.inputTokens,
    outputTokens: callResult.usage.outputTokens,
  };

  await saveCostRecordWithDefaults({
    projectId: task.projectId,
    simulationRunId: task.simulationRunId,
    entityId: task.entityId,
    entityName: task.entityName,
    entityKind: task.entityKind,
    chronicleId,
    type: 'chronicleQuickCheck' as CostType,
    model: callConfig.model,
    estimatedCost: cost.estimated,
    actualCost: cost.actual,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
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
    debug: callResult.result.debug,
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

// =============================================================================
// Title Generation — Two-Phase Pipeline
// Phase 1: Extract evocative fragments from the chronicle text (divergent)
// Phase 2: Shape those fragments into title candidates (convergent)
// =============================================================================

/** Fallback: look up titleGuidance from the style library when the cached record lacks it */
async function lookupTitleGuidance(styleId: string | undefined): Promise<string | undefined> {
  if (!styleId) return undefined;
  const library = await getStyleLibrary();
  const style = library.narrativeStyles.find(s => s.id === styleId);
  return (style as any)?.titleGuidance;
}

function buildTitleStyleContext(ctx: TitlePromptContext): string {
  if (!ctx.narrativeStyleName) return '';

  const parts: string[] = [];
  parts.push(`Style: "${ctx.narrativeStyleName}"`);
  if (ctx.narrativeStyleDescription) parts.push(ctx.narrativeStyleDescription);
  parts.push(`\n${ctx.titleGuidance}`);

  return parts.join('\n');
}

interface TitlePromptContext {
  format: 'story' | 'document';
  narrativeStyleName?: string;
  narrativeStyleDescription?: string;
  narrativeInstructions?: string;
  proseInstructions?: string;
  documentInstructions?: string;
  titleGuidance?: string;
  perspectiveBrief?: string;
  motifs?: string[];
}

// --- Phase 1: Fragment Extraction ---

function buildFragmentExtractionSystemPrompt(ctx: TitlePromptContext): string {
  const formatLabel = ctx.format === 'document' ? 'document' : 'story';
  const styleContext = buildTitleStyleContext(ctx);

  return [
    `You are reading an in-universe ${formatLabel} and mining it for title material.`,
    '',
    'THE FORM:',
    styleContext,
    '',
    'The title guidance above tells you what the title needs to be made of. Extract the raw material that guidance calls for. If it says to name correspondents, extract the names. If it says to name a product, extract product and vendor names. If it says to name an image, extract images. Let the guidance shape what you notice.',
    '',
    'Also extract:',
    '- Names of people, places, objects, or institutions that carry weight in the text',
    '- Phrases with sonic quality or compression',
    '- The subject or matter at the center of the text',
    '',
    'Extract 8-12 fragments. Each should be 1-6 words. Draw from the actual text — quote, compress, or distill.',
    '',
    'Output ONLY valid JSON: {"fragments": ["...", "...", ...]}',
  ].join('\n');
}

function buildFragmentExtractionUserPrompt(content: string, ctx: TitlePromptContext): string {
  const label = ctx.format === 'document' ? 'document' : 'story';
  const parts: string[] = [];

  parts.push(`Extract 8-12 evocative fragments from this ${label} that could seed a title.`);
  parts.push('Return ONLY valid JSON: {"fragments": ["...", "...", ...]}');

  if (ctx.perspectiveBrief) {
    parts.push(`Thematic context:\n${ctx.perspectiveBrief}`);
  }
  if (ctx.motifs && ctx.motifs.length > 0) {
    parts.push(`Recurring motifs:\n${ctx.motifs.map(m => `- "${m}"`).join('\n')}`);
  }

  parts.push(content);

  return parts.join('\n\n');
}

// --- Phase 2: Title Shaping ---

function buildTitleShapingSystemPrompt(ctx: TitlePromptContext): string {
  const formatLabel = ctx.format === 'document' ? 'document' : 'story';
  const styleContext = buildTitleStyleContext(ctx);

  return [
    `You are the author of an in-universe ${formatLabel}, choosing the title this work will be known by.`,
    '',
    'THE FORM:',
    styleContext,
    '',
    'The title guidance above is your primary creative constraint. It defines the register, the shape, and what the title should feel like. Follow it closely. Titles should be short — most great titles are 2-6 words.',
    '',
    'You have fragments extracted from the text and the full text itself. The fragments are starting points — thematic material, not finished titles. Do not reproduce or truncate any fragment as a title. Combine ideas across fragments, compress, or find something in the text the fragments point toward but don\'t say directly.',
    '',
    'Craft exactly 5 titles. Each should feel distinct from the others. Order best to worst.',
    '',
    'Output ONLY valid JSON: {"titles": ["...", "...", "...", "...", "..."]}',
    'Use Title Case capitalization.',
  ].join('\n');
}

function buildTitleShapingUserPrompt(fragments: string[], content: string, ctx: TitlePromptContext): string {
  const parts: string[] = [];

  parts.push('Return ONLY valid JSON: {"titles": ["...", "...", "...", "...", "..."]}');

  if (fragments.length > 0) {
    parts.push('Fragments (thematic material, not titles — do not reproduce these):\n' + fragments.map(f => `- ${f}`).join('\n'));
  }

  if (ctx.perspectiveBrief) {
    parts.push(`Thematic context:\n${ctx.perspectiveBrief}`);
  }

  // Deduplicate: only include motifs that aren't already in the fragments list
  if (ctx.motifs && ctx.motifs.length > 0) {
    const fragmentLower = new Set(fragments.map(f => f.toLowerCase()));
    const uniqueMotifs = ctx.motifs.filter(m => !fragmentLower.has(m.toLowerCase()));
    if (uniqueMotifs.length > 0) {
      parts.push(`Recurring motifs:\n${uniqueMotifs.map(m => `- "${m}"`).join('\n')}`);
    }
  }

  parts.push(content);

  return parts.join('\n\n');
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

  const ps = chronicleRecord.perspectiveSynthesis;
  const titleCtx: TitlePromptContext = {
    format,
    narrativeStyleName: narrativeStyle?.name,
    narrativeStyleDescription: narrativeStyle?.description,
    narrativeInstructions: narrativeStyle?.format === 'story' ? (narrativeStyle as any).narrativeInstructions : undefined,
    proseInstructions: narrativeStyle?.format === 'story' ? (narrativeStyle as any).proseInstructions : undefined,
    documentInstructions: narrativeStyle?.format === 'document' ? (narrativeStyle as any).documentInstructions : undefined,
    titleGuidance: (narrativeStyle as any)?.titleGuidance
      || await lookupTitleGuidance(chronicleRecord.narrativeStyleId || narrativeStyle?.id),
    perspectiveBrief: ps?.brief,
    motifs: ps?.suggestedMotifs,
  };

  const debugParts: string[] = [];

  // --- Phase 1: Fragment Extraction (divergent, high temperature) ---
  const fragmentSystemPrompt = buildFragmentExtractionSystemPrompt(titleCtx);
  const fragmentUserPrompt = buildFragmentExtractionUserPrompt(content, titleCtx);
  const fragmentCall = await runTextCall({
    llmClient,
    callType: 'chronicle.title',
    callConfig,
    systemPrompt: fragmentSystemPrompt,
    prompt: fragmentUserPrompt,
    temperature: 0.85,
  });

  if (fragmentCall.result.debug) debugParts.push(fragmentCall.result.debug);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: debugParts.join('\n---\n') || undefined };
  }

  // Parse fragments — graceful fallback to empty if extraction fails
  let fragments: string[] = [];
  if (!fragmentCall.result.error && fragmentCall.result.text) {
    try {
      const parsed = parseJsonObject<Record<string, unknown>>(fragmentCall.result.text, 'fragment extraction response');
      if (Array.isArray(parsed.fragments)) {
        fragments = parsed.fragments
          .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
          .map(f => f.trim());
      }
    } catch {
      // Fragment parse failed — Phase 2 will work with motifs/brief alone
    }
  }

  // --- Phase 2: Title Shaping (convergent, lower temperature) ---
  const shapingSystemPrompt = buildTitleShapingSystemPrompt(titleCtx);
  const shapingUserPrompt = buildTitleShapingUserPrompt(fragments, content, titleCtx);


  const shapingCall = await runTextCall({
    llmClient,
    callType: 'chronicle.title',
    callConfig,
    systemPrompt: shapingSystemPrompt,
    prompt: shapingUserPrompt,
    temperature: 0.7,
  });

  if (shapingCall.result.debug) debugParts.push(shapingCall.result.debug);

  if (isAborted()) {
    return { success: false, error: 'Task aborted', debug: debugParts.join('\n---\n') || undefined };
  }

  let candidates: string[] = [];
  if (!shapingCall.result.error && shapingCall.result.text) {
    try {
      const parsed = parseJsonObject<Record<string, unknown>>(shapingCall.result.text, 'title shaping response');
      if (Array.isArray(parsed.titles)) {
        candidates = parsed.titles
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map(t => t.trim());
      }
    } catch {
      // Title parse failed
    }
  }

  if (candidates.length > 0) {
    const seen = new Set<string>();
    candidates = candidates
      .map((title) => toTitleCase(title))
      .filter((title) => {
        const key = title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  if (candidates.length === 0) {
    return { success: false, error: 'Title generation produced no candidates', debug: debugParts.join('\n---\n') || undefined };
  }

  const title = candidates[0];

  // Aggregate costs from both phases
  const totalCost = {
    estimated: fragmentCall.estimate.estimatedCost + shapingCall.estimate.estimatedCost,
    actual: fragmentCall.usage.actualCost + shapingCall.usage.actualCost,
    inputTokens: fragmentCall.usage.inputTokens + shapingCall.usage.inputTokens,
    outputTokens: fragmentCall.usage.outputTokens + shapingCall.usage.outputTokens,
  };

  const debug = debugParts.length > 0 ? debugParts.join('\n---\n') : undefined;

  await updateChronicleTitle(chronicleId, title, candidates, fragments, totalCost, callConfig.model);

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
      fragments,
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
