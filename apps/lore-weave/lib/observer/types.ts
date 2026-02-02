/**
 * SimulationEmitter Event Types
 *
 * Defines all events emitted by WorldEngine during simulation.
 * These replace console.log calls and enable real-time UI updates via web worker.
 */

import { HardState, Relationship } from '../core/worldTypes';
import type { EpochEraSummary } from '../engine/types';
import type { WorldOutput } from '@canonry/world-schema';

// =============================================================================
// Event Payloads
// =============================================================================

export interface ProgressPayload {
  phase: 'initializing' | 'validating' | 'running' | 'finalizing' | 'paused';
  tick: number;
  maxTicks: number;
  epoch: number;
  totalEpochs: number;
  entityCount: number;
  relationshipCount: number;
}

export interface LogPayload {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface ValidationPayload {
  status: 'success' | 'failed';
  errors: string[];
  warnings: string[];
}

export interface EpochStartPayload {
  epoch: number;
  era: {
    id: string;
    name: string;
    summary: string;
  };
  tick: number;
}

export interface EpochStatsPayload {
  epoch: number;
  era: EpochEraSummary;
  entitiesByKind: Record<string, number>;
  relationshipCount: number;
  pressures: Record<string, number>;
  entitiesCreated: number;
  relationshipsCreated: number;
  growthTarget: number;
}

export interface PopulationMetricPayload {
  kind: string;
  subtype: string;
  count: number;
  target: number;
  deviation: number;
}

export interface PopulationPayload {
  totalEntities: number;
  totalRelationships: number;
  avgDeviation: number;
  maxDeviation: number;
  entityMetrics: PopulationMetricPayload[];
  pressureMetrics: Array<{
    id: string;
    value: number;
    target: number;
    deviation: number;
  }>;
  outliers: {
    overpopulated: PopulationMetricPayload[];
    underpopulated: PopulationMetricPayload[];
  };
}

export interface TemplateUsagePayload {
  totalApplications: number;
  uniqueTemplatesUsed: number;
  totalTemplates: number;
  maxRunsPerTemplate: number;
  usage: Array<{
    templateId: string;
    count: number;
    percentage: number;
    status: 'healthy' | 'warning' | 'saturated';
  }>;
  unusedTemplates: Array<{
    templateId: string;
    failedRules: string[];
    selectionCount: number;
    summary: string;
    selectionDiagnosis?: {
      strategy: string;
      targetKind: string;
      filterSteps: Array<{
        description: string;
        remaining: number;
      }>;
    };
    variableDiagnoses?: Array<{
      name: string;
      fromType: 'graph' | 'related' | 'path';
      kind?: string;
      relationshipKind?: string;
      relatedTo?: string;
      filterSteps: Array<{
        description: string;
        remaining: number;
      }>;
    }>;
  }>;
}

/** Detailed placement debug info for an entity */
export interface PlacementDebugInfo {
  /** The anchor type requested (e.g., 'entity', 'culture', 'sparse') */
  anchorType: string;
  /** For entity anchors: the resolved anchor entity */
  anchorEntity?: { id: string; name: string; kind: string };
  /** For culture anchors: the culture ID used */
  anchorCulture?: string;
  /** Which method actually succeeded: 'anchor', 'anchor_region', 'seed_region', 'sparse', 'bounds', 'random' */
  resolvedVia: string;
  /** Seed regions that were available for this culture/kind */
  seedRegionsAvailable?: string[];
  /** Regions that were tried before finding a spot */
  regionsTried?: string[];
  /** If an emergent region was created */
  emergentRegionCreated?: { id: string; label: string };
  /** If placement failed, why */
  failureReason?: string;
}

export interface TemplateApplicationPayload {
  tick: number;
  epoch: number;
  templateId: string;
  targetEntityId: string;
  targetEntityName: string;
  targetEntityKind: string;
  description: string;
  entitiesCreated: Array<{
    id: string;
    name: string;
    kind: string;
    subtype: string;
    culture: string;
    prominence: string;
    tags: Record<string, string | boolean>;
    placementStrategy: string;
    coordinates: { x: number; y: number; z: number };
    // Placement info
    regionId?: string | null;
    allRegionIds?: string[];
    /** Tags derived from placement (e.g., from region) before merging with entity tags */
    derivedTags?: Record<string, string | boolean>;
    /** Detailed placement debug info */
    placement?: PlacementDebugInfo;
  }>;
  relationshipsCreated: Array<{
    kind: string;
    srcId: string;
    dstId: string;
    strength?: number;
  }>;
  pressureChanges: Record<string, number>;
}

export interface CoordinateStatsPayload {
  totalPlacements: number;
  byKind: Record<string, number>;
  regionUsage: Record<string, number>;
  cultureDistribution: Record<string, number>;
}

/**
 * Action application payload - emitted only when an action succeeds
 * Tracks the selected action, participants, and outcome details.
 */
export interface ActionApplicationPayload {
  tick: number;
  epoch: number;

