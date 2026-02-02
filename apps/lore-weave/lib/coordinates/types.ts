/**
 * Coordinate System Types
 *
 * Types for the region-based coordinate system and semantic axis encoding.
 */

import type {
  CircleBounds,
  RectBounds,
  PolygonBounds,
  RegionBounds,
  SemanticRegion,
} from '@canonry/world-schema';

export type {
  CircleBounds,
  RectBounds,
  PolygonBounds,
  RegionBounds,
  SemanticRegion,
} from '@canonry/world-schema';

/**
 *
 * =============================================================================
 * CRITICAL CONCEPT: SEMANTIC PLANES ARE PER-ENTITY-KIND
 * =============================================================================
 *
 * Each entity kind (npc, location, faction, ability, rule, etc.) has its own
 * INDEPENDENT semantic plane. Coordinates represent SEMANTIC SIMILARITY within
 * that kind, NOT physical/spatial location.
 *
 * For example:
 * - Two NPCs close together on the NPC plane are semantically similar
 *   (similar roles, traits, cultural background)
 * - Two locations close together on the location plane are semantically similar
 *   (similar terrain types, strategic importance, resources)
 *
 * CROSS-KIND COORDINATES ARE MEANINGLESS:
 * - An NPC's coordinates have NO relationship to a location's coordinates
 * - Placing an NPC "near" a location is NONSENSICAL - they exist on different planes
 * - The x,y values between different entity kinds cannot be compared
 *
 * CORRECT USAGE:
 * - near_entity placement: Reference entity MUST be the same kind as the new entity
 * - Relationships with semantic distance (derived_from, splinter_of, etc.) should be
 *   same-kind since distance is computed from coordinates on the semantic plane
 *
 * Key concepts:
 * - EntityKindMap: A 2D coordinate space for a single entity kind
 * - Region: A named area within a kind's map with narrative meaning
 * - Point: Simple {x, y, z?} coordinate within a kind's map
 * - Semantic axes come from canonry axisDefinitions and semanticPlane axes
 */

// ============================================================================
// CORE COORDINATE TYPE
// ============================================================================

/**
 * Simple 3D coordinate. Framework only does math on these.
 */
export interface Point {
  x: number;  // 0-100 normalized
  y: number;  // 0-100 normalized
  z: number;  // 0-100 normalized (depth/layer/power level)
}

/**
 * Default coordinate space bounds.
 */
export const SPACE_BOUNDS = {
  min: 0,
  max: 100
};

// ============================================================================
// REGION DEFINITIONS
// ============================================================================

/**
 * Shape types for region boundaries.
 */
export type RegionShape = RegionBounds['shape'];

/**
 * A named region in coordinate space.
 * Matches the canonical semantic region structure.
 */
export type Region = SemanticRegion;

// ============================================================================
// REGION REGISTRY
// ============================================================================

/**
 * Result of emergent region creation.
 */
export interface EmergentRegionResult {
  success: boolean;
  region?: Region;
  failureReason?: string;
}

/**
 * Result of finding a sparse area on a semantic plane.
 */
export interface SparseAreaResult {
  success: boolean;
  coordinates?: Point;
  /** Minimum distance to nearest entity (score of how "sparse" the area is) */
  minDistanceToEntity?: number;
  failureReason?: string;
}

/**
 * Options for finding a sparse area.
 */
export interface SparseAreaOptions {
  /** Minimum required distance from any existing entity (default: 15) */
  minDistanceFromEntities: number;
  /** Bias toward plane edges/periphery (default: false) */
  preferPeriphery: boolean;
  /** Maximum sampling attempts (default: 50) */
  maxAttempts?: number;
  /** Existing entity positions to avoid */
  existingPositions: Point[];
}

/**
 * Result of region lookup.
 */
export interface RegionLookupResult {
  /** Primary region containing the point */
  primary: Region | null;

  /** All regions containing the point (for overlaps) */
  all: Region[];

  /** Nearest region if not in any */
  nearest?: {
    region: Region;
    distance: number;
  };
}

