/**
 * Fields for relationship mutation types:
 * - create_relationship
 * - adjust_relationship_strength
 * - archive_relationship
 * - archive_all_relationships
 * - transfer_relationship
 */

import React, { useCallback } from "react";
import { ReferenceDropdown, NumberInput } from "../index";
import type { Mutation, EntityRefOption, TagValue } from "../mutationUtils";
import { DIRECTION_OPTIONS } from "../mutationUtils";

interface RelationshipKindOption {
  readonly value: string;
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Shared sub-pieces
// ---------------------------------------------------------------------------

interface BidirectionalCheckboxProps {
  readonly checked: boolean;
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function BidirectionalCheckbox({ checked, onChange }: BidirectionalCheckboxProps) {
  return (
    <div className="form-group">
      <label className="checkbox-label">
        <input type="checkbox" checked={checked} onChange={onChange} className="checkbox" />
        Bidirectional
      </label>
    </div>
  );
}

interface CreateRelExtrasProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: TagValue) => void;
}

function CreateRelExtras({ mutation, update }: CreateRelExtrasProps) {
  const handleStrengthChange = useCallback(
    (v: number | undefined) => update("strength", v),
    [update],
  );
  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => update("category", e.target.value || undefined),
    [update],
  );
  const handleBidirChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => update("bidirectional", e.target.checked || undefined),
    [update],
  );
  return (
    <>
      <div className="form-group">
        <label className="label">
          Strength
          <NumberInput value={mutation.strength} onChange={handleStrengthChange} min={0} max={1} allowEmpty />
        </label>
      </div>
      <div className="form-group">
        <label htmlFor="category-optional" className="label">Category (optional)</label>
        <input id="category-optional" type="text" value={mutation.category || ""}
          onChange={handleCategoryChange} className="input" placeholder="Optional" />
      </div>
      <BidirectionalCheckbox checked={mutation.bidirectional || false} onChange={handleBidirChange} />
    </>
  );
}

// ---------------------------------------------------------------------------
// CreateRelationshipFields
// ---------------------------------------------------------------------------

interface CreateRelationshipFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: TagValue) => void;
  readonly entityRefs: EntityRefOption[];
  readonly relationshipKindOptions: ReadonlyArray<RelationshipKindOption>;
}

export function CreateRelationshipFields({
  mutation, update, entityRefs, relationshipKindOptions,
}: CreateRelationshipFieldsProps) {
  const handleKindChange = useCallback((v: string | undefined) => update("kind", v), [update]);
  const handleSrcChange = useCallback((v: string | undefined) => update("src", v), [update]);
  const handleDstChange = useCallback((v: string | undefined) => update("dst", v), [update]);

  return (
    <>
      <ReferenceDropdown label="Relationship Kind" value={mutation.kind || ""}
        onChange={handleKindChange} options={relationshipKindOptions} placeholder="Select relationship..." />
      <ReferenceDropdown label="Source" value={mutation.src || ""}
        onChange={handleSrcChange} options={entityRefs} placeholder="Select source..." />
      <ReferenceDropdown label="Destination" value={mutation.dst || ""}
        onChange={handleDstChange} options={entityRefs} placeholder="Select destination..." />
      <CreateRelExtras mutation={mutation} update={update} />
    </>
  );
}

// ---------------------------------------------------------------------------
// AdjustRelStrengthFields
// ---------------------------------------------------------------------------

interface AdjustRelStrengthFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: TagValue) => void;
  readonly entityRefs: EntityRefOption[];
  readonly relationshipKindOptions: ReadonlyArray<RelationshipKindOption>;
}

export function AdjustRelStrengthFields({
  mutation,
  update,
  entityRefs,
  relationshipKindOptions,
}: AdjustRelStrengthFieldsProps) {
  const handleKindChange = useCallback(
    (v: string | undefined) => update("kind", v),
    [update],
  );
  const handleSrcChange = useCallback(
    (v: string | undefined) => update("src", v),
    [update],
  );
  const handleDstChange = useCallback(
    (v: string | undefined) => update("dst", v),
    [update],
  );
  const handleDeltaChange = useCallback(
    (v: number | undefined) => update("delta", v ?? 0),
    [update],
  );
  const handleBidirChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      update("bidirectional", e.target.checked || undefined),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Relationship Kind"
        value={mutation.kind || ""}
        onChange={handleKindChange}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="Source"
        value={mutation.src || ""}
        onChange={handleSrcChange}
        options={entityRefs}
        placeholder="Select source..."
      />
      <ReferenceDropdown
        label="Destination"
        value={mutation.dst || ""}
        onChange={handleDstChange}
        options={entityRefs}
        placeholder="Select destination..."
      />
      <div className="form-group">
        <label className="label">
          Delta
          <NumberInput value={mutation.delta} onChange={handleDeltaChange} />
        </label>
      </div>
      <BidirectionalCheckbox
        checked={mutation.bidirectional || false}
        onChange={handleBidirChange}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ArchiveRelFields
// ---------------------------------------------------------------------------

interface ArchiveRelFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: string | undefined) => void;
  readonly entityRefs: EntityRefOption[];
  readonly relationshipKindOptions: ReadonlyArray<RelationshipKindOption>;
}

