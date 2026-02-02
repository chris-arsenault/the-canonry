/**
 * Canonry MFE contracts
 *
 * Stable, slice-based props passed between the Canonry shell and MFEs.
 * These types avoid shape conversions across boundaries.
 */

import type { CultureDefinition } from './culture.js';
import type { CultureNamingData } from './naming.js';
import type { EntityKindDefinition } from './entityKind.js';
import type { RelationshipKindDefinition } from './relationship.js';
import type { SeedEntity, SeedRelationship } from './seed.js';
import type { WorldOutput } from './world.js';
import type { DomainUIConfig } from './ui.js';

// =============================================================================
// Shared Canonry slices
// =============================================================================

export interface TagDefinition {
  tag: string;
  category?: string;
  rarity?: string;
  description?: string;
  /** True if this tag is defined by the framework and is read-only in editors */
  isFramework?: boolean;
  usageCount?: number;
  templates?: string[];
  entityKinds?: string[];
  minUsage?: number;
  maxUsage?: number;
  relatedTags?: string[];
  conflictingTags?: string[];
}

export interface AxisDefinition {
  id: string;
  name: string;
  description?: string;
  lowTag: string;
  highTag: string;
}

export interface CanonrySchemaSlice {
  id?: string;
  name?: string;
  version?: string;
  entityKinds: EntityKindDefinition[];
  relationshipKinds: RelationshipKindDefinition[];
  cultures: CultureDefinition[];
  tagRegistry?: TagDefinition[];
  axisDefinitions?: AxisDefinition[];
  uiConfig?: DomainUIConfig;
}

export interface CanonryProject extends CanonrySchemaSlice {
  seedEntities?: SeedEntity[];
  seedRelationships?: SeedRelationship[];
  eras?: CanonryEraConfig[];
  pressures?: CanonryPressureConfig[];
  generators?: CanonryGeneratorConfig[];
  systems?: CanonrySystemConfig[];
  actions?: CanonryActionConfig[];
  distributionTargets?: CanonryDistributionTargets | null;
}

// =============================================================================
// Canonry config primitives
// =============================================================================

export interface CanonryConfigItem {
  id: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Era config uses 'summary' instead of 'description' - user-entered, not LLM-generated */
export interface CanonryEraConfig {
  id: string;
  name?: string;
  summary?: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type CanonryPressureConfig = CanonryConfigItem;
export type CanonryGeneratorConfig = CanonryConfigItem;
export type CanonrySystemConfig = CanonryConfigItem;
export type CanonryActionConfig = CanonryConfigItem;

export type CanonryDistributionTargets = Record<string, unknown>;

// =============================================================================
// Simulation payloads (shell <-> Lore Weave <-> Archivist)
// =============================================================================

export type CanonrySimulationResults = WorldOutput;

export interface CanonrySimulationState {
  status?: string;
  logs?: unknown[];
  result?: CanonrySimulationResults | null;
  stateExport?: CanonrySimulationResults | null;
  error?: { message?: string; phase?: string } | null;
  [key: string]: unknown;
}

export interface LoreWeaveRunScorePayload {
  attempt?: number;
  runScore: number;
  runScoreMax?: number;
  runScoreDetails?: {
    templates?: { used: number; total: number; weight: number };
    actions?: { used: number; total: number; weight: number };
    systems?: { used: number; total: number; weight: number };
  };
  simulationResults?: CanonrySimulationResults | null;
  simulationState?: CanonrySimulationState | null;
}

// =============================================================================
// MFE contracts (props)
// =============================================================================

export interface MfeNavProps {
  projectId?: string;
  activeSection?: string | null;
  onSectionChange?: (section: string) => void;
}

export interface NameForgeRemoteProps extends MfeNavProps {
  schema: CanonrySchemaSlice;
  generators?: CanonryGeneratorConfig[];
  onNamingDataChange?: (cultureId: string, naming: CultureNamingData) => void;
  onAddTag?: (tag: TagDefinition) => void;
}

export interface CosmographerRemoteProps extends MfeNavProps {
  schema: CanonrySchemaSlice;
  axisDefinitions?: AxisDefinition[];
  seedEntities?: SeedEntity[];
  seedRelationships?: SeedRelationship[];
  onEntityKindsChange?: (entityKinds: EntityKindDefinition[]) => void;
  onCulturesChange?: (cultures: CultureDefinition[]) => void;
  onAxisDefinitionsChange?: (axisDefinitions: AxisDefinition[]) => void;
  onTagRegistryChange?: (tagRegistry: TagDefinition[]) => void;
  onSeedEntitiesChange?: (seedEntities: SeedEntity[]) => void;
  onSeedRelationshipsChange?: (seedRelationships: SeedRelationship[]) => void;
  onAddTag?: (tag: TagDefinition) => void;
  schemaUsage?: Record<string, unknown>;
}

export interface CoherenceEngineRemoteProps extends MfeNavProps {
  schema: CanonrySchemaSlice;
  eras?: CanonryEraConfig[];
  pressures?: CanonryPressureConfig[];
  generators?: CanonryGeneratorConfig[];
  actions?: CanonryActionConfig[];
  systems?: CanonrySystemConfig[];
  onErasChange?: (eras: CanonryEraConfig[]) => void;
  onPressuresChange?: (pressures: CanonryPressureConfig[]) => void;
  onGeneratorsChange?: (generators: CanonryGeneratorConfig[]) => void;
  onActionsChange?: (actions: CanonryActionConfig[]) => void;
  onSystemsChange?: (systems: CanonrySystemConfig[]) => void;
}

export interface LoreWeaveRemoteProps extends MfeNavProps {
  schema: CanonrySchemaSlice;
  eras?: CanonryEraConfig[];
  pressures?: CanonryPressureConfig[];
  generators?: CanonryGeneratorConfig[];
  systems?: CanonrySystemConfig[];
  actions?: CanonryActionConfig[];
  seedEntities?: SeedEntity[];
  seedRelationships?: SeedRelationship[];
  distributionTargets?: CanonryDistributionTargets | null;
  onDistributionTargetsChange?: (targets: CanonryDistributionTargets | null) => void;
  onViewInArchivist?: (results: CanonrySimulationResults) => void;
  simulationResults?: CanonrySimulationResults | null;
  onSimulationResultsChange?: (results: CanonrySimulationResults | null) => void;
  simulationState?: CanonrySimulationState | null;
  onSimulationStateChange?: (state: CanonrySimulationState | null) => void;
  onSearchRunScored?: (payload: LoreWeaveRunScorePayload) => void;
}

export interface ArchivistRemoteProps {
  worldData?: Record<string, unknown> | null;
  loreData?: Record<string, unknown> | null;
  imageData?: Record<string, unknown> | null;
}
