/**
 * OverviewTab - Basic info, summary stats, and danger zone actions
 */

import React, { useMemo } from 'react';
import { EnableToggle, useLocalInputState, LocalTextArea } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Function} props.onDelete - Callback to delete the generator
 * @param {Function} props.onDuplicate - Callback to duplicate the generator
 */
export function OverviewTab({ generator, onChange, onDelete, onDuplicate }) {
  const updateField = (field, value) => {
    onChange({ ...generator, [field]: value });
  };

  const [localId, setLocalId, handleIdBlur] = useLocalInputState(
    generator.id,
    (value) => updateField('id', value)
  );
  const [localName, setLocalName, handleNameBlur] = useLocalInputState(
    generator.name,
    (value) => updateField('name', value)
  );

  const summary = useMemo(() => {
    return {
      rules: generator.applicability?.length || 0,
      variables: Object.keys(generator.variables || {}).length,
      creates: generator.creation?.length || 0,
      relationships: generator.relationships?.length || 0,
      effects: generator.stateUpdates?.length || 0,
    };
  }, [generator]);

  return (
    <div>
      <div className="section">
        <div className="section-title">Basic Information</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="label">Generator ID</label>
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
              placeholder="Optional friendly name"
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="label">Enabled</label>
          <EnableToggle
            enabled={generator.enabled !== false}
            onChange={(enabled) => updateField('enabled', enabled)}
            label={generator.enabled !== false ? 'Generator is active' : 'Generator is disabled'}
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <label className="label">Narration Template</label>
          <div className="section-desc" style={{ marginBottom: '8px' }}>
            Syntax: {'{$target.field}'}, {'{$var.field}'}, {'{count:kind}'}, {'{list:created}'}, {'{field|fallback}'}.
          </div>
          <LocalTextArea
            value={generator.narrationTemplate || ''}
            onChange={(value) => updateField('narrationTemplate', value || undefined)}
            placeholder="e.g., From {$target.name}, {count:npc} new souls emerged to shape the realm."
            rows={2}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Summary</div>
        <div className="summary-stats-grid">
          {[
            { label: 'Rules', value: summary.rules, icon: '✓' },
            { label: 'Variables', value: summary.variables, icon: '📦' },
            { label: 'Creates', value: summary.creates, icon: '✨' },
            { label: 'Connects', value: summary.relationships, icon: '🔗' },
            { label: 'Effects', value: summary.effects, icon: '⚡' },
          ].map((stat) => (
            <div key={stat.label} className="summary-stat">
              <div className="summary-stat-icon">{stat.icon}</div>
              <div className="summary-stat-value">{stat.value}</div>
              <div className="summary-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="danger-zone">
        <button className="btn btn-secondary" onClick={onDuplicate}>
          Duplicate Generator
        </button>
        <button className="btn btn-danger" onClick={onDelete}>
          Delete Generator
        </button>
      </div>
    </div>
  );
}

export default OverviewTab;
