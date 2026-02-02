import { HardState, Relationship, EntityTags } from '../core/worldTypes';
import { FRAMEWORK_STATUS } from '@canonry/world-schema';
import { prominenceThreshold, prominenceLabel, type ProminenceLabel } from '../rules/types';
import { DistributionTargets } from '../statistics/types';
import type { ISimulationEmitter, ActionApplicationPayload } from '../observer/types';
import type { Condition } from '../rules/conditions/types';
import type { ModifyPressureMutation } from '../rules/mutations/types';
import type { CanonrySchemaSlice, NarrativeEvent } from '@canonry/world-schema';
import type { MutationTracker } from '../narrative/mutationTracker.js';

// =============================================================================
// DEBUG CONFIGURATION
// =============================================================================

/**
 * Debug categories for filtering debug output.
 * Each category can be toggled independently in the UI.
 */
export type DebugCategory =
  | 'placement'      // Entity placement and coordinate resolution
  | 'coordinates'    // Coordinate context, regions, culture mapping
  | 'templates'      // Template expansion and variable resolution
  | 'systems'        // System execution and effects
  | 'relationships'  // Relationship creation and mutations
  | 'selection'      // Target and template selection
  | 'eras'           // Era transitions and epoch events
  | 'entities'       // Entity creation and state changes
  | 'pressures'      // Pressure changes and thresholds
  | 'naming'         // Name generation
  | 'prominence';    // Prominence mutations and state tracking

/**
 * Debug configuration for controlling debug output.
 */
export interface DebugConfig {
  /** Master switch - if false, no debug output regardless of categories */
  enabled: boolean;
  /** Which categories are enabled (if empty and enabled=true, all are shown) */
  enabledCategories: DebugCategory[];
}

/**
 * Default debug config - all categories disabled.
 */
export const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  enabled: false,
  enabledCategories: []
};

/**
 * All available debug categories with descriptions for UI.
 */
export const DEBUG_CATEGORY_INFO: Record<DebugCategory, { label: string; description: string }> = {
  placement: { label: 'Placement', description: 'Entity placement and coordinate resolution' },
  coordinates: { label: 'Coordinates', description: 'Coordinate context, regions, culture mapping' },
  templates: { label: 'Templates', description: 'Template expansion and variable resolution' },
  systems: { label: 'Systems', description: 'System execution and effects' },
  relationships: { label: 'Relationships', description: 'Relationship creation and mutations' },
  selection: { label: 'Selection', description: 'Target and template selection' },
  eras: { label: 'Eras', description: 'Era transitions and epoch events' },
  entities: { label: 'Entities', description: 'Entity creation and state changes' },
  pressures: { label: 'Pressures', description: 'Pressure changes and thresholds' },
  naming: { label: 'Naming', description: 'Name generation' },
  prominence: { label: 'Prominence', description: 'Prominence mutations and state tracking' }
};

// LLM types moved to @illuminator
// import { LoreIndex, LoreRecord } from '../llm/types';
// export interface LLMConfig { ... }
// export type EnrichmentMode = 'off' | 'partial' | 'full';
// export interface EnrichmentConfig { ... }

/**
 * Interface for name generation service.
 * Implemented by NameForgeService, but defined here to avoid circular imports.
 */
export interface NameGenerationService {
  generate(
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    culture: string,
    context?: Record<string, string>
  ): Promise<string>;
  printStats(): void;
}

// =============================================================================
// ERA TRANSITION CONDITIONS
// =============================================================================

/**
 * Transition conditions define when an era can start or end.
 * Multiple conditions are combined with AND logic (all must be met).
 */
export type TransitionCondition = Condition;

// =============================================================================
// ERA TRANSITION EFFECTS
// =============================================================================

/**
 * Effects applied during era transitions.
 * These are expressed as mutation rules (currently pressure modifications).
 */
export interface EraTransitionEffects {
  mutations?: ModifyPressureMutation[];
}

// =============================================================================
// ERA DEFINITION
// =============================================================================

/**
 * Era configuration defines a historical period in world generation.
 *
 * TRANSITION MODEL:
 * - `exitConditions`: Criteria that must ALL be met for this era to end
 * - `entryConditions`: Criteria that must ALL be met for this era to START
 * - `nextEra`: Optional explicit next era ID (supports divergent era paths)
 * - `exitEffects`: Effects applied when transitioning OUT of this era
 * - `entryEffects`: Effects applied when transitioning INTO this era
 *
 * Era entities are created lazily when transitioned into (not spawned at init).
 * If no nextEra is specified, the system finds the first candidate era
 * whose entryConditions are met.
 */
export interface Era {
  id: string;
  name: string;
  summary: string;
  templateWeights: Record<string, number>;  // 0 = disabled, 2 = double chance
  systemModifiers: Record<string, number>;  // multipliers for system effects
  pressureModifiers?: Record<string, number>;
  specialRules?: (runtime: import('../runtime/worldRuntime').WorldRuntime) => void;

  // Criteria for this era to END (all must be met)
  exitConditions?: TransitionCondition[];

  // Criteria for this era to START (all must be met, checked when seeking next era)
  entryConditions?: TransitionCondition[];

  // Optional explicit next era ID (if not set, searches for first candidate)
  nextEra?: string;

  // Effects applied when transitioning OUT of this era
  exitEffects?: EraTransitionEffects;

  // Effects applied when transitioning INTO this era
  entryEffects?: EraTransitionEffects;
}

