/**
 * System Interpreter
 *
 * Converts declarative system configurations (JSON) into SimulationSystem objects.
 * This enables systems to be defined as pure data in the canonry project files.
 *
 * Supported system types:
 * - connectionEvolution: Handles relationship strength changes over time
 * - graphContagion: Spreads states/relationships through network connections
 * - thresholdTrigger: Detects conditions and sets tags/pressures for templates
 * - clusterFormation: Clusters similar entities into meta-entities
 * - tagDiffusion: Propagates/diverges tags based on entity connectivity
 * - planeDiffusion: Computes diffusion fields on semantic planes
 */

import { SimulationSystem } from './types';
import type { ProminenceLabel } from '../core/worldTypes';
import { createConnectionEvolutionSystem, ConnectionEvolutionConfig } from '../systems/connectionEvolution';
import { createGraphContagionSystem, GraphContagionConfig } from '../systems/graphContagion';
import { createThresholdTriggerSystem, ThresholdTriggerConfig } from '../systems/thresholdTrigger';
import { createClusterFormationSystem, ClusterFormationConfig } from '../systems/clusterFormation';
import { createTagDiffusionSystem, TagDiffusionConfig } from '../systems/tagDiffusion';
import { createPlaneDiffusionSystem, PlaneDiffusionConfig } from '../systems/planeDiffusion';
// Framework systems (configurable via factory functions)
import { createEraSpawnerSystem } from '../systems/eraSpawner';
import { createEraTransitionSystem } from '../systems/eraTransition';
import { createUniversalCatalystSystem } from '../systems/universalCatalyst';
import { createRelationshipMaintenanceSystem } from '../systems/relationshipMaintenance';
import { createGrowthSystem, GrowthSystemConfig, GrowthSystemDependencies } from '../systems/growthSystem';

// =============================================================================
// DECLARATIVE SYSTEM TYPES
// =============================================================================

/**
 * Union type for all declarative system configurations.
 * Each system type has a 'systemType' discriminator.
 */
export type DeclarativeSystem =
  | DeclarativeConnectionEvolutionSystem
  | DeclarativeGraphContagionSystem
  | DeclarativeThresholdTriggerSystem
  | DeclarativeClusterFormationSystem
  | DeclarativeTagDiffusionSystem
  | DeclarativePlaneDiffusionSystem
  | DeclarativeEraSpawnerSystem
  | DeclarativeEraTransitionSystem
  | DeclarativeUniversalCatalystSystem
  | DeclarativeRelationshipMaintenanceSystem
  | DeclarativeGrowthSystem;

interface DeclarativeSystemBase {
  /** Whether this system is active (default: true) */
  enabled: boolean;
}

export interface DeclarativeConnectionEvolutionSystem extends DeclarativeSystemBase {
  systemType: 'connectionEvolution';
  config: ConnectionEvolutionConfig;
}

export interface DeclarativeGraphContagionSystem extends DeclarativeSystemBase {
  systemType: 'graphContagion';
  config: GraphContagionConfig;
}

export interface DeclarativeThresholdTriggerSystem extends DeclarativeSystemBase {
  systemType: 'thresholdTrigger';
  config: ThresholdTriggerConfig;
}

export interface DeclarativeClusterFormationSystem extends DeclarativeSystemBase {
  systemType: 'clusterFormation';
  config: ClusterFormationConfig;
}

export interface DeclarativeTagDiffusionSystem extends DeclarativeSystemBase {
  systemType: 'tagDiffusion';
  config: TagDiffusionConfig;
}

export interface DeclarativePlaneDiffusionSystem extends DeclarativeSystemBase {
  systemType: 'planeDiffusion';
  config: PlaneDiffusionConfig;
}

// =============================================================================
// FRAMEWORK SYSTEM TYPES (Configurable via JSON)
// =============================================================================

/**
 * Base framework system config - all framework systems have id, name, description.
 */
export interface FrameworkSystemConfig {
  /** Unique identifier for this system instance */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description: string;
}

/**
 * Era Spawner system config.
 * Creates era entities at simulation start with lineage relationships.
 */
export type EraSpawnerConfig = FrameworkSystemConfig;

/**
 * Era Transition system config.
 * Handles transitions between eras based on exit/entry conditions.
 *
 * Transition conditions and effects are defined PER-ERA in eras.json:
 * - exitConditions: Criteria for an era to END (all must be met)
 * - entryConditions: Criteria for an era to START (all must be met)
 * - exitEffects: Mutations applied when leaving an era
 * - entryEffects: Mutations applied when entering an era
 *
 * See Era type in engine/types.ts for details.
 */
export interface EraTransitionConfig extends FrameworkSystemConfig {
  prominenceSnapshot: {
    enabled: boolean;
    minProminence: ProminenceLabel;
  };
}

/**
 * Universal Catalyst system config.
 * Enables agents to perform domain-defined actions.
 * Success chance is based on entity prominence (no separate influence tracking).
 */
export interface UniversalCatalystConfig extends FrameworkSystemConfig {
  /** Base chance per tick that agents attempt actions. Default: 0.3 */
  actionAttemptRate: number;
  /** How much pressures amplify action attempt rates. Default: 1.5 */
  pressureMultiplier: number;
  /** Chance of prominence increase on successful action (0-1). Default: 0.1 */
  prominenceUpChanceOnSuccess: number;
  /** Chance of prominence decrease on failed action (0-1). Default: 0.05 */
  prominenceDownChanceOnFailure: number;
}

