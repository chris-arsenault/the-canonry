/**
 * ParameterForm - Simulation parameter configuration form
 */

import React from 'react';
import { NumberInput } from '@penguin-tales/shared-components';

export default function ParameterForm({ params, onParamChange }) {
  return (
    <div className="lw-form-grid">
      <div className="lw-form-group">
        <label className="lw-label">Scale Factor</label>
        <NumberInput
          min={0.1}
          max={10}
          step={0.1}
          value={params.scaleFactor}
          onChange={(v) => onParamChange('scaleFactor', v ?? 1)}
          className="lw-input"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Default Min Distance</label>
        <NumberInput
          min={1}
          max={20}
          step={0.5}
          value={params.defaultMinDistance}
          onChange={(v) => onParamChange('defaultMinDistance', v ?? 5)}
          className="lw-input"
          title="Minimum distance between entities on semantic planes"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Pressure Smoothing</label>
        <NumberInput
          min={1}
          max={50}
          step={1}
          value={params.pressureDeltaSmoothing}
          onChange={(v) => onParamChange('pressureDeltaSmoothing', v ?? 10)}
          className="lw-input"
          integer
          title="Max pressure change per tick from feedback (higher = faster swings)"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Ticks Per Epoch</label>
        <NumberInput
          min={1}
          max={50}
          value={params.ticksPerEpoch}
          onChange={(v) => onParamChange('ticksPerEpoch', v ?? 20)}
          className="lw-input"
          integer
          title="Number of simulation ticks to run per epoch"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Max Epochs</label>
        <NumberInput
          min={1}
          max={100}
          value={params.maxEpochs}
          onChange={(v) => onParamChange('maxEpochs', v ?? 14)}
          className="lw-input"
          integer
          title="Maximum epochs to run (hard limit on simulation length)"
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Max Ticks</label>
        <NumberInput
          min={100}
          max={5000}
          value={params.maxTicks}
          onChange={(v) => onParamChange('maxTicks', v ?? 500)}
          className="lw-input"
          integer
        />
      </div>
      <div className="lw-form-group">
        <label className="lw-label">Validity Attempts</label>
        <NumberInput
          min={1}
          max={20}
          value={params.maxValidityAttempts}
          onChange={(v) => onParamChange('maxValidityAttempts', v ?? 4)}
          className="lw-input"
          integer
          title="Max runs for 'Until Valid' search"
        />
      </div>

      {/* Narrative Events Section */}
      <div className="lw-form-group" style={{ gridColumn: '1 / -1', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <label className="lw-label" style={{ margin: 0 }}>Narrative Events</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={params.narrativeEnabled ?? false}
              onChange={(e) => onParamChange('narrativeEnabled', e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Enable event tracking
          </label>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
          Captures significant world changes (status, prominence, relationships) as narrative events for story generation.
        </p>
        {params.narrativeEnabled && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="lw-form-group" style={{ flex: '1 1 150px', minWidth: '150px' }}>
              <label className="lw-label">Min Significance</label>
              <NumberInput
                min={0}
                max={1}
                step={0.1}
                value={params.narrativeMinSignificance ?? 0}
                onChange={(v) => onParamChange('narrativeMinSignificance', v ?? 0)}
                className="lw-input"
                title="Minimum significance threshold (0-1). Higher = fewer, more important events."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