export interface EpochEraTransitionSummary {
  tick: number;
  from: { id: string; name: string };
  to: { id: string; name: string };
}

export interface EpochEraSummary {
  start: { id: string; name: string };
  end: { id: string; name: string };
  transitions: EpochEraTransitionSummary[];
}

/**
 * Entity creation settings
 * Framework enforces: coordinates → tags → name ordering
 */
export interface CreateEntitySettings {
  id: string; // Required - derived from entity name
  kind: string;
  subtype: string;
  coordinates: import('../coordinates/types').Point;  // REQUIRED - simple 2D+z coordinates
  tags?: EntityTags;  // Optional - defaults to {}
  eraId?: string;  // Optional - era identifier for the entity
  name?: string;  // Optional - runtime may auto-generate if not provided
  description?: string;
  narrativeHint?: string;
  status: string;
  prominence: number;  // 0.0-5.0 numeric scale
  culture: string;
  temporal?: { startTick: number; endTick: number | null };
  source?: string;  // Optional - for debugging (e.g., template ID, system ID)
  placementStrategy?: string;  // Optional - for debugging (e.g., 'near_entity', 'in_culture_region')
  regionId?: string | null;  // Primary region containing this entity
  allRegionIds?: string[];   // All regions containing this entity (for overlapping regions)
}

export interface GrowthPhaseCompletion {
  epoch: number;
  eraId: string;
  tick: number;
  reason: 'target_met' | 'exhausted';
}

// Graph data representation (world state + mutations)
export interface Graph {
  // =============================================================================
  // ENTITY READ METHODS
  // =============================================================================
  getEntity(id: string): HardState | undefined;
  hasEntity(id: string): boolean;
  getEntityCount(options?: { includeHistorical?: boolean }): number;
  /** Get all entities. Excludes historical by default. */
  getEntities(options?: { includeHistorical?: boolean }): HardState[];
  getEntityIds(options?: { includeHistorical?: boolean }): string[];
  forEachEntity(callback: (entity: HardState, id: string) => void, options?: { includeHistorical?: boolean }): void;

  // Query methods
  findEntities(criteria: EntityCriteria): HardState[];
  getEntitiesByKind(kind: string, options?: { includeHistorical?: boolean }): HardState[];
  getConnectedEntities(entityId: string, relationKind?: string, direction?: 'src' | 'dst' | 'both', options?: { includeHistorical?: boolean }): HardState[];

  // =============================================================================
  // ENTITY MUTATION METHODS (framework-aware)
  // =============================================================================
  /**
   * Create a new entity with contract enforcement.
   * Enforces: id (required) → coordinates (required) → tags → name (auto-generated if not provided)
   * @returns The created entity's ID
   */
  createEntity(settings: CreateEntitySettings): Promise<string>;

  /**
   * Update an existing entity's properties
   */
  updateEntity(id: string, changes: Partial<HardState>): boolean;

  /**
   * Delete an entity from the graph
   */
  deleteEntity(id: string): boolean;

  /**
   * Load a pre-existing entity (from seed data or serialized state)
   * @internal Should only be used by WorldEngine for loading initial state
   */
  _loadEntity(id: string, entity: HardState): void;

  // =============================================================================
  // RELATIONSHIP READ METHODS (exclude historical by default)
  // =============================================================================
  /** Get all relationships. Excludes historical by default. */
  getRelationships(options?: { includeHistorical?: boolean }): Relationship[];
  /** Alias for getRelationships. Excludes historical by default. */
  getAllRelationships(options?: { includeHistorical?: boolean }): Relationship[];
  getRelationshipCount(options?: { includeHistorical?: boolean }): number;
  findRelationships(criteria: RelationshipCriteria): Relationship[];
  getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both', options?: { includeHistorical?: boolean }): Relationship[];
  hasRelationship(srcId: string, dstId: string, kind?: string): boolean;

  // =============================================================================
  // RELATIONSHIP MUTATION METHODS (framework-aware)
  // =============================================================================
  /**
   * Add a relationship between two entities with validation.
   * Distance is ALWAYS computed from Euclidean distance between coordinates.
   * @returns true if relationship was added, false if duplicate or invalid
   */
  addRelationship(kind: string, srcId: string, dstId: string, strength?: number, distanceIgnored?: number, category?: string): boolean;

  /**
   * Remove a specific relationship
   */
  removeRelationship(srcId: string, dstId: string, kind: string): boolean;

  /**
   * Bulk replace relationships (used by culling system)
   * @internal Should only be used by framework systems, not templates
   */
  _setRelationships(relationships: Relationship[]): void;

  // =============================================================================
  // OTHER GRAPH STATE (world state)
  // =============================================================================
  tick: number;
  currentEra: Era;
  pressures: Map<string, number>;
  /** Narrative events for story generation (optional, enabled via config) */
  narrativeHistory: NarrativeEvent[];
  relationshipCooldowns: Map<string, Map<string, number>>;
  // LLM-related fields moved to @illuminator
  // loreIndex?: LoreIndex;
  // loreRecords: LoreRecord[];
  rateLimitState: import('../core/worldTypes').RateLimitState;
  growthPhaseHistory: GrowthPhaseCompletion[];
  growthMetrics: {
    relationshipsPerTick: number[];
    averageGrowthRate: number;
  };
  subtypeMetrics?: Map<string, number>;
  protectedRelationshipViolations?: Array<{
    tick: number;
    violations: Array<{ kind: string; strength: number }>;
  }>;

