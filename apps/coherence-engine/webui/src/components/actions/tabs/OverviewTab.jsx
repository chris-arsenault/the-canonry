/**
 * OverviewTab - Basic information for an action
 */

import React from 'react';
import { useLocalInputState, LocalTextArea } from '../../shared';

export function OverviewTab({ action, onChange, onDelete }) {
  const updateAction = (field, value) => {
    onChange({ ...action, [field]: value });
  };

  const [localId, setLocalId, handleIdBlur] = useLocalInputState(
    action.id,
    (value) => updateAction('id', value)
  );
  const [localName, setLocalName, handleNameBlur] = useLocalInputState(
    action.name,
    (value) => updateAction('name', value)
  );

  const isEnabled = action.enabled !== false;

  return (
    <div>
      <div className="section">
        <div className="section-title">📋 Basic Information</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">ID</label>
            <input
              type="text"
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
              onBlur={handleIdBlur}
              className="input"
              placeholder="unique_action_id"
            />
          </div>
          <div className="form-group">
            <label className="label">Name</label>
            <input
              type="text"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={handleNameBlur}
              className="input"
              placeholder="Action Name"
            />
          </div>
          <div className="form-group form-group-wide">
            <label className="label">Description</label>
            <LocalTextArea
              value={action.description || ''}
              onChange={(value) => updateAction('description', value)}
              placeholder="What does this action do?"
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">⚙️ Status</div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => updateAction('enabled', e.target.checked)}
            className="checkbox"
          />
          Action Enabled
        </label>
      </div>

      <div className="section">
        <div className="section-title">🗑️ Danger Zone</div>
        <button className="btn btn-danger" onClick={onDelete}>
          Delete Action
        </button>
      </div>
    </div>
  );
}
