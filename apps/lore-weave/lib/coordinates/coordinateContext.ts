/**
 * Coordinate Context
 *
 * Centralized coordinate services with culture as first-class input.
 * Works directly with canonry's entityKinds[] and cultures[] arrays.
 */

import type { Point, Region } from './types';
import type { EntityTags } from '../core/worldTypes';
import { FRAMEWORK_SUBTYPES } from '@canonry/world-schema';
import type {
  AxisBias,
  AxisDefinition,
  CanonrySchemaSlice,
  CultureDefinition,
  EntityKindDefinition,
  SemanticPlane,
} from '@canonry/world-schema';

/**
 * Name generation service interface.
 * Matches NameGenerationService from engine/types.ts to avoid circular imports.
 */
interface NameGenerationService {
  generate(
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    culture: string,
    context?: Record<string, string>
  ): Promise<string>;
}

// =============================================================================
// CULTURE CONFIGURATION TYPES
// =============================================================================

/**
 * Axis biases for a single entity kind.
 */
export type KindAxisBiases = AxisBias;

/**
 * Context passed to placement operations.
 * Culture data flows through this object to bias sampling and encoding.
 */
export interface PlacementContext {
  /** Culture driving placement biases */
  cultureId?: string;

  /** Entity kind being placed (needed to look up kind-specific biases/regions) */
  entityKind?: string;

  /** Culture's axis biases for this entity kind */
  axisBiases?: KindAxisBiases;

  /** Region IDs to bias placement toward (derived from regions with matching culture) */
  seedRegionIds?: string[];

  /** Reference entity for proximity-based placement */
  referenceEntity?: {
    id: string;
    coordinates: Point;
  };

  /** Whether to allow emergent region creation when seed regions are at capacity (default: true) */
  allowEmergent?: boolean;

  /** When true, placement must stay within seed regions (skip unconstrained near-reference sampling) */
  stickToRegion?: boolean;

  /** When true, bias region selection toward sparser regions (weighted by inverse entity count) */
  preferSparse?: boolean;
}

/**
 * Result of a culture-aware placement operation.
 */
export interface PlacementResult {
  /** Whether placement succeeded */
  success: boolean;

  /** Placed coordinates (if successful) */
  coordinates?: Point;

  /** Region ID entity was placed in (null if not in any region) */
  regionId?: string | null;

  /** All region IDs containing the point */
  allRegionIds?: string[];

  /** Tags derived from region + axis position */
  derivedTags?: EntityTags;

  /** Culture ID used for placement */
  cultureId?: string;

  /** How the placement was resolved (which strategy succeeded) */
  resolvedVia?: string;

  /** Whether an emergent region was created */
  emergentRegionCreated?: {
    id: string;
    label: string;
  };

  /** Failure reason if unsuccessful */
  failureReason?: string;
}

// =============================================================================
// SEMANTIC PLANE (per entity kind)
// =============================================================================

/**
 * Entity kind definition from canonry.
 * Contains kind and optional semanticPlane.
 */
export type EntityKindConfig = EntityKindDefinition;

/**
 * Culture definition from canonry.
 * Contains id and axisBiases keyed by entity kind.
 */
export type CultureConfig = CultureDefinition;

// =============================================================================
// COORDINATE CONTEXT CONFIGURATION
// =============================================================================

/**
 * Configuration for CoordinateContext.
 * Accepts canonry's array-based format directly.
 */
export interface CoordinateContextConfig {
  /** Canonry schema slice (canonical, no mapping) */
  schema: CanonrySchemaSlice;

  /**
   * Graph density controls minimum distance between entities on semantic planes.
   * Lower values = denser placement (more entities fit in regions)
   * Higher values = sparser placement (entities spread out more)
   * Default: 5 (units on 0-100 normalized coordinate space)
   */
  defaultMinDistance?: number;

  /** Name generation service for emergent region names */
  nameForgeService: NameGenerationService;
}

// =============================================================================
// EMERGENT REGION DEFAULTS
// =============================================================================

const EMERGENT_DEFAULTS = {
  radius: 10,
  minDistanceFromExisting: 5,
  maxAttempts: 50
};

// =============================================================================
// COORDINATE CONTEXT
// =============================================================================

/**
 * CoordinateContext - Centralized coordinate services with culture support.
 *
 * Works directly with canonry's entityKinds[] and cultures[] arrays.
 * Derives seed regions by finding regions where region.culture matches the culture ID.
 * Supports emergent region creation during simulation.
 */