  /**
   * Mutation tracker for lineage tracking.
   * Part of the unified lineage system - see LINEAGE.md.
   * When set, entity and relationship creation will stamp createdBy from current context.
   * Set by WorldEngine after graph creation.
   */
  mutationTracker?: MutationTracker;
}

// Criteria for finding entities
export interface EntityCriteria {
  kind?: string;
  subtype?: string;
  status?: string;
  prominence?: ProminenceLabel;  // Filter by prominence label (matches that level)
  culture?: string;
  tag?: string;  // Check if entity has this tag key
  exclude?: string[];  // Entity IDs to exclude
  /** Include historical entities (default: false) */
  includeHistorical?: boolean;
}

// Criteria for finding relationships
export interface RelationshipCriteria {
  kind?: string;
  src?: string;
  dst?: string;
  category?: string;
  minStrength?: number;
  /** Include historical relationships (default: false) */
  includeHistorical?: boolean;
}

// Growth template interface
export interface GrowthTemplate {
  id: string;
  name: string;
  requiredEra?: string[];  // optional era restrictions

  // Check if template can be applied
  // Uses WorldRuntime for safe, restricted graph access
  canApply: (graphView: import('../runtime/worldRuntime').WorldRuntime) => boolean;

  // Find valid targets for this template
  // Uses WorldRuntime for safe, restricted graph access
  findTargets: (graphView: import('../runtime/worldRuntime').WorldRuntime) => HardState[];

  // Execute the template on a target
  // Uses WorldRuntime which includes targetSelector for entity selection
  // Returns Promise to support async operations (e.g., name generation)
  expand: (graphView: import('../runtime/worldRuntime').WorldRuntime, target?: HardState) => Promise<TemplateResult> | TemplateResult;
}

/** Placement debug info for a single entity */
export interface PlacementDebug {
  anchorType: string;
  anchorEntity?: { id: string; name: string; kind: string };
  anchorCulture?: string;
  resolvedVia: string;
  seedRegionsAvailable?: string[];
  emergentRegionCreated?: { id: string; label: string };
  regionId?: string | null;
  allRegionIds?: string[];
}

export interface TemplateResult {
  entities: Partial<HardState>[];
  relationships: Relationship[];  // Can use placeholder IDs like 'will-be-assigned-0'
  description: string;
  placementStrategies?: string[];  // Optional - for debugging, parallel to entities array
  derivedTagsList?: Record<string, string | boolean>[];  // Tags derived from placement per entity
  placementDebugList?: PlacementDebug[];  // Detailed placement debug info per entity
  /**
   * Resolved context variables from template execution.
   * These are passed to growthSystem for narration generation AFTER entities have names.
   * Keys include $target, $enemy, etc. - the variables resolved during template expansion.
   */
  resolvedVariables?: Record<string, HardState | HardState[] | undefined>;
  /**
   * Maps entityRef (like $spell) to index in entities array.
   * Needed because createChance can skip entities, misaligning indices.
   */
  entityRefToIndex?: Record<string, number>;
}

// Simulation system interface
export interface SimulationSystem<TState = unknown> {
  id: string;
  name: string;

  /**
   * Optional internal state for systems that need to track data across ticks.
   * Examples: diffusion grids, accumulated statistics, cached computations.
   * This state persists for the lifetime of the simulation run.
   */
  state?: TState;

  /**
   * Optional initialization function called once before the first tick.
   * Use this to set up initial state (e.g., allocate grid arrays).
   */
  initialize?: () => void;

  // Run one tick of this system
  // graphView provides access to graph queries AND coordinate context
  // Returns Promise to support async operations (e.g., name generation)
  apply: (graphView: import('../runtime/worldRuntime').WorldRuntime, modifier: number) => Promise<SystemResult> | SystemResult;
}

/**
 * Action context for attribution in narrative events.
 * Used by systems like universalCatalyst to attribute modifications
 * to specific actions rather than the generic system.
 */
export interface ActionContext {
  source: import('@canonry/world-schema').ExecutionSource;
  sourceId: string;
  /** For actions: whether the action succeeded (false = failed attempt) */
  success?: boolean;
}

export interface SystemResult {
  relationshipsAdded: Array<Relationship & {
    /** Action context for narrative attribution (e.g., action:raid instead of system:universal_catalyst) */
    actionContext?: ActionContext;
    /** Narrative group ID for per-target event splitting (e.g., entity ID when clusterMode=individual) */
    narrativeGroupId?: string;
  }>;
  relationshipsAdjusted?: Array<{
    kind: string;
    src: string;
    dst: string;
    delta: number;
    /** Action context for narrative attribution */
    actionContext?: ActionContext;
    /** Narrative group ID for per-target event splitting */
    narrativeGroupId?: string;
  }>;
  /** Relationships to archive (deferred until worldEngine applies with proper context) */
  relationshipsToArchive?: Array<{
    kind: string;
    src: string;
    dst: string;
    /** Action context for narrative attribution */
    actionContext?: ActionContext;
    /** Narrative group ID for per-target event splitting */
    narrativeGroupId?: string;
  }>;
  entitiesModified: Array<{
    id: string;
    changes: Partial<HardState>;
    /** Action context for narrative attribution */
    actionContext?: ActionContext;
    /** Narrative group ID for per-target event splitting (e.g., entity ID when clusterMode=individual) */
    narrativeGroupId?: string;
  }>;
  pressureChanges: Record<string, number>;
  description: string;
  /** Optional structured details for system-specific information (e.g., era transitions) */
  details?: Record<string, unknown>;
  /**
   * Domain-controlled narration texts generated from rule narrationTemplates.
   * Each entry represents a narration for a specific rule application.
   * @deprecated Use narrationsByGroup for proper per-entity attribution
   */
  narrations?: string[];
  /**
   * Domain-controlled narrations keyed by narrative group ID.
   * Key is the narrativeGroupId (usually entity ID), value is the narration text.
   * This ensures proper attribution when a system affects multiple entities.
   */
  narrationsByGroup?: Record<string, string>;
}