  // Action identification
  actionId: string;
  actionName: string;

  // Participants
  actorId: string;
  actorName: string;
  actorKind: string;
  actorProminence: string;
  instigatorId?: string;
  instigatorName?: string;

  // Target(s) - populated if action handler was called
  targetId?: string;
  targetName?: string;
  targetKind?: string;
  target2Id?: string;
  target2Name?: string;

  // Why this action was selected
  selectionContext: {
    availableActionCount: number;
    selectedWeight: number;
    totalWeight: number;
    pressureInfluences: Array<{
      pressureId: string;
      value: number;
      multiplier: number;
      contribution: number;
    }>;
    attemptChance: number;
    prominenceBonus: number;
  };

  // What happened
  outcome: {
    status: 'success' | 'failed_roll' | 'failed_no_target' | 'failed_no_instigator';
    successChance: number;
    prominenceMultiplier: number;
    description: string;
    /** Domain-controlled narration from narrationTemplate */
    narration?: string;
    relationshipsCreated: Array<{
      kind: string;
      srcId: string;
      dstId: string;
      srcName: string;
      dstName: string;
      strength?: number;
    }>;
    relationshipsStrengthened: Array<{
      kind: string;
      srcId: string;
      dstId: string;
      srcName: string;
      dstName: string;
      delta: number;
    }>;
    prominenceChanges: Array<{
      entityId: string;
      entityName: string;
      direction: 'up' | 'down';
    }>;
  };
}

export type SimulationResultPayload = WorldOutput;

export interface ErrorPayload {
  message: string;
  stack?: string;
  phase: string;
  context?: Record<string, unknown>;
}

export interface TagHealthPayload {
  coverage: {
    totalEntities: number;
    entitiesWithTags: number;
    coveragePercentage: number;
  };
  diversity: {
    uniqueTags: number;
    shannonIndex: number;
    evenness: number;
  };
  issues: {
    orphanTagCount: number;
    overusedTagCount: number;
    conflictCount: number;
  };
}

// =============================================================================
// Final Diagnostic Payloads (emitted at simulation end)
// =============================================================================

export interface EntityBreakdownPayload {
  totalEntities: number;
  byKind: Record<string, {
    total: number;
    bySubtype: Record<string, number>;
  }>;
}

export interface CatalystStatsPayload {
  totalAgents: number;
  activeAgents: number;
  totalActions: number;
  uniqueActors: number;
  topAgents: Array<{
    id: string;
    name: string;
    kind: string;
    actionCount: number;
  }>;
  /** Actions that have never succeeded during the simulation */
  unusedActions: Array<{
    actionId: string;
    actionName: string;
  }>;
}

export interface RelationshipBreakdownPayload {
  totalRelationships: number;
  byKind: Array<{
    kind: string;
    count: number;
    percentage: number;
  }>;
}

export interface NotableEntitiesPayload {
  mythic: Array<{
    id: string;
    name: string;
    kind: string;
    subtype: string;
  }>;
  renowned: Array<{
    id: string;
    name: string;
    kind: string;
    subtype: string;
  }>;
}

/**
 * Detailed pressure change breakdown emitted per tick
 * Allows UI to show exactly what's contributing to pressure changes
 */
export interface PressureUpdatePayload {
  tick: number;
  epoch: number;
  pressures: PressureChangeDetail[];
  /** Discrete modifications from templates, systems, era transitions, etc. */
  discreteModifications: DiscretePressureModification[];
}

/**
 * A discrete pressure modification from a specific source
 * (as opposed to feedback-based per-tick growth)
 */
export interface DiscretePressureModification {
  pressureId: string;
  delta: number;
  source: PressureModificationSource;
}

export type PressureModificationSource =
  | { type: 'template'; templateId: string }
  | { type: 'system'; systemId: string }
  | { type: 'era_entry'; eraId: string }
  | { type: 'era_exit'; eraId: string }
  | { type: 'action'; actionId: string; actorId: string };

export interface PressureChangeDetail {
  id: string;
  name: string;
  previousValue: number;
  newValue: number;
  delta: number;
  breakdown: {
    positiveFeedback: FeedbackContribution[];
    negativeFeedback: FeedbackContribution[];
    feedbackTotal: number;  // Sum of positive - negative (can be negative)
    growthScaling: number;  // Diminishing returns factor
    scaledFeedback: number;
    homeostasis: number;    // Homeostatic factor for this pressure
    homeostaticDelta: number; // Per-tick pull toward equilibrium (0)
    eraModifier: number;
    rawDelta: number;       // Before smoothing
    smoothedDelta: number;  // After smoothing (max ±2)
  };
}

export interface FeedbackContribution {
  label: string;           // Human-readable description
  type: string;            // Factor type (entity_count, ratio, etc.)
  rawValue: number;        // Raw count/ratio before coefficient
  coefficient: number;
  contribution: number;    // Final contribution after coefficient & cap
}

export interface GrowthPhasePayload {
  epoch: number;
  entitiesCreated: number;
  target: number;
  templatesApplied: string[];
}

export interface SystemHealthPayload {
  populationHealth: number;
  status: 'stable' | 'functional' | 'needs_attention';
}

/**
 * System action payload - emitted when a system does meaningful work
 * Only emitted when the system actually changes something (not every tick)
 */
export interface SystemActionPayload {
  tick: number;
  epoch: number;
  systemId: string;
  systemName: string;

