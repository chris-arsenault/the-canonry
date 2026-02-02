/**
 * VariablesTab - Define intermediate entity selections for actions
 */

import React, { useState } from 'react';
import VariableSelectionEditor from '../../shared/VariableSelectionEditor';

/**
 * Safely display a value that should be a string.
 * If it's an object, log a warning and return a fallback.
 */
function safeDisplay(value, fallback = '?', label = 'value') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    console.warn(`[VariablesTab] Expected string for ${label} but got object:`, value);
    return `[object]`;
  }
  return String(value);
}

// ============================================================================
// VariableCard - Individual variable editor card
// ============================================================================

function VariableCard({ name, config, onChange, onRemove, schema, availableRefs = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Handle the nested select structure: { select: { from, kind, pickStrategy, ... }, required }
  const selectConfig = config.select || {};
  const isRequired = config.required || false;

  const updateRequired = (value) => {
    onChange({ ...config, required: value });
  };

  // Display info
  const displayMode = selectConfig.from && typeof selectConfig.from === 'object' ? 'Related entities' : (selectConfig.kind || 'Not configured');
  const displayStrategy = safeDisplay(selectConfig.pickStrategy, 'Not set', 'pickStrategy');
  const filterCount = (selectConfig.filters || []).length;

  return (
    <div className="item-card">
      <div
        className={`item-card-header ${hovering ? 'item-card-header-hover' : ''}`}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="item-card-icon item-card-icon-variable">📦</div>
        <div className="item-card-info">
          <div className="item-card-title">
            <span className="variable-ref">{name}</span>
            {isRequired && <span className="badge badge-warning" style={{ marginLeft: '8px', fontSize: '10px' }}>Required</span>}
          </div>
          <div className="item-card-subtitle">
            {displayMode} • {displayStrategy}
            {filterCount > 0 && <span style={{ marginLeft: '4px' }}>• {filterCount} filter{filterCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div className="item-card-actions">
          <button className="btn-icon">{expanded ? '▲' : '▼'}</button>
          <button className="btn-icon btn-icon-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div className="item-card-body">
          {/* Required checkbox */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => updateRequired(e.target.checked)}
              />
              <span className="label" style={{ margin: 0 }}>Required</span>
              <span className="text-muted" style={{ fontSize: '11px' }}>
                (Action won't execute unless this variable resolves)
              </span>
            </label>
          </div>

          <VariableSelectionEditor
            value={selectConfig}
            onChange={(updated) => onChange({ ...config, select: updated })}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VariablesTab - Main tab component
// ============================================================================

/**
 * @param {Object} props
 * @param {Object} props.action - The action being edited
 * @param {Function} props.onChange - Callback when action changes
 * @param {Object} props.schema - Domain schema
 */
export function VariablesTab({ action, onChange, schema }) {
  const variables = action.variables || {};
  const [newVarName, setNewVarName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Build available refs for relationship queries (actor, instigator, target, target2 + other vars)
  const buildAvailableRefs = (excludeVar) => {
    const refs = ['$actor', '$instigator', '$target', '$target2'];
    Object.keys(variables).forEach((v) => {
      if (v !== excludeVar) refs.push(v);
    });
    return refs;
  };

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    // Ensure the name starts with $
    const name = newVarName.startsWith('$') ? newVarName : `$${newVarName}`;
    // Create with empty required fields - validation will flag them
    onChange({
      ...action,
      variables: {
        ...variables,
        [name]: { select: { from: 'graph', kind: '', pickStrategy: '' } },
      },
    });
    setNewVarName('');
    setShowAddForm(false);
  };

  const varEntries = Object.entries(variables);

  return (
    <div>
      <div className="section">
        <div className="section-title">Variables</div>

        <div className="info-box">
          <div className="info-box-title">What are variables?</div>
          <div className="info-box-text">
            Variables let you select additional entities from the graph to use in mutations.
            For example, you might select a <code className="inline-code">$victimFaction</code> to create
            an enemy relationship with, or an <code className="inline-code">$artifact</code> to modify.
            Variables are resolved after <code className="inline-code">$actor</code> and <code className="inline-code">$target</code> are chosen.
          </div>
        </div>

        {varEntries.length === 0 && !showAddForm ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">No variables defined</div>
            <div className="empty-state-desc">
              Add variables to select additional entities for use in mutations.
            </div>
          </div>
        ) : (
          varEntries.map(([name, config]) => (
            <VariableCard
              key={name}
              name={name}
              config={config}
              onChange={(updated) => onChange({ ...action, variables: { ...variables, [name]: updated } })}
              onRemove={() => {
                const newVars = { ...variables };
                delete newVars[name];
                onChange({ ...action, variables: newVars });
              }}
              schema={schema}
              availableRefs={buildAvailableRefs(name)}
            />
          ))
        )}

        {showAddForm ? (
          <div className="item-card add-form">
            <div className="add-form-fields">
              <div style={{ flex: 1 }}>
                <label className="label">Variable Name</label>
                <input
                  type="text"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value.replace(/[^a-zA-Z0-9_$]/g, ''))}
                  className="input"
                  placeholder="$myVariable"
                  autoFocus
                />
              </div>
              <button className="btn btn-primary" onClick={handleAddVariable} disabled={!newVarName.trim()}>
                Add
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowAddForm(false); setNewVarName(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-add"
            onClick={() => setShowAddForm(true)}
          >
            + Add Variable
          </button>
        )}
      </div>
    </div>
  );
}

export default VariablesTab;
