/**
 * Enrichment Types
 *
 * Defines the data model for entity enrichment state.
 * Enrichment data is stored on entities and persisted to IndexedDB.
 */

import type { ChronicleFormat, ChronicleGenerationContext, ChronicleImageRefs, EraTemporalInfo } from './chronicleTypes';
import type { HistorianNote } from './historianTypes';

export type EnrichmentType = 'description' | 'image' | 'entityChronicle' | 'paletteExpansion' | 'dynamicsGeneration' | 'summaryRevision' | 'chronicleLoreBackport' | 'copyEdit' | 'historianReview';

/**
 * Which image to display at a chronicle backref anchor in an entity description.
 * - 'cover': Use the chronicle's cover image
 * - 'image_ref': Use a specific image ref from the chronicle's imageRefs
 * - 'entity': Use an entity's portrait image
 */
export type BackrefImageSource =
  | { source: 'cover' }
  | { source: 'image_ref'; refId: string }
  | { source: 'entity'; entityId: string };

/**
 * Links an anchor phrase in an entity's description to the source chronicle
 * that introduced the lore. Stored separately from description text so that
 * description prose stays clean for LLM prompting.
 */
export interface ChronicleBackref {
  entityId: string;
  chronicleId: string;
  /** A phrase from the entity's description that the chronicle introduced */
  anchorPhrase: string;
  createdAt: number;
  /** Image to display at this backref anchor. undefined = legacy fallback (cover), null = no image */
  imageSource?: BackrefImageSource | null;
  /** Display size for the backref image */
  imageSize?: 'small' | 'medium' | 'large' | 'full-width';
  /** Float alignment for the backref image */
  imageAlignment?: 'left' | 'right';
}

export interface NetworkDebugInfo {
  request: string;
  response?: string;
  meta?: {
    provider?: 'anthropic' | 'openai';
    status?: number;
    statusText?: string;
    durationMs?: number;
    requestId?: string;
    rateLimit?: Record<string, string>;
  };
}

/**
 * Debug info for description chain (narrative → thesis → traits)
 */
export interface DescriptionChainDebug {
  narrative?: NetworkDebugInfo;
  thesis?: NetworkDebugInfo;
  traits?: NetworkDebugInfo;
}

export type EnrichmentStatus = 'missing' | 'queued' | 'running' | 'complete' | 'error';

export interface EnrichmentResult {
  summary?: string;
  description?: string;
  aliases?: string[];
  /** One-sentence visual thesis - the primary visual signal for this entity */
  visualThesis?: string;
  /** Distinctive visual traits for image generation (derived from thesis) */
  visualTraits?: string[];
  imageId?: string;  // Reference to stored image (worker saves directly to IndexedDB)
  chronicleId?: string;  // Reference to stored chronicle in chronicleStore
  revisedPrompt?: string;
  generatedAt: number;
  model: string;
  // Cost tracking
  estimatedCost?: number;
  actualCost?: number;
  inputTokens?: number;
  outputTokens?: number;
  // Image dimensions for aspect-aware display
  width?: number;
  height?: number;
  aspect?: 'portrait' | 'landscape' | 'square';
  // Debug info (persisted for description enrichments)
  debug?: NetworkDebugInfo;
  /** Debug info for description chain (narrative → thesis → traits) */
  chainDebug?: DescriptionChainDebug;
}

export interface EnrichmentError {
  message: string;
  occurredAt: number;
}

export interface AcceptedChronicle {
  chronicleId: string;
  title: string;
  format: ChronicleFormat;
  content: string;
  summary?: string;
  imageRefs?: ChronicleImageRefs;
  entrypointId: string;
  entityIds: string[];
  generatedAt?: number;
  acceptedAt: number;
  model?: string;
}

/**
 * Enrichment state stored on each entity
 *
 * NOTE: summary and description are stored directly on the entity, not here.
 * This structure holds visual enrichment data and metadata only.
 */
