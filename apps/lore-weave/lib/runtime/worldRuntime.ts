import { Graph, DebugCategory, DEFAULT_DEBUG_CONFIG, EngineConfig } from '../engine/types';
import type { CreateEntitySettings, EntityCriteria, RelationshipCriteria } from '../engine/types';
import { HardState, Relationship, EntityTags } from '../core/worldTypes';
import { TargetSelector } from '../selection/targetSelector';
import { CoordinateContext, PlacementContext } from '../coordinates/coordinateContext';
import { coordinateStats } from '../coordinates/coordinateStatistics';
import {
  mergeTags,
  arrayToTags,
  generateEntityIdFromName,
  addRelationship,
  modifyRelationshipStrength as modifyRelationshipStrengthUtil,
  getRelated as getRelatedUtil,
  recordRelationshipFormation as recordRelationshipFormationUtil
} from '../utils';
import {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_RELATIONSHIP_KINDS,
  FRAMEWORK_RELATIONSHIP_PROPERTIES,
  FRAMEWORK_STATUS
} from '@canonry/world-schema';
import { archiveRelationship as archiveRel } from '../graph/relationshipMutation';
import { archiveEntities as archiveEnts, transferRelationships as transferRels, createPartOfRelationships as createPartOf } from '../graph/entityArchival';
import type {
  Point,
  Region,
  RegionLookupResult,
  EmergentRegionResult
} from '../coordinates/types';
import type { PlacementAnchor, PlacementRegionPolicy, PlacementSpacing, PlacementStep } from '../engine/declarativeTypes';
import type { PressureModificationSource } from '../observer/types';
import { prominenceLabel } from '../rules/types';

/** Result of placement with debug info */
export interface PlacementResultWithDebug {
  coordinates: Point;
  regionId?: string | null;
  allRegionIds?: string[];
  derivedTags?: Record<string, string | boolean>;
  debug: {
    anchorType: string;
    anchorEntity?: { id: string; name: string; kind: string };
    anchorCulture?: string;
    resolvedVia: string;
    seedRegionsAvailable?: string[];
    emergentRegionCreated?: { id: string; label: string };
  };
}

/**
 * Callback for tracking pressure modifications with source attribution
 */
export type PressureModificationCallback = (
  pressureId: string,
  delta: number,
  source: PressureModificationSource
) => void;

/**
 * WorldRuntime
 *
 * Runtime orchestration layer that combines graph data with
 * selection, placement, and pressure services. This replaces
 * the old WorldRuntime facade.
 */
export class WorldRuntime implements Graph {
  private graph: Graph;
  public readonly targetSelector: TargetSelector;
  private readonly engineConfig: EngineConfig;

  // Shared coordinate context (REQUIRED - no internal instantiation)
  private readonly coordinateContext: CoordinateContext;

  // Optional callback for tracking pressure modifications with source
  private onPressureModify?: PressureModificationCallback;

  // Current source context for pressure modifications (set before template/system execution)
  private currentSource?: PressureModificationSource;

  constructor(
    graph: Graph,
    targetSelector: TargetSelector,
    coordinateContext: CoordinateContext,
    config: EngineConfig
  ) {
    if (!coordinateContext) {
      throw new Error(
        'WorldRuntime: coordinateContext is required. ' +
        'Runtime must provide a CoordinateContext instance.'
      );
    }

    this.graph = graph;
    this.targetSelector = targetSelector;
    this.coordinateContext = coordinateContext;
    this.engineConfig = config;
  }

  /**
   * Access the canonical schema used to run the simulation.
   */
  getSchema(): EngineConfig['schema'] {
    return this.engineConfig.schema;
  }

  /**
   * Set the callback for tracking pressure modifications with source attribution
   */
  setPressureModificationCallback(callback: PressureModificationCallback): void {
    this.onPressureModify = callback;
  }

  /**
   * Set the current source context for pressure modifications
   * Call this before executing a template/system
   */
  setCurrentSource(source: PressureModificationSource): void {
    this.currentSource = source;
  }

  /**
   * Clear the current source context
   */
  clearCurrentSource(): void {
    this.currentSource = undefined;
  }

  // ============================================================================
  // TARGET SELECTION (PRIMARY INTERFACE)
  // ============================================================================

  /**
   * Select targets using intelligent hub-aware selection
   * This is the RECOMMENDED way to select entities for connections
   *
   * Wraps targetSelector.selectTargets() to hide internal graph access
   */
  selectTargets(
    kind: string,
    count: number,
    bias: import('../selection/targetSelector').SelectionBias
  ): import('../selection/targetSelector').SelectionResult {
    // Delegate to targetSelector with internal graph access
    return this.targetSelector.selectTargets(this.graph, kind, count, bias);
  }

  // ============================================================================
  // READ-ONLY GRAPH STATE
  // ============================================================================

  /** Current simulation tick */
  get tick(): number {
    return this.graph.tick;
  }
  set tick(value: number) {
    this.graph.tick = value;
  }

  /** Current era */
  get currentEra() {
    return this.graph.currentEra;
  }
  set currentEra(value: import('../engine/types').Era) {
    this.graph.currentEra = value;
  }

  /** Mutation tracker for lineage tracking (see LINEAGE.md) */
  get mutationTracker() {
    return this.graph.mutationTracker;
  }

  /** Pressure map (mutable) */
  get pressures(): Map<string, number> {
    return this.graph.pressures;
  }
  set pressures(value: Map<string, number>) {
    this.graph.pressures = value;
  }

  /** Narrative events for story generation (mutable) */
  get narrativeHistory(): import('@canonry/world-schema').NarrativeEvent[] {
    return this.graph.narrativeHistory;
  }
  set narrativeHistory(value: import('@canonry/world-schema').NarrativeEvent[]) {
    this.graph.narrativeHistory = value;
  }

  /** Relationship cooldowns (mutable) */
  get relationshipCooldowns(): Map<string, Map<string, number>> {
    return this.graph.relationshipCooldowns;
  }
  set relationshipCooldowns(value: Map<string, Map<string, number>>) {
    this.graph.relationshipCooldowns = value;
  }

  /** Growth metrics (mutable) */
  get growthMetrics(): { relationshipsPerTick: number[]; averageGrowthRate: number } {
    return this.graph.growthMetrics;
  }
  set growthMetrics(value: { relationshipsPerTick: number[]; averageGrowthRate: number }) {
    this.graph.growthMetrics = value;
  }

  /** Growth phase history (mutable) */
  get growthPhaseHistory(): import('../engine/types').GrowthPhaseCompletion[] {
    return this.graph.growthPhaseHistory;
  }
  set growthPhaseHistory(value: import('../engine/types').GrowthPhaseCompletion[]) {
    this.graph.growthPhaseHistory = value;
  }

  /** Optional subtype metrics (mutable) */
  get subtypeMetrics(): Map<string, number> | undefined {
    return this.graph.subtypeMetrics;
  }
  set subtypeMetrics(value: Map<string, number> | undefined) {
    this.graph.subtypeMetrics = value;
  }

