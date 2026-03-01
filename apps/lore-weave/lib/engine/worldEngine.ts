import { Graph, GraphStore, EngineConfig, Era, GrowthTemplate, Pressure, SimulationSystem, SystemResult, EpochEraSummary, EpochEraTransitionSummary } from '../engine/types';
import { createPressureFromDeclarative, evaluatePressureGrowthWithBreakdown } from './pressureInterpreter';
import { DeclarativePressure } from './declarativePressureTypes';
import { TemplateInterpreter, createTemplateFromDeclarative } from './templateInterpreter';
import { DeclarativeTemplate } from './declarativeTypes';
import { createSystemFromDeclarative, DeclarativeSystem, DeclarativeGrowthSystem, isDeclarativeSystem } from './systemInterpreter';
import { loadActions } from './actionInterpreter';
import { HardState, Relationship } from '../core/worldTypes';
import {
  generateEntityIdFromName,
  addRelationship,
  modifyRelationshipStrength,
  updateEntity,
  pickRandom,
  weightedRandom,
  findEntities,
  hasTag
} from '../utils';
import { archiveRelationship } from '../graph/relationshipMutation';
import { initializeCatalystSmart } from '../systems/catalystHelpers';
import { getTemplateWeight, getSystemModifier } from '../engine/eraUtils';
import { StatisticsCollector } from '../statistics/statisticsCollector';
import { PopulationTracker, PopulationMetrics } from '../statistics/populationTracker';
import { DynamicWeightCalculator } from '../selection/dynamicWeightCalculator';
import { TargetSelector } from '../selection/targetSelector';
import { WorldRuntime } from '../runtime/worldRuntime';
import { CoordinateContext } from '../coordinates/coordinateContext';
import { coordinateStats } from '../coordinates/coordinateStatistics';
import { DistributionTargets, SimulationStatistics, ValidationStats } from '../statistics/types';
import { FrameworkValidator } from './frameworkValidator';
import { ContractEnforcer } from './contractEnforcer';
import { FRAMEWORK_ENTITY_KINDS, FRAMEWORK_STATUS, FRAMEWORK_TAGS, type ExecutionSource, type NarrativeEvent } from '@canonry/world-schema';
import { applyTagPatch } from '../rules';
import { createEraEntity } from '../systems/eraSpawner';
import type {
  ISimulationEmitter,
  PressureChangeDetail,
  DiscretePressureModification,
  PressureModificationSource
} from '../observer/types';
import { NameForgeService } from '../naming/nameForgeService';
import type { NameGenerationService } from './types';
import { createGrowthSystem, GrowthSystem, GrowthEpochSummary } from '../systems/growthSystem';
import { checkTransitionConditions } from '../systems/eraTransition';
import { StateChangeTracker, createDefaultNarrativeConfig } from '../narrative/index.js';
import { MutationTracker } from '../narrative/mutationTracker.js';

// Change detection functions moved to @illuminator/lib/engine/changeDetection.ts
// EntitySnapshot interface and detect*Changes functions available there

const LORE_WEAVE_VERSION = '2025-12-23.1';

export class WorldEngine {
  private config: EngineConfig;
  private emitter: ISimulationEmitter;  // REQUIRED - emits all simulation events
  private runtimePressures!: Pressure[];  // Converted from declarative pressures
  private declarativePressures!: Map<string, DeclarativePressure>;  // Original declarative pressures for breakdown
  private runtimeTemplates!: GrowthTemplate[];  // Converted from declarative templates
  private declarativeTemplates!: Map<string, DeclarativeTemplate>;  // Original declarative templates for diagnostics
  private runtimeSystems!: SimulationSystem[];  // Converted from declarative systems
  private growthSystem?: GrowthSystem;  // Distributed growth system (framework-managed)
  private templateInterpreter!: TemplateInterpreter;  // Interprets declarative templates
  private graph: Graph;
  private runtime!: WorldRuntime;
  private currentEpoch: number;
  private epochEra: Era | null = null;
  private epochEraTransitions: EpochEraTransitionSummary[] = [];
  private startTime: number = 0;  // Track simulation duration
  private simulationRunId: string = '';  // Unique ID for this simulation run
  private statisticsCollector: StatisticsCollector;  // Statistics tracking for fitness evaluation
  private populationTracker: PopulationTracker;  // Population metrics for homeostatic control
  private dynamicWeightCalculator: DynamicWeightCalculator;  // Dynamic template weight adjustment
  private contractEnforcer: ContractEnforcer;  // Active contract enforcement
  // Enrichment tracking moved to @illuminator
  // private pendingEnrichments: Promise<void>[] = [];
  // private pendingNameEnrichments: Promise<void>[] = [];
  // private entityEnrichmentsUsed = 0;
  // private relationshipEnrichmentsUsed = 0;
  // private eraNarrativesUsed = 0;
  // private entityEnrichmentQueue: HardState[] = [];
  // private readonly ENRICHMENT_BATCH_SIZE = 15;

  // Engine-level safeguards
  private systemMetrics: Map<string, { relationshipsCreated: number; lastThrottleCheck: number }> = new Map();
  private lastRelationshipCount: number = 0;

  // Template diversity tracking
  private templateRunCounts: Map<string, number> = new Map();
  // DIVERSITY PRESSURE: Track template usage frequency to enforce variety
  // Hard cap per template (scaled by config.scaleFactor)
  private maxRunsPerTemplate: number;
  // Growth target bounds (min, max) - max scaled by config.scaleFactor
  private growthBounds: { min: number; max: number };
  private targetTotalsByKind: Map<string, number> = new Map();
  private totalTargetEntities: number = 0;
  // Track growth output per epoch for diagnostics/emissions
  private lastGrowthSummary: GrowthEpochSummary | null = null;

  // Target selection service (prevents super-hub formation)
  private targetSelector: TargetSelector;

  // Coordinate context (shared across all templates/systems)
  private coordinateContext: CoordinateContext;

  // Name generation service (created from cultures config)
  private nameForgeService: NameGenerationService | null = null;

  // Change detection moved to @illuminator
  // private entitySnapshots = new Map<string, EntitySnapshot>();
  // private enrichmentAnalytics = { ... };

  // Meta-entity formation tracking
  private metaEntitiesFormed: Array<{
    tick: number;
    epoch: number;
    metaEntityId: string;
    metaEntityName: string;
    sourceKind: string;
    clusterSize: number;
    clusterIds: string[];
  }> = [];

  // Pressure modification tracking - accumulates discrete changes per tick
  private pendingPressureModifications: DiscretePressureModification[] = [];

  // Starting pressure values for each tick (captured before any modifications)
  private tickStartPressures: Map<string, number> = new Map();

  // Narrative event tracking (captures state changes for story generation)
  private stateChangeTracker: StateChangeTracker;

  /**
   * Mutation tracker for lineage tracking.
   * Part of the unified lineage system - see lib/narrative/LINEAGE.md.
   * Tracks execution context for entity/relationship creation and tag/field changes.
   */
  private mutationTracker: MutationTracker;

  private reachabilityComponents: number | null = null;
  private fullyConnectedTick: number | null = null;

  constructor(
    config: EngineConfig,
    initialState: HardState[]
  ) {
    // REQUIRED: Emitter must be provided - no fallback to console.log
    if (!config.emitter) {
      throw new Error(
        'WorldEngine: emitter is required in EngineConfig. ' +
        'Provide a SimulationEmitter instance that handles simulation events.'
      );
    }
    if (!config.schema) {
      throw new Error(
        'WorldEngine: schema is required in EngineConfig. ' +
        'Provide the canonical world schema used to run the simulation.'
      );
    }
    this.emitter = config.emitter;
    this.config = config;

    const isExplicitlyDisabled = (value: unknown): boolean =>
      typeof value === 'object' &&
      value !== null &&
      'enabled' in value &&
      (value as { enabled?: unknown }).enabled === false;

    const isGrowthSystem = (system: SimulationSystem | DeclarativeSystem): boolean => {
      if (isDeclarativeSystem(system)) {
        return system.systemType === 'growth';
      }
      return system.id === 'growth' || system.id === 'framework-growth';
    };

    const hasDisabledGrowthSystem = config.systems
      .some(system => isExplicitlyDisabled(system) && isGrowthSystem(system));

    const activeSystems = config.systems.filter(system => !isExplicitlyDisabled(system));
    if (activeSystems.length !== config.systems.length) {
      config.systems = activeSystems;
    }

    const activeTemplates = config.templates.filter(template => !isExplicitlyDisabled(template));
    if (activeTemplates.length !== config.templates.length) {
      config.templates = activeTemplates;
    }

    // Set prominence debug flags based on debug config
    const prominenceDebugEnabled = config.debugConfig?.enabled &&
      (config.debugConfig.enabledCategories.length === 0 ||
       config.debugConfig.enabledCategories.includes('prominence'));
    GraphStore.DEBUG_PROMINENCE = prominenceDebugEnabled ?? false;
    StateChangeTracker.DEBUG_PROMINENCE = prominenceDebugEnabled ?? false;

    // Emit initializing progress
    this.emitter.progress({
      phase: 'initializing',
      tick: 0,
      maxTicks: config.maxTicks,
      epoch: 0,
      totalEpochs: this.getTotalEpochs(),
      entityCount: initialState.length,
      relationshipCount: 0
    });

    // Convert declarative pressures, templates, and actions to runtime objects
    this.initializePressures(config);
    this.initializeTemplates(config);
    this.initializeActions(config);

    this.statisticsCollector = new StatisticsCollector();
    this.currentEpoch = 0;

    // Initialize scaled values
    const scale = config.scaleFactor || 1.0;
    // Scale maxRunsPerTemplate more aggressively (1.5 exponent) to handle
    // cases where only a subset of templates are applicable in early epochs
    // INCREASED: From 12 to 20 to prevent template starvation in later epochs
    this.maxRunsPerTemplate = Math.ceil(20 * Math.pow(scale, 1.5));
    this.growthBounds = {
      min: 0,
      max: Infinity  // No hard cap - let distribution targets drive growth
    };

    // Emit validating progress
    this.emitter.progress({
      phase: 'validating',
      tick: 0,
      maxTicks: config.maxTicks,
      epoch: 0,
      totalEpochs: this.getTotalEpochs(),
      entityCount: initialState.length,
      relationshipCount: 0
    });

    // Framework Validation
    const validator = new FrameworkValidator(config);
    const validationResult = validator.validate();

    // Emit validation result
    this.emitter.validation({
      status: validationResult.errors.length > 0 ? 'failed' : 'success',
      errors: validationResult.errors,
      warnings: validationResult.warnings
    });

    // Throw on validation errors
    if (validationResult.errors.length > 0) {
      const errorDetails = validationResult.errors.join('\n  - ');
      this.emitter.error({
        message: `Framework validation failed with ${validationResult.errors.length} error(s):\n  - ${errorDetails}`,
        phase: 'validation',
        context: { errors: validationResult.errors }
      });
      throw new Error(`Framework validation failed with ${validationResult.errors.length} error(s):\n  - ${errorDetails}`);
    }

    this.emitter.log('info', `Lore Weave version ${LORE_WEAVE_VERSION}`);
    this.emitter.log('info', 'Framework validation passed');

    // Initialize homeostatic control system
    const distributionTargets = config.distributionTargets ?? {
      version: '1.0.0',
      entities: {}
    };
    if (!distributionTargets.entities || Array.isArray(distributionTargets.entities)) {
      throw new Error('distributionTargets.entities must be an object keyed by kind/subtype.');
    }
    this.config.distributionTargets = distributionTargets;
    const { totalsByKind, total } = this.computeTargetTotals(distributionTargets);
    this.targetTotalsByKind = totalsByKind;
    this.totalTargetEntities = total;
    this.populationTracker = new PopulationTracker(distributionTargets, config.schema);
    this.dynamicWeightCalculator = new DynamicWeightCalculator();
    this.emitter.log('info', 'Population tracking enabled');

    // Initialize contract enforcement system
    this.contractEnforcer = new ContractEnforcer(config);
    this.emitter.log('info', 'Contract enforcement enabled', {
      features: [
        'Template filtering by applicability rules',
        'Automatic lineage relationship creation',
        'Contract affects validation'
      ]
    });

    // Initialize target selector (prevents super-hub formation)
    this.targetSelector = new TargetSelector();
    this.emitter.log('info', 'Intelligent target selection enabled (anti-super-hub)');

    // Initialize mutation tracker (lineage system - see LINEAGE.md)
    this.mutationTracker = new MutationTracker();

    // Initialize narrative event tracking
    this.initializeNarrativeTracking(config);

    // Initialize NameForgeService from schema cultures that have naming config
    // Must be done before CoordinateContext since it requires nameForgeService
    const schemaCultures = config.schema.cultures;
    if (!schemaCultures || schemaCultures.length === 0) {
      throw new Error(
        'WorldEngine: schema.cultures is required in EngineConfig. ' +
        'Provide cultures with naming configuration for name generation.'
      );
    }
    const culturesWithNaming = schemaCultures.filter(c => c.naming);
    if (culturesWithNaming.length === 0) {
      throw new Error(
        'WorldEngine: No cultures have naming configuration. ' +
        'At least one culture must have a naming property for name generation.'
      );
    }
    this.nameForgeService = new NameForgeService(culturesWithNaming, this.emitter);
    // Set on config so Graph can access it for entity name generation
    this.config.nameForgeService = this.nameForgeService;
    this.emitter.log('info', 'NameForgeService initialized', {
      cultures: culturesWithNaming.length,
      cultureIds: culturesWithNaming.map(c => c.id)
    });

    // Initialize coordinate context (REQUIRED - no fallbacks)
    const coordinateConfig = {
      schema: config.schema,
      defaultMinDistance: config.defaultMinDistance,
      nameForgeService: this.nameForgeService,
    };
    this.coordinateContext = new CoordinateContext(coordinateConfig);
    this.emitter.log('info', 'Coordinate context initialized', {
      cultures: this.coordinateContext.getCultureIds().length,
      entityKinds: this.coordinateContext.getConfiguredKinds().length,
      defaultMinDistance: config.defaultMinDistance ?? 5
    });

    // Build runtime systems (including new distributed growth system)
    this.initializeRuntimeSystems(config, hasDisabledGrowthSystem);

    // Meta-entity formation is now handled by SimulationSystems (magicSchoolFormation, etc.)
    // These systems run at epoch end and use the clustering/archival utilities

    // Initialize graph from initial state using GraphStore
    this.graph = GraphStore.create(config.eras[0], config.pressures);
    // Set mutation tracker for lineage stamping (see LINEAGE.md)
    this.graph.mutationTracker = this.mutationTracker;
    // LLM loreIndex moved to @illuminator
    // Override rate limit state defaults
    this.graph.rateLimitState = {
      currentThreshold: 0.3,  // Base threshold
      lastCreationTick: -999,  // Start far in past so first creation can happen
      creationsThisEpoch: 0
    };

    this.runtime = new WorldRuntime(this.graph, this.targetSelector, this.coordinateContext, this.config);
    
    // Load initial entities and initialize catalysts
    this.loadInitialEntities(initialState);

    // Load relationships from seedRelationships array
    this.loadSeedRelationships();

    // Create genesis narrative event for seed entities
    const genesisEvent = this.buildGenesisEvent(config.eras[0].id);
    if (genesisEvent) {
      this.graph.narrativeHistory.push(genesisEvent);
    }
  }

