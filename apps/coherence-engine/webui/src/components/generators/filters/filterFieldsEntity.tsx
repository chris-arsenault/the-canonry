/**
 * Relationship and entity filter field sub-components for SelectionFilterCard.
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown, ChipSelect } from "../../shared";
import type {
  SelectionFilter,
  DropdownOption,
} from "./selectionFilterTypes";
import { DIRECTION_OPTIONS } from "./selectionFilterTypes";

type UpdateField<V = unknown> = (field: string, value: V) => void;

// ---------------------------------------------------------------------------
// RelationshipFields — has_relationship / lacks_relationship
// ---------------------------------------------------------------------------

interface RelationshipFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string | undefined>;
  readonly relationshipKindOptions: readonly DropdownOption[];
  readonly refOptions: readonly DropdownOption[];
}

export function RelationshipFields({
  filter,
  onUpdateField,
  relationshipKindOptions,
  refOptions,
}: RelationshipFieldsProps) {
  const handleKindChange = useCallback(
    (v: string | undefined) => onUpdateField("kind", v),
    [onUpdateField],
  );
  const handleWithChange = useCallback(
    (v: string | undefined) => onUpdateField("with", v || undefined),
    [onUpdateField],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) => onUpdateField("direction", v),
    [onUpdateField],
  );

  return (
    <div className="filter-fields">
      <div className="sfc-flex-field-medium">
        <label className="label label-small">Relationship Kind
          <ReferenceDropdown
            value={filter.kind || ""}
            onChange={handleKindChange}
            options={relationshipKindOptions as DropdownOption[]}
            placeholder="Select kind..."
          />
        </label>
      </div>
      <div className="sfc-flex-field-narrow">
        <label className="label label-small">With Entity (optional)
          <ReferenceDropdown
            value={filter.with || ""}
            onChange={handleWithChange}
            options={refOptions as DropdownOption[]}
            placeholder="Any entity"
          />
        </label>
      </div>
      {filter.type === "has_relationship" && (
        <div className="sfc-flex-field-tiny">
          <label className="label label-small">Direction
            <ReferenceDropdown
              value={filter.direction || "both"}
              onChange={handleDirectionChange}
              options={DIRECTION_OPTIONS as DropdownOption[]}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExcludeFields — exclude
// ---------------------------------------------------------------------------

interface ExcludeFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string[]>;
  readonly refOptions: readonly DropdownOption[];
}

export function ExcludeFields({ filter, onUpdateField, refOptions }: ExcludeFieldsProps) {
  const excludeValue = useMemo(() => [...(filter.entities || [])], [filter.entities]);
  const handleChange = useCallback(
    (v: string[]) => onUpdateField("entities", v),
    [onUpdateField],
  );

  return (
    <ChipSelect
      label="Entities to Exclude"
      value={excludeValue}
      onChange={handleChange}
      options={refOptions as DropdownOption[]}
      placeholder="+ Add variable..."
    />
  );
}

// ---------------------------------------------------------------------------
// SharesRelatedFields — shares_related
// ---------------------------------------------------------------------------

interface SharesRelatedFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string | undefined>;
  readonly relationshipKindOptions: readonly DropdownOption[];
  readonly refOptions: readonly DropdownOption[];
}

export function SharesRelatedFields({
  filter,
  onUpdateField,
  relationshipKindOptions,
  refOptions,
}: SharesRelatedFieldsProps) {
  const handleRelKindChange = useCallback(
    (v: string | undefined) => onUpdateField("relationshipKind", v),
    [onUpdateField],
  );
  const handleWithChange = useCallback(
    (v: string | undefined) => onUpdateField("with", v),
    [onUpdateField],
  );

  return (
    <div className="filter-fields">
      <div className="sfc-flex-field-medium">
        <label className="label label-small">Via Relationship
          <ReferenceDropdown
            value={filter.relationshipKind || ""}
            onChange={handleRelKindChange}
            options={relationshipKindOptions as DropdownOption[]}
            placeholder="Select kind..."
          />
        </label>
      </div>
      <div className="sfc-flex-field-narrow">
        <label className="label label-small">With Entity
          <ReferenceDropdown
            value={filter.with || ""}
            onChange={handleWithChange}
            options={refOptions as DropdownOption[]}
            placeholder="Select variable..."
          />
        </label>
      </div>
    </div>
  );
}
