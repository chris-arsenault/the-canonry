/**
 * FactorEditorContent - modal body assembling type selector + per-type field sections.
 * FactorTypeSelector - pill-based factor type chooser.
 *
 * Separated from FactorEditorModal to respect file and function line-count limits.
 */

import React, { useMemo, useCallback } from "react";
import type { KeyboardEvent } from "react";
import { FACTOR_TYPES } from "../constants";
import {
  EntityCountFields,
  ChipSelectFields,
  TagCountFields,
  StatusRatioFields,
  CommonNumericFields,
  CountEditor,
} from "./FactorFieldSections";
import type {
  FactorType,
  FactorTypeConfig,
  FactorTypeSelectorProps,
  FactorEditorContentProps,
} from "./factorEditorTypes";

// ---------------------------------------------------------------------------
// FactorTypeSelector
// ---------------------------------------------------------------------------

function FactorTypeSelector({
  selectedType,
  onTypeChange,
  typeConfig,
}: Readonly<FactorTypeSelectorProps>) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
    },
    [],
  );

  return (
    <div className="mb-2xl">
      <span className="label">Factor Type</span>
      <div className="type-selector">
        {Object.entries(FACTOR_TYPES).map(([type, config]) => (
          <div
            key={type}
            onClick={() => onTypeChange(type as FactorType)}
            className={`type-pill ${selectedType === type ? "type-pill-selected" : ""}`}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            <span className="type-pill-icon">{(config as FactorTypeConfig).icon}</span>
            <span>{(config as FactorTypeConfig).label}</span>
          </div>
        ))}
      </div>
      {typeConfig && <div className="type-description">{typeConfig.description}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FactorEditorContent
// ---------------------------------------------------------------------------

export function FactorEditorContent({
  localFactor,
  selectedType,
  tagRegistry,
  schemaOptions,
  fieldUpdaters,
  handleTypeChange,
  typeConfig,
}: Readonly<FactorEditorContentProps>) {
  const { entityKindOptions, getSubtypeOptions, getStatusOptions, relationshipKindOptions } =
    schemaOptions;
  const {
    updateStringField,
    updateArrayField,
    updateNumericField,
    handleStatusRatioKindChange,
    handleNumeratorChange,
    handleDenominatorChange,
  } = fieldUpdaters;

  const relKindsValue = useMemo(
    () => localFactor.relationshipKinds ?? [],
    [localFactor.relationshipKinds],
  );
  const handleRelKindsChange = useCallback(
    (v: string[]) => updateArrayField("relationshipKinds", v),
    [updateArrayField],
  );
  const safeTagRegistry = useMemo(() => tagRegistry ?? [], [tagRegistry]);

  return (
    <div className="modal-content">
      <FactorTypeSelector
        selectedType={selectedType}
        onTypeChange={handleTypeChange}
        typeConfig={typeConfig}
      />
      <div className="input-grid">
        {selectedType === "entity_count" && (
          <EntityCountFields
            localFactor={localFactor}
            entityKindOptions={entityKindOptions}
            getSubtypeOptions={getSubtypeOptions}
            getStatusOptions={getStatusOptions}
            onUpdateField={updateStringField}
          />
        )}
        {selectedType === "relationship_count" && (
          <ChipSelectFields
            value={relKindsValue}
            label="Relationship Kinds"
            options={relationshipKindOptions}
            placeholder="Select relationship types..."
            onChange={handleRelKindsChange}
          />
        )}
        {selectedType === "tag_count" && (
          <TagCountFields
            localFactor={localFactor}
            tagRegistry={safeTagRegistry}
            onUpdateField={updateArrayField}
          />
        )}
        {selectedType === "status_ratio" && (
          <StatusRatioFields
            localFactor={localFactor}
            entityKindOptions={entityKindOptions}
            getSubtypeOptions={getSubtypeOptions}
            getStatusOptions={getStatusOptions}
            onStatusRatioKindChange={handleStatusRatioKindChange}
            onUpdateField={updateStringField}
          />
        )}
        {selectedType === "cross_culture_ratio" && (
          <ChipSelectFields
            value={relKindsValue}
            label="Relationship Kinds"
            options={relationshipKindOptions}
            placeholder="Select relationship types..."
            onChange={handleRelKindsChange}
          />
        )}
        <CommonNumericFields
          localFactor={localFactor}
          selectedType={selectedType}
          onUpdateField={updateNumericField}
        />
      </div>
      {selectedType === "ratio" && (
        <>
          <CountEditor
            countObj={localFactor.numerator}
            onCountChange={handleNumeratorChange}
            label="Numerator"
            entityKindOptions={entityKindOptions}
            getSubtypeOptions={getSubtypeOptions}
            relationshipKindOptions={relationshipKindOptions}
          />
          <CountEditor
            countObj={localFactor.denominator}
            onCountChange={handleDenominatorChange}
            label="Denominator"
            entityKindOptions={entityKindOptions}
            getSubtypeOptions={getSubtypeOptions}
            relationshipKindOptions={relationshipKindOptions}
          />
        </>
      )}
    </div>
  );
}
