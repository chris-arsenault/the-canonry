import { Graph, GraphStore, EngineConfig, Era, GrowthTemplate, Pressure, SimulationSystem, EpochEraSummary, EpochEraTransitionSummary } from '../engine/types';
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
import { selectEra, getTemplateWeight, getSystemModifier } from '../engine/eraUtils';
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
import { FRAMEWORK_ENTITY_KINDS, FRAMEWORK_STATUS, FRAMEWORK_TAGS, type NarrativeEvent } from '@canonry/world-schema';
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
  private runtimePressures: Pressure[];  // Converted from declarative pressures
  private declarativePressures: Map<string, DeclarativePressure>;  // Original declarative pressures for breakdown
  private runtimeTemplates: GrowthTemplate[];  // Converted from declarative templates
  private declarativeTemplates: Map<string, DeclarativeTemplate>;  // Original declarative templates for diagnostics
  private runtimeSystems: SimulationSystem[];  // Converted from declarative systems
  private growthSystem?: GrowthSystem;  // Distributed growth system (framework-managed)
  private templateInterpreter: TemplateInterpreter;  // Interprets declarative templates
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

    // Convert declarative pressures to runtime pressures
    // If pressure already has a growth function, it's already a runtime Pressure - use as-is
    // Also store declarative definitions for detailed breakdown in pressure_update events
    this.declarativePressures = new Map();
    this.runtimePressures = config.pressures.map(p => {
      const runtimePressure = p as any;
      if (runtimePressure.homeostasis === undefined) {
        throw new Error(`Pressure '${runtimePressure.id}' is missing required homeostasis parameter.`);
      }
      if (typeof runtimePressure.growth === 'function') {
        throw new Error(`Pressure '${runtimePressure.id}' must be declarative. Runtime pressure objects are no longer supported.`);
      }
      // Store declarative pressure for breakdown
      this.declarativePressures.set(p.id, p);
      return createPressureFromDeclarative(p);
    });

    // Convert declarative templates to runtime templates
    // If template already has canApply function, it's already a GrowthTemplate - use as-is
    this.templateInterpreter = new TemplateInterpreter();
    this.declarativeTemplates = new Map();
    this.runtimeTemplates = config.templates.map(t => {
      if (typeof (t as any).canApply === 'function') {
        // Already a GrowthTemplate (e.g., from tests)
        return t as unknown as GrowthTemplate;
      }
      // Store declarative template for diagnostics
      this.declarativeTemplates.set(t.id, t);
      return createTemplateFromDeclarative(t, this.templateInterpreter);
    });

    // Convert declarative actions to runtime executable actions
    // These are used by the universalCatalyst system
    if (config.actions && config.actions.length > 0) {
      config.executableActions = loadActions(config.actions);
    }

    // Initialize action usage tracker for diagnostics (success-only)
    config.actionUsageTracker = {
      applications: [],
      countsByActionId: new Map<string, number>(),
      countsByActorId: new Map<string, { name: string; kind: string; count: number }>()
    };

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
    const narrativeConfig = config.narrativeConfig || createDefaultNarrativeConfig();
    this.stateChangeTracker = new StateChangeTracker(narrativeConfig, this.mutationTracker);
    this.stateChangeTracker.setSchema({
      relationshipKinds: config.schema.relationshipKinds,
      entityKinds: config.schema.entityKinds,
      tagRegistry: config.schema.tagRegistry,
    });

    // Populate system and action display names for narrative descriptions
    const sourceNames: Array<{ id: string; name: string }> = [];
    for (const sys of config.systems) {
      if ('systemType' in sys && sys.config) {
        // DeclarativeSystem
        const id = sys.config.id || sys.systemType;
        const name = sys.config.name || id;
        sourceNames.push({ id, name });
      } else if ('id' in sys) {
        // SimulationSystem
        sourceNames.push({ id: sys.id, name: sys.name || sys.id });
      }
    }
    // Also add action names (actions use type as ID, name as display name)
    if (config.executableActions) {
      for (const action of config.executableActions) {
        sourceNames.push({ id: action.type, name: action.name || action.type });
      }
    }
    // Also add template names for narrative attribution
    if (config.templates) {
      for (const template of config.templates) {
        sourceNames.push({ id: template.id, name: template.name || template.id });
      }
    }
    // Also add era names for narrative attribution
    if (config.eras) {
      for (const era of config.eras) {
        sourceNames.push({ id: era.id, name: era.name || era.id });
      }
    }
    this.stateChangeTracker.setSystemNames(sourceNames);

    if (narrativeConfig.enabled) {
      this.emitter.log('info', 'Narrative event tracking enabled', {
        minSignificance: narrativeConfig.minSignificance,
      });
    }

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
      // LINEAGE: Pass mutation tracker so templates can set execution context
      mutationTracker: this.mutationTracker,
      getPendingPressureModifications: () => this.pendingPressureModifications,
      trackPressureModification: this.trackPressureModification.bind(this),
      calculateGrowthTarget: () => this.calculateGrowthTarget(),
      sampleTemplate: (era: Era, templates: GrowthTemplate[], metrics: PopulationMetrics) => this.sampleSingleTemplate(era, templates, metrics),
      getCurrentEpoch: () => this.currentEpoch,
      getEpochEra: () => this.epochEra ?? this.graph.currentEra
    };

    for (const sys of config.systems) {
      if (typeof (sys as any).apply === 'function') {
        const runtime = sys as SimulationSystem;
        if (!this.growthSystem && (runtime.id === 'growth' || runtime.id === 'framework-growth')) {
          this.growthSystem = runtime as GrowthSystem;
          continue;
        }
        runtimeSystems.push(runtime);
        continue;
      }

      if (isDeclarativeSystem(sys) && (sys as DeclarativeGrowthSystem).systemType === 'growth') {
        if (this.growthSystem) {
          throw new Error('Multiple growth systems configured. Only one growth system is supported.');
        }
        this.growthSystem = createGrowthSystem((sys as DeclarativeGrowthSystem).config, growthDependencies);
        continue;
      }

      runtimeSystems.push(createSystemFromDeclarative(sys as DeclarativeSystem));
    }

    if (!this.growthSystem && !hasDisabledGrowthSystem) {
      this.growthSystem = createGrowthSystem(
        {
          id: 'framework-growth',
          name: 'Framework Growth',
          description: 'Distributes template growth across simulation ticks'
        },
        growthDependencies
      );
      this.config.systems.push({
        systemType: 'growth',
        config: {
          id: 'framework-growth',
          name: 'Framework Growth',
          description: 'Distributes template growth across simulation ticks'
        }
      } as DeclarativeGrowthSystem);
    }

    this.runtimeSystems = this.growthSystem
      ? [this.growthSystem, ...runtimeSystems]
      : runtimeSystems;

    // Initialize any systems that have an initialize() method
    for (const system of this.runtimeSystems) {
      if (system.initialize) {
        system.initialize();
      }
    }

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
    initialState.forEach(entity => {
      const id = entity.id;
      if (!id) {
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

      const narrativeHint = entity.narrativeHint ?? entity.summary ?? (entity.description ? entity.description : undefined);

      const loadedEntity: HardState = {
        ...entity,
        id,
        coordinates,
        createdAt: 0,
        updatedAt: 0,
        narrativeHint,
        // Seed entities with summaries should have them locked (user-defined, not to be overwritten by enrichment)
        lockedSummary: entity.summary ? true : undefined
      };

      // Initialize catalyst properties for prominent entities
      // Pass graph for domain-specific action domain mapping
      initializeCatalystSmart(loadedEntity);

      // Assign region for seed entities (consistent with template-generated entities)
      if (loadedEntity.coordinates && !loadedEntity.regionId) {
        const lookup = this.runtime.lookupRegion(loadedEntity.kind, loadedEntity.coordinates);
        if (lookup.primary) {
          loadedEntity.regionId = lookup.primary.id;
          loadedEntity.allRegionIds = lookup.all.map(r => r.id);
        }
      }

      this.graph._loadEntity(id, loadedEntity);
    });

    // Load relationships from seedRelationships array
    if (config.seedRelationships) {
      config.seedRelationships.forEach(rel => {
        const srcEntity = this.graph.getEntity(rel.src) || this.findEntityByName(rel.src);
        const dstEntity = this.graph.getEntity(rel.dst) || this.findEntityByName(rel.dst);

        if (srcEntity && dstEntity) {
          this.graph.addRelationship(
            rel.kind,
            srcEntity.id,
            dstEntity.id,
            rel.strength,
            rel.distance
          );
        }
      });
    }

    // Create genesis narrative event for seed entities
    const genesisEvent = this.buildGenesisEvent(config.eras[0].id);
    if (genesisEvent) {
      this.graph.narrativeHistory.push(genesisEvent);
    }
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
      const effects: NarrativeEvent['participantEffects'][0]['effects'] = [];

      // Entity creation effect
      effects.push({
        type: 'created',
        description: this.getGenesisCreationVerb(entity.kind)
      });

      // Relationship effects
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
            id: other.id,
            name: other.name,
            kind: other.kind,
            subtype: other.subtype
          },
          description: this.getGenesisRelationshipVerb(rel.kind, isSource, other.name)
        });
      }

      participantEffects.push({
        entity: {
          id: entity.id,
          name: entity.name,
          kind: entity.kind,
          subtype: entity.subtype
        },
        effects
      });
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
    this.simulationRunId = `run_${this.startTime}_${Math.random().toString(36).slice(2, 9)}`;
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

    const adjacency = new Map<string, Set<string>>();
    for (const entity of entities) {
      adjacency.set(entity.id, new Set());
    }

    for (const rel of this.graph.getRelationships()) {
      if (!adjacency.has(rel.src) || !adjacency.has(rel.dst)) continue;
      adjacency.get(rel.src)?.add(rel.dst);
      adjacency.get(rel.dst)?.add(rel.src);
    }

    const visited = new Set<string>();
    let components = 0;

    for (const nodeId of adjacency.keys()) {
      if (visited.has(nodeId)) continue;
      components += 1;
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
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

    return { components, entityCount };
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
  public async finalize(): Promise<Graph> {
    if (this.simulationComplete) {
      return this.graph;
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

    return this.graph;
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
    if (this.config.maxEpochs === undefined) {
      throw new Error('WorldEngine config missing required maxEpochs');
    }
    return this.config.maxEpochs;
  }

  /**
   * Reset simulation to initial state (for step mode)
   * Allows re-running the simulation from the beginning
   */
  public reset(initialState: HardState[]): void {
    // Reset simulation state
    this.simulationStarted = false;
    this.simulationComplete = false;
    this.currentEpoch = 0;
    this.epochEra = null;
    this.epochEraTransitions = [];
    this.startTime = 0;

    // Reset tracking maps
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

    // Reset coordinate statistics
    coordinateStats.reset();

    // Recreate graph from initial state
    this.graph = GraphStore.create(this.config.eras[0], this.config.pressures);
    // Set mutation tracker for lineage stamping (see LINEAGE.md)
    this.graph.mutationTracker = this.mutationTracker;
    this.graph.rateLimitState = {
      currentThreshold: 0.3,
      lastCreationTick: -999,
      creationsThisEpoch: 0
    };

    this.runtime = new WorldRuntime(this.graph, this.targetSelector, this.coordinateContext, this.config);

    // Reload initial entities
    initialState.forEach(entity => {
      const id = entity.id;
      if (!id) {
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

      const narrativeHint = entity.narrativeHint ?? entity.summary ?? (entity.description ? entity.description : undefined);

      const loadedEntity: HardState = {
        ...entity,
        id,
        coordinates,
        createdAt: 0,
        updatedAt: 0,
        narrativeHint,
        // Seed entities with summaries should have them locked (user-defined, not to be overwritten by enrichment)
        lockedSummary: entity.summary ? true : undefined
      };

      initializeCatalystSmart(loadedEntity);

      // Assign region for seed entities (consistent with template-generated entities)
      if (loadedEntity.coordinates && !loadedEntity.regionId) {
        const lookup = this.runtime.lookupRegion(loadedEntity.kind, loadedEntity.coordinates);
        if (lookup.primary) {
          loadedEntity.regionId = lookup.primary.id;
          loadedEntity.allRegionIds = lookup.all.map(r => r.id);
        }
      }

      this.graph._loadEntity(id, loadedEntity);
    });

    // Reload seed relationships
    if (this.config.seedRelationships) {
      this.config.seedRelationships.forEach(rel => {
        const srcEntity = this.graph.getEntity(rel.src) || this.findEntityByName(rel.src);
        const dstEntity = this.graph.getEntity(rel.dst) || this.findEntityByName(rel.dst);

        if (srcEntity && dstEntity) {
          this.graph.addRelationship(
            rel.kind,
            srcEntity.id,
            dstEntity.id,
            rel.strength,
            rel.distance
          );
        }
      });
    }

    this.updateReachabilityMetrics();

    this.emitter.log('info', 'Simulation reset to initial state');
    this.emitter.progress({
      phase: 'initializing',
      tick: 0,
      maxTicks: this.config.maxTicks,
      epoch: 0,
      totalEpochs: this.getTotalEpochs(),
      entityCount: this.graph.getEntityCount(),
      relationshipCount: this.graph.getRelationshipCount()
    });
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
    // Update metrics one final time
    this.populationTracker.update(this.graph);
    const metrics = this.populationTracker.getMetrics();
    const summary = this.populationTracker.getSummary();
    const outliers = this.populationTracker.getOutliers(0.3);

    // Build entity metrics array
    const entityMetrics = Array.from(metrics.entities.values())
      .filter(m => m.target > 0)
      .map(m => ({
        kind: m.kind,
        subtype: m.subtype,
        count: m.count,
        target: m.target,
        deviation: m.deviation
      }));

    // Build pressure metrics array
    const pressureMetrics: Array<{ id: string; value: number; target: number; deviation: number }> = [];
    summary.pressureDeviations.forEach((deviation, pressureId) => {
      const metric = metrics.pressures.get(pressureId);
      if (metric) {
        pressureMetrics.push({
          id: pressureId,
          value: metric.value,
          target: metric.target,
          deviation
        });
      }
    });

    this.emitter.populationReport({
      totalEntities: summary.totalEntities,
      totalRelationships: summary.totalRelationships,
      avgDeviation: summary.avgEntityDeviation,
      maxDeviation: summary.maxEntityDeviation,
      entityMetrics,
      pressureMetrics,
      outliers: {
        overpopulated: outliers.overpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        })),
        underpopulated: outliers.underpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        }))
      }
    });

    // Emit template usage report
    const sortedTemplates = Array.from(this.templateRunCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const totalRuns = sortedTemplates.reduce((sum, [_, count]) => sum + count, 0);

    const unusedTemplates = this.runtimeTemplates.filter(t => !this.templateRunCounts.has(t.id));
    const diagnosticView = this.runtime;

    this.emitter.templateUsage({
      totalApplications: totalRuns,
      uniqueTemplatesUsed: sortedTemplates.length,
      totalTemplates: this.runtimeTemplates.length,
      maxRunsPerTemplate: this.maxRunsPerTemplate,
      usage: sortedTemplates.slice(0, 20).map(([templateId, count]) => ({
        templateId,
        count,
        percentage: totalRuns > 0 ? (count / totalRuns) * 100 : 0,
        status: count >= this.maxRunsPerTemplate ? 'saturated' as const :
                count >= this.maxRunsPerTemplate * 0.7 ? 'warning' as const : 'healthy' as const
      })),
      unusedTemplates: unusedTemplates.map(t => {
        const declarativeTemplate = this.declarativeTemplates.get(t.id);
        if (declarativeTemplate) {
          const diagnosis = this.templateInterpreter.diagnoseCanApply(declarativeTemplate, diagnosticView);
          const summary = diagnosis.failedRules.length > 0
            ? `Failed: ${diagnosis.failedRules[0].split(':')[0]}`
            : diagnosis.selectionCount === 0
              ? 'No valid targets'
              : !diagnosis.requiredVariablesPassed
                ? `Required variables failed: ${diagnosis.failedVariables.join(', ')}`
                : 'Unknown';
          return {
            templateId: t.id,
            failedRules: diagnosis.failedRules,
            selectionCount: diagnosis.selectionCount,
            summary,
            selectionDiagnosis: diagnosis.selectionDiagnosis,
            variableDiagnoses: diagnosis.failedVariableDiagnoses.length > 0
              ? diagnosis.failedVariableDiagnoses
              : undefined
          };
        }
        return {
          templateId: t.id,
          failedRules: [],
          selectionCount: 0,
          summary: 'Non-declarative template'
        };
      })
    });

    // Emit tag health report
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

    // Emit system health
    const populationHealth = 1 - summary.avgEntityDeviation;
    this.emitter.systemHealth({
      populationHealth,
      status: populationHealth > 0.8 ? 'stable' :
              populationHealth > 0.6 ? 'functional' : 'needs_attention'
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
    // Update population metrics
    this.populationTracker.update(this.graph);
    const metrics = this.populationTracker.getMetrics();
    const summary = this.populationTracker.getSummary();
    const outliers = this.populationTracker.getOutliers(0.3);

    // Build entity metrics array
    const entityMetrics = Array.from(metrics.entities.values())
      .filter(m => m.target > 0)
      .map(m => ({
        kind: m.kind,
        subtype: m.subtype,
        count: m.count,
        target: m.target,
        deviation: m.deviation
      }));

    // Build pressure metrics array
    const pressureMetrics: Array<{ id: string; value: number; target: number; deviation: number }> = [];
    summary.pressureDeviations.forEach((deviation, pressureId) => {
      const metric = metrics.pressures.get(pressureId);
      if (metric) {
        pressureMetrics.push({
          id: pressureId,
          value: metric.value,
          target: metric.target,
          deviation
        });
      }
    });

    // Emit population report
    this.emitter.populationReport({
      totalEntities: summary.totalEntities,
      totalRelationships: summary.totalRelationships,
      avgDeviation: summary.avgEntityDeviation,
      maxDeviation: summary.maxEntityDeviation,
      entityMetrics,
      pressureMetrics,
      outliers: {
        overpopulated: outliers.overpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        })),
        underpopulated: outliers.underpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        }))
      }
    });

    // Emit template usage report
    const sortedTemplates = Array.from(this.templateRunCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const totalRuns = sortedTemplates.reduce((sum, [_, count]) => sum + count, 0);

    const unusedTemplates = this.runtimeTemplates.filter(t => !this.templateRunCounts.has(t.id));
    const diagnosticView = this.runtime;

    this.emitter.templateUsage({
      totalApplications: totalRuns,
      uniqueTemplatesUsed: sortedTemplates.length,
      totalTemplates: this.runtimeTemplates.length,
      maxRunsPerTemplate: this.maxRunsPerTemplate,
      usage: sortedTemplates.slice(0, 20).map(([templateId, count]) => ({
        templateId,
        count,
        percentage: totalRuns > 0 ? (count / totalRuns) * 100 : 0,
        status: count >= this.maxRunsPerTemplate ? 'saturated' as const :
                count >= this.maxRunsPerTemplate * 0.7 ? 'warning' as const : 'healthy' as const
      })),
      unusedTemplates: unusedTemplates.map(t => {
        const declarativeTemplate = this.declarativeTemplates.get(t.id);
        if (declarativeTemplate) {
          const diagnosis = this.templateInterpreter.diagnoseCanApply(declarativeTemplate, diagnosticView);
          const summary = diagnosis.failedRules.length > 0
            ? `Failed: ${diagnosis.failedRules[0].split(':')[0]}`
            : diagnosis.selectionCount === 0
              ? 'No valid targets'
              : !diagnosis.requiredVariablesPassed
                ? `Required variables failed: ${diagnosis.failedVariables.join(', ')}`
                : 'Unknown';
          return {
            templateId: t.id,
            failedRules: diagnosis.failedRules,
            selectionCount: diagnosis.selectionCount,
            summary,
            selectionDiagnosis: diagnosis.selectionDiagnosis,
            variableDiagnoses: diagnosis.failedVariableDiagnoses.length > 0
              ? diagnosis.failedVariableDiagnoses
              : undefined
          };
        }
        return {
          templateId: t.id,
          failedRules: [],
          selectionCount: 0,
          summary: 'Non-declarative template'
        };
      })
    });

    // Emit system health
    const populationHealth = 1 - summary.avgEntityDeviation;
    this.emitter.systemHealth({
      populationHealth,
      status: populationHealth > 0.8 ? 'stable' :
              populationHealth > 0.6 ? 'functional' : 'needs_attention'
    });
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
        reachability: this.getReachabilityMetrics(),
        enrichmentTriggers: {}
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

    const currentCounts = new Map<string, number>();

    // Count current entities by kind
    this.graph.forEachEntity((entity) => {
      if (!this.targetTotalsByKind.has(entity.kind)) {
        return;
      }
      currentCounts.set(entity.kind, (currentCounts.get(entity.kind) || 0) + 1);
    });

    // Calculate total remaining entities needed
    let totalRemaining = 0;
    for (const [kind, target] of this.targetTotalsByKind.entries()) {
      const current = currentCounts.get(kind) || 0;
      const remaining = Math.max(0, target - current);
      totalRemaining += remaining;
    }

    if (totalRemaining === 0) return 0;

    const growthPhaseHistory = this.graph.growthPhaseHistory ?? [];
    const completedPhasesByEra = new Map<string, number>();
    for (const entry of growthPhaseHistory) {
      completedPhasesByEra.set(entry.eraId, (completedPhasesByEra.get(entry.eraId) || 0) + 1);
    }
    const completedPhasesTotal = growthPhaseHistory.length;

    const expectedPhasesByEra = new Map<string, number>();
    for (const era of this.config.eras) {
      let expected = 0;
      const exitConditions = era.exitConditions ?? [];
      for (const condition of exitConditions) {
        if (condition.type !== 'growth_phases_complete') continue;
        if (condition.eraId && condition.eraId !== era.id) continue;
        expected = Math.max(expected, Math.max(0, condition.minPhases ?? 0));
      }
      expectedPhasesByEra.set(era.id, expected);
    }

    const currentEraId = this.graph.currentEra?.id ?? '';
    const currentEraExpected = expectedPhasesByEra.get(currentEraId) ?? 0;
    const currentEraCompleted = completedPhasesByEra.get(currentEraId) ?? 0;
    const currentEraRemaining = Math.max(0, currentEraExpected - currentEraCompleted);

    const seenEraIds = new Set(
      this.graph.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA, includeHistorical: true })
        .map(entity => entity.subtype)
    );

    let phasesRemaining = currentEraRemaining;
    for (const era of this.config.eras) {
      if (era.id === currentEraId) continue;
      if (seenEraIds.has(era.id)) continue;
      phasesRemaining += expectedPhasesByEra.get(era.id) ?? 0;
    }

    const totalPlannedPhases = completedPhasesTotal + phasesRemaining;
    const rawPhaseProgress = completedPhasesTotal / Math.max(1, totalPlannedPhases - 1);
    const phaseProgress = Math.min(1, Math.max(0, rawPhaseProgress));

    // Apply front-loaded slope: early growth phases get more growth, later phases get less
    // slopeMultiplier ranges from 1.3 (phase 0) to 0.7 (final phase)
    const slope = 0.3;
    const finalEraConfig = this.config.eras[this.config.eras.length - 1];
    const isFinalEra = finalEraConfig ? currentEraId === finalEraConfig.id : false;
    const exhaustPlannedPhases = phasesRemaining <= 0;
    const forceBudgetConsumption = isFinalEra || exhaustPlannedPhases;
    const slopeMultiplier = forceBudgetConsumption ? 1 : 1 + slope - (phaseProgress * slope * 2);

    // Dynamic target: spread remaining entities over remaining growth phases with slope
    const finalEraExpected = finalEraConfig ? (expectedPhasesByEra.get(finalEraConfig.id) ?? 0) : 0;
    const finalEraCompleted = finalEraConfig ? (completedPhasesByEra.get(finalEraConfig.id) ?? 0) : 0;
    const remainingFinalPhases = Math.max(1, finalEraExpected - finalEraCompleted);
    const remainingPhasesBudget = isFinalEra ? remainingFinalPhases : Math.max(1, phasesRemaining);
    const baseTarget = Math.ceil(totalRemaining / remainingPhasesBudget);
    const slopedTarget = Math.ceil(baseTarget * slopeMultiplier);

    // Add some variance for organic feel (±20%)
    const variance = forceBudgetConsumption ? 0 : 0.2;
    const target = Math.floor(slopedTarget * (1 - variance + Math.random() * variance * 2));

    // Cap at reasonable bounds
    return Math.max(this.growthBounds.min, Math.min(this.growthBounds.max, target));
  }

  private async runSimulationTick(tickEra: Era): Promise<void> {
    let totalRelationships = 0;
    let totalModifications = 0;
    const relationshipsThisTick: Relationship[] = [];
    const modifiedEntityIds: string[] = [];

    // Initialize mutation tracker for this tick (lineage system - see LINEAGE.md)
    this.mutationTracker.setTick(this.graph.tick);

    // Initialize narrative tracking for this tick
    this.stateChangeTracker.startTick(this.graph, this.graph.tick, tickEra.id);

    // Budget enforcement
    const budget = this.config.relationshipBudget?.maxPerSimulationTick || Infinity;
    let relationshipsAddedThisTick = 0;

    for (const system of this.runtimeSystems) {
      const modifierEra = this.growthSystem && system === this.growthSystem && this.epochEra
        ? this.epochEra
        : tickEra;
      const baseModifier = getSystemModifier(modifierEra, system.id);
      if (baseModifier === 0) continue; // System disabled by era

      const modifier = baseModifier;

      try {
        // Enter execution context for lineage tracking (see LINEAGE.md)
        // This stamps createdBy on any entities/relationships created during system execution
        // IMPORTANT: Context must wrap ALL mutations including relationship/entity modifications
        // applied from the result, not just the system.apply() call itself
        this.mutationTracker.enterContext('system', system.id);

        const systemGraphView = this.runtime;
        const relationshipsBefore = this.graph.getRelationshipCount();
        const result = await system.apply(systemGraphView, modifier);

        // Record system execution
        this.statisticsCollector.recordSystemExecution(system.id);

        // Track system metrics
        const metric = this.systemMetrics.get(system.id) || { relationshipsCreated: 0, lastThrottleCheck: 0 };

        // Account for relationships added directly by the system (e.g., growth)
        const directAdded = this.graph.getRelationshipCount() - relationshipsBefore;
        if (directAdded > 0) {
          relationshipsAddedThisTick += directAdded;
          metric.relationshipsCreated += directAdded;
          totalRelationships += directAdded;
          if (relationshipsAddedThisTick > budget) {
            this.logWarning(`⚠️  RELATIONSHIP BUDGET EXCEEDED BY SYSTEM ${system.id}: ${relationshipsAddedThisTick}/${budget}`);
          }
        }

        // Apply relationships with budget check
        // Group by action context for proper narrative attribution
        let addedFromResult = 0;
        for (const rel of result.relationshipsAdded) {
          // Check budget
          if (relationshipsAddedThisTick >= budget) {
            this.logWarning(`⚠️  RELATIONSHIP BUDGET REACHED: ${budget}/tick`);
            this.logWarning(`   Remaining systems may not add relationships this tick`);
            break;
          }

          // Enter action-specific context if provided (for narrative attribution)
          const hasActionContext = rel.actionContext && rel.actionContext.source === 'action';
          if (hasActionContext) {
            // Get narration from narrationsByGroup if available
            const narration = result.narrationsByGroup?.[rel.narrativeGroupId || ''];
            this.mutationTracker.enterContext(rel.actionContext!.source, rel.actionContext!.sourceId, rel.actionContext!.success, narration);
          }

          // Enter narrative group sub-context if provided (for per-target event splitting)
          const hasNarrativeGroup = rel.narrativeGroupId && !hasActionContext;
          if (hasNarrativeGroup) {
            // Get narration from narrationsByGroup if available
            const narration = result.narrationsByGroup?.[rel.narrativeGroupId || ''];
            this.mutationTracker.enterContext('system', `${system.id}:${rel.narrativeGroupId}`, undefined, narration);
          }

          const before = this.graph.getRelationshipCount();
          addRelationship(this.graph, rel.kind, rel.src, rel.dst);
          const after = this.graph.getRelationshipCount();

          if (after > before) {
            relationshipsThisTick.push(rel);
            relationshipsAddedThisTick++;
            metric.relationshipsCreated++;
            addedFromResult++;
          }

          // Exit narrative group context if we entered one
          if (hasNarrativeGroup) {
            this.mutationTracker.exitContext();
          }

          // Exit action context if we entered one
          if (hasActionContext) {
            this.mutationTracker.exitContext();
          }
        }
        totalRelationships += addedFromResult;

        if (result.relationshipsAdjusted && result.relationshipsAdjusted.length > 0) {
          for (const rel of result.relationshipsAdjusted) {
            // Enter action-specific context if provided (for narrative attribution)
            const hasActionContext = rel.actionContext && rel.actionContext.source === 'action';
            if (hasActionContext) {
              // Get narration from narrationsByGroup if available
              const narration = result.narrationsByGroup?.[rel.narrativeGroupId || ''];
              this.mutationTracker.enterContext(rel.actionContext!.source, rel.actionContext!.sourceId, rel.actionContext!.success, narration);
            }

            // Enter narrative group sub-context if provided (for per-target event splitting)
            const hasNarrativeGroup = rel.narrativeGroupId && !hasActionContext;
            if (hasNarrativeGroup) {
              // Get narration from narrationsByGroup if available
              const narration = result.narrationsByGroup?.[rel.narrativeGroupId || ''];
              this.mutationTracker.enterContext('system', `${system.id}:${rel.narrativeGroupId}`, undefined, narration);
            }

            modifyRelationshipStrength(this.graph, rel.src, rel.dst, rel.kind, rel.delta);

            // Exit narrative group context if we entered one
            if (hasNarrativeGroup) {
              this.mutationTracker.exitContext();
            }

            // Exit action context if we entered one
            if (hasActionContext) {
              this.mutationTracker.exitContext();
            }
          }
        }

        // Apply deferred archivals (with proper context for narrative attribution)
        if (result.relationshipsToArchive && result.relationshipsToArchive.length > 0) {
          for (const rel of result.relationshipsToArchive) {
            // Enter action-specific context if provided (for narrative attribution)
            const hasActionContext = rel.actionContext && rel.actionContext.source === 'action';
            if (hasActionContext) {
              // Get narration from narrationsByGroup if available
              const narration = result.narrationsByGroup?.[rel.narrativeGroupId || ''];
              this.mutationTracker.enterContext(rel.actionContext!.source, rel.actionContext!.sourceId, rel.actionContext!.success, narration);
            }

            // Enter narrative group sub-context if provided (for per-target event splitting)
            const hasNarrativeGroup = rel.narrativeGroupId && !hasActionContext;
            if (hasNarrativeGroup) {
              // Get narration from narrationsByGroup if available
              const narration = result.narrationsByGroup?.[rel.narrativeGroupId || ''];
              this.mutationTracker.enterContext('system', `${system.id}:${rel.narrativeGroupId}`, undefined, narration);
            }

            archiveRelationship(this.graph, rel.src, rel.dst, rel.kind);

            // Exit narrative group context if we entered one
            if (hasNarrativeGroup) {
              this.mutationTracker.exitContext();
            }

            // Exit action context if we entered one
            if (hasActionContext) {
              this.mutationTracker.exitContext();
            }
          }
        }

        // Update system metrics and check for aggressive systems
        if (metric.relationshipsCreated > 500 && this.graph.tick - metric.lastThrottleCheck > 20) {
          this.logWarning(`⚠️  AGGRESSIVE SYSTEM: ${system.id} has created ${metric.relationshipsCreated} relationships`);
          this.logWarning(`   Consider adding throttling or reducing probabilities`);
          metric.lastThrottleCheck = this.graph.tick;
        }
        this.systemMetrics.set(system.id, metric);

        // Apply modifications
        // Group by action context for proper narrative attribution
        for (const mod of result.entitiesModified) {
          const changes = { ...mod.changes };

          // Enter action-specific context if provided (for narrative attribution)
          const hasActionContext = mod.actionContext && mod.actionContext.source === 'action';
          if (hasActionContext) {
            // Get narration from narrationsByGroup if available
            const narration = result.narrationsByGroup?.[mod.narrativeGroupId || ''];
            this.mutationTracker.enterContext(mod.actionContext!.source, mod.actionContext!.sourceId, mod.actionContext!.success, narration);
          }

          // Enter narrative group sub-context if provided (for per-target event splitting)
          // This creates events like "system:power_vacuum_detector:knot-of-nightfall-shelf"
          const hasNarrativeGroup = mod.narrativeGroupId && !hasActionContext;
          // Fall back to basic system context if no specific context provided
          // This prevents modifications from ending up as unattributed "framework" events
          const needsFallbackContext = !hasActionContext && !hasNarrativeGroup;
          if (hasNarrativeGroup) {
            // Get narration from narrationsByGroup if available
            const narration = result.narrationsByGroup?.[mod.narrativeGroupId || ''];
            this.mutationTracker.enterContext('system', `${system.id}:${mod.narrativeGroupId}`, undefined, narration);
          } else if (needsFallbackContext) {
            // No specific context - enter per-entity system context for proper attribution
            // Using mod.id ensures each entity gets its own narrative event
            this.mutationTracker.enterContext('system', `${system.id}:${mod.id}`, undefined, undefined);
          }

          // Track state changes for narrative events
          const entity = this.graph.getEntity(mod.id);
          if (changes.tags && entity) {
            changes.tags = applyTagPatch(entity.tags, changes.tags);
          }

          // Debug logging for prominence modifications
          if (GraphStore.DEBUG_PROMINENCE && 'prominence' in changes && entity) {
            console.log(`[PROMINENCE-FLOW] tick=${this.graph.tick} system=${system.id} entity=${entity.name} (${mod.id})`);
            console.log(`  entity.prominence=${entity.prominence} changes.prominence=${changes.prominence}`);
          }

          if (entity) {
            // Use action context for catalyst if available, fall back to system
            const catalyst = mod.actionContext
              ? {
                  entityId: mod.actionContext.sourceId,
                  actionType: mod.actionContext.sourceId,
                  success: mod.actionContext.success,
                }
              : { entityId: system.id, actionType: system.name };

            this.stateChangeTracker.recordEntityChange(entity, changes, catalyst);

            // Track tag changes for narrative events
            if (changes.tags) {
              const oldTags = entity.tags || {};
              const newTags = changes.tags;

              // Find added tags
              for (const [tag, value] of Object.entries(newTags)) {
                if (!(tag in oldTags) && value !== undefined) {
                  this.stateChangeTracker.recordTagChange(
                    mod.id,
                    tag,
                    'added',
                    value as string | boolean,
                    catalyst
                  );
                }
              }

              // Find removed tags
              for (const tag of Object.keys(oldTags)) {
                if (!(tag in newTags) || newTags[tag] === undefined) {
                  this.stateChangeTracker.recordTagChange(
                    mod.id,
                    tag,
                    'removed',
                    undefined,
                    catalyst
                  );
                }
              }
            }
          }

          updateEntity(this.graph, mod.id, changes);
          modifiedEntityIds.push(mod.id);

          // Exit context if we entered one (in reverse order of entry)
          if (hasNarrativeGroup || needsFallbackContext) {
            this.mutationTracker.exitContext();
          }

          // Exit action context if we entered one
          if (hasActionContext) {
            this.mutationTracker.exitContext();
          }
        }

        // Apply pressure changes and track for emitting
        for (const [pressure, delta] of Object.entries(result.pressureChanges)) {
          const current = this.graph.pressures.get(pressure) || 0;
          this.graph.pressures.set(pressure, Math.max(-100, Math.min(100, current + delta)));
          this.trackPressureModification(pressure, delta, { type: 'system', systemId: system.id });
        }

        const eraTransition = result.details?.eraTransition as {
          fromEra: string;
          fromEraId: string;
          toEra: string;
          toEraId: string;
        } | undefined;

        if (eraTransition) {
          this.recordEpochEraTransition(eraTransition);
        }

        // Check for era transition and generate narrative event
        if (eraTransition && this.stateChangeTracker.isEnabled()) {
          const oldEra = this.graph.getEntity(
            this.graph.getEntities({ includeHistorical: true })
              .find(e => e.kind === 'era' && e.name === eraTransition.fromEra)?.id || ''
          );
          const newEra = this.graph.getEntity(
            this.graph.getEntities({ includeHistorical: true })
              .find(e => e.kind === 'era' && e.name === eraTransition.toEra)?.id || ''
          );
          if (oldEra && newEra) {
            // Find most prominent entities from the ending era to mention
            const prominentFromEra = this.graph.getEntities({ includeHistorical: false })
              .filter(e => e.kind !== 'era' && e.prominence >= 3.0) // renowned or higher
              .sort((a, b) => b.prominence - a.prominence)
              .slice(0, 2);

            // Build atmospheric description
            let description = `As ${oldEra.name} fades and ${newEra.name} takes hold, the Ice remembers`;
            if (prominentFromEra.length > 0) {
              const names = prominentFromEra.map(e => e.name);
              if (names.length === 1) {
                description += ` the deeds of ${names[0]}.`;
              } else {
                description += ` the deeds of ${names[0]} and ${names[1]}.`;
              }
            } else {
              description += ` all who endured.`;
            }

            // Build era transition event inline (no legacy builder needed)
            const eraEvent: NarrativeEvent = {
              id: `era-${this.graph.tick}-${Math.random().toString(36).substr(2, 9)}`,
              tick: this.graph.tick,
              era: newEra.id,
              eventKind: 'era_transition',
              significance: 0.95,
              subject: { id: oldEra.id, name: oldEra.name, kind: oldEra.kind, subtype: oldEra.subtype },
              action: 'ended',
              participantEffects: [
                {
                  entity: { id: oldEra.id, name: oldEra.name, kind: oldEra.kind, subtype: oldEra.subtype },
                  effects: [{ type: 'ended', description: 'era concluded' }],
                },
                {
                  entity: { id: newEra.id, name: newEra.name, kind: newEra.kind, subtype: newEra.subtype },
                  effects: [{ type: 'created', description: 'era began' }],
                },
              ],
              description,
              narrativeTags: ['era', 'transition', 'historical', 'temporal'],
            };
            this.graph.narrativeHistory.push(eraEvent);
          }
        }

        // Emit systemAction event if meaningful work was done
        // Use significantModificationCount from details if present (for systems like
        // diffusion that want to squelch false positives from value tag updates)
        const reportedModifications = typeof result.details?.significantModificationCount === 'number'
          ? result.details.significantModificationCount
          : result.entitiesModified.length;

        const didMeaningfulWork =
          directAdded > 0 ||
          addedFromResult > 0 ||
          (result.relationshipsAdjusted && result.relationshipsAdjusted.length > 0) ||
          reportedModifications > 0 ||
          Object.keys(result.pressureChanges).length > 0;

        if (didMeaningfulWork) {
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

        totalModifications += result.entitiesModified.length;

        // Record narrations from system result for narrative event generation
        // Prefer narrationsByGroup for proper per-entity attribution
        if (result.narrationsByGroup && Object.keys(result.narrationsByGroup).length > 0) {
          // universalCatalyst returns action narrations keyed by "action_id:agent_id"
          // These need to be recorded under 'action' source to match the mutation context
          const isActionSystem = system.id === 'universal_catalyst';
          if (isActionSystem) {
            // For universalCatalyst, keys are "action_id:agent_id" and need 'action' source
            for (const [groupId, narration] of Object.entries(result.narrationsByGroup)) {
              this.stateChangeTracker.recordNarration('action', groupId, narration);
            }
          } else {
            this.stateChangeTracker.recordNarrationsByGroup('system', system.id, result.narrationsByGroup);
          }
        } else if (result.narrations && result.narrations.length > 0) {
          // Fallback for systems still using the flat narrations array
          this.stateChangeTracker.recordSystemNarrations(system.id, result.narrations);
        }

        // Exit context AFTER all mutations are applied (see LINEAGE.md)
        // This ensures all relationships added and entities modified get proper lineage
        this.mutationTracker.exitContext();

      } catch (error) {
        // Ensure we exit context even on error (lineage system - see LINEAGE.md)
        this.mutationTracker.exitContext();
        this.emitter.log('error', `System ${system.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Enrichment moved to @illuminator
    // if (relationshipsThisTick.length > 0) {
    //   this.queueRelationshipEnrichment(relationshipsThisTick);
    // }

    // Flush narrative events and add to narrative history
    const narrativeEvents = this.stateChangeTracker.flush();
    if (narrativeEvents.length > 0) {
      this.graph.narrativeHistory.push(...narrativeEvents);
    }

    // Clear mutation tracker for next tick (lineage system - see LINEAGE.md)
    this.mutationTracker.clear();

    // Monitor relationship growth rate
    this.monitorRelationshipGrowth();
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
  public getGraph(): Graph {
    return this.graph;
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

  public exportState(): any {
    const entities = this.graph.getEntities({ includeHistorical: true });
    const relationships = this.graph.getRelationships({ includeHistorical: true });

    // Extract meta-entities for visibility
    const metaEntities = entities.filter(e => hasTag(e.tags, FRAMEWORK_TAGS.META_ENTITY));

    const coordinateState = this.coordinateContext.export();

    const exportData: any = {
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
        reachability: this.getReachabilityMetrics(),
        enrichmentTriggers: {}
      },
      hardState: entities,
      relationships,
      pressures: Object.fromEntries(this.graph.pressures),
      narrativeHistory: this.graph.narrativeHistory.length > 0 ? this.graph.narrativeHistory : undefined
      // loreRecords moved to @illuminator
    };

    // Export coordinate context state (emergent regions, etc.)
    exportData.coordinateState = coordinateState;

    return exportData;
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