  // ===========================================================================
  // CONSTRUCTOR HELPERS (extracted from constructor for cognitive complexity)
  // ===========================================================================

  private initializePressures(config: EngineConfig): void {
    this.declarativePressures = new Map();
    this.runtimePressures = config.pressures.map(p => {
      if (typeof p.growth === 'function') {
        throw new Error(`Pressure '${p.id}' must be declarative. Runtime pressure objects are no longer supported.`);
      }
      this.declarativePressures.set(p.id, p);
      return createPressureFromDeclarative(p);
    });
  }

  private initializeTemplates(config: EngineConfig): void {
    this.templateInterpreter = new TemplateInterpreter();
    this.declarativeTemplates = new Map();
    this.runtimeTemplates = config.templates.map(t => {
      if ('canApply' in t && typeof (t as unknown as Record<string, unknown>).canApply === 'function') {
        return t as unknown as GrowthTemplate;
      }
      this.declarativeTemplates.set(t.id, t);
      return createTemplateFromDeclarative(t, this.templateInterpreter);
    });
  }

  private initializeActions(config: EngineConfig): void {
    if (config.actions && config.actions.length > 0) {
      config.executableActions = loadActions(config.actions);
    }
    config.actionUsageTracker = {
      applications: [],
      countsByActionId: new Map<string, number>(),
      countsByActorId: new Map<string, { name: string; kind: string; count: number }>()
    };
  }

  private initializeNarrativeTracking(config: EngineConfig): void {
    const narrative = config.narrativeConfig ?? createDefaultNarrativeConfig();
    this.stateChangeTracker = new StateChangeTracker(narrative, this.mutationTracker);
    this.stateChangeTracker.setSchema({
      relationshipKinds: config.schema.relationshipKinds,
      entityKinds: config.schema.entityKinds,
      tagRegistry: config.schema.tagRegistry,
    });

    // Populate system and action display names for narrative descriptions
    const sourceNames = this.collectSourceNames(config);
    this.stateChangeTracker.setSystemNames(sourceNames);

    if (narrative.enabled) {
      this.emitter.log('info', 'Narrative event tracking enabled', {
        minSignificance: narrative.minSignificance,
      });
    }
  }

  private collectSourceNames(config: EngineConfig): Array<{ id: string; name: string }> {
    const sourceNames: Array<{ id: string; name: string }> = [];
    sourceNames.push(...this.collectSystemSourceNames(config.systems));
    sourceNames.push(...this.collectActionSourceNames(config.executableActions));
    sourceNames.push(...(config.templates ?? []).map(t => ({ id: t.id, name: t.name || t.id })));
    sourceNames.push(...(config.eras ?? []).map(e => ({ id: e.id, name: e.name || e.id })));
    return sourceNames;
  }

  private collectSystemSourceNames(
    systems: EngineConfig['systems']
  ): Array<{ id: string; name: string }> {
    const names: Array<{ id: string; name: string }> = [];
    for (const sys of systems) {
      if ('systemType' in sys && sys.config) {
        const id = sys.config.id || sys.systemType;
        const name = sys.config.name || id;
        names.push({ id, name });
      } else if ('id' in sys) {
        names.push({ id: sys.id, name: sys.name || sys.id });
      }
    }
    return names;
  }

  private collectActionSourceNames(
    actions: EngineConfig['executableActions']
  ): Array<{ id: string; name: string }> {
    if (!actions) return [];
    return actions.map(a => ({ id: a.type, name: a.name || a.type }));
  }

  private initializeRuntimeSystems(config: EngineConfig, hasDisabledGrowthSystem: boolean): void {
    const runtimeSystems: SimulationSystem[] = [];
    const growthDependencies = {
      engineConfig: this.config,
      runtimeTemplates: this.runtimeTemplates,
      declarativeTemplates: this.declarativeTemplates,
      templateInterpreter: this.templateInterpreter,
      populationTracker: this.populationTracker,
      contractEnforcer: this.contractEnforcer,
      templateRunCounts: this.templateRunCounts,
      maxRunsPerTemplate: this.maxRunsPerTemplate,
      statisticsCollector: this.statisticsCollector,
      emitter: this.emitter,
      stateChangeTracker: this.stateChangeTracker,
      mutationTracker: this.mutationTracker,
      getPendingPressureModifications: () => this.pendingPressureModifications,
      trackPressureModification: this.trackPressureModification.bind(this),
      calculateGrowthTarget: () => this.calculateGrowthTarget(),
      sampleTemplate: (era: Era, templates: GrowthTemplate[], metrics: PopulationMetrics) => this.sampleSingleTemplate(era, templates, metrics),
      getCurrentEpoch: () => this.currentEpoch,
      getEpochEra: () => this.epochEra ?? this.graph.currentEra
    };

    for (const sys of config.systems) {
      this.classifySystem(sys, runtimeSystems, growthDependencies);
    }

    if (!this.growthSystem && !hasDisabledGrowthSystem) {
      this.growthSystem = createGrowthSystem(
        { id: 'framework-growth', name: 'Framework Growth', description: 'Distributes template growth across simulation ticks' },
        growthDependencies
      );
      this.config.systems.push({
        systemType: 'growth',
        config: { id: 'framework-growth', name: 'Framework Growth', description: 'Distributes template growth across simulation ticks' }
      } as DeclarativeGrowthSystem);
    }

    this.runtimeSystems = this.growthSystem
      ? [this.growthSystem, ...runtimeSystems]
      : runtimeSystems;

    for (const system of this.runtimeSystems) {
      if (system.initialize) {
        system.initialize();
      }
    }
  }

  private classifySystem(
    sys: SimulationSystem | DeclarativeSystem,
    runtimeSystems: SimulationSystem[],
    growthDependencies: Parameters<typeof createGrowthSystem>[1]
  ): void {
    if ('apply' in sys && typeof sys.apply === 'function') {
      if (!this.growthSystem && (sys.id === 'growth' || sys.id === 'framework-growth')) {
        this.growthSystem = sys as GrowthSystem;
        return;
      }
      runtimeSystems.push(sys);
      return;
    }

    if (isDeclarativeSystem(sys) && sys.systemType === 'growth') {
      if (this.growthSystem) {
        throw new Error('Multiple growth systems configured. Only one growth system is supported.');
      }
      this.growthSystem = createGrowthSystem((sys as DeclarativeGrowthSystem).config, growthDependencies);
      return;
    }

    runtimeSystems.push(createSystemFromDeclarative(sys as DeclarativeSystem));
  }

  private loadInitialEntities(initialState: HardState[]): void {
    initialState.forEach(entity => {
      this.validateAndLoadEntity(entity);
    });
  }