/**
 * Relationship Maintenance system config.
 * Handles decay, reinforcement, and culling of relationships.
 */
export interface RelationshipMaintenanceConfig extends FrameworkSystemConfig {
  /** Run maintenance every N ticks. Default: 5 */
  maintenanceFrequency: number;
  /** Remove cullable relationships below this strength. Default: 0.15 */
  cullThreshold: number;
  /** Don't decay or cull relationships younger than this many ticks. Default: 20 */
  gracePeriod: number;
  /** Strength increase when reinforcement conditions are met. Default: 0.02 */
  reinforcementBonus: number;
  /** Maximum relationship strength. Default: 1.0 */
  maxStrength: number;
  /**
   * Relationship kinds that indicate entities are in "proximity" for reinforcement.
   * Two entities are in proximity if they both have the same destination via any of these relationships.
   * Example: ['resident_of', 'member_of'] means entities sharing a location or faction are in proximity.
   * If not specified, proximity reinforcement is disabled.
   */
  proximityRelationshipKinds: string[];
}

export interface DeclarativeEraSpawnerSystem extends DeclarativeSystemBase {
  systemType: 'eraSpawner';
  config: EraSpawnerConfig;
}

export interface DeclarativeEraTransitionSystem extends DeclarativeSystemBase {
  systemType: 'eraTransition';
  config: EraTransitionConfig;
}

export interface DeclarativeUniversalCatalystSystem extends DeclarativeSystemBase {
  systemType: 'universalCatalyst';
  config: UniversalCatalystConfig;
}

export interface DeclarativeRelationshipMaintenanceSystem extends DeclarativeSystemBase {
  systemType: 'relationshipMaintenance';
  config: RelationshipMaintenanceConfig;
}

export interface DeclarativeGrowthSystem extends DeclarativeSystemBase {
  systemType: 'growth';
  config: GrowthSystemConfig;
}

// =============================================================================
// SYSTEM CREATION
// =============================================================================

/**
 * Create a SimulationSystem from a declarative configuration.
 *
 * @param declarative - The declarative system configuration
 * @returns A SimulationSystem that can be used by WorldEngine
 */
type SystemFactory = (
  config: DeclarativeSystem['config'],
  options: { growthDependencies: GrowthSystemDependencies }
) => SimulationSystem;

const SYSTEM_FACTORY: Record<DeclarativeSystem['systemType'], SystemFactory> = {
  connectionEvolution: (config) => createConnectionEvolutionSystem(config as ConnectionEvolutionConfig),
  graphContagion: (config) => createGraphContagionSystem(config as GraphContagionConfig),
  thresholdTrigger: (config) => createThresholdTriggerSystem(config as ThresholdTriggerConfig),
  clusterFormation: (config) => createClusterFormationSystem(config as ClusterFormationConfig),
  tagDiffusion: (config) => createTagDiffusionSystem(config as TagDiffusionConfig),
  planeDiffusion: (config) => createPlaneDiffusionSystem(config as PlaneDiffusionConfig),
  eraSpawner: (config) => createEraSpawnerSystem(config as EraSpawnerConfig),
  eraTransition: (config) => createEraTransitionSystem(config as EraTransitionConfig),
  universalCatalyst: (config) => createUniversalCatalystSystem(config as UniversalCatalystConfig),
  relationshipMaintenance: (config) => createRelationshipMaintenanceSystem(config as RelationshipMaintenanceConfig),
  growth: (config, options) => createGrowthSystem(config as GrowthSystemConfig, options.growthDependencies),
};

export function createSystemFromDeclarative(
  declarative: DeclarativeSystem,
  options: { growthDependencies: GrowthSystemDependencies }
): SimulationSystem {
  return SYSTEM_FACTORY[declarative.systemType](declarative.config, options);
}

/**
 * Load multiple systems from declarative configurations.
 * Filters out any invalid configs and logs warnings.
 *
 * @param declaratives - Array of declarative system configurations
 * @returns Array of SimulationSystem objects
 */
export function loadSystems(
  declaratives: DeclarativeSystem[],
  options: { growthDependencies: GrowthSystemDependencies }
): SimulationSystem[] {
  if (!Array.isArray(declaratives)) {
    console.warn('loadSystems: expected array, got', typeof declaratives);
    return [];
  }

  return declaratives
    .filter(d => !('enabled' in d && d.enabled === false))
    .map(d => {
      try {
        return createSystemFromDeclarative(d, options);
      } catch (error) {
        console.error(`Failed to create system from config:`, d, error);
        throw error;
      }
    });
}

/**
 * Check if a value is a valid declarative system configuration.
 */
const DECLARATIVE_SYSTEM_TYPES = new Set([
  'connectionEvolution', 'graphContagion', 'thresholdTrigger',
  'clusterFormation', 'tagDiffusion', 'planeDiffusion',
  'eraSpawner', 'eraTransition', 'universalCatalyst',
  'relationshipMaintenance', 'growth',
]);

export function isDeclarativeSystem(value: unknown): value is DeclarativeSystem {
  if (!value || typeof value !== 'object') return false;
  const sys = value as Record<string, unknown>;
  return DECLARATIVE_SYSTEM_TYPES.has(sys.systemType as string) && sys.config !== undefined;
}