// Component Purpose Taxonomy
// Defines the formal purpose of each framework component
export enum ComponentPurpose {
  // Creation purposes
  ENTITY_CREATION = 'Creates entities based on prerequisites',
  RELATIONSHIP_CREATION = 'Creates relationships based on graph patterns',

  // Modification purposes
  TAG_PROPAGATION = 'Spreads tags through relationship networks',
  STATE_MODIFICATION = 'Changes entity states based on context',
  PROMINENCE_EVOLUTION = 'Adjusts entity prominence over time',

  // Signal purposes
  PRESSURE_ACCUMULATION = 'Measures graph state to produce pressure signal',

  // Control purposes
  CONSTRAINT_ENFORCEMENT = 'Enforces population/density limits',
  PHASE_TRANSITION = 'Changes era based on conditions',
  BEHAVIORAL_MODIFIER = 'Modifies template weights or system frequencies'
}

/**
 * Filter criteria for finding ancestor entities.
 * Used by 'near_ancestor' placement type.
 * All specified fields must match (AND logic).
 */
export interface AncestorFilter {
  kind: string;
  subtype?: string;
  status?: string;
  /** If true, prefer ancestors with same culture as the new entity */
  sameCulture?: boolean;
  /** If true, exclude the new entity itself from results */
  excludeSelf?: boolean;
}

// Pressure Contract
// Contract for pressures including sources, sinks, and equilibrium model
export interface PressureContract {
  purpose: ComponentPurpose.PRESSURE_ACCUMULATION;

  // What creates this pressure
  sources: Array<{
    component: string;  // e.g., 'template.faction_splinter'
    delta?: number;     // Fixed amount
    formula?: string;   // Dynamic calculation
  }>;

  // What reduces this pressure
  sinks: Array<{
    component: string;  // e.g., 'system.peace_treaty'
    delta?: number;     // Fixed amount
    formula?: string;   // Dynamic calculation (e.g., 'value * 0.05')
  }>;

  // Override affects to be an array for pressures
  affects?: Array<{
    component: string;
    effect: 'enabler' | 'amplifier' | 'suppressor';
    threshold?: number;
    factor?: number;
  }>;

  // Expected equilibrium behavior
  equilibrium: {
    expectedRange: [number, number];  // [min, max] under normal operation (now [-100, 100])
    restingPoint: number;             // Where pressure settles with no stimuli (required: 0)
    oscillationPeriod?: number;       // Ticks for one cycle (if oscillating)
  };
}

// Entity Operator Registry
// Declares all operators (creators, modifiers, lineage) for an entity kind
// Can be at kind-level (e.g., 'npc') or subtype-level (e.g., 'npc:hero')
export interface EntityOperatorRegistry {
  kind: string;      // e.g., 'npc', 'faction', 'ability'
  subtype?: string;  // Optional: e.g., 'hero', 'cult', 'merchant' (for subtype-specific registries)

  // Templates that create this entity
  creators: Array<{
    templateId: string;
    primary: boolean;        // Is this a primary creator or incidental?
    targetCount?: number;    // Expected entities created per activation
  }>;

  // Systems that modify this entity
  modifiers: Array<{
    systemId: string;
    operation: 'state_change' | 'tag_modification' | 'prominence_change';
  }>;

  // Lineage function (called after any creator)
  lineage: {
    relationshipKind: string;  // e.g., 'derived_from', 'related_to'
    findAncestor: (graphView: import('../runtime/worldRuntime').WorldRuntime, newEntity: HardState) => HardState | undefined;
    distanceRange: { min: number; max: number };
  };

  // Expected distribution
  expectedDistribution: {
    targetCount: number;
    prominenceDistribution: Record<string, number>;  // e.g., { marginal: 0.6, recognized: 0.3, renowned: 0.1 }
  };
}

// Pressure definition (runtime - has executable growth function)
// This is internal to WorldEngine - external code uses DeclarativePressure
export interface Pressure {
  id: string;
  name: string;
  value: number;  // -100 to 100
  growth: (graph: Graph) => number;  // feedback delta per tick
  homeostasis: number;  // pull toward equilibrium (0)
  contract?: PressureContract;
}

// Engine configuration
export interface EngineConfig {
  // Canonry schema (canonical, no mapping)
  schema: CanonrySchemaSlice;

  eras: Era[];

  // Templates - declarative JSON format from UI
  // WorldEngine converts these to runtime GrowthTemplate objects internally
  templates: import('./declarativeTypes').DeclarativeTemplate[];

  // Systems - declarative JSON format from UI or runtime SimulationSystem objects
  // WorldEngine converts declarative systems to runtime objects internally
  systems: (SimulationSystem | import('./systemInterpreter').DeclarativeSystem)[];

  // Pressures - declarative JSON format from UI
  // WorldEngine converts these to runtime Pressure objects internally
  pressures: import('./declarativePressureTypes').DeclarativePressure[];

