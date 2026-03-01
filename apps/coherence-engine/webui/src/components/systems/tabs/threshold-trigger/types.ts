/**
 * Shared types for ThresholdTriggerTab sub-components
 */

import type { Mutation, MutationTypeOption, PressureEntry } from "../../../shared/mutationUtils";

export interface EntityKindDef {
  kind: string;
  description?: string;
  subtypes?: Array<{ id: string; name?: string }>;
}

export interface RelationshipKindDef {
  kind: string;
  description?: string;
}

export interface Schema {
  entityKinds?: EntityKindDef[];
  relationshipKinds?: RelationshipKindDef[];
  tagRegistry?: Array<{ name: string; rarity: string; description?: string; isAxis?: boolean }>;
}

export interface ApplicabilityRule {
  type: string;
  [key: string]: unknown;
}

export interface VariableConfig {
  select: Record<string, unknown>;
  required?: boolean;
}

export interface SystemConfig {
  conditions?: ApplicabilityRule[];
  variables?: Record<string, VariableConfig>;
  actions?: Mutation[];
  clusterMode?: string;
  clusterRelationshipKind?: string;
  minClusterSize?: number;
  narrationTemplate?: string;
}

export interface System {
  config: SystemConfig;
  [key: string]: unknown;
}

export type { Mutation, MutationTypeOption, PressureEntry };
