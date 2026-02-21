/**
 * Chronicle Export Utility
 *
 * Exports a completed chronicle using ONLY stored data from the chronicle record.
 * No reconstruction or parameter passing - everything comes from what was stored
 * during generation.
 */

import type { ChronicleRecord } from './db/chronicleRepository';
import { getChroniclesForSimulation, computeCorpusFactStrength } from './db/chronicleRepository';
import type { EraNarrativeRecord } from './eraNarrativeTypes';
import type {
  PerspectiveSynthesisRecord,
  ChronicleImageRefs,
  FactCoverageReport,
} from './chronicleTypes';
import type { HistorianNote } from './historianTypes';
import { isNoteActive, computeNoteRange } from './historianTypes';
import { buildFactCoverageGuidance } from './historianContextBuilders';

// =============================================================================
// Export Types
// =============================================================================

/**
 * Image ref metadata without actual image data
 */
interface ExportImageRef {
  refId: string;
  type: 'entity_ref' | 'prompt_request';
  anchorText: string;
  anchorIndex?: number;
  size: string;
  justification?: string;
  caption?: string;
  // entity_ref specific
  entityId?: string;
  // prompt_request specific
  sceneDescription?: string;
  involvedEntityIds?: string[];
  status?: string;
  generatedImageId?: string;
}

/**
 * Generation context for export - the ACTUAL values used for generation
 * (post-perspective synthesis, not the original input)
 */
interface ExportGenerationContext {
  worldName: string;
  worldDescription: string;
  /** The actual tone sent to LLM (assembled + brief + motifs) */
  tone: string;
  /** The actual facts sent to LLM (faceted facts with interpretations) */
  canonFacts: string[];
  /** Name bank for invented characters */
  nameBank?: Record<string, string[]>;
  /** Synthesized narrative voice from perspective synthesis */
  narrativeVoice?: Record<string, string>;
  /** Per-entity writing directives from perspective synthesis */
  entityDirectives?: Array<{ entityId: string; entityName: string; directive: string }>;
  /** PS-synthesized temporal narrative — dynamics distilled into story-specific stakes */
  temporalNarrative?: string;
  /** Optional narrative direction from wizard */
  narrativeDirection?: string;
}

/**
 * LLM call info for export
 */
interface ExportLLMCall {
  systemPrompt: string;
  userPrompt: string;
  model: string;
}

interface ExportChronicleVersion {
  versionId: string;
  generatedAt: string;
  sampling?: 'normal' | 'low';
  step?: string;
  model: string;
  wordCount: number;
  content: string;
  systemPrompt: string;
  userPrompt: string;
  cost?: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
}

/**
 * Full chronicle export structure
 */
export interface ChronicleExport {
  exportVersion: '1.3';
  exportedAt: string;
  activeVersionId?: string;
  acceptedVersionId?: string;

  // Chronicle identity
  chronicle: {
    id: string;
    title: string;
    format: string;
    focusType: string;
    narrativeStyleId: string;
    narrativeStyleName?: string;
    /** Craft posture constraints for this narrative style */
    craftPosture?: string;
    /** Narrative lens entity providing contextual framing (rule, occurrence, ability) */
    lens?: { entityId: string; entityName: string; entityKind: string };
    /** Optional narrative direction from wizard */
    narrativeDirection?: string;
    createdAt: string;
    acceptedAt?: string;
    model: string;
  };

  // Final content
  content: string;
  wordCount: number;

  // Image refs (metadata only)
  imageRefs?: {
    generatedAt: string;
    model: string;
    refs: ExportImageRef[];
  };

  // Summary (if generated)
  summary?: string;

  // Generation context (the ACTUAL values used, post-perspective)
  generationContext?: ExportGenerationContext;