  // Actions - declarative JSON format from UI
  // WorldEngine converts these to runtime ExecutableAction objects for universalCatalyst
  actions?: import('./actionInterpreter').DeclarativeAction[];

  // Runtime executable actions - populated by WorldEngine from declarative actions
  // Used by universalCatalyst system to execute agent actions
  executableActions?: import('./actionInterpreter').ExecutableAction[];

  // Action usage tracking - populated by universalCatalyst when actions succeed
  // Used for diagnostics and validity checks (success-only)
  actionUsageTracker?: ActionUsageTracker;

  entityRegistries?: EntityOperatorRegistry[];

  // Configuration
  ticksPerEpoch: number;  // simulation ticks per epoch
  maxEpochs: number;      // maximum epochs to run
  maxTicks: number;
  maxRelationshipsPerType: number;  // max relationships of same type per entity
  relationshipBudget?: {
    maxPerSimulationTick: number;  // Hard cap on relationships per simulation tick
    maxPerGrowthPhase: number;     // Hard cap on relationships per growth phase
  };

  // Scaling configuration
  scaleFactor?: number;  // Master scale multiplier for world size (default: 1.0)

  // Default minimum distance between entities on semantic planes
  // Lower values = denser placement, higher values = sparser placement
  // Default: 5 (units on 0-100 normalized coordinate space)
  defaultMinDistance?: number;

  // Pressure delta smoothing limits max pressure change per tick
  // Higher values = faster pressure swings, lower values = smoother transitions
  // Default: 10 (max ±10 pressure change per tick from feedback)
  pressureDeltaSmoothing?: number;
  // LLM configuration moved to @illuminator
  // llmConfig?: LLMConfig;
  // enrichmentConfig?: EnrichmentConfig;
  // loreIndex?: LoreIndex;
  distributionTargets?: DistributionTargets;  // Optional per-subtype targets for homeostatic template weighting

  // Name generation service - created by WorldEngine from cultures, then set here
  // Graph uses this for entity name generation
  nameForgeService?: NameGenerationService;

  // Seed relationships (optional - loaded alongside initial entities)
  // Populates relationships at load time
  seedRelationships?: Relationship[];

  // Simulation event emitter (REQUIRED - no fallback)
  // Used to emit progress, logs, stats, and completion events
  emitter: ISimulationEmitter;

  // Debug configuration (optional - defaults to all debug disabled)
  debugConfig?: DebugConfig;

  // Narrative event tracking configuration (optional - defaults to disabled)
  narrativeConfig?: NarrativeConfig;
}

export interface ActionUsageTracker {
  applications: ActionApplicationPayload[];
  countsByActionId: Map<string, number>;
  countsByActorId: Map<string, { name: string; kind: string; count: number }>;
}

/**
 * Configuration for narrative event tracking.
 * When enabled, the engine captures semantically meaningful state changes
 * and generates NarrativeEvents for story generation.
 */
export interface NarrativeConfig {
  /** Enable narrative event tracking (default: true) */
  enabled: boolean;
  /** Minimum significance score to include event (default: 0) */
  minSignificance: number;
}

// Tag Taxonomy System
export interface TagMetadata {
  tag: string;                          // The tag itself
  category: 'status' | 'trait' | 'affiliation' | 'behavior' | 'theme' | 'location';
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  description: string;
  usageCount: number;                   // How many times this tag appears in tag-analysis.json
  templates: string[];                  // Which templates can apply this tag
  entityKinds: string[];                // Which entity kinds can have this tag

  // Governance rules
  minUsage?: number;                    // Minimum occurrences before tag is considered healthy
  maxUsage?: number;                    // Maximum occurrences (soft cap, for warnings)

  // Relationships with other tags
  relatedTags?: string[];               // Tags that commonly appear together
  conflictingTags?: string[];           // Tags that shouldn't coexist on same entity
  consolidateInto?: string;             // If set, this tag should be merged into another tag
}

export interface TagHealthReport {
  // Coverage metrics
  coverage: {
    totalEntities: number;
    entitiesWithTags: number;
    entitiesWithOptimalTags: number;    // 3-5 tags
    coveragePercentage: number;
    optimalCoveragePercentage: number;
  };

  // Diversity metrics
  diversity: {
    uniqueTags: number;
    shannonIndex: number;               // Entropy measure of tag distribution
    evenness: number;                   // How evenly distributed tags are (0-1)
  };

  // Quality issues
  issues: {
    orphanTags: Array<{ tag: string; count: number }>;           // Used 1-2 times
    overusedTags: Array<{ tag: string; count: number; max: number }>;
    conflicts: Array<{ entityId: string; tags: EntityTags; conflict: string }>;
    consolidationOpportunities: Array<{ from: string; to: string; count: number }>;
  };

  // Entity-level issues
  entityIssues: {
    undertagged: string[];              // Entities with < 3 tags
    overtagged: string[];               // Entities with > 5 tags (shouldn't happen due to constraint)
  };

  // Recommendations
  recommendations: string[];
}

/**
 * GraphStore - Concrete implementation of Graph with truly private storage
 *
 * Uses JavaScript private fields (#) for compile-time AND runtime enforcement.
 * External code cannot access #entities or #relationships directly.
 *
 * All mutations must go through designated methods.
 */
export class GraphStore implements Graph {
  // Truly private fields - not accessible outside this class
  #entities: Map<string, HardState> = new Map();
  #relationships: Relationship[] = [];

