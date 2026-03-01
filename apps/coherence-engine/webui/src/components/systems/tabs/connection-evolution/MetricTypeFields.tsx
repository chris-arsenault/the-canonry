/**
 * MetricTypeFields - Conditional fields based on metric type selection.
 */

import React, { useCallback } from "react";
import { ReferenceDropdown } from "../../../shared";
import type { MetricConfig, DropdownOption } from "./types";
import { SHARED_DIRECTION_OPTIONS } from "./types";

interface MetricRelKindsFieldProps {
  readonly relationshipKinds: string[] | undefined;
  readonly onUpdateMetric: (field: string, value: unknown) => void;
}

function MetricRelKindsField({
  relationshipKinds,
  onUpdateMetric,
}: MetricRelKindsFieldProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const kinds = e.target.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      onUpdateMetric("relationshipKinds", kinds.length > 0 ? kinds : undefined);
    },
    [onUpdateMetric],
  );

  return (
    <div className="form-group">
      <label htmlFor="filter-rel-kinds" className="label">
        Filter by Relationship Kinds (optional)
      </label>
      <input
        id="filter-rel-kinds"
        type="text"
        value={(relationshipKinds || []).join(", ")}
        onChange={handleChange}
        className="input"
        placeholder="Leave empty for all kinds"
      />
    </div>
  );
}

interface MetricSharedFieldsProps {
  readonly metric: MetricConfig | undefined;
  readonly onUpdateMetric: (field: string, value: unknown) => void;
  readonly relationshipKindOptions: readonly DropdownOption[];
}

function MetricSharedFields({
  metric,
  onUpdateMetric,
  relationshipKindOptions,
}: MetricSharedFieldsProps) {
  const handleSharedKindChange = useCallback(
    (v: string | undefined) => onUpdateMetric("sharedRelationshipKind", v),
    [onUpdateMetric],
  );

  const handleSharedDirChange = useCallback(
    (v: string | undefined) => onUpdateMetric("sharedDirection", v),
    [onUpdateMetric],
  );

  return (
    <>
      <ReferenceDropdown
        label="Shared Relationship Kind"
        value={metric?.sharedRelationshipKind}
        onChange={handleSharedKindChange}
        options={relationshipKindOptions}
      />
      <ReferenceDropdown
        label="Shared Direction"
        value={metric?.sharedDirection || "src"}
        onChange={handleSharedDirChange}
        options={SHARED_DIRECTION_OPTIONS}
      />
    </>
  );
}

interface MetricTypeFieldsProps {
  readonly metricType: string | undefined;
  readonly metric: MetricConfig | undefined;
  readonly onUpdateMetric: (field: string, value: unknown) => void;
  readonly relationshipKindOptions: readonly DropdownOption[];
}

export function MetricTypeFields({
  metricType,
  metric,
  onUpdateMetric,
  relationshipKindOptions,
}: MetricTypeFieldsProps) {
  const showRelKindsFilter =
    metricType === "connection_count" || metricType === "relationship_count";

  return (
    <>
      {showRelKindsFilter && (
        <MetricRelKindsField
          relationshipKinds={metric?.relationshipKinds}
          onUpdateMetric={onUpdateMetric}
        />
      )}
      {metricType === "shared_relationship" && (
        <MetricSharedFields
          metric={metric}
          onUpdateMetric={onUpdateMetric}
          relationshipKindOptions={relationshipKindOptions}
        />
      )}
    </>
  );
}