  // Perspective synthesis (shows the transformation from input to output)
  perspectiveSynthesis?: {
    // Input
    input: {
      coreTone?: string;
      narrativeStyleId?: string;
      narrativeStyleName?: string;
      constellation?: {
        cultures: Record<string, number>;
        kinds: Record<string, number>;
        prominentTags: string[];
        cultureBalance: string;
        dominantCulture?: string;
      };
      facts?: Array<{ id: string; text: string; type?: string; required?: boolean; disabled?: boolean }>;
      worldDynamics?: Array<{ id: string; text: string }>;
      factSelectionRange?: { min?: number; max?: number };
      focalEra?: { id: string; name: string; description?: string };
      culturalIdentities?: Record<string, Record<string, string>>;
      entities?: Array<{ name: string; kind: string; culture?: string }>;
    };
    // Output
    output: {
      brief: string;
      facets: Array<{ factId: string; interpretation: string }>;
      suggestedMotifs: string[];
      narrativeVoice: Record<string, string>;
      entityDirectives: Array<{ entityId: string; entityName: string; directive: string }>;
      temporalNarrative?: string;
    };
    // Metadata
    model: string;
    generatedAt: string;
    tokens: { input: number; output: number };
    cost: number;
  };

  // Final LLM call (the actual prompts sent)
  generationLLMCall: ExportLLMCall;

  // All generation versions (history + current)
  versions?: ExportChronicleVersion[];

  // Cover image (if generated)
  coverImage?: {
    sceneDescription: string;
    involvedEntityIds: string[];
    status: string;
    generatedImageId?: string;
  };

  // Comparison analysis (if compare was run)
  comparisonReport?: string;
  combineInstructions?: string;

  // Temporal alignment check (if temporal check was run)
  temporalCheckReport?: string;

  // Historian-assigned chronological year within the focal era
  eraYear?: number;
  eraYearReasoning?: string;

  // Historian reading notes (prep brief)
  historianPrep?: string;

  // Historian annotations
  historianNotes?: HistorianNote[];
  historianReviewLLMCall?: ExportLLMCall;

  // Fact coverage analysis
  factCoverageReport?: FactCoverageReport;
}

// =============================================================================
// Export Functions
// =============================================================================

/**
 * Convert image refs to export format (metadata only)
 */
function exportImageRefs(imageRefs: ChronicleImageRefs): ChronicleExport['imageRefs'] {
  return {
    generatedAt: new Date(imageRefs.generatedAt).toISOString(),
    model: imageRefs.model,
    refs: imageRefs.refs.map((ref): ExportImageRef => {
      const base: ExportImageRef = {
        refId: ref.refId,
        type: ref.type,
        anchorText: ref.anchorText,
        anchorIndex: ref.anchorIndex,
        size: ref.size,
        justification: ref.justification,
        caption: ref.caption,
      };

      if (ref.type === 'entity_ref') {
        base.entityId = ref.entityId;
      } else {
        base.sceneDescription = ref.sceneDescription;
        base.involvedEntityIds = ref.involvedEntityIds;
        base.status = ref.status;
        base.generatedImageId = ref.generatedImageId;
      }

      return base;
    }),
  };
}

/**
 * Convert perspective synthesis record to export format
 */
function exportPerspectiveSynthesis(
  record: PerspectiveSynthesisRecord
): ChronicleExport['perspectiveSynthesis'] {
  return {
    input: {
      coreTone: record.coreTone,
      narrativeStyleId: record.narrativeStyleId,
      narrativeStyleName: record.narrativeStyleName,
      constellation: record.constellation,
      facts: record.inputFacts,
      worldDynamics: record.inputWorldDynamics,
      factSelectionRange: record.factSelectionRange,
      focalEra: record.focalEra,
      culturalIdentities: record.inputCulturalIdentities,
      entities: record.inputEntities,
    },
    output: {
      brief: record.brief,
      facets: record.facets,
      suggestedMotifs: record.suggestedMotifs,
      narrativeVoice: record.narrativeVoice,
      entityDirectives: record.entityDirectives,
      temporalNarrative: record.temporalNarrative,
    },
    model: record.model,
    generatedAt: new Date(record.generatedAt).toISOString(),
    tokens: { input: record.inputTokens, output: record.outputTokens },
    cost: record.actualCost,
  };
}