export function ArchiveRelFields({
  mutation,
  update,
  entityRefs,
  relationshipKindOptions,
}: ArchiveRelFieldsProps) {
  const handleEntityChange = useCallback(
    (v: string | undefined) => update("entity", v),
    [update],
  );
  const handleRelKindChange = useCallback(
    (v: string | undefined) => update("relationshipKind", v),
    [update],
  );
  const handleWithChange = useCallback(
    (v: string | undefined) => update("with", v),
    [update],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) => update("direction", v),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity"
        value={mutation.entity || ""}
        onChange={handleEntityChange}
        options={entityRefs}
        placeholder="Select entity..."
      />
      <ReferenceDropdown
        label="Relationship Kind"
        value={mutation.relationshipKind || ""}
        onChange={handleRelKindChange}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="With Entity"
        value={mutation.with || ""}
        onChange={handleWithChange}
        options={entityRefs}
        placeholder="Select entity..."
      />
      <ReferenceDropdown
        label="Direction"
        value={mutation.direction || "both"}
        onChange={handleDirectionChange}
        options={DIRECTION_OPTIONS}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ArchiveAllRelFields
// ---------------------------------------------------------------------------

interface ArchiveAllRelFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: string | undefined) => void;
  readonly entityRefs: EntityRefOption[];
  readonly relationshipKindOptions: ReadonlyArray<RelationshipKindOption>;
}

export function ArchiveAllRelFields({
  mutation,
  update,
  entityRefs,
  relationshipKindOptions,
}: ArchiveAllRelFieldsProps) {
  const handleEntityChange = useCallback(
    (v: string | undefined) => update("entity", v),
    [update],
  );
  const handleRelKindChange = useCallback(
    (v: string | undefined) => update("relationshipKind", v),
    [update],
  );
  const handleDirectionChange = useCallback(
    (v: string | undefined) => update("direction", v),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity"
        value={mutation.entity || ""}
        onChange={handleEntityChange}
        options={entityRefs}
        placeholder="Select entity..."
      />
      <ReferenceDropdown
        label="Relationship Kind"
        value={mutation.relationshipKind || ""}
        onChange={handleRelKindChange}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="Direction"
        value={mutation.direction || "both"}
        onChange={handleDirectionChange}
        options={DIRECTION_OPTIONS}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// TransferRelFields
// ---------------------------------------------------------------------------

interface TransferRelFieldsProps {
  readonly mutation: Mutation;
  readonly update: (field: string, value: string | undefined) => void;
  readonly entityRefs: EntityRefOption[];
  readonly relationshipKindOptions: ReadonlyArray<RelationshipKindOption>;
}

export function TransferRelFields({
  mutation,
  update,
  entityRefs,
  relationshipKindOptions,
}: TransferRelFieldsProps) {
  const handleEntityChange = useCallback(
    (v: string | undefined) => update("entity", v),
    [update],
  );
  const handleRelKindChange = useCallback(
    (v: string | undefined) => update("relationshipKind", v),
    [update],
  );
  const handleFromChange = useCallback(
    (v: string | undefined) => update("from", v),
    [update],
  );
  const handleToChange = useCallback(
    (v: string | undefined) => update("to", v),
    [update],
  );

  return (
    <>
      <ReferenceDropdown
        label="Entity"
        value={mutation.entity || ""}
        onChange={handleEntityChange}
        options={entityRefs}
        placeholder="Select entity..."
      />
      <ReferenceDropdown
        label="Relationship Kind"
        value={mutation.relationshipKind || ""}
        onChange={handleRelKindChange}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="From"
        value={mutation.from || ""}
        onChange={handleFromChange}
        options={entityRefs}
        placeholder="Select source..."
      />
      <ReferenceDropdown
        label="To"
        value={mutation.to || ""}
        onChange={handleToChange}
        options={entityRefs}
        placeholder="Select destination..."
      />
    </>
  );
}

export default CreateRelationshipFields;
