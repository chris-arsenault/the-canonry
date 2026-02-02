/**
 * Chronicle Types
 *
 * Data structures for the chronicle generation pipeline.
 * See CHRONICLE_DESIGN.md for full architecture documentation.
 */

import type { NarrativeStyle } from '@canonry/world-schema';
import type { ChronicleStep } from './enrichmentTypes';
import type { HistorianNote } from './historianTypes';

// =============================================================================
// Chronicle Plan - Output of Step 1
// =============================================================================

export type ChronicleFormat = 'story' | 'document';

export interface ChronicleEntityRole {
  entityId: string;
  role: string; // Flexible role based on narrative style (e.g., 'protagonist', 'scribe', 'authority')
  contribution: string; // How this entity functions in the narrative or document
}

export type FocusMode = 'single' | 'ensemble';

export interface NarrativeFocus {
  mode: FocusMode;
  entrypointId: string;
  primaryEntityIds: string[];
  supportingEntityIds: string[];
  selectedEntityIds: string[];
  selectedEventIds: string[];
  notes?: string;
}

export interface DocumentOutline {
  purpose: string;
  keyPoints: string[];
  era: string;
  tone: string;
  veracity?: string;
  legitimacy?: string;
  audience?: string;
  authorProvenance?: string;
  biasAgenda?: string;
  intendedOutcome?: string;
}

export interface StoryOutline {
  purpose: string;
  keyPoints: string[];
  era: string;
  tone: string;
  theme: string;
  emotionalBeats: string[];
  stakes?: string;
  transformation?: string;
  intendedImpact?: string;
}

export interface PlotBeat {
  description: string;
  eventIds: string[]; // NarrativeEvent IDs that drive this beat
}

/**
 * Plot structure for any narrative style.
 * Raw contains the LLM-generated structure matching the style's schema.
 */
export interface ChroniclePlot {
  /** Plot structure type from NarrativeStyle (e.g., 'three-act', 'episodic', 'document') */
  type: string;
  /** Raw plot data as returned by LLM (varies by plot type) */
  raw: Record<string, unknown>;
  /** Normalized beats extracted from any plot type for section expansion */
  normalizedBeats: PlotBeat[];
}

export interface ChronicleSection {
  id: string;
  name: string;
  purpose: string; // Style-defined purpose of this section
  goal: string; // Plan-specific objective for this section
  entityIds: string[]; // Entity IDs involved
  eventIds: string[]; // NarrativeEvent IDs to incorporate
  wordCountTarget?: number;
  // Story format fields
  requiredElements?: string[];
  emotionalArc?: string; // tension, relief, revelation, etc.
  setting?: string;
  // Document format fields
  contentGuidance?: string;
  optional?: boolean;
  // Filled in Step 2
  generatedContent?: string;
}

export interface ChroniclePlan {
  id: string;
  title: string;
  format: ChronicleFormat;

  // Entity roles with narrative/document contribution
  entityRoles: ChronicleEntityRole[];

  // Focus decision and selected cast/event set
  focus: NarrativeFocus;

  // Plot structure (story formats)
  plot?: ChroniclePlot;

  // Document outline (document formats)
  documentOutline?: DocumentOutline;

  // Story outline (story formats)
  storyOutline?: StoryOutline;

  // Section breakdown
  sections: ChronicleSection[];

  // Generation metadata
  generatedAt?: number;
  model?: string;
}

// =============================================================================
// Cohesion Report - Output of Step 4
// =============================================================================

export interface CohesionCheck {
  pass: boolean;
  notes: string;
}

export interface SectionGoalCheck {
  sectionId: string;
  pass: boolean;
  notes: string;
}

export interface CohesionIssue {
  severity: 'critical' | 'minor';
  sectionId?: string;
  checkType: string;
  description: string;
  suggestion: string;
}

export interface CohesionReport {
  overallScore: number; // 0-100

  checks: {
    plotStructure: CohesionCheck;
    entityConsistency: CohesionCheck;
    sectionGoals: SectionGoalCheck[];
    resolution: CohesionCheck;
    factualAccuracy: CohesionCheck;
    themeExpression: CohesionCheck;
  };

  issues: CohesionIssue[];

  // Generation metadata
  generatedAt?: number;
  model?: string;
}

