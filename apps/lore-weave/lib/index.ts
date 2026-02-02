/**
 * Lore Weave - Procedural World History Generation Framework
 *
 * PUBLIC API - These exports form the contract between framework and domain.
 * Internal framework services and utilities are not exported.
 */

// =============================================================================
// CORE ENGINE
// =============================================================================

export { WorldEngine } from './engine/worldEngine';

// =============================================================================
// CORE TYPES - Used by domain for type definitions
// =============================================================================

export type {
  HardState,
  Relationship,
  ProminenceLabel,
  EntityTags,
  CatalystProperties
} from './core/worldTypes';

export type {
  Graph,
  Era,
  Pressure,
  GrowthTemplate,
  SimulationSystem,
  EngineConfig,
  SystemResult,
  TemplateResult,
  EntityOperatorRegistry,
  NameGenerationService,
  TagMetadata,
  AncestorFilter
} from './engine/types';

export { ComponentPurpose, GraphStore } from './engine/types';

// LLM types moved to @illuminator - import from there if needed

export type {
  DistributionTargets
} from './statistics/types';

// =============================================================================
// SERVICES - For domain templates and systems
// =============================================================================

export { WorldRuntime } from './runtime/worldRuntime';
export { TargetSelector } from './selection/targetSelector';
export type { SelectionBias, SelectionResult } from './selection/targetSelector';

// LLM services moved to @illuminator - import from there if needed

// Cultural awareness analysis (debugging/reporting)
export { CulturalAwarenessAnalyzer } from './statistics/culturalAwarenessAnalyzer';
export type { CulturalAwarenessReport } from './statistics/culturalAwarenessAnalyzer';

// =============================================================================
// UTILITY FUNCTIONS - For domain templates and systems
// =============================================================================

// Core helpers (re-exported from utils index)
export {
  generateId,
  pickRandom,
  pickMultiple,
  findEntities,
  getRelated,
  hasRelationship,
  normalizeInitialState,
  slugifyName,
  generateEntityIdFromName,
  archiveRelationship,
  modifyRelationshipStrength,
  // Tag utilities
  mergeTags,
  hasTag,
  getTagValue,
  getTrueTagKeys,
  getStringTags,
  arrayToTags,
  // Additional entity/relationship utilities
  rollProbability,
  addEntity,
  addRelationship,
  canFormRelationship,
  recordRelationshipFormation,
  getConnectionWeight
} from './utils';

// Name generation service (wraps name-forge)
export { NameForgeService } from './naming/nameForgeService';
export type { Culture, CultureNamingConfig } from './naming/nameForgeService';

// Validation
export { validateWorld } from './engine/validators';
export type { ValidationResult, ValidationReport } from './engine/validators';

// Entity clustering (for meta-entity formation systems)
export {
  calculateSimilarity,
  detectClusters,
  filterClusterableEntities,
  findBestClusterMatch
} from './graph/clusteringUtils';

export type {
  Cluster,
  ClusterCriterion,
  ClusterCriterionType,
  ClusterConfig
} from './graph/clusteringUtils';

// Entity archival (for entity lifecycle management)
export {
  archiveEntity,
  archiveEntities,
  transferRelationships,
  createPartOfRelationships,
  getActiveRelationships,
  getHistoricalRelationships,
  isHistoricalEntity,
  getPartOfMembers,
  supersedeEntity
} from './graph/entityArchival';

export type {
  ArchiveEntityOptions,
  TransferRelationshipsOptions,
  SupersedeEntityOptions
} from './graph/entityArchival';

// Template building utilities
export { EntityClusterBuilder } from './graph/entityClusterBuilder';
export { buildRelationships } from './graph/relationshipBuilder';

// Catalyst helpers (for domain occurrence/catalyst systems)
export {
  initializeCatalyst,
  initializeCatalystSmart,
  getAgentsByCategory,
  canPerformAction,
  recordCatalyst,
  getCatalyzedEvents,
  calculateAttemptChance
} from './systems/catalystHelpers';

// =============================================================================
// FRAMEWORK SYSTEMS - Included via declarative shells in systems.json
// =============================================================================

// Framework systems are exposed via thin declarative shells (systemType: 'eraSpawner', etc.)
// This makes them visible in the Canonry UI and allows enable/disable toggling.
// The actual implementations are imperative TypeScript that access engine internals.
// Note: Use the factory functions (createEraSpawnerSystem, createEraTransitionSystem, etc.)
// accessed via the systemInterpreter, not deprecated singleton exports.
export { createConnectionEvolutionSystem } from './systems/connectionEvolution';
export type {
  ConnectionEvolutionConfig,
  MetricConfig,
  EvolutionRule,
  ActionType,
  ConditionOperator,
  ThresholdValue,
  SubtypeBonus
} from './systems/connectionEvolution';

export { createGraphContagionSystem } from './systems/graphContagion';
export type {
  GraphContagionConfig,
  MarkerType,
  ContagionMarker,
  TransmissionVector,
  TransmissionConfig,
  RecoveryConfig,
  ContagionAction,
  PhaseTransition,
  MultiSourceConfig
} from './systems/graphContagion';

export { createThresholdTriggerSystem } from './systems/thresholdTrigger';
export type {
  ThresholdTriggerConfig,
  TriggerCondition,
  TriggerAction
} from './systems/thresholdTrigger';

export { createClusterFormationSystem } from './systems/clusterFormation';
export type {
  ClusterFormationConfig,
  DeclarativeClusterCriterion,
  DeclarativeClusterConfig,
  MetaEntityConfig as ClusterMetaEntityConfig,
  PostProcessConfig
} from './systems/clusterFormation';

export { createTagDiffusionSystem } from './systems/tagDiffusion';
export type {
  TagDiffusionConfig,
  ConvergenceConfig,
  DivergenceConfig
} from './systems/tagDiffusion';

