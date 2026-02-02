/**
 * OverviewTab - Basic system information and settings
 */

import React from 'react';
import { SYSTEM_TYPES } from '../constants';
import { EnableToggle, useLocalInputState, LocalTextArea } from '../../shared';

const DESCRIPTION_TEXTAREA_STYLE = Object.freeze({ minHeight: '60px' });

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

  const [localId, setLocalId, handleIdBlur] = useLocalInputState(
    config.id,
    (value) => updateConfig('id', value)
  );
  const [localName, setLocalName, handleNameBlur] = useLocalInputState(
    config.name,
    (value) => updateConfig('name', value)
  );

  return (
    <div>
      <div className="section">
        <div className="section-title">Basic Information</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">System ID</label>
            <input
              type="text"
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              onBlur={handleIdBlur}
              className="input"
            />
          </div>
          <div className="form-group">
            <label className="label">Display Name</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              className="input"
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label className="label">Description</label>
            <LocalTextArea
              value={config.description || ''}
              onChange={(value) => updateConfig('description', value)}
              style={DESCRIPTION_TEXTAREA_STYLE}
              placeholder="Describe what this system does..."
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="label">System Type</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="type-badge" style={{ backgroundColor: `${typeConfig.color}30`, color: typeConfig.color }}>
              {typeConfig.icon} {typeConfig.label}
            </span>
            <span className="text-muted" style={{ fontSize: '13px' }}>{typeConfig.desc}</span>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="label">Enabled</label>
          <EnableToggle
            enabled={system.enabled !== false}
            onChange={(enabled) => onChange({ ...system, enabled })}
            label={system.enabled !== false ? 'System is active' : 'System is disabled'}
          />
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
