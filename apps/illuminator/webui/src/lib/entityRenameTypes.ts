/**
 * Entity Rename - Shared types
 *
 * All types and interfaces used across the entity rename subsystem.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** How closely related this match source is to the entity being renamed. */
export type MatchTier = "self" | "related" | "cast" | "participant" | "mention" | "general";

export type MatchSourceType = "entity" | "chronicle" | "event";

export interface RenameMatch {
  /** Unique match ID */
  id: string;
  /** Where the match was found */
  sourceType: MatchSourceType;
  /** Entity ID, chronicle ID, or event ID */
  sourceId: string;
  /** Entity name, chronicle title, or event description snippet (for display) */
  sourceName: string;
  /** Which field contains the match */
  field: string;
  /** full = complete name, partial = sub-sequence, metadata = denormalized field, id_slug = entity ID reference */
  matchType: "full" | "partial" | "metadata" | "id_slug";
  /** The original text span that matched */
  matchedText: string;
  /** Character offset in the field's text */
  position: number;
  /** ~60 chars before the match */
  contextBefore: string;
  /** ~60 chars after the match */
  contextAfter: string;
  /** Which name fragment matched (for partial matches) */
  partialFragment?: string;
  /** Relationship tier: how the source relates to the entity being renamed */
  tier: MatchTier;
}

export interface MatchDecision {
  matchId: string;
  action: "accept" | "reject" | "edit";
  /** Custom replacement text (only for 'edit') */
  editText?: string;
}

export interface RenameScanResult {
  entityId: string;
  oldName: string;
  matches: RenameMatch[];
}

export interface EntityPatch {
  entityId: string;
  changes: Record<string, string>;
}

export interface ChroniclePatch {
  chronicleId: string;
  /** Map of field name -> new full field value */
  fieldUpdates: Record<string, unknown>;
}

export interface EventPatch {
  eventId: string;
  changes: Record<string, string>;
}

export interface RenamePatches {
  entityPatches: EntityPatch[];
  chroniclePatches: ChroniclePatch[];
  eventPatches: EventPatch[];
}

export interface FieldReplacement {
  position: number;
  originalLength: number;
  replacement: string;
}

export interface AdjustedReplacement {
  position: number;
  originalLength: number;
  replacement: string;
}

// ---------------------------------------------------------------------------
// Entity / event data shapes
// ---------------------------------------------------------------------------

export interface ScanEntityEnrichment {
  descriptionHistory?: Array<{
    description: string;
    replacedAt: number;
    source: string;
  }>;
  slugAliases?: string[];
}

export interface ScanEntity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  summary?: string;
  description?: string;
  narrativeHint?: string;
  enrichment?: ScanEntityEnrichment;
}

/** Text fields on ScanEntity that can be renamed via text replacement */
export type ScanEntityTextField = "summary" | "description" | "narrativeHint";

export interface ScanNarrativeEvent {
  id: string;
  subject: { id: string; name: string };
  action: string;
  description: string;
  participantEffects: Array<{
    entity: { id: string; name: string };
    effects: Array<{
      description: string;
      relatedEntity?: { id: string; name: string };
    }>;
  }>;
}

export interface ScanRelationship {
  kind: string;
  src: string;
  dst: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Internal patch accumulator types (used by patch building + application)
// ---------------------------------------------------------------------------

/** A pending role-assignment name update keyed by array index */
export interface RoleAssignmentUpdate {
  index: number;
  entityName: string;
}

/** A pending entity-directive name update keyed by array index */
export interface DirectiveUpdate {
  index: number;
  entityName: string;
}

/**
 * Accumulated chronicle-level metadata changes before they get merged into
 * the final ChroniclePatch.fieldUpdates object.
 */
export interface ChronicleMetadataUpdates {
  roleAssignmentUpdates?: RoleAssignmentUpdate[];
  lensNameUpdate?: string;
  directiveUpdates?: DirectiveUpdate[];
}

/** Map value for entity / event patch accumulators (serialised replacement lists) */
export type SerializedPatchFields = Record<string, string>;

/** Map value for chronicle patch accumulators (replacement lists stored as arrays) */
export interface ChroniclePatchFields extends ChronicleMetadataUpdates {
  [key: string]: FieldReplacement[] | RoleAssignmentUpdate[] | DirectiveUpdate[] | string | undefined;
}

/** Mutable clone of a narrative event for in-place patching */
export interface MutableNarrativeEvent {
  subject: ScanNarrativeEvent["subject"];
  description: string;
  action: string;
  participantEffects: Array<{
    entity: { id: string; name: string };
    effects: Array<{
      description: string;
      relatedEntity?: { id: string; name: string };
    }>;
  }>;
}

export type NarrativeEffect = ScanNarrativeEvent["participantEffects"][number]["effects"][number];
export type ParticipantEffect = ScanNarrativeEvent["participantEffects"][number];
