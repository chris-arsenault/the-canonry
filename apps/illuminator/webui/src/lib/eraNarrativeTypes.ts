/**
 * Era Narrative Types
 *
 * Data structures for the era narrative system.
 * The historian compiles a single mythic-historical narrative for an era,
 * drawing on per-chronicle prep briefs as source material.
 *
 * Pipeline: threads → generate → edit
 * Each step pauses for review before advancing.
 */

import type { EraNarrativeWeight } from '@canonry/world-schema';

// =============================================================================
// Era Narrative Tones (distinct from annotation tones — tuned for long-form)
// =============================================================================

export type EraNarrativeTone =
  | 'witty'          // Sly, dry, finds the dark genuinely comic
  | 'cantankerous'   // Irritable energy, exasperated by the material
  | 'bemused'        // Puzzled and delighted, naturalist observing absurdity
  | 'defiant'        // Angry on behalf of builders, pride in what was attempted
  | 'sardonic'       // Sharp irony, names the pattern without flinching
  | 'tender'         // Cares about the people, lingers on what survived
  | 'hopeful'        // Reads the record for what was seeded, not just what was spent
  | 'enthusiastic';  // Thrilled by scale and ambition, infectious energy

// =============================================================================
// Steps & Status
// =============================================================================

export type EraNarrativeStep = 'threads' | 'generate' | 'edit';

export type EraNarrativeStatus =
  | 'pending'
  | 'generating'
  | 'step_complete'
  | 'complete'
  | 'cancelled'
  | 'failed';

// =============================================================================
// Thread Synthesis Output
// =============================================================================

export interface EraNarrativeThread {
  threadId: string;
  name: string;
  culturalActors: string[];  // Culture/faction names — the world-level actors in this thread
  description: string;
  chronicleIds: string[];
  arc: string;               // Cultural state at era start → cultural state at era end
  register?: string;         // 3-word emotional label for how this thread feels
  material?: string;         // Curated narrative facts: characters, events, mechanisms, imagery. Analytical voice — not chronicle prose.
}

/** In-world text that exists as cultural artifact — quotable as primary source */
export interface EraNarrativeQuote {
  text: string;              // The in-world text verbatim
  origin: string;            // What kind of artifact and where it comes from
  context: string;           // Significance and where it appears in source material
}

/** Strategic interaction between cultures — inferred by the historian from the broader archive */
export interface EraNarrativeStrategicDynamic {
  interaction: string;       // Brief label: "Aurora-Nightshelf dependency spiral"
  actors: string[];          // The cultures/factions involved
  dynamic: string;           // The historian's reconstruction of the strategic interaction
}

export interface EraNarrativeMovementPlan {
  movementIndex: number;
  yearRange: [number, number];
  worldState: string;           // State of the world at this movement's opening
  threadFocus: string[];        // 1-3 thread IDs
  beats: string;                // Key moments — as cultural events, not character events
}

export interface EraNarrativeThreadSynthesis {
  threads: EraNarrativeThread[];
  thesis: string;
  counterweight?: string;                  // What persisted, what was built, what survived
  quotes?: EraNarrativeQuote[];            // In-world text quotable as cultural artifact
  strategicDynamics?: EraNarrativeStrategicDynamic[];  // Inter-cultural strategic interactions inferred by the historian
  movements?: EraNarrativeMovementPlan[];  // optional — no longer produced
  motifs?: string[];                       // optional — no longer produced
  openingImage?: string;                   // optional — no longer produced
  closingImage?: string;                   // optional — no longer produced
  generatedAt: number;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
}

// =============================================================================
// Narrative Content (legacy single-object model — kept for backward compat)
// =============================================================================

export interface EraNarrativeContent {
  content: string;
  editedContent?: string;
  wordCount: number;
  editedWordCount?: number;
  generatedAt: number;
  editedAt?: number;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
  editSystemPrompt?: string;
  editUserPrompt?: string;
  editInputTokens?: number;
  editOutputTokens?: number;
  editActualCost?: number;
}

// =============================================================================
// Content Versions (replaces legacy single-object model)
// =============================================================================

