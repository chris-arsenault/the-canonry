/**
 * Plane Diffusion System Factory
 *
 * Creates configurable systems that simulate true time-evolving diffusion fields.
 * Uses a 100x100 grid matching the semantic coordinate space.
 *
 * Each tick:
 * 1. Sources SET their values at grid positions (Dirichlet boundary conditions)
 * 2. Sinks SET negative values at grid positions
 * 3. Apply diffusion step (heat equation: each cell exchanges with neighbors)
 * 4. Apply optional decay (values drift toward zero)
 * 5. Sample grid at entity positions to set tags (clamped to -100 to 100)
 *
 * The simulation runs uncapped internally - values can exceed -100 to 100.
 * Values are only clamped when output to game space (tags, visualization).
 *
 * Mathematical Foundation:
 * Diffusion step: cell[x,y] += rate * (neighbor_avg - cell[x,y])
 * This is a discrete approximation of the heat equation.
 * For numerical stability, rate should be <= 0.25.
 */

import { SimulationSystem, SystemResult } from '../engine/types';
import { HardState } from '../core/worldTypes';
import { Point } from '../coordinates/types';
import { WorldRuntime } from '../runtime/worldRuntime';
import { hasTag, getTagValue } from '../utils';
import { buildTagPatch, createSystemContext, evaluateMetric, selectEntities } from '../rules';
import type { Metric, SelectionRule } from '../rules';
import { FRAMEWORK_TAG_VALUES } from '@canonry/world-schema';
import { interpolate, createSystemRuleContext } from '../narrative/narrationTemplate';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Grid size - matches semantic coordinate space (0-100) */
const GRID_SIZE = 100;

/** Output value range for game space (tags, visualization) */
const OUTPUT_MIN = -100;
const OUTPUT_MAX = 100;

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/** Falloff type for how source influence decreases with distance */
export type FalloffType = 'linear' | 'inverse_square' | 'sqrt' | 'exponential' | 'absolute' | 'none';

/**
 * Source configuration: entities that emit into the diffusion field
 */
export interface DiffusionSourceConfig {
  /** Tag that marks an entity as a source */
  tagFilter: string;
  /** Optional tag containing numeric strength value (e.g., "strength:0.5") */
  strengthTag?: string;
  /** Default strength if strengthTag not present */
  defaultStrength: number;
}

/**
 * Sink configuration: entities that absorb from the diffusion field
 */
export interface DiffusionSinkConfig {
  /** Tag that marks an entity as a sink */
  tagFilter: string;
  /** Optional tag containing numeric strength value */
  strengthTag?: string;
  /** Default strength if strengthTag not present */
  defaultStrength: number;
}

/**
 * Diffusion parameters
 */
export interface DiffusionParams {
  /** Diffusion rate: how fast values spread (0-1, default 0.2) */
  rate: number;
  /** Source radius: cells around source that are directly set (default 1) */
  sourceRadius?: number;
  /** Decay rate: how fast values decay toward zero each tick (0-1, default 0) */
  decayRate?: number;
  /** Falloff type for source influence within sourceRadius (default 'linear') */
  falloffType?: FalloffType;
  /** Iterations per tick: run diffusion this many times per tick for faster spreading (default 20) */
  iterationsPerTick?: number;
}

/**
 * Output tag configuration: tags set based on field value thresholds
 * Note: thresholds are in clamped -100 to 100 range
 */
export interface DiffusionOutputTag {
  /** Tag to set on entity */
  tag: string;
  /** Minimum field value to set this tag (inclusive) */
  minValue?: number;
  /** Maximum field value to set this tag (exclusive) */
  maxValue?: number;
  /**
   * Narration template for narrative-quality text when this tag is gained.
   * Uses the template syntax:
   * - {$self.name} - The entity gaining the tag
   * Example: "{$self.name} became dangerously hot."
   */
  narrationTemplate?: string;
  /**
   * Narration template for narrative-quality text when this tag is lost.
   * Uses the template syntax:
   * - {$self.name} - The entity losing the tag
   * Example: "{$self.name} cooled down and became safe again."
   */
  lostNarrationTemplate?: string;
}

