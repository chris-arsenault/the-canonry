/**
 * MetricSection - Metric configuration for connection evolution.
 */

import React, { useCallback } from "react";
import { METRIC_TYPES, DIRECTIONS } from "../../constants";
import { ReferenceDropdown, NumberInput } from "../../../shared";
import { MetricTypeFields } from "./MetricTypeFields";
import type { SystemConfig, DropdownOption } from "./types";

interface MetricSectionProps {
  readonly config: SystemConfig;
  readonly onUpdateMetric: (field: string, value: unknown) => void;
  readonly relationshipKindOptions: readonly DropdownOption[];
}

export function MetricSection({
  config,
  onUpdateMetric,
  relationshipKindOptions,
}: MetricSectionProps) {
  const handleTypeChange = useCallback(
    (v: string | undefined) => onUpdateMetric("type", v),
    [onUpdateMetric],
  );

  const handleDirectionChange = useCallback(
    (v: string | undefined) => onUpdateMetric("direction", v),
    [onUpdateMetric],
  );

  const handleMinStrengthChange = useCallback(
    (v: number | undefined) => onUpdateMetric("minStrength", v),
    [onUpdateMetric],
  );

  return (
    <div className="section">
      <div className="section-title">Metric</div>
      <div className="section-desc">How entities are measured for rule evaluation.</div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Metric Type"
          value={config.metric?.type || "connection_count"}
          onChange={handleTypeChange}
          options={METRIC_TYPES}
        />
        <ReferenceDropdown
          label="Direction"
          value={config.metric?.direction || "both"}
          onChange={handleDirectionChange}
          options={DIRECTIONS}
        />
        <MetricTypeFields
          metricType={config.metric?.type}
          metric={config.metric}
          onUpdateMetric={onUpdateMetric}
          relationshipKindOptions={relationshipKindOptions}
        />
        <div className="form-group">
          <label className="label">Min Strength
          <NumberInput
            value={config.metric?.minStrength}
            onChange={handleMinStrengthChange}
            min={0}
            max={1}
            allowEmpty
            placeholder="0"
          />
          </label>
        </div>
      </div>
    </div>
  );
}
