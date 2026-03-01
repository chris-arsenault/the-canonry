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
    entity.coordinates != null &&
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
// =============================================================================
// PLANE DIFFUSION HELPERS
// =============================================================================

type DiffusionEntityMod = { id: string; changes: Partial<HardState>; narrativeGroupId?: string };

function computeFalloff(
  distance: number,
  strength: number,
  falloffType: FalloffType,
  sourceRadius: number,
  metricCtx: ReturnType<typeof createSystemContext>
): number {
  const maxDistance = falloffType === 'absolute' ? strength : sourceRadius + 1;
  if (maxDistance <= 0) return 0;
  const metric: Metric = { type: 'falloff', falloffType, distance, maxDistance };
  return evaluateMetric(metric, metricCtx).value;
}

function addBoundedCell(fixedCells: Set<number>, nx: number, ny: number): void {
  if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
    fixedCells.add(ny * GRID_SIZE + nx);
  }
}

function buildFixedBoundaryCells(
  sources: Array<HardState & { coordinates: Point }>,
  sourceRadius: number,
  decayRate: number
): Set<number> {
  const fixedCells = new Set<number>();
  if (decayRate !== 0) return fixedCells;
  for (const source of sources) {
    const gx = coordToGrid(source.coordinates.x);
    const gy = coordToGrid(source.coordinates.y);
    for (let dy = -sourceRadius; dy <= sourceRadius; dy++) {
      for (let dx = -sourceRadius; dx <= sourceRadius; dx++) {
        if (Math.sqrt(dx * dx + dy * dy) <= sourceRadius) {
          addBoundedCell(fixedCells, gx + dx, gy + dy);
        }
      }
    }
  }
  return fixedCells;
}

function injectValueAtCell(
  grid: Float32Array,
  nx: number,
  ny: number,
  injectionValue: number,
  sourceMode: 'add' | 'set'
): void {
  if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return;
  const idx = ny * GRID_SIZE + nx;
  if (sourceMode === 'add') {
    grid[idx] += injectionValue;
  } else {
    grid[idx] = injectionValue;
  }
}

function injectSourceValues(
  state: DiffusionState,
  sources: Array<HardState & { coordinates: Point }>,
  config: PlaneDiffusionConfig,
  sourceRadius: number,
  decayRate: number,
  metricCtx: ReturnType<typeof createSystemContext>,
  falloffType: FalloffType
): void {
  const sourceMode = decayRate > 0 ? 'add' : 'set';
  for (const source of sources) {
    const gx = coordToGrid(source.coordinates.x);
    const gy = coordToGrid(source.coordinates.y);
    const strength = getStrength(source, config.sources.strengthTag, config.sources.defaultStrength);
    for (let dy = -sourceRadius; dy <= sourceRadius; dy++) {
      for (let dx = -sourceRadius; dx <= sourceRadius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= sourceRadius) {
          const falloff = computeFalloff(dist, strength, falloffType, sourceRadius, metricCtx);
          injectValueAtCell(state.grid, gx + dx, gy + dy, strength * falloff, sourceMode);
        }
      }
    }
  }
}

function applySinkValues(
  state: DiffusionState,
  sinks: Array<HardState & { coordinates: Point }>,
  config: PlaneDiffusionConfig,
  sourceRadius: number,
  metricCtx: ReturnType<typeof createSystemContext>,
  falloffType: FalloffType
): void {
  for (const sink of sinks) {
    const gx = coordToGrid(sink.coordinates.x);
    const gy = coordToGrid(sink.coordinates.y);
    const strength = getStrength(sink, config.sinks!.strengthTag, config.sinks!.defaultStrength);
    for (let dy = -sourceRadius; dy <= sourceRadius; dy++) {
      for (let dx = -sourceRadius; dx <= sourceRadius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= sourceRadius) {
          const falloff = computeFalloff(dist, strength, falloffType, sourceRadius, metricCtx);
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            const idx = ny * GRID_SIZE + nx;
            state.grid[idx] -= strength * falloff;
          }
        }
      }
    }
  }
}

function runDiffusionIterations(
  state: DiffusionState,
  fixedCells: Set<number>,
  iterationsPerTick: number,
  diffusionRate: number
): void {
  for (let iter = 0; iter < iterationsPerTick; iter++) {
    state.tempGrid.set(state.grid);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const idx = y * GRID_SIZE + x;
        if (fixedCells.has(idx)) continue;
        const current = state.tempGrid[idx];
        const north = getGridValue(state.tempGrid, x, y - 1);
        const south = getGridValue(state.tempGrid, x, y + 1);
        const east = getGridValue(state.tempGrid, x + 1, y);
        const west = getGridValue(state.tempGrid, x - 1, y);
        state.grid[idx] = current + diffusionRate * ((north + south + east + west) / 4 - current);
      }
    }
  }
}

