/**
 * Tag and attribute filter field sub-components for SelectionFilterCard.
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown, PROMINENCE_LEVELS } from "../../shared";
import TagSelector from "@the-canonry/shared-components/TagSelector";
import type {
  SelectionFilter,
  TagDefinition,
  DropdownOption,
} from "./selectionFilterTypes";

type UpdateField<V = unknown> = (field: string, value: V) => void;

// ---------------------------------------------------------------------------
// SingleTagFields — has_tag / lacks_tag
// ---------------------------------------------------------------------------

interface SingleTagFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string | undefined>;
  readonly tagRegistry: readonly TagDefinition[];
}

export function SingleTagFields({ filter, onUpdateField, tagRegistry }: SingleTagFieldsProps) {
  const tagValue = useMemo(() => (filter.tag ? [filter.tag] : []), [filter.tag]);
  const handleTagChange = useCallback(
    (v: string[]) => onUpdateField("tag", v[0] || ""),
    [onUpdateField],
  );
  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onUpdateField("value", e.target.value || undefined),
    [onUpdateField],
  );

  return (
    <div className="filter-fields">
      <div className="sfc-flex-field-wide">
        <label className="label label-small">Tag
          <TagSelector
            value={tagValue}
            onChange={handleTagChange}
            tagRegistry={tagRegistry as TagDefinition[]}
            placeholder="Select tag..."
            singleSelect
          />
        </label>
      </div>
      <div className="sfc-flex-field-wide">
        <label htmlFor="value-optional" className="label label-small">Value (optional)</label>
        <input
          id="value-optional"
          type="text"
          value={filter.value ?? ""}
          onChange={handleValueChange}
          className="input input-compact"
          placeholder="Any value"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MultiTagFields — has_tags / has_any_tag / lacks_any_tag
// ---------------------------------------------------------------------------

interface MultiTagFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string[]>;
  readonly tagRegistry: readonly TagDefinition[];
  readonly label: string;
}

export function MultiTagFields({ filter, onUpdateField, tagRegistry, label }: MultiTagFieldsProps) {
  const tagValue = useMemo(() => [...(filter.tags || [])], [filter.tags]);
  const handleChange = useCallback(
    (v: string[]) => onUpdateField("tags", v),
    [onUpdateField],
  );

  return (
    <div>
      <label className="label label-small">{label}</label>
      <TagSelector
        value={tagValue}
        onChange={handleChange}
        tagRegistry={tagRegistry as TagDefinition[]}
        placeholder="Select tags..."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CultureFields — has_culture
// ---------------------------------------------------------------------------

interface CultureFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string | undefined>;
  readonly cultureOptions: readonly DropdownOption[];
}

export function CultureFields({ filter, onUpdateField, cultureOptions }: CultureFieldsProps) {
  const handleChange = useCallback(
    (v: string | undefined) => onUpdateField("culture", v),
    [onUpdateField],
  );

  return (
    <div>
      <label className="label label-small">Culture
        <ReferenceDropdown
          value={filter.culture || ""}
          onChange={handleChange}
          options={cultureOptions as DropdownOption[]}
          placeholder="Select culture..."
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MatchesCultureFields — matches_culture
// ---------------------------------------------------------------------------

interface MatchesCultureFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string | undefined>;
  readonly refOptions: readonly DropdownOption[];
}

export function MatchesCultureFields({ filter, onUpdateField, refOptions }: MatchesCultureFieldsProps) {
  const handleChange = useCallback(
    (v: string | undefined) => onUpdateField("with", v),
    [onUpdateField],
  );

  return (
    <div>
      <label className="label label-small">Same Culture As
        <ReferenceDropdown
          value={filter.with || ""}
          onChange={handleChange}
          options={refOptions as DropdownOption[]}
          placeholder="Select variable..."
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusFields — has_status
// ---------------------------------------------------------------------------

interface StatusFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string>;
}

export function StatusFields({ filter, onUpdateField }: StatusFieldsProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdateField("status", e.target.value),
    [onUpdateField],
  );

  return (
    <div>
      <label htmlFor="status" className="label label-small">Status</label>
      <input
        id="status"
        type="text"
        value={filter.status || ""}
        onChange={handleChange}
        className="input input-compact"
        placeholder="e.g., active, historical"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProminenceFields — has_prominence
// ---------------------------------------------------------------------------

interface ProminenceFieldsProps {
  readonly filter: SelectionFilter;
  readonly onUpdateField: UpdateField<string | undefined>;
}

export function ProminenceFields({ filter, onUpdateField }: ProminenceFieldsProps) {
  const prominenceOptions = useMemo(
    () => PROMINENCE_LEVELS.map((p) => ({ value: p.value, label: p.label })),
    [],
  );
  const handleChange = useCallback(
    (v: string | undefined) => onUpdateField("minProminence", v),
    [onUpdateField],
  );

  return (
    <div>
      <label className="label label-small">Minimum Prominence
        <ReferenceDropdown
          value={filter.minProminence || ""}
          onChange={handleChange}
          options={prominenceOptions}
          placeholder="Select prominence..."
        />
      </label>
    </div>
  );
}