export type ChronicleStatus =
  | 'not_started'
  | 'generating' // Generation in progress
  | 'assembly_ready' // Generation complete, awaiting user review
  | 'editing' // Revision in progress
  | 'validating' // Validation in progress
  | 'validation_ready' // Validation complete, issues may exist
  | 'failed' // Generation failed; requires regeneration
  | 'complete'; // All steps done, accepted


// =============================================================================
// Chronicle Wizard Types - Role assignments from wizard flow
// =============================================================================

/**
 * A role assignment from the chronicle wizard.
 * Maps an entity to a role defined in the NarrativeStyle's entityRules.roles.
 */
export interface ChronicleRoleAssignment {
  /** Role ID from style's entityRules.roles (e.g., 'protagonist', 'antagonist') */
  role: string;
  /** Assigned entity ID */
  entityId: string;
  /** Entity name (denormalized for display) */
  entityName: string;
  /** Entity kind (denormalized for display) */
  entityKind: string;
  /** User toggle: primary emphasis vs supporting */
  isPrimary: boolean;
}

// =============================================================================
// Narrative Lens - Universal contextual frame entity
// =============================================================================

/**
 * A narrative lens entity assigned in the wizard.
 * Not a cast member - provides contextual framing for any narrative style.
 * Typically a rule, occurrence, or ability that shapes the story's world.
 */
export interface NarrativeLens {
  /** Assigned entity ID */
  entityId: string;
  /** Entity name (denormalized for display) */
  entityName: string;
  /** Entity kind (denormalized for display) */
  entityKind: string;
}

// =============================================================================
// Generation Context - Input to each generation step
// =============================================================================

export interface EntityContext {
  // Full entity object
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  prominence: string;
  culture?: string;
  status: string;
  tags: Record<string, string>;
  eraId?: string;
  summary?: string;
  description?: string;
  aliases?: string[];
  coordinates?: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

export interface RelationshipContext {
  src: string;
  dst: string;
  kind: string;
  strength?: number;

  // Resolved entity info
  sourceName: string;
  sourceKind: string;
  targetName: string;
  targetKind: string;

  // Enriched content (from Layer 2)
  backstory?: string;
}

export interface EraContext {
  id: string;
  name: string;
  description?: string;
}

export interface NarrativeEventContext {
  id: string;
  tick: number;
  era: string;
  eventKind: string;
  significance: number;
  headline: string;
  description?: string;
  subjectId?: string;
  subjectName?: string;
  objectId?: string;
  objectName?: string;
  participants?: {
    id: string;
    name: string;
    kind: string;
    subtype?: string;
  }[];
  stateChanges?: {
    entityId: string;
    entityName: string;
    field: string;
    previousValue: unknown;
    newValue: unknown;
  }[];
  narrativeTags?: string[];
}

// =============================================================================
// World Dynamics - Higher-level narrative context statements
// =============================================================================

/**
 * A world dynamic statement with optional relevance filters.
 * Describes macro-level forces and tensions (e.g., inter-culture conflicts,
 * entity-kind behaviors) that individual relationships are expressions of.
 */
/** Per-era override for a world dynamic statement. */
export interface WorldDynamicEraOverride {
  text: string;
  /** If true, replaces the base text entirely. If false, appends to base text. */
  replace: boolean;
}

export interface WorldDynamic {
  id: string;
  text: string;
  /** Only include when these cultures are present in the chronicle. Empty or ['*'] = always. */
  cultures?: string[];
  /** Only include when these entity kinds are present in the chronicle. Empty or ['*'] = always. */
  kinds?: string[];
  /** Per-era text overrides. Key = era ID. Applied when the chronicle's focal era matches. */
  eraOverrides?: Record<string, WorldDynamicEraOverride>;
}

// =============================================================================
// Chronicle Focus - Defines what the chronicle is about (chronicle-first)
// =============================================================================

export type ChronicleFocusType = 'single' | 'ensemble';

export interface ChronicleFocus {
  /** What type of chronicle is this? */
  type: ChronicleFocusType;

  /** Role assignments define the cast - THIS IS THE PRIMARY IDENTITY */
  roleAssignments: ChronicleRoleAssignment[];

  /** Optional narrative lens - contextual frame entity (rule, occurrence, ability) */
  lens?: NarrativeLens;

  /** Entity IDs of primary characters (derived from isPrimary=true) */
  primaryEntityIds: string[];