export class CoordinateContext {
  /** Entity kinds from canonry (stored directly, no transformation) */
  private readonly entityKinds: EntityKindConfig[];

  /** Cultures from canonry (stored directly, no transformation) */
  private readonly cultures: CultureConfig[];

  /** Mutable region storage per entity kind (includes both seed and emergent regions) */
  private regions: { [entityKind: string]: Region[] } = {};

  /** Axis definitions indexed by id */
  private readonly axisDefinitions: Map<string, AxisDefinition>;

  /** Counter for generating unique emergent region IDs */
  private emergentRegionCounter = 0;

  /** Default minimum distance between entities on semantic planes */
  private readonly defaultMinDistance: number;

  /** Name generation service for emergent region names */
  private readonly nameForgeService: NameGenerationService;

  // Note: Placement debug info is captured in structured template_application events

  constructor(config: CoordinateContextConfig) {
    const { schema } = config;
    if (!schema) {
      throw new Error('CoordinateContext: schema is required.');
    }

    this.entityKinds = schema.entityKinds;
    this.cultures = schema.cultures;
    this.defaultMinDistance = config.defaultMinDistance ?? 5;
    this.nameForgeService = config.nameForgeService;
    this.axisDefinitions = new Map((schema.axisDefinitions || []).map(axis => [axis.id, axis]));

    if (!this.entityKinds || this.entityKinds.length === 0) {
      throw new Error('CoordinateContext: schema.entityKinds is required.');
    }
    if (!this.cultures || this.cultures.length === 0) {
      throw new Error('CoordinateContext: schema.cultures is required.');
    }

    // Validate semantic plane axis references and region colors
    for (const entityKind of this.entityKinds) {
      const plane = entityKind.semanticPlane;
      if (plane?.axes) {
        const axisRefs = [plane.axes.x, plane.axes.y, plane.axes.z].filter(Boolean) as Array<{ axisId: string }>;
        for (const axisRef of axisRefs) {
          if (!this.axisDefinitions.has(axisRef.axisId)) {
            throw new Error(
              `CoordinateContext: axis "${axisRef.axisId}" referenced by kind "${entityKind.kind}" is not defined.`
            );
          }
        }
      }
      if (plane?.regions) {
        for (const region of plane.regions) {
          if (!region.color) {
            throw new Error(
              `CoordinateContext: region "${region.id}" in kind "${entityKind.kind}" is missing color.`
            );
          }
        }
      }
    }

    // Initialize mutable region storage from entity kinds' semantic planes
    for (const entityKind of this.entityKinds) {
      if (entityKind.semanticPlane?.regions) {
        this.regions[entityKind.kind] = [...entityKind.semanticPlane.regions];
      }
    }
  }

  // ===========================================================================
  // SEMANTIC DATA ACCESS
  // ===========================================================================

  /**
   * Get semantic plane for an entity kind.
   */
  getSemanticPlane(entityKind: string): SemanticPlane | undefined {
    const kind = this.entityKinds.find(k => k.kind === entityKind);
    return kind?.semanticPlane;
  }

  /**
   * Get all configured entity kinds (those with semantic planes).
   */
  getConfiguredKinds(): string[] {
    return this.entityKinds
      .filter(k => k.semanticPlane)
      .map(k => k.kind);
  }

  /**
   * Check if a kind has semantic data configured.
   */
  hasKindMap(kind: string): boolean {
    return this.entityKinds.some(k => k.kind === kind && k.semanticPlane);
  }

  /**
   * Get regions for an entity kind (includes both seed and emergent regions).
   */
  getRegions(entityKind: string): Region[] {
    // Initialize kind if not present
    if (!(entityKind in this.regions)) {
      this.regions[entityKind] = [];
    }
    return this.regions[entityKind];
  }

  /**
   * Get a specific region by ID within an entity kind.
   */
  getRegion(entityKind: string, regionId: string): Region | undefined {
    return this.getRegions(entityKind).find(r => r.id === regionId);
  }

  // ===========================================================================
  // CULTURE QUERIES
  // ===========================================================================

  /**
   * Get culture configuration by ID.
   */
  getCultureConfig(cultureId: string): CultureConfig | undefined {
    return this.cultures.find(c => c.id === cultureId);
  }

  /**
   * Check if a culture is configured.
   */
  hasCulture(cultureId: string): boolean {
    return this.cultures.some(c => c.id === cultureId);
  }

  /**
   * Get all configured culture IDs.
   */
  getCultureIds(): string[] {
    return this.cultures.map(c => c.id);
  }

