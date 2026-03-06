/**
 * Type definitions for applicability rules
 */

// ---------------------------------------------------------------------------
// Schema types (subset of domain schema used by rule editors)
// ---------------------------------------------------------------------------

export interface EntityKindDef {
  kind: string;
  description?: string;
  subtypes?: Array<{ id: string; name?: string }>;
}

export interface RelationshipKindDef {
  kind: string;
  description?: string;
}

export interface TagRegistryEntry {
  tag: string;
  category: string;
  rarity: string;
  description?: string;
  isAxis?: boolean;
}

export interface DomainSchema {
  entityKinds?: EntityKindDef[];
  relationshipKinds?: RelationshipKindDef[];
  tagRegistry?: TagRegistryEntry[];
}

export interface PressureDef {
  id: string;
  name?: string;
}

export interface EraDef {
  id: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Dropdown option shape used by ReferenceDropdown / ChipSelect
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Rule type union - each rule type has its own shape
// ---------------------------------------------------------------------------

interface BaseRule {
  type: string;
}

export interface EntityCountRule extends BaseRule {
  type: 'entity_count';
  kind?: string;
  subtype?: string;
  min?: number;
  max?: number;
}

export interface PressureRule extends BaseRule {
  type: 'pressure';
  pressureId?: string;
  min?: number;
  max?: number;
}

export interface PressureAnyAboveRule extends BaseRule {
  type: 'pressure_any_above';
  pressureIds?: string[];
  threshold?: number;
}

export interface PressureCompareRule extends BaseRule {
  type: 'pressure_compare';
  pressureA?: string;
  pressureB?: string;
  operator?: string;
}

export interface RelationshipCountRule extends BaseRule {
  type: 'relationship_count';
  relationshipKind?: string;
  direction?: string;
  min?: number;
  max?: number;
}

export interface RelationshipExistsRule extends BaseRule {
  type: 'relationship_exists';
  relationshipKind?: string;
  direction?: string;
  targetKind?: string;
  targetSubtype?: string;
  targetStatus?: string;
}

export interface TagExistsRule extends BaseRule {
  type: 'tag_exists';
  tag?: string;
  value?: string;
}

export interface TagAbsentRule extends BaseRule {
  type: 'tag_absent';
  tag?: string;
}

export interface StatusRule extends BaseRule {
  type: 'status';
  status?: string;
  not?: boolean;
}

export interface ProminenceRule extends BaseRule {
  type: 'prominence';
  min?: string;
  max?: string;
}

export interface TimeElapsedRule extends BaseRule {
  type: 'time_elapsed';
  minTicks?: number;
  since?: string;
}

export interface GrowthPhasesCompleteRule extends BaseRule {
  type: 'growth_phases_complete';
  minPhases?: number;
  eraId?: string;
}

export interface EraMatchRule extends BaseRule {
  type: 'era_match';
  eras?: string[];
}

export interface RandomChanceRule extends BaseRule {
  type: 'random_chance';
  chance?: number;
}

export interface CooldownElapsedRule extends BaseRule {
  type: 'cooldown_elapsed';
  cooldownTicks?: number;
}

export interface CreationsPerEpochRule extends BaseRule {
  type: 'creations_per_epoch';
  maxPerEpoch?: number;
}

export interface GraphPathAssert {
  check?: string;
  path?: unknown[];
  count?: number;
}

export interface GraphPathRule extends BaseRule {
  type: 'graph_path';
  assert?: GraphPathAssert;
}

export interface EntityExistsRule extends BaseRule {
  type: 'entity_exists';
  entity?: string;
}

export interface EntityHasRelationshipRule extends BaseRule {
  type: 'entity_has_relationship';
  entity?: string;
  relationshipKind?: string;
  direction?: string;
}

export interface LogicalRule extends BaseRule {
  type: 'or' | 'and';
  conditions?: ApplicabilityRule[];
}

export interface AlwaysRule extends BaseRule {
  type: 'always';
}

export type ApplicabilityRule =
  | EntityCountRule
  | PressureRule
  | PressureAnyAboveRule
  | PressureCompareRule
  | RelationshipCountRule
  | RelationshipExistsRule
  | TagExistsRule
  | TagAbsentRule
  | StatusRule
  | ProminenceRule
  | TimeElapsedRule
  | GrowthPhasesCompleteRule
  | EraMatchRule
  | RandomChanceRule
  | CooldownElapsedRule
  | CreationsPerEpochRule
  | GraphPathRule
  | EntityExistsRule
  | EntityHasRelationshipRule
  | LogicalRule
  | AlwaysRule;

// ---------------------------------------------------------------------------
// Props passed to rule-type-specific editor sub-components
// ---------------------------------------------------------------------------

export interface RuleEditorProps {
  rule: ApplicabilityRule;
  updateField: (field: string, value: unknown) => void;
  entityKindOptions: SelectOption[];
  relationshipKindOptions: SelectOption[];
  pressureOptions: SelectOption[];
  eraOptions: SelectOption[];
  tagRegistry: TagRegistryEntry[];
  getSubtypesForKind: (kind: string) => SelectOption[];
  schema: DomainSchema;
}