  /** Entity IDs of supporting characters (derived from isPrimary=false) */
  supportingEntityIds: string[];

  /** All selected entity IDs */
  selectedEntityIds: string[];

  /** All selected event IDs */
  selectedEventIds: string[];

  /** All selected relationship IDs */
  selectedRelationshipIds: string[];
}

/**
 * Fact type determines how the fact is used in generation.
 *
 * - "world_truth": In-universe facts that characters experience/know.
 *   These go through perspective synthesis and get faceted interpretations.
 *   Example: "The Berg's ice remembers ancient events."
 *
 * - "generation_constraint": Meta-instructions to correct LLM tendencies.
 *   Characters wouldn't know these as facts - they just ARE.
 *   Always included verbatim, never faceted.
 *   Example: "All sapient beings are penguins or orcas. No humans exist."
 */
export type FactType = 'world_truth' | 'generation_constraint';

/**
 * Canon fact with relevance metadata for perspective synthesis.
 */
export interface CanonFactWithMetadata {
  id: string;
  text: string;

  /**
   * How this fact is used. Defaults to "world_truth" if not specified.
   * - world_truth: Faceted by perspective synthesis
   * - generation_constraint: Always included verbatim
   */
  type?: FactType;

  /** Cultures this fact is especially relevant to. Use "*" for universal. */
  relevantCultures: string[];
  /** Entity kinds this fact is especially relevant to. Use "*" for universal. */
  relevantKinds: string[];
  /** Thematic tags this fact relates to (e.g., "trade", "conflict", "magic") */
  relevantTags: string[];
  /** Relationship kinds this fact relates to (e.g., "enemy", "trade_partner") */
  relevantRelationships: string[];
  /** Base priority 0-1. Higher = more likely to be foregrounded. */
  basePriority: number;
}

/**
 * Tone fragments for composable tone assembly.
 */
export interface ToneFragments {
  core: string;
}

/**
 * Perspective synthesis result stored with chronicle
 */
export interface PerspectiveSynthesisRecord {
  /** When synthesis was performed */
  generatedAt: number;
  /** Model used */
  model: string;

  // === OUTPUT (LLM response) ===
  /** The perspective brief */
  brief: string;
  /** Selected facts with faceted interpretations */
  facets: Array<{ factId: string; interpretation: string }>;
  /** Suggested motifs */
  suggestedMotifs: string[];
  /** Synthesized narrative voice blending cultural traits + narrative style */
  narrativeVoice: Record<string, string>;
  /** Per-entity writing directives pre-applying cultural traits + prose hints */
  entityDirectives: Array<{ entityId: string; entityName: string; directive: string }>;

  // === INPUT (what was sent to LLM) ===
  /** Constellation summary that drove the synthesis */
  constellationSummary: string;
  /** Full constellation analysis */
  constellation?: {
    cultures: Record<string, number>;
    kinds: Record<string, number>;
    prominentTags: string[];
    dominantCulture?: string;
    cultureBalance: string;
    relationshipKinds: Record<string, number>;
  };
  /** Core tone that was sent */
  coreTone?: string;
  /** Narrative style that weighted the synthesis */
  narrativeStyleId?: string;
  narrativeStyleName?: string;
  /** All facts that were sent (with metadata) */
  inputFacts?: Array<{
    id: string;
    text: string;
    type?: 'world_truth' | 'generation_constraint';
  }>;
  /** Cultural identities that were sent (culture -> trait -> value) */
  inputCulturalIdentities?: Record<string, Record<string, string>>;
  /** Entity summaries that were sent */
  inputEntities?: Array<{
    name: string;
    kind: string;
    culture?: string;
    summary?: string;
  }>;

  /** Cost info */
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
}

export interface ChronicleGenerationContext {
  // World context (user-defined)
  worldName: string;
  worldDescription: string;

  /**
   * The tone string used by the prompt builder.
   * After perspective synthesis: contains assembled tone + brief + motifs.
   */
  tone: string;

  /**
   * The canon facts array used by the prompt builder.
   * After perspective synthesis: contains faceted facts with interpretations.
   */
  canonFacts: string[];

  // INPUT for perspective synthesis (required)
  // These are used to generate the final tone/canonFacts above
  toneFragments: ToneFragments;
  canonFactsWithMetadata: CanonFactWithMetadata[];

  // Narrative style used for generation
  narrativeStyle: NarrativeStyle;