  /**
   * Get seed region IDs for a culture within an entity kind.
   * Derived from regions where region.culture === cultureId.
   */
  getSeedRegionIds(cultureId: string, entityKind: string): string[] {
    const regions = this.getRegions(entityKind);
    const matching = regions.filter(r => r.culture === cultureId);

    return matching.map(r => r.id);
  }

  /**
   * Get axis biases for a culture and entity kind.
   */
  getAxisBiases(cultureId: string, entityKind: string): KindAxisBiases | undefined {
    const culture = this.cultures.find(c => c.id === cultureId);
    return culture?.axisBiases?.[entityKind];
  }

  /**
   * Build PlacementContext from culture ID and entity kind.
   */
  buildPlacementContext(cultureId: string, entityKind: string): PlacementContext {
    return {
      cultureId,
      entityKind,
      axisBiases: this.getAxisBiases(cultureId, entityKind),
      seedRegionIds: this.getSeedRegionIds(cultureId, entityKind)
    };
  }

  // ===========================================================================
  // EMERGENT REGION CREATION
  // ===========================================================================

  /**
   * Create an emergent region near a point.
   *
   * Uses static defaults for radius and minimum distance from existing regions.
   * Always enabled - emergent regions are created whenever placement occurs
   * outside existing regions.
   *
   * @param entityKind - Entity kind for the region
   * @param nearPoint - Point to create region near
   * @param label - Human-readable label for the region
   * @param description - Narrative description
   * @param tick - Current simulation tick
   * @param createdBy - Optional entity ID that triggered creation
   * @returns Result with created region or failure reason
   */
  createEmergentRegion(
    entityKind: string,
    nearPoint: Point,
    label: string,
    description: string,
    tick: number,
    cultureId: string,
    createdBy?: string
  ): import('./types').EmergentRegionResult {
    const regions = this.getRegions(entityKind);
    const culture = this.getCultureConfig(cultureId);
    if (!culture || !culture.color) {
      throw new Error(
        `CoordinateContext: culture "${cultureId}" is missing color for emergent region "${label}".`
      );
    }

    // Check if point is too close to existing regions
    for (const region of regions) {
      if (region.bounds.shape === 'circle') {
        const { center, radius } = region.bounds;
        const dx = nearPoint.x - center.x;
        const dy = nearPoint.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Too close if within region or within min distance of edge
        if (distance < radius + EMERGENT_DEFAULTS.minDistanceFromExisting) {
          return {
            success: false,
            failureReason: `Point too close to existing region "${region.label}"`
          };
        }
      }
    }

    // Create the emergent region
    this.emergentRegionCounter++;
    const regionId = `emergent_${entityKind}_${this.emergentRegionCounter}`;

    const newRegion: Region = {
      id: regionId,
      label,
      color: culture.color,
      culture: cultureId,
      description,
      bounds: {
        shape: 'circle',
        center: { x: nearPoint.x, y: nearPoint.y },
        radius: EMERGENT_DEFAULTS.radius
      },
      emergent: true,
      createdAt: tick,
      createdBy
    };

    // Add to mutable region storage
    regions.push(newRegion);

    return {
      success: true,
      region: newRegion
    };
  }

  /**
   * Check if a point is inside any existing region for an entity kind.
   */
  isPointInAnyRegion(entityKind: string, point: Point): boolean {
    const regions = this.getRegions(entityKind);
    return regions.some(r => this.pointInRegion(point, r));
  }

  // ===========================================================================
  // REGION SAMPLING
  // ===========================================================================

  /**
   * Sample a point within a specific region.
   * Uses defaultMinDistance as the minimum distance between points.
   *
   * @param entityKind - Entity kind whose regions to use
   * @param regionId - Region to sample within
   * @param existingPoints - Points to avoid
   * @returns Point or null if no valid point found
   */
  sampleInRegion(
    entityKind: string,
    regionId: string,
    existingPoints: Point[] = []
  ): Point | null {
    const region = this.getRegion(entityKind, regionId);
    if (!region) return null;
    return this.sampleCircleRegion(region, existingPoints);
  }

