/**
 * ParameterForm - Simulation parameter configuration form
 */

import React, { useCallback, useMemo } from "react";
import { NumberInput, EnableToggle } from "@the-canonry/shared-components";
import "./ParameterForm.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulationParams {
  scaleFactor: number;
  defaultMinDistance: number;
  pressureDeltaSmoothing: number;
  ticksPerEpoch: number;
  maxEpochs: number;
  maxTicks: number;
  narrativeEnabled: boolean;
  narrativeMinSignificance: number;
  maxValidityAttempts: number;
}

interface ParameterFormProps {
  params: SimulationParams;
  onParamChange: (field: keyof SimulationParams, value: number | boolean) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NumberFieldProps {
  label: string;
  field: keyof SimulationParams;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  title?: string;
  value: number;
  fallback: number;
  onParamChange: (field: keyof SimulationParams, value: number) => void;
}

function NumberField({ label, field, min, max, step, integer, title, value, fallback, onParamChange }: NumberFieldProps) {
  const handleChange = useCallback(
    (v: number | null) => onParamChange(field, v ?? fallback),
    [field, fallback, onParamChange],
  );

  return (
    <div className="lw-form-group">
      <label className="lw-label">{label}
        <NumberInput
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="lw-input"
          integer={integer}
          title={title}
        />
      </label>
    </div>
  );
}

function NarrativeSection({ params, onParamChange }: ParameterFormProps) {
  const handleToggle = useCallback(
    (checked: boolean) => onParamChange("narrativeEnabled", checked),
    [onParamChange],
  );

  const handleMinSignificance = useCallback(
    (v: number | null) => onParamChange("narrativeMinSignificance", v ?? 0),
    [onParamChange],
  );

  return (
    <div className="lw-form-group viewer-section">
      <div className="pf-narrative-header">
        <span className="lw-label pf-narrative-label">
          Narrative Events
        </span>
        <div className="toggle-container">
          <EnableToggle
            enabled={params.narrativeEnabled ?? false}
            onChange={handleToggle}
          />
          <span className="toggle-label">Enable event tracking</span>
        </div>
      </div>
      <p className="pf-narrative-desc">
        Captures significant world changes (status, prominence, relationships) as narrative events
        for story generation.
      </p>
      {params.narrativeEnabled && (
        <div className="pf-narrative-fields">
          <div className="lw-form-group pf-narrative-field">
            <label className="lw-label">Min Significance
              <NumberInput
                min={0}
                max={1}
                step={0.1}
                value={params.narrativeMinSignificance ?? 0}
                onChange={handleMinSignificance}
                className="lw-input"
                title="Minimum significance threshold (0-1). Higher = fewer, more important events."
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ParameterForm({ params, onParamChange }: ParameterFormProps) {
  const handleNumberParamChange = useCallback(
    (field: keyof SimulationParams, value: number) => onParamChange(field, value),
    [onParamChange],
  );

  const fields = useMemo(() => [
    { label: "Scale Factor", field: "scaleFactor" as const, min: 0.1, max: 10, step: 0.1, fallback: 1 },
    { label: "Default Min Distance", field: "defaultMinDistance" as const, min: 1, max: 20, step: 0.5, fallback: 5, title: "Minimum distance between entities on semantic planes" },
    { label: "Pressure Smoothing", field: "pressureDeltaSmoothing" as const, min: 1, max: 50, step: 1, integer: true, fallback: 10, title: "Max pressure change per tick from feedback (higher = faster swings)" },
    { label: "Ticks Per Epoch", field: "ticksPerEpoch" as const, min: 1, max: 50, integer: true, fallback: 20, title: "Number of simulation ticks to run per epoch" },
    { label: "Max Epochs", field: "maxEpochs" as const, min: 1, max: 100, integer: true, fallback: 14, title: "Maximum epochs to run (hard limit on simulation length)" },
    { label: "Max Ticks", field: "maxTicks" as const, min: 100, max: 5000, integer: true, fallback: 500 },
    { label: "Validity Attempts", field: "maxValidityAttempts" as const, min: 1, max: 20, integer: true, fallback: 4, title: "Max runs for 'Until Valid' search" },
  ], []);

  return (
    <div className="lw-form-grid">
      {fields.map((f) => (
        <NumberField
          key={f.field}
          label={f.label}
          field={f.field}
          min={f.min}
          max={f.max}
          step={f.step}
          integer={f.integer}
          title={f.title}
          value={params[f.field] as number}
          fallback={f.fallback}
          onParamChange={handleNumberParamChange}
        />
      ))}

      <NarrativeSection params={params} onParamChange={onParamChange} />
    </div>
  );
}
