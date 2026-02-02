/**
 * VariableSelectionEditor - Edit a VariableSelectionRule
 */

import React from 'react';
import { ReferenceDropdown, ChipSelect, NumberInput } from './index';
import { VARIABLE_PICK_STRATEGIES } from '../generators/constants';
import { SelectionFiltersEditor } from '../generators/filters';

// Helper to determine selection mode
function getSelectionMode(select) {
  if (!select?.from || select.from === 'graph') return 'graph';
  if (typeof select.from === 'object' && 'path' in select.from) return 'path';
  if (typeof select.from === 'object' && 'relatedTo' in select.from) return 'related';
  return 'graph';
}

export function VariableSelectionEditor({
  value,
  onChange,
  schema,
  availableRefs = [],
  showPickStrategy = true,
  showMaxResults = true,
  allowPreferFilters = true,
}) {
  const select = value || {};
  const selectionMode = getSelectionMode(select);
  const isRelatedMode = selectionMode === 'related';
  const isPathMode = selectionMode === 'path';
  const fromSpec = isRelatedMode ? select.from : null;
  const pathSpec = isPathMode ? select.from : null;

  const entityKindOptions = (schema?.entityKinds || []).map((ek) => ({
    value: ek.kind,
    label: ek.description || ek.kind,
  }));

  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const getSubtypeOptions = (kind) => {
    const ek = (schema?.entityKinds || []).find((e) => e.kind === kind);
    if (!ek?.subtypes) return [];
    return ek.subtypes.map((st) => ({ value: st.id, label: st.name || st.id }));
  };

  const updateSelect = (field, fieldValue) => {
    onChange({ ...select, [field]: fieldValue });
  };

  const updateSelectMultiple = (updates) => {
    onChange({ ...select, ...updates });
  };

  const setMode = (mode) => {
    if (mode === 'graph') {
      onChange({ ...select, from: 'graph' });
      return;
    }
    if (mode === 'path') {
      const startRef = availableRefs[0] || '$self';
      onChange({
        ...select,
        from: {
          path: [{ from: startRef, via: '', direction: 'both' }],
        },
      });
      return;
    }
    const relatedTo = availableRefs[0] || '$target';
    onChange({
      ...select,
      from: { relatedTo, relationshipKind: '', direction: 'both' },
    });
  };

  const updatePathStep = (index, step) => {
    const path = [...(pathSpec?.path || [])];
    path[index] = step;
    updateSelect('from', { path });
  };

  const addPathStep = () => {
    const path = [...(pathSpec?.path || [])];
    path.push({ via: '', direction: 'both' });
    updateSelect('from', { path });
  };

  const removePathStep = (index) => {
    const path = (pathSpec?.path || []).filter((_, i) => i !== index);
    if (path.length === 0) {
      // Switch back to graph mode if no steps left
      setMode('graph');
    } else {
      updateSelect('from', { path });
    }
  };

  const updateFrom = (field, fieldValue) => {
    const nextFrom = { ...(fromSpec || { relatedTo: availableRefs[0] || '$target', relationshipKind: '', direction: 'both' }), [field]: fieldValue };
    updateSelect('from', nextFrom);
  };

  return (
    <div>
      <div className="form-grid">
        <ReferenceDropdown
          label="Select From"
          value={selectionMode}
          onChange={(v) => setMode(v)}
          options={[
            { value: 'graph', label: 'Graph (by entity kind)' },
            { value: 'related', label: 'Related Entities (single hop)' },
            { value: 'path', label: 'Path Traversal (multi-hop)' },
          ]}
        />

        {selectionMode === 'graph' && (
          <ReferenceDropdown
            label="Entity Kind"
            value={select.kind || ''}
            onChange={(v) => updateSelectMultiple({ kind: v || undefined, subtypes: undefined })}
            options={entityKindOptions}
            placeholder="Any kind"
          />
        )}

        {isRelatedMode && (
          <>
            <ReferenceDropdown
              label="Related To"
              value={fromSpec?.relatedTo || availableRefs[0] || '$target'}
              onChange={(v) => updateFrom('relatedTo', v)}
              options={availableRefs.map((r) => ({ value: r, label: r }))}
              placeholder="Select entity..."
            />
            <ReferenceDropdown
              label="Relationship Kind"
              value={fromSpec?.relationshipKind || ''}
              onChange={(v) => updateFrom('relationshipKind', v)}
              options={relationshipKindOptions}
              placeholder="Select relationship..."
            />
            <ReferenceDropdown
              label="Direction"
              value={fromSpec?.direction || 'both'}
              onChange={(v) => updateFrom('direction', v)}
              options={[
                { value: 'both', label: 'Both' },
                { value: 'src', label: 'Source (outgoing)' },
                { value: 'dst', label: 'Destination (incoming)' },
              ]}
            />
          </>
        )}

        {isPathMode && (
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Path Steps</label>
            <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
              Multi-hop traversal from the starting entity through relationships.
            </div>
          </div>
        )}

        {showPickStrategy && (
          <ReferenceDropdown
            label="Pick Strategy"
            value={select.pickStrategy || ''}
            onChange={(v) => updateSelect('pickStrategy', v || undefined)}
            options={VARIABLE_PICK_STRATEGIES}
            placeholder="Select..."
          />
        )}

        {showMaxResults && (
          <div className="form-group">
            <label className="label">Max Results</label>
            <NumberInput
              value={select.maxResults}
              onChange={(v) => updateSelect('maxResults', v)}
              min={1}
              integer
              allowEmpty
              placeholder="1"
            />
          </div>
        )}
      </div>

      {isPathMode && (
        <div style={{ marginTop: '16px' }}>
          {(pathSpec?.path || []).map((step, index) => (
            <div key={index} className="item-card" style={{ marginBottom: '12px' }}>
              <div className="item-card-header" style={{ padding: '12px' }}>
                <div className="item-card-icon">🔗</div>
                <div className="item-card-info">
                  <div className="item-card-title">Step {index + 1}</div>
                </div>
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => removePathStep(index)}
                  title="Remove step"
                >
                  ×
                </button>
              </div>
              <div className="item-card-body">
                <div className="form-grid">
                  {index === 0 && (
                    <ReferenceDropdown
                      label="Start From"
                      value={step.from || availableRefs[0] || '$self'}
                      onChange={(v) => updatePathStep(index, { ...step, from: v })}
                      options={availableRefs.map((r) => ({ value: r, label: r }))}
                      placeholder="Select entity..."
                    />
                  )}
                  <ReferenceDropdown
                    label="Via Relationship"
                    value={step.via || ''}
                    onChange={(v) => updatePathStep(index, { ...step, via: v })}
                    options={relationshipKindOptions}
                    placeholder="Select relationship..."
                  />
                  <ReferenceDropdown
                    label="Direction"
                    value={step.direction || 'both'}
                    onChange={(v) => updatePathStep(index, { ...step, direction: v })}
                    options={[
                      { value: 'both', label: 'Both' },
                      { value: 'src', label: 'Source (outgoing)' },
                      { value: 'dst', label: 'Destination (incoming)' },
                    ]}
                  />
                  <ReferenceDropdown
                    label="Target Kind (optional)"
                    value={step.targetKind || ''}
                    onChange={(v) => updatePathStep(index, { ...step, targetKind: v || undefined })}
                    options={entityKindOptions}
                    placeholder="Any kind"
                  />
                </div>
              </div>
            </div>
          ))}
          <button className="btn-add" onClick={addPathStep}>
            + Add Step
          </button>
        </div>
      )}

      {(isRelatedMode || isPathMode) && (
        <div style={{ marginTop: '16px' }}>
          <ReferenceDropdown
            label="Filter by Entity Kind (optional)"
            value={select.kind || ''}
            onChange={(v) => updateSelectMultiple({ kind: v || undefined, subtypes: undefined })}
            options={entityKindOptions}
            placeholder="Any kind"
          />
        </div>
      )}

      {select.kind && (
        <div style={{ marginTop: '16px' }}>
          <ChipSelect
            label="Subtypes (optional)"
            value={select.subtypes || []}
            onChange={(v) => updateSelect('subtypes', v.length > 0 ? v : undefined)}
            options={getSubtypeOptions(select.kind)}
            placeholder="Any subtype"
          />
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <label className="label">Status Filter (optional)</label>
        <input
          type="text"
          value={select.status || ''}
          onChange={(e) => updateSelect('status', e.target.value || undefined)}
          className="input"
          placeholder="e.g., active"
        />
      </div>

      <div style={{ marginTop: '16px' }}>
        <label className="label">Not Status (optional)</label>
        <input
          type="text"
          value={select.notStatus || ''}
          onChange={(e) => updateSelect('notStatus', e.target.value || undefined)}
          className="input"
          placeholder="e.g., dead"
        />
      </div>

      <div style={{ marginTop: '24px' }}>
        <label className="label">Selection Filters</label>
        <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
          Optional filters to narrow down which entities can be selected. All filters must pass.
        </div>
        <SelectionFiltersEditor
          filters={select.filters}
          onChange={(filters) => updateSelect('filters', filters.length > 0 ? filters : undefined)}
          schema={schema}
          availableRefs={availableRefs}
        />
      </div>

      {allowPreferFilters && (
        <div style={{ marginTop: '24px' }}>
          <label className="label">Prefer Filters (optional)</label>
          <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
            Preferred matches. If no entities match these filters, selection falls back to all matches.
          </div>
          <SelectionFiltersEditor
            filters={select.preferFilters}
            onChange={(filters) => updateSelect('preferFilters', filters.length > 0 ? filters : undefined)}
            schema={schema}
            availableRefs={availableRefs}
          />
        </div>
      )}
    </div>
  );
}

export default VariableSelectionEditor;