  // Public state
  tick: number = 0;
  currentEra!: Era;
  pressures: Map<string, number> = new Map();
  narrativeHistory: NarrativeEvent[] = [];
  relationshipCooldowns: Map<string, Map<string, number>> = new Map();
  // LLM fields moved to @illuminator
  // loreIndex?: LoreIndex;
  // loreRecords: LoreRecord[] = [];
  rateLimitState: import('../core/worldTypes').RateLimitState = {
    currentThreshold: 0.5,
    lastCreationTick: 0,
    creationsThisEpoch: 0
  };
  growthPhaseHistory: GrowthPhaseCompletion[] = [];
  growthMetrics: { relationshipsPerTick: number[]; averageGrowthRate: number } = {
    relationshipsPerTick: [],
    averageGrowthRate: 0
  };
  subtypeMetrics?: Map<string, number>;
  protectedRelationshipViolations?: Array<{
    tick: number;
    violations: Array<{ kind: string; strength: number }>;
  }>;

  /**
   * Mutation tracker for lineage tracking.
   * Part of the unified lineage system - see LINEAGE.md.
   * When set, entity and relationship creation will stamp createdBy from current context.
   */
  mutationTracker?: MutationTracker;

  // ===========================================================================
  // ENTITY READ METHODS
  // ===========================================================================

  getEntity(id: string): HardState | undefined {
    return this.#entities.get(id);
  }

  hasEntity(id: string): boolean {
    return this.#entities.has(id);
  }

  getEntityCount(options?: { includeHistorical?: boolean }): number {
    if (options?.includeHistorical) {
      return this.#entities.size;
    }
    let count = 0;
    for (const entity of this.#entities.values()) {
      if (entity.status !== FRAMEWORK_STATUS.HISTORICAL) count++;
    }
    return count;
  }

  getEntities(options?: { includeHistorical?: boolean }): HardState[] {
    const results: HardState[] = [];
    for (const e of this.#entities.values()) {
      if (!options?.includeHistorical && e.status === FRAMEWORK_STATUS.HISTORICAL) continue;
      results.push(e);
    }
    return results;
  }

