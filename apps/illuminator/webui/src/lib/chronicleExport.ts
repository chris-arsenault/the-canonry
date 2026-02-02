/**
 * Chronicle Export Utility
 *
 * Exports a completed chronicle using ONLY stored data from the chronicle record.
 * No reconstruction or parameter passing - everything comes from what was stored
 * during generation.
 */

import type { ChronicleRecord } from './db/chronicleRepository';
import type {
  PerspectiveSynthesisRecord,
  ChronicleImageRefs,
} from './chronicleTypes';
import type { HistorianNote } from './historianTypes';
import { isNoteActive } from './historianTypes';

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
  temperature?: number;
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
  exportVersion: '1.2';
  exportedAt: string;
  activeVersionId?: string;

  // Chronicle identity
  chronicle: {
    id: string;
    title: string;
    format: string;
    focusType: string;
    narrativeStyleId: string;
    narrativeStyleName?: string;
    /** Narrative lens entity providing contextual framing (rule, occurrence, ability) */
    lens?: { entityId: string; entityName: string; entityKind: string };
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
      facts?: Array<{ id: string; text: string; type?: string }>;
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

  // Historian annotations
  historianNotes?: HistorianNote[];
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
      culturalIdentities: record.inputCulturalIdentities,
      entities: record.inputEntities,
    },
    output: {
      brief: record.brief,
      facets: record.facets,
      suggestedMotifs: record.suggestedMotifs,
      narrativeVoice: record.narrativeVoice,
      entityDirectives: record.entityDirectives,
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
  const currentVersionId = `current_${chronicle.assembledAt ?? chronicle.createdAt}`;
  const activeVersionId = chronicle.activeVersionId || currentVersionId;

  const currentVersion = {
    id: currentVersionId,
    content: chronicle.finalContent || chronicle.assembledContent || '',
    wordCount: (chronicle.finalContent || chronicle.assembledContent || '').split(/\s+/).filter(Boolean).length,
    systemPrompt:
      chronicle.generationSystemPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
    userPrompt:
      chronicle.generationUserPrompt ||
      '(prompt not stored - chronicle generated before prompt storage was implemented)',
    model: chronicle.model,
  };

  const historyMatch = chronicle.generationHistory?.find((version) => version.versionId === activeVersionId);
  const activeVersion = historyMatch
    ? {
        id: historyMatch.versionId,
        content: historyMatch.content,
        wordCount: historyMatch.wordCount,
        systemPrompt: historyMatch.systemPrompt,
        userPrompt: historyMatch.userPrompt,
        model: historyMatch.model,
      }
    : currentVersion;

  const content = activeVersion.content;
  const wordCount = activeVersion.wordCount;
  const systemPrompt = activeVersion.systemPrompt;
  const userPrompt = activeVersion.userPrompt;
  const currentContent = chronicle.assembledContent || chronicle.finalContent || '';
  const currentWordCount = currentContent.split(/\s+/).filter(Boolean).length;

  const exportData: ChronicleExport = {
    exportVersion: '1.2',
    exportedAt: new Date().toISOString(),
    activeVersionId,

    chronicle: {
      id: chronicle.chronicleId,
      title: chronicle.title,
      format: chronicle.format,
      focusType: chronicle.focusType,
      narrativeStyleId: chronicle.narrativeStyleId,
      narrativeStyleName: chronicle.narrativeStyle?.name,
      lens: chronicle.lens ? { entityId: chronicle.lens.entityId, entityName: chronicle.lens.entityName, entityKind: chronicle.lens.entityKind } : undefined,
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
      model: activeVersion.model,
    },
  };

  const versions: ExportChronicleVersion[] = [];
  if (chronicle.generationHistory && chronicle.generationHistory.length > 0) {
    for (const version of chronicle.generationHistory) {
      versions.push({
        versionId: version.versionId,
        generatedAt: new Date(version.generatedAt).toISOString(),
        temperature: version.temperature,
        model: version.model,
        wordCount: version.wordCount,
        content: version.content,
        systemPrompt: version.systemPrompt,
        userPrompt: version.userPrompt,
        cost: version.cost,
      });
    }
  }

  versions.push({
    versionId: `current_${chronicle.assembledAt ?? chronicle.createdAt}`,
    generatedAt: new Date(chronicle.assembledAt ?? chronicle.createdAt).toISOString(),
    temperature: chronicle.generationTemperature,
    model: chronicle.model,
    wordCount: currentWordCount,
    content: currentContent,
    systemPrompt: currentVersion.systemPrompt,
    userPrompt: currentVersion.userPrompt,
  });

  exportData.versions = versions;

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

  if (chronicle.historianNotes && chronicle.historianNotes.length > 0) {
    const enabledNotes = chronicle.historianNotes.filter(isNoteActive);
    if (enabledNotes.length > 0) {
      exportData.historianNotes = enabledNotes;
    }
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