export { createPlaneDiffusionSystem } from './systems/planeDiffusion';
export type {
  PlaneDiffusionConfig,
  DiffusionSourceConfig,
  DiffusionSinkConfig,
  DiffusionParams,
  DiffusionOutputTag,
  FalloffType
} from './systems/planeDiffusion';
export { createGrowthSystem } from './systems/growthSystem';
export type { GrowthSystemConfig } from './systems/growthSystem';

// =============================================================================
// DECLARATIVE ACTIONS - Agent action definitions for universalCatalyst
// =============================================================================

export { loadActions, createExecutableAction } from './engine/actionInterpreter';
export type {
  DeclarativeAction,
  ActionActorConfig,
  InstigatorSelectionRule,
  ActionOutcomeConfig,
  ActionProbabilityConfig,
  PressureModifier,
  ExecutableAction,
  ActionResult
} from './engine/actionInterpreter';

// Actor matching (for filtering eligible actors for actions)
export { matchesActorConfig } from './rules';

// =============================================================================
// FRAMEWORK PRIMITIVES - Minimal constants needed by domain
// =============================================================================

export {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_RELATIONSHIP_KINDS,
  FRAMEWORK_STATUS
} from '@canonry/world-schema';

export type {
  FrameworkEntityKind,
  FrameworkRelationshipKind,
  FrameworkStatus
} from '@canonry/world-schema';

// =============================================================================
// REGION-BASED COORDINATE SYSTEM
// =============================================================================

export type {
  Point,
  Region,
  RegionShape,
  RegionBounds,
  CircleBounds,
  RectBounds,
  PolygonBounds,
  RegionLookupResult,
  EmergentRegionResult,
  SparseAreaResult,
  SparseAreaOptions
} from './coordinates/types';

export { SPACE_BOUNDS } from './coordinates/types';

// =============================================================================
// COORDINATE CONTEXT (Culture-First Placement)
// =============================================================================

export {
  CoordinateContext,
  createCoordinateContext
} from './coordinates/coordinateContext';

export type {
  CoordinateContextConfig,
  EntityKindConfig,
  CultureConfig,
  KindAxisBiases,
  PlacementContext,
  PlacementResult
} from './coordinates/coordinateContext';

// SemanticPlane is from world-schema, re-exported here for convenience
export type { SemanticPlane } from '@canonry/world-schema';

// =============================================================================
// COORDINATE STATISTICS (Diagnostics)
// =============================================================================

export { coordinateStats } from './coordinates/coordinateStatistics';
export type {
  PlacementEvent,
  CultureClusterStats,
  CoordinateStatsSummary
} from './coordinates/coordinateStatistics';

// =============================================================================
// DECLARATIVE TEMPLATE SYSTEM
// =============================================================================

export { TemplateInterpreter, createTemplateFromDeclarative } from './engine/templateInterpreter';

export type {
  DeclarativeTemplate,
  ApplicabilityRule,
  SelectionRule,
  SelectionFilter,
  CreationRule,
  RelationshipRule,
  StateUpdateRule,
  VariableDefinition,
  ExecutionContext,
  GraphPathAssertion,
  PathStep,
  PathConstraint,
  GraphPathSelectionFilter,
  SubtypeSpec,
  SubtypeCondition,
  CultureSpec,
  PlacementSpec,
  PlacementStep,
  RelationshipCondition
} from './engine/declarativeTypes';

// =============================================================================
// DECLARATIVE PRESSURE SYSTEM
// =============================================================================

export {
  createPressureFromDeclarative,
  loadPressures,
  loadPressure
} from './engine/pressureInterpreter';

export type {
  DeclarativePressure,
  PressuresFile,
  FeedbackFactor,
  SimpleCountFactor
} from './engine/declarativePressureTypes';

// =============================================================================
// DECLARATIVE SYSTEM INTERPRETER
// =============================================================================

export {
  createSystemFromDeclarative,
  loadSystems,
  isDeclarativeSystem
} from './engine/systemInterpreter';

export type {
  DeclarativeSystem,
  DeclarativeConnectionEvolutionSystem,
  DeclarativeGraphContagionSystem,
  DeclarativeThresholdTriggerSystem,
  DeclarativeClusterFormationSystem,
  DeclarativeTagDiffusionSystem,
  DeclarativePlaneDiffusionSystem,
  // Framework system declarative shells
  FrameworkSystemConfig,
  DeclarativeGrowthSystem,
  DeclarativeEraSpawnerSystem,
  DeclarativeEraTransitionSystem,
  DeclarativeUniversalCatalystSystem,
  // Era system config types
  EraTransitionConfig,
  EraSpawnerConfig
} from './engine/systemInterpreter';

// Era transition condition types (defined per-era in eras.json)
export type {
  TransitionCondition,
  EraTransitionEffects
} from './engine/types';

// =============================================================================
// OBSERVER PATTERN - Real-time simulation events
// =============================================================================

export { SimulationEmitter } from './observer/SimulationEmitter';
export type {
  ISimulationEmitter,
  SimulationEvent,
  ProgressPayload,
  LogPayload,
  ValidationPayload,
  EpochStartPayload,
  EpochStatsPayload,
  GrowthPhasePayload,
  PopulationPayload,
  PopulationMetricPayload,
  TemplateUsagePayload,
  CoordinateStatsPayload,
  TagHealthPayload,
  SystemHealthPayload,
  EntityBreakdownPayload,
  CatalystStatsPayload,
  RelationshipBreakdownPayload,
  NotableEntitiesPayload,
  SimulationResultPayload,
  ErrorPayload,
  WorkerInboundMessage,
  WorkerOutboundMessage
} from './observer/types';