  /**
   * Sample a point near a reference point.
   * Uses defaultMinDistance as the minimum distance between points.
   *
   * @param referencePoint - Point to place near
   * @param existingPoints - Points to avoid
   * @param maxSearchRadius - Maximum distance from reference (defaults to 4x defaultMinDistance)
   * @returns Point or null if no valid point found
   */
  sampleNearPoint(
    referencePoint: Point,
    existingPoints: Point[] = [],
    maxSearchRadius?: number
  ): Point | null {
    const maxAttempts = 50;
    const minDist = this.defaultMinDistance;
    const maxRadius = maxSearchRadius ?? minDist * 4;

    for (let i = 0; i < maxAttempts; i++) {
      // Sample in a ring around the reference point
      const r = minDist + Math.random() * (maxRadius - minDist);
      const theta = Math.random() * 2 * Math.PI;
      const point: Point = {
        x: referencePoint.x + r * Math.cos(theta),
        y: referencePoint.y + r * Math.sin(theta),
        z: referencePoint.z
      };

      // Clamp to bounds
      point.x = Math.max(0, Math.min(100, point.x));
      point.y = Math.max(0, Math.min(100, point.y));

      if (this.isValidPlacement(point, existingPoints, minDist)) {
        return point;
      }
    }
    return null;
  }

  // ===========================================================================
  // SPARSE AREA PLACEMENT
  // ===========================================================================

  /**
   * Find a sparse (unoccupied) area on the semantic plane.
   *
   * This is used for templates that need to place entities far from existing
   * same-kind entities, like colony founding where new colonies should spread
   * across the plane rather than cluster.
   *
   * @param options - Configuration for sparse area search
   * @returns Result with coordinates of the sparsest valid area found
   */
  findSparseArea(
    options: import('./types').SparseAreaOptions
  ): import('./types').SparseAreaResult {
    const { existingPositions, minDistanceFromEntities, preferPeriphery, maxAttempts = 50 } = options;

    // If no existing positions, any point is valid
    if (existingPositions.length === 0) {
      const point = preferPeriphery
        ? this.generatePeripheryBiasedPoint()
        : { x: Math.random() * 100, y: Math.random() * 100, z: 50 };
      return {
        success: true,
        coordinates: point,
        minDistanceToEntity: 100 // Maximum possible distance
      };
    }

    // Sample candidate points and score them by distance from existing entities
    const candidates: Array<{ point: Point; score: number }> = [];

    for (let i = 0; i < maxAttempts; i++) {
      // Generate candidate point
      const point = preferPeriphery
        ? this.generatePeripheryBiasedPoint()
        : { x: Math.random() * 100, y: Math.random() * 100, z: 50 };

      // Calculate minimum distance to any existing entity
      const minDist = this.calculateMinDistanceToPoints(point, existingPositions);

      // Only consider points that meet minimum distance requirement
      if (minDist >= minDistanceFromEntities) {
        candidates.push({ point, score: minDist });
      }
    }

    if (candidates.length === 0) {
      return {
        success: false,
        failureReason: `No sparse area found after ${maxAttempts} attempts. ` +
          `All sampled points were within ${minDistanceFromEntities} units of existing entities.`
      };
    }

    // Return the point with highest score (furthest from existing entities)
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    return {
      success: true,
      coordinates: best.point,
      minDistanceToEntity: best.score
    };
  }

  /**
   * Generate a point biased toward the periphery of the coordinate space.
   * Samples with bias toward edges, but keeps emergent regions fully in bounds.
   * Valid range is [radius, 100-radius] so the full region circle stays in bounds.
   */
  private generatePeripheryBiasedPoint(): Point {
    const radius = EMERGENT_DEFAULTS.radius;
    const min = radius;        // 10
    const max = 100 - radius;  // 90
    const range = max - min;   // 80
    const mid = min + range / 2; // 50

    // Use inverse transform to bias toward edges of valid range
    // This maps uniform [0,1] to values clustered near min and max
    const biasedSample = (): number => {
      const u = Math.random();
      // Use a U-shaped distribution: values near min and max are more likely
      if (u < 0.5) {
        // Map [0, 0.5] -> [min, mid] with bias toward min
        return min + (range / 2) * Math.pow(u * 2, 2);
      } else {
        // Map [0.5, 1] -> [mid, max] with bias toward max
        return max - (range / 2) * Math.pow((1 - u) * 2, 2);
      }
    };

    return {
      x: biasedSample(),
      y: biasedSample(),
      z: 50
    };
  }