  private validateSeedEntity(entity: HardState): void {
    if (!entity.id) {
      throw new Error(
        `WorldEngine: initial entity "${entity.name}" (${entity.kind}) has no id. ` +
        `Seed entities must include stable ids used by seed relationships.`
      );
    }
    const coordinates = entity.coordinates;
    if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number' || typeof coordinates.z !== 'number') {
      throw new Error(
        `WorldEngine: initial entity "${entity.name}" (${entity.kind}) has invalid coordinates. ` +
        `Expected {x, y, z} numbers, received: ${JSON.stringify(coordinates)}.`
      );
    }
    if (!entity.culture || entity.culture.startsWith('$')) {
      throw new Error(
        `WorldEngine: initial entity "${entity.name}" (${entity.kind}) has invalid culture "${entity.culture}".`
      );
    }
  }

  private buildLoadedEntity(entity: HardState): HardState {
    const narrativeHint = entity.narrativeHint ?? entity.summary ?? (entity.description ? entity.description : undefined);
    const loadedEntity: HardState = {
      ...entity,
      id: entity.id,
      coordinates: entity.coordinates,
      createdAt: 0,
      updatedAt: 0,
      narrativeHint,
      lockedSummary: entity.summary ? true : undefined
    };
    initializeCatalystSmart(loadedEntity);
    this.assignRegionToEntity(loadedEntity);
    return loadedEntity;
  }

  private assignRegionToEntity(entity: HardState): void {
    if (entity.coordinates && !entity.regionId) {
      const lookup = this.runtime.lookupRegion(entity.kind, entity.coordinates);
      if (lookup.primary) {
        entity.regionId = lookup.primary.id;
        entity.allRegionIds = lookup.all.map(r => r.id);
      }
    }
  }

  private validateAndLoadEntity(entity: HardState): void {
    this.validateSeedEntity(entity);
    const loadedEntity = this.buildLoadedEntity(entity);
    this.graph._loadEntity(entity.id, loadedEntity);
  }

  /**
   * Build a "creation myth" narrative event capturing all seed entities and relationships.
   * This ensures initial world state appears in narrative history.
   */
  private buildGenesisEvent(eraId: string): NarrativeEvent | null {
    const entities = this.graph.getEntities();
    const relationships = this.graph.getRelationships();

    if (entities.length === 0) return null;

    // Build participant effects for each entity
    const participantEffects: NarrativeEvent['participantEffects'] = [];

    // Group relationships by entity for efficient lookup
    const relsByEntity = new Map<string, Relationship[]>();
    for (const rel of relationships) {
      if (!relsByEntity.has(rel.src)) relsByEntity.set(rel.src, []);
      if (!relsByEntity.has(rel.dst)) relsByEntity.set(rel.dst, []);
      relsByEntity.get(rel.src)!.push(rel);
      relsByEntity.get(rel.dst)!.push(rel);
    }

    for (const entity of entities) {
      participantEffects.push(this.buildGenesisParticipant(entity, relsByEntity));
    }

    // Count entities by kind for description
    const kindCounts = new Map<string, number>();
    for (const e of entities) {
      kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
    }
    const kindSummary = Array.from(kindCounts.entries())
      .map(([kind, count]) => `${count} ${kind}${count > 1 ? 's' : ''}`)
      .join(', ');

    // Pick a prominent entity as the subject (or first entity)
    const subject = entities.reduce((best, e) =>
      e.prominence > best.prominence ? e : best, entities[0]);

    return {
      id: 'genesis-0',
      tick: 0,
      era: eraId,
      eventKind: 'creation_batch',
      significance: 1.0,
      subject: {
        id: subject.id,
        name: subject.name,
        kind: subject.kind,
        subtype: subject.subtype
      },
      action: 'genesis',
      participantEffects,
      description: `In the time before memory, the world took shape. ${kindSummary} emerged from the primordial ice, bound by ${relationships.length} threads of fate.`,
      causedBy: {
        actionType: 'genesis'
      },
      narrativeTags: ['genesis', 'creation', 'primordial', 'origin']
    };
  }

  /**
   * Get creation verb for genesis event based on entity kind
   */
  private buildGenesisParticipant(
    entity: HardState,
    relsByEntity: Map<string, Relationship[]>
  ): NarrativeEvent['participantEffects'][0] {
    const effects: NarrativeEvent['participantEffects'][0]['effects'] = [];

    effects.push({
      type: 'created',
      description: this.getGenesisCreationVerb(entity.kind)
    });

    const entityRels = relsByEntity.get(entity.id) || [];
    for (const rel of entityRels) {
      const isSource = rel.src === entity.id;
      const otherId = isSource ? rel.dst : rel.src;
      const other = this.graph.getEntity(otherId);
      if (!other) continue;

      effects.push({
        type: 'relationship_formed',
        relationshipKind: rel.kind,
        relatedEntity: {
          id: other.id, name: other.name,
          kind: other.kind, subtype: other.subtype
        },
        description: this.getGenesisRelationshipVerb(rel.kind, isSource, other.name)
      });
    }

    return {
      entity: {
        id: entity.id, name: entity.name,
        kind: entity.kind, subtype: entity.subtype
      },
      effects
    };
  }

  private getGenesisCreationVerb(kind: string): string {
    const verbs: Record<string, string> = {
      'location': 'rose from the frozen depths',
      'npc': 'awakened to consciousness',
      'faction': 'coalesced from shared purpose',
      'artifact': 'crystallized from ancient power',
      'ability': 'manifested from the primordial currents',
      'ideology': 'emerged as an eternal truth',
      'era': 'began its inexorable march'
    };
    return verbs[kind] || 'came into being';
  }

  /**
   * Get relationship verb for genesis event
   */
  private getGenesisRelationshipVerb(kind: string, isSource: boolean, otherName: string): string {
    const verbs: Record<string, [string, string]> = {
      'contains': ['contained within', 'encompassed'],
      'adjacent_to': ['stood beside', 'neighbored'],
      'leader_of': ['was destined to lead', 'awaited leadership from'],
      'resident_of': ['would call home', 'sheltered'],
      'controls': ['held dominion over', 'submitted to'],
      'allied_with': ['was bound in fellowship with', 'pledged kinship to'],
      'trades_with': ['shared prosperity with', 'exchanged gifts with'],
      'corrupted_by': ['carried the taint of', 'cast shadow upon'],
      'manifests_at': ['resonated through', 'channeled the power of'],
      'practitioner_of': ['inherited the ways of', 'bestowed knowledge upon']
    };

    const [srcVerb, dstVerb] = verbs[kind] || ['was connected to', 'was linked with'];
    return `${isSource ? srcVerb : dstVerb} ${otherName}`;
  }

  private findEntityByName(name: string): HardState | undefined {
    const entities = this.graph.getEntities();
    for (const entity of entities) {
      if (entity.name === name || entity.id === name) {
        return entity;
      }
    }
    return undefined;
  }

  /**
   * Emit warning via emitter and record in statistics
   */
  private logWarning(message: string): void {
    // Record warning in statistics
    if (message.includes('BUDGET')) {
      this.statisticsCollector.recordWarning('budget');
    } else if (message.includes('AGGRESSIVE SYSTEM')) {
      const match = message.match(/AGGRESSIVE SYSTEM: (\S+)/);
      if (match) {
        this.statisticsCollector.recordWarning('aggressive', match[1]);
      }
    } else if (message.includes('GROWTH RATE')) {
      this.statisticsCollector.recordWarning('growth');
    }

    this.emitter.log('warn', message, { tick: this.graph.tick });
  }

  // Simulation state tracking
  private simulationStarted: boolean = false;
  private simulationComplete: boolean = false;

  /**
   * Initialize simulation (called once before stepping or running)
   */
  private initializeSimulation(): void {
    if (this.simulationStarted) return;

    this.startTime = Date.now();
    this.simulationRunId = `run_${this.startTime}_${crypto.randomUUID().slice(0, 9)}`;
    this.simulationStarted = true;

    this.emitter.log('info', `Starting world generation (runId: ${this.simulationRunId})...`);
    this.emitter.log('info', `Initial state: ${this.graph.getEntityCount()} entities`);

    // Ensure first era entity exists BEFORE any growth phase runs
    // This is critical so entities created in the first growth phase can have ORIGINATED_IN relationships
    this.ensureFirstEraExists();
    this.updateReachabilityMetrics();

    // Reset coordinate statistics for this run
    coordinateStats.reset();

    // Emit running progress
    this.emitProgress('running');
  }

  /**
   * Ensure the first era entity exists in the graph.
   * This must be called before the first growth phase so that ORIGINATED_IN
   * relationships can be created for all template-generated entities.
   */
  private ensureFirstEraExists(): void {
    // Get first era from config
    const configEras = this.config.eras;
    if (!configEras || configEras.length === 0) {
      this.emitter.log('warn', 'No eras defined in config - entities will not have ORIGINATED_IN relationships');
      return;
    }

    // Check if any era entities already exist
    const existingEras = this.graph.findEntities({
      kind: FRAMEWORK_ENTITY_KINDS.ERA,
      includeHistorical: true
    });

    if (existingEras.length > 0) {
      const firstEraConfig = configEras[0];
      const firstEraEntity = existingEras.find(era =>
        era.id === firstEraConfig.id ||
        era.subtype === firstEraConfig.id ||
        era.name === firstEraConfig.name
      );
      if (firstEraEntity && firstEraEntity.temporal?.startTick == null) {
        firstEraEntity.temporal = {
          startTick: 0,
          endTick: firstEraEntity.temporal?.endTick ?? null
        };
        firstEraEntity.updatedAt = this.graph.tick;
      }
      // Era already exists - nothing else to do
      return;
    }

    // Create the first era entity
    const firstEraConfig = configEras[0];
    const firstEraId = generateEntityIdFromName(
      firstEraConfig.name,
      candidate => this.graph.hasEntity(candidate),
      (message, context) => this.emitter.log('warn', message, context)
    );
    const { entity: firstEra } = createEraEntity(
      firstEraConfig,
      this.graph.tick,
      FRAMEWORK_STATUS.CURRENT,
      undefined,
      firstEraId
    );

    // Add era entity to graph directly (bypasses addEntity to avoid circular ORIGINATED_IN)
    this.graph._loadEntity(firstEra.id, firstEra);

    this.emitter.log('info', `[WorldEngine] Initialized first era: ${firstEraConfig.name}`);
  }

  /**
   * Emit current progress state
   */
  private emitProgress(phase: 'initializing' | 'validating' | 'running' | 'finalizing'): void {
    this.emitter.progress({
      phase,
      tick: this.graph.tick,
      maxTicks: this.config.maxTicks,
      epoch: this.currentEpoch,
      totalEpochs: this.getTotalEpochs(),
      entityCount: this.graph.getEntityCount(),
      relationshipCount: this.graph.getRelationshipCount()
    });
  }

  private computeReachabilityComponents(): { components: number; entityCount: number } {
    const excludedKinds: Set<string> = new Set([
      FRAMEWORK_ENTITY_KINDS.ERA,
      FRAMEWORK_ENTITY_KINDS.OCCURRENCE
    ]);
    // Exclude framework meta nodes so they don't collapse connectivity paths.
    const entities = this.graph.getEntities().filter(entity => !excludedKinds.has(entity.kind));
    const entityCount = entities.length;

    if (entityCount === 0) {
      return { components: 0, entityCount };
    }

    const adjacency = this.buildAdjacencyMap(entities);
    const components = this.countConnectedComponents(adjacency);
    return { components, entityCount };
  }

  private buildAdjacencyMap(entities: HardState[]): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();
    for (const entity of entities) {
      adjacency.set(entity.id, new Set());
    }
    for (const rel of this.graph.getRelationships()) {
      if (!adjacency.has(rel.src) || !adjacency.has(rel.dst)) continue;
      adjacency.get(rel.src)!.add(rel.dst);
      adjacency.get(rel.dst)!.add(rel.src);
    }
    return adjacency;
  }

  private countConnectedComponents(adjacency: Map<string, Set<string>>): number {
    const visited = new Set<string>();
    let components = 0;
    for (const nodeId of adjacency.keys()) {
      if (visited.has(nodeId)) continue;
      components += 1;
      this.bfsVisit(nodeId, adjacency, visited);
    }
    return components;
  }

  private bfsVisit(
    startNode: string,
    adjacency: Map<string, Set<string>>,
    visited: Set<string>
  ): void {
    const stack = [startNode];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
  }

  private updateReachabilityMetrics(): void {
    const { components, entityCount } = this.computeReachabilityComponents();
    this.reachabilityComponents = components;
    if (this.fullyConnectedTick === null && entityCount > 0 && components === 1) {
      this.fullyConnectedTick = this.graph.tick;
    }
  }

  private getReachabilityMetrics(): { connectedComponents: number; fullyConnectedTick: number | null } {
    this.updateReachabilityMetrics();
    return {
      connectedComponents: this.reachabilityComponents ?? 0,
      fullyConnectedTick: this.fullyConnectedTick
    };
  }

  private finalizeCurrentEraTemporal(): void {
    const currentEraEntity = this.graph.findEntities({
      kind: FRAMEWORK_ENTITY_KINDS.ERA,
      status: FRAMEWORK_STATUS.CURRENT
    })[0];
    if (!currentEraEntity) return;

    const startTick = currentEraEntity.temporal?.startTick ?? currentEraEntity.createdAt ?? 0;
    currentEraEntity.temporal = {
      startTick,
      endTick: this.graph.tick
    };
    currentEraEntity.updatedAt = this.graph.tick;
  }

  /**
   * Run a single epoch (step mode)
   * @returns true if more epochs remain, false if simulation should end
   */
  public async step(): Promise<boolean> {
    // Initialize on first step
    this.initializeSimulation();

    if (this.simulationComplete) {
      return false;
    }

    if (!this.shouldContinue()) {
      // Simulation naturally ended
      await this.finalize();
      return false;
    }

    // Run one epoch
    await this.runEpoch();
    this.currentEpoch++;

    // Check if we should continue
    if (!this.shouldContinue()) {
      await this.finalize();
      return false;
    }

    // Emit progress after epoch
    this.emitProgress('running');
    return true;
  }

  /**
   * Finalize the simulation (call after last step or automatically at end of run)
   */
  public finalize(): Promise<Graph> {
    if (this.simulationComplete) {
      return Promise.resolve(this.graph);
    }

    this.simulationComplete = true;

    this.finalizeCurrentEraTemporal();

    // Link final era to prominent entities (since it never "ends")
    this.linkFinalEra();

    // Emit finalizing progress
    this.emitProgress('finalizing');

    this.emitter.log('info', 'Generation complete!');
    this.emitter.log('info', `Final state: ${this.graph.getEntityCount()} entities, ${this.graph.getRelationshipCount()} relationships`);

    // Emit final reports
    this.emitFinalFeedbackReport();
    this.emitCoordinateStats();

    // Emit completion event
    this.emitCompleteEvent();

    return Promise.resolve(this.graph);
  }

  /**
   * Check if simulation is complete
   */
  public isComplete(): boolean {
    return this.simulationComplete;
  }

  /**
   * Get current epoch number
   */
  public getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  /**
   * Get total expected epochs
   */
  public getTotalEpochs(): number {
    return this.config.maxEpochs;
  }

  /**
   * Reset simulation to initial state (for step mode)
   * Allows re-running the simulation from the beginning
   */
  public reset(initialState: HardState[]): void {
    this.resetSimulationState();
    this.resetTrackingMaps();
    this.recreateGraph();
    this.loadInitialEntities(initialState);
    this.loadSeedRelationships();
    this.updateReachabilityMetrics();

    this.emitter.log('info', 'Simulation reset to initial state');
    this.emitProgress('initializing');
  }

  private resetSimulationState(): void {
    this.simulationStarted = false;
    this.simulationComplete = false;
    this.currentEpoch = 0;
    this.epochEra = null;
    this.epochEraTransitions = [];
    this.startTime = 0;
  }

  private resetTrackingMaps(): void {
    this.templateRunCounts.clear();
    if (this.config.actionUsageTracker) {
      this.config.actionUsageTracker.applications = [];
      this.config.actionUsageTracker.countsByActionId.clear();
      this.config.actionUsageTracker.countsByActorId.clear();
    }
    this.systemMetrics.clear();
    this.metaEntitiesFormed = [];
    this.lastRelationshipCount = 0;
    this.lastGrowthSummary = null;
    this.reachabilityComponents = null;
    this.fullyConnectedTick = null;
    this.growthSystem?.reset();
    coordinateStats.reset();
  }

  private recreateGraph(): void {
    this.graph = GraphStore.create(this.config.eras[0], this.config.pressures);
    this.graph.mutationTracker = this.mutationTracker;
    this.graph.rateLimitState = {
      currentThreshold: 0.3,
      lastCreationTick: -999,
      creationsThisEpoch: 0
    };
    this.runtime = new WorldRuntime(this.graph, this.targetSelector, this.coordinateContext, this.config);
  }

  private loadSeedRelationships(): void {
    if (!this.config.seedRelationships) return;
    for (const rel of this.config.seedRelationships) {
      const srcEntity = this.graph.getEntity(rel.src) || this.findEntityByName(rel.src);
      const dstEntity = this.graph.getEntity(rel.dst) || this.findEntityByName(rel.dst);
      if (srcEntity && dstEntity) {
        this.graph.addRelationship(rel.kind, srcEntity.id, dstEntity.id, rel.strength, rel.distance);
      }
    }
  }

  // Main execution loop - runs all epochs to completion
  public async run(): Promise<Graph> {
    this.initializeSimulation();

    while (this.shouldContinue()) {
      await this.runEpoch();
      this.currentEpoch++;
    }

    return this.finalize();
  }
  
  private shouldContinue(): boolean {
    // PRIORITY 1: Complete all eras (each era should run ~2 epochs)
    const allErasCompleted = this.currentEpoch >= this.getTotalEpochs();

    // PRIORITY 2: Respect maximum tick limit (safety valve)
    const hitTickLimit = this.graph.tick >= this.config.maxTicks;

    // PRIORITY 3: Excessive growth safety valve (only if WAY over target AND all eras done)
    const scale = this.config.scaleFactor || 1.0;
    const safetyLimit = this.totalTargetEntities > 0
      ? this.totalTargetEntities * 10 * scale
      : Infinity;
    const excessiveGrowth = this.graph.getEntityCount() >= safetyLimit;

    // PRIORITY 4: Final era exit conditions met (early termination)
    const finalEraExitMet = this.checkFinalEraExitConditions();

    // Stop only if:
    // - Hit tick limit, OR
    // - Completed all eras AND (hit tick limit OR excessive growth)
    // - Final era exit conditions met
    if (hitTickLimit) {
      this.emitter.log('warn', `Stopped: Hit maximum tick limit (${this.config.maxTicks})`);
      return false;
    }

    if (finalEraExitMet) {
      this.emitter.log('info', `Stopped: Final era exit conditions met at tick ${this.graph.tick}`);
      return false;
    }

    if (allErasCompleted) {
      if (excessiveGrowth) {
        this.emitter.log('warn', `Stopped: All eras complete + excessive growth (${this.graph.getEntityCount()} entities)`);
        return false;
      }
      this.emitter.log('info', `All eras completed at epoch ${this.currentEpoch}`);
      return false;
    }

    return true;
  }

  /**
   * Check if we're in the final era and its exit conditions are met.
   * This allows early termination when the simulation has achieved its narrative goals.
   */
  private checkFinalEraExitConditions(): boolean {
    // Get the final era from config
    const eras = this.config.eras;
    if (!eras || eras.length === 0) return false;
    const finalEraConfig = eras[eras.length - 1];

    // Check if we're in the final era
    const currentEraId = this.graph.currentEra?.id;
    if (currentEraId !== finalEraConfig.id) return false;

    // Check if the final era has exit conditions
    const exitConditions = finalEraConfig.exitConditions;
    if (!exitConditions || exitConditions.length === 0) return false;

    // Find the current era entity
    const currentEraEntity = this.graph.findEntities({
      kind: FRAMEWORK_ENTITY_KINDS.ERA,
      status: FRAMEWORK_STATUS.CURRENT
    })[0];
    if (!currentEraEntity) return false;

    // Check if exit conditions are met
    const { shouldTransition } = checkTransitionConditions(
      currentEraEntity,
      this.runtime,
      exitConditions
    );

    return shouldTransition;
  }

  /**
   * Link final era to prominent entities
   * Called at end of generation since final era never "ends"
   */
  private linkFinalEra(): void {
    // Find current era entity
    const eraEntities = this.graph.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA, status: FRAMEWORK_STATUS.CURRENT });
    const currentEra = eraEntities[0];

    if (!currentEra || !currentEra.temporal) return;

    const eraStartTick = currentEra.temporal.startTick;

    // Find prominent entities created during this era (include 'recognized' for better coverage)
    // Prominence: 0-1=forgotten, 1-2=marginal, 2-3=recognized, 3-4=renowned, 4-5=mythic
    const allEntities = this.graph.getEntities();
    const prominentEntities = allEntities.filter(e =>
      e.prominence >= 2.0 && // recognized or higher
      e.kind !== FRAMEWORK_ENTITY_KINDS.ERA &&
      e.createdAt >= eraStartTick
    );

    // If no prominent entities from this era, link to most prominent entities from any time
    const entitiesToLink = prominentEntities.length > 0
      ? prominentEntities
      : allEntities
          .filter(e => e.prominence >= 3.0 && e.kind !== FRAMEWORK_ENTITY_KINDS.ERA) // renowned or higher
          .sort((a, b) => b.prominence - a.prominence);

    // Link up to 10 most prominent entities
    let linkedCount = 0;
    entitiesToLink.slice(0, 10).forEach(entity => {
      addRelationship(this.graph, 'active_during', entity.id, currentEra.id);
      linkedCount++;
    });

    if (linkedCount > 0) {
      this.emitter.log('info', `Linked final era "${currentEra.name}" to ${linkedCount} prominent entities`);
    }
  }

  private async runEpoch(): Promise<void> {
    // Era progression is handled by eraTransition system, not selectEra()
    // The eraTransition system manages era entity status and updates graph.currentEra
    const previousEra = this.graph.currentEra;
    const epochEra = this.graph.currentEra;
    this.epochEra = epochEra;
    this.epochEraTransitions = [];

    // Emit epoch start event
    this.emitter.epochStart({
      epoch: this.currentEpoch,
      era: {
        id: epochEra.id,
        name: epochEra.name,
        summary: epochEra.summary
      },
      tick: this.graph.tick
    });

    // Reset rate limit counter for new epoch
    this.graph.rateLimitState.creationsThisEpoch = 0;

    // Track initial counts for statistics
    const initialEntityCount = this.graph.getEntityCount();
    const initialRelationshipCount = this.graph.getRelationshipCount();

    // Initialize distributed growth for this epoch
    if (this.growthSystem) {
      this.growthSystem.startEpoch(epochEra);
      this.lastGrowthSummary = null;
    } else {
      this.lastGrowthSummary = null;
      this.emitter.log('info', 'Growth system disabled; skipping growth for this epoch');
    }

    // Simulation phase
    for (let i = 0; i < this.config.ticksPerEpoch; i++) {
      const tickEra = this.graph.currentEra;
      // Capture pressure values BEFORE any modifications this tick
      // This ensures previousValue in pressure_update reflects true start-of-tick values
      this.tickStartPressures.clear();
      for (const [pressureId, value] of this.graph.pressures) {
        this.tickStartPressures.set(pressureId, value);
      }

      // Run simulation tick first so system pressure changes are tracked
      await this.runSimulationTick(tickEra);

      // Update pressures (calculates feedback, emits pressure_update with all mods from this tick)
      this.updatePressures(tickEra);
      this.graph.tick++;
      this.updateReachabilityMetrics();

      // Emit progress every few ticks
      if (i % 5 === 0) {
        this.emitter.progress({
          phase: 'running',
          tick: this.graph.tick,
          maxTicks: this.config.maxTicks,
          epoch: this.currentEpoch,
          totalEpochs: this.getTotalEpochs(),
          entityCount: this.graph.getEntityCount(),
          relationshipCount: this.graph.getRelationshipCount()
        });
      }
    }

    // Capture growth summary for this epoch
    if (this.growthSystem) {
      this.lastGrowthSummary = this.growthSystem.completeEpoch();
      this.emitter.growthPhase({
        epoch: this.currentEpoch,
        entitiesCreated: this.lastGrowthSummary.entitiesCreated,
        target: this.lastGrowthSummary.target,
        templatesApplied: this.lastGrowthSummary.templatesUsed
      });
    }

    // Meta-entity formation is now handled by SimulationSystems (run at epoch end)

    // Prune and consolidate
    this.pruneAndConsolidate();

    const endEra = this.graph.currentEra;
    const eraSummary: EpochEraSummary = {
      start: { id: epochEra.id, name: epochEra.name },
      end: { id: endEra.id, name: endEra.name },
      transitions: [...this.epochEraTransitions]
    };

    // Record epoch statistics
    const entitiesCreated = this.graph.getEntityCount() - initialEntityCount;
    const relationshipsCreated = this.graph.getRelationshipCount() - initialRelationshipCount;
    this.statisticsCollector.recordEpoch(
      this.graph,
      this.currentEpoch,
      entitiesCreated,
      relationshipsCreated,
      this.lastGrowthSummary?.target ?? 0,
      eraSummary
    );

    // Emit epoch stats
    this.emitEpochStats(eraSummary, entitiesCreated, relationshipsCreated, this.lastGrowthSummary?.target ?? 0);

    // Emit diagnostics (updated each epoch for visibility during stepping)
    this.emitDiagnostics();

    // Emit feedback reports (population, template usage, system health)
    // so dashboards update during stepping, not just at finalize
    this.emitEpochFeedback();

    this.queueEraNarrative(previousEra, endEra);

    // Check for significant entity changes and enrich them
    this.queueChangeEnrichments();
  }

  /**
   * Emit epoch statistics via emitter
   */
  private emitEpochStats(era: EpochEraSummary, entitiesCreated: number, relationshipsCreated: number, growthTarget: number): void {
    const byKind: Record<string, number> = {};
    this.graph.forEachEntity((entity) => {
      byKind[entity.kind] = (byKind[entity.kind] || 0) + 1;
    }, { includeHistorical: true });

    this.emitter.epochStats({
      epoch: this.currentEpoch,
      era,
      entitiesByKind: byKind,
      relationshipCount: this.graph.getRelationshipCount({ includeHistorical: true }),
      pressures: Object.fromEntries(this.graph.pressures),
      entitiesCreated,
      relationshipsCreated,
      growthTarget
    });
  }

  /**
   * Emit final population report via emitter
   */
  private emitFinalFeedbackReport(): void {
    this.populationTracker.update(this.graph);
    const summary = this.populationTracker.getSummary();

    this.emitPopulationReport(summary);
    this.emitTemplateUsageReport();
    this.emitTagHealthReport();
    this.emitSystemHealthReport(summary.avgEntityDeviation);
  }

  private emitPopulationReport(
    summary: ReturnType<PopulationTracker['getSummary']>
  ): void {
    const metrics = this.populationTracker.getMetrics();
    const outliers = this.populationTracker.getOutliers(0.3);

    const entityMetrics = Array.from(metrics.entities.values())
      .filter(m => m.target > 0)
      .map(m => ({ kind: m.kind, subtype: m.subtype, count: m.count, target: m.target, deviation: m.deviation }));

    const pressureMetrics = this.buildPressureMetrics(summary, metrics);

    const mapOutlierMetrics = (items: typeof outliers.overpopulated) =>
      items.map(m => ({ kind: m.kind, subtype: m.subtype, count: m.count, target: m.target, deviation: m.deviation }));

    this.emitter.populationReport({
      totalEntities: summary.totalEntities,
      totalRelationships: summary.totalRelationships,
      avgDeviation: summary.avgEntityDeviation,
      maxDeviation: summary.maxEntityDeviation,
      entityMetrics,
      pressureMetrics,
      outliers: {
        overpopulated: mapOutlierMetrics(outliers.overpopulated),
        underpopulated: mapOutlierMetrics(outliers.underpopulated)
      }
    });
  }

  private buildPressureMetrics(
    summary: ReturnType<PopulationTracker['getSummary']>,
    metrics: ReturnType<PopulationTracker['getMetrics']>
  ): Array<{ id: string; value: number; target: number; deviation: number }> {
    const pressureMetrics: Array<{ id: string; value: number; target: number; deviation: number }> = [];
    summary.pressureDeviations.forEach((deviation, pressureId) => {
      const metric = metrics.pressures.get(pressureId);
      if (metric) {
        pressureMetrics.push({ id: pressureId, value: metric.value, target: metric.target, deviation });
      }
    });
    return pressureMetrics;
  }

  private getTemplateUsageStatus(count: number): 'saturated' | 'warning' | 'healthy' {
    if (count >= this.maxRunsPerTemplate) return 'saturated';
    if (count >= this.maxRunsPerTemplate * 0.7) return 'warning';
    return 'healthy';
  }

  private diagnoseUnusedTemplate(template: GrowthTemplate): {
    templateId: string;
    failedRules: string[];
    selectionCount: number;
    summary: string;
    selectionDiagnosis?: unknown;
    variableDiagnoses?: unknown[];
  } {
    const declarativeTemplate = this.declarativeTemplates.get(template.id);
    if (!declarativeTemplate) {
      return { templateId: template.id, failedRules: [], selectionCount: 0, summary: 'Non-declarative template' };
    }
    const diagnosis = this.templateInterpreter.diagnoseCanApply(declarativeTemplate, this.runtime);
    let summary: string;
    if (diagnosis.failedRules.length > 0) {
      summary = `Failed: ${diagnosis.failedRules[0].split(':')[0]}`;
    } else if (diagnosis.selectionCount === 0) {
      summary = 'No valid targets';
    } else if (!diagnosis.requiredVariablesPassed) {
      summary = `Required variables failed: ${diagnosis.failedVariables.join(', ')}`;
    } else {
      summary = 'Unknown';
    }
    return {
      templateId: template.id,
      failedRules: diagnosis.failedRules,
      selectionCount: diagnosis.selectionCount,
      summary,
      selectionDiagnosis: diagnosis.selectionDiagnosis,
      variableDiagnoses: diagnosis.failedVariableDiagnoses.length > 0
        ? diagnosis.failedVariableDiagnoses
        : undefined
    };
  }

  private emitTemplateUsageReport(): void {
    const sortedTemplates = Array.from(this.templateRunCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const totalRuns = sortedTemplates.reduce((sum, [_, count]) => sum + count, 0);
    const unusedTemplates = this.runtimeTemplates.filter(t => !this.templateRunCounts.has(t.id));

    this.emitter.templateUsage({
      totalApplications: totalRuns,
      uniqueTemplatesUsed: sortedTemplates.length,
      totalTemplates: this.runtimeTemplates.length,
      maxRunsPerTemplate: this.maxRunsPerTemplate,
      usage: sortedTemplates.slice(0, 20).map(([templateId, count]) => ({
        templateId,
        count,
        percentage: totalRuns > 0 ? (count / totalRuns) * 100 : 0,
        status: this.getTemplateUsageStatus(count)
      })),
      unusedTemplates: unusedTemplates.map(t => this.diagnoseUnusedTemplate(t))
    });
  }

  private emitTagHealthReport(): void {
    const tagHealthReport = this.contractEnforcer.getTagAnalyzer().analyzeGraph(this.graph);
    this.emitter.tagHealth({
      coverage: {
        totalEntities: tagHealthReport.coverage.totalEntities,
        entitiesWithTags: tagHealthReport.coverage.entitiesWithTags,
        coveragePercentage: tagHealthReport.coverage.coveragePercentage
      },
      diversity: {
        uniqueTags: tagHealthReport.diversity.uniqueTags,
        shannonIndex: tagHealthReport.diversity.shannonIndex,
        evenness: tagHealthReport.diversity.evenness
      },
      issues: {
        orphanTagCount: tagHealthReport.issues.orphanTags.length,
        overusedTagCount: tagHealthReport.issues.overusedTags.length,
        conflictCount: tagHealthReport.issues.conflicts.length
      }
    });
  }

  private emitSystemHealthReport(avgEntityDeviation: number): void {
    const populationHealth = 1 - avgEntityDeviation;
    this.emitter.systemHealth({
      populationHealth,
      status: populationHealth > 0.8 ? 'stable'
        : populationHealth > 0.6 ? 'functional'
        : 'needs_attention'
    });
  }

  /**
   * Emit diagnostics (entity breakdown, catalyst stats, etc.)
   * Called after each epoch so diagnostics are visible during step mode.
   */
  private emitDiagnostics(): void {
    const entities = this.graph.getEntities();
    const relationships = this.graph.getRelationships();

    // Entity breakdown by kind:subtype
    const byKind: Record<string, { total: number; bySubtype: Record<string, number> }> = {};
    entities.forEach(e => {
      if (!byKind[e.kind]) {
        byKind[e.kind] = { total: 0, bySubtype: {} };
      }
      byKind[e.kind].total++;
      byKind[e.kind].bySubtype[e.subtype] = (byKind[e.kind].bySubtype[e.subtype] || 0) + 1;
    });

    this.emitter.entityBreakdown({
      totalEntities: entities.length,
      byKind
    });

    // Catalyst statistics
    const agents = entities.filter(e => e.catalyst?.canAct);
    const actionUsage = this.config.actionUsageTracker;
    const actionCountsByActor = actionUsage?.countsByActorId ?? new Map<string, { name: string; kind: string; count: number }>();
    const actionCountsByActionId = actionUsage?.countsByActionId ?? new Map<string, number>();

    const activeAgents = actionCountsByActor.size;

    const topAgents = Array.from(actionCountsByActor.entries())
      .map(([id, data]) => ({ id, name: data.name, kind: data.kind, actionCount: data.count }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 10);

    const totalActions = Array.from(actionCountsByActor.values()).reduce((sum, a) => sum + a.count, 0);

    // Compute unused actions (actions that have never succeeded)
    const allActions = this.config.executableActions || [];
    const unusedActions = allActions
      .filter(action => !actionCountsByActionId.has(action.type))
      .map(action => ({
        actionId: action.type,
        actionName: action.name
      }));

    this.emitter.catalystStats({
      totalAgents: agents.length,
      activeAgents,
      totalActions,
      uniqueActors: actionCountsByActor.size,
      topAgents,
      unusedActions
    });

    // Relationship breakdown
    const relCounts = new Map<string, number>();
    relationships.forEach(r => {
      relCounts.set(r.kind, (relCounts.get(r.kind) || 0) + 1);
    });

    const relBreakdown = Array.from(relCounts.entries())
      .map(([kind, count]) => ({
        kind,
        count,
        percentage: relationships.length > 0 ? (count / relationships.length) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    this.emitter.relationshipBreakdown({
      totalRelationships: relationships.length,
      byKind: relBreakdown
    });

    // Notable entities (mythic and renowned)
    // Prominence thresholds: mythic >= 4.0, renowned >= 3.0 but < 4.0
    const mythic = entities
      .filter(e => e.prominence >= 4.0)
      .map(e => ({ id: e.id, name: e.name, kind: e.kind, subtype: e.subtype }));

    const renowned = entities
      .filter(e => e.prominence >= 3.0 && e.prominence < 4.0)
      .map(e => ({ id: e.id, name: e.name, kind: e.kind, subtype: e.subtype }));

    this.emitter.notableEntities({ mythic, renowned });

  }

  /**
   * Emit epoch feedback reports (population, template usage, system health).
   * Called after each epoch so dashboards update during stepping.
   */
  private emitEpochFeedback(): void {
    this.populationTracker.update(this.graph);
    const summary = this.populationTracker.getSummary();

    this.emitPopulationReport(summary);
    this.emitTemplateUsageReport();
    this.emitSystemHealthReport(summary.avgEntityDeviation);
  }

  /**
   * Emit coordinate statistics via emitter
   */
  private emitCoordinateStats(): void {
    const stats = coordinateStats.getSummary();
    this.emitter.coordinateStats({
      totalPlacements: stats.totalPlacements,
      byKind: stats.placementsByKind,
      regionUsage: stats.regionUsagePerKind,
      cultureDistribution: Object.fromEntries(
        stats.cultureClusterStats.map(cs => [cs.cultureId, cs.entityCount])
      )
    });
  }

  /**
   * Emit simulation complete event
   */
  private emitCompleteEvent(): void {
    const durationMs = Date.now() - this.startTime;
    const coordinateState = this.coordinateContext.export();
    const entities = this.graph.getEntities({ includeHistorical: true });
    const relationships = this.graph.getRelationships({ includeHistorical: true });

    this.emitter.complete({
      schema: this.config.schema,
      metadata: {
        simulationRunId: this.simulationRunId,
        tick: this.graph.tick,
        epoch: this.currentEpoch,
        era: this.graph.currentEra.name,
        entityCount: entities.length,
        relationshipCount: relationships.length,
        durationMs,
        reachability: this.getReachabilityMetrics()
      },
      hardState: entities,
      relationships,
      narrativeHistory: this.graph.narrativeHistory.length > 0 ? this.graph.narrativeHistory : undefined,
      pressures: Object.fromEntries(this.graph.pressures),
      coordinateState
    });
  }
  // Meta-entity formation is now handled by SimulationSystems:
  // - magicSchoolFormation
  // - legalCodeFormation
  // - combatTechniqueFormation
  // These run at epoch end and use the clustering/archival utilities

  /**
   * Sample a single template with weighted probability
   * Applies diversity pressure to prevent template overuse
   */
  private sampleSingleTemplate(
    era: Era,
    applicableTemplates: GrowthTemplate[],
    metrics: PopulationMetrics
  ): GrowthTemplate | undefined {
    if (applicableTemplates.length === 0) return undefined;

    // Build era weights
    const baseEraWeights: Record<string, number> = {};
    applicableTemplates.forEach(t => {
      baseEraWeights[t.id] = getTemplateWeight(era, t.id);
    });

    // Build creation info map from declarative templates for homeostatic control
    const creationInfoMap = new Map<string, { entityKinds: Array<{ kind: string; subtype: string }> }>();
    applicableTemplates.forEach(t => {
      const declTemplate = this.declarativeTemplates.get(t.id);
      if (declTemplate?.creation) {
        creationInfoMap.set(t.id, {
          entityKinds: declTemplate.creation.map(c => ({
            kind: c.kind,
            subtype: typeof c.subtype === 'string' ? c.subtype : 'default'
          }))
        });
      }
    });

    // Apply dynamic weight adjustments (homeostatic control)
    const adjustments = this.dynamicWeightCalculator.calculateAllWeights(
      applicableTemplates,
      new Map(Object.entries(baseEraWeights)),
      metrics,
      creationInfoMap
    );

    // Build final weights with diversity pressure
    const finalWeights: number[] = [];
    applicableTemplates.forEach(t => {
      const adjustment = adjustments.get(t.id);
      let weight = adjustment?.adjustedWeight || baseEraWeights[t.id];

      // DIVERSITY PRESSURE: Extreme negative pressure based on run count
      // Formula: weight * (1 / (1 + runCount^2))
      // Effect: 0 runs = 100%, 1 run = 50%, 2 runs = 20%, 3 runs = 10%, 4+ runs = <6%
      const runCount = this.templateRunCounts.get(t.id) || 0;
      const diversityPenalty = 1 / (1 + runCount * runCount);
      weight *= diversityPenalty;

      finalWeights.push(Math.max(0, weight));
    });

    // Check if all weights are zero
    const totalWeight = finalWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) {
      // All templates exhausted, pick randomly
      return pickRandom(applicableTemplates);
    }

    // Weighted random selection
    return weightedRandom(applicableTemplates, finalWeights);
  }

  /**
   * Compute per-kind and global target totals from distribution targets
   */
  private computeTargetTotals(distributionTargets: DistributionTargets): {
    totalsByKind: Map<string, number>;
    total: number;
  } {
    const totalsByKind = new Map<string, number>();
    let total = 0;

    Object.entries(distributionTargets.entities).forEach(([kind, subtypeTargets]) => {
      let kindTotal = 0;
      Object.values(subtypeTargets || {}).forEach((targetConfig) => {
        const targetValue = typeof targetConfig?.target === 'number' ? targetConfig.target : 0;
        kindTotal += targetValue;
      });
      totalsByKind.set(kind, kindTotal);
      total += kindTotal;
    });

    return { totalsByKind, total };
  }

  /**
   * Calculate dynamic growth target based on remaining distribution target deficits
   */
  private calculateGrowthTarget(): number {
    if (this.totalTargetEntities === 0 || this.targetTotalsByKind.size === 0) {
      return 0;
    }

    const totalRemaining = this.computeRemainingEntityCount();
    if (totalRemaining === 0) return 0;

    const { completedPhasesByEra, completedPhasesTotal } = this.computeCompletedPhases();
    const expectedPhasesByEra = this.computeExpectedPhases();
    const phasesRemaining = this.computeRemainingPhases(expectedPhasesByEra, completedPhasesByEra);

    const phaseProgress = this.computePhaseProgress(completedPhasesTotal, phasesRemaining);
    const finalEra = this.getFinalEra();
    const isFinalEra = finalEra.id === this.graph.currentEra.id;
    const forceBudgetConsumption = isFinalEra || phasesRemaining <= 0;

    const slopeMultiplier = this.computeSlopeMultiplier(forceBudgetConsumption, phaseProgress);
    const remainingPhasesBudget = this.computeRemainingPhasesBudget(
      isFinalEra, finalEra, expectedPhasesByEra, completedPhasesByEra, phasesRemaining
    );

    const baseTarget = Math.ceil(totalRemaining / remainingPhasesBudget);
    const slopedTarget = Math.ceil(baseTarget * slopeMultiplier);

    const variance = forceBudgetConsumption ? 0 : 0.2;
    // eslint-disable-next-line sonarjs/pseudo-random -- simulation variance for growth target
    const target = Math.floor(slopedTarget * (1 - variance + Math.random() * variance * 2));

    return Math.max(this.growthBounds.min, Math.min(this.growthBounds.max, target));
  }

  private computePhaseProgress(completedPhasesTotal: number, phasesRemaining: number): number {
    const totalPlannedPhases = completedPhasesTotal + phasesRemaining;
    const rawPhaseProgress = completedPhasesTotal / Math.max(1, totalPlannedPhases - 1);
    return Math.min(1, Math.max(0, rawPhaseProgress));
  }

  private getFinalEra(): Era {
    const eras = this.config.eras;
    return eras[eras.length - 1];
  }

  private computeSlopeMultiplier(forceBudgetConsumption: boolean, phaseProgress: number): number {
    if (forceBudgetConsumption) return 1;
    const slope = 0.3;
    return 1 + slope - (phaseProgress * slope * 2);
  }

  private computeRemainingPhasesBudget(
    isFinalEra: boolean,
    finalEra: Era,
    expectedPhasesByEra: Map<string, number>,
    completedPhasesByEra: Map<string, number>,
    phasesRemaining: number
  ): number {
    if (!isFinalEra) return Math.max(1, phasesRemaining);
    const finalEraExpected = expectedPhasesByEra.get(finalEra.id) ?? 0;
    const finalEraCompleted = completedPhasesByEra.get(finalEra.id) ?? 0;
    return Math.max(1, finalEraExpected - finalEraCompleted);
  }

  private computeRemainingEntityCount(): number {
    const currentCounts = new Map<string, number>();
    this.graph.forEachEntity((entity) => {
      if (!this.targetTotalsByKind.has(entity.kind)) return;
      currentCounts.set(entity.kind, (currentCounts.get(entity.kind) || 0) + 1);
    });

    let totalRemaining = 0;
    for (const [kind, target] of this.targetTotalsByKind.entries()) {
      totalRemaining += Math.max(0, target - (currentCounts.get(kind) || 0));
    }
    return totalRemaining;
  }

  private computeCompletedPhases(): { completedPhasesByEra: Map<string, number>; completedPhasesTotal: number } {
    const growthPhaseHistory = this.graph.growthPhaseHistory ?? [];
    const completedPhasesByEra = new Map<string, number>();
    for (const entry of growthPhaseHistory) {
      completedPhasesByEra.set(entry.eraId, (completedPhasesByEra.get(entry.eraId) || 0) + 1);
    }
    return { completedPhasesByEra, completedPhasesTotal: growthPhaseHistory.length };
  }

  private computeExpectedPhases(): Map<string, number> {
    const expectedPhasesByEra = new Map<string, number>();
    for (const era of this.config.eras) {
      let expected = 0;
      for (const condition of (era.exitConditions ?? [])) {
        if (condition.type !== 'growth_phases_complete') continue;
        if (condition.eraId && condition.eraId !== era.id) continue;
        expected = Math.max(expected, Math.max(0, condition.minPhases ?? 0));
      }
      expectedPhasesByEra.set(era.id, expected);
    }
    return expectedPhasesByEra;
  }

  private computeRemainingPhases(
    expectedPhasesByEra: Map<string, number>,
    completedPhasesByEra: Map<string, number>
  ): number {
    const currentEraId = this.graph.currentEra?.id ?? '';
    const currentEraExpected = expectedPhasesByEra.get(currentEraId) ?? 0;
    const currentEraCompleted = completedPhasesByEra.get(currentEraId) ?? 0;
    let phasesRemaining = Math.max(0, currentEraExpected - currentEraCompleted);

    const seenEraIds = new Set(
      this.graph.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA, includeHistorical: true })
        .map(entity => entity.subtype)
    );

    for (const era of this.config.eras) {
      if (era.id === currentEraId || seenEraIds.has(era.id)) continue;
      phasesRemaining += expectedPhasesByEra.get(era.id) ?? 0;
    }
    return phasesRemaining;
  }

  private async runSimulationTick(tickEra: Era): Promise<void> {
    this.mutationTracker.setTick(this.graph.tick);
    this.stateChangeTracker.startTick(this.graph, this.graph.tick, tickEra.id);

    const budget = this.config.relationshipBudget?.maxPerSimulationTick || Infinity;
    let relationshipsAddedThisTick = 0;

    for (const system of this.runtimeSystems) {
      const modifierEra = this.growthSystem && system === this.growthSystem && this.epochEra
        ? this.epochEra
        : tickEra;
      const baseModifier = getSystemModifier(modifierEra, system.id);
      if (baseModifier === 0) continue;

      const added = await this.executeSystemTick(system, baseModifier, budget, relationshipsAddedThisTick);
      relationshipsAddedThisTick += added;
    }

    this.flushNarrativeEvents();
    this.mutationTracker.clear();
    this.monitorRelationshipGrowth();
  }

  private async executeSystemTick(
    system: SimulationSystem,
    baseModifier: number,
    budget: number,
    relationshipsAddedThisTick: number
  ): Promise<number> {
    try {
      this.mutationTracker.enterContext('system', system.id);

      const relationshipsBefore = this.graph.getRelationshipCount();
      const result = await system.apply(this.runtime, baseModifier);
      this.statisticsCollector.recordSystemExecution(system.id);

      const metric = this.systemMetrics.get(system.id) || { relationshipsCreated: 0, lastThrottleCheck: 0 };
      const directAdded = this.graph.getRelationshipCount() - relationshipsBefore;
      let totalAdded = directAdded;

      if (directAdded > 0) {
        metric.relationshipsCreated += directAdded;
        if (relationshipsAddedThisTick + directAdded > budget) {
          this.logWarning(`⚠️  RELATIONSHIP BUDGET EXCEEDED BY SYSTEM ${system.id}: ${relationshipsAddedThisTick + directAdded}/${budget}`);
        }
      }

      const addedFromResult = this.applyResultRelationships(result, system.id, budget, relationshipsAddedThisTick + directAdded, metric);
      totalAdded += addedFromResult;

      this.applyResultRelationshipAdjustments(result, system.id);
      this.applyResultRelationshipArchivals(result, system.id);
      this.checkAggressiveSystem(system.id, metric);
      this.applyResultModifications(result, system);
      this.applyResultPressureChanges(result, system.id);
      this.handleEraTransition(result);
      this.emitSystemActionIfMeaningful(result, system, directAdded, addedFromResult);
      this.recordSystemNarrations(result, system.id);

      this.mutationTracker.exitContext();
      return totalAdded;
    } catch (error) {
      this.mutationTracker.exitContext();
      this.emitter.log('error', `System ${system.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  private flushNarrativeEvents(): void {
    const narrativeEvents = this.stateChangeTracker.flush();
    if (narrativeEvents.length > 0) {
      this.graph.narrativeHistory.push(...narrativeEvents);
    }
  }

  /**
   * Enter mutation context for an item with optional action/narrative group context.
   */
  private enterItemContext(
    item: { actionContext?: { source: ExecutionSource; sourceId: string; success?: boolean }; narrativeGroupId?: string },
    systemId: string,
    narrationsByGroup?: Record<string, string>
  ): { hasActionContext: boolean; hasNarrativeGroup: boolean } {
    const hasActionContext = !!(item.actionContext && item.actionContext.source === 'action');
    if (hasActionContext) {
      const narration = narrationsByGroup?.[item.narrativeGroupId || ''];
      this.mutationTracker.enterContext(item.actionContext!.source, item.actionContext!.sourceId, item.actionContext!.success, narration);
    }

    const hasNarrativeGroup = !!(item.narrativeGroupId && !hasActionContext);
    if (hasNarrativeGroup) {
      const narration = narrationsByGroup?.[item.narrativeGroupId || ''];
      this.mutationTracker.enterContext('system', `${systemId}:${item.narrativeGroupId}`, undefined, narration);
    }

    return { hasActionContext, hasNarrativeGroup };
  }

  private exitItemContext(hasActionContext: boolean, hasNarrativeGroup: boolean): void {
    if (hasNarrativeGroup) this.mutationTracker.exitContext();
    if (hasActionContext) this.mutationTracker.exitContext();
  }

  private applyResultRelationships(
    result: SystemResult,
    systemId: string,
    budget: number,
    currentCount: number,
    metric: { relationshipsCreated: number; lastThrottleCheck: number }
  ): number {
    let added = 0;
    let count = currentCount;
    for (const rel of result.relationshipsAdded) {
      if (count >= budget) {
        this.logWarning(`⚠️  RELATIONSHIP BUDGET REACHED: ${budget}/tick`);
        break;
      }

      const ctx = this.enterItemContext(rel, systemId, result.narrationsByGroup);

      const before = this.graph.getRelationshipCount();
      addRelationship(this.graph, rel.kind, rel.src, rel.dst);
      if (this.graph.getRelationshipCount() > before) {
        count++;
        metric.relationshipsCreated++;
        added++;
      }

      this.exitItemContext(ctx.hasActionContext, ctx.hasNarrativeGroup);
    }
    return added;
  }

  private applyResultRelationshipAdjustments(result: SystemResult, systemId: string): void {
    if (!result.relationshipsAdjusted || result.relationshipsAdjusted.length === 0) return;
    for (const rel of result.relationshipsAdjusted) {
      const ctx = this.enterItemContext(rel, systemId, result.narrationsByGroup);
      modifyRelationshipStrength(this.graph, rel.src, rel.dst, rel.kind, rel.delta);
      this.exitItemContext(ctx.hasActionContext, ctx.hasNarrativeGroup);
    }
  }

  private applyResultRelationshipArchivals(result: SystemResult, systemId: string): void {
    if (!result.relationshipsToArchive || result.relationshipsToArchive.length === 0) return;
    for (const rel of result.relationshipsToArchive) {
      const ctx = this.enterItemContext(rel, systemId, result.narrationsByGroup);
      archiveRelationship(this.graph, rel.src, rel.dst, rel.kind);
      this.exitItemContext(ctx.hasActionContext, ctx.hasNarrativeGroup);
    }
  }

  private checkAggressiveSystem(systemId: string, metric: { relationshipsCreated: number; lastThrottleCheck: number }): void {
    if (metric.relationshipsCreated > 500 && this.graph.tick - metric.lastThrottleCheck > 20) {
      this.logWarning(`⚠️  AGGRESSIVE SYSTEM: ${systemId} has created ${metric.relationshipsCreated} relationships`);
      metric.lastThrottleCheck = this.graph.tick;
    }
    this.systemMetrics.set(systemId, metric);
  }

  private applyResultModifications(result: SystemResult, system: SimulationSystem): void {
    for (const mod of result.entitiesModified) {
      this.applySingleModification(mod, system, result.narrationsByGroup);
    }
  }

  private applySingleModification(
    mod: SystemResult['entitiesModified'][0],
    system: SimulationSystem,
    narrationsByGroup?: Record<string, string>
  ): void {
    const ctx = this.enterModificationContext(mod, system, narrationsByGroup);
    const changes = { ...mod.changes };
    const entity = this.graph.getEntity(mod.id);

    if (changes.tags && entity) {
      changes.tags = applyTagPatch(entity.tags, changes.tags);
    }

    this.debugProminenceChange(entity, changes, system.id, mod.id);
    this.recordModificationChange(entity, mod, changes, system);

    updateEntity(this.graph, mod.id, changes);

    if (ctx.hasNarrativeGroup || ctx.needsFallback) this.mutationTracker.exitContext();
    if (ctx.hasAction) this.mutationTracker.exitContext();
  }

  private enterModificationContext(
    mod: SystemResult['entitiesModified'][0],
    system: SimulationSystem,
    narrationsByGroup?: Record<string, string>
  ): { hasAction: boolean; hasNarrativeGroup: boolean; needsFallback: boolean } {
    const actionAttribution = mod.actionContext;
    const hasAction = !!(actionAttribution && actionAttribution.source === 'action');

    if (hasAction) {
      const narration = narrationsByGroup?.[mod.narrativeGroupId || ''];
      this.mutationTracker.enterContext(actionAttribution!.source, actionAttribution!.sourceId, actionAttribution!.success, narration);
    }

    const hasNarrativeGroup = !!(mod.narrativeGroupId && !hasAction);
    const needsFallback = !hasAction && !hasNarrativeGroup;

    if (hasNarrativeGroup) {
      const narration = narrationsByGroup?.[mod.narrativeGroupId || ''];
      this.mutationTracker.enterContext('system', `${system.id}:${mod.narrativeGroupId}`, undefined, narration);
    } else if (needsFallback) {
      this.mutationTracker.enterContext('system', `${system.id}:${mod.id}`);
    }

    return { hasAction, hasNarrativeGroup, needsFallback };
  }

  private debugProminenceChange(
    entity: HardState | undefined,
    changes: Partial<HardState>,
    systemId: string,
    modId: string
  ): void {
    if (GraphStore.DEBUG_PROMINENCE && 'prominence' in changes && entity) {
      console.log(`[PROMINENCE-FLOW] tick=${this.graph.tick} system=${systemId} entity=${entity.name} (${modId})`);
      console.log(`  entity.prominence=${entity.prominence} changes.prominence=${changes.prominence}`);
    }
  }

  private buildModificationCatalyst(
    mod: SystemResult['entitiesModified'][0],
    system: SimulationSystem
  ): { entityId: string; actionType: string; success?: boolean } {
    const attribution = mod.actionContext;
    if (attribution) {
      return { entityId: attribution.sourceId, actionType: attribution.sourceId, success: attribution.success };
    }
    return { entityId: system.id, actionType: system.name };
  }

  private recordModificationChange(
    entity: HardState | undefined,
    mod: SystemResult['entitiesModified'][0],
    changes: Partial<HardState>,
    system: SimulationSystem
  ): void {
    if (!entity) return;
    const catalyst = this.buildModificationCatalyst(mod, system);
    this.stateChangeTracker.recordEntityChange(entity, changes, catalyst);
    this.trackModificationTagChanges(mod.id, entity, changes, catalyst);
  }

  private trackModificationTagChanges(
    entityId: string,
    entity: HardState,
    changes: Partial<HardState>,
    catalyst: { entityId: string; actionType: string; success?: boolean }
  ): void {
    if (!changes.tags) return;
    const oldTags = entity.tags || {};
    const newTags = changes.tags;

    for (const [tag, value] of Object.entries(newTags)) {
      if (!(tag in oldTags)) {
        this.stateChangeTracker.recordTagChange(entityId, tag, 'added', value, catalyst);
      }
    }
    for (const tag of Object.keys(oldTags)) {
      if (!(tag in newTags)) {
        this.stateChangeTracker.recordTagChange(entityId, tag, 'removed', undefined, catalyst);
      }
    }
  }

  private applyResultPressureChanges(result: SystemResult, systemId: string): void {
    for (const [pressure, delta] of Object.entries(result.pressureChanges)) {
      const current = this.graph.pressures.get(pressure) || 0;
      this.graph.pressures.set(pressure, Math.max(-100, Math.min(100, current + Number(delta))));
      this.trackPressureModification(pressure, Number(delta), { type: 'system', systemId });
    }
  }

  private handleEraTransition(result: SystemResult): void {
    const eraTransition = result.details?.eraTransition as {
      fromEra: string; fromEraId: string; toEra: string; toEraId: string;
    } | undefined;

    if (!eraTransition) return;
    this.recordEpochEraTransition(eraTransition);

    if (!this.stateChangeTracker.isEnabled()) return;
    this.buildEraTransitionNarrative(eraTransition);
  }

  private buildEraTransitionNarrative(eraTransition: { fromEra: string; toEra: string }): void {
    const oldEra = this.graph.getEntities({ includeHistorical: true })
      .find(e => e.kind === 'era' && e.name === eraTransition.fromEra);
    const newEra = this.graph.getEntities({ includeHistorical: true })
      .find(e => e.kind === 'era' && e.name === eraTransition.toEra);
    if (!oldEra || !newEra) return;

    const prominentFromEra = this.graph.getEntities({ includeHistorical: false })
      .filter(e => e.kind !== 'era' && e.prominence >= 3.0)
      .sort((a, b) => b.prominence - a.prominence)
      .slice(0, 2);

    let description = `As ${oldEra.name} fades and ${newEra.name} takes hold, the Ice remembers`;
    if (prominentFromEra.length === 0) {
      description += ` all who endured.`;
    } else if (prominentFromEra.length === 1) {
      description += ` the deeds of ${prominentFromEra[0].name}.`;
    } else {
      description += ` the deeds of ${prominentFromEra[0].name} and ${prominentFromEra[1].name}.`;
    }

    const eraEvent: NarrativeEvent = {
      id: `era-${this.graph.tick}-${crypto.randomUUID().slice(0, 11)}`,
      tick: this.graph.tick,
      era: newEra.id,
      eventKind: 'era_transition',
      significance: 0.95,
      subject: { id: oldEra.id, name: oldEra.name, kind: oldEra.kind, subtype: oldEra.subtype },
      action: 'ended',
      participantEffects: [
        { entity: { id: oldEra.id, name: oldEra.name, kind: oldEra.kind, subtype: oldEra.subtype }, effects: [{ type: 'ended', description: 'era concluded' }] },
        { entity: { id: newEra.id, name: newEra.name, kind: newEra.kind, subtype: newEra.subtype }, effects: [{ type: 'created', description: 'era began' }] },
      ],
      description,
      narrativeTags: ['era', 'transition', 'historical', 'temporal'],
    };
    this.graph.narrativeHistory.push(eraEvent);
  }

  private emitSystemActionIfMeaningful(
    result: SystemResult,
    system: SimulationSystem,
    directAdded: number,
    addedFromResult: number
  ): void {
    const reportedModifications = typeof result.details?.significantModificationCount === 'number'
      ? result.details.significantModificationCount
      : result.entitiesModified.length;

    const didMeaningfulWork =
      directAdded > 0 ||
      addedFromResult > 0 ||
      (result.relationshipsAdjusted && result.relationshipsAdjusted.length > 0) ||
      reportedModifications > 0 ||
      Object.keys(result.pressureChanges).length > 0;

    if (!didMeaningfulWork) return;

    this.emitter.systemAction({
      tick: this.graph.tick,
      epoch: this.currentEpoch,
      systemId: system.id,
      systemName: system.name,
      relationshipsAdded: directAdded + addedFromResult,
      entitiesModified: reportedModifications,
      pressureChanges: result.pressureChanges,
      description: result.description,
      details: result.details,
    });
  }

  private recordSystemNarrations(result: SystemResult, systemId: string): void {
    if (result.narrationsByGroup && Object.keys(result.narrationsByGroup).length > 0) {
      if (systemId === 'universal_catalyst') {
        for (const [groupId, narration] of Object.entries(result.narrationsByGroup)) {
          this.stateChangeTracker.recordNarration('action', groupId, narration);
        }
      } else {
        this.stateChangeTracker.recordNarrationsByGroup('system', systemId, result.narrationsByGroup);
      }
    // eslint-disable-next-line sonarjs/deprecation -- handles legacy systems that still use narrations[]
    } else if (result.narrations && result.narrations.length > 0) {
      // eslint-disable-next-line sonarjs/deprecation -- bridges deprecated narrations[] to current API
      this.stateChangeTracker.recordSystemNarrations(systemId, result.narrations);
    }
  }
  
  private recordEpochEraTransition(transition: {
    fromEra: string;
    fromEraId: string;
    toEra: string;
    toEraId: string;
  }): void {
    const entry: EpochEraTransitionSummary = {
      tick: this.graph.tick,
      from: { id: transition.fromEraId, name: transition.fromEra },
      to: { id: transition.toEraId, name: transition.toEra }
    };
    const last = this.epochEraTransitions[this.epochEraTransitions.length - 1];
    if (last && last.tick === entry.tick && last.from.id === entry.from.id && last.to.id === entry.to.id) {
      return;
    }
    this.epochEraTransitions.push(entry);
  }

  private updatePressures(era: Era): void {
    // Collect detailed pressure changes for emitting
    const pressureDetails: PressureChangeDetail[] = [];

    this.runtimePressures.forEach(pressure => {
      // previousValue = tick start value (before systems ran) for accurate delta reporting
      const previousValue = this.tickStartPressures.get(pressure.id)
        ?? this.graph.pressures.get(pressure.id)
        ?? pressure.value;

      // currentValue = value AFTER systems ran (includes discrete modifications)
      const currentValueAfterSystems = this.graph.pressures.get(pressure.id) ?? pressure.value;

      // Get detailed breakdown from declarative definition
      const declarativeDef = this.declarativePressures.get(pressure.id);
      if (!declarativeDef) {
        throw new Error(`No declarative definition found for pressure: ${pressure.id}`);
      }
      const breakdown = evaluatePressureGrowthWithBreakdown(declarativeDef, this.graph);

      // Apply diminishing returns for high pressure values to prevent maxing out
      // Growth is scaled down as pressure magnitude approaches limits
      const normalizedMagnitude = Math.abs(currentValueAfterSystems) / 100;
      const growthScaling = Math.max(0.1, 1 - Math.pow(normalizedMagnitude, 2)); // Symmetric damping near ±100
      const scaledFeedback = breakdown.feedbackTotal * growthScaling;

      // Homeostatic pull toward equilibrium (0)
      const homeostaticDelta = (0 - currentValueAfterSystems) * pressure.homeostasis;

      // Apply era modifier if present
      const eraModifier = era.pressureModifiers?.[pressure.id] || 1.0;

      const rawDelta = (scaledFeedback + homeostaticDelta) * eraModifier;

      // Smooth large changes to prevent spikes (default max change per tick: ±10)
      const smoothingLimit = this.config.pressureDeltaSmoothing ?? 10;
      const smoothedDelta = Math.max(-smoothingLimit, Math.min(smoothingLimit, rawDelta));

      // Apply feedback delta ON TOP OF system modifications
      const newValue = Math.max(-100, Math.min(100, currentValueAfterSystems + smoothedDelta));
      this.graph.pressures.set(pressure.id, newValue);

      // Build detailed change record
      pressureDetails.push({
        id: pressure.id,
        name: pressure.name,
        previousValue,
        newValue,
        delta: newValue - previousValue,
        breakdown: {
          positiveFeedback: breakdown.positiveFeedback,
          negativeFeedback: breakdown.negativeFeedback,
          feedbackTotal: breakdown.feedbackTotal,
          growthScaling,
          scaledFeedback,
          homeostasis: pressure.homeostasis,
          homeostaticDelta,
          eraModifier,
          rawDelta,
          smoothedDelta
        }
      });
    });

    // Emit pressure update event with full breakdown
    this.emitter.pressureUpdate({
      tick: this.graph.tick,
      epoch: this.currentEpoch,
      pressures: pressureDetails,
      discreteModifications: [...this.pendingPressureModifications]
    });

    // Clear pending modifications for next tick
    this.pendingPressureModifications = [];
  }

  /**
   * Track a discrete pressure modification for inclusion in pressure_update event
   */
  private trackPressureModification(
    pressureId: string,
    delta: number,
    source: PressureModificationSource
  ): void {
    if (delta !== 0) {
      this.pendingPressureModifications.push({ pressureId, delta, source });
    }
  }

  private monitorRelationshipGrowth(): void {
    const currentCount = this.graph.getRelationshipCount();
    const growth = currentCount - this.lastRelationshipCount;

    // Update rolling window
    this.graph.growthMetrics.relationshipsPerTick.push(growth);
    if (this.graph.growthMetrics.relationshipsPerTick.length > 20) {
      this.graph.growthMetrics.relationshipsPerTick.shift();
    }

    // Calculate average growth rate
    const window = this.graph.growthMetrics.relationshipsPerTick;
    const avgGrowth = window.reduce((a, b) => a + b, 0) / (window.length || 1);
    this.graph.growthMetrics.averageGrowthRate = avgGrowth;

    // Warn if exponential growth detected
    if (avgGrowth > 30 && window.length >= 10) {
      this.logWarning(`⚠️  HIGH RELATIONSHIP GROWTH RATE: ${avgGrowth.toFixed(1)}/tick`);
      this.logWarning(`   Current: ${currentCount} relationships, growing at ${avgGrowth.toFixed(1)}/tick`);
      this.logWarning(`   Consider reducing system probabilities or adding throttling`);
    }

    this.lastRelationshipCount = currentCount;
  }

  private pruneAndConsolidate(): void {
    // Mark very old, unconnected entities as 'forgotten'
    // Forgotten is prominence < 1.0
    const allEntities = this.graph.getEntities();
    for (const entity of allEntities) {
      if (entity.prominence < 1.0) continue; // already forgotten

      const age = this.graph.tick - entity.createdAt;
      const connections = this.graph.getEntityRelationships(entity.id).length;

      if (age > 50 && connections < 2) {
        this.graph.updateEntity(entity.id, { prominence: 0.5 }); // set to forgotten
      }
    }
    
    // Mark historical NPCs (those who have passed)
    const npcs = findEntities(this.graph, { kind: 'npc', status: 'alive' });
    npcs.forEach(npc => {
      const age = this.graph.tick - npc.createdAt;
      // eslint-disable-next-line sonarjs/pseudo-random -- simulation probability for NPC aging
      if (age > 80 && Math.random() > 0.7) {
        this.graph.updateEntity(npc.id, { status: 'historical' });
      }
    });
  }

  // =============================================================================
  // ENRICHMENT METHODS - Moved to @illuminator
  // These are stubs/no-ops. Connect illuminator for LLM enrichment.
  // =============================================================================

  // Era narrative - no-op without illuminator
  private queueEraNarrative(_fromEra: Era, _toEra: Era): void {
    // Enrichment moved to @illuminator - this is a no-op
  }

  // Change enrichments - no-op without illuminator
  private queueChangeEnrichments(): void {
    // Enrichment moved to @illuminator - this is a no-op
  }

  // Export methods
  public getCurrentTick(): number {
    return this.graph.tick;
  }

  public getEntityCount(): number {
    return this.graph.getEntityCount();
  }

  public getRelationshipCount(): number {
    return this.graph.getRelationshipCount();
  }

  public finalizeNameLogging(): void {
    // Print name-forge generation stats
    if (this.nameForgeService) {
      this.nameForgeService.printStats();
    }
    // LLM name logging moved to @illuminator
  }

  public async finalizeEnrichments(): Promise<void> {
    // Enrichment moved to @illuminator - this is now a no-op
  }

  public exportState(): Record<string, unknown> {
    const entities = this.graph.getEntities({ includeHistorical: true });
    const relationships = this.graph.getRelationships({ includeHistorical: true });

    // Extract meta-entities for visibility
    const metaEntities = entities.filter(e => hasTag(e.tags, FRAMEWORK_TAGS.META_ENTITY));

    const coordinateState = this.coordinateContext.export();

    return {
      schema: this.config.schema,
      metadata: {
        simulationRunId: this.simulationRunId,
        tick: this.graph.tick,
        epoch: this.currentEpoch,
        era: this.graph.currentEra.name,
        entityCount: entities.length,
        relationshipCount: relationships.length,
        metaEntityCount: metaEntities.length,
        metaEntityFormation: {
          totalFormed: this.metaEntitiesFormed.length,
          formations: this.metaEntitiesFormed,
          comment: 'Meta-entities are ability/rule entities that emerged from clustering, marked with meta-entity tag'
        },
        reachability: this.getReachabilityMetrics()
      },
      hardState: entities,
      relationships,
      pressures: Object.fromEntries(this.graph.pressures),
      narrativeHistory: this.graph.narrativeHistory.length > 0 ? this.graph.narrativeHistory : undefined,
      // loreRecords moved to @illuminator
      coordinateState
    };
  }

  /**
   * Import coordinate state from a previously exported world.
   * Restores emergent regions into the active coordinate context.
   */
  public importCoordinateState(coordinateState: ReturnType<CoordinateContext['export']>): void {
    this.coordinateContext.import(coordinateState);
  }

  /**
   * Export statistics for fitness evaluation
   */
  public exportStatistics(validationResults: ValidationStats): SimulationStatistics {
    // Enrichment analytics moved to @illuminator - pass zeros
    return this.statisticsCollector.generateStatistics(
      this.graph,
      this.config,
      {
        locationEnrichments: 0,
        factionEnrichments: 0,
        ruleEnrichments: 0,
        abilityEnrichments: 0,
        npcEnrichments: 0,
        totalEnrichments: 0
      },
      validationResults
    );
  }
}
