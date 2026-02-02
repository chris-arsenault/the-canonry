/**
 * Historian Reviewer Types
 *
 * Data structures for the historian annotation system.
 * The historian is a persistent scholarly voice that annotates entity
 * descriptions and chronicle narratives with marginal notes — resigned
 * commentary, factual corrections, weary observations, and dry asides.
 */

// =============================================================================
// Tone Presets
// =============================================================================

export type HistorianTone =
  | 'witty'          // Tongue-in-cheek, sarcastic, playful
  | 'weary'          // Resigned satire, black humor, aloof compassion
  | 'forensic'       // Cold, clinical, methodical — the historian as detective
  | 'elegiac'        // Mournful, lyrical, focused on loss and what's been forgotten
  | 'cantankerous';  // Irritable, contrarian, perpetually annoyed by sloppy scholarship

// =============================================================================
// Note Types
// =============================================================================

export type HistorianNoteType =
  | 'commentary'    // General observation, admiration, color — tone-dependent
  | 'correction'    // Factual inconsistency or inaccuracy callout
  | 'tangent'       // Personal digression, aside, memory
  | 'skepticism'    // Disputes or questions the account
  | 'pedantic';     // Scholarly pedantic correction (names, dates, terminology)

/** Display mode for a historian note */
export type HistorianNoteDisplay = 'disabled' | 'popout' | 'full';

export interface HistorianNote {
  /** Unique note ID */
  noteId: string;
  /** Exact substring in source text this note anchors to */
  anchorPhrase: string;
  /** The historian's annotation text */
  text: string;
  /** Note type for styling and filtering */
  type: HistorianNoteType;
  /**
   * Display mode:
   * - 'full': rendered inline in Chronicler, included in exports/sampling (default)
   * - 'popout': rendered inline but visually collapsed/minimized in Chronicler
   * - 'disabled': functionally absent from Chronicler, exports, and sampling
   *
   * Legacy notes without this field are treated as 'full'.
   * Notes with `enabled: false` (legacy) are treated as 'disabled'.
   */
  display?: HistorianNoteDisplay;
  /** @deprecated Use `display` instead. Kept for backward compat reads. */
  enabled?: boolean;
}

/** Resolve effective display mode, handling legacy `enabled` field */
export function noteDisplay(note: Pick<HistorianNote, 'display' | 'enabled'>): HistorianNoteDisplay {
  if (note.display) return note.display;
  if (note.enabled === false) return 'disabled';
  return 'full';
}

/** Whether a note is functionally active (not disabled) */
export function isNoteActive(note: Pick<HistorianNote, 'display' | 'enabled'>): boolean {
  return noteDisplay(note) !== 'disabled';
}

// =============================================================================
// Historian Configuration (project-level persona definition)
// =============================================================================

export interface HistorianConfig {
  /** Historian's name and title (e.g., "Aldric Fenworth, Third Archivist of the Pale Library") */
  name: string;
  /** Background, credentials, institutional affiliation, era they're writing from */
  background: string;
  /** Personality traits (e.g., "world-weary", "quietly compassionate", "resigned to repetition") */
  personalityTraits: string[];
  /** Known biases or blind spots (e.g., "distrusts nightshelf accounts", "overvalues written sources") */
  biases: string[];
  /** Relationship to the source material (e.g., "has outlived most of the people described here", "exhausted custodian of difficult truths") */
  stance: string;
  /** Things the historian knows that aren't in the canon facts */
  privateFacts: string[];
  /** Recurring preoccupations, refrains, or motifs to weave in */
  runningGags: string[];
}

export const DEFAULT_HISTORIAN_CONFIG: HistorianConfig = {
  name: '',
  background: '',
  personalityTraits: [],
  biases: [],
  stance: '',
  privateFacts: [],
  runningGags: [],
};

/** Check whether a historian config has been meaningfully configured */
export function isHistorianConfigured(config: HistorianConfig): boolean {
  return config.name.trim().length > 0 && config.background.trim().length > 0;
}

// =============================================================================
// Historian Run (IndexedDB record for review workflow)
// =============================================================================

export type HistorianTargetType = 'entity' | 'chronicle';

export type HistorianRunStatus =
  | 'pending'
  | 'generating'
  | 'reviewing'    // Notes generated, user reviewing
  | 'complete'
  | 'cancelled'
  | 'failed';

export interface HistorianRun {
  runId: string;
  projectId: string;
  simulationRunId: string;
  status: HistorianRunStatus;
  error?: string;

  /** Tone used for this review */
  tone: HistorianTone;

  /** What kind of content is being annotated */
  targetType: HistorianTargetType;
  /** Entity ID or chronicle ID */
  targetId: string;
  /** Display name of the target */
  targetName: string;

  /** The source text that was annotated */
  sourceText: string;
  /** Generated notes (populated by worker) */
  notes: HistorianNote[];
  /** Per-note accept/reject decisions (noteId → boolean) */
  noteDecisions: Record<string, boolean>;

  /** Serialized context: entity/chronicle metadata + neighbor summaries */
  contextJson: string;
  /** Serialized sample of the historian's prior annotations (for voice continuity) */
  previousNotesJson: string;
  /** Serialized historian config (persona definition) */
  historianConfigJson: string;

  // Cost tracking
  inputTokens: number;
  outputTokens: number;
  actualCost: number;

  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// LLM Response Shape
// =============================================================================

export interface HistorianLLMResponse {
  notes: Array<{
    anchorPhrase: string;
    text: string;
    type: HistorianNoteType;
  }>;
}