  /** Optional protected relationship violations (mutable) */
  get protectedRelationshipViolations(): Array<{ tick: number; violations: Array<{ kind: string; strength: number }> }> | undefined {
    return this.graph.protectedRelationshipViolations;
  }
  set protectedRelationshipViolations(
    value: Array<{ tick: number; violations: Array<{ kind: string; strength: number }> }> | undefined
  ) {
    this.graph.protectedRelationshipViolations = value;
  }

  /** Current pressure values (read-only) */
  getPressure(pressureId: string): number {
    return this.graph.pressures.get(pressureId) || 0;
  }

  /** Get all pressure values as read-only map */
  getAllPressures(): ReadonlyMap<string, number> {
    return this.graph.pressures;
  }

  /** Get engine configuration (read-only) */
  get config() {
    return this.engineConfig;
  }

  /**
   * Log a message via the emitter (if available).
   * Convenience method for systems to emit debug/info/warn messages.
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    this.config?.emitter?.log(level, message, context);
  }

  /**
   * Emit a categorized debug message.
   * Only emits if debug is enabled and the category is in the enabled list.
   *
   * @param category - Debug category (e.g., 'placement', 'coordinates', 'templates')
   * @param message - Debug message to emit
   * @param context - Optional additional context
   */
  debug(category: DebugCategory, message: string, context?: Record<string, unknown>): void {
    const debugConfig = this.config?.debugConfig;

    // If debug is disabled globally or no config, skip
    if (!debugConfig?.enabled) {
        return;
    }


    // If no categories specified, emit all; otherwise check if category is enabled
    if (debugConfig.enabledCategories.length > 0 && !debugConfig.enabledCategories.includes(category)) {
      return;
    }

    // Emit with category prefix
    this.config?.emitter?.log('debug', `[${category.toUpperCase()}] ${message}`, context);
  }

  /**
   * Check if a debug category is enabled.
   * Useful for avoiding expensive string formatting when debug is disabled.
   */
  isDebugEnabled(category: DebugCategory): boolean {
    const debugConfig = this.config?.debugConfig ?? DEFAULT_DEBUG_CONFIG;
    if (!debugConfig.enabled) return false;
    if (debugConfig.enabledCategories.length === 0) return true;
    return debugConfig.enabledCategories.includes(category);
  }

  /** Get rate limit state (for templates with creation rate limiting) */
  get rateLimitState() {
    return this.graph.rateLimitState;
  }
  set rateLimitState(value: import('../core/worldTypes').RateLimitState) {
    this.graph.rateLimitState = value;
  }

  // ============================================================================
  // SAFE ENTITY QUERIES (NO DIRECT MAP ACCESS)
  // ============================================================================

  /**
   * Get a specific entity by ID (returns undefined if not found)
   * Safe for templates to check specific entities they already know about
   */
  getEntity(id: string): HardState | undefined {
    return this.graph.getEntity(id);
  }

  /**
   * Check if an entity exists
   */
  hasEntity(id: string): boolean {
    return this.graph.hasEntity(id);
  }

