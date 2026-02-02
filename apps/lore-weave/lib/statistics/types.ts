/**
 * Statistics Types
 *
 * Types for statistics collection, distribution tracking, and fitness evaluation.
 */

import { ProminenceLabel } from '../core/worldTypes';
import type { EpochEraSummary } from '../engine/types';

// ============================================================================
// EPOCH AND DISTRIBUTION STATS
// ============================================================================

export interface EpochStats {
  epoch: number;
  tick: number;
  era: EpochEraSummary;

  // Entity metrics
  totalEntities: number;
  entitiesByKind: Record<string, number>;
  entitiesBySubtype: Record<string, number>;
  entitiesCreated: number;

  // Relationship metrics
  totalRelationships: number;
  relationshipsByType: Record<string, number>;
  relationshipsCreated: number;

  // Pressure values
  pressures: Record<string, number>;

  // Growth metrics
  growthTarget: number;
  growthActual: number;
  relationshipGrowthRate: number;
}

export interface DistributionStats {
  // Entity distribution
  entityKindRatios: Record<string, number>;
  entityKindDeviation: number;

  // ProminenceLabel distribution
  prominenceRatios: Record<string, number>;
  prominenceDeviation: number;

  // Relationship distribution
  relationshipTypeRatios: Record<string, number>;
  relationshipDiversity: number;
  relationshipDeviation: number;

  // Graph connectivity
  graphMetrics: {
    clusters: number;
    avgClusterSize: number;
    isolatedNodes: number;
    isolatedNodeRatio: number;
    avgDegree: number;
  };
  connectivityDeviation: number;

  // Overall deviation score
  overallDeviation: number;
}

export interface EnrichmentStats {
  locationEnrichments: number;
  factionEnrichments: number;
  ruleEnrichments: number;
  abilityEnrichments: number;
  npcEnrichments: number;
  totalEnrichments: number;
}

export interface ValidationStats {
  totalChecks: number;
  passed: number;
  failed: number;

  results: Array<{
    name: string;
    passed: boolean;
    failureCount: number;
    details?: string;
  }>;
}

export interface SystemPerformanceStats {
  // Template execution
  templatesApplied: Record<string, number>;
  totalTemplateApplications: number;

  // System execution
  systemsExecuted: Record<string, number>;
  totalSystemExecutions: number;

  // Warnings and throttling
  warnings: number;
  relationshipBudgetHits: number;
  aggressiveSystemWarnings: Record<string, number>;

  // Growth metrics
  averageRelationshipGrowthRate: number;
  maxRelationshipGrowthRate: number;
  relationshipGrowthHistory: number[];

  // Protected relationship violations (for genetic algorithm tuning)
  protectedRelationshipViolations: {
    totalViolations: number;
    violationsByKind: Record<string, number>;
    violationRate: number;  // violations per tick
    avgStrength: number;     // average strength of violating relationships
  };
}

export interface TemporalStats {
  totalTicks: number;
  totalEpochs: number;
  ticksPerEpoch: number;

  // Era progression
  erasVisited: string[];

  // Generation efficiency
  entitiesPerTick: number;
  relationshipsPerTick: number;
  entitiesPerEpoch: number;
  relationshipsPerEpoch: number;
}

export interface FitnessMetrics {
  // Distribution fitness (0-1, higher is better)
  entityDistributionFitness: number;
  prominenceDistributionFitness: number;
  relationshipDiversityFitness: number;
  connectivityFitness: number;

  // Overall fitness (0-1, higher is better)
  overallFitness: number;

  // Constraint violations (0 = no violations)
  constraintViolations: number;

  // Efficiency metrics
  convergenceRate: number;  // How quickly did distributions converge
  stabilityScore: number;   // How stable were the metrics
}

export interface SimulationStatistics {
  // Metadata
  generatedAt: string;
  totalTicks: number;
  totalEpochs: number;
  generationTimeMs: number;

  // Final counts
  finalEntityCount: number;
  finalRelationshipCount: number;

  // Per-epoch tracking
  epochStats: EpochStats[];

  // Distribution analysis
  distributionStats: DistributionStats;

  // Enrichment analytics
  enrichmentStats: EnrichmentStats;

  // Validation results
  validationStats: ValidationStats;

  // System performance
  performanceStats: SystemPerformanceStats;

  // Temporal analysis
  temporalStats: TemporalStats;

  // Fitness evaluation
  fitnessMetrics: FitnessMetrics;

  // Configuration snapshot (for reproducibility)
  configSnapshot: {
    ticksPerEpoch: number;
    maxTicks: number;
    relationshipBudget?: {
      maxPerSimulationTick: number;
      maxPerGrowthPhase: number;
    };
  };
}

// ============================================================================
// DISTRIBUTION TARGETS
// ============================================================================

/**
 * Per-subtype targets for homeostatic template weighting
 */
export interface DistributionTargets {
  $schema?: string;
  version: string;
  entities: Record<string, Record<string, EntityTarget>>;
}

export interface EntityTarget {
  target: number;
  comment?: string;
}

/**
 * Current measured state of the world
 */
export interface DistributionState {
  tick: number;
  totalEntities: number;
  entityKindCounts: Record<string, number>;
  entityKindRatios: Record<string, number>;
  prominenceCounts: Record<ProminenceLabel, number>;
  prominenceRatios: Record<ProminenceLabel, number>;
  prominenceByKind: Record<string, Record<ProminenceLabel, number>>;
  relationshipTypeCounts: Record<string, number>;
  relationshipTypeRatios: Record<string, number>;
  relationshipCategoryCounts: Record<string, number>;
  relationshipCategoryRatios: Record<string, number>;
  graphMetrics: {
    clusters: number;
    avgClusterSize: number;
    intraClusterDensity: number;
    interClusterDensity: number;
    isolatedNodes: number;
    isolatedNodeRatio: number;
  };
}

/**
 * Deviation from targets
 */
export interface DeviationScore {
  overall: number;
  entityKind: {
    score: number;
    deviations: Record<string, number>;
  };
  prominence: {
    score: number;
    deviations: Record<ProminenceLabel, number>;
    byKind?: Record<string, Record<ProminenceLabel, number>>;
  };
  relationship: {
    score: number;
    maxTypeRatio: number;
    typesPresent: number;
    categoryBalance: number;
  };
  connectivity: {
    score: number;
    clusterCount: number;
    densityBalance: number;
    isolatedNodes: number;
  };
}

/**
 * Adjusted template weights based on distribution guidance
 */
export interface GuidedWeights {
  templateId: string;
  baseWeight: number;
  adjustedWeight: number;
  adjustmentReason: string[];
  finalProbability: number;
}