/**
 * Build the full chronicle export from STORED data only.
 *
 * This function uses only what is stored in the ChronicleRecord.
 * No reconstruction, no parameter passing of generation context.
 */
export function buildChronicleExport(chronicle: ChronicleRecord): ChronicleExport {
  const versions = [...(chronicle.generationHistory || [])].sort(
    (a, b) => a.generatedAt - b.generatedAt
  );
  const latestVersion = versions.reduce(
    (acc, v) => (acc && acc.generatedAt > v.generatedAt ? acc : v),
    versions[0]
  );
  const activeVersionId = chronicle.activeVersionId || latestVersion?.versionId;
  const isAccepted = Boolean(chronicle.acceptedAt && chronicle.finalContent);
  const acceptedVersionId = chronicle.acceptedVersionId || (isAccepted ? activeVersionId : undefined);
  const effectiveVersionId = isAccepted ? (acceptedVersionId || activeVersionId) : activeVersionId;

  const currentContent = chronicle.assembledContent || chronicle.finalContent || '';
  const historyMatch = versions.find((version) => version.versionId === effectiveVersionId);
  const effectiveVersion = historyMatch
    ? {
        id: historyMatch.versionId,
        content: historyMatch.content,
        wordCount: historyMatch.wordCount,
        systemPrompt: historyMatch.systemPrompt,
        userPrompt: historyMatch.userPrompt,
        model: historyMatch.model,
      }
    : {
        id: effectiveVersionId || 'unknown',
        content: currentContent,
        wordCount: currentContent.split(/\s+/).filter(Boolean).length,
        systemPrompt:
          chronicle.generationSystemPrompt ||
          '(prompt not stored - chronicle generated before prompt storage was implemented)',
        userPrompt:
          chronicle.generationUserPrompt ||
          '(prompt not stored - chronicle generated before prompt storage was implemented)',
        model: chronicle.model,
      };

  const content = isAccepted && chronicle.finalContent
    ? chronicle.finalContent
    : effectiveVersion.content;
  const wordCount = isAccepted && chronicle.finalContent
    ? chronicle.finalContent.split(/\s+/).filter(Boolean).length
    : effectiveVersion.wordCount;
  const systemPrompt = effectiveVersion.systemPrompt;
  const userPrompt = effectiveVersion.userPrompt;
  const exportData: ChronicleExport = {
    exportVersion: '1.3',
    exportedAt: new Date().toISOString(),
    activeVersionId,
    acceptedVersionId,

    chronicle: {
      id: chronicle.chronicleId,
      title: chronicle.title,
      format: chronicle.format,
      focusType: chronicle.focusType,
      narrativeStyleId: chronicle.narrativeStyleId,
      narrativeStyleName: chronicle.narrativeStyle?.name,
      craftPosture: chronicle.narrativeStyle?.craftPosture,
      lens: chronicle.lens ? { entityId: chronicle.lens.entityId, entityName: chronicle.lens.entityName, entityKind: chronicle.lens.entityKind } : undefined,
      narrativeDirection: chronicle.narrativeDirection,
      createdAt: new Date(chronicle.createdAt).toISOString(),
      acceptedAt: chronicle.acceptedAt
        ? new Date(chronicle.acceptedAt).toISOString()
        : undefined,
      model: chronicle.model,
    },

    content,
    wordCount,

    generationLLMCall: {
      systemPrompt,
      userPrompt,
      model: effectiveVersion.model,
    },
  };

  exportData.versions = versions.map((version) => ({
    versionId: version.versionId,
    generatedAt: new Date(version.generatedAt).toISOString(),
    sampling: version.sampling,
    step: version.step,
    model: version.model,
    wordCount: version.wordCount,
    content: version.content,
    systemPrompt: version.systemPrompt,
    userPrompt: version.userPrompt,
    cost: version.cost,
  }));

  // Add generation context if stored (new chronicles have this)
  if (chronicle.generationContext) {
    exportData.generationContext = chronicle.generationContext;
  }

  // Add image refs if present
  if (chronicle.imageRefs) {
    exportData.imageRefs = exportImageRefs(chronicle.imageRefs);
  }

  // Add summary if present
  if (chronicle.summary) {
    exportData.summary = chronicle.summary;
  }

  // Add perspective synthesis if present
  if (chronicle.perspectiveSynthesis) {
    exportData.perspectiveSynthesis = exportPerspectiveSynthesis(
      chronicle.perspectiveSynthesis
    );
  }

  // Add cover image if present
  if (chronicle.coverImage) {
    exportData.coverImage = {
      sceneDescription: chronicle.coverImage.sceneDescription,
      involvedEntityIds: chronicle.coverImage.involvedEntityIds,
      status: chronicle.coverImage.status,
      generatedImageId: chronicle.coverImage.generatedImageId,
    };
  }

  // Add comparison analysis if present
  if (chronicle.comparisonReport) {
    exportData.comparisonReport = chronicle.comparisonReport;
  }
  if (chronicle.combineInstructions) {
    exportData.combineInstructions = chronicle.combineInstructions;
  }
  if (chronicle.temporalCheckReport) {
    exportData.temporalCheckReport = chronicle.temporalCheckReport;
  }

  if (chronicle.eraYear != null) {
    exportData.eraYear = chronicle.eraYear;
    if (chronicle.eraYearReasoning) {
      exportData.eraYearReasoning = chronicle.eraYearReasoning;
    }
  }

  if (chronicle.historianPrep) {
    exportData.historianPrep = chronicle.historianPrep;
  }

  if (chronicle.historianNotes && chronicle.historianNotes.length > 0) {
    const enabledNotes = chronicle.historianNotes.filter(isNoteActive);
    if (enabledNotes.length > 0) {
      exportData.historianNotes = enabledNotes;
    }
  }

  if (chronicle.historianReviewSystemPrompt && chronicle.historianReviewUserPrompt) {
    exportData.historianReviewLLMCall = {
      systemPrompt: chronicle.historianReviewSystemPrompt,
      userPrompt: chronicle.historianReviewUserPrompt,
      model: 'stored',
    };
  }

  if (chronicle.factCoverageReport) {
    exportData.factCoverageReport = chronicle.factCoverageReport;
  }

  return exportData;
}