  /**
   * Get total entity count (useful for canApply checks)
   */
  getEntityCount(options?: { includeHistorical?: boolean }): number;
  getEntityCount(kind?: string, subtype?: string): number;
  getEntityCount(kindOrOptions?: string | { includeHistorical?: boolean }, subtype?: string): number {
    if (typeof kindOrOptions === 'object') {
      return this.graph.getEntityCount(kindOrOptions);
    }

    const kind = kindOrOptions;
    if (!kind) {
      return this.graph.getEntityCount();
    }

    let count = 0;
    for (const entity of this.graph.getEntities()) {
      if (entity.kind === kind && (!subtype || entity.subtype === subtype)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Find entities matching criteria
   *
   * NOTE: Use sparingly for canApply() checks and validation logic.
   * For entity SELECTION, use targetSelector.selectTargets() instead
   * to ensure proper hub-aware distribution.
   */
  findEntities(criteria: EntityCriteria): HardState[] {
    return this.graph.findEntities(criteria);
  }

  /**
   * Get entities by kind.
   */
  getEntitiesByKind(kind: string, options?: { includeHistorical?: boolean }): HardState[] {
    return this.graph.getEntitiesByKind(kind, options);
  }

  /**
   * Get entity IDs.
   */
  getEntityIds(options?: { includeHistorical?: boolean }): string[] {
    return this.graph.getEntityIds(options);
  }

  /**
   * Get entities connected to a specific entity by relationship kind.
   * Excludes historical entities by default.
   */
  getConnectedEntities(
    entityId: string,
    relationKind?: string,
    direction: 'src' | 'dst' | 'both' = 'both',
    options?: { includeHistorical?: boolean }
  ): HardState[] {
    return this.graph.getConnectedEntities(entityId, relationKind, direction, options);
  }

  /**
   * Get all relationships in the graph (read-only).
   * Excludes historical by default.
   */
  getRelationships(): Relationship[];
  getRelationships(options?: { includeHistorical?: boolean }): Relationship[];
  getRelationships(entityId: string, kind?: string, options?: { includeHistorical?: boolean }): Relationship[];
  getRelationships(
    entityIdOrOptions?: string | { includeHistorical?: boolean },
    kind?: string,
    options?: { includeHistorical?: boolean }
  ): Relationship[] {
    if (typeof entityIdOrOptions === 'string') {
      if (!this.graph.getEntity(entityIdOrOptions)) return [];

      const relationships = this.graph.getEntityRelationships(entityIdOrOptions, 'both', options);
      if (kind) {
        return relationships.filter(link => link.kind === kind);
      }
      return relationships;
    }

    return this.graph.getRelationships(entityIdOrOptions);
  }

  /**
   * Alias for getRelationships() returning all relationships.
   */
  getAllRelationships(options?: { includeHistorical?: boolean }): Relationship[] {
    return this.graph.getRelationships(options);
  }

  /**
   * Find relationships matching criteria.
   */
  findRelationships(criteria: RelationshipCriteria): Relationship[] {
    return this.graph.findRelationships(criteria);
  }

  /**
   * Get relationships for a specific entity and direction.
   */
  getEntityRelationships(
    entityId: string,
    direction: 'src' | 'dst' | 'both' = 'both',
    options?: { includeHistorical?: boolean }
  ): Relationship[] {
    return this.graph.getEntityRelationships(entityId, direction, options);
  }

  /**
   * Check if a relationship exists between two entities
   */
  hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
    return this.graph.hasRelationship(srcId, dstId, kind);
  }

  /**
   * Determine the relationship between two sets of factions.
   * Returns 'allied', 'enemy', or 'neutral'.
   */
  getFactionRelationship(
    factions1: HardState[],
    factions2: HardState[]
  ): 'allied' | 'enemy' | 'neutral' {
    // Check for warfare/enmity
    const atWar = factions1.some(f1 =>
      factions2.some(f2 =>
        this.hasRelationship(f1.id, f2.id, 'at_war_with') ||
        this.hasRelationship(f1.id, f2.id, 'enemy_of')
      )
    );
    if (atWar) return 'enemy';

    // Check for alliances
    const allied = factions1.some(f1 =>
      factions2.some(f2 => this.hasRelationship(f1.id, f2.id, 'allied_with'))
    );
    if (allied) return 'allied';

    return 'neutral';
  }

  /**
   * Get relationship cooldown remaining ticks
   * Returns 0 if no cooldown, otherwise ticks remaining
   */
  getRelationshipCooldown(entityId: string, relationshipType: string): number {
    const cooldownMap = this.graph.relationshipCooldowns.get(entityId);
    if (!cooldownMap) return 0;

    const lastFormationTick = cooldownMap.get(relationshipType);
    if (lastFormationTick === undefined) return 0;

    const cooldownPeriod = 10; // Same as defined in worldEngine
    const ticksSinceFormation = this.graph.tick - lastFormationTick;
    const ticksRemaining = cooldownPeriod - ticksSinceFormation;

    return Math.max(0, ticksRemaining);
  }

  /**
   * Check if an entity can form a new relationship of a given type
   * (respects cooldowns)
   * @param cooldown Optional cooldown period in ticks (defaults to 10)
   */
  canFormRelationship(entityId: string, relationshipType: string, cooldown?: number): boolean {
    const cooldownPeriod = cooldown ?? 10;
    const cooldownMap = this.graph.relationshipCooldowns.get(entityId);
    if (!cooldownMap) return true;

    const lastFormationTick = cooldownMap.get(relationshipType);
    if (lastFormationTick === undefined) return true;

    const ticksSinceFormation = this.graph.tick - lastFormationTick;
    return ticksSinceFormation >= cooldownPeriod;
  }

  // ============================================================================
  // GRAPH MUTATIONS
  // ============================================================================
  // These methods allow systems to modify the graph without direct Graph access.
  // All mutations should go through these methods.

  /**
   * Get all entities in the graph.
   * Use sparingly - prefer findEntities() with criteria for filtering.
   * Excludes historical by default.
   */
  getEntities(options?: { includeHistorical?: boolean }): HardState[] {
    return this.graph.getEntities(options);
  }

  /**
   * Iterate over all entities.
   * Excludes historical by default.
   */
  forEachEntity(callback: (entity: HardState, id: string) => void, options?: { includeHistorical?: boolean }): void {
    this.graph.forEachEntity(callback, options);
  }

  /**
   * Add an entity to the graph.
   * For coordinate-aware placement, use placeWithCulture() instead.
   */
  async createEntity(settings: CreateEntitySettings): Promise<string>;
  async createEntity(partial: Partial<HardState>, source?: string, placementStrategy?: string): Promise<string>;
  async createEntity(
    settingsOrPartial: CreateEntitySettings | Partial<HardState>,
    source?: string,
    placementStrategy?: string
  ): Promise<string> {
    const partial = settingsOrPartial as Partial<HardState>;
    const resolvedSource = (settingsOrPartial as CreateEntitySettings).source ?? source;
    const resolvedPlacementStrategy = (settingsOrPartial as CreateEntitySettings).placementStrategy ?? placementStrategy;
    const namingContext = (settingsOrPartial as Partial<HardState> & { namingContext?: Record<string, string> }).namingContext;

    const coords = partial.coordinates;
    if (!coords || typeof coords.x !== 'number' || typeof coords.y !== 'number' || typeof coords.z !== 'number') {
      throw new Error(
        `createEntity: valid coordinates {x: number, y: number, z: number} are required. ` +
        `Entity kind: ${partial.kind || 'unknown'}, name: ${partial.name || 'unnamed'}. ` +
        `Received: ${JSON.stringify(coords)}.`
      );
    }

    const validCoords = { x: coords.x, y: coords.y, z: coords.z };

    let tags: EntityTags;
    if (Array.isArray(partial.tags)) {
      tags = arrayToTags(partial.tags);
    } else {
      tags = { ...(partial.tags || {}) };
    }

    if (!partial.kind) {
      throw new Error('createEntity: kind is required.');
    }
    if (!partial.subtype) {
      throw new Error(`createEntity: subtype is required for kind "${partial.kind}".`);
    }
    if (!partial.status) {
      throw new Error(`createEntity: status is required for kind "${partial.kind}".`);
    }
    if (!partial.prominence) {
      throw new Error(`createEntity: prominence is required for kind "${partial.kind}".`);
    }
    if (!partial.culture) {
      throw new Error(`createEntity: culture is required for kind "${partial.kind}".`);
    }

    let name = partial.name;
    if (!name) {
      const nameForge = this.engineConfig.nameForgeService;
      if (!nameForge) {
        throw new Error(
          `createEntity: name not provided and no NameForgeService configured. ` +
          `Either provide a name or configure nameForgeService in EngineConfig.`
        );
      }

      const tagArray = Object.keys(tags);
      // Convert numeric prominence to label for name-forge
      name = await nameForge.generate(
        partial.kind,
        partial.subtype,
        prominenceLabel(partial.prominence),
        tagArray,
        partial.culture,
        namingContext
      );
    }

    if (partial.culture.startsWith('$')) {
      throw new Error(
        `[createEntity] culture value is unresolved: ${partial.culture}. ` +
        `Entity: ${partial.kind}/${partial.subtype}.`
      );
    }

    const resolvedId = generateEntityIdFromName(
      name,
      candidate => this.graph.hasEntity(candidate),
      (message, context) => this.log('warn', message, context)
    );

    // Warn on coordinate overlap with existing entities of the same kind
    const overlapThreshold = 1.0;
    for (const existing of this.graph.getEntities()) {
      if (existing.kind !== partial.kind) continue;
      const dx = existing.coordinates.x - validCoords.x;
      const dy = existing.coordinates.y - validCoords.y;
      const dz = existing.coordinates.z - validCoords.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < overlapThreshold) {
        this.engineConfig.emitter?.log(
          'warn',
          `Coordinate overlap: ${partial.kind}:${partial.subtype} "${name}" ` +
          `placed at (${validCoords.x.toFixed(1)}, ${validCoords.y.toFixed(1)}, ${validCoords.z.toFixed(1)}) ` +
          `overlaps with existing "${existing.name}" at ` +
          `(${existing.coordinates.x.toFixed(1)}, ${existing.coordinates.y.toFixed(1)}, ${existing.coordinates.z.toFixed(1)}) ` +
          `[distance: ${distance.toFixed(2)}]`
        );
      }
    }

    const currentEraEntity = partial.kind !== FRAMEWORK_ENTITY_KINDS.ERA
      ? this.graph.findEntities({
          kind: FRAMEWORK_ENTITY_KINDS.ERA,
          status: FRAMEWORK_STATUS.CURRENT
        })[0]
      : undefined;
    const explicitEraId = (settingsOrPartial as CreateEntitySettings).eraId ?? partial.eraId;
    const resolvedEraId = typeof explicitEraId === 'string' && explicitEraId
      ? explicitEraId
      : (partial.kind === FRAMEWORK_ENTITY_KINDS.ERA ? partial.subtype : currentEraEntity?.id);

    const entityId = await this.graph.createEntity({
      id: resolvedId,
      kind: partial.kind,
      subtype: partial.subtype,
      coordinates: validCoords,
      tags,
      eraId: resolvedEraId,
      name,
      description: partial.description ?? '',
      narrativeHint: partial.narrativeHint,
      status: partial.status,
      prominence: partial.prominence,
      culture: partial.culture,
      temporal: partial.temporal,
      source: resolvedSource,
      placementStrategy: resolvedPlacementStrategy,
      regionId: partial.regionId,
      allRegionIds: partial.allRegionIds
    });

    if (partial.kind !== FRAMEWORK_ENTITY_KINDS.ERA && currentEraEntity) {
      this.graph.addRelationship(
        FRAMEWORK_RELATIONSHIP_KINDS.CREATED_DURING,
        entityId,
        currentEraEntity.id,
        FRAMEWORK_RELATIONSHIP_PROPERTIES[FRAMEWORK_RELATIONSHIP_KINDS.CREATED_DURING].defaultStrength
      );
    }

    return entityId;
  }

  /**
   * Add a relationship between two entities.
   * @param kind - Relationship kind
   * @param srcId - Source entity ID
   * @param dstId - Destination entity ID
   * @param strength - Optional strength override
   * Distance is computed from entity coordinates.
   */
  addRelationship(
    kind: string,
    srcId: string,
    dstId: string,
    strength?: number,
    distanceIgnored?: number,
    category?: string
  ): boolean {
    return this.graph.addRelationship(kind, srcId, dstId, strength, distanceIgnored, category);
  }

  /**
   * Add a relationship between two entities.
   * @param kind - Relationship kind
   * @param srcId - Source entity ID
   * @param dstId - Destination entity ID
   * @param strength - Optional strength override
   * Distance is computed from entity coordinates.
   */
  createRelationship(
    kind: string,
    srcId: string,
    dstId: string,
    strength?: number
  ): void {
    // Distance is computed from coordinates
    addRelationship(this.graph, kind, srcId, dstId, strength);
  }

  /**
   * Remove a relationship between two entities.
   */
  removeRelationship(srcId: string, dstId: string, kind: string): boolean {
    return this.graph.removeRelationship(srcId, dstId, kind);
  }

  /**
   * Modify relationship strength by delta.
   */
  modifyRelationshipStrength(
    srcId: string,
    dstId: string,
    kind: string,
    delta: number
  ): boolean {
    return modifyRelationshipStrengthUtil(this.graph, srcId, dstId, kind, delta);
  }

  /**
   * Update an entity's properties.
   */
  updateEntity(entityId: string, changes: Partial<HardState>): boolean {
    return this.graph.updateEntity(entityId, changes);
  }

  /**
   * Delete an entity from the graph.
   */
  deleteEntity(entityId: string): boolean {
    return this.graph.deleteEntity(entityId);
  }

  /**
   * Get related entities with filtering options.
   * Equivalent to getRelated(graph, ...) utility function.
   */
  getRelated(
    entityId: string,
    relationshipKind: string,
    direction: 'src' | 'dst',
    options?: { minStrength?: number }
  ): HardState[] {
    return getRelatedUtil(this.graph, entityId, relationshipKind, direction, options);
  }

  // ============================================================================
  // FRAMEWORK SYSTEM OPERATIONS
  // ============================================================================
  // These methods support framework-level systems (era management, culling, etc.)
  // Domain code should NOT use these - use the standard mutations above.

  /**
   * Set the current era (by config reference).
   * Used by era transition system.
   */
  setCurrentEra(era: import('../engine/types').Era): void {
    this.graph.currentEra = era;
  }

  /**
   * Load an entity directly into the graph (bypasses normal creation).
   * Used by era spawner for framework entity creation.
   */
  loadEntity(entity: HardState): void {
    this._loadEntity(entity.id, entity);
  }

  /**
   * Load a pre-existing entity into the graph.
   * @internal Should only be used by framework systems.
   */
  _loadEntity(id: string, entity: HardState): void {
    this.graph._loadEntity(id, entity);
  }

  /**
   * Get total relationship count.
   */
  getRelationshipCount(options?: { includeHistorical?: boolean }): number {
    return this.graph.getRelationshipCount(options);
  }

  /**
   * Replace all relationships in the graph.
   * Used by relationship culling system.
   */
  setRelationships(relationships: Relationship[]): void {
    this._setRelationships(relationships);
  }

  /**
   * Bulk replace relationships (framework use only).
   */
  _setRelationships(relationships: Relationship[]): void {
    this.graph._setRelationships(relationships);
  }

  /**
   * Get protected relationship violations (for diagnostics).
   */
  getProtectedRelationshipViolations(): Array<{ tick: number; violations: Array<{ kind: string; strength: number }> }> {
    return this.graph.protectedRelationshipViolations || [];
  }

  /**
   * Record a protected relationship violation.
   * Used by relationship culling system for diagnostics.
   */
  recordProtectedRelationshipViolation(tick: number, violations: Array<{ kind: string; strength: number }>): void {
    if (!this.graph.protectedRelationshipViolations) {
      this.graph.protectedRelationshipViolations = [];
    }
    this.graph.protectedRelationshipViolations.push({ tick, violations });
  }

  // ============================================================================
  // RELATIONSHIP UTILITY WRAPPERS
  // ============================================================================
  // Wrappers around common utility functions so domain code doesn't need Graph.

  /**
   * Check if a relationship would be compatible (no contradictions).
   * Always returns true - conflict checking was removed.
   */
  areRelationshipsCompatible(_srcId: string, _dstId: string, _kind: string): boolean {
    return true;
  }

  /**
   * Record that a relationship was formed (for cooldown tracking).
   */
  recordRelationshipFormation(entityId: string, relationshipKind: string): void {
    recordRelationshipFormationUtil(this.graph, entityId, relationshipKind);
  }

  /**
   * Archive a relationship (mark as historical for temporal tracking).
   * Used when relationships end but should remain in history.
   */
  archiveRelationship(src: string, dst: string, kind: string): void {
    archiveRel(this.graph, src, dst, kind);
  }

  /**
   * Archive all relationships of a given kind involving an entity.
   * Used when you want to clear all relationships of a type without knowing the other end.
   * @param entityId - The entity whose relationships should be archived
   * @param kind - The relationship kind to archive
   * @param direction - 'src' (entity is source), 'dst' (entity is destination), or 'any' (either)
   * @returns Number of relationships archived
   */
  archiveRelationshipsByKind(entityId: string, kind: string, direction: 'src' | 'dst' | 'any' = 'any'): number {
    const relationships = this.graph.getRelationships();
    let archived = 0;

    for (const rel of relationships) {
      if (rel.kind !== kind || rel.status === 'historical') continue;

      const matches = direction === 'any'
        ? (rel.src === entityId || rel.dst === entityId)
        : direction === 'src'
          ? rel.src === entityId
          : rel.dst === entityId;

      if (matches) {
        archiveRel(this.graph, rel.src, rel.dst, rel.kind);
        archived++;
      }
    }

    return archived;
  }

  /**
   * Modify a pressure value by delta.
   * Used by templates and systems to affect world state.
   */
  modifyPressure(pressureId: string, delta: number): void {
    const current = this.graph.pressures.get(pressureId) || 0;
    this.graph.pressures.set(pressureId, Math.max(-100, Math.min(100, current + delta)));

    // Track modification if callback and source are set
    if (delta !== 0 && this.onPressureModify && this.currentSource) {
      this.onPressureModify(pressureId, delta, this.currentSource);
    }
  }

  /**
   * Update an entity's status.
   * Used by templates and systems to change entity states.
   */
  updateEntityStatus(entityId: string, newStatus: string): void {
    this.graph.updateEntity(entityId, { status: newStatus });
  }

  // ============================================================================
  // META-ENTITY FORMATION UTILITIES
  // ============================================================================
  // Wrappers for meta-entity formation operations (clustering, archival, etc.)

  /**
   * Archive entities (mark as historical).
   * Used by meta-entity formation systems.
   */
  archiveEntities(
    entityIds: string[],
    options: { archiveRelationships?: boolean; excludeRelationshipKinds?: string[] } = {}
  ): void {
    archiveEnts(this.graph, entityIds, options);
  }

  /**
   * Transfer relationships from source entities to a target entity.
   * Used when forming meta-entities from clusters.
   */
  transferRelationships(
    sourceIds: string[],
    targetId: string,
    options: { excludeKinds?: string[]; archiveOriginals?: boolean } = {}
  ): number {
    return transferRels(this.graph, sourceIds, targetId, options);
  }

  /**
   * Create part_of relationships from members to a container.
   * Used when forming meta-entities.
   */
  createPartOfRelationships(memberIds: string[], containerId: string): number {
    return createPartOf(this.graph, memberIds, containerId);
  }

  /**
   * Add an entity to the graph (async).
   * Wrapper for createEntity to support optional source metadata.
   */
  async addEntity(partial: Partial<HardState>, source?: string, placementStrategy?: string): Promise<string> {
    return await this.createEntity(partial, source, placementStrategy);
  }

  // ============================================================================
  // COORDINATE OPERATIONS (Simple Point-based)
  // ============================================================================

  /**
   * Calculate Euclidean distance between two entities.
   */
  getDistance(entity1: HardState, entity2: HardState): number {
    const c1 = entity1.coordinates;
    const c2 = entity2.coordinates;
    if (!c1 || !c2) {
      throw new Error(`getDistance: entities must have coordinates (${entity1.id}, ${entity2.id}).`);
    }
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const dz = c1.z - c2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Find entities nearest to a reference entity.
   * Filters by kind.
   */
  findNearestEntities(
    referenceEntity: HardState,
    targetKind: string,
    limit?: number
  ): Array<{ entity: HardState; distance: number }> {
    const refCoord = referenceEntity.coordinates;
    if (!refCoord) {
      throw new Error(`findNearestEntities: reference entity "${referenceEntity.name}" has no coordinates.`);
    }

    const results: Array<{ entity: HardState; distance: number }> = [];

    for (const entity of this.graph.getEntities()) {
      if (entity.kind !== targetKind) continue;
      if (entity.id === referenceEntity.id) continue;

      const dist = this.getDistance(referenceEntity, entity);
      results.push({ entity, distance: dist });
    }

    results.sort((a, b) => a.distance - b.distance);
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Find all entities within a radius of a reference entity.
   */
  findEntitiesInRadius(
    referenceEntity: HardState,
    radius: number,
    targetKind?: string
  ): Array<{ entity: HardState; distance: number }> {
    const refCoord = referenceEntity.coordinates;
    if (!refCoord || typeof refCoord.x !== 'number') return [];

    const results: Array<{ entity: HardState; distance: number }> = [];

    for (const entity of this.graph.getEntities()) {
      if (targetKind && entity.kind !== targetKind) continue;
      if (entity.id === referenceEntity.id) continue;

      const dist = this.getDistance(referenceEntity, entity);
      if (dist !== undefined && dist <= radius) {
        results.push({ entity, distance: dist });
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Derive coordinates using culture-aware placement.
   *
   * Uses the culture context to determine placement based on the culture's
   * regions and semantic encoding.
   *
   * Returns coordinates only - does NOT add the entity to the graph.
   * Use this in templates that need to return entity partials with coordinates.
   *
   * @param cultureId - Culture ID for placement context
   * @param entityKind - Entity kind for semantic placement
   * @param referenceEntities - Optional entities to place near
   * @returns Object with coordinates and optional derived info, or undefined if failed
   */
  async deriveCoordinatesWithCulture(
    cultureId: string,
    entityKind: string,
    referenceEntities?: HardState[]
  ): Promise<{ coordinates: Point; regionId?: string | null; derivedTags?: Record<string, string | boolean> }> {
    // Build context from culture and entity kind
    const context = this.coordinateContext.buildPlacementContext(cultureId, entityKind);

    // Collect existing points for collision avoidance
    const existingPoints = this.getAllRegionPoints();

    // If reference entities provided, bias toward their location
    if (referenceEntities && referenceEntities.length > 0) {
      const validRefs = referenceEntities;
      const centroid = {
        x: validRefs.reduce((sum, e) => sum + e.coordinates.x, 0) / validRefs.length,
        y: validRefs.reduce((sum, e) => sum + e.coordinates.y, 0) / validRefs.length,
        z: validRefs.reduce((sum, e) => sum + e.coordinates.z, 0) / validRefs.length
      };
      // Add reference point to context
      context.referenceEntity = {
        id: validRefs[0].id,
        coordinates: centroid
      };
    }

    // Use culture-aware placement
    const placementResult = await this.coordinateContext.placeWithCulture(
      entityKind,
      'placement', // name placeholder
      this.graph.tick,
      context,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      throw new Error(
        `deriveCoordinatesWithCulture: could not find placement for "${entityKind}" in culture "${cultureId}".`
      );
    }

    // Record successful placement
    coordinateStats.recordPlacement({
      tick: this.graph.tick,
      entityKind,
      method: 'deriveCoordinatesWithCulture',
      cultureId,
      regionId: placementResult.regionId,
      hadReferenceEntities: (referenceEntities?.length ?? 0) > 0,
      coordinates: placementResult.coordinates
    });

    return {
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      derivedTags: placementResult.derivedTags
    };
  }

  /**
   * Get semantic properties of an entity based on its coordinates.
   *
   * Uses the semantic axis system to interpret what coordinates mean.
   * For example, an NPC at x=20 is more hostile (low alignment),
   * while an NPC at x=80 is more friendly (high alignment).
   *
   * @param entity - Entity with coordinates
   * @returns Semantic interpretation or undefined if no semantic config
   */
  getSemanticProperties(entity: HardState): Record<string, { value: number; concept: string }> | undefined {
    if (!entity.coordinates) {
      return undefined;
    }

    const semanticPlane = this.coordinateContext.getSemanticPlane(entity.kind);
    if (!semanticPlane) {
      return undefined;
    }

    const axes = semanticPlane.axes;
    const coords = entity.coordinates;
    if (!coords) {
      throw new Error(`getSemanticProperties: entity "${entity.name}" has no coordinates.`);
    }
    const result: Record<string, { value: number; concept: string }> = {};
    const axisById = new Map(
      (this.engineConfig.schema.axisDefinitions || []).map(axis => [axis.id, axis])
    );

    // Interpret x-axis
    const xAxis = axes.x?.axisId ? axisById.get(axes.x.axisId) : undefined;
    if (xAxis) {
      const xValue = coords.x;
      const xConcept = xValue < 33 ? xAxis.lowTag
        : xValue > 66 ? xAxis.highTag
          : 'neutral';
      result[xAxis.name] = { value: xValue, concept: xConcept };
    }

    // Interpret y-axis
    const yAxis = axes.y?.axisId ? axisById.get(axes.y.axisId) : undefined;
    if (yAxis) {
      const yValue = coords.y;
      const yConcept = yValue < 33 ? yAxis.lowTag
        : yValue > 66 ? yAxis.highTag
          : 'neutral';
      result[yAxis.name] = { value: yValue, concept: yConcept };
    }

    // Interpret z-axis (optional in semantic plane)
    const zAxis = axes.z?.axisId ? axisById.get(axes.z.axisId) : undefined;
    if (zAxis) {
      const zValue = coords.z;
      const zConcept = zValue < 33 ? zAxis.lowTag
        : zValue > 66 ? zAxis.highTag
          : 'neutral';
      result[zAxis.name] = { value: zValue, concept: zConcept };
    }

    return result;
  }

  // ============================================================================
  // REGION-BASED PLACEMENT (Simplified Narrative Coordinates)
  // ============================================================================

  /**
   * Check if region system is available.
   * Always returns true since CoordinateContext is now required.
   */
  hasRegionSystem(): boolean {
    return true;
  }

  /**
   * Get the CoordinateContext for direct access to coordinate services.
   */
  getCoordinateContext(): CoordinateContext {
    return this.coordinateContext;
  }

  /**
   * Get a region by ID within an entity kind.
   */
  getRegion(entityKind: string, regionId: string): Region | undefined {
    return this.coordinateContext.getRegion(entityKind, regionId);
  }

  /**
   * Get all registered regions for an entity kind.
   */
  getAllRegions(entityKind: string): Region[] {
    return this.coordinateContext.getRegions(entityKind);
  }

  /**
   * Look up which region(s) contain a point for an entity kind.
   */
  lookupRegion(entityKind: string, point: Point): RegionLookupResult {
    const regions = this.coordinateContext.getRegions(entityKind);
    const containing = regions.filter(r => this.pointInRegion(point, r));
    return {
      primary: containing[0] ?? null,
      all: containing
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
   * Create an emergent region near a reference point.
   * Useful when existing regions are saturated and expansion is needed.
   *
   * @param nearPoint - Reference point for new region placement
   * @param label - Human-readable name for the region
   * @param description - Narrative description
   * @returns Result with created region or failure reason
   *
   * @example
   * ```typescript
   * const result = view.createEmergentRegion(
   *   'location',
   *   existingEntity.coordinates,
   *   'New Settlement',
   *   'A freshly established outpost on the ice',
   *   existingEntity.culture
   * );
   *
   * if (result.success) {
   *   console.log(`Created region: ${result.region.id}`);
   * }
   * ```
   */
  createEmergentRegion(
    entityKind: string,
    nearPoint: Point,
    label: string,
    description: string,
    cultureId: string,
    createdBy?: string
  ): EmergentRegionResult {
    return this.coordinateContext.createEmergentRegion(
      entityKind,
      nearPoint,
      label,
      description,
      this.graph.tick,
      cultureId,
      createdBy
    );
  }

  /**
   * Create an emergent region with Name Forge generating the label.
   * Uses the culture's naming configuration to generate culturally-appropriate region names.
   */
  async createNamedEmergentRegion(
    entityKind: string,
    point: Point,
    cultureId: string
  ): Promise<EmergentRegionResult> {
    return this.coordinateContext.createNamedEmergentRegion(
      entityKind,
      point,
      cultureId,
      this.graph.tick
    );
  }

  /**
   * Find a sparse (unoccupied) area on the semantic plane for an entity kind.
   *
   * This is used for templates that need to place entities far from existing
   * same-kind entities, like colony founding where new colonies should spread
   * across the plane rather than cluster.
   *
   * @param entityKind - Entity kind to find sparse area for
   * @param options - Configuration for sparse area search
   * @returns Result with coordinates of the sparsest valid area found
   *
   * @example
   * ```typescript
   * const result = view.findSparseArea('location', {
   *   minDistanceFromEntities: 20,
   *   preferPeriphery: false
   * });
   *
   * if (result.success) {
   *   console.log(`Found sparse area at (${result.coordinates.x}, ${result.coordinates.y})`);
   * }
   * ```
   */
  findSparseArea(
    entityKind: string,
    options: {
      minDistanceFromEntities?: number;
      preferPeriphery?: boolean;
      maxAttempts?: number;
    }
  ): import('../coordinates/types').SparseAreaResult {
    // Gather existing entity positions for this kind
    const existingPositions: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      if (entity.kind === entityKind && entity.coordinates) {
        existingPositions.push(entity.coordinates);
      }
    }

    return this.coordinateContext.findSparseArea({
      existingPositions,
      minDistanceFromEntities: options.minDistanceFromEntities ?? 15,
      preferPeriphery: options.preferPeriphery ?? false,
      maxAttempts: options.maxAttempts ?? 50
    });
  }

  /**
   * Helper: get regions containing a point for an entity kind.
   */
  private getRegionsAtPoint(entityKind: string, point: Point): Region[] {
    return this.coordinateContext.getRegions(entityKind).filter((r) => this.pointInRegion(point, r));
  }

  /**
   * Unified placement helper for the new placement spec (anchor/spacing/region policy).
   * Returns coordinates plus derived tags/region info, or null if placement failed.
   */
  async placeWithPlacementOptions(
    entityKind: string,
    cultureId: string,
    placement: {
      anchor: PlacementAnchor;
      spacing?: PlacementSpacing;
      regionPolicy?: PlacementRegionPolicy;
      steps?: PlacementStep[];
    },
    resolvedAnchors: import('../core/worldTypes').HardState[] = [],
    avoidEntities: import('../core/worldTypes').HardState[] = [],
    tick: number = this.graph.tick
  ): Promise<PlacementResultWithDebug | null> {
    const spacing = placement.spacing || {};
    const regionPolicy = placement.regionPolicy || {};
    const steps = placement.steps ?? [];

    const spacingMin = spacing.minDistance ?? ((this.coordinateContext as unknown as { defaultMinDistance?: number }).defaultMinDistance ?? 5);
    const avoidPoints = avoidEntities.map(e => e.coordinates);
    const existingPoints = [...this.getAllRegionPoints(), ...avoidPoints];

    const anchor = placement.anchor;

    // Build base debug info
    const baseDebug = {
      anchorType: anchor.type,
      anchorCulture: anchor.type === 'culture' ? (anchor as { id: string }).id : cultureId,
    };

    const deriveInfo = (point: Point) => {
      const regions = this.getRegionsAtPoint(entityKind, point);
      const derived = this.coordinateContext.deriveTagsFromPlacement(entityKind, point, regions);
      const derivedTags: Record<string, string | boolean> = {};
      for (const tag of derived) derivedTags[tag] = true;
      derivedTags.culture = cultureId;
      return {
        regionId: regions[0]?.id ?? null,
        allRegionIds: regions.map(r => r.id),
        derivedTags
      };
    };

    const tryPlaceWithContext = async (
      ctx: PlacementContext,
      resolvedVia?: string
    ): Promise<PlacementResultWithDebug | null> => {
      ctx.allowEmergent = regionPolicy.allowEmergent;
      ctx.preferSparse = regionPolicy.preferSparse;
      const result = await this.coordinateContext.placeWithCulture(entityKind, 'placement', tick, ctx, existingPoints);
      if (result.success && result.coordinates) {
        return {
          coordinates: result.coordinates,
          regionId: result.regionId ?? null,
          allRegionIds: result.allRegionIds,
          derivedTags: result.derivedTags,
          debug: {
            ...baseDebug,
            resolvedVia: resolvedVia ?? result.resolvedVia ?? 'anchor',
            seedRegionsAvailable: ctx.seedRegionIds,
            emergentRegionCreated: result.emergentRegionCreated
          }
        };
      }
      return null;
    };

    const trySparse = async (
      preferPeriphery: boolean,
      resolvedVia: string
    ): Promise<PlacementResultWithDebug | null> => {
      const sparseResult = this.findSparseArea(entityKind, {
        minDistanceFromEntities: spacingMin,
        preferPeriphery
      });
      if (!sparseResult.success || !sparseResult.coordinates) return null;

      const derived = deriveInfo(sparseResult.coordinates);
      return {
        coordinates: sparseResult.coordinates,
        regionId: derived.regionId,
        allRegionIds: derived.allRegionIds,
        derivedTags: derived.derivedTags,
        debug: { ...baseDebug, resolvedVia }
      };
    };

    const tryBounds = (
      bounds: { x?: [number, number]; y?: [number, number]; z?: [number, number] } | undefined,
      resolvedVia: string
    ): PlacementResultWithDebug => {
      const b = bounds || { x: [0, 100], y: [0, 100] };
      const coords: Point = {
        x: (b.x?.[0] ?? 0) + Math.random() * ((b.x?.[1] ?? 100) - (b.x?.[0] ?? 0)),
        y: (b.y?.[0] ?? 0) + Math.random() * ((b.y?.[1] ?? 100) - (b.y?.[0] ?? 0)),
        z: b.z ? (b.z[0] + Math.random() * (b.z[1] - b.z[0])) : 50
      };
      const derived = deriveInfo(coords);
      return {
        coordinates: coords,
        regionId: derived.regionId,
        allRegionIds: derived.allRegionIds,
        derivedTags: derived.derivedTags,
        debug: { ...baseDebug, resolvedVia }
      };
    };

    const toAnchorDebug = (entity: import('../core/worldTypes').HardState) => ({
      id: entity.id,
      name: entity.name,
      kind: entity.kind
    });

    const tryNearPoint = (
      reference: Point,
      resolvedVia: string,
      anchorEntity?: import('../core/worldTypes').HardState
    ): PlacementResultWithDebug | null => {
      const point = this.coordinateContext.sampleNearPoint(reference, existingPoints);
      if (!point) return null;
      const derived = deriveInfo(point);
      const result: PlacementResultWithDebug = {
        coordinates: point,
        regionId: derived.regionId,
        allRegionIds: derived.allRegionIds,
        derivedTags: derived.derivedTags,
        debug: { ...baseDebug, resolvedVia }
      };
      if (anchorEntity) {
        result.debug.anchorEntity = toAnchorDebug(anchorEntity);
      }
      return result;
    };

    const tryAnchorRegion = async (
      refEntity: import('../core/worldTypes').HardState,
      resolvedVia: string
    ): Promise<PlacementResultWithDebug | null> => {
      const regions = this.getRegionsAtPoint(entityKind, refEntity.coordinates);
      if (regions.length === 0) return null;
      const anchorCulture = refEntity.culture || cultureId;
      if (!anchorCulture) return null;
      const ctx = this.coordinateContext.buildPlacementContext(anchorCulture, entityKind);
      ctx.referenceEntity = { id: refEntity.id, coordinates: refEntity.coordinates };
      ctx.seedRegionIds = regions.map(r => r.id);
      ctx.stickToRegion = true;
      ctx.axisBiases = undefined;
      const result = await tryPlaceWithContext(ctx, resolvedVia);
      if (result) {
        result.debug.anchorEntity = toAnchorDebug(refEntity);
      }
      return result;
    };

    const trySeedRegion = async (
      seedCultureId: string | undefined,
      resolvedVia: string
    ): Promise<PlacementResultWithDebug | null> => {
      if (!seedCultureId) return null;
      const ctx = this.coordinateContext.buildPlacementContext(seedCultureId, entityKind);
      ctx.stickToRegion = true;
      ctx.axisBiases = undefined;
      return await tryPlaceWithContext(ctx, resolvedVia);
    };

    // Try anchor placement first
    let result: PlacementResultWithDebug | null = null;

    switch (anchor.type) {
      case 'entity': {
        const refEntity = resolvedAnchors.find(e => e.id === anchor.ref || e.name === anchor.ref) || resolvedAnchors[0];
        if (refEntity && refEntity.coordinates && refEntity.kind === entityKind) {
          if (anchor.stickToRegion) {
            result = await tryAnchorRegion(refEntity, 'anchor_region');
          } else {
            result = tryNearPoint(refEntity.coordinates, 'anchor', refEntity);
          }
        }
        break;
      }
      case 'culture':
        result = await trySeedRegion(anchor.id, 'seed_region');
        break;
      case 'refs_centroid': {
        const refs = resolvedAnchors.filter(e => anchor.refs.includes(e.id) || anchor.refs.includes(e.name || ''));
        const withCoords = refs.filter(r => r.kind === entityKind);
        if (withCoords.length > 0) {
          const centroid: Point = {
            x: withCoords.reduce((s, r) => s + r.coordinates.x, 0) / withCoords.length,
            y: withCoords.reduce((s, r) => s + r.coordinates.y, 0) / withCoords.length,
            z: withCoords.reduce((s, r) => s + r.coordinates.z, 0) / withCoords.length
          };
          if (anchor.jitter) {
            centroid.x += (Math.random() - 0.5) * anchor.jitter;
            centroid.y += (Math.random() - 0.5) * anchor.jitter;
          }
          result = tryNearPoint(centroid, 'anchor');
        }
        break;
      }
      case 'sparse':
        result = await trySparse(anchor.preferPeriphery ?? false, 'sparse');
        break;
      case 'bounds':
        result = tryBounds(anchor.bounds, 'bounds');
        break;
    }

    if (!result && steps.length > 0) {
      for (const step of steps) {
        switch (step) {
          case 'anchor_region': {
            if (anchor.type === 'entity') {
              const refEntity = resolvedAnchors.find(e => e.id === anchor.ref || e.name === anchor.ref) || resolvedAnchors[0];
              if (refEntity && refEntity.coordinates && refEntity.kind === entityKind) {
                result = await tryAnchorRegion(refEntity, 'anchor_region');
              }
            } else if (anchor.type === 'culture') {
              result = await trySeedRegion(anchor.id, 'anchor_region');
            }
            break;
          }
          case 'seed_region':
            result = await trySeedRegion(cultureId, 'seed_region');
            break;
          case 'sparse': {
            const preferPeriphery = anchor.type === 'sparse' ? (anchor.preferPeriphery ?? false) : false;
            result = await trySparse(preferPeriphery, 'sparse');
            break;
          }
          case 'random':
            result = tryBounds(undefined, 'random');
            break;
        }
        if (result) break;
      }
    }

    // If placement succeeded and createRegion is requested, create an emergent region at the location
    if (result && regionPolicy.createRegion) {
      const regionResult = await this.coordinateContext.createNamedEmergentRegion(
        entityKind,
        result.coordinates,
        cultureId,
        tick
      );
      if (regionResult.success && regionResult.region) {
        result.debug.emergentRegionCreated = {
          id: regionResult.region.id,
          label: regionResult.region.label
        };
        // Update region info to include the newly created region
        result.regionId = regionResult.region.id;
        if (!result.allRegionIds) {
          result.allRegionIds = [];
        }
        result.allRegionIds.push(regionResult.region.id);
      }
    }

    return result;
  }

  /**
   * Get region statistics for diagnostics.
   */
  getRegionStats(): {
    cultures: number;
    kinds: number;
    totalRegions: number;
    emergentRegions: number;
  } {
    return this.coordinateContext.getStats();
  }

  // ============================================================================
  // CULTURE-AWARE PLACEMENT (New APIs)
  // ============================================================================

  /**
   * Place an entity within a region using culture context.
   *
   * @param entity - Entity data (coordinates will be generated)
   * @param regionId - Target region ID
   * @param context - Placement context with culture data
   * @returns Entity ID if successful, null if placement failed
   */
  async placeInRegion(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    regionId: string,
    context: PlacementContext
  ): Promise<string> {
    const kind = entity.kind;
    if (!kind) {
      throw new Error('placeInRegion: entity.kind is required.');
    }
    const cultureId = context.cultureId ?? entity.culture;
    if (!cultureId) {
      throw new Error(`placeInRegion: cultureId is required for kind "${kind}".`);
    }
    const existingPoints = this.getRegionPoints(kind, regionId);

    // Use CoordinateContext for culture-aware placement
    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? kind,
      this.graph.tick,
      { ...context, seedRegionIds: [regionId] },
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      throw new Error(
        `placeInRegion: could not place "${kind}" in region "${regionId}".`
      );
    }

    // Merge entity tags with derived tags
    // Debug info (derivedTags) now captured in structured template_application event
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: cultureId
    };

    return await this.createEntity(entityWithCoords);
  }

  /**
   * Place an entity near a reference entity using culture context.
   *
   * @param entity - Entity data
   * @param referenceEntity - Entity to place near
   * @param context - Placement context with culture data
   * @returns Entity ID if successful, null if placement failed
   */
  async placeNearEntity(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    referenceEntity: HardState,
    context: PlacementContext
  ): Promise<string> {
    if (!referenceEntity.coordinates) {
      throw new Error(
        `placeNearEntity: Reference entity "${referenceEntity.name}" has no coordinates.`
      );
    }

    const kind = entity.kind;
    if (!kind) {
      throw new Error('placeNearEntity: entity.kind is required.');
    }
    const cultureId = context.cultureId ?? referenceEntity.culture ?? entity.culture;
    if (!cultureId) {
      throw new Error(`placeNearEntity: cultureId is required for kind "${kind}".`);
    }
    const existingPoints = this.getAllRegionPoints();

    // Build context with reference entity
    const fullContext: PlacementContext = {
      ...context,
      referenceEntity: {
        id: referenceEntity.id,
        coordinates: referenceEntity.coordinates
      }
    };

    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? kind,
      this.graph.tick,
      fullContext,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      throw new Error(
        `placeNearEntity: could not place "${kind}" near "${referenceEntity.name}".`
      );
    }

    // Merge entity tags with derived tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: cultureId
    };

    return await this.createEntity(entityWithCoords);
  }

  /**
   * Place an entity, optionally in a specific region.
   *
   * NOTE: Emergent region creation is paused pending emergentConfig implementation.
   * This method places the entity in an existing region or default location.
   *
   * @param _regionLabel - Ignored (was for emergent regions)
   * @param entity - Entity data
   * @param context - Placement context with culture data
   * @returns Entity ID and region info if successful
   */
  async spawnEmergentRegionAndPlace(
    _regionLabel: string,
    entity: Omit<Partial<HardState>, 'coordinates'>,
    context: PlacementContext
  ): Promise<{ entityId: string; regionId: string }> {
    const kind = entity.kind;
    if (!kind) {
      throw new Error('spawnEmergentRegionAndPlace: entity.kind is required.');
    }
    const cultureId = context.cultureId ?? entity.culture;
    if (!cultureId) {
      throw new Error(`spawnEmergentRegionAndPlace: cultureId is required for kind "${kind}".`);
    }
    const existingPoints = this.getAllRegionPoints();

    // Uses culture-aware placement with emergent region creation
    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? kind,
      this.graph.tick,
      context,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      throw new Error(
        `spawnEmergentRegionAndPlace: could not place "${kind}" with emergent region.`
      );
    }

    // Merge entity tags with derived tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: cultureId
    };

    const entityId = await this.createEntity(entityWithCoords);
    if (!placementResult.regionId) {
      throw new Error(
        `spawnEmergentRegionAndPlace: placement for "${kind}" did not yield a regionId.`
      );
    }
    return {
      entityId,
      regionId: placementResult.regionId
    };
  }

  /**
   * Place an entity using only culture ID (loads culture's context automatically).
   *
   * @param cultureId - Culture identifier
   * @param entity - Entity data
   * @returns Entity ID if successful, null if placement failed
   */
  async placeWithCulture(
    cultureId: string,
    entity: Omit<Partial<HardState>, 'coordinates'>
  ): Promise<string> {
    const kind = entity.kind;
    if (!kind) {
      throw new Error('placeWithCulture: entity.kind is required.');
    }
    // Build context from culture and entity kind
    const context = this.coordinateContext.buildPlacementContext(cultureId, kind);
    const existingPoints = this.getAllRegionPoints();

    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? kind,
      this.graph.tick,
      context,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      throw new Error(
        `placeWithCulture: could not place "${kind}" for culture "${cultureId}".`
      );
    }

    // Record statistics - this is the proper culture-aware path!
    coordinateStats.recordPlacement({
      tick: this.graph.tick,
      entityKind: kind,
      method: 'placeWithCulture',
      cultureId,
      regionId: placementResult.regionId,
      hadReferenceEntities: false,
      coordinates: placementResult.coordinates
    });

    // Merge entity tags with derived tags
    // Debug info (derivedTags) now captured in structured template_application event
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: cultureId
    };

    return await this.createEntity(entityWithCoords);
  }

  // ============================================================================
  // REGION HELPERS (Private)
  // ============================================================================

  /**
   * Get all coordinates for entities in a specific region.
   */
  private getRegionPoints(entityKind: string, regionId: string): Point[] {
    const region = this.coordinateContext.getRegion(entityKind, regionId);
    if (!region) return [];

    const points: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      if (entity.kind !== entityKind) continue;
      if (this.pointInRegion(entity.coordinates, region)) {
        points.push(entity.coordinates);
      }
    }
    return points;
  }

  /**
   * Get all coordinates from all entities.
   */
  private getAllRegionPoints(): Point[] {
    const points: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      points.push(entity.coordinates);
    }
    return points;
  }
}