  // Chronicle focus (chronicle-first architecture)
  focus: ChronicleFocus;

  // Optional narrative lens entity (contextual frame, not a cast member)
  lensEntity?: EntityContext;

  // Optional era context (legacy single era)
  era?: EraContext;

  // Full temporal context with all eras and chronicle timeline
  temporalContext?: ChronicleTemporalContext;

  // All selected entities (full context)
  entities: EntityContext[];

  // Selected relationships
  relationships: RelationshipContext[];

  // Selected events
  events: NarrativeEventContext[];

  /**
   * Name bank for invented characters (culture ID -> array of names).
   */
  nameBank?: Record<string, string[]>;

  /**
   * Prose hints for different entity kinds (entityKind -> prose guidance).
   * Helps chronicles write consistently about different entity types.
   * E.g., "Focus on gesture, tic, or signature object" for NPCs.
   */
  proseHints?: Record<string, string>;

  /**
   * Cultural identities for cultures present in the world.
   * Provides VALUES, SPEECH, FEARS, TABOOS etc. per culture.
   * Used as INPUT to perspective synthesis, not directly in generation prompt.
   */
  culturalIdentities?: Record<string, Record<string, string>>;

  /**
   * Synthesized narrative voice from perspective synthesis.
   * Blends cultural traits + narrative style into prose-level guidance.
   * LLM-chosen keys (e.g., VOICE, TENSION, WHAT_IS_UNSAID, PHYSICALITY).
   */
  narrativeVoice?: Record<string, string>;

  /**
   * Per-entity writing directives from perspective synthesis.
   * Pre-applies cultural traits + prose hints into concrete writing guidance per entity.
   */
  entityDirectives?: Array<{ entityId: string; entityName: string; directive: string }>;

  /**
   * World dynamics — higher-level narrative context statements.
   * Filtered by present cultures/kinds during perspective synthesis.
   */
  worldDynamics?: WorldDynamic[];
}

// =============================================================================
// Pipeline Step Results
// =============================================================================

export interface AssemblyResult {
  success: boolean;
  content?: string;
  error?: string;
}

// =============================================================================
// Chronicle Image References - Output of Image Refs Step
// =============================================================================

/** Display size hint for chronicle images */
export type ChronicleImageSize = 'small' | 'medium' | 'large' | 'full-width';

/** Base properties shared by all image reference types */
interface BaseChronicleImageRef {
  /** Unique ID for this image reference */
  refId: string;
  /** Text phrase to anchor image near (for paragraph-level positioning) */
  anchorText: string;
  /** Character index where anchorText was found (fallback if text changes) */
  anchorIndex?: number;
  /** Display size hint */
  size: ChronicleImageSize;
  /** Float justification for small/medium images */
  justification?: 'left' | 'right';
  /** Optional caption for the image */
  caption?: string;
}

/** Reference to an existing entity image */
export interface EntityImageRef extends BaseChronicleImageRef {
  type: 'entity_ref';
  /** Entity ID whose image to use */
  entityId: string;
}

/** Request for a new prompt-generated image */
export interface PromptRequestRef extends BaseChronicleImageRef {
  type: 'prompt_request';
  /** LLM-generated scene description for image generation */
  sceneDescription: string;
  /** Entity IDs involved in this scene (for visual identity compositing) */
  involvedEntityIds?: string[];
  /** Generation state */
  status: 'pending' | 'generating' | 'complete' | 'failed';
  /** Generated imageId (after generation) */
  generatedImageId?: string;
  /** Error message if generation failed */
  error?: string;
}

/** Union type for all chronicle image references */
export type ChronicleImageRef = EntityImageRef | PromptRequestRef;

/** Structured image refs stored in ChronicleRecord */
export interface ChronicleImageRefs {
  refs: ChronicleImageRef[];
  generatedAt: number;
  model: string;
}

// =============================================================================
// Chronicle Cover Image - First-class cover montage for chronicles
// =============================================================================

/** Cover image for a chronicle (montage-style overview) */
export interface ChronicleCoverImage {
  /** LLM-generated scene description for the cover montage */
  sceneDescription: string;
  /** Entity IDs involved in the cover scene (for visual identity compositing) */
  involvedEntityIds: string[];
  /** Generation state */
  status: 'pending' | 'generating' | 'complete' | 'failed';
  /** Generated imageId (after image generation) */
  generatedImageId?: string;
  /** Error message if generation failed */
  error?: string;
}

// =============================================================================
// Chronicle Temporal Context - Era and time anchoring for chronicles
// =============================================================================

/**
 * Temporal scope classification based on tick range covered.
 * - moment: 1-5 ticks (a single scene or interaction)
 * - episode: 5-20 ticks (a short adventure or incident)
 * - arc: 20-50 ticks (a major storyline or campaign)
 * - saga: 50+ ticks or multi-era (generational epic)
 */
export type TemporalScope = 'moment' | 'episode' | 'arc' | 'saga';

/**
 * Era info with tick range for temporal calculations.
 */
export interface EraTemporalInfo {
  id: string;
  name: string;
  summary?: string;
  /** Order in the era sequence (0 = first era) */
  order: number;
  /** Starting tick of this era */
  startTick: number;
  /** Ending tick of this era (exclusive) */
  endTick: number;
  /** Duration in ticks */
  duration: number;
}

/**
 * Complete temporal context for a chronicle.
 * Computed from selected events and entities.
 */
export interface ChronicleTemporalContext {
  /** The primary era this chronicle takes place in */
  focalEra: EraTemporalInfo;

