/**
 * Type definitions shared across all validation modules.
 */

// ---------------------------------------------------------------------------
// UsageMap types (from computeUsageMap)
// ---------------------------------------------------------------------------

export interface InvalidRef {
  refType: string;
  refId: string;
  type?: string;
  id?: string;
  location: string;
}

export interface OrphanEntry {
  type: string;
  id: string;
  reason: string;
}

export interface CompatibilityIssue {
  type: string;
  id: string;
  field: string;
  issue: string;
}

export interface TagUsage {
  generators?: string[];
  systems?: string[];
  pressures?: string[];
  actions?: string[];
}

export interface UsageMapValidation {
  invalidRefs?: InvalidRef[];
  orphans?: OrphanEntry[];
  compatibility?: CompatibilityIssue[];
}

export interface UsageMap {
  validation?: UsageMapValidation;
  tags?: Record<string, TagUsage>;
}

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export interface SubtypeDef {
  id: string;
  name?: string;
}

export interface StatusDef {
  id: string;
  name?: string;
}

export interface SemanticRegion {
  id: string;
  culture?: string;
}

export interface SemanticPlane {
  regions?: SemanticRegion[];
}

export interface EntityKindDef {
  kind: string;
  subtypes?: SubtypeDef[];
  statuses?: StatusDef[];
  semanticPlane?: SemanticPlane;
}

export interface CultureDef {
  id: string;
  name?: string;
}

export interface TagRegistryEntry {
  tag: string;
  conflictingTags?: string[];
}

export interface Schema {
  entityKinds?: EntityKindDef[];
  cultures?: CultureDef[];
  tagRegistry?: TagRegistryEntry[];
}

// ---------------------------------------------------------------------------
// Domain config types
// ---------------------------------------------------------------------------

export interface StateUpdate {
  type: string;
  pressureId?: string;
  delta?: number;
}

export interface CreationSpec {
  kind?: string;
  subtype?: string | { random?: string[]; inherit?: unknown };
  status?: string;
  tags?: Record<string, boolean>;
}

export interface Generator {
  id: string;
  name?: string;
  enabled?: boolean;
  stateUpdates?: StateUpdate[];
  creation?: CreationSpec[];
}

export interface MutationAction {
  type?: string;
  pressureId?: string;
  delta?: number;
}

export interface SystemRule {
  action?: MutationAction;
}

export interface SystemConfig {
  pressureChanges?: Record<string, number>;
  actions?: MutationAction[];
  infectionAction?: MutationAction;
  rules?: SystemRule[];
}

export interface System {
  id: string;
  name?: string;
  config: SystemConfig;
}

export interface PressureFactor {
  kind?: string;
  subtype?: string;
  numerator?: { kind?: string; subtype?: string };
}

export interface PressureGrowth {
  positiveFeedback?: PressureFactor[];
  negativeFeedback?: PressureFactor[];
}

export interface Pressure {
  id: string;
  name?: string;
  initialValue?: number;
  homeostasis?: number;
  growth?: PressureGrowth;
}

export interface Era {
  id: string;
  templateWeights?: Record<string, number>;
  systemModifiers?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export interface AffectedItem {
  id: string;
  label: string;
  detail: string;
}

export type Severity = "error" | "warning";

export interface ValidationResult {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  affectedItems: AffectedItem[];
}

export interface ValidationResults {
  errors: ValidationResult[];
  warnings: ValidationResult[];
}

export type OverallStatus = "error" | "warning" | "clean";
