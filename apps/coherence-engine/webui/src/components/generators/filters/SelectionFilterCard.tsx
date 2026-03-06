/**
 * SelectionFilterCard - Display and edit a single selection filter
 */

import React, { useCallback, useMemo } from "react";
import { FILTER_TYPES } from "../constants";
import { useExpandBoolean, expandableProps } from "../../shared";
import { FilterFieldsSwitch } from "./SelectionFilterFields";
import type {
  SelectionFilter,
  SelectionFilterSchema,
  FilterTypeConfig,
  TagDefinition,
  DropdownOption,
} from "./selectionFilterTypes";
import { FALLBACK_TYPE_CONFIG, getFilterSummary } from "./selectionFilterTypes";
import "./SelectionFilterCard.css";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SelectionFilterCardProps {
  readonly filter: SelectionFilter;
  readonly onChange: (filter: SelectionFilter) => void;
  readonly onRemove: () => void;
  readonly schema?: SelectionFilterSchema;
  readonly availableRefs?: readonly string[];
}

// ---------------------------------------------------------------------------
// Hook: derive memoised option lists from schema + refs
// ---------------------------------------------------------------------------

function useFilterOptions(
  schema?: SelectionFilterSchema,
  availableRefs?: readonly string[],
) {
  const tagRegistry = useMemo<readonly TagDefinition[]>(
    () => schema?.tagRegistry || [],
    [schema?.tagRegistry],
  );

  const relationshipKindOptions = useMemo<readonly DropdownOption[]>(
    () =>
      (schema?.relationshipKinds || []).map((rk) => ({
        value: rk.kind,
        label: rk.description || rk.kind,
      })),
    [schema?.relationshipKinds],
  );

  const refOptions = useMemo<readonly DropdownOption[]>(
    () => (availableRefs || []).map((ref) => ({ value: ref, label: ref })),
    [availableRefs],
  );

  const cultureOptions = useMemo<readonly DropdownOption[]>(
    () =>
      (schema?.cultures || []).map((c) => ({
        value: c.id,
        label: c.name || c.id,
      })),
    [schema?.cultures],
  );

  return { tagRegistry, relationshipKindOptions, refOptions, cultureOptions };
}

// ---------------------------------------------------------------------------
// SelectionFilterCard
// ---------------------------------------------------------------------------

export function SelectionFilterCard({
  filter,
  onChange,
  onRemove,
  schema,
  availableRefs,
}: SelectionFilterCardProps) {
  const { expanded, toggle } = useExpandBoolean();
  const options = useFilterOptions(schema, availableRefs);

  const typeConfig: FilterTypeConfig =
    (FILTER_TYPES as Record<string, FilterTypeConfig>)[filter.type] || FALLBACK_TYPE_CONFIG;

  const summary = useMemo(() => getFilterSummary(filter), [filter]);

  const updateFilter = useCallback(
    (field: string, value: unknown) => onChange({ ...filter, [field]: value }),
    [filter, onChange],
  );

  const handleToggle = useCallback(() => toggle(), [toggle]);
  const headerExpandProps = useMemo(() => expandableProps(handleToggle), [handleToggle]);

  const headerStyle = useMemo(
    () => ({ "--sfc-mb": expanded ? undefined : "0", marginBottom: "var(--sfc-mb)" } as React.CSSProperties),
    [expanded],
  );
  const iconStyle = useMemo(
    () => ({ "--sfc-icon-bg": `${typeConfig.color}20`, backgroundColor: "var(--sfc-icon-bg)" } as React.CSSProperties),
    [typeConfig.color],
  );

  return (
    <div className="condition-card">
      <div className="condition-card-header" style={headerStyle}>{/* eslint-disable-line local/no-inline-styles -- dynamic margin */}
        <div className="condition-card-type">
          <span className="condition-card-icon" style={iconStyle}>{/* eslint-disable-line local/no-inline-styles -- dynamic color */}
            {typeConfig.icon}
          </span>
          <div>
            <div className="condition-card-label">{typeConfig.label}</div>
            {summary && <div className="condition-card-summary">{summary}</div>}
          </div>
        </div>
        <div className="condition-card-actions">
          <button className="btn-icon" {...headerExpandProps}>{expanded ? "^" : "v"}</button>
          <button onClick={onRemove} className="btn-icon btn-icon-danger">x</button>
        </div>
      </div>
      {expanded && (
        <div className="condition-card-fields">
          <FilterFieldsSwitch
            filter={filter}
            onUpdateField={updateFilter}
            tagRegistry={options.tagRegistry}
            relationshipKindOptions={options.relationshipKindOptions}
            refOptions={options.refOptions}
            cultureOptions={options.cultureOptions}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

export default SelectionFilterCard;
