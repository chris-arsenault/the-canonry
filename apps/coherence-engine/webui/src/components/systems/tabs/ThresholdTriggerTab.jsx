/**
 * ThresholdTriggerTab - Configuration for threshold trigger systems
 */

import React, { useState } from 'react';
import { CLUSTER_MODES } from '../constants';
import { ReferenceDropdown, NumberInput, LocalTextArea } from '../../shared';
import VariableSelectionEditor from '../../shared/VariableSelectionEditor';
import { ApplicabilityRuleCard } from '../../generators/applicability/ApplicabilityRuleCard';
import { AddRuleButton } from '../../generators/applicability/AddRuleButton';
import { createNewRule } from '../../generators/applicability/createNewRule';
import MutationCard, { DEFAULT_MUTATION_TYPES } from '../../shared/MutationCard';

// ============================================================================
// VariableCard - Individual variable editor card (reused pattern from generators)
// ============================================================================

function VariableCard({ name, config, onChange, onRemove, schema, availableRefs = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);

  const selectConfig = config.select || {};
  const isRequired = config.required || false;

  const updateRequired = (value) => {
    onChange({ ...config, required: value });
  };

  // Determine display mode
  const getDisplayMode = () => {
    if (!selectConfig.from || selectConfig.from === 'graph') {
      return selectConfig.kind || 'Not configured';
    }
    if (typeof selectConfig.from === 'object' && 'path' in selectConfig.from) {
      const stepCount = selectConfig.from.path?.length || 0;
      return `Path traversal (${stepCount} step${stepCount !== 1 ? 's' : ''})`;
    }
    return 'Related entities';
  };
  const displayMode = getDisplayMode();
  const displayStrategy = selectConfig.pickStrategy || 'Not set';
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
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => updateRequired(e.target.checked)}
              />
              <span className="label" style={{ margin: 0 }}>Required</span>
              <span className="text-muted" style={{ fontSize: '11px' }}>
                (Entity is skipped if this variable can't be resolved)
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

const TRIGGER_MUTATION_TYPES = DEFAULT_MUTATION_TYPES;

/**
 * @param {Object} props
 * @param {Object} props.system - The system being edited
 * @param {Function} props.onChange - Called when system changes
 * @param {Object} props.schema - Domain schema
 * @param {Array} props.pressures - Pressure definitions
 */
export function ThresholdTriggerTab({ system, onChange, schema, pressures }) {
  const config = system.config;
  const [newVarName, setNewVarName] = useState('');
  const [showAddVarForm, setShowAddVarForm] = useState(false);

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const updateConfig = (field, value) => {
    onChange({ ...system, config: { ...config, [field]: value } });
  };


  // Conditions
  const conditions = config.conditions || [];

  const addCondition = (type) => {
    const newRule = createNewRule(type, pressures);
    updateConfig('conditions', [...conditions, newRule]);
  };

  const updateCondition = (index, cond) => {
    const newConditions = [...conditions];
    newConditions[index] = cond;
    updateConfig('conditions', newConditions);
  };

  const removeCondition = (index) => {
    updateConfig('conditions', conditions.filter((_, i) => i !== index));
  };

  // Variables
  const variables = config.variables || {};

  const buildAvailableRefs = (excludeVar) => {
    const refs = ['$self'];
    Object.keys(variables).forEach((v) => {
      if (v !== excludeVar) refs.push(v);
    });
    return refs;
  };

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    const name = newVarName.startsWith('$') ? newVarName : `$${newVarName}`;
    updateConfig('variables', {
      ...variables,
      [name]: { select: { from: 'graph', kind: '', pickStrategy: 'random' } },
    });
    setNewVarName('');
    setShowAddVarForm(false);
  };

  const updateVariable = (name, config) => {
    updateConfig('variables', { ...variables, [name]: config });
  };

  const removeVariable = (name) => {
    const newVars = { ...variables };
    delete newVars[name];
    updateConfig('variables', newVars);
  };

  // Build entity options for actions (include defined variables)
  const entityOptions = [
    { value: '$self', label: '$self' },
    { value: '$member', label: '$member' },
    { value: '$member2', label: '$member2' },
    ...Object.keys(variables).map(v => ({ value: v, label: v })),
  ];

  // Actions (mutations)
  const actions = config.actions || [];

  const createAction = (type) => {
    const defaultPressure = pressures?.[0]?.id || '';
    switch (type) {
      case 'modify_pressure':
        return { type: 'modify_pressure', pressureId: defaultPressure, delta: 0 };
      case 'set_tag':
        return { type: 'set_tag', entity: '$self', tag: '', value: true };
      case 'remove_tag':
        return { type: 'remove_tag', entity: '$self', tag: '' };
      case 'change_status':
        return { type: 'change_status', entity: '$self', newStatus: '' };
      case 'adjust_prominence':
        return { type: 'adjust_prominence', entity: '$self', delta: 0.25 };
      case 'archive_relationship':
        return { type: 'archive_relationship', entity: '$self', relationshipKind: '', direction: 'both' };
      case 'adjust_relationship_strength':
        return { type: 'adjust_relationship_strength', kind: '', src: '$self', dst: '$self', delta: 0.1 };
      case 'transfer_relationship':
        return { type: 'transfer_relationship', entity: '$self', relationshipKind: '', from: '$self', to: '$self' };
      case 'update_rate_limit':
        return { type: 'update_rate_limit' };
      case 'for_each_related':
        return { type: 'for_each_related', relationship: '', direction: 'both', actions: [] };
      case 'conditional':
        return { type: 'conditional', condition: { type: 'random_chance', chance: 0.5 }, thenActions: [], elseActions: [] };
      case 'create_relationship':
      default:
        return { type: 'create_relationship', kind: '', src: '$self', dst: '$self', strength: 0.5 };
    }
  };

  const addAction = (type) => {
    updateConfig('actions', [...actions, createAction(type)]);
  };

  const updateAction = (index, action) => {
    const newActions = [...actions];
    newActions[index] = action;
    updateConfig('actions', newActions);
  };

  const removeAction = (index) => {
    updateConfig('actions', actions.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="section">
        <div className="section-title">Conditions ({conditions.length})</div>
        <div className="section-desc">
          All conditions must pass for an entity to be included in the trigger.
        </div>

        {conditions.length === 0 ? (
          <div className="empty-state-compact">No conditions defined.</div>
        ) : (
          conditions.map((cond, index) => (
            <ApplicabilityRuleCard
              key={index}
              rule={cond}
              onChange={(c) => updateCondition(index, c)}
              onRemove={() => removeCondition(index)}
              schema={schema}
              pressures={pressures}
            />
          ))
        )}

        <AddRuleButton onAdd={addCondition} />
      </div>

      <div className="section">
        <div className="section-title">Variables ({Object.keys(variables).length})</div>
        <div className="section-desc">
          Variables select additional entities from the graph to use in actions.
          Referenced as <code className="inline-code">$varName</code> in action entity fields.
        </div>

        {Object.keys(variables).length === 0 && !showAddVarForm ? (
          <div className="empty-state-compact">No variables defined.</div>
        ) : (
          Object.entries(variables).map(([name, varConfig]) => (
            <VariableCard
              key={name}
              name={name}
              config={varConfig}
              onChange={(updated) => updateVariable(name, updated)}
              onRemove={() => removeVariable(name)}
              schema={schema}
              availableRefs={buildAvailableRefs(name)}
            />
          ))
        )}

        {showAddVarForm ? (
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
              <button className="btn btn-secondary" onClick={() => { setShowAddVarForm(false); setNewVarName(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-add" onClick={() => setShowAddVarForm(true)}>
            + Add Variable
          </button>
        )}
      </div>

      <div className="section">
        <div className="section-title">Actions ({actions.length})</div>
        <div className="section-desc">
          Mutations applied to each matching entity (or clusters when configured).
        </div>

        {actions.map((actionItem, index) => (
          <div key={index} style={{ marginBottom: '12px' }}>
            <MutationCard
              mutation={actionItem}
              onChange={(a) => updateAction(index, a)}
              onRemove={() => removeAction(index)}
              schema={schema}
              pressures={pressures}
              entityOptions={entityOptions}
              typeOptions={TRIGGER_MUTATION_TYPES}
              createMutation={createAction}
              titlePrefix="Action"
            />
            {actionItem.type === 'create_relationship' && (
              <label className="checkbox-label" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={actionItem.betweenMatching || false}
                  onChange={(e) => updateAction(index, { ...actionItem, betweenMatching: e.target.checked })}
                  className="checkbox"
                />
                Between matching entities
              </label>
            )}
          </div>
        ))}

        <div className="form-group" style={{ marginTop: '12px' }}>
          <select
            className="select"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              addAction(e.target.value);
            }}
          >
            <option value="">+ Add action...</option>
            {TRIGGER_MUTATION_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Clustering</div>
        <div className="form-grid">
          <ReferenceDropdown
            label="Cluster Mode"
            value={config.clusterMode || 'individual'}
            onChange={(v) => updateConfig('clusterMode', v)}
            options={CLUSTER_MODES}
          />
          {config.clusterMode === 'by_relationship' && (
            <>
              <ReferenceDropdown
                label="Cluster Relationship"
                value={config.clusterRelationshipKind}
                onChange={(v) => updateConfig('clusterRelationshipKind', v)}
                options={relationshipKindOptions}
              />
              <div className="form-group">
                <label className="label">Min Cluster Size</label>
                <NumberInput
                  value={config.minClusterSize}
                  onChange={(v) => updateConfig('minClusterSize', v)}
                  min={1}
                  integer
                  allowEmpty
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-title">Narration Template</div>
        <div className="section-desc" style={{ marginBottom: '8px', fontSize: '11px' }}>
          Syntax: {'{$self.field}'}, {'{$varName.field}'}, {'{field|fallback}'}.
        </div>
        <LocalTextArea
          value={config.narrationTemplate || ''}
          onChange={(value) => updateConfig('narrationTemplate', value || undefined)}
          placeholder="e.g., {$self.name} reached a critical threshold and transformed."
          rows={2}
        />
      </div>
    </div>
  );
}
