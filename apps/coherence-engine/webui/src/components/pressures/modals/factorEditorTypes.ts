/**
 * Type definitions for the FactorEditorModal component family.
 */

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export interface StatusDef {
  readonly id: string;
  readonly name?: string;
  readonly isTerminal?: boolean;
}

export interface SubtypeDef {
  readonly id: string;
  readonly name?: string;
}

export interface EntityKindDef {
  readonly kind: string;
  readonly description?: string;
  readonly subtypes?: SubtypeDef[];
  readonly statuses?: StatusDef[];
}

export interface RelationshipKindDef {
  readonly kind: string;
  readonly description?: string;
}

export interface TagRegistryEntry {
  readonly tag: string;
  readonly category: string;
  readonly rarity: string;
  readonly description?: string;
  readonly isAxis?: boolean;
}

export interface FactorSchema {
  readonly entityKinds?: EntityKindDef[];
  readonly relationshipKinds?: RelationshipKindDef[];
  readonly tagRegistry?: TagRegistryEntry[];
}

// ---------------------------------------------------------------------------
// Factor types
// ---------------------------------------------------------------------------

export type FactorType =
  | "entity_count"
  | "relationship_count"
  | "tag_count"
  | "ratio"
  | "status_ratio"
  | "cross_culture_ratio";

export interface CountObj {
  readonly type?: string;
  readonly kind?: string;
  readonly subtype?: string;
  readonly relationshipKinds?: string[];
}

export interface Factor {
  readonly type: FactorType;
  readonly coefficient?: number;
  readonly cap?: number;
  readonly kind?: string;
  readonly subtype?: string;
  readonly status?: string;
  readonly aliveStatus?: string;
  readonly relationshipKinds?: string[];
  readonly tags?: string[];
  readonly fallbackValue?: number;
  readonly numerator?: CountObj;
  readonly denominator?: CountObj;
}

export interface FactorTypeConfig {
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly color: string;
  readonly fields: string[];
}

// ---------------------------------------------------------------------------
// Dropdown option shape
// ---------------------------------------------------------------------------

export interface DropdownOption {
  readonly value: string;
  readonly label: string;
  readonly meta?: string;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface FactorEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly factor: Factor | null;
  readonly onChange: (factor: Factor) => void;
  readonly feedbackType: string;
  readonly schema: FactorSchema;
}

export interface FactorTypeSelectorProps {
  readonly selectedType: FactorType;
  readonly onTypeChange: (type: FactorType) => void;
  readonly typeConfig: FactorTypeConfig | undefined;
}

export interface EntityCountFieldsProps {
  readonly localFactor: Factor;
  readonly entityKindOptions: DropdownOption[];
  readonly getSubtypeOptions: (kind: string) => DropdownOption[];
  readonly getStatusOptions: (kind: string) => DropdownOption[];
  readonly onUpdateField: (field: string, value: string | undefined) => void;
}

export interface ChipSelectFieldsProps {
  readonly value: string[];
  readonly label: string;
  readonly options: DropdownOption[];
  readonly placeholder: string;
  readonly onChange: (value: string[]) => void;
}

export interface TagCountFieldsProps {
  readonly localFactor: Factor;
  readonly tagRegistry: TagRegistryEntry[];
  readonly onUpdateField: (field: string, value: string[]) => void;
}

export interface StatusRatioFieldsProps {
  readonly localFactor: Factor;
  readonly entityKindOptions: DropdownOption[];
  readonly getSubtypeOptions: (kind: string) => DropdownOption[];
  readonly getStatusOptions: (kind: string) => DropdownOption[];
  readonly onStatusRatioKindChange: (v: string | undefined) => void;
  readonly onUpdateField: (field: string, value: string | undefined) => void;
}

export interface CommonNumericFieldsProps {
  readonly localFactor: Factor;
  readonly selectedType: FactorType;
  readonly onUpdateField: (field: string, value: number | undefined) => void;
}

export interface CountEditorProps {
  readonly countObj: CountObj | undefined;
  readonly onCountChange: (updated: CountObj) => void;
  readonly label: string;
  readonly entityKindOptions: DropdownOption[];
  readonly getSubtypeOptions: (kind: string) => DropdownOption[];
  readonly relationshipKindOptions: DropdownOption[];
}

// Grouped prop bags for FactorEditorContent

export interface SchemaOptions {
  readonly entityKindOptions: DropdownOption[];
  readonly getSubtypeOptions: (kind: string) => DropdownOption[];
  readonly getStatusOptions: (kind: string) => DropdownOption[];
  readonly relationshipKindOptions: DropdownOption[];
}

export interface FieldUpdaters {
  readonly updateStringField: (field: string, value: string | undefined) => void;
  readonly updateArrayField: (field: string, value: string[]) => void;
  readonly updateNumericField: (field: string, value: number | undefined) => void;
  readonly handleStatusRatioKindChange: (v: string | undefined) => void;
  readonly handleNumeratorChange: (v: CountObj) => void;
  readonly handleDenominatorChange: (v: CountObj) => void;
}

export interface FactorEditorContentProps {
  readonly localFactor: Factor;
  readonly selectedType: FactorType;
  readonly tagRegistry: TagRegistryEntry[] | undefined;
  readonly schemaOptions: SchemaOptions;
  readonly fieldUpdaters: FieldUpdaters;
  readonly handleTypeChange: (type: FactorType) => void;
  readonly typeConfig: FactorTypeConfig | undefined;
}