/**
 * Export chronicle to JSON file download.
 *
 * Uses ONLY data stored in the chronicle record - no external parameters.
 */
export function downloadChronicleExport(chronicle: ChronicleRecord): void {
  const exportData = buildChronicleExport(chronicle);

  // Create filename from chronicle title
  const safeTitle = chronicle.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const filename = `chronicle-export-${safeTitle}-${Date.now()}.json`;

  // Create blob and download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// Bulk Annotation Review Export
// =============================================================================

export async function downloadBulkAnnotationReviewExport(simulationRunId: string): Promise<void> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);

  const annotated = chronicles
    .filter((c) => c.historianNotes && c.historianNotes.filter(isNoteActive).length > 0)
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  const rows = annotated.map((c) => {
    const notes = (c.historianNotes || []).filter(isNoteActive);
    return {
      title: c.title || 'Untitled',
      format: c.format || 'story',
      narrativeStyleName: c.narrativeStyle?.name || c.narrativeStyleId || null,
      assignedTone: c.assignedTone || null,
      noteCount: notes.length,
      annotations: notes.map((n) => ({
        type: n.type,
        display: n.display,
        anchorPhrase: n.anchorPhrase,
        text: n.text,
      })),
    };
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalChronicles: rows.length,
    totalAnnotations: rows.reduce((sum, r) => sum + r.noteCount, 0),
    chronicles: rows,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chronicle-annotation-review-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// Bulk Tone Review Export
// =============================================================================

export async function downloadBulkToneReviewExport(simulationRunId: string): Promise<void> {
  const chronicles = await getChroniclesForSimulation(simulationRunId);
  const corpusStrength = await computeCorpusFactStrength(simulationRunId);

  const complete = chronicles.filter(
    (c) => c.status === 'complete' || c.status === 'assembly_ready',
  );

  const rows = complete.map((c) => {
    const wordCount = c.finalContent?.split(/\s+/).length || c.wordCount || 0;
    const noteRange = computeNoteRange('chronicle', wordCount);

    // Compute fact coverage guidance using the same logic as the annotation prompt
    const guidance = c.factCoverageReport
      ? buildFactCoverageGuidance(c.factCoverageReport, corpusStrength)
      : null;

    const maxRequired = noteRange.max <= 4 ? 1 : (guidance?.length ?? 0);
    const required = guidance?.slice(0, maxRequired) ?? [];
    const optional = guidance?.slice(maxRequired) ?? [];

    return {
      title: c.title || 'Untitled',
      summary: c.summary || null,
      brief: c.perspectiveSynthesis?.brief || null,
      wordCount,
      noteRange,
      assignedTone: c.assignedTone || null,
      toneRanking: c.toneRanking
        ? {
            ranking: c.toneRanking.ranking,
            rationales: c.toneRanking.rationales || { _legacy: c.toneRanking.rationale },
          }
        : null,
      factCoverage: c.factCoverageReport?.entries?.map((e) => ({
        factId: e.factId,
        rating: e.rating,
        wasFaceted: e.wasFaceted,
      })) || null,
      annotationGuidance: {
        required: required.map((t) => ({
          factId: t.factId,
          action: t.action,
          evidence: t.evidence,
          corpusStrength: t.corpusStrength,
        })),
        optional: optional.map((t) => ({
          factId: t.factId,
          action: t.action,
          evidence: t.evidence,
          corpusStrength: t.corpusStrength,
        })),
      },
    };
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalChronicles: rows.length,
    chronicles: rows,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chronicle-tone-review-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// Era Narrative Export
// =============================================================================

export interface EraNarrativeExport {
  exportVersion: '1.0';
  exportedAt: string;

  narrative: {
    narrativeId: string;
    eraId: string;
    eraName: string;
    tone: string;
    status: string;
    createdAt: string;
  };

  threadSynthesis?: {
    thesis: string;
    counterweight?: string;
    motifs?: string[];
    openingImage?: string;
    closingImage?: string;
    threads: Array<{
      threadId: string;
      name: string;
      description: string;
      arc: string;
      register?: string;
      material?: string;
      culturalActors: string[];
      chronicleIds: string[];
    }>;
    quotes?: Array<{
      text: string;
      origin: string;
      context: string;
    }>;
    strategicDynamics?: Array<{
      interaction: string;
      actors: string[];
      dynamic: string;
    }>;
    movements?: Array<{
      movementIndex: number;
      yearRange: [number, number];
      worldState?: string;
      threadFocus: string[];
      beats: string;
    }>;
    llmCall: ExportLLMCall;
    tokens: { input: number; output: number };
    cost: number;
  };

  draft?: {
    content: string;
    wordCount: number;
    generatedAt: string;
    llmCall: ExportLLMCall;
    tokens: { input: number; output: number };
    cost: number;
  };

  edited?: {
    content: string;
    wordCount: number;
    editedAt: string;
    llmCall: ExportLLMCall;
    tokens: { input: number; output: number };
    cost: number;
  };

  sourceBriefs: Array<{
    chronicleId: string;
    chronicleTitle: string;
    eraYear?: number;
    weight?: string;
    prep: string;
  }>;

  cost: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalActualCost: number;
  };
}

export function buildEraNarrativeExport(record: EraNarrativeRecord): EraNarrativeExport {
  const exportData: EraNarrativeExport = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),

    narrative: {
      narrativeId: record.narrativeId,
      eraId: record.eraId,
      eraName: record.eraName,
      tone: record.tone,
      status: record.status,
      createdAt: new Date(record.createdAt).toISOString(),
    },

    sourceBriefs: record.prepBriefs.map((b) => ({
      chronicleId: b.chronicleId,
      chronicleTitle: b.chronicleTitle,
      eraYear: b.eraYear,
      ...(b.weight ? { weight: b.weight } : {}),
      prep: b.prep,
    })),

    cost: {
      totalInputTokens: record.totalInputTokens,
      totalOutputTokens: record.totalOutputTokens,
      totalActualCost: record.totalActualCost,
    },
  };

  if (record.threadSynthesis) {
    const ts = record.threadSynthesis;
    exportData.threadSynthesis = {
      thesis: ts.thesis || '',
      ...(ts.counterweight ? { counterweight: ts.counterweight } : {}),
      ...(ts.motifs?.length ? { motifs: ts.motifs } : {}),
      ...(ts.openingImage ? { openingImage: ts.openingImage } : {}),
      ...(ts.closingImage ? { closingImage: ts.closingImage } : {}),
      threads: (ts.threads || []).map((t) => ({
        threadId: t.threadId,
        name: t.name,
        description: t.description,
        arc: t.arc,
        ...(t.register ? { register: t.register } : {}),
        ...(t.material ? { material: t.material } : {}),
        culturalActors: t.culturalActors || [],
        chronicleIds: t.chronicleIds || [],
      })),
      ...(ts.quotes?.length ? { quotes: ts.quotes.map(q => ({ text: q.text, origin: q.origin, context: q.context })) } : {}),
      ...(ts.strategicDynamics?.length ? { strategicDynamics: ts.strategicDynamics.map(sd => ({ interaction: sd.interaction, actors: sd.actors, dynamic: sd.dynamic })) } : {}),
      ...(ts.movements?.length ? {
        movements: ts.movements.map((m) => ({
          movementIndex: m.movementIndex,
          yearRange: m.yearRange,
          worldState: m.worldState,
          threadFocus: m.threadFocus || [],
          beats: m.beats,
        })),
      } : {}),
      llmCall: {
        systemPrompt: ts.systemPrompt || '',
        userPrompt: ts.userPrompt || '',
        model: ts.model || '',
      },
      tokens: { input: ts.inputTokens || 0, output: ts.outputTokens || 0 },
      cost: ts.actualCost || 0,
    };
  }

  if (record.narrative) {
    const n = record.narrative;
    exportData.draft = {
      content: n.content,
      wordCount: n.wordCount,
      generatedAt: new Date(n.generatedAt).toISOString(),
      llmCall: {
        systemPrompt: n.systemPrompt,
        userPrompt: n.userPrompt,
        model: n.model,
      },
      tokens: { input: n.inputTokens, output: n.outputTokens },
      cost: n.actualCost,
    };

    if (n.editedContent && n.editedAt) {
      exportData.edited = {
        content: n.editedContent,
        wordCount: n.editedWordCount || n.editedContent.split(/\s+/).filter(Boolean).length,
        editedAt: new Date(n.editedAt).toISOString(),
        llmCall: {
          systemPrompt: n.editSystemPrompt || '',
          userPrompt: n.editUserPrompt || '',
          model: n.model,
        },
        tokens: { input: n.editInputTokens || 0, output: n.editOutputTokens || 0 },
        cost: n.editActualCost || 0,
      };
    }
  }

  return exportData;
}

export function downloadEraNarrativeExport(record: EraNarrativeRecord): void {
  const exportData = buildEraNarrativeExport(record);

  const safeTitle = (record.eraName || 'era-narrative')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const filename = `era-narrative-export-${safeTitle}-${Date.now()}.json`;

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
