/**
 * ProbabilityTab - Probability configuration
 */

import React from 'react';
import { NumberInput } from '../../shared';

/**
 * Editor for pressure modifiers with multiplier support.
 * Value is an array of { pressure: string, multiplier: number }
 */
function PressureModifiersEditor({ value = [], onChange, pressures = [] }) {
  const modifiers = Array.isArray(value) ? value : [];
  const usedPressures = new Set(modifiers.map((m) => m.pressure));
  const availablePressures = pressures.filter((p) => !usedPressures.has(p.id));

  // Helper to get pressure name from id
  const getPressureName = (pressureId) => {
    const pressure = pressures.find((p) => p.id === pressureId);
    return pressure?.name || pressureId;
  };

  const updateModifier = (index, field, fieldValue) => {
    const newModifiers = [...modifiers];
    newModifiers[index] = { ...newModifiers[index], [field]: fieldValue };
    onChange(newModifiers);
  };

  const removeModifier = (index) => {
    const newModifiers = modifiers.filter((_, i) => i !== index);
    onChange(newModifiers);
  };

  const addModifier = (pressureId) => {
    if (pressureId && !usedPressures.has(pressureId)) {
      onChange([...modifiers, { pressure: pressureId, multiplier: 1.0 }]);
    }
  };

  return (
    <div>
      {modifiers.map((mod, index) => (
        <div key={index} className="flex items-center gap-md mb-md">
          <span className="text-small flex-1">{getPressureName(mod.pressure)}</span>
          <span className="text-muted text-xs">×</span>
          <NumberInput
            value={mod.multiplier}
            onChange={(v) => updateModifier(index, 'multiplier', v ?? 1.0)}
            className="input input-xs"
            step={0.1}
          />
          <button className="btn-icon btn-icon-danger" onClick={() => removeModifier(index)}>
            ×
          </button>
        </div>
      ))}
      <div className="text-muted text-xs mb-md">
        Positive multiplier: high pressure increases likelihood. Negative: inverse relationship.
      </div>
      <select
        className="select"
        value=""
        onChange={(e) => addModifier(e.target.value)}
      >
        <option value="">+ Add pressure modifier...</option>
        {availablePressures.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || p.id}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ProbabilityTab({ action, onChange, pressures }) {
  const probability = action.probability || {};

  const updateProbability = (field, value) => {
    onChange({
      ...action,
      probability: { ...probability, [field]: value },
    });
  };

  const pressureModifiers = probability.pressureModifiers || [];
  const baseSuccessChance = probability.baseSuccessChance ?? 0.5;
  const baseWeight = probability.baseWeight ?? 1.0;

  return (
    <div>
      <div className="info-box">
        <div className="info-box-title">Probability Configuration</div>
        <div className="info-box-text">
          Control how likely this action is to be selected and succeed. Pressure modifiers
          dynamically adjust weight based on world state.
        </div>
      </div>

      <div className="section">
        <div className="section-title">🎯 Base Success Chance</div>
        <div className="section-desc">
          Probability that this action succeeds when attempted.
        </div>
        <div className="slider-row">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={baseSuccessChance}
            onChange={(e) => updateProbability('baseSuccessChance', parseFloat(e.target.value))}
            className="slider"
          />
          <span className="slider-value">{(baseSuccessChance * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div className="section">
        <div className="section-title">⚖️ Base Weight</div>
        <div className="section-desc">
          Relative weight for action selection. Higher weight means more likely to be chosen.
        </div>
        <div className="form-group">
          <NumberInput
            value={baseWeight}
            onChange={(v) => updateProbability('baseWeight', v ?? 1.0)}
            min={0}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">📊 Pressure Modifiers ({pressureModifiers.length})</div>
        <div className="section-desc">
          Pressures that affect the weight of this action. Formula: weight = baseWeight × (1 + Σ(pressure/100 × multiplier))
        </div>
        <PressureModifiersEditor
          value={pressureModifiers}
          onChange={(v) => updateProbability('pressureModifiers', v.length > 0 ? v : undefined)}
          pressures={pressures}
        />
      </div>
    </div>
  );
}
