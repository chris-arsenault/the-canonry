/**
 * TargetTab - Configure the primary target selection ($target)
 */

import React from 'react';
import { ReferenceDropdown, NumberInput } from '../../shared';
import SelectionRuleEditor from '../../shared/SelectionRuleEditor';

/**
 * @param {Object} props
 * @param {Object} props.generator - The generator being edited
 * @param {Function} props.onChange - Callback when generator changes
 * @param {Object} props.schema - Domain schema with entity/relationship kinds
 */
export function TargetTab({ generator, onChange, schema }) {
  const selection = generator.selection || { strategy: 'by_kind' };

  // Get the kind of the first created entity for saturation limit inference
  const firstCreatedKind = (generator.creation || [])[0]?.kind;

  return (
    <div>
      <div className="section">
        <div className="section-title">Target Selection</div>

        <div className="info-box">
          <div className="info-box-title">What is $target?</div>
          <div className="info-box-text">
            The <code className="inline-code">$target</code> is the primary entity this generator operates on.
            It's selected from the world graph based on the rules you define here. Once selected, you can reference
            it in creation rules (e.g., inherit culture from $target) and relationships (e.g., connect new entity to $target).
          </div>
        </div>

        <SelectionRuleEditor
          value={selection}
          onChange={(updated) => onChange({ ...generator, selection: updated })}
          schema={schema}
          availableRefs={['$target', ...(Object.keys(generator.variables || {}))]}
        />

        {/* Saturation Limits */}
        <div style={{ marginTop: '24px' }}>
          <label className="label">Saturation Limits</label>
          <div className="info-box-text" style={{ marginBottom: '12px', fontSize: '12px' }}>
            Limit targets based on existing relationship counts. Only targets with fewer than
            the max count of relationships will be selected.
          </div>
          <SaturationLimitsEditor
            limits={selection.saturationLimits || []}
            onChange={(limits) => onChange({
              ...generator,
              selection: { ...selection, saturationLimits: limits.length > 0 ? limits : undefined },
            })}
            schema={schema}
            createdKind={firstCreatedKind}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Editor for saturation limits (simplified: just relationship kind + max count)
 * fromKind is auto-inferred from first creation entry, direction is always 'any'
 */
function SaturationLimitsEditor({ limits, onChange, schema, createdKind }) {
  const relationshipKindOptions = (schema?.relationshipKinds || []).map((rk) => ({
    value: rk.kind,
    label: rk.description || rk.kind,
  }));

  const addLimit = () => {
    // Auto-populate fromKind from the first created entity kind
    onChange([...limits, { relationshipKind: '', maxCount: 2, fromKind: createdKind }]);
  };

  const updateLimit = (index, field, value) => {
    const updated = [...limits];
    updated[index] = { ...updated[index], [field]: value };
    // Remove undefined/empty values
    if (value === undefined || value === '') {
      delete updated[index][field];
    }
    // Always ensure fromKind is set to the created kind
    if (!updated[index].fromKind && createdKind) {
      updated[index].fromKind = createdKind;
    }
    onChange(updated);
  };

  const removeLimit = (index) => {
    onChange(limits.filter((_, i) => i !== index));
  };

  const getRelationshipLabel = (kind) => {
    const rk = relationshipKindOptions.find(r => r.value === kind);
    return rk?.label || kind || '?';
  };

  if (limits.length === 0) {
    return (
      <button className="btn-add" onClick={addLimit}>
        + Add Saturation Limit
      </button>
    );
  }

  return (
    <div>
      {limits.map((limit, index) => (
        <div key={index} className="item-card">
          <div className="item-card-header">
            <div className="rel-visual">
              <span className="text-small">
                <span className="rel-kind">{getRelationshipLabel(limit.relationshipKind)}</span>
                {' < '}{limit.maxCount || '?'}
              </span>
            </div>
            <button className="btn-icon btn-icon-danger" onClick={() => removeLimit(index)}>×</button>
          </div>
          <div className="item-card-body">
            <div className="form-grid">
              <ReferenceDropdown
                label="Relationship Kind"
                value={limit.relationshipKind || ''}
                onChange={(v) => updateLimit(index, 'relationshipKind', v)}
                options={relationshipKindOptions}
                placeholder="Select relationship..."
              />
              <div className="form-group">
                <label className="label">Max Count</label>
                <NumberInput
                  value={limit.maxCount}
                  onChange={(v) => updateLimit(index, 'maxCount', v ?? 2)}
                  min={0}
                  integer
                  placeholder="2"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      <button className="btn-add" onClick={addLimit}>
        + Add Saturation Limit
      </button>
    </div>
  );
}

export default TargetTab;
