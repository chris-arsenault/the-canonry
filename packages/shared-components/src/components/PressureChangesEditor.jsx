/**
 * PressureChangesEditor - Editor for pressure delta values
 *
 * Displays a list of pressure changes with ability to add, remove, and modify delta values.
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * @param {Object} props
 * @param {Object<string, number>} props.value - Map of pressure ID to delta value
 * @param {Function} props.onChange - Called when values change
 * @param {Array<{id: string, name?: string}>} props.pressures - Available pressure definitions
 * @param {string} [props.label] - Optional custom label (default: "Pressure Changes")
 * @param {string} [props.className] - Additional class names
 */
const styles = {
  deltaInput: { width: '80px' },
  addSelect: { maxWidth: '200px' },
};

export function PressureChangesEditor({
  value = {},
  onChange,
  pressures,
  label = 'Pressure Changes',
  className = '',
}) {
  const entries = Object.entries(value);

  const addPressure = (pressureId) => {
    if (pressureId && !(pressureId in value)) {
      onChange({ ...value, [pressureId]: 0 });
    }
  };

  const updateDelta = (pressureId, delta) => {
    onChange({ ...value, [pressureId]: parseInt(delta) || 0 });
  };

  const removePressure = (pressureId) => {
    const newValue = { ...value };
    delete newValue[pressureId];
    onChange(newValue);
  };

  const availablePressures = (pressures || []).filter((p) => !(p.id in value));

  return (
    <div className={`form-group mb-xl ${className}`.trim()}>
      <label className="label">{label}</label>
      <div className="flex flex-col gap-md">
        {entries.map(([pressureId, delta]) => (
          <div key={pressureId} className="item-row">
            <span className="item-row-name">{pressureId}</span>
            <input
              type="number"
              className="input"
              value={delta}
              onChange={(e) => updateDelta(pressureId, e.target.value)}
              style={styles.deltaInput}
            />
            <button
              className="btn-icon btn-icon-danger"
              onClick={() => removePressure(pressureId)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {availablePressures.length > 0 && (
        <select
          className="select mt-md"
          value=""
          onChange={(e) => addPressure(e.target.value)}
          style={styles.addSelect}
        >
          <option value="">+ Add pressure change...</option>
          {availablePressures.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

PressureChangesEditor.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  pressures: PropTypes.array,
  label: PropTypes.string,
  className: PropTypes.string,
};