/**
 * Full plane diffusion configuration
 */
export interface PlaneDiffusionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Selection rule for entities on this semantic plane */
  selection: SelectionRule;

  /** Source configuration: entities that emit into the field */
  sources: DiffusionSourceConfig;

  /** Optional sink configuration: entities that absorb from the field */
  sinks?: DiffusionSinkConfig;

  /** Diffusion parameters */
  diffusion: DiffusionParams;

  /** Output tags based on field value thresholds */
  outputTags: DiffusionOutputTag[];

  /** Optional: store raw field value as a tag (e.g., "field_value" → "field_value:25.5") */
  valueTag?: string;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /** Pressure changes when field computation produces significant values */
  pressureChanges?: Record<string, number>;
}

// =============================================================================
// INTERNAL STATE TYPE
// =============================================================================

/**
 * Internal state for the diffusion system - persists across ticks
 */
interface DiffusionState {
  /** 100x100 grid of field values (unbounded during simulation) */
  grid: Float32Array;
  /** Temporary buffer for diffusion step */
  tempGrid: Float32Array;
  /** Whether the grid has been initialized */
  initialized: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert coordinate (0-100) to grid index (0-99)
 */
function coordToGrid(coord: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(coord)));
}

/**
 * Get grid value at (x, y) - returns 0 for out of bounds
 */
function getGridValue(grid: Float32Array, x: number, y: number): number {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return 0;
  return grid[y * GRID_SIZE + x];
}

/**
 * Set grid value at (x, y) - NO CLAMPING (simulation runs uncapped)
 */
function setGridValue(grid: Float32Array, x: number, y: number, value: number): void {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
  grid[y * GRID_SIZE + x] = value;
}

// falloff calculation now uses rules/metrics

/**
 * Get numeric strength from entity tags
 */
function getStrength(entity: HardState, strengthTag: string | undefined, defaultStrength: number): number {
  if (!strengthTag) return defaultStrength;

  const value = getTagValue(entity.tags, strengthTag);
  if (value === undefined) return defaultStrength;

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? defaultStrength : parsed;
}

/**
 * Check if entity has valid coordinates
 */
function hasCoordinates(entity: HardState): entity is HardState & { coordinates: Point } {
  return (
    entity.coordinates !== undefined &&
    typeof entity.coordinates.x === 'number' &&
    typeof entity.coordinates.y === 'number'
  );
}

/**
 * Sample grid value at a coordinate using bilinear interpolation
 */
function sampleGrid(grid: Float32Array, x: number, y: number): number {
  // Clamp to valid range
  x = Math.max(0, Math.min(GRID_SIZE - 1, x));
  y = Math.max(0, Math.min(GRID_SIZE - 1, y));

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, GRID_SIZE - 1);
  const y1 = Math.min(y0 + 1, GRID_SIZE - 1);

  const xFrac = x - x0;
  const yFrac = y - y0;

  // Bilinear interpolation
  const v00 = getGridValue(grid, x0, y0);
  const v10 = getGridValue(grid, x1, y0);
  const v01 = getGridValue(grid, x0, y1);
  const v11 = getGridValue(grid, x1, y1);

  const v0 = v00 * (1 - xFrac) + v10 * xFrac;
  const v1 = v01 * (1 - xFrac) + v11 * xFrac;

  return v0 * (1 - yFrac) + v1 * yFrac;
}

/**
 * Clamp value to output range for game space
 */