  /** All eras in the world (for context) */
  allEras: EraTemporalInfo[];

  /** Tick range covered by selected events [min, max] */
  chronicleTickRange: [number, number];

  /** Temporal scope classification */
  temporalScope: TemporalScope;

  /** Whether chronicle spans multiple eras */
  isMultiEra: boolean;

  /** Era IDs that the chronicle touches */
  touchedEraIds: string[];

  /** Human-readable temporal description */
  temporalDescription: string;
}

// =============================================================================
// Chronicle Record - Persisted chronicle data
// =============================================================================

export interface ChronicleRecord {
  chronicleId: string;
  projectId: string;
  /** Unique ID for the simulation run this chronicle belongs to */
  simulationRunId: string;

  // ========================================================================
  // Chronicle Identity (chronicle-first architecture)
  // ========================================================================

  /** User-visible title for the chronicle */
  title: string;

  /** Narrative format (story vs document) */
  format: ChronicleFormat;

  /** Focus type: what is this chronicle about? */
  focusType: ChronicleFocusType;

  /** Role assignments define the chronicle's cast */
  roleAssignments: ChronicleRoleAssignment[];

  /** Optional narrative lens - contextual frame entity (rule, occurrence, ability) */
  lens?: NarrativeLens;

  /** Narrative style ID */
  narrativeStyleId: string;
  /** Narrative style snapshot (stored with the chronicle seed) */
  narrativeStyle?: NarrativeStyle;

  /** Selected entity IDs (all entities in the chronicle) */
  selectedEntityIds: string[];

  /** Selected event IDs */
  selectedEventIds: string[];

  /** Selected relationship IDs (src:dst:kind format) */
  selectedRelationshipIds: string[];

  /** Temporal context including focal era */
  temporalContext?: ChronicleTemporalContext;

  // ========================================================================
  // Mechanical metadata (used for graph traversal, not identity)
  // ========================================================================

  /** Entry point used for candidate discovery - purely mechanical, not displayed */
  entrypointId?: string;

  // ========================================================================
  // Generation metadata
  // ========================================================================

  /** Summary of what was selected for the prompt */
  selectionSummary?: {
    entityCount: number;
    eventCount: number;
    relationshipCount: number;
  };

  // Generation state
  status: ChronicleStatus;
  failureStep?: ChronicleStep;
  failureReason?: string;
  failedAt?: number;

  // Content
  assembledContent?: string;
  assembledAt?: number;

  // Generation prompts (stored for debugging/export - the ACTUAL prompts sent)
  generationSystemPrompt?: string;
  generationUserPrompt?: string;
  /** Temperature used for the most recent generation */
  generationTemperature?: number;
  /** Prior generation versions (chronicle regeneration history) */
  generationHistory?: ChronicleGenerationVersion[];
  /** Version id that should be published on accept */
  activeVersionId?: string;

