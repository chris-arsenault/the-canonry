/**
 * ParameterForm - Simulation parameter configuration form
 */

import React from "react";
import { NumberInput } from "@the-canonry/shared-components";
import "./ParameterForm.css";

interface SimParams {
  scaleFactor: number;
  defaultMinDistance: number;
  pressureDeltaSmoothing: number;
  ticksPerEpoch: number;
  maxEpochs: number;
  maxTicks: number;
  maxValidityAttempts: number;
  narrativeEnabled: boolean;
  narrativeMinSignificance: number;
}

interface ParameterFormProps {
  params: SimParams;
  onParamChange: (key: string, value: number | boolean) => void;
}

export default function ParameterForm({ params, onParamChange }: Readonly<ParameterFormProps>) {
  const numChange = React.useCallback((field: string, fallback: number) =>
    (v: number | null) => onParamChange(field, v ?? fallback),
  [onParamChange]);

  const sf = React.useMemo(() => numChange("scaleFactor", 1), [numChange]);
  const dmd = React.useMemo(() => numChange("defaultMinDistance", 5), [numChange]);
  const pds = React.useMemo(() => numChange("pressureDeltaSmoothing", 10), [numChange]);
  const tpe = React.useMemo(() => numChange("ticksPerEpoch", 20), [numChange]);
  const me = React.useMemo(() => numChange("maxEpochs", 14), [numChange]);
  const mt = React.useMemo(() => numChange("maxTicks", 500), [numChange]);
  const mva = React.useMemo(() => numChange("maxValidityAttempts", 4), [numChange]);
  const nms = React.useMemo(() => numChange("narrativeMinSignificance", 0), [numChange]);
  const onNarrativeToggle = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => onParamChange("narrativeEnabled", e.target.checked), [onParamChange]);

  return (
    <div className="lw-form-grid">
      <div className="lw-form-group">
        <label className="lw-label">Scale Factor
        <NumberInput
          min={0.1}
          max={10}
          step={0.1}
          value={params.scaleFactor}
          onChange={sf}
          className="lw-input"
        />
        </label>
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Default Min Distance
        <NumberInput
          min={1}
          max={20}
          step={0.5}
          value={params.defaultMinDistance}
          onChange={dmd}
          className="lw-input"
          title="Minimum distance between entities on semantic planes"
        />
        </label>
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Pressure Smoothing
        <NumberInput
          min={1}
          max={50}
          step={1}
          value={params.pressureDeltaSmoothing}
          onChange={pds}
          className="lw-input"
          integer
          title="Max pressure change per tick from feedback (higher = faster swings)"
        />
        </label>
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Ticks Per Epoch
        <NumberInput
          min={1}
          max={50}
          value={params.ticksPerEpoch}
          onChange={tpe}
          className="lw-input"
          integer
          title="Number of simulation ticks to run per epoch"
        />
        </label>
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Max Epochs
        <NumberInput
          min={1}
          max={100}
          value={params.maxEpochs}
          onChange={me}
          className="lw-input"
          integer
          title="Maximum epochs to run (hard limit on simulation length)"
        />
        </label>
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Max Ticks
        <NumberInput
          min={100}
          max={5000}
          value={params.maxTicks}
          onChange={mt}
          className="lw-input"
          integer
        />
        </label>
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Validity Attempts
        <NumberInput
          min={1}
          max={20}
          value={params.maxValidityAttempts}
          onChange={mva}
          className="lw-input"
          integer
          title="Max runs for 'Until Valid' search"
        />
        </label>
      </div>

      {/* Narrative Events Section */}
      <div className="lw-form-group viewer-section">
        <div className="pf-narrative-header">
          <span className="lw-label pf-narrative-label">
            Narrative Events
          </span>
          <label className="pf-toggle-label">
            <input
              type="checkbox"
              checked={params.narrativeEnabled}
              onChange={onNarrativeToggle}
              className="narrative-check"
            />
            Enable event tracking
          </label>
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
                value={params.narrativeMinSignificance}
                onChange={nms}
                className="lw-input"
                title="Minimum significance threshold (0-1). Higher = fewer, more important events."
              />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