function clampToOutput(value: number): number {
  return Math.max(OUTPUT_MIN, Math.min(OUTPUT_MAX, value));
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a PlaneDiffusionConfig
 */
export function createPlaneDiffusionSystem(
  config: PlaneDiffusionConfig
): SimulationSystem<DiffusionState> {
  const diffusionRate = config.diffusion.rate ?? 0.2;
  const sourceRadius = config.diffusion.sourceRadius ?? 1;
  const decayRate = config.diffusion.decayRate ?? 0; // Default to 0
  const falloffType = config.diffusion.falloffType ?? 'absolute';
  const iterationsPerTick = config.diffusion.iterationsPerTick ?? 20; // Default 20 for fast spreading

  // Validate ranges
  if (diffusionRate < 0 || diffusionRate > 1) {
    throw new Error(`[${config.id}] Diffusion rate must be between 0 and 1, got ${diffusionRate}`);
  }
  if (decayRate < 0 || decayRate > 1) {
    throw new Error(`[${config.id}] Decay rate must be between 0 and 1, got ${decayRate}`);
  }
  if (sourceRadius < 0 || sourceRadius > 50) {
    throw new Error(`[${config.id}] Source radius must be between 0 and 50, got ${sourceRadius}`);
  }
  if (!config.selection?.kind) {
    throw new Error(`[${config.id}] Plane diffusion requires selection.kind to define the semantic plane.`);
  }

  // Create the system with internal state
  const system: SimulationSystem<DiffusionState> = {
    id: config.id,
    name: config.name,

    // Internal state - will be initialized by initialize()
    state: undefined,

    // Initialize the grid on first use
    initialize: function() {
      this.state = {
        grid: new Float32Array(GRID_SIZE * GRID_SIZE),
        tempGrid: new Float32Array(GRID_SIZE * GRID_SIZE),
        initialized: true,
      };
    },

    apply: function(graphView: WorldRuntime, modifier: number = 1.0): SystemResult {
      // Ensure state is initialized (safety check)
      if (!this.state?.initialized) {
        this.initialize!();
      }
      const state = this.state!;

      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (Math.random() > config.throttleChance) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: dormant`,
            details: {
              diffusionSnapshot: {
                grid: Array.from(state.grid),
                gridSize: GRID_SIZE,
                sources: [],
                sinks: [],
                entities: [],
              },
            },
          };
        }
      }

      const modifications: Array<{ id: string; changes: Partial<HardState>; narrativeGroupId?: string }> = [];
      const narrationsByGroup: Record<string, string> = {};
      const metricCtx = createSystemContext(graphView);

      const getFalloff = (distance: number, strength: number): number => {
        const maxDistance = falloffType === 'absolute' ? strength : sourceRadius + 1;
        if (maxDistance <= 0) return 0;
        const metric: Metric = {
          type: 'falloff',
          falloffType,
          distance,
          maxDistance,
        };
        return evaluateMetric(metric, metricCtx).value;
      };

      // Find all entities on the target plane
      let entities = selectEntities(config.selection, metricCtx);

      // Filter to entities with valid coordinates
      const entitiesWithCoords = entities.filter(hasCoordinates);

      // Identify sources and sinks
      const sources = entitiesWithCoords.filter(e => hasTag(e.tags, config.sources.tagFilter));
      const sinks = config.sinks
        ? entitiesWithCoords.filter(e => hasTag(e.tags, config.sinks!.tagFilter))
        : [];

      // =======================================================================
      // STEP 1: Build a mask of fixed boundary cells (only when decay=0)
      // - decay=0: Sources SET values, need Dirichlet boundary (fixed during diffusion)
      // - decay>0: Sources ADD values, no fixed boundary (diffusion happens normally)
      // - Sinks never create fixed cells - they subtract and let diffusion happen
      // =======================================================================
      const fixedCells = new Set<number>();

      // Only create fixed boundaries when decay=0 (SET mode)
      if (decayRate === 0) {
        for (const source of sources) {
          const gx = coordToGrid(source.coordinates.x);
          const gy = coordToGrid(source.coordinates.y);
          for (let dy = -sourceRadius; dy <= sourceRadius; dy++) {
            for (let dx = -sourceRadius; dx <= sourceRadius; dx++) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= sourceRadius) {
                const nx = gx + dx;
                const ny = gy + dy;
                if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                  fixedCells.add(ny * GRID_SIZE + nx);
                }
              }
            }
          }
        }
      }

      // =======================================================================
      // STEP 2a: Sources SET (decay=0) or ADD (decay>0) their values
      // - decay=0: Dirichlet boundary - stable fixed values
      // - decay>0: Injection model - add per tick, decay prevents unbounded growth
      // =======================================================================
      const sourceMode = decayRate > 0 ? 'add' : 'set';

      for (const source of sources) {
        const gx = coordToGrid(source.coordinates.x);
        const gy = coordToGrid(source.coordinates.y);
        // Note: source strength is NOT scaled by era modifier - it's a domain constant
        const strength = getStrength(source, config.sources.strengthTag, config.sources.defaultStrength);

        // Set/Add values within source radius
        for (let dy = -sourceRadius; dy <= sourceRadius; dy++) {
          for (let dx = -sourceRadius; dx <= sourceRadius; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= sourceRadius) {
              const falloff = getFalloff(dist, strength);
              const injectionValue = strength * falloff;

              const nx = gx + dx;
              const ny = gy + dy;
              if (sourceMode === 'add') {
                // ADD mode: inject on top of existing value
                const currentValue = getGridValue(state.grid, nx, ny);
                setGridValue(state.grid, nx, ny, currentValue + injectionValue);
              } else {
                // SET mode: fixed boundary value
                setGridValue(state.grid, nx, ny, injectionValue);
              }
            }
          }
        }
      }

      // =======================================================================
      // STEP 2b: Sinks SUBTRACT from existing values (not SET)
      // This allows sinks in source regions to reduce the field, not overwrite it
      // =======================================================================
      for (const sink of sinks) {
        const gx = coordToGrid(sink.coordinates.x);
        const gy = coordToGrid(sink.coordinates.y);
        // Note: sink strength is NOT scaled by era modifier - it's a domain constant
        const strength = getStrength(sink, config.sinks!.strengthTag, config.sinks!.defaultStrength);

        // Subtract values within sink radius
        for (let dy = -sourceRadius; dy <= sourceRadius; dy++) {
          for (let dx = -sourceRadius; dx <= sourceRadius; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= sourceRadius) {
              const falloff = getFalloff(dist, strength);
              const subtractAmount = strength * falloff;
              const nx = gx + dx;
              const ny = gy + dy;
              const currentValue = getGridValue(state.grid, nx, ny);
              setGridValue(state.grid, nx, ny, currentValue - subtractAmount);
            }
          }
        }
      }

      // =======================================================================
      // STEP 3: Apply diffusion (heat equation)
      // Skip source cells (Dirichlet source), edges diffuse normally (Neumann-like)
      // Out-of-bounds neighbors return 0, so edges naturally trend toward 0
      // =======================================================================
      for (let iter = 0; iter < iterationsPerTick; iter++) {
        state.tempGrid.set(state.grid);

        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const idx = y * GRID_SIZE + x;

            // Skip source cells - they maintain their set values
            if (fixedCells.has(idx)) {
              continue;
            }

            const current = getGridValue(state.tempGrid, x, y);

            // Get 4-connected neighbors (out-of-bounds returns 0)
            const north = getGridValue(state.tempGrid, x, y - 1);
            const south = getGridValue(state.tempGrid, x, y + 1);
            const east = getGridValue(state.tempGrid, x + 1, y);
            const west = getGridValue(state.tempGrid, x - 1, y);

            // Average of neighbors
            const neighborAvg = (north + south + east + west) / 4;

            // Diffusion: move toward neighbor average
            const diffused = current + diffusionRate * (neighborAvg - current);

            setGridValue(state.grid, x, y, diffused);
          }
        }
      }

      // =======================================================================
      // STEP 3b: Apply decay ONCE per tick (not per iteration)
      // =======================================================================
      if (decayRate > 0) {
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            const idx = y * GRID_SIZE + x;
            // Don't decay fixed boundary cells
            if (!fixedCells.has(idx)) {
              const current = getGridValue(state.grid, x, y);
              setGridValue(state.grid, x, y, current * (1 - decayRate));
            }
          }
        }
      }

      // =======================================================================
      // STEP 4: Sample grid at entity positions and set tags (CLAMPED OUTPUT)
      // Track significant modifications (new output tags) separately from
      // value tag updates to avoid false positives in the trace.
      // =======================================================================
      let significantModificationCount = 0;

      for (const entity of entitiesWithCoords) {
        const rawFieldValue = sampleGrid(state.grid, entity.coordinates.x, entity.coordinates.y);
        // Clamp to output range for game space
        const fieldValue = clampToOutput(rawFieldValue);

        const newTags: Record<string, boolean | string> = { ...entity.tags };
        let tagsChanged = false;

        // Track which output tags the entity currently has
        const previousOutputTags = new Set<string>();
        for (const outputTag of config.outputTags) {
          if (hasTag(entity.tags, outputTag.tag)) {
            previousOutputTags.add(outputTag.tag);
          }
        }

        // Remove old output tags and value tag
        for (const outputTag of config.outputTags) {
          if (hasTag(entity.tags, outputTag.tag)) {
            delete newTags[outputTag.tag];
            tagsChanged = true;
          }
        }
        if (config.valueTag) {
          if (config.valueTag in newTags) {
            delete newTags[config.valueTag];
            tagsChanged = true;
          }
        }

        // Add appropriate output tag based on thresholds (using clamped value)
        // Track if any NEW output tag was added (not previously present)
        let newOutputTagAdded = false;
        let gainedOutputTag: DiffusionOutputTag | undefined;
        const newOutputTags = new Set<string>();
        for (const outputTag of config.outputTags) {
          const minOk = outputTag.minValue === undefined || fieldValue >= outputTag.minValue;
          const maxOk = outputTag.maxValue === undefined || fieldValue < outputTag.maxValue;

          if (minOk && maxOk) {
            newTags[outputTag.tag] = true;
            newOutputTags.add(outputTag.tag);
            tagsChanged = true;
            // This is a significant change if entity didn't have this tag before
            if (!previousOutputTags.has(outputTag.tag)) {
              newOutputTagAdded = true;
              gainedOutputTag = outputTag;
            }
          }
        }

        // Track lost tags (had before but don't have now)
        let outputTagLost = false;
        let lostOutputTag: DiffusionOutputTag | undefined;
        for (const outputTag of config.outputTags) {
          if (previousOutputTags.has(outputTag.tag) && !newOutputTags.has(outputTag.tag)) {
            outputTagLost = true;
            lostOutputTag = outputTag;
            break;
          }
        }

        // Optionally add raw value tag (clamped)
        if (config.valueTag) {
          newTags[config.valueTag] = fieldValue.toFixed(1);
          tagsChanged = true;
        }

        // Determine if this is a significant change (gained or lost an output tag)
        const significantChange = newOutputTagAdded || outputTagLost;

        if (tagsChanged) {
          // Enforce max tags limit, but preserve framework tags if possible
          const tagKeys = Object.keys(newTags);
          if (tagKeys.length > 10) {
            const excessCount = tagKeys.length - 10;
            const frameworkTags: Set<string> = new Set(FRAMEWORK_TAG_VALUES);
            const removable = tagKeys.filter(tag => !frameworkTags.has(tag));
            const protectedTags = tagKeys.filter(tag => frameworkTags.has(tag));
            const removalOrder = removable.length >= excessCount
              ? removable
              : removable.concat(protectedTags);
            for (let i = 0; i < excessCount; i++) {
              delete newTags[removalOrder[i]];
            }
          }

          // Generate narration: prefer gained template, fall back to lost template
          if (newOutputTagAdded && gainedOutputTag?.narrationTemplate) {
            const narrationCtx = createSystemRuleContext({ self: entity });
            const narrationResult = interpolate(gainedOutputTag.narrationTemplate, narrationCtx);
            if (narrationResult.complete) {
              narrationsByGroup[entity.id] = narrationResult.text;
            }
          } else if (outputTagLost && lostOutputTag?.lostNarrationTemplate) {
            const narrationCtx = createSystemRuleContext({ self: entity });
            const narrationResult = interpolate(lostOutputTag.lostNarrationTemplate, narrationCtx);
            if (narrationResult.complete) {
              narrationsByGroup[entity.id] = narrationResult.text;
            }
          }

          // Type assertion: buildTagPatch returns TagPatch (with undefined for deletions)
          // but SystemResult expects Partial<HardState> - compatible at runtime
          modifications.push({
            id: entity.id,
            changes: { tags: buildTagPatch(entity.tags, newTags as Record<string, string | boolean>) },
            narrativeGroupId: significantChange ? entity.id : undefined,
          } as typeof modifications[number]);

          // Only count as significant if a new output tag was added or lost
          if (significantChange) {
            significantModificationCount++;
          }
        }
      }

      // Calculate pressure changes
      const pressureChanges = (sources.length > 0 || sinks.length > 0)
        ? (config.pressureChanges ?? {})
        : {};

      // =======================================================================
      // Build visualization snapshot with raw grid data
      // =======================================================================
      let gridMin = Infinity;
      let gridMax = -Infinity;
      let gridSum = 0;
      let nonZeroCount = 0;
      for (let i = 0; i < state.grid.length; i++) {
        const v = state.grid[i];
        if (v < gridMin) gridMin = v;
        if (v > gridMax) gridMax = v;
        gridSum += v;
        if (Math.abs(v) > 0.001) nonZeroCount++;
      }
      const gridAvg = gridSum / state.grid.length;

      const visualizationSnapshot = {
        // Raw grid data - copy to avoid mutation issues
        grid: Array.from(state.grid),
        gridSize: GRID_SIZE,
        // For visualization, provide both raw and clamped ranges
        valueRange: { min: OUTPUT_MIN, max: OUTPUT_MAX },
        rawRange: { min: gridMin, max: gridMax },
        // Debug statistics
        gridStats: {
          min: gridMin,
          max: gridMax,
          avg: gridAvg,
          nonZeroCount,
        },
        // Source positions
        sources: sources.map(s => ({
          id: s.id,
          name: s.name,
          x: s.coordinates.x,
          y: s.coordinates.y,
          strength: getStrength(s, config.sources.strengthTag, config.sources.defaultStrength),
        })),
        // Sink positions
        sinks: sinks.map(k => ({
          id: k.id,
          name: k.name,
          x: k.coordinates.x,
          y: k.coordinates.y,
          strength: getStrength(k, config.sinks!.strengthTag, config.sinks!.defaultStrength),
        })),
        // Entity field values for reference (clamped)
        entities: entitiesWithCoords.map(e => ({
          id: e.id,
          name: e.name,
          x: e.coordinates.x,
          y: e.coordinates.y,
          fieldValue: clampToOutput(sampleGrid(state.grid, e.coordinates.x, e.coordinates.y)),
        })),
        // Diffusion parameters
        diffusionParams: {
          rate: diffusionRate,
          sourceRadius,
          decayRate,
          falloffType,
          iterationsPerTick,
        },
      };

      return {
        relationshipsAdded: [],
        entitiesModified: modifications,
        pressureChanges,
        description: `${config.name}: ${sources.length} sources, ${sinks.length} sinks, ${significantModificationCount} entities gained output tags`,
        narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined,
        details: {
          diffusionSnapshot: visualizationSnapshot,
          // Significant modifications = entities that gained a NEW output tag
          // This filters out false positives from value tag updates
          significantModificationCount,
        },
      };
    }
  };

  return system;
}