  // Generation context snapshot (stored for export - what was actually used)
  // This is the FINAL context after perspective synthesis, not the original input
  generationContext?: {
    worldName: string;
    worldDescription: string;
    /** The actual tone sent to LLM (post-perspective: assembled + brief + motifs) */
    tone: string;
    /** The actual facts sent to LLM (post-perspective: faceted facts) */
    canonFacts: string[];
    /** Name bank for invented characters */
    nameBank?: Record<string, string[]>;
    /** Synthesized narrative voice from perspective synthesis */
    narrativeVoice?: Record<string, string>;
    /** Per-entity writing directives from perspective synthesis */
    entityDirectives?: Array<{ entityId: string; entityName: string; directive: string }>;
  };

  // Perspective synthesis (required for all new chronicles)
  perspectiveSynthesis?: PerspectiveSynthesisRecord;

  // Cohesion validation
  cohesionReport?: CohesionReport;
  validatedAt?: number;

  // Version comparison report (user-triggered, text only)
  comparisonReport?: string;
  comparisonReportGeneratedAt?: number;
  combineInstructions?: string;

  // Refinements
  summary?: string;
  summaryGeneratedAt?: number;
  summaryModel?: string;
  summaryTargetVersionId?: string;
  titleCandidates?: string[];
  titleGeneratedAt?: number;
  titleModel?: string;
  pendingTitle?: string;
  pendingTitleCandidates?: string[];
  imageRefs?: ChronicleImageRefs;
  imageRefsGeneratedAt?: number;
  imageRefsModel?: string;
  imageRefsTargetVersionId?: string;
  coverImage?: ChronicleCoverImage;
  coverImageGeneratedAt?: number;
  coverImageModel?: string;
  validationStale?: boolean;

  // Revision tracking
  editVersion: number;
  editedAt?: number;

  // Final content
  finalContent?: string;
  acceptedAt?: number;

  /** Whether lore from this chronicle has been backported to cast entity descriptions */
  loreBackported?: boolean;

  /** Historian annotations — scholarly margin notes anchored to chronicle text */
  historianNotes?: HistorianNote[];

  // Cost tracking (aggregated across all LLM calls)
  totalEstimatedCost: number;
  totalActualCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;

  // Metadata
  model: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Stored snapshot of a chronicle generation version.
 */
export interface ChronicleGenerationVersion {
  versionId: string;
  generatedAt: number;
  content: string;
  wordCount: number;
  model: string;
  temperature?: number;
  systemPrompt: string;
  userPrompt: string;
  cost?: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
}

/**
 * Shell record metadata (for creating before generation starts)
 */
export interface ChronicleShellMetadata {
  projectId: string;
  simulationRunId: string;
  model: string;

  // Chronicle identity
  title?: string;
  format: ChronicleFormat;
  narrativeStyleId: string;
  narrativeStyle?: NarrativeStyle;
  roleAssignments: ChronicleRoleAssignment[];
  lens?: NarrativeLens;
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext?: ChronicleTemporalContext;

  // Mechanical (optional)
  entrypointId?: string;
}

/**
 * Chronicle creation metadata
 */
export interface ChronicleMetadata {
  projectId: string;
  simulationRunId: string;
  model: string;

  // Chronicle identity
  title?: string;
  format: ChronicleFormat;

  // Generation prompts (the ACTUAL prompts sent to LLM - canonical source of truth)
  generationSystemPrompt?: string;
  generationUserPrompt?: string;
  generationTemperature?: number;
  narrativeStyleId: string;
  narrativeStyle?: NarrativeStyle;
  roleAssignments: ChronicleRoleAssignment[];
  lens?: NarrativeLens;
  selectedEntityIds: string[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  temporalContext?: ChronicleTemporalContext;

  // Mechanical (optional)
  entrypointId?: string;

  // Generation result
  assembledContent: string;
  selectionSummary: {
    entityCount: number;
    eventCount: number;
    relationshipCount: number;
  };
  perspectiveSynthesis?: PerspectiveSynthesisRecord;
  cost: { estimated: number; actual: number; inputTokens: number; outputTokens: number };
}

// =============================================================================
// Entity Usage Statistics
// =============================================================================

/**
 * Usage statistics for an entity across chronicles
 */
export interface EntityUsageStats {
  entityId: string;
  usageCount: number;
  chronicleIds: string[];
}

// =============================================================================
// Narrative Style Usage Statistics
// =============================================================================

/**
 * Usage statistics for a narrative style across chronicles
 */
export interface NarrativeStyleUsageStats {
  styleId: string;
  usageCount: number;
  chronicleIds: string[];
}
