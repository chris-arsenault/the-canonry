/**
 * CommonSettingsTab - Shared settings for all system types
 */

import React from 'react';
import { PressureChangesEditor, NumberInput } from '../../shared';
import SelectionRuleEditor from '../../shared/SelectionRuleEditor';

const DEFAULT_SELECTION = Object.freeze({ strategy: 'by_kind', kind: 'any' });
const EMPTY_PRESSURE_CHANGES = Object.freeze({});

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Available pressure definitions
 */
export function CommonSettingsTab({ system, onChange, schema, pressures }) {
  const config = system.config;
  const selection = config.selection || DEFAULT_SELECTION;
  const supportsSelection = [
    'graphContagion',
    'connectionEvolution',
    'thresholdTrigger',
    'clusterFormation',
    'tagDiffusion',
    'planeDiffusion',
  ].includes(system.systemType);

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  return (
    <div>
      {supportsSelection && (
        <div className="section">
          <div className="section-title">Entity Selection</div>
          <div className="section-desc">
            Define which entities this system operates on.
          </div>
          <SelectionRuleEditor
            value={selection}
            onChange={(next) => updateConfig('selection', next)}
            schema={schema}
            availableRefs={[]}
            showPickStrategy={false}
            showMaxResults={false}
            showFilters
            allowAnyKind
            showExcludeSubtypes
          />
        </div>
      )}

      <div className="section">
        <div className="section-title">Throttling</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Throttle Chance (0-1)</label>
            <NumberInput
              value={config.throttleChance}
              onChange={(v) => updateConfig('throttleChance', v)}
              className="input"
              min={0}
              max={1}
              step={0.1}
              placeholder="0.2"
              allowEmpty
            />
          </div>
          <div className="form-group">
            <label className="label">Cooldown (ticks)</label>
            <NumberInput
              value={config.cooldown}
              onChange={(v) => updateConfig('cooldown', v)}
              className="input"
              min={0}
              placeholder="0"
              allowEmpty
              integer
            />
          </div>
        </div>
      </div>

      <div className="section">
        <PressureChangesEditor
          value={config.pressureChanges || EMPTY_PRESSURE_CHANGES}
          onChange={(v) => updateConfig('pressureChanges', Object.keys(v).length > 0 ? v : undefined)}
          pressures={pressures}
        />
      </div>
    </div>
  );
}
