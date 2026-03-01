/**
 * FilterFields - Status, subtype, and selection filter inputs
 * for VariableSelectionEditor.
 */

import React, { useCallback } from "react";
import { ReferenceDropdown, ChipSelect } from "../index";
import { SelectionFiltersEditor } from "../../generators/filters";
import type { DropdownOption, SelectConfig, SelectionFilter } from "./types";

interface FilterFieldsProps {
  readonly select: SelectConfig;
  readonly entityKindOptions: DropdownOption[];
  readonly subtypeOptions: DropdownOption[];
  readonly availableRefs: string[];
  readonly schema: { entityKinds?: unknown[]; relationshipKinds?: unknown[] } | undefined;
  readonly showEntityKindFilter: boolean;
  readonly allowPreferFilters: boolean;
  readonly onUpdateSelect: (field: string, value: unknown) => void;
  readonly onUpdateSelectMultiple: (updates: Partial<SelectConfig>) => void;
}

export function FilterFields({
  select,
  entityKindOptions,
  subtypeOptions,
  availableRefs,
  schema,
  showEntityKindFilter,
  allowPreferFilters,
  onUpdateSelect,
  onUpdateSelectMultiple,
}: FilterFieldsProps) {
  const handleKindChange = useCallback(
    (v: string | undefined) =>
      onUpdateSelectMultiple({ kind: v || undefined, subtypes: undefined }),
    [onUpdateSelectMultiple],
  );

  const handleSubtypesChange = useCallback(
    (v: string[]) =>
      onUpdateSelect("subtypes", v.length > 0 ? v : undefined),
    [onUpdateSelect],
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onUpdateSelect("status", e.target.value || undefined),
    [onUpdateSelect],
  );

  const handleNotStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onUpdateSelect("notStatus", e.target.value || undefined),
    [onUpdateSelect],
  );

  const handleFiltersChange = useCallback(
    (filters: SelectionFilter[]) =>
      onUpdateSelect("filters", filters.length > 0 ? filters : undefined),
    [onUpdateSelect],
  );

  const handlePreferFiltersChange = useCallback(
    (filters: SelectionFilter[]) =>
      onUpdateSelect("preferFilters", filters.length > 0 ? filters : undefined),
    [onUpdateSelect],
  );

  const subtypes = select.subtypes ?? EMPTY_ARRAY;

  return (
    <>
      {showEntityKindFilter && (
        <div className="mt-xl">
          <ReferenceDropdown
            label="Filter by Entity Kind (optional)"
            value={select.kind || ""}
            onChange={handleKindChange}
            options={entityKindOptions}
            placeholder="Any kind"
          />
        </div>
      )}

      {select.kind && (
        <div className="mt-xl">
          <ChipSelect
            label="Subtypes (optional)"
            value={subtypes}
            onChange={handleSubtypesChange}
            options={subtypeOptions}
            placeholder="Any subtype"
          />
        </div>
      )}

      <div className="mt-xl">
        <label htmlFor="status-filter-optional" className="label">
          Status Filter (optional)
        </label>
        <input
          id="status-filter-optional"
          type="text"
          value={select.status || ""}
          onChange={handleStatusChange}
          className="input"
          placeholder="e.g., active"
        />
      </div>

      <div className="mt-xl">
        <label htmlFor="not-status-optional" className="label">
          Not Status (optional)
        </label>
        <input
          id="not-status-optional"
          type="text"
          value={select.notStatus || ""}
          onChange={handleNotStatusChange}
          className="input"
          placeholder="e.g., dead"
        />
      </div>

      <div className="mt-2xl">
        <span className="label">Selection Filters</span>
        <div className="info-box-text mb-lg text-sm">
          Optional filters to narrow down which entities can be selected. All
          filters must pass.
        </div>
        <SelectionFiltersEditor
          filters={select.filters}
          onChange={handleFiltersChange}
          schema={schema}
          availableRefs={availableRefs}
        />
      </div>

      {allowPreferFilters && (
        <div className="mt-2xl">
          <span className="label">Prefer Filters (optional)</span>
          <div className="info-box-text mb-lg text-sm">
            Preferred matches. If no entities match these filters, selection
            falls back to all matches.
          </div>
          <SelectionFiltersEditor
            filters={select.preferFilters}
            onChange={handlePreferFiltersChange}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </>
  );
}

const EMPTY_ARRAY: string[] = [];