  // Summary of what the system did
  relationshipsAdded: number;
  entitiesModified: number;
  pressureChanges: Record<string, number>;
  description: string;

  // Loosely typed details for system-specific information
  details?: Record<string, unknown>;
}

/**
 * State export payload - emitted on request for intermediate state export
 * Contains the same structure as SimulationResultPayload but for in-progress simulation
 */
export type StateExportPayload = WorldOutput;

// =============================================================================
// Event Union Type
// =============================================================================

export type SimulationEvent =
  | { type: 'progress'; payload: ProgressPayload }
  | { type: 'log'; payload: LogPayload }
  | { type: 'validation'; payload: ValidationPayload }
  | { type: 'epoch_start'; payload: EpochStartPayload }
  | { type: 'epoch_stats'; payload: EpochStatsPayload }
  | { type: 'growth_phase'; payload: GrowthPhasePayload }
  | { type: 'template_application'; payload: TemplateApplicationPayload }
  | { type: 'action_application'; payload: ActionApplicationPayload }
  | { type: 'pressure_update'; payload: PressureUpdatePayload }
  | { type: 'population_report'; payload: PopulationPayload }
  | { type: 'template_usage'; payload: TemplateUsagePayload }
  | { type: 'coordinate_stats'; payload: CoordinateStatsPayload }
  | { type: 'tag_health'; payload: TagHealthPayload }
  | { type: 'system_health'; payload: SystemHealthPayload }
  | { type: 'system_action'; payload: SystemActionPayload }
  | { type: 'entity_breakdown'; payload: EntityBreakdownPayload }
  | { type: 'catalyst_stats'; payload: CatalystStatsPayload }
  | { type: 'relationship_breakdown'; payload: RelationshipBreakdownPayload }
  | { type: 'notable_entities'; payload: NotableEntitiesPayload }
  | { type: 'complete'; payload: SimulationResultPayload }
  | { type: 'state_export'; payload: StateExportPayload }
  | { type: 'error'; payload: ErrorPayload };

// =============================================================================
// Emitter Interface
// =============================================================================

/**
 * SimulationEmitter interface.
 * WorldEngine requires this to emit events during simulation.
 * Implementations include:
 * - WorkerEmitter: Posts messages to main thread via postMessage
 * - ConsoleEmitter: For testing, logs to console (not for production use)
 */
export interface ISimulationEmitter {
  emit(event: SimulationEvent): void;

  // Convenience methods that construct events
  progress(payload: ProgressPayload): void;
  log(level: LogPayload['level'], message: string, context?: Record<string, unknown>): void;
  validation(payload: ValidationPayload): void;
  epochStart(payload: EpochStartPayload): void;
  epochStats(payload: EpochStatsPayload): void;
  growthPhase(payload: GrowthPhasePayload): void;
  templateApplication(payload: TemplateApplicationPayload): void;
  actionApplication(payload: ActionApplicationPayload): void;
  pressureUpdate(payload: PressureUpdatePayload): void;
  populationReport(payload: PopulationPayload): void;
  templateUsage(payload: TemplateUsagePayload): void;
  coordinateStats(payload: CoordinateStatsPayload): void;
  tagHealth(payload: TagHealthPayload): void;
  systemHealth(payload: SystemHealthPayload): void;
  systemAction(payload: SystemActionPayload): void;
  // Final diagnostics (emitted at simulation end)
  entityBreakdown(payload: EntityBreakdownPayload): void;
  catalystStats(payload: CatalystStatsPayload): void;
  relationshipBreakdown(payload: RelationshipBreakdownPayload): void;
  notableEntities(payload: NotableEntitiesPayload): void;
  complete(payload: SimulationResultPayload): void;
  stateExport(payload: StateExportPayload): void;
  error(payload: ErrorPayload): void;
}

// =============================================================================
// Worker Message Types (for postMessage communication)
// =============================================================================

/**
 * Messages sent from main thread to worker
 */
export type WorkerInboundMessage =
  | { type: 'start'; config: unknown; initialState: HardState[] }
  | { type: 'startStepping'; config: unknown; initialState: HardState[] }
  | { type: 'step' }
  | { type: 'runToCompletion' }
  | { type: 'reset' }
  | { type: 'abort' }
  | { type: 'exportState' };

/**
 * Messages sent from worker to main thread
 */
export type WorkerOutboundMessage = SimulationEvent;
