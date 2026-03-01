/**
 * Field section sub-components for FactorEditorModal.
 *
 * Each component renders the form fields for a specific factor type.
 * Extracted to keep the main modal under complexity and line-count limits.
 */

import React, { useMemo, useCallback } from "react";
import { ReferenceDropdown, ChipSelect, NumberInput } from "../../shared";
import TagSelector from "@the-canonry/shared-components/TagSelector";
import type {
  EntityCountFieldsProps,
  ChipSelectFieldsProps,
  TagCountFieldsProps,
  StatusRatioFieldsProps,
  CommonNumericFieldsProps,
  CountEditorProps,
  DropdownOption,
} from "./factorEditorTypes";

// ---------------------------------------------------------------------------
// EntityCountFields
// ---------------------------------------------------------------------------

export function EntityCountFields({
  localFactor,
  entityKindOptions,
  getSubtypeOptions,
  getStatusOptions,
  onUpdateField,
}: Readonly<EntityCountFieldsProps>) {
  const handleKindChange = useCallback(
    (v: string | undefined) => onUpdateField("kind", v),
    [onUpdateField],
  );
  const handleSubtypeChange = useCallback(
    (v: string | undefined) => onUpdateField("subtype", v || undefined),
    [onUpdateField],
  );
  const handleStatusChange = useCallback(
    (v: string | undefined) => onUpdateField("status", v || undefined),
    [onUpdateField],
  );
  const subtypeOptions = useMemo(
    () => (localFactor.kind ? getSubtypeOptions(localFactor.kind) : []),
    [localFactor.kind, getSubtypeOptions],
  );
  const statusOptions = useMemo(
    () => (localFactor.kind ? getStatusOptions(localFactor.kind) : []),
    [localFactor.kind, getStatusOptions],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity Kind"
        value={localFactor.kind ?? ""}
        onChange={handleKindChange}
        options={entityKindOptions}
        placeholder="Select kind..."
      />
      {localFactor.kind && (
        <ReferenceDropdown
          label="Subtype (optional)"
          value={localFactor.subtype ?? ""}
          onChange={handleSubtypeChange}
          options={subtypeOptions}
          placeholder="Any subtype"
        />
      )}
      {localFactor.kind && (
        <ReferenceDropdown
          label="Status (optional)"
          value={localFactor.status ?? ""}
          onChange={handleStatusChange}
          options={statusOptions}
          placeholder="Any status"
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ChipSelectFields - shared by relationship_count and cross_culture_ratio
// ---------------------------------------------------------------------------

export function ChipSelectFields({
  value,
  label,
  options,
  placeholder,
  onChange,
}: Readonly<ChipSelectFieldsProps>) {
  return (
    <div className="grid-col-full">
      <ChipSelect
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagCountFields
// ---------------------------------------------------------------------------

export function TagCountFields({
  localFactor,
  tagRegistry,
  onUpdateField,
}: Readonly<TagCountFieldsProps>) {
  const handleChange = useCallback(
    (v: string[]) => onUpdateField("tags", v),
    [onUpdateField],
  );
  const value = useMemo(() => localFactor.tags ?? [], [localFactor.tags]);

  return (
    <div className="grid-col-full">
      <label className="label">
        Tags
        <TagSelector
          value={value}
          onChange={handleChange}
          tagRegistry={tagRegistry}
          placeholder="Select tags..."
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusRatioFields
// ---------------------------------------------------------------------------

export function StatusRatioFields({
  localFactor,
  entityKindOptions,
  getSubtypeOptions,
  getStatusOptions,
  onStatusRatioKindChange,
  onUpdateField,
}: Readonly<StatusRatioFieldsProps>) {
  const handleSubtypeChange = useCallback(
    (v: string | undefined) => onUpdateField("subtype", v || undefined),
    [onUpdateField],
  );
  const handleAliveStatusChange = useCallback(
    (v: string | undefined) => onUpdateField("aliveStatus", v),
    [onUpdateField],
  );
  const subtypeOptions = useMemo(
    () => (localFactor.kind ? getSubtypeOptions(localFactor.kind) : []),
    [localFactor.kind, getSubtypeOptions],
  );
  const statusOptions = useMemo(
    () => (localFactor.kind ? getStatusOptions(localFactor.kind) : []),
    [localFactor.kind, getStatusOptions],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity Kind"
        value={localFactor.kind ?? ""}
        onChange={onStatusRatioKindChange}
        options={entityKindOptions}
        placeholder="Select kind..."
      />
      {localFactor.kind && (
        <ReferenceDropdown
          label="Subtype (optional)"
          value={localFactor.subtype ?? ""}
          onChange={handleSubtypeChange}
          options={subtypeOptions}
          placeholder="Any subtype"
        />
      )}
      {localFactor.kind && (
        <ReferenceDropdown
          label="Alive Status"
          value={localFactor.aliveStatus ?? ""}
          onChange={handleAliveStatusChange}
          options={statusOptions}
          placeholder="Select status..."
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CommonNumericFields
// ---------------------------------------------------------------------------

const TYPES_WITH_CAP = new Set<string>(["entity_count", "relationship_count", "ratio"]);

export function CommonNumericFields({
  localFactor,
  selectedType,
  onUpdateField,
}: Readonly<CommonNumericFieldsProps>) {
  const handleCoefficientChange = useCallback(
    (v: number | undefined) => onUpdateField("coefficient", v ?? 0),
    [onUpdateField],
  );
  const handleCapChange = useCallback(
    (v: number | undefined) => onUpdateField("cap", v),
    [onUpdateField],
  );
  const handleFallbackChange = useCallback(
    (v: number | undefined) => onUpdateField("fallbackValue", v ?? 0),
    [onUpdateField],
  );
  const showCap = TYPES_WITH_CAP.has(selectedType);

  return (
    <>
      <div className="input-group">
        <label className="label">
          Coefficient
          <NumberInput
            value={localFactor.coefficient ?? 1}
            onChange={handleCoefficientChange}
          />
        </label>
      </div>
      {showCap && (
        <div className="input-group">
          <label className="label">
            Cap (optional)
            <NumberInput
              value={localFactor.cap}
              onChange={handleCapChange}
              allowEmpty
              placeholder="No cap"
            />
          </label>
        </div>
      )}
      {selectedType === "ratio" && (
        <div className="input-group">
          <label className="label">
            Fallback Value
            <NumberInput
              value={localFactor.fallbackValue ?? 0}
              onChange={handleFallbackChange}
            />
          </label>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CountEditor - used for ratio numerator/denominator
// ---------------------------------------------------------------------------

const COUNT_TYPE_OPTIONS: DropdownOption[] = [
  { value: "entity_count", label: "Entity Count" },
  { value: "relationship_count", label: "Relationship Count" },
  { value: "total_entities", label: "Total Entities" },
];

function CountEditorEntityFields({
  countObj,
  entityKindOptions,
  subtypeOptions,
  onKindChange,
  onSubtypeChange,
}: Readonly<{
  countObj: CountEditorProps["countObj"];
  entityKindOptions: DropdownOption[];
  subtypeOptions: DropdownOption[];
  onKindChange: (v: string | undefined) => void;
  onSubtypeChange: (v: string | undefined) => void;
}>) {
  return (
    <>
      <ReferenceDropdown
        label="Entity Kind"
        value={countObj?.kind ?? ""}
        onChange={onKindChange}
        options={entityKindOptions}
        placeholder="Select kind..."
      />
      {countObj?.kind && (
        <ReferenceDropdown
          label="Subtype (optional)"
          value={countObj?.subtype ?? ""}
          onChange={onSubtypeChange}
          options={subtypeOptions}
          placeholder="Any subtype"
        />
      )}
    </>
  );
}

export function CountEditor({
  countObj,
  onCountChange,
  label,
  entityKindOptions,
  getSubtypeOptions,
  relationshipKindOptions,
}: Readonly<CountEditorProps>) {
  const countType = countObj?.type ?? "entity_count";

  const handleCountTypeChange = useCallback(
    (v: string | undefined) => onCountChange({ ...countObj, type: v }),
    [countObj, onCountChange],
  );
  const handleKindChange = useCallback(
    (v: string | undefined) => onCountChange({ ...countObj, kind: v, subtype: undefined }),
    [countObj, onCountChange],
  );
  const handleSubtypeChange = useCallback(
    (v: string | undefined) => onCountChange({ ...countObj, subtype: v || undefined }),
    [countObj, onCountChange],
  );
  const handleRelKindsChange = useCallback(
    (v: string[]) => onCountChange({ ...countObj, relationshipKinds: v }),
    [countObj, onCountChange],
  );
  const subtypeOptions = useMemo(
    () => (countObj?.kind ? getSubtypeOptions(countObj.kind) : []),
    [countObj, getSubtypeOptions],
  );
  const relKindsValue = useMemo(
    () => countObj?.relationshipKinds ?? [],
    [countObj],
  );

  return (
    <div className="fem-nested-area">
      <div className="nested-title">{label}</div>
      <div className="input-grid">
        <ReferenceDropdown
          label="Count Type"
          value={countType}
          onChange={handleCountTypeChange}
          options={COUNT_TYPE_OPTIONS}
        />
        {countType === "entity_count" && (
          <CountEditorEntityFields
            countObj={countObj}
            entityKindOptions={entityKindOptions}
            subtypeOptions={subtypeOptions}
            onKindChange={handleKindChange}
            onSubtypeChange={handleSubtypeChange}
          />
        )}
        {countType === "relationship_count" && (
          <ChipSelect
            label="Relationship Kinds"
            value={relKindsValue}
            onChange={handleRelKindsChange}
            options={relationshipKindOptions}
            placeholder="Select relationships..."
          />
        )}
      </div>
    </div>
  );
}