function applyDecayToGrid(state: DiffusionState, fixedCells: Set<number>, decayRate: number): void {
  if (decayRate <= 0) return;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = y * GRID_SIZE + x;
      if (!fixedCells.has(idx)) {
        state.grid[idx] *= (1 - decayRate);
      }
    }
  }
}

function getEntityPreviousOutputTags(entity: HardState, config: PlaneDiffusionConfig): Set<string> {
  const prev = new Set<string>();
  for (const outputTag of config.outputTags) {
    if (hasTag(entity.tags, outputTag.tag)) prev.add(outputTag.tag);
  }
  return prev;
}

function clearOldOutputTags(
  newTags: Record<string, boolean | string>,
  entity: HardState,
  config: PlaneDiffusionConfig
): boolean {
  let changed = false;
  for (const outputTag of config.outputTags) {
    if (hasTag(entity.tags, outputTag.tag)) { delete newTags[outputTag.tag]; changed = true; }
  }
  if (config.valueTag && config.valueTag in newTags) { delete newTags[config.valueTag]; changed = true; }
  return changed;
}

interface ApplyOutputTagsResult {
  newOutputTagAdded: boolean;
  gainedOutputTag?: DiffusionOutputTag;
  outputTagLost: boolean;
  lostOutputTag?: DiffusionOutputTag;
  tagsChanged: boolean;
}

function applyNewOutputTags(
  newTags: Record<string, boolean | string>,
  fieldValue: number,
  config: PlaneDiffusionConfig,
  previousOutputTags: Set<string>
): ApplyOutputTagsResult {
  let tagsChanged = false;
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
      if (!previousOutputTags.has(outputTag.tag)) { newOutputTagAdded = true; gainedOutputTag = outputTag; }
    }
  }
  let outputTagLost = false;
  let lostOutputTag: DiffusionOutputTag | undefined;
  for (const outputTag of config.outputTags) {
    if (previousOutputTags.has(outputTag.tag) && !newOutputTags.has(outputTag.tag)) {
      outputTagLost = true; lostOutputTag = outputTag; break;
    }
  }
  if (config.valueTag) { newTags[config.valueTag] = fieldValue.toFixed(1); tagsChanged = true; }
  return { newOutputTagAdded, gainedOutputTag, outputTagLost, lostOutputTag, tagsChanged };
}

function enforceTagLimitOnMap(newTags: Record<string, boolean | string>): void {
  const tagKeys = Object.keys(newTags);
  if (tagKeys.length <= 10) return;
  const excessCount = tagKeys.length - 10;
  const frameworkTags = new Set<string>(FRAMEWORK_TAG_VALUES);
  const removable = tagKeys.filter(tag => !frameworkTags.has(tag));
  const protectedTags = tagKeys.filter(tag => frameworkTags.has(tag));
  const removalOrder = removable.length >= excessCount ? removable : removable.concat(protectedTags);
  for (let i = 0; i < excessCount; i++) delete newTags[removalOrder[i]];
}

function generateOutputTagNarration(
  entity: HardState,
  newOutputTagAdded: boolean,
  gainedOutputTag: DiffusionOutputTag | undefined,
  outputTagLost: boolean,
  lostOutputTag: DiffusionOutputTag | undefined,
  narrationsByGroup: Record<string, string>
): void {
  if (newOutputTagAdded && gainedOutputTag?.narrationTemplate) {
    const ctx = createSystemRuleContext({ self: entity });
    const result = interpolate(gainedOutputTag.narrationTemplate, ctx);
    if (result.complete) narrationsByGroup[entity.id] = result.text;
  } else if (outputTagLost && lostOutputTag?.lostNarrationTemplate) {
    const ctx = createSystemRuleContext({ self: entity });
    const result = interpolate(lostOutputTag.lostNarrationTemplate, ctx);
    if (result.complete) narrationsByGroup[entity.id] = result.text;
  }
}

