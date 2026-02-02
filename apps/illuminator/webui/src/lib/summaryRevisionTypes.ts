/**
 * Summary Revision Types
 *
 * Batch revision of entity summaries/descriptions using world dynamics
 * and broader narrative context. Uses IndexedDB as a shared mailbox
 * between the worker (LLM calls) and the main thread (review UI).
 *
 * Batches execute sequentially — user reviews each batch before the
 * next is dispatched, allowing early cancellation if the prompt needs tuning.
 */

// =============================================================================
// Run Status Machine
// =============================================================================

export type SummaryRevisionRunStatus =
  | 'pending'                // Created, waiting for first batch
  | 'generating'             // LLM call in progress for current batch
  | 'batch_reviewing'        // Current batch complete, user reviewing before continuing
  | 'run_reviewing'          // All batches complete, final per-entity accept/reject
  | 'complete'               // User applied selected patches
  | 'cancelled'              // User cancelled the run
  | 'failed';                // Error occurred

// =============================================================================
// Patches
// =============================================================================

export interface SummaryRevisionPatch {
  entityId: string;
  entityName: string;
  entityKind: string;
  /** Revised summary — undefined means no change suggested */
  summary?: string;
  /** Revised description — undefined means no change suggested */
  description?: string;
  /** Anchor phrase for chronicle backref linking (lore backport only) */
  anchorPhrase?: string;
}

// =============================================================================
// Batches
// =============================================================================

export interface SummaryRevisionBatch {
  /** Culture grouping key */
  culture: string;
  /** Entity IDs in this batch, sorted by prominence */
  entityIds: string[];
  /** Batch-level status */
  status: 'pending' | 'generating' | 'complete' | 'failed';
  /** Proposed patches from LLM */
  patches: SummaryRevisionPatch[];
  /** Error message if status=failed */
  error?: string;
  /** Cost for this batch */
  inputTokens?: number;
  outputTokens?: number;
  actualCost?: number;
}

// =============================================================================
// LLM Response Shape
// =============================================================================

export interface SummaryRevisionLLMResponse {
  patches: Array<{
    entityId: string;
    entityName: string;
    entityKind: string;
    summary?: string;
    /** LLM returns description as string[] (paragraphs); normalized to string during parsing */
    description?: string | string[];
    anchorPhrase?: string;
  }>;
}

// =============================================================================
// Run Record (stored in IndexedDB)
// =============================================================================

export interface SummaryRevisionRun {
  runId: string;
  projectId: string;
  simulationRunId: string;

  status: SummaryRevisionRunStatus;

  /** All batches, grouped by culture */
  batches: SummaryRevisionBatch[];

  /** Index of the batch currently being processed/reviewed */
  currentBatchIndex: number;

  /** Per-entity accept/reject decisions (entityId -> true=accepted, false=rejected) */
  patchDecisions: Record<string, boolean>;

  /** Context stored once, used by all batches */
  worldDynamicsContext: string;
  staticPagesContext: string;
  schemaContext: string;

  /** User-editable revision guidance (for prompt tuning between runs) */
  revisionGuidance: string;

  /** Cost tracking */
  totalInputTokens: number;
  totalOutputTokens: number;
  totalActualCost: number;

  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// Entity Context (per-entity data sent to LLM)
// =============================================================================

export interface RevisionEntityContext {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: string;
  culture: string;
  status: string;
  summary: string;
  description: string;
  visualThesis?: string;
  /** Top relationships for grounding */
  relationships: Array<{
    kind: string;
    targetName: string;
    targetKind: string;
  }>;
  /** Existing chronicle backref anchor phrases that must be preserved in the description */
  existingAnchorPhrases?: string[];
  /** Per-kind description focus guidance (from entityGuidance config) */
  kindFocus?: string;
  /** True if this entity is the narrative lens (contextual frame, not a cast member) */
  isLens?: boolean;
}
