/**
 * OverviewTab - Basic system information and settings
 */

import React from "react";
import PropTypes from "prop-types";
import { SYSTEM_TYPES } from "../constants";
import { EnableToggle, useLocalInputState, LocalTextArea } from "../../shared";
import "./OverviewTab.css";

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Function} props.onDelete - Called to delete the system
 */
export function OverviewTab({ system, onChange, onDelete }) {
  const config = system.config;
  const typeConfig = SYSTEM_TYPES[system.systemType] || {};

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };

  const [localId, setLocalId, handleIdBlur] = useLocalInputState(config.id, (value) =>
    updateConfig("id", value)
  );
  const [localName, setLocalName, handleNameBlur] = useLocalInputState(config.name, (value) =>
    updateConfig("name", value)
  );

  return (
    <div>
      <div className="section">
        <div className="section-title">Basic Information</div>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="system-id" className="label">System ID</label>
            <input id="system-id"
              type="text"
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              onBlur={handleIdBlur}
              className="input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="display-name" className="label">Display Name</label>
            <input id="display-name"
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              className="input"
            />
          </div>
        </div>

        <div className="mt-xl">
          <div className="form-group">
            <label className="label">Description
            <LocalTextArea
              value={config.description || ""}
              onChange={(value) => updateConfig("description", value)}
              className="ot-description-textarea"
              placeholder="Describe what this system does..."
            />
            </label>
          </div>
        </div>

        <div className="mt-xl">
          <span className="label">System Type</span>
          <div className="flex items-center gap-lg">
            {/* eslint-disable-next-line local/no-inline-styles -- dynamic type color from config */}
            <span
              className="type-badge"
              style={{ '--ot-type-bg': `${typeConfig.color}30`, '--ot-type-color': typeConfig.color, backgroundColor: 'var(--ot-type-bg)', color: 'var(--ot-type-color)' }}
            >
              {typeConfig.icon} {typeConfig.label}
            </span>
            <span className="text-muted ot-type-desc">
              {typeConfig.desc}
            </span>
          </div>
        </div>

        <div className="mt-xl">
          <label className="label">Enabled
          <EnableToggle
            enabled={system.enabled !== false}
            onChange={(enabled) => onChange({ ...system, enabled })}
            label={system.enabled !== false ? "System is active" : "System is disabled"}
          />
          </label>
        </div>
      </div>

      <div className="danger-zone">
        <button className="btn btn-danger" onClick={onDelete}>
          Delete System
        </button>
      </div>
    </div>
  );
}

OverviewTab.propTypes = {
  system: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