function processAllEntityTagUpdates(
  entitiesWithCoords: Array<HardState & { coordinates: Point }>,
  state: DiffusionState,
  config: PlaneDiffusionConfig
): { modifications: DiffusionEntityMod[]; narrationsByGroup: Record<string, string>; significantModificationCount: number } {
  const modifications: DiffusionEntityMod[] = [];
  const narrationsByGroup: Record<string, string> = {};
  let significantModificationCount = 0;
  for (const entity of entitiesWithCoords) {
    const fieldValue = clampToOutput(sampleGrid(state.grid, entity.coordinates.x, entity.coordinates.y));
    const newTags: Record<string, boolean | string> = { ...entity.tags };
    const previousOutputTags = getEntityPreviousOutputTags(entity, config);
    let tagsChanged = clearOldOutputTags(newTags, entity, config);
    const tagResult = applyNewOutputTags(newTags, fieldValue, config, previousOutputTags);
    tagsChanged = tagsChanged || tagResult.tagsChanged;
    if (!tagsChanged) continue;
    enforceTagLimitOnMap(newTags);
    const significantChange = tagResult.newOutputTagAdded || tagResult.outputTagLost;
    generateOutputTagNarration(entity, tagResult.newOutputTagAdded, tagResult.gainedOutputTag, tagResult.outputTagLost, tagResult.lostOutputTag, narrationsByGroup);
    modifications.push({
      id: entity.id,
      changes: { tags: buildTagPatch(entity.tags, newTags) },
      narrativeGroupId: significantChange ? entity.id : undefined,
    } as DiffusionEntityMod);
    if (significantChange) significantModificationCount++;
  }
  return { modifications, narrationsByGroup, significantModificationCount };
}

function buildDiffusionVizSnapshot(
  state: DiffusionState,
  sources: Array<HardState & { coordinates: Point }>,
  sinks: Array<HardState & { coordinates: Point }>,
  entitiesWithCoords: Array<HardState & { coordinates: Point }>,
  config: PlaneDiffusionConfig,
  params: { diffusionRate: number; sourceRadius: number; decayRate: number; falloffType: FalloffType; iterationsPerTick: number }
): object {
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
  return {
    grid: Array.from(state.grid),
    gridSize: GRID_SIZE,
    valueRange: { min: OUTPUT_MIN, max: OUTPUT_MAX },
    rawRange: { min: gridMin, max: gridMax },
    gridStats: { min: gridMin, max: gridMax, avg: gridSum / state.grid.length, nonZeroCount },
    sources: sources.map(s => ({
      id: s.id, name: s.name, x: s.coordinates.x, y: s.coordinates.y,
      strength: getStrength(s, config.sources.strengthTag, config.sources.defaultStrength),
    })),
    sinks: sinks.map(k => ({
      id: k.id, name: k.name, x: k.coordinates.x, y: k.coordinates.y,
      strength: getStrength(k, config.sinks!.strengthTag, config.sinks!.defaultStrength),
    })),
    entities: entitiesWithCoords.map(e => ({
      id: e.id, name: e.name, x: e.coordinates.x, y: e.coordinates.y,
      fieldValue: clampToOutput(sampleGrid(state.grid, e.coordinates.x, e.coordinates.y)),
    })),
    diffusionParams: params,
  };
}

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

    apply: function(graphView: WorldRuntime, _modifier: number = 1.0): SystemResult {
      if (!this.state?.initialized) {
        this.initialize!();
      }
      const state = this.state!;

      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        // eslint-disable-next-line sonarjs/pseudo-random -- simulation throttle check
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

      const metricCtx = createSystemContext(graphView);
      const entities = selectEntities(config.selection, metricCtx);
      const entitiesWithCoords = entities.filter(hasCoordinates);
      const sources = entitiesWithCoords.filter(e => hasTag(e.tags, config.sources.tagFilter));
      const sinks = config.sinks
        ? entitiesWithCoords.filter(e => hasTag(e.tags, config.sinks!.tagFilter))
        : [];

      const fixedCells = buildFixedBoundaryCells(sources, sourceRadius, decayRate);
      injectSourceValues(state, sources, config, sourceRadius, decayRate, metricCtx, falloffType);
      applySinkValues(state, sinks, config, sourceRadius, metricCtx, falloffType);
      runDiffusionIterations(state, fixedCells, iterationsPerTick, diffusionRate);
      applyDecayToGrid(state, fixedCells, decayRate);

      const { modifications, narrationsByGroup, significantModificationCount } =
        processAllEntityTagUpdates(entitiesWithCoords, state, config);

      const pressureChanges = (sources.length > 0 || sinks.length > 0)
        ? (config.pressureChanges ?? {})
        : {};

      const visualizationSnapshot = buildDiffusionVizSnapshot(
        state, sources, sinks, entitiesWithCoords, config,
        { diffusionRate, sourceRadius, decayRate, falloffType, iterationsPerTick }
      );

      return {
        relationshipsAdded: [],
        entitiesModified: modifications,
        pressureChanges,
        description: `${config.name}: ${sources.length} sources, ${sinks.length} sinks, ${significantModificationCount} entities gained output tags`,
        narrationsByGroup: Object.keys(narrationsByGroup).length > 0 ? narrationsByGroup : undefined,
        details: {
          diffusionSnapshot: visualizationSnapshot,
          significantModificationCount,
        },
      };
    }
  };

  return system;
}
