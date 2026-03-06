/**
 * Shared type definitions for ConnectionEvolutionTab components.
 */

// ---------------------------------------------------------------------------
// Schema shape interfaces
// ---------------------------------------------------------------------------

export interface RelationshipKindDef {
  readonly kind: string;
  readonly description?: string;
}

export interface SubtypeDef {
  readonly id: string;
  readonly name?: string;
}

export interface EntityKindDef {
  readonly kind: string;
  readonly description?: string;
  readonly subtypes?: SubtypeDef[];
}

export interface TagDefinition {
  readonly key: string;
  readonly label?: string;
  readonly description?: string;
  readonly category?: string;
}

export interface DomainSchema {
  readonly relationshipKinds?: RelationshipKindDef[];
  readonly entityKinds?: EntityKindDef[];
  readonly tagRegistry?: TagDefinition[];
}

// ---------------------------------------------------------------------------
// Rule data interfaces
// ---------------------------------------------------------------------------

export interface RuleCondition {
  readonly operator?: string;
  readonly threshold?: number | string;
  readonly multiplier?: number;
}

export interface RuleAction {
  readonly type?: string;
  readonly entity?: string;
  readonly delta?: number;
  readonly kind?: string;
  readonly src?: string;
  readonly dst?: string;
  readonly category?: string;
  readonly strength?: number;
  readonly bidirectional?: boolean;
  readonly newStatus?: string;
  readonly tag?: string;
  readonly value?: string;
}

export interface Rule {
  readonly condition?: RuleCondition;
  readonly probability: number;
  readonly action?: RuleAction;
  readonly betweenMatching?: boolean;
  readonly narrationTemplate?: string;
}

// ---------------------------------------------------------------------------
// System config interfaces
// ---------------------------------------------------------------------------

export interface MetricConfig {
  readonly type?: string;
  readonly direction?: string;
  readonly relationshipKinds?: string[];
  readonly sharedRelationshipKind?: string;
  readonly sharedDirection?: string;
  readonly minStrength?: number;
}

export interface SelectionConfig {
  readonly kind?: string;
}

export interface SubtypeBonus {
  readonly subtype: string;
  readonly bonus: number;
}

export interface SystemConfig {
  readonly metric?: MetricConfig;
  readonly rules?: Rule[];
  readonly subtypeBonuses?: SubtypeBonus[];
  readonly selection?: SelectionConfig;
}

export interface System {
  readonly config: SystemConfig;
  readonly [key: string]: unknown;
}

export interface DropdownOption {
  readonly value: string;
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Static option arrays (module-level to avoid re-creation)
// ---------------------------------------------------------------------------

export const OPERATOR_OPTIONS: readonly DropdownOption[] = [
  { value: ">=", label: ">= (greater or equal)" },
  { value: ">", label: "> (greater)" },
  { value: "<=", label: "<= (less or equal)" },
  { value: "<", label: "< (less)" },
  { value: "==", label: "== (equal)" },
];

export const ACTION_TYPE_OPTIONS: readonly DropdownOption[] = [
  { value: "adjust_prominence", label: "Adjust Prominence" },
  { value: "create_relationship", label: "Create Relationship" },
  { value: "change_status", label: "Change Status" },
  { value: "set_tag", label: "Set Tag" },
];

export const ENTITY_REF_OPTIONS: readonly DropdownOption[] = [
  { value: "$self", label: "$self" },
  { value: "$member", label: "$member" },
  { value: "$member2", label: "$member2" },
];

export const SHARED_DIRECTION_OPTIONS: readonly DropdownOption[] = [
  { value: "src", label: "Source (outgoing)" },
  { value: "dst", label: "Destination (incoming)" },
];
