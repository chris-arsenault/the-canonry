/**
 * Cosmographer Type Definitions
 *
 * Types for input specifications, output formats, and internal structures.
 */

// ============================================================================
// DOMAIN CLASSIFICATION
// ============================================================================

/**
 * Top-level domain classification.
 * Determines which category ontologies are relevant for analysis.
 */
export type DomainClass =
  | 'spatial'      // Physical, geographic planes (surface, underground, etc.)
  | 'metaphysical' // Spirit, energy, dimensional planes (ethereal, astral, etc.)
  | 'conceptual'   // Abstract system planes (law, magic, social, etc.)
  | 'hybrid';      // Mixed spatial + conceptual

/**
 * Semantic category identifier.
 * Categories group planes with similar semantic properties.
 */
/** Semantic category identifier - categories group planes with similar semantic properties. */
// eslint-disable-next-line sonarjs/redundant-type-aliases -- CategoryId provides domain semantics distinct from bare string
export type CategoryId = string;

// ============================================================================
// ONTOLOGY TYPES
// ============================================================================

/**
 * Category definition with semantic and hierarchical properties.
 * Categories define how planes relate to each other.
 */
export interface CategoryDefinition {
  /** Unique identifier for this category */
  id: CategoryId;

  /** Which domain class this category belongs to */
  domainClass: DomainClass;

  /** Human-readable label */
  label: string;

  /** Description of what this category represents */
  description: string;

  /** Keywords that trigger classification to this category */
  keywords: string[];

  /** Alternative spellings/synonyms for fuzzy matching */
  synonyms?: string[];

  // Hierarchy properties
  /** Base priority (lower = fills first, 1 = primary) */
  basePriority: number;

  /** Default saturation threshold (0.0 - 1.0) */
  defaultSaturation: number;

  // Relationship constraints
  /** Categories that typically contain this one */
  typicalParents: CategoryId[];

  /** Categories this one typically contains */
  typicalChildren: CategoryId[];

  /** Categories that cannot be siblings with this one */
  incompatibleWith: CategoryId[];

  // Generation hints
  /** How "easy" to reach (affects cross-plane distances) */
  accessibilityWeight: number;

  /** Relative capacity (affects saturation calculations) */
  capacityMultiplier: number;
}

/**
 * Relationship between categories defining valid containment.
 */
export interface CategoryRelationship {
  /** Parent category */
  parent: CategoryId;

  /** Valid child categories */
  validChildren: CategoryId[];

  /** Distance multiplier for this parent-child relationship */
  distanceMultiplier?: number;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Hints that override automatic classification.
 */
export interface PlaneHints {
  /** Force this plane as primary (fills first) */
  isPrimary?: boolean;

  /** Override automatic category classification */
  category?: CategoryId;

  /** Explicit cascade targets (children) */
  cascadeTo?: string[];

  /** Planes this should never cascade to */
  neverCascadeTo?: string[];

  /** Custom saturation threshold override */
  saturationThreshold?: number;

  /** Custom priority override */
  priority?: number;
}

/**
 * Single plane specification from domain input.
 */
export interface PlaneSpecification {
  /** Unique identifier for this plane */
  id: string;

  /** Human-readable label */
  label: string;

  /** Description (used for semantic analysis) */
  description?: string;

  /** Optional hints to guide/override generation */
  hints?: PlaneHints;
}

/**
 * Distance hint between two planes.
 */
export interface DistanceHint {
  /** Source plane */
  from: string;

  /** Target plane */
  to: string;

  /** Hint type or explicit numeric value */
  hint: 'adjacent' | 'near' | 'moderate' | 'difficult' | 'very_difficult' | 'extreme' | number;
}

/**
 * Custom category definition from domain.
 * Allows domains to extend the ontology.
 */
export interface CustomCategoryDefinition extends Omit<CategoryDefinition, 'domainClass'> {
  /** Inherit from an existing category (optional) */
  extends?: CategoryId;
}

/**
 * Complete input specification for manifold generation.
 */
export interface CosmographerInput {
  /** Unique identifier for this domain */
  domainId: string;

  /** Type of space being mapped */
  spaceType: DomainClass;

  /** Plane specifications */
  planes: PlaneSpecification[];

  /** Optional distance hints */
  distanceHints?: DistanceHint[];

  /** Optional custom category definitions */
  customCategories?: CustomCategoryDefinition[];

  /** Generation options */
  options?: GenerationOptions;
}

/**
 * Options controlling generation behavior.
 */
export interface GenerationOptions {
  /** Strategy weights (must sum to 1.0) */
  weights?: {
    /** Weight for semantic pattern matching */
    semantic: number;
    /** Weight for embedding similarity */
    embedding: number;
    /** Weight for distance graph analysis */
    distance: number;
  };

  /** Saturation strategy for the output */
  saturationStrategy?: 'density' | 'count' | 'failures';

  /** Default density threshold */
  densityThreshold?: number;

  /** Include detailed classification metadata */
  includeMetadata?: boolean;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/**
 * Generated plane hierarchy entry.
 * Matches lore-weave's PlaneHierarchy type.
 */
export interface GeneratedPlaneHierarchy {
  /** Plane identifier */
  planeId: string;

  /** Child planes (cascade targets) */
  children: string[];

  /** Saturation threshold (0.0 - 1.0) */
  saturationThreshold: number;

  /** Fill priority (1 = first) */
  priority: number;
}

/**
 * Generated axis weights.
 * Matches lore-weave's AxisWeights type.
 */
export interface GeneratedAxisWeights {
  plane: number;
  sector_x: number;
  sector_y: number;
  cell_x: number;
  cell_y: number;
  z_band: number;
}

/**
 * Classification metadata for a single plane.
 */
export interface PlaneClassification {
  /** Assigned category */
  category: CategoryId;

  /** Classification confidence (0.0 - 1.0) */
  confidence: number;

  /** Keywords that matched */
  matchedPatterns: string[];

  /** Embedding similarity score (if used) */
  embeddingSimilarity?: number;

  /** All candidate categories considered */
  candidates?: Array<{
    category: CategoryId;
    score: number;
  }>;
}

/**
 * Complete output from manifold generation.
 */
export interface CosmographerOutput {
  /** Domain identifier (from input) */
  domainId: string;

  /** Generation timestamp */
  generatedAt: string;

  /** Generator version */
  generator: string;

  /** Generated plane hierarchy */
  planeHierarchy: GeneratedPlaneHierarchy[];

  /** Generated axis weights */
  defaultAxisWeights: GeneratedAxisWeights;

  /** Cross-plane distance matrix */
  crossPlaneDistances: Record<string, Record<string, number>>;

  /** Saturation strategy */
  saturationStrategy: 'density' | 'count' | 'failures';

  /** Density threshold (if strategy is 'density') */
  densityThreshold?: number;

  /** Classification metadata (if includeMetadata was true) */
  classifications?: Record<string, PlaneClassification>;
}

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

/**
 * Result of semantic analysis for a plane.
 */
export interface SemanticAnalysisResult {
  planeId: string;
  scores: Map<CategoryId, number>;
  bestMatch: CategoryId;
  confidence: number;
}

/**
 * Graph node for distance analysis.
 */
export interface PlaneNode {
  id: string;
  category: CategoryId;
  priority: number;
  neighbors: Map<string, number>; // planeId -> distance
}

/**
 * Result of graph analysis.
 */
export interface GraphAnalysisResult {
  nodes: Map<string, PlaneNode>;
  centralPlane: string;
  traversalOrder: string[];
}
