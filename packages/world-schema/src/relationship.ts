/**
 * Relationship Kind Types
 *
 * Defines the types of relationships that can exist between entities.
 */

/**
 * Polarity indicates the nature of a relationship or status for narrative purposes.
 * - positive: cooperative, beneficial (allies, friends, promoted)
 * - neutral: neither beneficial nor harmful (trades_with, knows)
 * - negative: hostile, harmful (rivals, enemies, exiled)
 */
export type Polarity = 'positive' | 'neutral' | 'negative';

/**
 * Definition of a relationship kind
 */
/**
 * Narrative verbs for describing a relationship in natural language.
 */
export interface RelationshipVerbs {
  /** Verb for when this relationship is formed (e.g., "joined", "allied with") */
  formed: string;
  /** Verb for when this relationship ends (e.g., "left", "broke alliance with") */
  ended: string;
  /** Verb for destination entity when relationship is formed (e.g., "gained as member") */
  inverseFormed: string;
  /** Verb for destination entity when relationship ends (e.g., "lost as member") */
  inverseEnded: string;
}

export interface RelationshipKindDefinition {
  /** Unique identifier (e.g., "member_of", "controls") */
  kind: string;
  /** Display name (e.g., "Member Of", "Controls") */
  name: string;
  /** Human-readable description */
  description: string;
  /** True if this relationship is defined by the framework and is read-only in editors */
  isFramework: boolean;
  /** Entity kinds that can be the source of this relationship */
  srcKinds: string[];
  /** Entity kinds that can be the destination of this relationship */
  dstKinds: string[];
  /** If true, A→B implies B→A */
  symmetric: boolean;
  /** Category for grouping (e.g., "social", "political", "economic") */
  category: string;
  /** If false, this relationship is immutable (used by simulation) */
  cullable: boolean;
  /** Decay rate used by simulation systems */
  decayRate: 'none' | 'slow' | 'medium' | 'fast';
  /**
   * Narrative polarity of this relationship kind.
   * Used by the narrative system to detect betrayals, alliances, rivalries.
   */
  polarity: Polarity;

  /**
   * Narrative verbs for describing this relationship in natural language.
   * Used by the narrative system to generate human-readable effect descriptions.
   */
  verbs: RelationshipVerbs;
}
