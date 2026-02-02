/**
 * Entity Kind Types
 *
 * Defines the structure and constraints for entity types in a world.
 */

import type { Polarity } from './relationship.js';

// =============================================================================
// Entity Categories
// =============================================================================

/**
 * Abstract entity categories that narrative styles use.
 * These are domain-agnostic concepts that domains map their entity kinds to.
 *
 * Framework categories (1-1 mapping with framework kinds):
 * - era: Temporal periods (maps to framework kind 'era')
 * - event: Occurrences/happenings (maps to framework kind 'occurrence')
 *
 * Domain categories:
 * - character: Individual sentient beings (e.g., npc, hero, citizen)
 * - collective: Groups of entities (e.g., faction, guild, kingdom)
 * - place: Locations (e.g., city, region, settlement)
 * - object: Physical items/artifacts (e.g., relic, weapon, document)
 * - concept: Abstract things (e.g., law, tradition, ideology)
 * - power: Abilities, magic, technology (e.g., spell, skill, tech)
 */
export type EntityCategory =
  | 'character'
  | 'collective'
  | 'place'
  | 'object'
  | 'concept'
  | 'power'
  | 'era'
  | 'event';

/**
 * All available entity categories with their descriptions.
 * Used for UI display and documentation.
 */
export const ENTITY_CATEGORIES: Record<EntityCategory, { name: string; description: string }> = {
  // Framework categories (1-1 mapping)
  era: {
    name: 'Era',
    description: 'Temporal periods and ages (framework kind)',
  },
  event: {
    name: 'Event',
    description: 'Occurrences and happenings (framework kind)',
  },
  // Domain categories
  character: {
    name: 'Character',
    description: 'Individual sentient beings (e.g., NPCs, heroes, citizens)',
  },
  collective: {
    name: 'Collective',
    description: 'Groups of entities (e.g., factions, guilds, kingdoms)',
  },
  place: {
    name: 'Place',
    description: 'Locations and geographical features (e.g., cities, regions)',
  },
  object: {
    name: 'Object',
    description: 'Physical items and artifacts (e.g., relics, weapons, documents)',
  },
  concept: {
    name: 'Concept',
    description: 'Abstract things (e.g., laws, traditions, ideologies)',
  },
  power: {
    name: 'Power',
    description: 'Abilities, magic, and technology (e.g., spells, skills)',
  },
};

/**
 * A subtype within an entity kind (e.g., "merchant" for NPC kind)
 */
export interface Subtype {
  id: string;
  name: string;
  /**
   * If true, this subtype represents an authority/leadership position.
   * Used by the narrative system to detect succession and power vacuum events.
   */
  isAuthority?: boolean;
}

/**
 * A status value for an entity kind (e.g., "alive", "dead" for NPC)
 */
export interface Status {
  id: string;
  name: string;
  /** If true, entities with this status are considered "ended" and won't be modified */
  isTerminal: boolean;
  /**
   * Narrative polarity of this status.
   * Used by the narrative system to detect triumphs vs downfalls.
   * - positive: crowned, promoted, victorious
   * - neutral: active, idle, traveling
   * - negative: exiled, imprisoned, dying
   */
  polarity?: Polarity;
  /**
   * Verb describing transition to this status.
   * Used by the narrative system for natural language descriptions.
   * Example: "was crowned", "was exiled", "ascended to"
   */
  transitionVerb?: string;
}

/**
 * Required relationship rule for structural validation
 */
export interface RequiredRelationshipRule {
  /** Relationship kind that must exist */
  kind: string;
  /** Human-readable description of why this is required */
  description?: string;
}

/**
 * A semantic axis reference points to a registered axis definition
 */
export interface SemanticAxis {
  /** Reference to axisDefinitions[].id */
  axisId: string;
}

/**
 * Circle-shaped region bounds
 */
export interface CircleBounds {
  shape: 'circle';
  center: { x: number; y: number };
  radius: number;
}

/**
 * Rectangle-shaped region bounds
 */
export interface RectBounds {
  shape: 'rect';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Polygon-shaped region bounds
 */
export interface PolygonBounds {
  shape: 'polygon';
  points: Array<{ x: number; y: number }>;
}

/**
 * Union type for all region bound shapes
 */
export type RegionBounds = CircleBounds | RectBounds | PolygonBounds;

/**
 * A region within a semantic plane
 */
export interface SemanticRegion {
  id: string;
  label: string;
  /** Display color (hex string, optional) */
  color?: string;
  /** Culture that "owns" this region (optional) */
  culture?: string | null;
  /** Tags to apply to entities placed in this region */
  tags?: string[];
  /** Narrative description (optional) */
  description?: string;
  /** Optional z-range constraint */
  zRange?: { min: number; max: number };
  /** Parent region (for nested regions like city within planet) */
  parentRegion?: string;
  /** Whether this region was created dynamically */
  emergent?: boolean;
  /** Tick when region was created (for emergent regions) */
  createdAt?: number;
  /** Entity that triggered creation (for emergent regions) */
  createdBy?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  bounds: RegionBounds;
}

/**
 * A semantic plane is a 3D conceptual space for placing entities of a kind
 */
export interface SemanticPlane {
  axes: {
    x?: SemanticAxis;
    y?: SemanticAxis;
    z?: SemanticAxis;
  };
  regions: SemanticRegion[];
}

/**
 * Visual styling for an entity kind
 */
export interface EntityKindStyle {
  /** Hex color for visualization */
  color?: string;
  /** Shape for graph visualization (e.g., 'ellipse', 'diamond', 'hexagon') */
  shape?: string;
  /** Display name for UI (defaults to description/kind) */
  displayName?: string;
}

/**
 * Complete definition of an entity kind
 */
export interface EntityKindDefinition {
  /** Unique identifier (e.g., "npc", "location", "faction") */
  kind: string;
  /** Human-readable description (used as display name) */
  description?: string;
  /** True if this kind is defined by the framework and is read-only in editors */
  isFramework?: boolean;
  /**
   * Abstract category this entity kind belongs to.
   * Used by narrative styles to specify subject kinds in a domain-agnostic way.
   * Framework kinds have 1-1 category mappings (era → era, occurrence → event).
   */
  category?: EntityCategory;
  /** Valid subtypes for this entity kind */
  subtypes: Subtype[];
  /** Valid status values for this entity kind */
  statuses: Status[];
  /** Relationships required for this entity kind to be structurally valid */
  requiredRelationships?: RequiredRelationshipRule[];
  /** Default status for new entities of this kind */
  defaultStatus?: string;
  /** Visual styling for UI */
  style?: EntityKindStyle;
  /** Semantic placement configuration (Cosmographer) */
  semanticPlane?: SemanticPlane;

  // === Illuminator: Visual Identity ===
  /**
   * Which visual identity keys from culture.visualIdentity to include in image prompts.
   * e.g., ["ATTIRE", "SPECIES"] for NPCs, ["ARCHITECTURE", "SPECIES"] for locations.
   */
  visualIdentityKeys?: string[];
}