export interface EntityEnrichment {
  /** Text enrichment metadata (visual fields, aliases, costs) - content is on entity */
  text?: {
    aliases: string[];
    /** One-sentence visual thesis - the primary visual signal for this entity */
    visualThesis?: string;
    /** Distinctive visual traits for image generation (derived from thesis) */
    visualTraits: string[];
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    /** Debug request/response from most recent generation (legacy single-shot) */
    debug?: NetworkDebugInfo;
    /** Debug info for description chain (narrative → thesis → traits) */
    chainDebug?: DescriptionChainDebug;
  };
  image?: {
    imageId: string;  // Reference to stored image in imageStore
    generatedAt: number;
    model: string;
    revisedPrompt?: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;  // GPT Image models return token usage
    outputTokens?: number;
    // Image dimensions for aspect-aware display
    width?: number;
    height?: number;
    aspect?: 'portrait' | 'landscape' | 'square';
  };
  entityChronicle?: {
    chronicleId: string;  // Reference to stored chronicle in chronicleStore
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  chronicles?: AcceptedChronicle[];
  /** Provenance links from description text to source chronicles */
  chronicleBackrefs?: ChronicleBackref[];
  /** Version history for descriptions — previous versions pushed here before overwrite */
  descriptionHistory?: Array<{
    description: string;
    replacedAt: number;
    source: string;  // 'description-task' | 'lore-backport' | 'summary-revision' | 'manual'
  }>;
  /** Historian annotations — scholarly margin notes anchored to description text */
  historianNotes?: HistorianNote[];
  /** Slug aliases from entity renames — old entity IDs that should still resolve in deep links */
  slugAliases?: string[];
}

/**
 * Shared task payload fields for queue items and worker tasks.
 */
export interface EnrichmentTaskBase {
  id: string;                 // Unique ID: `${type}_${entityId}`
  entityId: string;
  entityName: string;
  entityKind: string;
  entitySubtype?: string;
  entityCulture?: string;
  /** Unique ID for the simulation run - used to associate content with specific world state */
  simulationRunId: string;
  type: EnrichmentType;
  prompt: string;
  /** Per-task image size override (uses global config if not set) */
  imageSize?: string;
  /** Per-task image quality override (uses global config if not set) */
  imageQuality?: string;
  // For entityChronicle tasks
  chronicleContext?: ChronicleGenerationContext;
  chronicleStep?: ChronicleStep;
  chronicleId?: string;
  // For chronicle image tasks
  imageRefId?: string;
  sceneDescription?: string;
  imageType?: 'entity' | 'chronicle';
  /** Visual thesis per entity ID, for cover image scene generation */
  visualIdentities?: Record<string, string>;
  // For palette expansion tasks
  paletteEntityKind?: string;
  paletteWorldContext?: string;
  /** Available subtypes for this entity kind (for subtype-differentiated categories) */
  paletteSubtypes?: string[];
  /** Available eras for era-specific categories (one category per era per kind) */
  paletteEras?: Array<{ id: string; name: string; description?: string }>;
  /** Culture visual identities for grounding palette in world lore */
  paletteCultureContext?: Array<{
    name: string;
    description?: string;
    visualIdentity?: Record<string, string>;
  }>;
  /** Era ID this entity was created during (for trait selection) */
  entityEraId?: string;
  /** Focal era for this entity (era the entity was created in) - for description timeline */
  entityFocalEra?: EraTemporalInfo;
  /** All eras in the world (for description timeline context) */
  entityAllEras?: EraTemporalInfo[];
  /** If true, entity summary is user-defined and should not be overwritten by enrichment */
  entityLockedSummary?: boolean;
  /** Locked summary text (only set when lockedSummary=true) - used to preserve summary output */
  entityLockedSummaryText?: string;
  /** Narrative hint to guide description generation (always used as prompt input when present) */
  entityNarrativeHintText?: string;
  /** Optional temperature override for chronicle generation/regeneration */
  chronicleTemperature?: number;
  /** Elements to avoid in visual thesis (overused motifs, from project config) */
  visualAvoid?: string;
  /** Per-kind domain instructions for visual thesis (required for description tasks) */
  visualThesisInstructions?: string;
  /** Per-kind framing for visual thesis user message */
  visualThesisFraming?: string;
  /** Per-kind domain instructions for visual traits (required for description tasks) */
  visualTraitsInstructions?: string;
  /** Per-kind framing for visual traits user message */
  visualTraitsFraming?: string;
}

export type EnrichmentTaskPayload =
  | (EnrichmentTaskBase & {
      type: 'description';
      visualThesisInstructions: string;
      visualTraitsInstructions: string;
    })
  | (EnrichmentTaskBase & {
      type: Exclude<EnrichmentType, 'description'>;
    });

/**
 * Queue item - represents a pending enrichment request
 */
export type QueueItem = EnrichmentTaskPayload & {
  status: 'queued' | 'running' | 'complete' | 'error';
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: EnrichmentResult;
  error?: string;
  debug?: NetworkDebugInfo;
  // Cost tracking
  estimatedCost?: number;
};

/**
 * Which step to run for entityChronicle tasks
 */
export type ChronicleStep =
  | 'generate_v2'  // Single-shot generation
  | 'regenerate_temperature' // Re-run chronicle generation with prior prompts
  | 'compare'  // Compare all versions (produces report, no new draft)
  | 'combine'  // Combine all versions into a new draft
  | 'validate'
  | 'edit'
  | 'summary'
  | 'title'
  | 'image_refs'
  | 'cover_image_scene'  // Generate cover image scene description
  | 'cover_image'  // Generate cover image from scene description
  | 'regenerate_scene_description';  // Regenerate a single image ref's scene description

/**
 * Worker task - what we send to the worker (single task)
 * Includes metadata needed for worker to persist directly to IndexedDB
 */
export type WorkerTask = EnrichmentTaskPayload & {
  projectId: string;
};

/**
 * Worker result - what the worker returns
 */
export interface WorkerResult {
  id: string;
  entityId: string;
  type: EnrichmentType;
  success: boolean;
  result?: EnrichmentResult;
  error?: string;
  debug?: NetworkDebugInfo;
}

/**
 * Get enrichment status for an entity and type
 */
export function getEnrichmentStatus(
  entity: { id: string; summary?: string; description?: string; enrichment?: EntityEnrichment },
  type: EnrichmentType,
  queueItems: QueueItem[]
): EnrichmentStatus {
  // Check queue first
  const queueItem = queueItems.find(
    (item) => item.entityId === entity.id && item.type === type
  );
  if (queueItem) {
    if (queueItem.status === 'running') return 'running';
    if (queueItem.status === 'queued') return 'queued';
    if (queueItem.status === 'error') return 'error';
  }

  // Check entity fields directly (summary/description are on entity, not nested)
  const enrichment = entity.enrichment;

  if (type === 'description') {
    // Text enrichment is complete when entity has summary and description
    return (entity.summary && entity.description) ? 'complete' : 'missing';
  }
  if (type === 'image' && enrichment?.image?.imageId) return 'complete';
  if (type === 'entityChronicle' && enrichment?.entityChronicle?.chronicleId) return 'complete';

  return 'missing';
}

/**
 * Check if entity needs enrichment of a given type
 */
export function needsEnrichment(
  entity: { summary?: string; description?: string; enrichment?: EntityEnrichment },
  type: EnrichmentType
): boolean {
  const enrichment = entity.enrichment;

  if (type === 'description') {
    // Text enrichment needed when entity lacks summary or description
    return !(entity.summary && entity.description);
  }
  if (type === 'image') return !enrichment?.image?.imageId;
  if (type === 'entityChronicle') return !enrichment?.entityChronicle?.chronicleId;

  return true;
}

/**
 * Result of applying enrichment - includes both enrichment metadata and entity field updates
 */
export interface ApplyEnrichmentOutput {
  enrichment: EntityEnrichment;
  /** Summary to set on entity (undefined = no change, null = clear) */
  summary?: string | null;
  /** Description to set on entity (undefined = no change) */
  description?: string;
}

/**
 * Apply enrichment result to entity
 *
 * Returns both the enrichment metadata and entity field updates.
 * Callers should apply both: { ...entity, ...output.entityFields, enrichment: output.enrichment }
 *
 * @param lockedSummary - If true, skip setting the summary field (preserves user-defined summary)
 */
export function applyEnrichmentResult(
  entity: { enrichment?: EntityEnrichment },
  type: EnrichmentType,
  result: EnrichmentResult,
  lockedSummary?: boolean
): ApplyEnrichmentOutput {
  const existing = entity.enrichment || {};

  if (type === 'description' && result.description) {
    // For lockedSummary entities, skip the summary (user-defined takes precedence)
    // For normal entities, require both summary and description
    if (!lockedSummary && !result.summary) {
      return { enrichment: existing };
    }
    return {
      enrichment: {
        ...existing,
        text: {
          aliases: result.aliases || [],
          visualThesis: result.visualThesis,
          visualTraits: result.visualTraits || [],
          generatedAt: result.generatedAt,
          model: result.model,
          estimatedCost: result.estimatedCost,
          actualCost: result.actualCost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          debug: result.debug,
          chainDebug: result.chainDebug,
        },
      },
      // Entity field updates - summary/description go directly on entity
      summary: lockedSummary ? undefined : result.summary,
      description: result.description,
    };
  }

  if (type === 'image' && result.imageId) {
    return {
      enrichment: {
        ...existing,
        image: {
          imageId: result.imageId,
          generatedAt: result.generatedAt,
          model: result.model,
          revisedPrompt: result.revisedPrompt,
          estimatedCost: result.estimatedCost,
          actualCost: result.actualCost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          // Image dimensions for aspect-aware display
          width: result.width,
          height: result.height,
          aspect: result.aspect,
        },
      },
    };
  }

  if (type === 'entityChronicle' && result.chronicleId) {
    return {
      enrichment: {
        ...existing,
        entityChronicle: {
          chronicleId: result.chronicleId,
          generatedAt: result.generatedAt,
          model: result.model,
          estimatedCost: result.estimatedCost,
          actualCost: result.actualCost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      },
    };
  }

  return { enrichment: existing };
}