  /**
   * Calculate minimum Euclidean distance from a point to a set of existing points.
   */
  private calculateMinDistanceToPoints(point: Point, existingPoints: Point[]): number {
    if (existingPoints.length === 0) return Infinity;

    let minDist = Infinity;
    for (const existing of existingPoints) {
      const dx = point.x - existing.x;
      const dy = point.y - existing.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    return minDist;
  }

  // ===========================================================================
  // CULTURE-AWARE PLACEMENT
  // ===========================================================================

  /**
   * Sample a point within a region (circle bounds).
   * Uses defaultMinDistance as the minimum distance between points.
   */
  private sampleCircleRegion(
    region: Region,
    existingPoints: Point[]
  ): Point | null {
    if (region.bounds.shape !== 'circle') return null;

    const { center, radius } = region.bounds;
    const maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
      // Sample with slight overshoot (1.1x) to use full region area
      const r = radius * Math.sqrt(Math.random()) * 1.1;
      const theta = Math.random() * 2 * Math.PI;
      const point: Point = {
        x: center.x + r * Math.cos(theta),
        y: center.y + r * Math.sin(theta),
        z: 50 // default z
      };

      if (this.isValidPlacement(point, existingPoints, this.defaultMinDistance)) {
        return point;
      }
    }
    return null;
  }

  /**
   * Sample a point within a circular region, biased toward a reference point.
   * If the reference point is outside the region, samples randomly within the region.
   */
  private sampleCircleRegionNear(
    region: Region,
    referencePoint: Point | undefined,
    existingPoints: Point[]
  ): Point | null {
    if (region.bounds.shape !== 'circle') return null;

    const { center, radius } = region.bounds;
    const maxAttempts = 50;

    // Check if reference point is within or near the region
    const refIsNearby = referencePoint && (() => {
      const dx = referencePoint.x - center.x;
      const dy = referencePoint.y - center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= radius * 1.5; // Within 1.5x radius
    })();

    for (let i = 0; i < maxAttempts; i++) {
      let point: Point;

      if (refIsNearby && referencePoint && i < maxAttempts * 0.7) {
        // First 70% of attempts: sample near reference point but constrain to region
        const searchRadius = Math.min(this.defaultMinDistance * 4, radius * 0.8);
        const r = this.defaultMinDistance + Math.random() * (searchRadius - this.defaultMinDistance);
        const theta = Math.random() * 2 * Math.PI;
        point = {
          x: referencePoint.x + r * Math.cos(theta),
          y: referencePoint.y + r * Math.sin(theta),
          z: referencePoint.z
        };

        // Check if within region bounds
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        if (Math.sqrt(dx * dx + dy * dy) > radius) {
          // Outside region, try again
          continue;
        }
      } else {
        // Last 30% or no reference: random within region
        const r = radius * Math.sqrt(Math.random()) * 1.1;
        const theta = Math.random() * 2 * Math.PI;
        point = {
          x: center.x + r * Math.cos(theta),
          y: center.y + r * Math.sin(theta),
          z: 50
        };
      }

      if (this.isValidPlacement(point, existingPoints, this.defaultMinDistance)) {
        return point;
      }
    }
    return null;
  }

