/**
 * SelectionRuleEditor - Edit a SelectionRule
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown, ChipSelect, NumberInput, PROMINENCE_LEVELS } from "./index";
import { PICK_STRATEGIES } from "../generators/constants";
import { SelectionFiltersEditor } from "../generators/filters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityKindDef {
  kind: string;
  description?: string;
  subtypes?: Array<{ id: string; name?: string }>;
}

interface RelationshipKindDef {
  kind: string;
  description?: string;
}

interface Schema {
  entityKinds?: EntityKindDef[];
  relationshipKinds?: RelationshipKindDef[];
}

interface SelectionFilter {
  type: string;
  [key: string]: unknown;
}

interface SelectionRule {
  strategy?: string;
  pickStrategy?: string;
  maxResults?: number;
  kind?: string;
  subtypes?: string[];
  excludeSubtypes?: string[];
  status?: string;
  notStatus?: string;
  subtypePreferences?: string[];
  relationshipKind?: string;
  direction?: string;
  mustHave?: boolean;
  referenceEntity?: string;
  maxDistance?: number;
  minProminence?: string;
  filters?: SelectionFilter[];
}

interface DropdownOption {
  value: string;
  label: string;
}

interface SelectionRuleEditorProps {
  readonly value: SelectionRule | undefined;
  readonly onChange: (rule: SelectionRule) => void;
  readonly schema: Schema;
  readonly availableRefs?: string[];
  readonly showPickStrategy?: boolean;
  readonly showMaxResults?: boolean;
  readonly showFilters?: boolean;
  readonly allowAnyKind?: boolean;
  readonly showExcludeSubtypes?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRATEGY_OPTIONS: ReadonlyArray<DropdownOption> = [
  { value: "by_kind", label: "By Entity Kind" },
  { value: "by_preference_order", label: "By Subtype Preference" },
  { value: "by_relationship", label: "By Relationship Presence" },
  { value: "by_proximity", label: "By Proximity" },
  { value: "by_prominence", label: "By Prominence" },
];

const DIRECTION_OPTIONS: ReadonlyArray<DropdownOption> = [
  { value: "both", label: "Both" },
  { value: "src", label: "Source (outgoing)" },
  { value: "dst", label: "Destination (incoming)" },
];

const PROMINENCE_DROPDOWN_OPTIONS: ReadonlyArray<DropdownOption> = PROMINENCE_LEVELS.map(
  (p) => ({ value: p.value, label: p.label }),
);

// ---------------------------------------------------------------------------
// StrategySection
// ---------------------------------------------------------------------------

interface StrategySectionProps {
  readonly selection: SelectionRule;
  readonly updateSelection: (field: string, value: unknown) => void;
  readonly showPickStrategy: boolean;
  readonly showMaxResults: boolean;
}

function StrategySection({
  selection,
  updateSelection,
  showPickStrategy,
  showMaxResults,
}: StrategySectionProps) {
  const handleStrategyChange = useCallback(
    (v: string | undefined) => updateSelection("strategy", v),
    [updateSelection],
  );

  const handlePickStrategyChange = useCallback(
    (v: string | undefined) => updateSelection("pickStrategy", v),
    [updateSelection],
  );

  const handleMaxResultsChange = useCallback(
    (v: number | undefined) => updateSelection("maxResults", v),
    [updateSelection],
  );

  return (
    <div className="form-grid">
      <ReferenceDropdown
        label="Selection Strategy"
        value={selection.strategy || "by_kind"}
        onChange={handleStrategyChange}
        options={STRATEGY_OPTIONS}
      />

      {showPickStrategy && (
        <ReferenceDropdown
          label="Pick Strategy"
          value={selection.pickStrategy || "random"}
          onChange={handlePickStrategyChange}
          options={PICK_STRATEGIES}
        />
      )}

      {showMaxResults && (
        <div className="form-group">
          <label className="label">Max Results
          <NumberInput
            value={selection.maxResults}
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
  );
}

// ---------------------------------------------------------------------------
// KindAndStatusSection
// ---------------------------------------------------------------------------

interface KindAndStatusSectionProps {
  readonly selection: SelectionRule;
  readonly updateSelection: (field: string, value: unknown) => void;
  readonly updateSelectionMultiple: (updates: Partial<SelectionRule>) => void;
  readonly entityKindOptions: ReadonlyArray<DropdownOption>;
}

function KindAndStatusSection({
  selection,
  updateSelection,
  updateSelectionMultiple,
  entityKindOptions,
}: KindAndStatusSectionProps) {
  const handleKindChange = useCallback(
    (v: string | undefined) =>
      updateSelectionMultiple({
        kind: v || undefined,
        subtypes: undefined,
        excludeSubtypes: undefined,
      }),
    [updateSelectionMultiple],
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateSelection("status", e.target.value || undefined),
    [updateSelection],
  );

  const handleNotStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateSelection("notStatus", e.target.value || undefined),
    [updateSelection],
  );

  return (
    <div className="form-grid mt-xl">
      <ReferenceDropdown
        label="Entity Kind"
        value={selection.kind || ""}
        onChange={handleKindChange}
        options={entityKindOptions}
        placeholder="Any kind"
      />
      <div className="form-group">
        <label htmlFor="status-optional" className="label">Status (optional)</label>
        <input
          id="status-optional"
          type="text"
          value={selection.status || ""}
          onChange={handleStatusChange}
          className="input"
          placeholder="e.g., active"
        />
      </div>
      <div className="form-group">
        <label htmlFor="not-status-optional" className="label">Not Status (optional)</label>
        <input
          id="not-status-optional"
          type="text"
          value={selection.notStatus || ""}
          onChange={handleNotStatusChange}
          className="input"
          placeholder="e.g., dead"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ByRelationshipFields
// ---------------------------------------------------------------------------

interface ByRelationshipFieldsProps {
  readonly selection: SelectionRule;
  readonly updateSelection: (field: string, value: unknown) => void;
  readonly relationshipKindOptions: ReadonlyArray<DropdownOption>;
}

function ByRelationshipFields({
  selection,
  updateSelection,
  relationshipKindOptions,
}: ByRelationshipFieldsProps) {
  const handleRelKindChange = useCallback(
    (v: string | undefined) => updateSelection("relationshipKind", v),
    [updateSelection],
  );

  const handleDirectionChange = useCallback(
    (v: string | undefined) => updateSelection("direction", v),
    [updateSelection],
  );

  const handleMustHaveChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      updateSelection("mustHave", e.target.checked),
    [updateSelection],
  );

  return (
    <div className="form-grid mt-xl">
      <ReferenceDropdown
        label="Relationship Kind"
        value={selection.relationshipKind || ""}
        onChange={handleRelKindChange}
        options={relationshipKindOptions}
        placeholder="Select relationship..."
      />
      <ReferenceDropdown
        label="Direction"
        value={selection.direction || "both"}
        onChange={handleDirectionChange}
        options={DIRECTION_OPTIONS}
      />
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={selection.mustHave !== false}
            onChange={handleMustHaveChange}
            className="checkbox"
          />
          Must Have Relationship
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ByProximityFields
// ---------------------------------------------------------------------------

interface ByProximityFieldsProps {
  readonly selection: SelectionRule;
  readonly updateSelection: (field: string, value: unknown) => void;
  readonly referenceOptions: ReadonlyArray<DropdownOption>;
}

function ByProximityFields({
  selection,
  updateSelection,
  referenceOptions,
}: ByProximityFieldsProps) {
  const handleRefEntityChange = useCallback(
    (v: string | undefined) => updateSelection("referenceEntity", v || undefined),
    [updateSelection],
  );

  const handleMaxDistanceChange = useCallback(
    (v: number | undefined) => updateSelection("maxDistance", v),
    [updateSelection],
  );

  return (
    <div className="form-grid mt-xl">
      <ReferenceDropdown
        label="Reference Entity"
        value={selection.referenceEntity || ""}
        onChange={handleRefEntityChange}
        options={referenceOptions}
        placeholder={referenceOptions[0]?.value || ""}
      />
      <div className="form-group">
        <label className="label">Max Distance
        <NumberInput
          value={selection.maxDistance}
          onChange={handleMaxDistanceChange}
          min={0}
          allowEmpty
          placeholder="50"
        />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelectionRuleEditor
// ---------------------------------------------------------------------------

export function SelectionRuleEditor({
  value,
  onChange,
  schema,
  availableRefs = [],
  showPickStrategy = true,
  showMaxResults = true,
  showFilters = true,
  allowAnyKind = false,
  showExcludeSubtypes = false,
}: SelectionRuleEditorProps) {
  const selection = value || { strategy: "by_kind" };

  const baseKindOptions = useMemo(
    () =>
      (schema?.entityKinds || []).map((ek) => ({
        value: ek.kind,
        label: ek.description || ek.kind,
      })),
    [schema?.entityKinds],
  );

  const entityKindOptions = useMemo(
    () =>
      allowAnyKind
        ? [{ value: "any", label: "Any kind" }, ...baseKindOptions]
        : baseKindOptions,
    [allowAnyKind, baseKindOptions],
  );

  const relationshipKindOptions = useMemo(
    () =>
      (schema?.relationshipKinds || []).map((rk) => ({
        value: rk.kind,
        label: rk.description || rk.kind,
      })),
    [schema?.relationshipKinds],
  );

  const getSubtypeOptions = useCallback(
    (kind: string): DropdownOption[] => {
      const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
      if (!ek?.subtypes) return [];
      return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
    },
    [schema?.entityKinds],
  );

  const updateSelection = useCallback(
    (field: string, fieldValue: unknown) => {
      onChange({ ...selection, [field]: fieldValue });
    },
    [onChange, selection],
  );

  const updateSelectionMultiple = useCallback(
    (updates: Partial<SelectionRule>) => {
      onChange({ ...selection, ...updates });
    },
    [onChange, selection],
  );

  const referenceOptions = useMemo(
    () =>
      (availableRefs.length > 0 ? availableRefs : ["$target"]).map((ref) => ({
        value: ref,
        label: ref,
      })),
    [availableRefs],
  );

  const subtypeOptions = useMemo(
    () => (selection.kind ? getSubtypeOptions(selection.kind) : []),
    [selection.kind, getSubtypeOptions],
  );

  const handleSubtypeChange = useCallback(
    (v: string[]) => updateSelection("subtypes", v.length > 0 ? v : undefined),
    [updateSelection],
  );

  const handleExcludeSubtypeChange = useCallback(
    (v: string[]) => updateSelection("excludeSubtypes", v.length > 0 ? v : undefined),
    [updateSelection],
  );

  const handleSubtypePrefChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const prefs = e.target.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      updateSelection("subtypePreferences", prefs.length > 0 ? prefs : undefined);
    },
    [updateSelection],
  );

  const handleMinProminenceChange = useCallback(
    (v: string | undefined) => updateSelection("minProminence", v || undefined),
    [updateSelection],
  );

  const handleFiltersChange = useCallback(
    (filters: SelectionFilter[]) =>
      updateSelection("filters", filters.length > 0 ? filters : undefined),
    [updateSelection],
  );

  return (
    <div>
      <StrategySection
        selection={selection}
        updateSelection={updateSelection}
        showPickStrategy={showPickStrategy}
        showMaxResults={showMaxResults}
      />

      <KindAndStatusSection
        selection={selection}
        updateSelection={updateSelection}
        updateSelectionMultiple={updateSelectionMultiple}
        entityKindOptions={entityKindOptions}
      />

      {selection.kind && selection.kind !== "any" && (
        <div className="mt-xl">
          <ChipSelect
            label="Subtypes (optional)"
            value={selection.subtypes || []}
            onChange={handleSubtypeChange}
            options={subtypeOptions}
            placeholder="Any subtype"
          />
        </div>
      )}

      {selection.kind && selection.kind !== "any" && showExcludeSubtypes && (
        <div className="mt-xl">
          <ChipSelect
            label="Exclude Subtypes (optional)"
            value={selection.excludeSubtypes || []}
            onChange={handleExcludeSubtypeChange}
            options={subtypeOptions}
            placeholder="None"
          />
        </div>
      )}

      {selection.strategy === "by_preference_order" && (
        <div className="mt-xl">
          <label htmlFor="subtype-preferences-comma-separated" className="label">
            Subtype Preferences (comma-separated)
          </label>
          <input
            id="subtype-preferences-comma-separated"
            type="text"
            value={(selection.subtypePreferences || []).join(", ")}
            onChange={handleSubtypePrefChange}
            className="input"
            placeholder="e.g., noble, commoner"
          />
        </div>
      )}

      {selection.strategy === "by_relationship" && (
        <ByRelationshipFields
          selection={selection}
          updateSelection={updateSelection}
          relationshipKindOptions={relationshipKindOptions}
        />
      )}

      {selection.strategy === "by_proximity" && (
        <ByProximityFields
          selection={selection}
          updateSelection={updateSelection}
          referenceOptions={referenceOptions}
        />
      )}

      {selection.strategy === "by_prominence" && (
        <div className="mt-xl">
          <ReferenceDropdown
            label="Minimum Prominence"
            value={selection.minProminence || ""}
            onChange={handleMinProminenceChange}
            options={PROMINENCE_DROPDOWN_OPTIONS}
            placeholder="Any"
          />
        </div>
      )}

      {showFilters && (
        <div className="mt-2xl">
          <span className="label">Selection Filters</span>
          <div className="info-box-text mb-lg text-sm">
            Optional filters to narrow down which entities can be selected. All filters must pass.
          </div>
          <SelectionFiltersEditor
            filters={selection.filters}
            onChange={handleFiltersChange}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

export default SelectionRuleEditor;
