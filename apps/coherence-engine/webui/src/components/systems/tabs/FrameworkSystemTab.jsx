/**
 * FrameworkSystemTab - Configuration for framework-level systems
 */

import React from 'react';
import { NumberInput } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 */
export function FrameworkSystemTab({ system, onChange }) {
  const config = system.config;

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Framework System</div>
        <div className="info-box-text">
          This is a framework-level system with specific configuration options.
        </div>
      </div>

      <div className="section">
        <div className="section-title">Configuration</div>

        {system.systemType === 'eraTransition' && (
          <div className="form-grid">
            <p className="label" style={{ gridColumn: '1 / -1', color: '#666' }}>
              Era transition timing is controlled by per-era exitConditions in eras.json.
              Add a time condition (e.g., {`{ type: 'time_elapsed', minTicks: 25 }`}) to control minimum era length.
            </p>
          </div>
        )}

        {system.systemType === 'universalCatalyst' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Action Attempt Rate</label>
              <NumberInput
                value={config.actionAttemptRate}
                onChange={(v) => updateConfig('actionAttemptRate', v)}
                className="input"
                step={0.1}
                min={0}
                max={1}
                allowEmpty
              />
            </div>
            <div className="form-group">
              <label className="label">Pressure Multiplier</label>
              <NumberInput
                value={config.pressureMultiplier}
                onChange={(v) => updateConfig('pressureMultiplier', v)}
                className="input"
                step={0.1}
                min={0}
                allowEmpty
              />
            </div>
            <div className="form-group">
              <label className="label">Prominence Up % on Success</label>
              <NumberInput
                value={config.prominenceUpChanceOnSuccess}
                onChange={(v) => updateConfig('prominenceUpChanceOnSuccess', v)}
                className="input"
                step={0.05}
                min={0}
                max={1}
                allowEmpty
              />
            </div>
            <div className="form-group">
              <label className="label">Prominence Down % on Failure</label>
              <NumberInput
                value={config.prominenceDownChanceOnFailure}
                onChange={(v) => updateConfig('prominenceDownChanceOnFailure', v)}
                className="input"
                step={0.05}
                min={0}
                max={1}
                allowEmpty
              />
            </div>
          </div>
        )}

        {system.systemType === 'relationshipMaintenance' && (
          <div className="form-grid">
            <div className="form-group">
              <label className="label">Maintenance Frequency</label>
              <NumberInput
                value={config.maintenanceFrequency}
                onChange={(v) => updateConfig('maintenanceFrequency', v)}
                className="input"
                min={1}
                allowEmpty
                integer
              />
            </div>
            <div className="form-group">
              <label className="label">Cull Threshold</label>
              <NumberInput
                value={config.cullThreshold}
                onChange={(v) => updateConfig('cullThreshold', v)}
                className="input"
                step={0.05}
                min={0}
                max={1}
                allowEmpty
              />
            </div>
            <div className="form-group">
              <label className="label">Grace Period</label>
              <NumberInput
                value={config.gracePeriod}
                onChange={(v) => updateConfig('gracePeriod', v)}
                className="input"
                min={0}
                allowEmpty
                integer
              />
            </div>
            <div className="form-group">
              <label className="label">Reinforcement Bonus</label>
              <NumberInput
                value={config.reinforcementBonus}
                onChange={(v) => updateConfig('reinforcementBonus', v)}
                className="input"
                step={0.01}
                min={0}
                allowEmpty
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