  /**
   * Order regions by weighted random selection, biased toward sparser regions.
   * Weight = 1 / (entityCount + 1), so regions with fewer entities are more likely to be selected first.
   */
  private weightedSparseSelection(
    regions: Region[],
    existingPoints: Point[]
  ): Region[] {
    // Count entities per region
    const regionCounts = new Map<string, number>();
    for (const region of regions) {
      const count = existingPoints.filter(p => this.pointInRegion(p, region)).length;
      regionCounts.set(region.id, count);
    }

    // Weighted shuffle - select all regions in weighted order
    const result: Region[] = [];
    const remaining = [...regions];

    while (remaining.length > 0) {
      // Calculate weights for remaining regions (inverse of count + 1)
      const weights = remaining.map(r => 1 / (regionCounts.get(r.id)! + 1));
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);

      // Weighted random selection
      let random = Math.random() * totalWeight;
      let selectedIndex = 0;

      for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedIndex = i;
          break;
        }
      }

      result.push(remaining[selectedIndex]);
      remaining.splice(selectedIndex, 1);
    }

    return result;
  }

  /**
   * Sample a point using culture-aware placement strategy.
   * Uses defaultMinDistance as the minimum distance between points.
   *
   * Priority order:
   * 1. Near reference entity (if provided in context)
   * 2. Within seed regions (regions belonging to this culture)
   * 3. Near culture's axis biases point (if defined)
   * 4. Create emergent region near bias point (if allowed)
   *
   * @param entityKind - Entity kind for placement
   * @param context - Placement context with culture info and axisBiases
   * @param existingPoints - Existing points to avoid
   * @param tick - Current simulation tick (for emergent region creation)
   * @returns Point and optional emergent region info, or null if placement impossible
   */
  async sampleWithCulture(
    entityKind: string,
    context: PlacementContext,
    existingPoints: Point[] = [],
    tick: number = 0
  ): Promise<{ point: Point; resolvedVia: string; placedInRegion?: Region; emergentRegion?: { id: string; label: string } } | null> {
    // If reference entity provided AND we're not constrained to regions, sample near it
    // When stickToRegion is true, skip this to ensure placement stays within region bounds
    if (context.referenceEntity?.coordinates && !context.stickToRegion) {
      const point = this.sampleNearPoint(
        context.referenceEntity.coordinates,
        existingPoints
      );
      if (point) {
        return { point, resolvedVia: 'near_reference' };
      }
    }

    const regions = this.getRegions(entityKind);

    // Try seed regions first (regions belonging to this culture)
    // If we have a reference entity, bias placement toward it within the region
    if (context.seedRegionIds && context.seedRegionIds.length > 0) {
      const referenceCoords = context.referenceEntity?.coordinates;

      // Get valid regions from seed IDs
      const validRegions = context.seedRegionIds
        .map(id => regions.find(r => r.id === id))
        .filter((r): r is Region => r !== undefined);

      // Order regions - weighted by sparseness or random shuffle
      const orderedRegions = context.preferSparse && validRegions.length > 1
        ? this.weightedSparseSelection(validRegions, existingPoints)
        : [...validRegions].sort(() => Math.random() - 0.5);

      for (const region of orderedRegions) {
        // Use biased sampling if we have a reference point, otherwise random
        const point = this.sampleCircleRegionNear(region, referenceCoords, existingPoints);
        if (point) {
          const via = referenceCoords ? 'seed_region_near_ref' : 'seed_region';
          // Return the region we actually placed in to avoid confusion with overlapping regions
          return { point, resolvedVia: via, placedInRegion: region };
        }
      }
    }

    // Seed regions exhausted or not defined - try sampling near culture's axis biases
    if (context.axisBiases) {
      const biasCenter: Point = {
        x: context.axisBiases.x,
        y: context.axisBiases.y,
        z: context.axisBiases.z
      };
      const point = this.sampleNearPoint(biasCenter, existingPoints);
      if (point) {
        return { point, resolvedVia: 'axis_biases' };
      }
    }

    // Bias sampling failed - try emergent region creation near bias point (if allowed)
    if (context.allowEmergent !== false && context.cultureId) {
      const emergentResult = await this.createEmergentRegionForCulture(
        entityKind,
        context.cultureId,
        existingPoints,
        tick,
        context.axisBiases
      );
      if (emergentResult) {
        return {
          point: emergentResult.point,
          resolvedVia: 'emergent_region',
          emergentRegion: {
            id: emergentResult.region.id,
            label: emergentResult.region.label
          }
        };
      }
    }

    // No culture-aware placement possible - skip
    return null;
  }

  /**
   * Create an emergent region at a specific point with Name Forge generating the label.
   * Uses the culture's naming configuration to generate culturally-appropriate region names.
   *
   * @param entityKind - Entity kind for the region's semantic plane
   * @param point - Coordinates to create the region at
   * @param cultureId - Culture to use for naming
   * @param tick - Current simulation tick
   * @returns Result with created region or failure reason
   */
  async createNamedEmergentRegion(
    entityKind: string,
    point: Point,
    cultureId: string,
    tick: number
  ): Promise<import('./types').EmergentRegionResult> {
    // Generate region name using name-forge with framework 'region' subtype
    const regionLabel = await this.nameForgeService.generate(
      entityKind,
      FRAMEWORK_SUBTYPES.REGION,
      'marginal',  // New territories start as marginal
      [],          // No semantic tags for regions
      cultureId
    );
    const regionDescription = `An emerging ${entityKind} region: ${regionLabel}`;

    // Create emergent region at the location
    const regionResult = this.createEmergentRegion(
      entityKind,
      point,
      regionLabel,
      regionDescription,
      tick,
      cultureId
    );

    return regionResult;
  }

  /**
   * Attempt to create an emergent region for a culture.
   * If axisBiases is provided, places the region near the bias point.
   * Otherwise finds a sparse area on the plane.
   * Uses name-forge to generate culturally-appropriate region names.
   */
  private async createEmergentRegionForCulture(
    entityKind: string,
    cultureId: string,
    existingPoints: Point[],
    tick: number,
    axisBiases?: KindAxisBiases
  ): Promise<{ point: Point; region: Region } | null> {
    let regionCenter: Point | null = null;

    // If culture has axis biases, place emergent region near that point
    if (axisBiases) {
      const biasCenter: Point = {
        x: axisBiases.x,
        y: axisBiases.y,
        z: axisBiases.z
      };
      // Sample near bias with larger radius for region placement
      regionCenter = this.sampleNearPoint(biasCenter, existingPoints, this.defaultMinDistance * 3);
    }

    // If no bias or bias sampling failed, find sparse area
    if (!regionCenter) {
      const sparseResult = this.findSparseArea({
        existingPositions: existingPoints,
        minDistanceFromEntities: this.defaultMinDistance * 2,
        preferPeriphery: true,
        maxAttempts: 30
      });

      if (!sparseResult.success || !sparseResult.coordinates) {
        return null;
      }
      regionCenter = sparseResult.coordinates;
    }

    // Create the region with naming at the determined location
    const regionResult = await this.createNamedEmergentRegion(
      entityKind,
      regionCenter,
      cultureId,
      tick
    );

    if (!regionResult.success || !regionResult.region) {
      return null;
    }

    return {
      point: regionCenter,
      region: regionResult.region
    };
  }

  /**
   * Derive tags from entity placement based on:
   * 1. Region tags - tags associated with the region the entity is placed in
   * 2. Axis tags - tags derived from position on semantic axes (low/high thresholds)
   *
   * @param entityKind - Entity kind to get semantic plane from
   * @param point - Coordinates of the placed entity
   * @param containingRegions - Regions containing the point
   * @returns Array of derived tag strings
   */
  deriveTagsFromPlacement(
    entityKind: string,
    point: Point,
    containingRegions: Region[]
  ): string[] {
    const tags: string[] = [];
    const seenTags = new Set<string>();

    const addTag = (tag: string) => {
      if (tag && !seenTags.has(tag)) {
        seenTags.add(tag);
        tags.push(tag);
      }
    };

    // 1. Add tags from containing regions
    for (const region of containingRegions) {
      if (region.tags) {
        for (const tag of region.tags) {
          addTag(tag);
        }
      }
    }

    // 2. Derive tags from axis positions using gradient-based probability
    // Probability scales linearly: 100% at extremes (0/100), 50% at quarter points (25/75), 0% at center (50)
    const semanticPlane = this.getSemanticPlane(entityKind);

    if (semanticPlane?.axes) {
      const { axes } = semanticPlane;
      const resolveAxis = (axisRef?: { axisId: string }) =>
        axisRef?.axisId ? this.axisDefinitions.get(axisRef.axisId) : undefined;

      /**
       * Calculate tag probability based on distance from center.
       * - At 0 or 100: distance = 50, probability = 100%
       * - At 25 or 75: distance = 25, probability = 50%
       * - At 50: distance = 0, probability = 0%
       */
      const shouldApplyTag = (value: number, isLowTag: boolean): boolean => {
        // Only consider values on the appropriate side of center
        if (isLowTag && value >= 50) return false;
        if (!isLowTag && value <= 50) return false;

        // Calculate probability: distance from center (0-50) mapped to 0-100%
        const distanceFromCenter = Math.abs(value - 50);
        const probability = (distanceFromCenter / 50) * 100;

        // Roll the dice
        return Math.random() * 100 < probability;
      };

      // X axis
      const xAxis = resolveAxis(axes.x);
      if (xAxis) {
        if (xAxis.lowTag && shouldApplyTag(point.x, true)) {
          addTag(xAxis.lowTag);
        } else if (xAxis.highTag && shouldApplyTag(point.x, false)) {
          addTag(xAxis.highTag);
        }
      }

      // Y axis
      const yAxis = resolveAxis(axes.y);
      if (yAxis) {
        if (yAxis.lowTag && shouldApplyTag(point.y, true)) {
          addTag(yAxis.lowTag);
        } else if (yAxis.highTag && shouldApplyTag(point.y, false)) {
          addTag(yAxis.highTag);
        }
      }

      // Z axis
      const zAxis = resolveAxis(axes.z);
      if (zAxis && point.z !== undefined) {
        if (zAxis.lowTag && shouldApplyTag(point.z, true)) {
          addTag(zAxis.lowTag);
        } else if (zAxis.highTag && shouldApplyTag(point.z, false)) {
          addTag(zAxis.highTag);
        }
      }
    }

    return tags;
  }

  /**
   * Place an entity with culture context.
   * Uses defaultMinDistance as the minimum distance between points.
   */
  async placeWithCulture(
    entityKind: string,
    _entityId: string,
    tick: number,
    context: PlacementContext,
    existingPoints: Point[] = []
  ): Promise<PlacementResult> {
    if (!context.cultureId) {
      throw new Error(`CoordinateContext.placeWithCulture requires cultureId for kind "${entityKind}".`);
    }
    const result = await this.sampleWithCulture(entityKind, context, existingPoints, tick);
    if (!result) {
      return {
        success: false,
        failureReason: 'Could not find valid placement point for culture'
      };
    }

    const { point, resolvedVia, placedInRegion, emergentRegion } = result;

    // Find which regions contain this point
    const regions = this.getRegions(entityKind);
    const containingRegions = regions.filter(r => this.pointInRegion(point, r));

    // If we know which region we placed in (seed region case), use that as primary
    // This prevents confusion when regions overlap
    const containingRegion = placedInRegion ?? containingRegions[0];

    // Ensure placedInRegion is included in allRegions for tag derivation
    const allContainingRegions = placedInRegion && !containingRegions.some(r => r.id === placedInRegion.id)
      ? [placedInRegion, ...containingRegions]
      : containingRegions;

    // Derive tags from placement (region tags + axis-based tags)
    // Use the placed region first for proper tag attribution
    const derivedTagList = this.deriveTagsFromPlacement(entityKind, point, allContainingRegions);

    // Build derivedTags object
    const derivedTags: EntityTags = {};
    if (context.cultureId) {
      derivedTags.culture = context.cultureId;
    }
    // Add derived tags as boolean flags
    for (const tag of derivedTagList) {
      derivedTags[tag] = true;
    }

    return {
      success: true,
      coordinates: point,
      regionId: containingRegion?.id ?? null,
      allRegionIds: allContainingRegions.map(r => r.id),
      derivedTags,
      cultureId: context.cultureId,
      resolvedVia,
      emergentRegionCreated: emergentRegion
    };
  }

  /**
   * Check if a point is inside a region.
   */
  private pointInRegion(point: Point, region: Region): boolean {
    if (region.bounds.shape === 'circle') {
      const { center, radius } = region.bounds;
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    }
    return false; // Only circle supported for now
  }

  /**
   * Check if a point maintains minimum distance from existing points.
   */
  private isValidPlacement(
    point: Point,
    existing: Point[],
    minDistance: number
  ): boolean {
    for (const other of existing) {
      const dx = point.x - other.x;
      const dy = point.y - other.y;
      if (Math.sqrt(dx * dx + dy * dy) < minDistance) {
        return false;
      }
    }
    return true;
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export coordinate state for world persistence.
   * Returns emergent regions only (seed regions live in schema).
   */
  export(): {
    emergentRegions: { [entityKind: string]: Region[] };
  } {
    const emergentRegions: { [entityKind: string]: Region[] } = {};

    for (const [kind, regions] of Object.entries(this.regions)) {
      const emergent = regions.filter(r => r.emergent);
      if (emergent.length > 0) {
        emergentRegions[kind] = emergent.map(region => ({ ...region }));
      }
    }

    return {
      emergentRegions
    };
  }

  /**
   * Import coordinate state from a previously exported world.
   * Restores emergent regions.
   */
  import(state: { emergentRegions?: { [entityKind: string]: Region[] } }): void {
    if (state.emergentRegions) {
      for (const [kind, regions] of Object.entries(state.emergentRegions)) {
        const existing = this.getRegions(kind);
        for (const region of regions) {
          if (!existing.some(r => r.id === region.id)) {
            existing.push(region);
          }
        }
      }
      // Update counter based on imported regions
      const maxId = Object.values(this.regions)
        .flat()
        .filter(r => r.emergent)
        .map(r => {
          const match = r.id.match(/emergent_\w+_(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .reduce((max, n) => Math.max(max, n), 0);
      this.emergentRegionCounter = maxId;
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get statistics about coordinate system state.
   */
  getStats(): {
    cultures: number;
    kinds: number;
    totalRegions: number;
    emergentRegions: number;
  } {
    let totalRegions = 0;
    let emergentRegions = 0;

    for (const kind of Object.keys(this.regions)) {
      const kindRegions = this.regions[kind] || [];
      totalRegions += kindRegions.length;
      emergentRegions += kindRegions.filter(r => r.emergent).length;
    }

    return {
      cultures: this.cultures.length,
      kinds: this.entityKinds.filter(k => k.semanticPlane).length,
      totalRegions,
      emergentRegions
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a CoordinateContext from configuration.
 */
export function createCoordinateContext(
  config: CoordinateContextConfig
): CoordinateContext {
  return new CoordinateContext(config);
}