  getEntityIds(options?: { includeHistorical?: boolean }): string[] {
    if (options?.includeHistorical) {
      return Array.from(this.#entities.keys());
    }
    const ids: string[] = [];
    for (const [id, entity] of this.#entities) {
      if (entity.status !== FRAMEWORK_STATUS.HISTORICAL) ids.push(id);
    }
    return ids;
  }

  forEachEntity(callback: (entity: HardState, id: string) => void, options?: { includeHistorical?: boolean }): void {
    this.#entities.forEach((entity, id) => {
      if (!options?.includeHistorical && entity.status === FRAMEWORK_STATUS.HISTORICAL) return;
      callback(entity, id);
    });
  }

  findEntities(criteria: EntityCriteria): HardState[] {
    const results: HardState[] = [];
    for (const [id, entity] of this.#entities) {
      // Filter historical by default unless explicitly included
      if (!criteria.includeHistorical && entity.status === FRAMEWORK_STATUS.HISTORICAL) continue;
      if (criteria.exclude?.includes(id)) continue;
      if (criteria.kind && criteria.kind !== 'any' && entity.kind !== criteria.kind) continue;
      if (criteria.subtype && entity.subtype !== criteria.subtype) continue;
      if (criteria.status && entity.status !== criteria.status) continue;
      if (criteria.prominence && prominenceLabel(entity.prominence) !== criteria.prominence) continue;
      if (criteria.culture && entity.culture !== criteria.culture) continue;
      if (criteria.tag && !(criteria.tag in entity.tags)) continue;
      results.push(entity);
    }
    return results;
  }

  getEntitiesByKind(kind: string, options?: { includeHistorical?: boolean }): HardState[] {
    return this.findEntities({ kind, includeHistorical: options?.includeHistorical });
  }

  getConnectedEntities(
    entityId: string,
    relationKind?: string,
    direction: 'src' | 'dst' | 'both' = 'both',
    options?: { includeHistorical?: boolean }
  ): HardState[] {
    const connectedIds = new Set<string>();
    for (const rel of this.#relationships) {
      // Skip historical relationships by default
      if (!options?.includeHistorical && rel.status === FRAMEWORK_STATUS.HISTORICAL) continue;
      if (relationKind && rel.kind !== relationKind) continue;
      // Direction filtering: 'src' means entity is src, 'dst' means entity is dst
      if (direction === 'src' || direction === 'both') {
        if (rel.src === entityId) connectedIds.add(rel.dst);
      }
      if (direction === 'dst' || direction === 'both') {
        if (rel.dst === entityId) connectedIds.add(rel.src);
      }
    }
    return Array.from(connectedIds)
      .map(id => this.getEntity(id))
      .filter((e): e is HardState => {
        if (!e) return false;
        // Also filter historical entities by default
        if (!options?.includeHistorical && e.status === FRAMEWORK_STATUS.HISTORICAL) return false;
        return true;
      });
  }

  // ===========================================================================
  // ENTITY MUTATION METHODS (framework-aware)
  // ===========================================================================

  /**
   * Create a new entity with contract enforcement.
   * Enforces: id (required) → coordinates (required) → tags → name (auto-generated if not provided)
   */
  async createEntity(settings: CreateEntitySettings): Promise<string> {
    const id = settings.id;
    if (!id) {
      throw new Error(
        `createEntity: id is required for all entities. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}.`
      );
    }
    if (this.#entities.has(id)) {
      throw new Error(
        `createEntity: id "${id}" already exists. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}.`
      );
    }

    // COORDINATES are REQUIRED - no silent defaults
    if (!settings.coordinates) {
      throw new Error(
        `createEntity: coordinates are required for all entities. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}. ` +
        `Provide coordinates explicitly.`
      );
    }

    const { x, y, z } = settings.coordinates as any;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      throw new Error(
        `createEntity: coordinates must include numeric x, y, z values. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}. ` +
        `Received: ${JSON.stringify(settings.coordinates)}.`
      );
    }

    // Tags default to empty object - IMPORTANT: clone to avoid mutating source
    const tags: EntityTags = { ...(settings.tags || {}) };

    const name = settings.name;
    if (!name) {
      throw new Error(
        `createEntity: name is required for GraphStore. ` +
        `Runtime should generate names before calling createEntity. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}.`
      );
    }

    if (!settings.culture) {
      throw new Error(
        `createEntity: culture is required for all entities. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}.`
      );
    }
    if (settings.culture.startsWith('$')) {
      throw new Error(
        `createEntity: culture must be a resolved value, not a variable reference. ` +
        `Received: ${settings.culture}. Entity kind: ${settings.kind}, subtype: ${settings.subtype}.`
      );
    }
    if (!settings.status) {
      throw new Error(
        `createEntity: status is required for all entities. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}.`
      );
    }
    if (settings.prominence == null) {
      throw new Error(
        `createEntity: prominence is required for all entities. ` +
        `Entity kind: ${settings.kind}, subtype: ${settings.subtype}.`
      );
    }

    // Build the full entity with lineage if mutation tracker has context
    const entity: HardState = {
      id,
      kind: settings.kind,
      subtype: settings.subtype,
      name,
      description: settings.description || '',
      narrativeHint: settings.narrativeHint,
      status: settings.status,
      prominence: settings.prominence,
      culture: settings.culture,
      tags,
      eraId: settings.eraId,
      coordinates: settings.coordinates,
      temporal: settings.temporal,
      regionId: settings.regionId,
      allRegionIds: settings.allRegionIds,
      createdAt: this.tick,
      updatedAt: this.tick,
      // Lineage: stamp createdBy from current execution context (see LINEAGE.md)
      createdBy: this.mutationTracker?.getCurrentContext() ?? undefined,
    };

    this.#entities.set(id, entity);

    // Record entity creation for context-based event generation
    this.mutationTracker?.recordEntityCreated({
      entityId: id,
      kind: entity.kind,
      subtype: entity.subtype,
      name: entity.name,
      culture: entity.culture,
      prominence: prominenceLabel(entity.prominence),
      status: entity.status,
      tags: entity.tags,
    });

    return id;
  }

  // Debug flag for tracing prominence mutations - set to true to enable logging
  static DEBUG_PROMINENCE = false;

  updateEntity(id: string, changes: Partial<HardState>): boolean {
    const entity = this.#entities.get(id);
    if (!entity) return false;

    // Debug logging for prominence changes
    if (GraphStore.DEBUG_PROMINENCE && 'prominence' in changes) {
      const oldProm = entity.prominence;
      const newProm = changes.prominence!;
      if (oldProm !== newProm) {
        const oldLabel = prominenceLabel(oldProm);
        const newLabel = prominenceLabel(newProm);
        console.log(`[PROMINENCE] tick=${this.tick} entity=${entity.name} (${id}): ${oldLabel} (${oldProm.toFixed(2)}) -> ${newLabel} (${newProm.toFixed(2)})`);
      } else {
        console.log(`[PROMINENCE-NOOP] tick=${this.tick} entity=${entity.name} (${id}): ${oldProm.toFixed(2)} (no change)`);
      }
    }

    // Record field changes to MutationTracker for context-based event generation
    if (this.mutationTracker) {
      // Track tag changes - only PRESENCE changes, not value updates
      // System tracking tags (like "temperature=45") update values every tick,
      // which is not narratively interesting. We only care when tags are added/removed.
      if (changes.tags !== undefined) {
        const oldTags = entity.tags || {};
        const newTags = changes.tags || {};

        // Find truly NEW tags (tag didn't exist before)
        for (const [tag, value] of Object.entries(newTags)) {
          if (!(tag in oldTags)) {
            this.mutationTracker.recordTagAdded(id, tag, value);
          }
          // Value changes on existing tags are not tracked - not narratively interesting
        }

        // Find removed tags
        for (const tag of Object.keys(oldTags)) {
          if (!(tag in newTags)) {
            this.mutationTracker.recordTagRemoved(id, tag);
          }
        }
      }

      // Track other field changes (status, prominence, etc.)
      const trackedFields = ['status', 'prominence', 'culture'] as const;
      for (const field of trackedFields) {
        if (field in changes && changes[field] !== entity[field]) {
          this.mutationTracker.recordFieldChanged(
            id,
            field,
            entity[field],
            changes[field]
          );
        }
      }
    }

    Object.assign(entity, changes, { updatedAt: this.tick });
    return true;
  }

  deleteEntity(id: string): boolean {
    return this.#entities.delete(id);
  }

  /**
   * Load a pre-existing entity (from seed data or serialized state)
   * @internal Should only be used by WorldEngine for loading initial state
   */
  _loadEntity(id: string, entity: HardState): void {
    this.#entities.set(id, entity);
  }

  // ===========================================================================
  // RELATIONSHIP READ METHODS (exclude historical by default)
  // ===========================================================================

  getRelationships(options?: { includeHistorical?: boolean }): Relationship[] {
    return this.#relationships
      .filter(r => options?.includeHistorical || r.status !== FRAMEWORK_STATUS.HISTORICAL);
  }

  getAllRelationships(options?: { includeHistorical?: boolean }): Relationship[] {
    return this.getRelationships(options);
  }

  getRelationshipCount(options?: { includeHistorical?: boolean }): number {
    if (options?.includeHistorical) {
      return this.#relationships.length;
    }
    return this.#relationships.filter(r => r.status !== FRAMEWORK_STATUS.HISTORICAL).length;
  }

  findRelationships(criteria: RelationshipCriteria): Relationship[] {
    return this.#relationships.filter(rel => {
      // Filter historical by default unless explicitly included
      if (!criteria.includeHistorical && rel.status === FRAMEWORK_STATUS.HISTORICAL) return false;
      if (criteria.kind && rel.kind !== criteria.kind) return false;
      if (criteria.src && rel.src !== criteria.src) return false;
      if (criteria.dst && rel.dst !== criteria.dst) return false;
      if (criteria.category && rel.category !== criteria.category) return false;
      if (criteria.minStrength !== undefined && (rel.strength ?? 0) < criteria.minStrength) return false;
      return true;
    });
  }

  getEntityRelationships(entityId: string, direction: 'src' | 'dst' | 'both' = 'both', options?: { includeHistorical?: boolean }): Relationship[] {
    return this.#relationships.filter(rel => {
      // Filter historical by default
      if (!options?.includeHistorical && rel.status === FRAMEWORK_STATUS.HISTORICAL) return false;
      if (direction === 'src') return rel.src === entityId;
      if (direction === 'dst') return rel.dst === entityId;
      return rel.src === entityId || rel.dst === entityId;
    });
  }

  hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
    // hasRelationship checks for active relationships only
    return this.#relationships.some(rel =>
      rel.status !== FRAMEWORK_STATUS.HISTORICAL &&
      rel.src === srcId && rel.dst === dstId && (kind === undefined || rel.kind === kind)
    );
  }

  // ===========================================================================
  // RELATIONSHIP MUTATION METHODS (framework-aware)
  // ===========================================================================

  /**
   * Add a relationship with validation.
   * Checks for duplicates and validates that both entities exist.
   * Distance is ALWAYS computed from Euclidean distance between entity coordinates.
   * @returns true if relationship was added, false if duplicate or invalid
   */
  addRelationship(kind: string, srcId: string, dstId: string, strength?: number, _distanceIgnored?: number, category?: string): boolean {
    // Validate entities exist
    const srcEntity = this.#entities.get(srcId);
    const dstEntity = this.#entities.get(dstId);

    if (!srcEntity || !dstEntity) {
      return false;
    }

    // Check for duplicate
    const exists = this.#relationships.some(
      r => r.src === srcId && r.dst === dstId && r.kind === kind
    );
    if (exists) {
      return false;  // Duplicate - silently skip
    }

    // Compute distance from coordinates (relationship.distance === Euclidean distance)
    let distance: number | undefined;
    if (srcEntity.coordinates && dstEntity.coordinates) {
      const dx = srcEntity.coordinates.x - dstEntity.coordinates.x;
      const dy = srcEntity.coordinates.y - dstEntity.coordinates.y;
      const dz = (srcEntity.coordinates.z ?? 0) - (dstEntity.coordinates.z ?? 0);
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // Build relationship with lineage if mutation tracker has context
    const relationship: Relationship = {
      kind,
      src: srcId,
      dst: dstId,
      strength: strength ?? 0.5,
      distance,
      category,
      status: 'active',
      createdAt: this.tick,
      // Lineage: stamp createdBy from current execution context (see LINEAGE.md)
      createdBy: this.mutationTracker?.getCurrentContext() ?? undefined,
    };

    this.#relationships.push(relationship);

    // Record relationship creation for context-based event generation
    this.mutationTracker?.recordRelationshipCreated({
      srcId,
      dstId,
      kind,
      strength: relationship.strength,
    });

    srcEntity.updatedAt = this.tick;
    dstEntity.updatedAt = this.tick;

    return true;
  }

  removeRelationship(srcId: string, dstId: string, kind: string): boolean {
    const index = this.#relationships.findIndex(
      r => r.src === srcId && r.dst === dstId && r.kind === kind
    );
    if (index === -1) return false;
    this.#relationships.splice(index, 1);

    const srcEntity = this.#entities.get(srcId);
    const dstEntity = this.#entities.get(dstId);
    if (srcEntity) srcEntity.updatedAt = this.tick;
    if (dstEntity) dstEntity.updatedAt = this.tick;
    return true;
  }

  /**
   * Bulk replace relationships (used by culling system)
   * @internal Should only be used by framework systems
   */
  _setRelationships(relationships: Relationship[]): void {
    this.#relationships = relationships;
  }

  /**
   * Create a new GraphStore with initial configuration
   */
  static create(initialEra: Era, pressures: Array<{ id: string; initialValue?: number }>): GraphStore {
    const store = new GraphStore();
    store.currentEra = initialEra;

    // Initialize pressures from declarative pressure list
    for (const pressure of pressures) {
      if (typeof (pressure as any).initialValue !== 'number') {
        throw new Error(`Pressure '${(pressure as any).id}' is missing initialValue.`);
      }
      const clamped = Math.max(-100, Math.min(100, (pressure as any).initialValue));
      store.pressures.set(pressure.id, clamped);
    }

    return store;
  }
}
