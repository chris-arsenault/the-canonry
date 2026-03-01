/**
 * VariableSelectionEditor - Edit a VariableSelectionRule
 *
 * Decomposed into sub-components in ./variable-selection/:
 *   - PathStepCard      - single path step card
 *   - PathModeFields    - multi-hop path step list
 *   - RelatedModeFields - single-hop related entity fields
 *   - FilterFields      - status, subtype, and selection filters
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown, NumberInput } from "./index";
import { VARIABLE_PICK_STRATEGIES } from "../generators/constants";
import { PathModeFields } from "./variable-selection/PathModeFields";
import { RelatedModeFields } from "./variable-selection/RelatedModeFields";
import { FilterFields } from "./variable-selection/FilterFields";
import {
  getSelectionMode,
  SELECT_FROM_OPTIONS,
} from "./variable-selection/types";
import type {
  DropdownOption,
  FromSpec,
  PathSpec,
  PathStep,
  SelectConfig,
  Schema,
} from "./variable-selection/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VariableSelectionEditorProps {
  readonly value?: SelectConfig;
  readonly onChange: (value: SelectConfig) => void;
  readonly schema?: Schema;
  readonly availableRefs?: string[];
  readonly showPickStrategy?: boolean;
  readonly showMaxResults?: boolean;
  readonly allowPreferFilters?: boolean;
}

// Stable empty array to avoid new-array-as-prop warnings
const EMPTY_REFS: string[] = [];

// ---------------------------------------------------------------------------
// useSelectionCallbacks - extracted hook for all update callbacks
// ---------------------------------------------------------------------------

function useSelectionCallbacks(
  select: SelectConfig,
  onChange: (value: SelectConfig) => void,
  availableRefs: string[],
  pathSpec: PathSpec | null,
  fromSpec: FromSpec | null,
) {
  const updateSelect = useCallback(
    (field: string, fieldValue: unknown) => {
      onChange({ ...select, [field]: fieldValue });
    },
    [onChange, select],
  );

  const updateSelectMultiple = useCallback(
    (updates: Partial<SelectConfig>) => {
      onChange({ ...select, ...updates });
    },
    [onChange, select],
  );

  const setMode = useCallback(
    (mode: string) => {
      if (mode === "graph") {
        onChange({ ...select, from: "graph" });
        return;
      }
      if (mode === "path") {
        const startRef = availableRefs[0] ?? "$self";
        onChange({
          ...select,
          from: { path: [{ from: startRef, via: "", direction: "both" }] },
        });
        return;
      }
      const relatedTo = availableRefs[0] ?? "$target";
      onChange({
        ...select,
        from: { relatedTo, relationshipKind: "", direction: "both" },
      });
    },
    [onChange, select, availableRefs],
  );

  const updatePathStep = useCallback(
    (index: number, step: PathStep) => {
      const path = [...(pathSpec?.path ?? [])];
      path[index] = step;
      updateSelect("from", { path });
    },
    [pathSpec, updateSelect],
  );

  const addPathStep = useCallback(() => {
    const path = [...(pathSpec?.path ?? [])];
    path.push({ via: "", direction: "both" });
    updateSelect("from", { path });
  }, [pathSpec, updateSelect]);

  const removePathStep = useCallback(
    (index: number) => {
      const path = (pathSpec?.path ?? []).filter(
        (_: PathStep, i: number) => i !== index,
      );
      if (path.length === 0) {
        setMode("graph");
      } else {
        updateSelect("from", { path });
      }
    },
    [pathSpec, setMode, updateSelect],
  );

  const updateFrom = useCallback(
    (field: string, fieldValue: string) => {
      const nextFrom: FromSpec = {
        ...(fromSpec ?? {
          relatedTo: availableRefs[0] ?? "$target",
          relationshipKind: "",
          direction: "both",
        }),
        [field]: fieldValue,
      };
      updateSelect("from", nextFrom);
    },
    [fromSpec, availableRefs, updateSelect],
  );

  return {
    updateSelect,
    updateSelectMultiple,
    setMode,
    updatePathStep,
    addPathStep,
    removePathStep,
    updateFrom,
  };
}

// ---------------------------------------------------------------------------
// VariableSelectionEditor
// ---------------------------------------------------------------------------

export function VariableSelectionEditor({
  value,
  onChange,
  schema,
  availableRefs = EMPTY_REFS,
  showPickStrategy = true,
  showMaxResults = true,
  allowPreferFilters = true,
}: VariableSelectionEditorProps) {
  const select = useMemo<SelectConfig>(() => value ?? {}, [value]);
  const selectionMode = getSelectionMode(select);
  const isRelatedMode = selectionMode === "related";
  const isPathMode = selectionMode === "path";
  const fromSpec = isRelatedMode ? (select.from as FromSpec) : null;
  const pathSpec = isPathMode ? (select.from as PathSpec) : null;

  const entityKindOptions = useMemo<DropdownOption[]>(
    () =>
      (schema?.entityKinds ?? []).map((ek) => ({
        value: ek.kind,
        label: ek.description ?? ek.kind,
      })),
    [schema?.entityKinds],
  );

  const relationshipKindOptions = useMemo<DropdownOption[]>(
    () =>
      (schema?.relationshipKinds ?? []).map((rk) => ({
        value: rk.kind,
        label: rk.description ?? rk.kind,
      })),
    [schema?.relationshipKinds],
  );

  const availableRefOptions = useMemo<DropdownOption[]>(
    () => availableRefs.map((r) => ({ value: r, label: r })),
    [availableRefs],
  );

  const subtypeOptions = useMemo<DropdownOption[]>(() => {
    if (!select.kind) return [];
    const ek = (schema?.entityKinds ?? []).find(
      (e) => e.kind === select.kind,
    );
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({
      value: st.id,
      label: st.name ?? st.id,
    }));
  }, [schema?.entityKinds, select.kind]);

  const {
    updateSelect,
    updateSelectMultiple,
    setMode,
    updatePathStep,
    addPathStep,
    removePathStep,
    updateFrom,
  } = useSelectionCallbacks(select, onChange, availableRefs, pathSpec, fromSpec);

  const handleModeChange = useCallback(
    (v: string | undefined) => setMode(v ?? "graph"),
    [setMode],
  );

  const handleKindChange = useCallback(
    (v: string | undefined) =>
      updateSelectMultiple({ kind: v || undefined, subtypes: undefined }),
    [updateSelectMultiple],
  );

  const handlePickStrategyChange = useCallback(
    (v: string | undefined) => updateSelect("pickStrategy", v || undefined),
    [updateSelect],
  );

  const handleMaxResultsChange = useCallback(
    (v: number | undefined) => updateSelect("maxResults", v),
    [updateSelect],
  );

  return (
    <div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Select From"
          value={selectionMode}
          onChange={handleModeChange}
          options={SELECT_FROM_OPTIONS}
        />

        {selectionMode === "graph" && (
          <ReferenceDropdown
            label="Entity Kind"
            value={select.kind || ""}
            onChange={handleKindChange}
            options={entityKindOptions}
            placeholder="Any kind"
          />
        )}

        {isRelatedMode && (
          <RelatedModeFields
            fromSpec={fromSpec}
            availableRefOptions={availableRefOptions}
            relationshipKindOptions={relationshipKindOptions}
            onUpdateFrom={updateFrom}
          />
        )}

        {isPathMode && (
          <div className="grid-col-full">
            <span className="label">Path Steps</span>
            <div className="info-box-text mb-lg text-sm">
              Multi-hop traversal from the starting entity through
              relationships.
            </div>
          </div>
        )}

        {showPickStrategy && (
          <ReferenceDropdown
            label="Pick Strategy"
            value={select.pickStrategy || ""}
            onChange={handlePickStrategyChange}
            options={VARIABLE_PICK_STRATEGIES}
            placeholder="Select..."
          />
        )}

        {showMaxResults && (
          <div className="form-group">
            <label className="label">
              Max Results
              <NumberInput
                value={select.maxResults}
                onChange={handleMaxResultsChange}
                min={1}
                integer
                allowEmpty
                placeholder="1"
              />
            </label>
          </div>
        )}
      </div>

      {isPathMode && (
        <PathModeFields
          pathSpec={pathSpec}
          availableRefOptions={availableRefOptions}
          relationshipKindOptions={relationshipKindOptions}
          entityKindOptions={entityKindOptions}
          onUpdatePathStep={updatePathStep}
          onRemovePathStep={removePathStep}
          onAddPathStep={addPathStep}
        />
      )}

      <FilterFields
        select={select}
        entityKindOptions={entityKindOptions}
        subtypeOptions={subtypeOptions}
        availableRefs={availableRefs}
        schema={schema}
        showEntityKindFilter={isRelatedMode || isPathMode}
        allowPreferFilters={allowPreferFilters}
        onUpdateSelect={updateSelect}
        onUpdateSelectMultiple={updateSelectMultiple}
      />
    </div>
  );
}

export default VariableSelectionEditor;