export interface EraNarrativeContentVersion {
  versionId: string;
  content: string;
  wordCount: number;
  step: 'generate' | 'edit';
  generatedAt: number;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
}

// =============================================================================
// Cover Image
// =============================================================================

export interface EraNarrativeCoverImage {
  sceneDescription: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  generatedImageId?: string;
  error?: string;
}

// =============================================================================
// Image Refs (inline images referencing chronicle images or new scenes)
// =============================================================================

export type EraNarrativeImageSize = 'small' | 'medium' | 'large' | 'full-width';

interface BaseEraNarrativeImageRef {
  refId: string;
  anchorText: string;
  anchorIndex?: number;
  size: EraNarrativeImageSize;
  justification?: 'left' | 'right';
  caption?: string;
}

/** Reference to a chronicle image (cover or scene image from an era's chronicle) */
export interface ChronicleImageRef extends BaseEraNarrativeImageRef {
  type: 'chronicle_ref';
  chronicleId: string;
  chronicleTitle: string;
  imageSource: 'cover' | 'image_ref';
  imageRefId?: string;
  imageId: string;
}

/** New scene image generated for the era narrative */
export interface EraNarrativePromptRequestRef extends BaseEraNarrativeImageRef {
  type: 'prompt_request';
  sceneDescription: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  generatedImageId?: string;
  error?: string;
}

export type EraNarrativeImageRef = ChronicleImageRef | EraNarrativePromptRequestRef;

export interface EraNarrativeImageRefs {
  refs: EraNarrativeImageRef[];
  generatedAt: number;
  model: string;
}

// =============================================================================
// Prep Brief (per-chronicle input to thread synthesis)
// =============================================================================

export interface EraNarrativePrepBrief {
  chronicleId: string;
  chronicleTitle: string;
  eraYear?: number;
  /** Source weight from narrative style: structural, contextual, or flavor */
  weight?: EraNarrativeWeight;
  prep: string;
}

// =============================================================================
// World-Level Context (loaded at start, used by prompts)
// =============================================================================

export interface EraNarrativeEraSummary {
  id: string;
  name: string;
  summary: string;
}

export interface EraNarrativeWorldContext {
  /** Focal era + adjacent era summaries — world-state anchors */
  focalEra: EraNarrativeEraSummary;
  previousEra?: EraNarrativeEraSummary;
  nextEra?: EraNarrativeEraSummary;
  /** Thesis from the previous era's completed narrative (for inter-era continuity) */
  previousEraThesis?: string;
  /** World dynamics resolved for this era (era overrides applied) */
  resolvedDynamics: string[];
  /** Culture identities — culture → trait → value */
  culturalIdentities: Record<string, Record<string, string>>;
}

// =============================================================================
// Era Narrative Record (persisted to IndexedDB)
// =============================================================================

export interface EraNarrativeRecord {
  narrativeId: string;
  projectId: string;
  simulationRunId: string;
  eraId: string;
  eraName: string;

  status: EraNarrativeStatus;
  error?: string;

  tone: EraNarrativeTone;
  /** Optional arc direction override — when set, injected as a CRITICAL framing constraint for thesis, threads, and registers */
  arcDirection?: string;
  /** Optional scene/passage to weave into the narrative during copy edit */
  editInsertion?: string;
  historianConfigJson: string;

  currentStep: EraNarrativeStep;

  prepBriefs: EraNarrativePrepBrief[];
  worldContext?: EraNarrativeWorldContext;
  threadSynthesis?: EraNarrativeThreadSynthesis;
  /** Legacy single-object narrative — kept for backward compat with existing records */
  narrative?: EraNarrativeContent;

  /** Versioned content — each generate/edit step pushes a new version */
  contentVersions?: EraNarrativeContentVersion[];
  /** User-selected active version (defaults to latest) */
  activeVersionId?: string;

  /** Cover image for the era narrative */
  coverImage?: EraNarrativeCoverImage;
  /** Inline image refs (chronicle images + generated scenes) */
  imageRefs?: EraNarrativeImageRefs;

  totalInputTokens: number;
  totalOutputTokens: number;
  totalActualCost: number;

  createdAt: number;
  updatedAt: number;
}
